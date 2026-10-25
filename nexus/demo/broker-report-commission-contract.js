import { validExecutionQuantity } from './execution-quantity-contract.js';
import { REPORT_PAYMENT_REASONS } from './broker-report-payment-contract.js';

export const REPORT_COMMISSION_VERSION = 'broker-report-commission-comparison-v1';
export const REPORT_COMMISSION_REASONS = Object.freeze({
  ...REPORT_PAYMENT_REASONS,
  unknown_description: 'В описании операции не указана комиссия с известной валютой.',
  unknown_report_commissions: 'Для суммы отчёта нужны все три комиссии в каждой сопоставленной строке: брокерская, биржевая и клиринговая. Не подтверждены их суммы, валюты или неотрицательный знак.',
  missing_postings: 'В сохранённой истории не найдено отдельного связанного списания комиссии. Это не означает нулевую комиссию.',
  ambiguous_postings: 'Связь отдельных списаний с этой операцией неоднозначна.',
  unverified_postings: 'Не удалось проверить текущие исходные записи связанных списаний.',
  unsupported_postings: 'У связанного списания не подтверждены исполненное состояние, дата, валюта или неположительный платёж. Возвраты здесь не сравниваются.',
});
const keys = (value, expected) => value && !Array.isArray(value) && Object.keys(value).sort().join() === expected.split(',').sort().join();
const integer = value => typeof value === 'string' && /^(?:0|-?[1-9]\d{0,31})$/.test(value);
const currency = value => typeof value === 'string' && /^[A-Z]{3}$/.test(value);
const stamp = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const missing = value => keys(value, 'state,reason') && value.state === 'unavailable' && Object.hasOwn(REPORT_COMMISSION_REASONS, value.reason);
const amounts = (values, sign) => Array.isArray(values) && values.length > 0 && values.length <= 3000
  && values.every(value => keys(value, 'currency,nanos') && currency(value.currency) && integer(value.nanos) && sign * BigInt(value.nanos) >= 0n)
  && values.every((value, index) => index === 0 || values[index - 1].currency < value.currency);
const absolute = value => value < 0n ? -value : value;

// Absence of a currency is unknown, never a synthetic zero or an FX conversion.
export function commissionDifferences({ report, description, postings }) {
  const a = new Map(report.state === 'known' ? report.totals.map(value => [value.currency, BigInt(value.nanos)]) : []);
  const b = new Map(description.state === 'known' ? [[description.amount.currency, absolute(BigInt(description.amount.nanos))]] : []);
  const c = new Map(postings.state === 'known' ? postings.totals.map(value => [value.currency, -BigInt(value.nanos)]) : []);
  const subtract = (left, right, unit) => left.has(unit) && right.has(unit) ? (left.get(unit) - right.get(unit)).toString() : null;
  return [...new Set([...a.keys(), ...b.keys(), ...c.keys()])].sort().map(unit => ({ currency: unit,
    reportMinusDescriptionNanos: subtract(a, b, unit), reportMinusPostingsNanos: subtract(a, c, unit),
    descriptionMinusPostingsNanos: subtract(b, c, unit) }));
}
export function commissionState(differences) {
  const values = differences.flatMap(row => [row.reportMinusDescriptionNanos, row.reportMinusPostingsNanos, row.descriptionMinusPostingsNanos]);
  return values.some(value => value !== null && value !== '0') ? 'different'
    : values.length && values.every(value => value === '0') ? 'observed' : 'incomplete';
}
export function validReportCommission(value) {
  try {
    if (!value || value.version !== REPORT_COMMISSION_VERSION || value.scope !== 'whole-source-operation') return false;
    if (value.state === 'unavailable') return keys(value, 'version,scope,state,reason') && Object.hasOwn(REPORT_COMMISSION_REASONS, value.reason);
    if (!keys(value, 'version,scope,state,reportRowCount,execution,report,description,postings,differences')
      || !['observed', 'different', 'incomplete'].includes(value.state) || !validExecutionQuantity(value.execution)
      || !Number.isInteger(value.reportRowCount) || value.reportRowCount < 1 || value.reportRowCount > 1000) return false;
    const { report, description, postings } = value;
    if (!missing(report)) {
      if (!keys(report, 'state,components,totals') || report.state !== 'known' || !amounts(report.totals, 1n)
        || !Array.isArray(report.components) || report.components.length !== 3) return false;
      const sums = new Map();
      for (const [index, kind] of ['broker', 'exchange', 'clearing'].entries()) {
        const component = report.components[index];
        if (!keys(component, 'kind,amounts') || component.kind !== kind || !amounts(component.amounts, 1n)) return false;
        for (const amount of component.amounts) sums.set(amount.currency, (sums.get(amount.currency) || 0n) + BigInt(amount.nanos));
      }
      if (JSON.stringify(report.totals) !== JSON.stringify([...sums].sort(([a], [b]) => a.localeCompare(b)).map(([unit, amount]) => ({ currency: unit, nanos: String(amount) })))) return false;
    }
    if (!missing(description) && (!keys(description, 'state,amount,at') || description.state !== 'known' || !stamp(description.at)
      || !keys(description.amount, 'currency,nanos') || !currency(description.amount.currency) || !integer(description.amount.nanos))) return false;
    if (!missing(postings) && (!keys(postings, 'state,count,totals,firstAt,lastAt') || postings.state !== 'known'
      || !Number.isInteger(postings.count) || postings.count < 1 || postings.count > 1000 || !amounts(postings.totals, -1n)
      || !stamp(postings.firstAt) || !stamp(postings.lastAt) || postings.firstAt > postings.lastAt)) return false;
    const expected = commissionDifferences(value);
    return Array.isArray(value.differences) && value.differences.length === expected.length
      && value.differences.every((row, index) => keys(row, 'currency,reportMinusDescriptionNanos,reportMinusPostingsNanos,descriptionMinusPostingsNanos')
        && Object.keys(expected[index]).every(key => row[key] === expected[index][key])) && commissionState(expected) === value.state;
  } catch { return false; }
}
