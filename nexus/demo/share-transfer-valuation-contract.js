const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
export const shareValuationRef = value => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
export const shareValuationInstant = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(value);
const amount = value => typeof value === 'string' && /^(0|[1-9]\d{0,79})$/u.test(value);
const quantity = value => typeof value === 'string' && /^(0|[1-9]\d{0,4105})$/u.test(value) && BigInt(value) % 1000000000n === 0n;
const label = (value, limit) => typeof value === 'string' && value.length > 0 && value.length <= limit && !/[\u0000-\u001f\u007f]/u.test(value);
const movementKeys = ['operationRef', 'portfolioId', 'accountLabel', 'at', 'kind', 'assetKind', 'instrumentRef', 'instrumentLabel',
  'quantityNanos', 'reportedQuantityNanos', 'remainingQuantityNanos', 'quantityBasis'];
function movement(value, candidate) {
  return exact(value, [...movementKeys, ...(candidate ? ['currentValuation'] : [])]) && shareValuationRef(value.operationRef)
    && (value.portfolioId === null || /^portfolio-[1-9]\d{0,31}$/u.test(value.portfolioId)) && label(value.accountLabel, 100)
    && shareValuationInstant(value.at) && ['deposit', 'withdrawal'].includes(value.kind) && value.assetKind === 'share'
    && shareValuationRef(value.instrumentRef) && label(value.instrumentLabel, 240) && value.quantityBasis === 'native-done-rest'
    && quantity(value.quantityNanos) && BigInt(value.quantityNanos) > 0n && quantity(value.reportedQuantityNanos)
    && quantity(value.remainingQuantityNanos) && BigInt(value.quantityNanos) + BigInt(value.remainingQuantityNanos) === BigInt(value.reportedQuantityNanos)
    && (!candidate || value.currentValuation === null || exact(value.currentValuation, ['id', 'amountNanos'])
      && uuid(value.currentValuation.id) && amount(value.currentValuation.amountNanos));
}
export function checkedShareValuationView(value, { scopeKey, period }) {
  if (!exact(value, ['schema', 'scopeKey', 'authority', 'currency', 'period', 'candidates', 'candidatesTruncated', 'historyTruncated', 'history'])
    || value.schema !== 'share-transfer-valuations-v1' || value.scopeKey !== scopeKey || !shareValuationRef(scopeKey)
    || value.authority !== 'owner-estimate' || value.currency !== 'RUB' || !exact(value.period, ['from', 'to'])
    || !shareValuationInstant(value.period.from) || !shareValuationInstant(value.period.to) || value.period.from >= value.period.to
    || value.period.from !== period?.from || value.period.to !== period?.to
    || typeof value.candidatesTruncated !== 'boolean' || typeof value.historyTruncated !== 'boolean'
    || !Array.isArray(value.candidates) || value.candidates.length > 200 || !Array.isArray(value.history) || value.history.length > 200
    || !value.candidates.every(row => movement(row, true) && row.portfolioId !== null)
    || new Set(value.candidates.map(row => row.operationRef)).size !== value.candidates.length
    || !value.history.every(row => exact(row, ['id', 'revision', 'state', 'createdAt', 'removedAt', 'supersedesId', 'amountNanos', 'currency', 'movement'])
      && uuid(row.id) && amount(row.amountNanos) && row.currency === 'RUB' && movement(row.movement, false)
      && shareValuationInstant(row.createdAt) && (row.supersedesId === null || uuid(row.supersedesId) && row.supersedesId !== row.id)
      && (['current', 'source-changed'].includes(row.state) ? row.revision === 1 && row.removedAt === null
        : ['superseded', 'removed'].includes(row.state) && row.revision === 2 && shareValuationInstant(row.removedAt) && row.removedAt >= row.createdAt))
    || new Set(value.history.map(row => row.id)).size !== value.history.length
    || [...value.candidates, ...value.history.map(row => row.movement)].some(row => row.at <= period.from || row.at > period.to))
    throw TypeError('Unsupported share valuation selection.');
  for (const row of value.candidates) {
    const active = value.history.filter(item => item.state === 'current' && item.movement.operationRef === row.operationRef);
    if (active.length > 1 || active.length === 1 && (row.currentValuation?.id !== active[0].id || row.currentValuation?.amountNanos !== active[0].amountNanos))
      throw TypeError('Conflicting share valuation selection.');
  }
  return value;
}

/** Exact decimal input. Comma and dot are separators; no float conversion. */
export function parseShareValuationAmount(value) {
  if (typeof value !== 'string') return null;
  const match = /^(0|[1-9]\d{0,70})(?:[.,](\d{1,9}))?$/u.exec(value.trim());
  return match ? (BigInt(match[1]) * 1000000000n + BigInt((match[2] || '').padEnd(9, '0'))).toString() : null;
}
export function shareValuationInputValue(value) {
  if (!amount(value)) return '';
  const n = BigInt(value), fraction = (n % 1000000000n).toString().padStart(9, '0').replace(/0+$/u, '');
  return (n / 1000000000n).toString() + (fraction ? ',' + fraction : '');
}
