import { validExecutionQuantity } from './execution-quantity-contract.js';
export const REPORT_PAYMENT_VERSION = 'broker-report-payment-comparison-v2';
export const REPORT_PAYMENT_LEGACY_VERSION = 'broker-report-payment-comparison-v1';
export const REPORT_PAYMENT_REASONS = Object.freeze({
  incomplete_executions: 'Для всей операции не подтверждён полный набор исполнений и соответствующих строк отчёта.',
  execution_details_unavailable: 'Не удалось проверить сохранённые сведения об исполнении.',
  conflicting_execution_details: 'Сведения об исполненной или оставшейся части противоречат сохранённым сделкам.',
  partial_execution_details_missing: 'Для частичного исполнения нужны полные сведения брокера о количестве, исполненной части и остатке.',
  unknown_payment: 'Не подтверждены сумма, валюта или знак платежа операции.',
  unknown_report_amount: 'Суммы без НКД в отчёте отсутствуют или имеют неподдержанный знак.',
  currency_mismatch: 'Валюты цены, сумм отчёта и платежа операции различаются. Пересчёт не выполняется.',
});
export function validReportPayment(value) {
  if (!value || ![REPORT_PAYMENT_VERSION, REPORT_PAYMENT_LEGACY_VERSION].includes(value.version) || value.scope !== 'whole-source-operation'
    || !['observed', 'different', 'unavailable'].includes(value.state)) return false;
  const keys = Object.keys(value).sort().join();
  if (value.state === 'unavailable') return keys === 'reason,scope,state,version' && Object.hasOwn(REPORT_PAYMENT_REASONS, value.reason);
  const legacy = value.version === REPORT_PAYMENT_LEGACY_VERSION;
  return keys === (legacy ? 'currency,operationPaymentNanos,reportAmountNanos,reportRowCount,scope,signedDifferenceNanos,state,version'
    : 'currency,execution,operationPaymentNanos,reportAmountNanos,reportRowCount,scope,signedDifferenceNanos,state,version')
    && (legacy || validExecutionQuantity(value.execution))
    && /^[A-Z]{3}$/.test(value.currency || '') && Number.isInteger(value.reportRowCount) && value.reportRowCount >= 1 && value.reportRowCount <= 1000
    && ['operationPaymentNanos', 'reportAmountNanos', 'signedDifferenceNanos'].every(key => typeof value[key] === 'string' && /^(?:0|-?[1-9]\d{0,31})$/.test(value[key]))
    && (value.state === 'observed' ? value.signedDifferenceNanos === '0' : value.signedDifferenceNanos !== '0');
}
