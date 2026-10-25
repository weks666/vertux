export const COMPANY_COMPARISON_VERSION = 'saved-company-comparison-v1';
export const COMPANY_COMPARISON_LIMIT = 4;
export const COMPANY_COMPARISON_SOURCE = 'https://developer.tbank.ru/invest/api/instruments-service-get-asset-fundamentals';
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const keys = (value, names) => object(value) && Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));
const text = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/u.test(value);
const id = value => typeof value === 'string' && /^[A-Za-z0-9._:@/-]{1,160}$/u.test(value);
const nullable = (value, check) => value === null || check(value);
const at = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const currency = value => typeof value === 'string' && /^[A-Z]{3}$/u.test(value);
const instrument = value => keys(value, ['instrumentUid', 'assetUid', 'assetType', 'ticker', 'name', 'currency'])
  && id(value.instrumentUid) && nullable(value.assetUid, id) && ['share', 'stock', 'INSTRUMENT_TYPE_SHARE'].includes(value.assetType)
  && nullable(value.ticker, v => text(v, 64)) && nullable(value.name, v => text(v, 256)) && nullable(value.currency, currency);
const metric = value => keys(value, ['value', 'unit', 'period', 'status', 'calculationVersion'])
  && text(value.unit, 32) && text(value.period, 80) && nullable(value.calculationVersion, v => text(v, 80))
  && ['available', 'missing', 'not_applicable'].includes(value.status)
  && (value.status === 'available' ? typeof value.value === 'string' && value.value.length <= 100 && /^-?\d+(?:\.\d+)?$/u.test(value.value) : value.value === null);

// These flags describe supplied metadata. Matching flags never prove matched
// per-metric dates, accounting standards, business models or issuer peers.
export function comparisonBasis(columns, cells) {
  const issues = [];
  if (cells.some(row => !row || row.status !== 'available')) issues.push('missing_values');
  const values = cells.filter(Boolean);
  if (values.some(row => ['provider_value', 'unknown_currency'].includes(row.unit))) issues.push('unknown_units');
  if (new Set(values.map(row => row.unit)).size > 1) issues.push('different_units');
  if (values.some(row => row.period === 'provider_unspecified')) issues.push('unknown_periods');
  if (new Set(values.map(row => row.period)).size > 1) issues.push('different_periods');
  if (new Set(values.map(row => row.calculationVersion)).size > 1) issues.push('different_methods');
  if (columns.some(row => !row.summary?.fiscalPeriod.from || !row.summary?.fiscalPeriod.to)) issues.push('missing_fiscal_dates');
  if (new Set(columns.filter(row => row.summary).map(row => JSON.stringify(row.summary.fiscalPeriod))).size > 1) issues.push('different_fiscal_dates');
  return issues;
}

export function validCompanyComparison(data, selection) {
  try {
    if (!Array.isArray(selection) || selection.length < 1 || selection.length > 4 || new Set(selection).size !== selection.length
      || !keys(data, ['contractVersion', 'intent', 'readMode', 'llmUsed', 'readAt', 'selectionMode', 'publicationTimeKnown', 'metricDatesKnown', 'rankingCalculated', 'candidates', 'candidatesLimited', 'columns', 'fields'])
      || data.contractVersion !== COMPANY_COMPARISON_VERSION || data.intent !== 'company.compare-saved' || data.readMode !== 'saved-only' || data.llmUsed !== false
      || data.selectionMode !== 'manual' || data.publicationTimeKnown !== false || data.metricDatesKnown !== false || data.rankingCalculated !== false || !at(data.readAt)
      || !Array.isArray(data.candidates) || data.candidates.length > 200 || !data.candidates.every(instrument) || typeof data.candidatesLimited !== 'boolean'
      || new Set(data.candidates.map(row => row.instrumentUid)).size !== data.candidates.length
      || !Array.isArray(data.columns) || data.columns.length !== selection.length || !Array.isArray(data.fields) || data.fields.length > 31) return false;
    const issuers = [];
    for (const [index, column] of data.columns.entries()) {
      if (!keys(column, ['instrument', 'state', 'summary']) || !instrument(column.instrument) || column.instrument.instrumentUid !== selection[index]
        || !['saved', 'empty', 'mapping-required'].includes(column.state)) return false;
      if (column.instrument.assetUid) issuers.push(column.instrument.assetUid);
      if (column.state !== 'saved') {
        if (column.summary !== null || (column.state === 'mapping-required') !== (column.instrument.assetUid === null)) return false;
        continue;
      }
      const s = column.summary;
      if (!column.instrument.assetUid || !keys(s, ['revision', 'receivedAt', 'sourceDigest', 'reportedCurrency', 'fiscalPeriod', 'source'])
        || !Number.isInteger(s.revision) || s.revision < 1 || s.revision > 128 || !at(s.receivedAt) || s.receivedAt > data.readAt
        || typeof s.sourceDigest !== 'string' || !/^[a-f0-9]{64}$/u.test(s.sourceDigest) || !nullable(s.reportedCurrency, currency)
        || !keys(s.fiscalPeriod, ['from', 'to']) || ![s.fiscalPeriod.from, s.fiscalPeriod.to].every(value => value === null || at(value) && value <= s.receivedAt)
        || s.fiscalPeriod.from && s.fiscalPeriod.to && s.fiscalPeriod.from > s.fiscalPeriod.to
        || !keys(s.source, ['id', 'title', 'url', 'asOf']) || s.source.id !== 'tinvest-fundamentals' || !text(s.source.title, 256)
        || s.source.url !== COMPANY_COMPARISON_SOURCE || !nullable(s.source.asOf, at) || s.source.asOf && s.source.asOf > s.receivedAt) return false;
    }
    if (new Set(issuers).size !== issuers.length) return false;
    if (new Set(data.fields.map(row => row.key)).size !== data.fields.length) return false;
    return data.fields.every(row => keys(row, ['key', 'label', 'cells', 'basisIssues']) && text(row.key, 80) && text(row.label, 256)
      && Array.isArray(row.cells) && row.cells.length === selection.length && row.cells.every((value, index) => nullable(value, metric) && (data.columns[index].state === 'saved' || value === null))
      && JSON.stringify(row.basisIssues) === JSON.stringify(comparisonBasis(data.columns, row.cells)));
  } catch { return false; }
}
