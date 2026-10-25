const shape = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key));
const units = ['money-per-unit', 'points', 'percent-of-par'];
export function validPlanPriceBasis(value) {
  return shape(value, ['unit', 'currency', 'origin']) && units.includes(value.unit) && value.origin === 'owner-declared'
    && (value.unit === 'money-per-unit' ? typeof value.currency === 'string' && /^[A-Z]{3}$/u.test(value.currency) && value.currency !== 'RUR' : value.currency === null);
}
export function declaredPlanPriceBasis(value) {
  if (value === null || value === undefined) return undefined;
  if (!shape(value, ['unit', 'currency']) || !units.includes(value.unit)) throw Error('Invalid plan price basis');
  const currency = typeof value.currency === 'string' ? value.currency.trim().toUpperCase() : value.currency;
  const result = { unit: value.unit, currency: currency === 'RUR' ? 'RUB' : currency, origin: 'owner-declared' };
  if (!validPlanPriceBasis(result)) throw Error('Invalid plan price basis');
  return result;
}
export function samePlanPriceBasis(a, b) {
  return a === undefined && b === undefined || validPlanPriceBasis(a) && validPlanPriceBasis(b)
    && a.unit === b.unit && a.currency === b.currency && a.origin === b.origin;
}
export function planPriceUnitLabel(value) {
  if (!validPlanPriceBasis(value)) return null;
  return value.unit === 'money-per-unit' ? value.currency + ' за единицу' : value.unit === 'points' ? 'пункты' : '% номинала';
}
const planNanos = value => {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d{0,17})(?:\.\d{1,9})?$/u.test(value)) return null;
  const [whole, fraction = ''] = value.split('.'), nanos = BigInt(whole) * 1000000000n + BigInt(fraction.padEnd(9, '0'));
  return nanos > 0n ? nanos : null;
};
/** Difference between two explicit saved prices, never slippage, P&L or R.
 * No current metadata, FX, order timing or unrecorded units are inferred. */
export function comparePlanExecutionPrice(plan, execution) {
  const value = plan?.value, basis = value?.priceBasis;
  if (basis === undefined) return { state: 'unavailable', reason: 'missing-price-basis' };
  if (!validPlanPriceBasis(basis)) throw Error('Invalid plan price basis');
  if (basis.unit !== 'money-per-unit') return { state: 'unavailable', reason: 'incompatible-price-unit' };
  if (!execution || typeof execution.currency !== 'string' || !/^[A-Z]{3}$/u.test(execution.currency)
    || typeof execution.priceNanos !== 'string' || !/^(?:0|[1-9]\d{0,79})$/u.test(execution.priceNanos) || !['buy', 'sell'].includes(execution.side)) throw Error('Invalid saved execution');
  if (basis.currency !== execution.currency) return { state: 'unavailable', reason: 'different-currency' };
  if (value.action !== execution.side) return { state: 'unavailable', reason: 'different-intent' };
  const planned = planNanos(value.entryPrice);
  if (planned === null) return { state: 'unavailable', reason: 'missing-entry-price' };
  const actual = BigInt(execution.priceNanos);
  return { state: 'available', currency: basis.currency, plannedPriceNanos: planned.toString(), executionPriceNanos: actual.toString(),
    differenceNanos: (actual - planned).toString(), method: 'saved-execution-minus-declared-entry' };
}
export function signedPlanPriceDecimal(value) {
  if (typeof value !== 'string' || !/^-?(?:0|[1-9]\d{0,79})$/u.test(value)) throw Error('Invalid price difference');
  const amount = BigInt(value), absolute = amount < 0n ? -amount : amount, padded = absolute.toString().padStart(10, '0'), fraction = padded.slice(-9).replace(/0+$/u, '');
  return (amount < 0n ? '−' : amount > 0n ? '+' : '') + padded.slice(0, -9) + (fraction ? ',' + fraction : '');
}
export function planPriceComparisonText(plan, execution) {
  const result = comparePlanExecutionPrice(plan, execution);
  if (result.state === 'available') return `Разница цен: ${signedPlanPriceDecimal(result.differenceNanos)} ${result.currency} за единицу (сохранённое исполнение минус плановый вход).`;
  return ({ 'missing-price-basis': 'Сравнение цен недоступно: единицы планового входа не сохранены.',
    'incompatible-price-unit': 'Сравнение цен недоступно: единицы плана не совпадают с денежной ценой исполнения.',
    'different-currency': 'Сравнение цен недоступно: валюты плана и исполнения различаются. Пересчёт валют не выполняется.',
    'different-intent': 'Сравнение цен недоступно: намерение в плане не совпадает с направлением исполнения.',
    'missing-entry-price': 'Сравнение цен недоступно: в выбранной версии нет цены входа.' })[result.reason];
}
