export const PORTFOLIO_REVIEW_METHOD = 'saved-rub-totals-v1';
export const REVIEW_METRICS = Object.freeze([
  ['nav', 'Стоимость портфеля'], ['shares', 'Акции'], ['bonds', 'Облигации'], ['etf', 'Фонды'], ['currencies', 'Валютные активы по оценке брокера'],
]);
export const REVIEW_MATERIALITY_NANOS = '1000000000';
export const reviewIso = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
export const reviewHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
export const reviewInteger = value => typeof value === 'string' && /^-?(?:0|[1-9]\d{0,4095})$/u.test(value) && value !== '-0';
const shape = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const REASONS = new Set(['missing_class', 'invalid_class', 'unsupported_class_currency', 'invalid_nav', 'unsupported_nav_currency', 'nav_source_mismatch', 'unknown']);
export function validatePortfolioReviewPacket(value) {
  if (!shape(value, ['schema', 'method', 'scopeKey', 'currency', 'selectedPeriod', 'observedAt', 'sourceTimeVerified', 'coverage', 'dataMode', 'values'])
    || value.schema !== 'portfolio-review-v1' || typeof value.method !== 'string' || !/^[a-z][a-z0-9.-]{1,79}$/u.test(value.method)
    || !reviewHash(value.scopeKey) || !/^[A-Z]{3}$/u.test(value.currency) || !shape(value.selectedPeriod, ['from', 'to'])
    || !reviewIso(value.selectedPeriod.from) || !reviewIso(value.selectedPeriod.to) || value.selectedPeriod.from > value.selectedPeriod.to
    || !reviewIso(value.observedAt) || value.observedAt > value.selectedPeriod.to || value.sourceTimeVerified !== false
    || value.coverage !== 'partial' || !['synthetic', 'local-saved'].includes(value.dataMode)
    || !Array.isArray(value.values) || value.values.length !== REVIEW_METRICS.length) return false;
  return value.values.every((row, index) => shape(row, ['key', 'state', 'amountNanos', 'reasonCode']) && row.key === REVIEW_METRICS[index][0]
    && (row.state === 'known' ? reviewInteger(row.amountNanos) && row.reasonCode === null
      : row.state === 'unknown' && row.amountNanos === null && REASONS.has(row.reasonCode)));
}

/** Compare fixed saved amounts only. NAV and class deltas are not additive;
 * neither source-time order nor a changed amount proves a cause or correction. */
export function comparePortfolioReviews(before, after) {
  if (!validatePortfolioReviewPacket(before) || !validatePortfolioReviewPacket(after)) throw new TypeError('Invalid review packet');
  let kind = 'new-observation', comparable = true;
  if (before.scopeKey !== after.scopeKey || before.dataMode !== after.dataMode) { kind = 'different-scope'; comparable = false; }
  else if (before.currency !== after.currency || before.currency !== 'RUB') { kind = 'different-unit'; comparable = false; }
  else if (before.method !== after.method || before.method !== PORTFOLIO_REVIEW_METHOD) { kind = 'different-method'; comparable = false; }
  else if (after.observedAt < before.observedAt) { kind = 'source-time-regressed'; comparable = false; }
  else if (after.observedAt === before.observedAt) kind = JSON.stringify(before.values) === JSON.stringify(after.values) ? 'same-observation' : 'same-date-changed';
  const items = REVIEW_METRICS.map(([key, label], index) => {
    const a = before.values[index], b = after.values[index];
    let state = comparable ? 'unknown' : 'not-comparable', deltaNanos = null;
    if (comparable && a.state !== b.state) state = 'availability-changed';
    if (comparable && a.state === 'known' && b.state === 'known') {
      const delta = BigInt(b.amountNanos) - BigInt(a.amountNanos), absolute = delta < 0n ? -delta : delta;
      deltaNanos = delta.toString(); state = delta === 0n ? 'unchanged' : absolute >= BigInt(REVIEW_MATERIALITY_NANOS) ? 'changed' : 'below-threshold';
    }
    return { key, label, state, before: a, after: b, deltaNanos };
  });
  const changes = items.filter(row => ['changed', 'availability-changed'].includes(row.state));
  return { schema: 'portfolio-review-comparison-v1', kind, comparable, materialityNanos: REVIEW_MATERIALITY_NANOS,
    changedCount: changes.length, cards: changes.slice(0, 3), items,
    knownPairCount: items.filter(row => row.deltaNanos !== null).length,
    limitations: ['not-investment-profit', 'no-market-causality', 'not-full-allocation', 'unknown-source-time', 'no-confirmed-correction-lineage'] };
}

export function validatePortfolioReviewsResponse(value, query) {
  if (!shape(query, ['portfolioId', 'from', 'to']) || !/^portfolio-[1-9]\d{0,3}$/u.test(query.portfolioId)
    || !reviewIso(query.from) || !reviewIso(query.to) || query.from > query.to) return false;
  if (!shape(value, ['schema', 'scopeKey', 'revision', 'state', 'current', 'records', 'retainedCount', 'retainedLimit', 'comparison', 'canClear', 'action', 'query'])
    || value.schema !== 'portfolio-reviews-v1' || !reviewHash(value.scopeKey) || !Number.isSafeInteger(value.revision) || value.revision < 0
    || !shape(value.query, ['portfolioId', 'from', 'to']) || ['portfolioId', 'from', 'to'].some(key => value.query[key] !== query?.[key])
    || !['empty', 'baseline', 'compared', 'corrupt'].includes(value.state) || value.retainedLimit !== 10 || typeof value.canClear !== 'boolean'
    || ![null, 'saved', 'already-saved', 'cleared'].includes(value.action) || !Array.isArray(value.records) || value.records.length > 2
    || !shape(value.current, ['available', 'snapshotId', 'packet', 'reason'])) return false;
  const current = value.current;
  if (current.available === true) {
    if (!reviewHash(current.snapshotId) || !validatePortfolioReviewPacket(current.packet) || current.packet.scopeKey !== value.scopeKey
      || current.packet.selectedPeriod.from !== query.from || current.packet.selectedPeriod.to !== query.to || current.reason !== null) return false;
  } else if (current.available !== false || current.snapshotId !== null || current.packet !== null || current.reason !== 'source-unverified') return false;
  for (const [index, row] of value.records.entries()) {
    if (!shape(row, ['sequence', 'recordedAt', 'clockRegressed', 'snapshotId', 'packet']) || !Number.isSafeInteger(row.sequence) || row.sequence < 1 || row.sequence > value.revision
      || index && row.sequence !== value.records[index - 1].sequence + 1 || !reviewIso(row.recordedAt) || typeof row.clockRegressed !== 'boolean'
      || !reviewHash(row.snapshotId) || !validatePortfolioReviewPacket(row.packet) || row.packet.scopeKey !== value.scopeKey) return false;
  }
  if (value.state === 'corrupt') return value.revision > 0 && value.records.length === 0 && value.retainedCount === null && value.comparison === null && value.canClear;
  if (!Number.isSafeInteger(value.retainedCount) || value.retainedCount < 0 || value.retainedCount > 10 || value.retainedCount > value.revision || value.records.length !== Math.min(2, value.retainedCount)
    || value.state !== (value.records.length === 2 ? 'compared' : value.records.length ? 'baseline' : 'empty')
    || value.canClear !== (value.retainedCount > 0) || value.records.length && value.records.at(-1).sequence !== value.revision) return false;
  return value.records.length === 2
    ? JSON.stringify(value.comparison) === JSON.stringify(comparePortfolioReviews(value.records[0].packet, value.records[1].packet))
    : value.comparison === null;
}
