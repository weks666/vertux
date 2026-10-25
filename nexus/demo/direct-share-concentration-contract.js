export const CONCENTRATION_VERSION = 'direct-share-concentration-v1';
export const CONCENTRATION_FX_VERSION = 'direct-share-concentration-v2';
export const CONCENTRATION_FX_POLICY = Object.freeze({ method: 'saved-official-fx', timeBasis: 'effective-date-moscow', knowledgeTimeVerified: false, maxLookbackDays: 40 });
const integer = value => typeof value === 'string' && /^(?:0|-?[1-9]\d{0,119})$/u.test(value);
const text = value => value === null || typeof value === 'string' && value.length > 0 && value.length <= 200 && !/[\u0000-\u001f]/u.test(value);
const iso = value => value === null || typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const closed = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join('|') === keys.split(' ').sort().join('|');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const abs = value => value < 0n ? -value : value;
const ratio = (numerator, denominator) => denominator ? { numerator: numerator.toString(), denominator: denominator.toString() } : null;
export const CONCENTRATION_REASONS = Object.freeze({
  unsupported_asset: 'Этот тип инструмента не входит в расчёт прямых позиций в акциях.',
  ambiguous_position: 'Единственная сохранённая строка этой позиции не подтверждена.',
  unknown_quantity: 'Количество единиц инструмента не подтверждено.',
  unknown_price: 'Положительная цена за одну акцию не подтверждена.',
  unsupported_currency: 'Цена не в RUB; пересчёт валют не выполняется.',
  projection_mismatch: 'Количество, цена или тип сохранённой позиции расходятся с источником.',
  unmatched_projection: 'Есть сохранённые позиции без соответствующей строки исходного снимка.',
  source_scan_limit: 'Объём сохранённых данных превышает предел расчёта.',
  select_single_account: 'Выберите один счёт для расчёта по его сохранённому составу.',
  unverified_snapshot: 'Исходный снимок выбранного счёта не подтверждён.',
});

// q in nano-shares times p in nano-RUB is exact in 10^-18 RUB.
export function concentrationDecimal(value, scale = 18) {
  const n = BigInt(value), digits = abs(n).toString().padStart(scale + 1, '0');
  const fraction = digits.slice(-scale).replace(/0+$/u, '');
  return (n < 0n ? '-' : '') + digits.slice(0, -scale) + (fraction ? '.' + fraction : '');
}

/** Closed, exact arithmetic shared by the source builder and public validator.
 * Weights refer only to the absolute values of included direct positions. */
export function calculateDirectShareConcentration(rows, version = CONCENTRATION_VERSION) {
  const scale = concentrationScale(version);
  const included = rows.filter(row => row.state === 'included');
  const values = included.map(row => ({ key: row.key, value: concentrationValue(row, scale) }));
  const long = values.reduce((sum, row) => sum + (row.value > 0n ? row.value : 0n), 0n);
  const short = values.reduce((sum, row) => sum + (row.value < 0n ? -row.value : 0n), 0n);
  const gross = long + short;
  const ranked = [...values].sort((a, b) => abs(a.value) === abs(b.value) ? Number(a.key.slice(9)) - Number(b.key.slice(9)) : abs(a.value) > abs(b.value) ? -1 : 1);
  return {
    state: !included.length ? 'unavailable' : gross === 0n ? 'zero-gross' : 'partial',
    totals: included.length ? { long: concentrationDecimal(long, scale), short: concentrationDecimal(short, scale), gross: concentrationDecimal(gross, scale), net: concentrationDecimal(long - short, scale) } : null,
    positions: values.map(row => ({ key: row.key, value: concentrationDecimal(row.value, scale), direction: row.value < 0n ? 'short' : row.value > 0n ? 'long' : 'zero', weight: ratio(abs(row.value), gross) })),
    rankedKeys: ranked.map(row => row.key),
    largestWeight: ratio(ranked.length ? abs(ranked[0].value) : 0n, gross),
    top3Weight: ratio(ranked.slice(0, 3).reduce((sum, row) => sum + abs(row.value), 0n), gross),
    hhi: ratio(values.reduce((sum, row) => sum + row.value * row.value, 0n), gross * gross),
  };
}

export function validateDirectShareConcentration(dto) {
  if (dto?.contractVersion === CONCENTRATION_FX_VERSION) return validateFxConcentration(dto);
  try {
    if (!closed(dto, 'contractVersion currency scope period evidence coverage rows calculation calculationSnapshotId')
      || dto.contractVersion !== CONCENTRATION_VERSION || dto.currency !== 'RUB' || !/^[a-f0-9]{64}$/u.test(dto.calculationSnapshotId)
      || !closed(dto.scope, 'kind portfolioIds') || !['single-account', 'multi-account'].includes(dto.scope.kind)
      || !Array.isArray(dto.scope.portfolioIds) || dto.scope.portfolioIds.length !== (dto.scope.kind === 'single-account' ? 1 : 0)
      || dto.scope.portfolioIds.some(value => typeof value !== 'string' || !/^portfolio-[1-9]\d{0,5}$/u.test(value))
      || !closed(dto.period, 'requestedFrom requestedTo observedAt') || Object.values(dto.period).some(value => !iso(value))
      || dto.period.requestedFrom && dto.period.requestedTo && dto.period.requestedFrom > dto.period.requestedTo
      || dto.period.observedAt && (!dto.period.requestedTo || dto.period.observedAt > dto.period.requestedTo)
      || !closed(dto.evidence, 'dataMode timeBasis priceTimeVerified sourceVerified') || !['synthetic', 'local-saved'].includes(dto.evidence.dataMode)
      || !['unknown', 'client-observed'].includes(dto.evidence.timeBasis) || dto.evidence.priceTimeVerified !== false || typeof dto.evidence.sourceVerified !== 'boolean'
      || !closed(dto.coverage, 'complete positionsObserved includedRows excludedRows virtualPositions blockers') || dto.coverage.complete !== false
      || !['unknown', 'present-excluded', 'explicit-zero'].includes(dto.coverage.virtualPositions)
      || !Array.isArray(dto.coverage.blockers) || dto.coverage.blockers.length > 20 || dto.coverage.blockers.some(code => !Object.hasOwn(CONCENTRATION_REASONS, code))
      || !Array.isArray(dto.rows) || dto.rows.length > 500) return false;
    const keys = new Set(), uids = new Set();
    for (const row of dto.rows) {
      if (!closed(row, 'key instrumentUid ticker state quantityNanos priceNanos reason') || !/^position-[1-9]\d{0,2}$/u.test(row.key)
        || keys.has(row.key) || !text(row.instrumentUid) || !text(row.ticker) || !['included', 'excluded'].includes(row.state)) return false;
      keys.add(row.key);
      if (row.state === 'included') {
        if (!row.instrumentUid || uids.has(row.instrumentUid) || !integer(row.quantityNanos) || !integer(row.priceNanos) || BigInt(row.priceNanos) <= 0n || row.reason !== null) return false;
        uids.add(row.instrumentUid);
      } else if (row.quantityNanos !== null || row.priceNanos !== null || !Object.hasOwn(CONCENTRATION_REASONS, row.reason)) return false;
    }
    const included = dto.rows.filter(row => row.state === 'included').length;
    if (dto.coverage.includedRows !== included || dto.coverage.positionsObserved !== (dto.evidence.sourceVerified ? dto.rows.length : null)
      || dto.coverage.excludedRows !== (dto.evidence.sourceVerified ? dto.rows.length - included : null)) return false;
    if (dto.evidence.sourceVerified) {
      if (dto.scope.kind !== 'single-account' || dto.evidence.timeBasis !== 'client-observed' || !dto.period.observedAt) return false;
    } else if (dto.rows.length || dto.period.observedAt !== null || dto.evidence.timeBasis !== 'unknown' || dto.coverage.virtualPositions !== 'unknown') return false;
    return same(dto.calculation, calculateDirectShareConcentration(dto.rows));
  } catch { return false; }
}

export const CONCENTRATION_FX_REASONS = Object.freeze({ ...CONCENTRATION_REASONS,
  unsupported_currency: 'В расчёте поддержаны цены в RUB, USD и EUR; для этой валюты пересчёт недоступен.',
  fx_unavailable: 'Сохранённый курс ЦБ на дату наблюдения не подтверждён в пределах 40 дней.',
});
export const concentrationScale = version => version === CONCENTRATION_FX_VERSION ? 27 : 18;
export const concentrationValue = (row, scale = 18) => BigInt(row.quantityNanos) * BigInt(row.priceNanos)
  * (scale === 27 ? BigInt(row.conversion?.rateNanos ?? '1000000000') : 1n);
export const concentrationPriceCurrency = row => row.priceCurrency ?? 'RUB';
export function validConcentrationConversion(conversion, currency, observedAt) {
  if (!closed(conversion, 'source rateNanos date') || !['RUB', 'USD', 'EUR'].includes(currency)) return false;
  if (currency === 'RUB') return conversion.source === 'identity' && conversion.rateNanos === '1000000000' && conversion.date === null;
  if (conversion.source !== 'cbr-saved' || typeof conversion.rateNanos !== 'string' || typeof conversion.date !== 'string' || !/^[1-9]\d{0,15}$/u.test(conversion.rateNanos) || BigInt(conversion.rateNanos) > 1000000000000000n
    || !/^\d{4}-\d\d-\d\d$/u.test(conversion.date) || !observedAt || !iso(observedAt)) return false;
  const effective = Date.parse(conversion.date + 'T00:00:00.000Z');
  if (!Number.isFinite(effective) || new Date(effective).toISOString().slice(0, 10) !== conversion.date) return false;
  const observedDate = new Date(Date.parse(observedAt) + 3 * 3600000).toISOString().slice(0, 10);
  const age = Date.parse(observedDate + 'T00:00:00.000Z') - effective;
  return age >= 0 && age <= CONCENTRATION_FX_POLICY.maxLookbackDays * 86400000;
}
function validateFxConcentration(dto) {
  try {
    if (!closed(dto, 'contractVersion currency scope period evidence coverage rows calculation calculationSnapshotId valuation')
      || !same(dto.valuation, CONCENTRATION_FX_POLICY) || !Array.isArray(dto.rows) || dto.rows.length > 500
      || !Array.isArray(dto.coverage?.blockers) || dto.coverage.blockers.some(code => !Object.hasOwn(CONCENTRATION_FX_REASONS, code))) return false;
    const legacyRows = [];
    for (const row of dto.rows) {
      if (!closed(row, 'key instrumentUid ticker state quantityNanos priceNanos reason priceCurrency conversion')) return false;
      if (row.state === 'included') { if (!validConcentrationConversion(row.conversion, row.priceCurrency, dto.period?.observedAt)) return false; }
      else if (row.priceCurrency !== null || row.conversion !== null || !Object.hasOwn(CONCENTRATION_FX_REASONS, row.reason)) return false;
      const { priceCurrency, conversion, ...legacy } = row;
      legacyRows.push({ ...legacy, reason: legacy.reason === 'fx_unavailable' ? 'unknown_price' : legacy.reason });
    }
    const { valuation, ...legacy } = dto;
    legacy.contractVersion = CONCENTRATION_VERSION; legacy.rows = legacyRows;
    legacy.coverage = { ...dto.coverage, blockers: dto.coverage.blockers.map(code => code === 'fx_unavailable' ? 'unknown_price' : code) };
    legacy.calculation = calculateDirectShareConcentration(legacyRows);
    return validateDirectShareConcentration(legacy) && same(dto.calculation, calculateDirectShareConcentration(dto.rows, CONCENTRATION_FX_VERSION));
  } catch { return false; }
}
