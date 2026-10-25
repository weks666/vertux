import { decimalNanos } from './number-format.js';
import { REPORT_TIMING_REASONS } from './broker-report-timing-contract.js';

const date = value => value.split('-').reverse().join('.');
// Called only after the closed public contract and selected period are checked.
export function reportTimingHtml(value, open) {
  if (!value) return '';
  const labels = { observed: 'Даты сопоставлены', empty: 'Нет строк', unavailable: 'Недостаточно данных' };
  const show = (value, currency) => decimalNanos(value, { digits: 9 }) + ' ' + currency;
  let body;
  if (value.state === 'empty') body = '<p>В сохранённом отчёте нет сделок для сравнения дат. Это не означает отсутствие денежных движений на счёте.</p>';
  else if (value.state === 'unavailable') body = `<p>Проверено строк: ${value.usableRowCount} из ${value.rowCount}. Итоги по датам недоступны; неполная сумма не показана.</p>`
    + value.blockers.map(reason => `<p class="broker-reports-note">${REPORT_TIMING_REASONS[reason.code]}${reason.count ? ' Строк: ' + reason.count + '.' : ''}</p>`).join('')
    + '<p class="broker-reports-note">Исходные поля доступны ниже. После обновления истории операций или отчёта повторите чтение сохранённого.</p>';
  else body = `<p>Сопоставлено строк: ${value.rowCount} из ${value.rowCount}. День расчётов отличается от дня операции у ${value.differentDayRowCount} строк. Из-за выбора даты положение относительно периода изменилось у ${value.shiftedRowCount} строк.</p>
    <p class="broker-reports-note">Дни расчётов по UTC: ${date(value.firstSettlementDay)}${value.firstSettlementDay === value.lastSettlementDay ? '' : ' — ' + date(value.lastSettlementDay)}. Период сравнения: ${date(value.period.from)} — ${date(value.period.to)}, обе даты включены.</p>`
    + value.currencies.map(row => {
      const [before, within, after] = row.buckets;
      return `<div class="broker-reports-fee-currency" data-timing-currency="${row.currency}"><h5>${row.currency} · в выбранном периоде</h5><dl>
        <div><dt>По датам операций</dt><dd>${show(within.operationAmountNanos, row.currency)}</dd></div>
        <div><dt>По датам расчётов</dt><dd>${show(within.settlementAmountNanos, row.currency)}</dd></div>
        <div><dt>Разница из-за выбора даты</dt><dd>${show(row.periodShiftNanos, row.currency)}</dd></div></dl>
        <p class="broker-reports-note">До периода: по операциям ${show(before.operationAmountNanos, row.currency)}, по расчётам ${show(before.settlementAmountNanos, row.currency)}. После периода: по операциям ${show(after.operationAmountNanos, row.currency)}, по расчётам ${show(after.settlementAmountNanos, row.currency)}.</p></div>`;
    }).join('');
  return `<details class="broker-reports-fees" data-report-timing="${value.state}" ${open ? 'open' : ''}>
    <summary data-report-control="timing">Суммы по датам операций и расчётов · ${labels[value.state]}</summary>
    ${body}<p class="broker-reports-note">Одна и та же сумма каждой строки отчёта без НКД учитывается со знаком покупки (−) или продажи (+) по двум датам. Комиссии, НКД и платёж всей операции не добавляются; валюты не пересчитываются.</p>
    <p class="broker-reports-note">Сравнение охватывает только строки этой версии отчёта. Разница показывает влияние выбора даты, а не фактическое движение денег, прибыль или завершение финансовой сверки.</p></details>`;
}
