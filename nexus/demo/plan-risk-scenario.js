import { calculateRiskDraft } from './risk-calculator.js';

const REQUIRED = ['capitalNanos', 'riskBudgetNanos', 'entryPriceNanos', 'stopPriceNanos', 'lotSize', 'direction', 'assetType'];
const OPTIONAL = ['targetPriceNanos', 'minPriceIncrementNanos', 'minPriceIncrementAmountNanos', 'guaranteePerLotNanos'];
const METRICS = ['riskBudgetNanos', 'lossPerLotNanos', 'lots', 'units', 'positionAmountNanos', 'actualRiskNanos',
  'stopDistanceNanos', 'capitalLimited', 'riskPerUnitNanos', 'rewardPerUnitNanos', 'potentialRewardNanos', 'rewardRiskRatio'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const keys = (value, expected) => object(value) && Object.keys(value).length === expected.length && Object.keys(value).every(key => expected.includes(key));
const fail = () => { throw new Error('Расчёт не соответствует уровням и единицам плана. Перенесите новый расчёт или уберите прежний.'); };
const positive = value => typeof value === 'string' && /^\d{1,30}$/u.test(value) && BigInt(value) > 0n;
const stable = value => JSON.stringify(value, (_, item) => object(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);

export function scenarioPriceDecimal(value) {
  const number = BigInt(value), fraction = String(number % 1_000_000_000n).padStart(9, '0').replace(/0+$/u, '');
  return String(number / 1_000_000_000n) + (fraction ? '.' + fraction : '');
}
function priceNanos(value) {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d{0,17})(?:\.\d{1,9})?$/u.test(value)) fail();
  const [whole, fraction = ''] = value.split('.');
  return (BigInt(whole) * 1_000_000_000n + BigInt(fraction.padEnd(9, '0'))).toString();
}
export function scenarioPlanFields(input) {
  return { action: input.direction === 'long' ? 'buy' : 'sell', entryPrice: scenarioPriceDecimal(input.entryPriceNanos),
    stopPrice: scenarioPriceDecimal(input.stopPriceNanos), targetPrice: input.targetPriceNanos ? scenarioPriceDecimal(input.targetPriceNanos) : null,
    priceBasis: input.assetType === 'share' ? { unit: 'money-per-unit', currency: 'RUB' } : { unit: 'points', currency: null } };
}
function matchesPlan(input, plan) {
  const expected = scenarioPlanFields(input);
  return plan && plan.action === expected.action && plan.priceBasis?.unit === expected.priceBasis.unit
    && plan.priceBasis.currency === expected.priceBasis.currency
    && ['entryPrice', 'stopPrice', 'targetPrice'].every(key => expected[key] === null
      ? plan[key] === null : priceNanos(plan[key]) === priceNanos(expected[key]));
}
/** Version 1 reuses the manual calculator's integer arithmetic. Changes to that
 * method require a new scenario version; accepted versions are never rewritten. */
export function createPlanRiskScenario(value, plan) {
  if (value === null || value === undefined) return undefined;
  if (!object(value) || REQUIRED.some(key => !Object.hasOwn(value, key))
    || Object.keys(value).some(key => ![...REQUIRED, ...OPTIONAL].includes(key))) fail();
  const input = Object.fromEntries([...REQUIRED, ...OPTIONAL].filter(key => Object.hasOwn(value, key)).map(key => [key, value[key]]));
  if (Object.entries(input).some(([key, entry]) => !['direction', 'assetType'].includes(key) && !positive(entry))) fail();
  for (const key of Object.keys(input)) if (!['direction', 'assetType'].includes(key)) input[key] = BigInt(input[key]).toString();
  if (!['long', 'short'].includes(input.direction) || !['share', 'future'].includes(input.assetType)
    || input.assetType === 'share' && OPTIONAL.slice(1).some(key => Object.hasOwn(input, key))
    || input.assetType === 'future' && (!input.minPriceIncrementNanos || !input.minPriceIncrementAmountNanos)) fail();
  const result = calculateRiskDraft(input);
  if (result.state !== 'calculated') fail();
  // Every retained scenario must also fit the plan's price domain.
  const fields = scenarioPlanFields(input);
  for (const key of ['entryPrice', 'stopPrice', 'targetPrice']) if (fields[key] !== null) priceNanos(fields[key]);
  if (plan !== undefined && !matchesPlan(input, plan)) fail();
  return { schema: 'manual-risk-scenario-v1', origin: 'owner-declared', currency: 'RUB', input,
    result: Object.fromEntries(METRICS.map(key => [key, result[key]])) };
}
export function validPlanRiskScenario(value, plan) {
  try {
    return keys(value, ['schema', 'origin', 'currency', 'input', 'result']) && keys(value.result, METRICS)
      && stable(value) === stable(createPlanRiskScenario(value.input, plan));
  } catch { return false; }
}
export const samePlanRiskScenario = (first, second) => stable(first ?? null) === stable(second ?? null);
