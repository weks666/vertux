export const ALLOCATION_SCHEMA = 'allocation-plan-v1';
export const ALLOCATION_CLASSES = Object.freeze([['shares', 'Акции'], ['bonds', 'Облигации'], ['etf', 'Фонды'], ['currencies', 'Валютные активы по оценке брокера']].map(Object.freeze));
const CLASS_KEYS = ALLOCATION_CLASSES.map(([key]) => key);
export const allocationObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const shape = (value, keys) => allocationObject(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
export const allocationIso = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
export const allocationHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
export const allocationRevision = value => Number.isSafeInteger(value) && value >= 0;
const integer = value => typeof value === 'string' && /^(?:0|-?[1-9]\d{0,4095})$/u.test(value);
const safeText = value => typeof value === 'string' && value.length > 0 && value.length <= 1024;
export function validateAllocationQuery(value) {
  return shape(value, ['portfolioId', 'accountKey', 'from', 'to'])
    && typeof value.portfolioId === 'string' && /^portfolio-[1-9]\d{0,3}$/u.test(value.portfolioId)
    && typeof value.accountKey === 'string' && /^[a-f0-9]{32}$/u.test(value.accountKey)
    && allocationIso(value.from) && allocationIso(value.to) && value.from < value.to;
}
export function validateAllocationTargets(value) {
  return shape(value, CLASS_KEYS) && CLASS_KEYS.every(key => Number.isSafeInteger(value[key]) && value[key] >= 0 && value[key] <= 10000)
    && CLASS_KEYS.reduce((sum, key) => sum + value[key], 0) === 10000;
}
/** Explicit percentages only: no empty-to-zero coercion or rounding of extra digits. */
export function parseAllocationPercent(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!/^(?:0|[1-9]\d{0,2})(?:[.,]\d{1,2})?$/u.test(text)) return null;
  const [whole, part = ''] = text.replace(',', '.').split('.'), bp = Number(whole) * 100 + Number(part.padEnd(2, '0'));
  return bp <= 10000 ? bp : null;
}
export function allocationPercentInput(bp) {
  return Number.isSafeInteger(bp) && bp >= 0 && bp <= 10000 ? (bp / 100).toFixed(2).replace(/\.?0+$/u, '').replace('.', ',') || '0' : '';
}
export function parseAllocationDraft(draft) {
  const targets = Object.fromEntries(CLASS_KEYS.map(key => [key, parseAllocationPercent(draft?.[key])]));
  const invalid = CLASS_KEYS.filter(key => targets[key] === null), total = invalid.length ? null : CLASS_KEYS.reduce((sum, key) => sum + targets[key], 0);
  return { targets: !invalid.length && total === 10000 ? targets : null, invalid, total };
}
export function validateAllocationObservation(value, query) {
  if (!shape(value, ['observedAt','observedBeforeRequestedStart','ageAtRequestedEndMs','currency','coverage','sourceTimeVerified','dataMode','arithmeticState','reason','navNanos','knownSubtotalNanos','unallocatedNAVNanos','classes'])
    || value.currency !== 'RUB' || value.coverage !== 'partial' || value.sourceTimeVerified !== false || !['synthetic','local-saved'].includes(value.dataMode)
    || !['known','unavailable'].includes(value.arithmeticState) || !(value.reason === null || safeText(value.reason))
    || !['navNanos','knownSubtotalNanos','unallocatedNAVNanos'].every(key => value[key] === null || integer(value[key]))
    || !Array.isArray(value.classes) || value.classes.length !== 4) return false;
  if (value.observedAt !== null) {
    if (!allocationIso(value.observedAt) || value.observedAt > query.to || value.observedBeforeRequestedStart !== (value.observedAt < query.from)
      || value.ageAtRequestedEndMs !== Date.parse(query.to) - Date.parse(value.observedAt)) return false;
  } else if (value.observedBeforeRequestedStart !== null || value.ageAtRequestedEndMs !== null) return false;
  for (const [index, row] of value.classes.entries()) {
    if (!shape(row,['key','state','amountNanos','reason']) || row.key !== CLASS_KEYS[index] || !['known','unknown','unsupported'].includes(row.state)
      || !(row.reason === null || safeText(row.reason)) || (row.state === 'known' ? !integer(row.amountNanos) : row.amountNanos !== null)) return false;
  }
  const known = value.classes.filter(row => row.state === 'known'), subtotal = known.length ? known.reduce((sum,row) => sum + BigInt(row.amountNanos),0n) : null;
  if (value.knownSubtotalNanos !== (subtotal === null ? null : subtotal.toString())) return false;
  if (value.arithmeticState === 'known') {
    if (!allocationIso(value.observedAt) || value.navNanos === null || BigInt(value.navNanos) <= 0n || !known.length
      || known.some(row => BigInt(row.amountNanos) < 0n) || subtotal > BigInt(value.navNanos)
      || value.unallocatedNAVNanos !== (BigInt(value.navNanos) - subtotal).toString() || value.reason !== null) return false;
  } else if (value.unallocatedNAVNanos !== null || !safeText(value.reason)) return false;
  return true;
}
/** Exact fractions; no floating-point amounts, subtotal normalization or intermediate rounding. */
export function allocationComparison(observation, targets) {
  return ALLOCATION_CLASSES.map(([key]) => {
    const row = observation.classes.find(value => value.key === key), known = observation.arithmeticState === 'known' && row.state === 'known';
    const amount = known ? BigInt(row.amountNanos) : null, nav = known ? BigInt(observation.navNanos) : null, target = targets?.[key] ?? null;
    return { key, targetBasisPoints: target,
      actual: known ? { numerator: (100n * amount).toString(), denominator: nav.toString() } : null,
      deviation: known && target !== null ? { numerator: (10000n * amount - BigInt(target) * nav).toString(), denominator: (100n * nav).toString() } : null };
  });
}
export function validateAllocationResponse(value, expectedQuery) {
  if (!shape(value, ['schema','query','contextKey','scopeKey','revision','updatedAt','targets','observation','comparison'])
    || value.schema !== ALLOCATION_SCHEMA || !validateAllocationQuery(value.query) || !allocationHash(value.contextKey) || !allocationHash(value.scopeKey)
    || !allocationRevision(value.revision) || (value.revision === 0 ? value.updatedAt !== null || value.targets !== null : !allocationIso(value.updatedAt))
    || !(value.targets === null || validateAllocationTargets(value.targets)) || !validateAllocationObservation(value.observation,value.query)) return false;
  if (expectedQuery && Object.keys(expectedQuery).some(key => expectedQuery[key] !== value.query[key])) return false;
  return JSON.stringify(value.comparison) === JSON.stringify(allocationComparison(value.observation,value.targets));
}
/** Truncate only at presentation, mark approximations and never print nonzero as zero. */
export function allocationFractionText(value, { signed = false, unit = '%' } = {}) {
  if (!value) return 'Нет данных';
  const n = BigInt(value.numerator), d = BigInt(value.denominator), abs = n < 0n ? -n : n, scaled = abs * 100n / d;
  const sign = n < 0n ? '−' : signed && n > 0n ? '+' : '';
  if (n !== 0n && scaled === 0n) return sign + '< 0,01 ' + unit;
  const approx = abs * 100n % d !== 0n ? '≈ ' : '', whole = scaled / 100n, decimals = (scaled % 100n).toString().padStart(2,'0');
  return approx + sign + whole.toString() + ',' + decimals + ' ' + unit;
}
