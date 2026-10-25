export const REPORT_TIMING_VERSION = 'broker-report-date-comparison-v1';
export const REPORT_TIMING_REASONS = Object.freeze({
  unmatched_execution: 'Не все строки однозначно связаны с сохранёнными исполнениями.',
  unsupported_execution: 'Формат или вид исполнения одной из строк пока не поддержан.',
  incomplete_executions: 'Не подтверждён полный набор исполнений хотя бы одной операции.',
  unknown_operation_date: 'Дата исходной операции неизвестна.',
  unknown_settlement_date: 'В отчёте не указана дата расчётов.',
  settlement_before_trade: 'Дата расчётов предшествует дню сделки в отчёте.',
  unknown_report_amount: 'Сумма без НКД отсутствует или имеет неподдержанный знак.',
  currency_mismatch: 'Валюты цены и суммы строки отчёта различаются.',
  source_unavailable: 'Текущие исходные операции не удалось проверить.',
  source_limit: 'Объём данных превышает предел сравнения.',
  invalid_period: 'Границы периода не подтверждены.',
});
const keys = (value, list) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join() === list.split(',').sort().join();
const count = value => Number.isInteger(value) && value >= 0 && value <= 10000;
const nano = value => typeof value === 'string' && /^(?:0|-?[1-9]\d{0,35})$/.test(value);
const day = value => typeof value === 'string' && /^\d{4}-\d\d-\d\d$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
export function validReportTiming(value, period, total) {
  if (!keys(value, 'version,scope,timeBasis,amountBasis,state,period,rowCount,usableRowCount,differentDayRowCount,shiftedRowCount,firstSettlementDay,lastSettlementDay,currencies,blockers')
    || value.version !== REPORT_TIMING_VERSION || value.scope !== 'selected-report-rows'
    || value.timeBasis !== 'utc-calendar-day' || value.amountBasis !== 'signed-report-order-amount'
    || !['empty', 'observed', 'unavailable'].includes(value.state)
    || !keys(value.period, 'from,to') || !day(value.period.from) || !day(value.period.to) || value.period.from > value.period.to
    || value.period.from !== period?.from || value.period.to !== period?.to
    || !count(value.rowCount) || value.rowCount !== total || !count(value.usableRowCount) || value.usableRowCount > total
    || !Array.isArray(value.currencies) || value.currencies.length > 256 || !Array.isArray(value.blockers)
    || value.blockers.length > Object.keys(REPORT_TIMING_REASONS).length
    || new Set(value.blockers.map(row => row?.code)).size !== value.blockers.length
    || !value.blockers.every(row => keys(row, 'code,count') && Object.hasOwn(REPORT_TIMING_REASONS, row.code) && count(row.count))) return false;
  if (value.state === 'unavailable') return value.currencies.length === 0 && value.blockers.length > 0
    && value.differentDayRowCount === null && value.shiftedRowCount === null && value.firstSettlementDay === null && value.lastSettlementDay === null;
  if (value.blockers.length || value.usableRowCount !== total || !count(value.differentDayRowCount) || value.differentDayRowCount > total
    || !count(value.shiftedRowCount) || value.shiftedRowCount > value.differentDayRowCount) return false;
  if (value.state === 'empty') return total === 0 && value.currencies.length === 0 && value.firstSettlementDay === null && value.lastSettlementDay === null;
  if (!total || !day(value.firstSettlementDay) || !day(value.lastSettlementDay) || value.firstSettlementDay > value.lastSettlementDay
    || !value.currencies.length || new Set(value.currencies.map(row => row?.currency)).size !== value.currencies.length) return false;
  let currencyRows = 0;
  for (const row of value.currencies) {
    if (!keys(row, 'currency,rowCount,periodShiftNanos,buckets') || !/^[A-Z]{3}$/.test(row.currency || '')
      || !count(row.rowCount) || !row.rowCount || !nano(row.periodShiftNanos) || !Array.isArray(row.buckets) || row.buckets.length !== 3) return false;
    let operationRows = 0, settlementRows = 0, operationAmount = 0n, settlementAmount = 0n;
    for (const [index, bucket] of row.buckets.entries()) {
      if (!keys(bucket, 'period,operationAmountNanos,settlementAmountNanos,operationRowCount,settlementRowCount')
        || bucket.period !== ['before', 'within', 'after'][index] || !nano(bucket.operationAmountNanos) || !nano(bucket.settlementAmountNanos)
        || !count(bucket.operationRowCount) || !count(bucket.settlementRowCount)
        || bucket.operationRowCount === 0 && bucket.operationAmountNanos !== '0'
        || bucket.settlementRowCount === 0 && bucket.settlementAmountNanos !== '0') return false;
      operationRows += bucket.operationRowCount; settlementRows += bucket.settlementRowCount;
      operationAmount += BigInt(bucket.operationAmountNanos); settlementAmount += BigInt(bucket.settlementAmountNanos);
    }
    if (operationRows !== row.rowCount || settlementRows !== row.rowCount || operationAmount !== settlementAmount
      || BigInt(row.periodShiftNanos) !== BigInt(row.buckets[1].settlementAmountNanos) - BigInt(row.buckets[1].operationAmountNanos)) return false;
    currencyRows += row.rowCount;
  }
  return currencyRows === total;
}
