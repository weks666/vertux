import { validatePlanExecutionLinks } from './plan-execution-links-contract.js';

const NANO = 1_000_000_000n;
const stable = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);

/** Compare quantities only within the explicitly linked, captured plan version.
 * The source endpoint admits verified ordinary-share fills. Neither the count
 * nor a zero difference proves that all executions of a plan were observed. */
export function comparePlanExecutionSizes(data, options) {
  validatePlanExecutionLinks(data, options);
  const groups = new Map();
  for (const row of data.items) {
    const current = groups.get(row.plan.sequence);
    if (current && stable(current.plan) !== stable(row.plan)) throw new Error('Сохранённые копии одной версии плана не совпадают.');
    if (current) current.links.push(row);
    else groups.set(row.plan.sequence, { plan: row.plan, links: [row] });
  }
  return [...groups.values()].filter(group => group.plan.value.riskScenario).sort((a, b) => b.plan.sequence - a.plan.sequence).map(({ plan, links }) => {
    const scenario = plan.value.riskScenario, active = links.filter(row => row.withdrawnAt === null);
    const sameSide = active.filter(row => row.execution.side === plan.value.action), reasons = [];
    if (scenario.input.assetType !== 'share') reasons.push('unsupported-scenario');
    if (data.someAccountsUnavailable) reasons.push('incomplete-account-scope');
    // An altered opposite-side copy might now describe a matching execution.
    // Do not silently drop it and publish a sum from the remaining prefix.
    if (active.some(row => row.sourceState !== 'unchanged')) reasons.push('changed-source');
    if (!active.length) reasons.push('no-active-links');
    else if (!sameSide.length) reasons.push('no-matching-direction');
    const planned = scenario.input.assetType === 'share' ? BigInt(scenario.result.units) * NANO : null;
    const observed = reasons.length ? null : sameSide.reduce((sum, row) => sum + BigInt(row.execution.quantityNanos), 0n);
    return { sequence: plan.sequence, plan, state: reasons.length ? 'unavailable' : 'compared', reasons,
      plannedQuantityNanos: planned?.toString() ?? null, linkedQuantityNanos: observed?.toString() ?? null,
      differenceQuantityNanos: observed === null ? null : (observed - planned).toString(),
      retained: links.every(row => row.planVersionRetained), totalLinks: links.length,
      withdrawnLinks: links.length - active.length, oppositeDirectionLinks: active.length - sameSide.length,
      matchingLinks: sameSide.length,
      evidence: observed === null ? [] : sameSide.map(row => ({ id: row.id, sequence: row.sequence, execution: row.execution })) };
  });
}
