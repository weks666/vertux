// A bounded catalogue of predicates over saved provider values. These are not
// normalized peer valuations, historical financial queries or recommendations.
export const RESEARCH_QUERY_VERSION = 'research-saved-query-v1';
export const RESEARCH_QUERY_CATALOG = Object.freeze([
  ['revenueTtm', 'Выручка', 'TTM', 'currency'],
  ['netIncomeTtm', 'Чистая прибыль', 'TTM', 'currency'],
  ['freeCashFlowTtm', 'Свободный денежный поток', 'TTM', 'currency'],
  ['totalDebtMrq', 'Общий долг', 'MRQ', 'currency'],
  ['peRatioTtm', 'P/E поставщика', 'TTM', 'ratio'],
  ['priceToSalesTtm', 'P/S поставщика', 'TTM', 'ratio'],
].map(([key, label, period, unitKind]) => Object.freeze({key, label, period, unitKind})));
export const QUERY_UNITS = Object.freeze(['RUB', 'USD', 'EUR', 'CNY', 'GBP', 'HKD', 'JPY', 'CHF', 'ratio']);
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const decimal = value => typeof value === 'string' && value.length <= 80 && /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value);
const uid = value => typeof value === 'string' && /^[A-Za-z0-9._:@/-]{1,160}$/.test(value);
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\u0000-\u0008\u000b-\u001f\u007f]/u.test(value);
const stamp = value => value === null || typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
export function validateResearchQuery(value) {
  if (!exact(value, ['version', 'queryId', 'instrumentUids', 'metricKey', 'operator', 'threshold', 'unit'])
    || value.version !== RESEARCH_QUERY_VERSION || value.queryId !== 'saved-metric-filter'
    || !Array.isArray(value.instrumentUids) || value.instrumentUids.length < 1 || value.instrumentUids.length > 6
    || !value.instrumentUids.every(uid) || new Set(value.instrumentUids).size !== value.instrumentUids.length
    || !['gte', 'lte'].includes(value.operator) || !decimal(value.threshold)) throw new TypeError('Invalid research query');
  const metric = RESEARCH_QUERY_CATALOG.find(row => row.key === value.metricKey);
  if (!metric || !QUERY_UNITS.includes(value.unit) || (metric.unitKind === 'ratio') !== (value.unit === 'ratio')) throw new TypeError('Invalid research query unit');
  return {...value, instrumentUids: [...value.instrumentUids]};
}
export function compareResearchDecimals(a, b) {
  if (!decimal(a) || !decimal(b)) throw new TypeError('Invalid research decimal');
  const parts = value => { const [whole, fraction = ''] = value.replace(/^-/, '').split('.'); return {n: BigInt(whole + fraction) * (value.startsWith('-') ? -1n : 1n), scale: fraction.length}; };
  const x = parts(a), y = parts(b), left = x.n * 10n ** BigInt(y.scale), right = y.n * 10n ** BigInt(x.scale);
  return left < right ? -1 : left > right ? 1 : 0;
}
export const researchQueryCondition = query => {
  const metric = RESEARCH_QUERY_CATALOG.find(row => row.key === query.metricKey);
  return `${metric.label} (${metric.period}) ${query.operator === 'gte' ? '≥' : '≤'} ${query.threshold} ${query.unit === 'ratio' ? 'раз' : query.unit}`;
};

/** Reject a late/misbound response before it can replace the user's query.
 * Arithmetic binding does not certify source truth or grant data access. */
export function validateResearchQueryResponse(packet, expected, {result = false, previewId = null, revision = null} = {}) {
  const query = validateResearchQuery(expected), received = validateResearchQuery(packet?.query);
  const check = value => { if (!value) throw new TypeError('Invalid research response'); };
  for (const key of ['version', 'queryId', 'metricKey', 'operator', 'threshold', 'unit']) check(query[key] === received[key]);
  check(JSON.stringify(query.instrumentUids) === JSON.stringify(received.instrumentUids));
  check(packet.version === (result ? 'research-query-result-v1' : 'research-query-preview-v1') && packet.intent === 'research.saved-metric-screen'
    && packet.basis === 'latest-local-saved-per-instrument' && ['local', 'synthetic'].includes(packet.dataMode)
    && packet.condition === researchQueryCondition(query) && /^[a-f0-9-]{36}$/.test(packet.previewId || '') && /^[a-f0-9]{64}$/.test(packet.revision || '')
    && packet.expiresAt !== null && stamp(packet.expiresAt)
    && (!previewId || packet.previewId === previewId) && (!revision || packet.revision === revision)
    && Array.isArray(packet.rows) && packet.rows.length === query.instrumentUids.length
    && Array.isArray(packet.limitations) && packet.limitations.length > 0 && packet.limitations.length <= 16
    && packet.limitations.every(value => text(value, 1500)));
  const definition = RESEARCH_QUERY_CATALOG.find(row => row.key === query.metricKey);
  for (const [index, row] of packet.rows.entries()) {
    check(row.id === `instrument-${index + 1}` && row.instrument?.instrumentUid === query.instrumentUids[index] && row.instrument.assetType === 'share'
      && text(row.instrument.name, 200) && (row.instrument.ticker === null || text(row.instrument.ticker, 32)) && ['eligible', 'excluded'].includes(row.state)
      && ['fresh', 'stale', 'missing', 'synthetic'].includes(row.cacheState));
    check(['dataAsOf', 'receivedAt', 'metadataReceivedAt'].every(key => stamp(row[key])));
    check(Array.isArray(row.sources) && row.sources.length <= 64 && Array.isArray(row.limitations) && row.limitations.length <= 64 && row.limitations.every(value => text(value, 1500)));
    const ids = new Set();
    for (const source of row.sources) {
      const url = new URL(source.url);
      check(text(source.id, 128) && !ids.has(source.id) && text(source.url, 2048) && url.protocol === 'https:' && !url.username && !url.password && !url.hash
        && text(source.title, 300) && stamp(source.asOf) && stamp(source.retrievedAt)
        && [...url.searchParams.keys()].every(key => !/(?:^|_)(?:authorization|token|access_token|api_key|password|secret|cookie)(?:$|_)/iu.test(key)));
      ids.add(source.id);
    }
    let reason = null;
    if (row.fact === null) reason = 'missing-value';
    else {
      check(row.fact.key === query.metricKey && row.fact.status === 'available' && typeof row.fact.value === 'string' && row.fact.value.length <= 128
        && /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(row.fact.value) && text(row.fact.label, 300) && text(row.fact.unit, 128)
        && (row.fact.period === null || text(row.fact.period, 128))
        && Array.isArray(row.fact.sourceIds) && row.fact.sourceIds.length > 0 && row.fact.sourceIds.length <= 64
        && new Set(row.fact.sourceIds).size === row.fact.sourceIds.length && row.fact.sourceIds.every(id => ids.has(id)));
      if (row.fact.period !== definition.period) reason = 'different-period-basis';
      else if (row.fact.unit !== query.unit) reason = 'different-unit';
      else if (row.fact.value.length > 80) reason = 'value-precision-limit';
    }
    check(row.reason === reason && row.state === (reason ? 'excluded' : 'eligible'));
    if (result) {
      const compare = reason ? null : compareResearchDecimals(row.fact.value, query.threshold);
      check(row.result === (reason ? 'excluded' : (query.operator === 'gte' ? compare >= 0 : compare <= 0) ? 'matched' : 'not-matched'));
    }
  }
  const eligible = packet.rows.filter(row => row.state === 'eligible').length, excluded = packet.rows.length - eligible;
  check(packet.eligibleCount === eligible && packet.excludedCount === excluded
    && packet.dataMode === (packet.rows.every(row => row.cacheState === 'synthetic') ? 'synthetic' : 'local'));
  if (result) check(packet.state === (eligible ? excluded ? 'partial' : 'ready' : 'unavailable')
    && packet.matchedCount === (eligible ? packet.rows.filter(row => row.result === 'matched').length : null)
    && packet.notMatchedCount === (eligible ? packet.rows.filter(row => row.result === 'not-matched').length : null));
  return packet;
}
