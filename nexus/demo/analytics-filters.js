const MOSCOW_OFFSET = 3 * 60 * 60 * 1000;

export function calendarDate(value) {
  if (!value) return '';
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time + MOSCOW_OFFSET).toISOString().slice(0, 10) : '';
}

export function validDateRange(from, to) {
  const valid = value => /^\d{4}-\d{2}-\d{2}$/u.test(value || '')
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  return valid(from) && valid(to) && from <= to;
}

export function filterLedgerRows(rows, filters, { dateKey = 'occurredAt', display = row => row, accountLabel = row => row.portfolioLabel } = {}) {
  const query = String(filters.instrument || '').trim().toLocaleLowerCase('ru');
  return (Array.isArray(rows) ? rows : []).filter(row => {
    const date = calendarDate(row[dateKey]);
    if ((filters.from && (!date || date < filters.from)) || (filters.to && (!date || date > filters.to))) return false;
    if (filters.account && row.portfolioId !== filters.account) return false;
    if (filters.asset && row.assetType !== filters.asset) return false;
    const label = display(row);
    return !query || [label.name, label.ticker, row.instrumentUid, accountLabel(row)]
      .some(value => String(value || '').toLocaleLowerCase('ru').includes(query));
  });
}

// Keep currencies separate. Missing outcomes (notably futures VM) are never zero.
export function sumMoneyByCurrency(rows, valueKey, currencyKey = 'currency') {
  const sums = new Map();
  let known = 0;
  for (const row of rows || []) {
    if (row[valueKey] == null || !/^-?\d+$/u.test(String(row[valueKey]))) continue;
    const currency = String(row[currencyKey] || row.currency || 'RUB').toUpperCase().replace(/^RUR$/u, 'RUB');
    sums.set(currency, (sums.get(currency) || 0n) + BigInt(row[valueKey]));
    known++;
  }
  return { amounts: [...sums].map(([currency, nanos]) => ({ currency, nanos: nanos.toString() })), known, missing: (rows?.length || 0) - known };
}

export function summarizeOperationFees(rows) {
  rows = rows.filter(row => !row.state || row.state === 'OPERATION_STATE_EXECUTED');
  const currencyOf = row => String(row.currency || 'RUB').toUpperCase().replace(/^RUR$/u, 'RUB');
  const key = row => `${row.portfolioId || ''}:${currencyOf(row)}`;
  const separateBrokerDebits = new Set(rows.filter(row => row.type === 'OPERATION_TYPE_BROKER_FEE').map(key));
  const fees = rows.map(row => {
    // The API resolves parent/debit links across the full account ledger.
    // Keep that decision when this table shows only a filtered subset.
    if (Object.hasOwn(row, 'cashFeeNanos')) return {currency:currencyOf(row),amount:row.cashFeeNanos};
    const separate = /FEE$|COMMISSION|^OPERATION_TYPE_OVER_COM$|^OPERATION_TYPE_OUTPUT_PENALTY$/u.test(row.type || '');
    let amount = separate ? row.paymentNanos && BigInt(row.paymentNanos) !== 0n ? row.paymentNanos : row.commissionNanos
      : separateBrokerDebits.has(key(row)) ? '0' : row.commissionNanos;
    if (amount != null) { amount = BigInt(amount); amount = (amount < 0n ? -amount : amount).toString(); }
    return { currency: currencyOf(row), amount };
  });
  return sumMoneyByCurrency(fees, 'amount');
}

// Widths compare only compatible, known observations; zero stays zero.
export function relativeBarWidth(value, values) {
  if (value == null || !Number.isFinite(Number(value))) return 0;
  const max = values.reduce((maximum, item) => item != null && Number.isFinite(Number(item)) ? Math.max(maximum, Math.abs(Number(item))) : maximum, 0);
  return max ? Math.abs(Number(value)) / max * 100 : 0;
}

export function createFilterScheduler({ apply, delay = 180, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let timer = null, revision = 0;
  return {
    schedule(value) {
      clearTimer(timer);
      const current = ++revision;
      const snapshot = { ...value };
      timer = setTimer(() => { timer = null; if (current === revision) void apply(snapshot); }, delay);
    },
    cancel() { clearTimer(timer); timer = null; revision++; },
  };
}
