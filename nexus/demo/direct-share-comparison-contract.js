import { concentrationDecimal, concentrationValue, concentrationPriceCurrency, CONCENTRATION_FX_VERSION, validateDirectShareConcentration } from './direct-share-concentration-contract.js';
export const SHARE_COMPARISON_VERSION = 'direct-share-comparison-v1';
export const SHARE_COMPARISON_FX_VERSION = 'direct-share-comparison-v2';
export const shareComparisonVersion = (before, after) => [before, after].some(dto => dto.contractVersion === CONCENTRATION_FX_VERSION) ? SHARE_COMPARISON_FX_VERSION : SHARE_COMPARISON_VERSION;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const closed = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join('|') === keys.split(' ').sort().join('|');
const abs = n => n < 0n ? -n : n;
export function previousConcentrationPeriod(current) {
  const to = new Date(Date.parse(current.period.observedAt) - 1).toISOString();
  const from = current.period.requestedFrom < to ? current.period.requestedFrom : new Date(Date.parse(to) - 1).toISOString();
  return { from, to };
}
const indexed = dto => {
  const result = new Map();
  for (const row of dto.rows) if (row.instrumentUid) {
    const rows = result.get(row.instrumentUid) || []; rows.push(row); result.set(row.instrumentUid, rows);
  }
  return result;
};
const side = rows => !rows ? { state: 'absent', key: null } : rows.length !== 1 ? { state: 'ambiguous', key: null }
  : { state: rows[0].state, key: rows[0].key };

/** Changes describe two observed values, never executions, returns or causes. */
export function compareDirectShares(before, after) {
  if (!before.evidence.sourceVerified || !after.evidence.sourceVerified) return { state: 'unavailable', matched: 0, unmatched: null, unidentified: null, rows: [] };
  const old = indexed(before), current = indexed(after), rows = [];
  const scale = shareComparisonVersion(before, after) === SHARE_COMPARISON_FX_VERSION ? 27 : 18;
  const gross = dto => dto.rows.filter(row => row.state === 'included').reduce((sum, row) => sum + abs(concentrationValue(row, scale)), 0n);
  const oldGross = gross(before), newGross = gross(after);
  for (const uid of new Set([...current.keys(), ...old.keys()])) {
    const previous = side(old.get(uid)), next = side(current.get(uid));
    const matched = previous.state === 'included' && next.state === 'included';
    const a = matched ? old.get(uid)[0] : null, b = matched ? current.get(uid)[0] : null;
    const oldValue = matched ? concentrationValue(a, scale) : null;
    const newValue = matched ? concentrationValue(b, scale) : null;
    rows.push({ instrumentUid: uid, before: previous, after: next, state: matched ? 'matched' : 'unknown',
      quantityDeltaNanos: matched ? (BigInt(b.quantityNanos) - BigInt(a.quantityNanos)).toString() : null,
      priceDeltaNanos: matched && concentrationPriceCurrency(a) === concentrationPriceCurrency(b) ? (BigInt(b.priceNanos) - BigInt(a.priceNanos)).toString() : null,
      valueDelta: matched ? concentrationDecimal(newValue - oldValue, scale) : null,
      weightDelta: matched && oldGross && newGross ? { numerator: (abs(newValue) * oldGross - abs(oldValue) * newGross).toString(), denominator: (oldGross * newGross).toString() } : null });
  }
  const matched = rows.filter(row => row.state === 'matched').length;
  return { state: 'partial', matched, unmatched: rows.length - matched,
    unidentified: before.rows.filter(row => !row.instrumentUid).length + after.rows.filter(row => !row.instrumentUid).length, rows };
}

export function validateDirectShareComparison(dto, expectedCurrent, expectedContextKey) {
  try {
    if (!closed(dto, 'contractVersion current previous comparison contextKey') || dto.contractVersion !== shareComparisonVersion(dto.previous, dto.current)
      || typeof expectedContextKey !== 'string' || !/^[a-f0-9]{64}$/u.test(expectedContextKey) || dto.contextKey !== expectedContextKey
      || !validateDirectShareConcentration(dto.current) || !validateDirectShareConcentration(dto.previous)
      || !same(dto.current, expectedCurrent) || !dto.current.evidence.sourceVerified
      || !dto.current.period.requestedFrom || !dto.current.period.requestedTo || dto.current.period.requestedFrom >= dto.current.period.requestedTo
      || !same(dto.previous.scope, dto.current.scope) || dto.previous.evidence.dataMode !== dto.current.evidence.dataMode) return false;
    const period = previousConcentrationPeriod(dto.current);
    if (dto.previous.period.requestedFrom !== period.from || dto.previous.period.requestedTo !== period.to
      || dto.previous.period.observedAt && dto.previous.period.observedAt >= dto.current.period.observedAt) return false;
    return same(dto.comparison, compareDirectShares(dto.previous, dto.current));
  } catch { return false; }
}
