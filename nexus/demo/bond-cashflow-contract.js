export const BOND_CASHFLOW_VERSION = 'bond-cashflow-v1';
export const BOND_CASHFLOW_LIMITS = Object.freeze({ accounts: 32, positionsPerAccount: 500, bondPositions: 128, records: 2000, sourceBytes: 8 * 1024 * 1024, totalSourceBytes: 16 * 1024 * 1024, lifecycleYears: 40 });
export const BOND_CASHFLOW_REASONS = Object.freeze({
  source_unavailable: 'Сохранённый состав счёта не удалось подтвердить.',
  source_scan_limit: 'Слишком много исходных строк для этой проверки.',
  snapshot_mismatch: 'Дата или привязка сохранённого состава не подтверждена.',
  ambiguous_position: 'Несколько исходных строк с одним идентификатором выпуска.',
  projection_mismatch: 'Количество в сохранённой позиции расходится с источником.',
  unknown_quantity: 'Количество бумаг или его единица не подтверждены. Нужно обычное обновление портфеля.',
  short_position: 'Короткая позиция: обязательства по выплатам здесь не рассчитываются.',
  invalid_schedule: 'Сохранённый график не прошёл проверку.',
  missing_amount: 'Источник пока не указал сумму выплаты.',
  missing_payment_date: 'Источник указал событие, но не дату выплаты.',
  conditional_event: 'Оферта или конвертация требует отдельных условий участия.',
  reported_execution: 'Источник указал фактическую дату исполнения; это не ожидаемая выплата.',
  reported_default: 'Источник указал дату дефолта; ожидаемая выплата не рассчитана.',
  catalog_date_only: 'Из каталога известна только дата погашения.',
  limit_exceeded: 'График превышает предел безопасной проверки. Частичный итог не подставлен.',
});
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
export const cashflowIso = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
export const cashflowDay = v => typeof v === 'string' && /^20\d{2}-\d{2}-\d{2}$/u.test(v) && cashflowIso(v + 'T00:00:00.000Z');
const digits = v => typeof v === 'string' && /^-?(0|[1-9]\d{0,65})$/u.test(v);
const money = v => digits(v) && BigInt(v) >= 0n;
const currency = v => typeof v === 'string' && /^[A-Z]{3}$/u.test(v);
const uid = v => typeof v === 'string' && /^[A-Za-z0-9._:@/-]{1,160}$/u.test(v);
const account = v => typeof v === 'string' && /^portfolio-[1-9]\d{0,2}$/u.test(v);
const text = (v, max = 240) => typeof v === 'string' && v.length <= max;
const count = v => Number.isSafeInteger(v) && v >= 0;
const reason = v => v === null || Object.hasOwn(BOND_CASHFLOW_REASONS, v);
export function cashflowWindow(now) {
  const at = typeof now === 'string' ? now : now?.toISOString?.();
  if (!cashflowIso(at) || !cashflowDay(at.slice(0, 10))) throw new TypeError('Invalid cashflow clock');
  const date = new Date(at), year = date.getUTCFullYear(), month = date.getUTCMonth();
  const months = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(year, month + i, 1)).toISOString().slice(0, 7));
  return { from: at.slice(0, 10), to: new Date(Date.UTC(year, month + 12, 0)).toISOString().slice(0, 10), months };
}
export function cashflowDecimal(value, scale = 18) {
  if (!digits(value) || !Number.isInteger(scale) || scale < 0 || scale > 18) return null;
  const number = BigInt(value), negative = number < 0n, padded = (negative ? -number : number).toString().padStart(scale + 1, '0');
  if (!scale) return (negative ? '-' : '') + padded;
  const fractional = padded.slice(-scale).replace(/0+$/u, '');
  return (negative ? '-' : '') + padded.slice(0, -scale) + (fractional ? '.' + fractional : '');
}
export function cashflowTotals(records) {
  const groups = new Map();
  for (const row of records) {
    if (row.state !== 'included') continue;
    const group = groups.get(row.currency) || { currency: row.currency, couponNumerator: 0n, redemptionNumerator: 0n, totalNumerator: 0n, events: 0 };
    group[row.kind === 'coupon' ? 'couponNumerator' : 'redemptionNumerator'] += BigInt(row.amountNumerator);
    group.totalNumerator += BigInt(row.amountNumerator); group.events++; groups.set(row.currency, group);
  }
  return [...groups.values()].sort((a, b) => a.currency.localeCompare(b.currency)).map(group => ({ ...group,
    couponNumerator: group.couponNumerator.toString(), redemptionNumerator: group.redemptionNumerator.toString(), totalNumerator: group.totalNumerator.toString() }));
}
export function cashflowMonths(records, months) {
  return months.map(month => {
    const rows = records.filter(row => (row.paymentDate || row.eventDate).slice(0, 7) === month);
    return { month, totals: cashflowTotals(rows), excludedRecords: rows.filter(row => row.state === 'excluded').length, recordKeys: rows.map(row => row.key) };
  });
}
export function validBondCashflows(dto, { contextKey, selection } = {}) {
  try {
    if (!object(dto) || dto.contractVersion !== BOND_CASHFLOW_VERSION || !/^[a-f0-9]{64}$/u.test(dto.contextKey)
      || contextKey && contextKey !== dto.contextKey || selection && selection !== dto.selection
      || !(dto.selection === 'all' || account(dto.selection)) || !cashflowIso(dto.generatedAt)
      || !['saved', 'synthetic'].includes(dto.dataMode) || !['available', 'unavailable'].includes(dto.state) || !reason(dto.reasonCode)
      || JSON.stringify(dto.window) !== JSON.stringify(cashflowWindow(dto.generatedAt))
      || !Array.isArray(dto.accounts) || dto.accounts.length > BOND_CASHFLOW_LIMITS.accounts
      || !Array.isArray(dto.positions) || dto.positions.length > BOND_CASHFLOW_LIMITS.bondPositions
      || !Array.isArray(dto.records) || dto.records.length > BOND_CASHFLOW_LIMITS.records) return false;
    const accounts = new Map(), positions = new Map(), keys = new Set();
    for (const row of dto.accounts) {
      if (!object(row) || !account(row.portfolioId) || accounts.has(row.portfolioId) || !['ready', 'unavailable'].includes(row.state)
        || !reason(row.reasonCode) || typeof row.stale !== 'boolean' || !(row.observedAt === null || cashflowIso(row.observedAt))
        || !(row.positions === null || count(row.positions)) || dto.selection !== 'all' && dto.selection !== row.portfolioId
        || row.state === 'ready' && (!cashflowIso(row.observedAt) || row.reasonCode !== null || row.positions === null)
        || row.state === 'unavailable' && (row.reasonCode === null || row.positions !== null)) return false;
      accounts.set(row.portfolioId, row);
    }
    for (const row of dto.positions) {
      if (!object(row) || !accounts.has(row.portfolioId) || !uid(row.instrumentUid) || !text(row.key, 190) || positions.has(row.key)
        || !text(row.name) || !text(row.ticker, 40) || !['included', 'excluded'].includes(row.state) || !reason(row.reasonCode)
        || !(row.quantityNanos === null || digits(row.quantityNanos)) || !cashflowIso(row.observedAt)
        || !Array.isArray(row.sources) || row.sources.length > BOND_CASHFLOW_LIMITS.lifecycleYears + 4
        || row.state === 'included' && (row.reasonCode !== null || !digits(row.quantityNanos) || BigInt(row.quantityNanos) <= 0n)
        || row.state === 'excluded' && row.reasonCode === null) return false;
      for (const source of row.sources) if (!object(source) || !['coupons', 'redemptions'].includes(source.kind)
        || !Number.isInteger(source.year) || source.year < 2000 || source.year > 2099 || !['ready', 'missing', 'invalid'].includes(source.state)
        || typeof source.stale !== 'boolean' || !(source.capturedAt === null || cashflowIso(source.capturedAt))
        || !(source.events === null || count(source.events)) || source.state === 'ready' && (!cashflowIso(source.capturedAt) || source.events === null)) return false;
      positions.set(row.key, row);
    }
    for (const row of dto.records) {
      const position = positions.get(row.positionKey);
      if (!object(row) || !position || position.state !== 'included' || !text(row.key, 300) || keys.has(row.key)
        || !['coupon', 'redemption', 'offer', 'conversion', 'maturity-date'].includes(row.kind) || !text(row.title)
        || !cashflowDay(row.eventDate) || !(row.paymentDate === null || cashflowDay(row.paymentDate))
        || !['included', 'excluded'].includes(row.state) || !reason(row.reasonCode)
        || !(row.amountNanos === null || money(row.amountNanos)) || !(row.currency === null || currency(row.currency))
        || !cashflowIso(row.capturedAt) || typeof row.stale !== 'boolean' || !text(row.couponType, 80)
        || !text(row.sourceExecution, 160) || !text(row.operationType, 64)
        || !['recordDate', 'rateDate', 'executionDate', 'defaultDate'].every(k => row[k] === null || cashflowIso(row[k]))) return false;
      const date = row.paymentDate || row.eventDate;
      if (date < dto.window.from || date > dto.window.to) return false;
      if (row.state === 'included') {
        if (!['coupon', 'redemption'].includes(row.kind) || row.paymentDate === null || row.amountNanos === null || row.currency === null
          || !money(row.amountNumerator) || row.reasonCode !== null || row.executionDate !== null || row.defaultDate !== null
          || BigInt(row.amountNumerator) !== BigInt(position.quantityNanos) * BigInt(row.amountNanos)) return false;
      } else if (row.amountNumerator !== null || row.reasonCode === null) return false;
      keys.add(row.key);
    }
    if (JSON.stringify(dto.totals) !== JSON.stringify(cashflowTotals(dto.records))
      || JSON.stringify(dto.months) !== JSON.stringify(cashflowMonths(dto.records, dto.window.months))) return false;
    if (dto.state === 'unavailable' && (dto.positions.length || dto.records.length || dto.totals.length || dto.reasonCode === null)) return false;
    if (dto.state === 'available' && (!dto.accounts.some(a => a.state === 'ready') || dto.reasonCode !== null)) return false;
    return true;
  } catch { return false; }
}
