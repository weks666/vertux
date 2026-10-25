import {financialMetric} from './number-format.js';
const esc=value=>String(value??'').replace(/[&<>"']/gu,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const fundamentalPeriod=value=>({TTM:'Последние 12 месяцев',MRQ:'Последний квартал',FY:'Финансовый год',provider_current:'Сводка поставщика',provider_unspecified:'Период не указан','1Y':'За 1 год','3Y':'За 3 года','5Y':'За 5 лет','current_market_cap / TTM':'Текущая капитализация / последние 12 месяцев'})[value]||value||'Период не указан';
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}/u.test(value)?value.slice(0,10):null;
function sourceMarkup(source){
  let url;try{const parsed=new URL(source.url);if(parsed.protocol==='https:'&&!parsed.username&&!parsed.password)url=parsed.href;}catch{}
  const title=esc(source.title||'Источник'),asOf=date(source.asOf),retrievedAt=date(source.retrievedAt);
  return `<p>Источник: ${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${title}</a>`:title}. ${asOf?'Дата данных источника: '+esc(asOf):'Дата данных источника не указана'}.${retrievedAt?' Получено: '+esc(retrievedAt)+'.':''}</p>`;
}
export function fundamentalMetricBody(metric,report={}){
  const descriptions={
    freeCashFlowTtm:'Свободный денежный поток (FCF) описывает средства, оставшиеся после операционных расходов и инвестиций. Здесь показано значение поставщика: мы не пересчитывали его. Состав потока и методика поставщиком не раскрыты; исходных операционного потока и капитальных затрат в этих данных нет.',
    computedFreeCashFlowMarginTtm:'Доля свободного денежного потока в выручке. Формула: FCF / выручка × 100. Расчёт по переданным показателям, а не по исходному отчёту эмитента.',
    computedPriceToFreeCashFlowTtm:'Отношение капитализации к свободному денежному потоку. Формула: капитализация / FCF. Капитализация относится к текущей сводке, FCF — к TTM; совпадение дат составляющих не подтверждено.',
  };
  const sources=(report.sources||[]).filter(source=>(metric.sourceIds||[]).includes(source.id));
  return `<p class="financial-metric-exact">Сохранённое значение: <strong>${esc(financialMetric(metric,{mode:'exact'}))}</strong></p>`+
    (descriptions[metric.key]?`<p>${esc(descriptions[metric.key])}</p>`:'')+
    `<p>Период: ${esc(fundamentalPeriod(metric.period))}. Это период показателя компании, а не выбранный период портфеля.</p>`+
    (metric.unit==='provider_value'?'<p>Масштаб единицы не указан. Значение не умножалось на 100 и не обозначается как процент.</p>':metric.unit==='unknown_currency'?'<p>Валюта отчётности не указана; валюта торгов не подставляется.</p>':'')+
    (metric.calculationVersion?`<p>Версия расчёта: ${esc(metric.calculationVersion)}.</p>`:'')+
    (sources.length?sources.map(sourceMarkup).join(''):'<p>Источник этого показателя не указан.</p>');
}
export function fundamentalMetricDisclosure(metric,report){
  return `<details class="financial-metric-details" data-financial-metric="${esc(metric.key)}"><summary aria-label="Сведения о показателе ${esc(metric.label||metric.key)}">Значение и источник</summary>${fundamentalMetricBody(metric,report)}</details>`;
}
