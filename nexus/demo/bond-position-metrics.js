import { decimalNanos } from './number-format.js';

export const BOND_POSITION_METRICS_VERSION = 'bond-position-metrics-v1';
export const bondPositionMetricReasons = Object.freeze({
 source_unavailable: 'Сохранённый источник не удалось проверить. Повторите синхронизацию.',
 snapshot_mismatch: 'Данные не подтверждены в одном снимке текущей позиции.',
 source_scan_limit: 'Состав превышает предел проверки: 500 позиций.',
 ambiguous_position: 'Исходная позиция неоднозначна.',
 projection_mismatch: 'Сохранённое поле расходится с исходными сведениями.',
 legacy_source: 'В старом снимке не подтверждена идентичность облигации. Обновите состав портфеля.',
 unknown_quantity: 'Количество позиции не прошло проверку.',
 missing_field: 'Брокер не передал это поле.',
 invalid_field: 'Значение поля не прошло проверку.',
 unknown_currency: 'Собственная валюта денежного поля не подтверждена.',
 currency_conflict: 'Текущая и средняя цены переданы в разных валютах. Валюта результата не подтверждена.',
 currency_unavailable: 'Для результата не подтверждена валюта инструмента в этом снимке.',
 currency_mismatch: 'Валюты результата и его основания различаются.',
 average_unavailable: 'Для процента нужна подтверждённая средняя цена брокера.',
 result_unavailable: 'Для процента нужен подтверждённый результат брокера.',
 zero_quantity: 'При нулевом количестве относительный результат не определяется.',
 zero_average: 'При нулевой средней цене относительный результат не определяется.',
 unverified: 'Денежные поля позиции не прошли проверку.'
});
const NANO = 1000000000n, PPM = 1000000n;
const maximum = 9223372036854775807n * NANO + NANO - 1n;
const minimum = -9223372036854775808n * NANO - NANO + 1n;
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const keys = (v, expected) => object(v) && Object.keys(v).sort().join('|') === [...expected].sort().join('|');
const int = v => typeof v === 'string' && /^-?(?:0|[1-9]\d{0,60})$/u.test(v) && v !== '-0';
const nanos = v => int(v) && BigInt(v) <= maximum && BigInt(v) >= minimum;
const currency = v => typeof v === 'string' && /^[A-Z]{3}$/u.test(v);
const iso = v => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
const fields = ['averagePrice', 'currentPrice', 'unrealizedPnl', 'dailyPnl'];
const topKeys = ['contractVersion', 'state', 'reasonCode', 'observedAt', 'timeBasis', 'quantityNanos', ...fields, 'unrealizedCurrencyBasis', 'returnEstimate'];
export const unknownBondMetric = (reasonCode = 'unverified') => ({ state: 'unavailable', amountNanos: null, currency: null,
 reasonCode: Object.hasOwn(bondPositionMetricReasons, reasonCode) ? reasonCode : 'unverified' });
const unknownReturn = reasonCode => ({ state: 'unavailable', costBasisNumerator: null, ratePpm: null, reasonCode });
export function calculateBondReturnEstimate(quantityNanos, average, result) {
 if (average?.state !== 'known') return unknownReturn('average_unavailable');
 if (result?.state !== 'known') return unknownReturn('result_unavailable');
 if (average.currency !== result.currency) return unknownReturn('currency_mismatch');
 const q = BigInt(quantityNanos), quantity = q < 0n ? -q : q, price = BigInt(average.amountNanos);
 if (quantity === 0n) return unknownReturn('zero_quantity');
 if (price === 0n) return unknownReturn('zero_average');
 const basis = quantity * price;
 return { state: 'known', costBasisNumerator: basis.toString(), ratePpm: (BigInt(result.amountNanos) * NANO * PPM / basis).toString(), reasonCode: null };
}
export function unknownBondPositionMetrics(reasonCode = 'source_unavailable') {
 const metric = unknownBondMetric(reasonCode);
 return { contractVersion: BOND_POSITION_METRICS_VERSION, state: 'unavailable', reasonCode: metric.reasonCode,
  observedAt: null, timeBasis: null, quantityNanos: null, ...Object.fromEntries(fields.map(k => [k, { ...metric }])),
  unrealizedCurrencyBasis: null, returnEstimate: unknownReturn(metric.reasonCode) };
}
export function bondResultCurrencyBasis(average, current) {
 const a = average?.state === 'known' ? average.currency : null, c = current?.state === 'known' ? current.currency : null;
 if (a && c && a !== c) return { currency: null, basis: null, reasonCode: 'currency_conflict' };
 return a || c ? { currency: a || c, basis: a && c ? 'both-prices' : a ? 'average-price' : 'current-price', reasonCode: null }
  : { currency: null, basis: null, reasonCode: 'currency_unavailable' };
}
function validMetric(v, name) {
 if (!keys(v, ['state', 'amountNanos', 'currency', 'reasonCode'])) return false;
 if (v.state === 'unavailable') return v.amountNanos === null && v.currency === null && Object.hasOwn(bondPositionMetricReasons, v.reasonCode);
 return v.state === 'known' && nanos(v.amountNanos) && currency(v.currency) && v.reasonCode === null
  && (!['averagePrice', 'currentPrice'].includes(name) || BigInt(v.amountNanos) >= 0n);
}
/** Closed public projection; no raw payload, broker identifier, or catalog fallback. */
export function validBondPositionMetrics(v, row) {
 try {
  if (!keys(v, topKeys) || v.contractVersion !== BOND_POSITION_METRICS_VERSION || !fields.every(k => validMetric(v[k], k))
   || !keys(v.returnEstimate, ['state', 'costBasisNumerator', 'ratePpm', 'reasonCode'])) return false;
  if (v.state === 'unavailable') {
   if (!Object.hasOwn(bondPositionMetricReasons, v.reasonCode) || v.observedAt !== null || v.timeBasis !== null || v.quantityNanos !== null || v.unrealizedCurrencyBasis !== null
    || !fields.every(k => v[k].state === 'unavailable' && v[k].reasonCode === v.reasonCode)
    || Object.keys(unknownReturn(v.reasonCode)).some(k => v.returnEstimate[k] !== unknownReturn(v.reasonCode)[k])) return false;
  } else {
   if (v.state !== 'verified' || v.reasonCode !== null || !iso(v.observedAt) || v.timeBasis !== 'client-observed' || !nanos(v.quantityNanos)) return false;
   if (v.unrealizedPnl.state === 'known') {
    const basis = bondResultCurrencyBasis(v.averagePrice, v.currentPrice);
    if (v.unrealizedPnl.currency !== basis.currency || v.unrealizedCurrencyBasis !== basis.basis) return false;
   } else if (v.unrealizedCurrencyBasis !== null) return false;
   const expected = calculateBondReturnEstimate(v.quantityNanos, v.averagePrice, v.unrealizedPnl);
   if (Object.keys(expected).some(k => v.returnEstimate[k] !== expected[k])) return false;
  }
  if (!row) return true;
  if (row.assetType !== 'bond' || v.state === 'verified' && (row.quantityNanos !== v.quantityNanos || row.asOf !== v.observedAt)) return false;
  const same = (key, value) => row[key] === value;
  return same('currentPriceNanos', v.currentPrice.amountNanos) && same('priceCurrency', v.currentPrice.currency)
   && same('averagePriceNanos', v.averagePrice.amountNanos) && same('entryPriceNanos', v.averagePrice.amountNanos)
   && same('averagePriceCurrency', v.averagePrice.currency) && same('entryPriceCurrency', v.averagePrice.currency)
   && ['totalPnlNanos', 'pnlNanos', 'brokerUnrealizedPnlNanos', 'contractPnlNanos'].every(k => same(k, v.unrealizedPnl.amountNanos))
   && same('pnlCurrency', v.unrealizedPnl.currency) && same('dayPnlNanos', v.dailyPnl.amountNanos) && same('dayPnlCurrency', v.dailyPnl.currency)
   && same('totalReturnRate', bondPositionReturnRate(v)) && same('returnRate', bondPositionReturnRate(v));
 } catch { return false; }
}
export function bondPositionReturnRate(v) {
 return v?.returnEstimate?.state === 'known' && int(v.returnEstimate.ratePpm) ? Number(v.returnEstimate.ratePpm) / 1e6 : null;
}
const esc = v => String(v ?? '').replace(/[&<>"']/gu, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const exactMoney = (v, locale) => v.state === 'known' ? decimalNanos(v.amountNanos, { digits: 9, locale }) + ' ' + v.currency : '—';
const reason = v => bondPositionMetricReasons[v.reasonCode] || bondPositionMetricReasons.unverified;
export function renderBondPositionAverage(row, { locale = 'ru' } = {}) {
 const v = validBondPositionMetrics(row?.bondPositionMetrics, row) ? row.bondPositionMetrics.averagePrice : unknownBondMetric();
 return '<span class="bond-position-average" data-bond-average="' + v.state + '"><span>' + esc(exactMoney(v, locale))
  + '</span><small>' + (v.state === 'known' ? 'Средняя брокера' : 'Средняя не подтверждена') + '</small></span>';
}
export function renderBondPositionResult(row, { locale = 'ru', amountText = '—' } = {}) {
 const v = validBondPositionMetrics(row?.bondPositionMetrics, row) ? row.bondPositionMetrics : unknownBondPositionMetrics('unverified');
 const result = v.unrealizedPnl, known = result.state === 'known';
 const sign = known ? BigInt(result.amountNanos) < 0n ? 'negative' : BigInt(result.amountNanos) > 0n ? 'positive' : '' : '';
 const percentage = v.returnEstimate.state === 'known' ? new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'ru-RU', { style: 'percent', maximumFractionDigits: 2, signDisplay: 'exceptZero' }).format(bondPositionReturnRate(v)) : null;
 const rows = [['Средняя / шт.', v.averagePrice], ['Текущая / шт.', v.currentPrice], ['Результат брокера', result], ['Результат за день', v.dailyPnl]];
 const detail = rows.map(([label, field]) => '<div><dt>' + esc(label) + '</dt><dd>' + esc(exactMoney(field, locale))
  + (field.state === 'known' || v.state === 'unavailable' ? '' : '<small>' + esc(reason(field)) + '</small>') + '</dd></div>').join('');
 const at = v.observedAt ? new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'ru-RU', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Moscow' }).format(new Date(v.observedAt)) + ' МСК' : null;
 const basisText = v.unrealizedCurrencyBasis === 'both-prices' ? 'Валюта результата подтверждена совпадающими валютами текущей и средней цен.'
  : v.unrealizedCurrencyBasis === 'current-price' ? 'Валюта результата подтверждена текущей ценой; средняя цена недоступна.'
   : v.unrealizedCurrencyBasis === 'average-price' ? 'Валюта результата подтверждена средней ценой; текущая цена недоступна.' : reason(result);
 return '<span class="bond-position-metrics" data-bond-result="' + result.state + '"><strong class="' + sign + '">' + esc(known ? amountText : '—') + '</strong>'
  + (percentage === null ? '' : '<small class="return-rate">' + esc(percentage) + ' оценки</small>')
  + '<small>' + (known ? 'Оценка брокера' : 'Результат не подтверждён') + '</small><details><summary>Оценка и валюта</summary><dl>' + detail + '</dl>'
  + (v.state === 'unavailable' ? '<p>' + esc(reason(v)) + '</p>' : '')
  + '<p>Т‑Инвест · сохранённый портфель.' + (at ? ' Получено ' + esc(at) + '.' : ' Время получения не подтверждено.') + '</p>'
  + '<p>Поля выше — в валюте источника; основная сумма — в выбранной валюте.</p>'
  + '<details class="bond-position-metric-method"><summary>Как получена оценка</summary><p>' + esc(basisText) + '</p>'
  + '<p>' + (v.returnEstimate.state === 'known' ? 'Процент = результат брокера / (абсолютное количество × средняя цена). Расчёт использует точное произведение; процент усекается до одной миллионной доли.'
   : esc(reason(v.returnEstimate))) + '</p>'
  + '<p>Средняя цена может обновляться с задержкой; это не FIFO и не цена отдельной сделки.</p>'
  + '<p>Это текущая оценка брокера, а не прибыль за выбранный период, фактические выплаты или доходность к погашению. НКД и купоны дополнительно к результату не прибавляются.</p></details></details></span>';
}
