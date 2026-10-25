import { validatePlanHistory } from './plan-history-ui.js';
import { validExecutionQuantity } from './execution-quantity-contract.js';

export const PLAN_EXECUTION_LINK_LIMIT = 100;
export const linkObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const linkShape = (value, keys) => linkObject(value) && Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key));
export const linkHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
export const linkStamp = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
export const linkNote = value => typeof value === 'string' && value.length <= 2000 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value);
const integer = value => typeof value === 'string' && /^(?:0|[1-9]\d{0,79})$/u.test(value);
const fail = () => { throw new Error('Не удалось проверить связи плана с исполнениями.'); };

export function validateLinkedPlan(plan, planId, portfolioIds) {
  if (!linkShape(plan, ['sequence', 'kind', 'recordedAt', 'clockRegressed', 'value'])) fail();
  validatePlanHistory({ schema: Object.hasOwn(plan.value || {}, 'planDetails') ? 'trading-plan-history-v4' : Object.hasOwn(plan.value || {}, 'riskScenario') ? 'trading-plan-history-v3' : Object.hasOwn(plan.value || {}, 'priceBasis') ? 'trading-plan-history-v2' : 'trading-plan-history-v1', planId, execution: 'none',
    coverage: { origin: plan.sequence === 1 && plan.kind === 'created' ? 'from-local-create' : 'unknown-before-first-observation',
      retainedLimit: 50, earlierVersionsDropped: plan.sequence > 1, someAccountVersionsUnavailable: false,
      clock: 'local-device-clock', semantics: 'accepted-local-writes' }, items: [plan] }, { planId, portfolioIds });
  return plan;
}
export function validLinkedExecution(value) {
  return linkShape(value, ['at', 'side', 'quantityNanos', 'priceNanos', 'currency', 'executionQuantity'])
    && linkStamp(value.at) && ['buy', 'sell'].includes(value.side) && integer(value.quantityNanos) && BigInt(value.quantityNanos) > 0n
    && integer(value.priceNanos) && typeof value.currency === 'string' && /^[A-Z]{3}$/u.test(value.currency)
    && (value.executionQuantity === null || validExecutionQuantity(value.executionQuantity)
      && BigInt(value.quantityNanos) <= BigInt(value.executionQuantity.executedNanos));
}
export function validatePlanExecutionLinks(data, { planId, portfolioIds }) {
  if (!linkShape(data, ['schema', 'planId', 'planVersion', 'linksVersion', 'someAccountsUnavailable', 'items'])
    || !['plan-execution-links-v1', 'plan-execution-links-v2', 'plan-execution-links-v3', 'plan-execution-links-v4'].includes(data.schema) || data.planId !== planId || !linkHash(data.planVersion) || !linkHash(data.linksVersion)
    || typeof data.someAccountsUnavailable !== 'boolean' || !Array.isArray(data.items) || data.items.length > PLAN_EXECUTION_LINK_LIMIT) fail();
  let sequence = 0; const ids = new Set();
  for (const row of data.items) {
    if (!linkShape(row, ['id', 'sequence', 'recordedAt', 'clockRegressed', 'withdrawnAt', 'plan', 'execution', 'note', 'sourceState', 'planVersionRetained'])
      || typeof row.id !== 'string' || !/^[a-f0-9-]{36}$/u.test(row.id) || ids.has(row.id)
      || !Number.isSafeInteger(row.sequence) || row.sequence <= sequence || row.sequence > PLAN_EXECUTION_LINK_LIMIT
      || !linkStamp(row.recordedAt) || typeof row.clockRegressed !== 'boolean'
      || row.withdrawnAt !== null && !linkStamp(row.withdrawnAt) || !linkNote(row.note) || !validLinkedExecution(row.execution)
      || !['unchanged', 'changed-or-unavailable', 'not-checked'].includes(row.sourceState)
      || (row.withdrawnAt === null ? row.sourceState === 'not-checked' : row.sourceState !== 'not-checked')
      || typeof row.planVersionRetained !== 'boolean') fail();
    validateLinkedPlan(row.plan, planId, portfolioIds);
    if (data.schema !== 'plan-execution-links-v4' && Object.hasOwn(row.plan.value, 'planDetails')) fail();
    if (!['plan-execution-links-v3','plan-execution-links-v4'].includes(data.schema) && Object.hasOwn(row.plan.value, 'riskScenario')) fail();
    if (data.schema === 'plan-execution-links-v1' && Object.hasOwn(row.plan.value, 'priceBasis')) fail();
    ids.add(row.id); sequence = row.sequence;
  }
  return data;
}
export function validatePlanExecutionCandidates(data, { planId, portfolioIds }) {
  if (!linkShape(data, ['schema', 'planId', 'planVersion', 'linksVersion', 'plan', 'period', 'items'])
    || !['plan-execution-candidates-v1', 'plan-execution-candidates-v2', 'plan-execution-candidates-v3', 'plan-execution-candidates-v4'].includes(data.schema) || data.planId !== planId || !linkHash(data.planVersion) || !linkHash(data.linksVersion)
    || !linkShape(data.period, ['from', 'to']) || !linkStamp(data.period.from) || !linkStamp(data.period.to) || data.period.from > data.period.to
    || Date.parse(data.period.to) - Date.parse(data.period.from) > 366 * 86400000
    || !Array.isArray(data.items) || data.items.length > PLAN_EXECUTION_LINK_LIMIT) fail();
  validateLinkedPlan(data.plan, planId, portfolioIds); const refs = new Set();
  if (data.schema !== 'plan-execution-candidates-v4' && Object.hasOwn(data.plan.value, 'planDetails')) fail();
  if (!['plan-execution-candidates-v3','plan-execution-candidates-v4'].includes(data.schema) && Object.hasOwn(data.plan.value, 'riskScenario')) fail();
  if (data.schema === 'plan-execution-candidates-v1' && Object.hasOwn(data.plan.value, 'priceBasis')) fail();
  for (const item of data.items) {
    if (!linkShape(item, ['ref', 'execution']) || !linkHash(item.ref) || refs.has(item.ref) || !validLinkedExecution(item.execution)
      || item.execution.at < data.period.from || item.execution.at > data.period.to) fail();
    refs.add(item.ref);
  }
  return data;
}
