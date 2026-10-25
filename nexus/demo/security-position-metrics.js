import { decimalNanos } from './number-format.js';

export const SECURITY_POSITION_METRICS_VERSION = 'security-position-metrics-v1';
export const securityPositionMetricReasons = Object.freeze({
 source_unavailable: 'Сохранённый источник не удалось проверить. Повторите синхронизацию.',
 snapshot_mismatch: 'Данные не подтверждены в одном снимке текущей позиции.',
 source_scan_limit: 'Состав превышает предел проверки: 500 позиций.',
 ambiguous_position: 'Исходная позиция неоднозначна.',
 projection_mismatch: 'Сохранённое поле расходится с исходными сведениями.',
 unknown_quantity: 'Количество позиции не прошло проверку.',
 missing_field: 'Брокер не передал это поле.',
 invalid_field: 'Значение поля не прошло проверку.',
 unknown_currency: 'Собственная валюта денежного поля не подтверждена.',
 currency_conflict: 'Текущая и средняя цены переданы в разных валютах. Валюта результата не подтверждена.',
 currency_unavailable: 'Для результата не подтверждена валюта инструмента в этом снимке.',
 currency_mismatch: 'Валюты результата и его основания различаются.',
 price_unavailable: 'Для стоимости нужна подтверждённая текущая денежная цена.',
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
const currency = v => typeof v === 'string' && /^[A-Z]{3}$/u.test(v) && v !== 'PTS';
const iso = v => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
const fields = ['averagePrice', 'currentPrice', 'unrealizedPnl', 'dailyPnl'];
const topKeys = ['contractVersion', 'state', 'reasonCode', 'observedAt', 'timeBasis', 'assetType', 'quantityNanos', ...fields, 'unrealizedCurrencyBasis', 'returnEstimate', 'positionValue'];
export const unknownSecurityMetric = (reasonCode = 'unverified') => ({ state: 'unavailable', amountNanos: null, currency: null,
 reasonCode: Object.hasOwn(securityPositionMetricReasons, reasonCode) ? reasonCode : 'unverified' });
const unknownValue = reasonCode => ({ state: 'unavailable', currency: null, magnitudeNanos: null, signedNanos: null, exactNumerator: null, discardedNanosNumerator: null, reasonCode });
const equal = (a,b) => keys(a,Object.keys(b)) && Object.keys(b).every(k=>a[k]===b[k]);
export function calculateSecurityPositionValue(quantityNanos, price) {
 if (price?.state !== 'known') return unknownValue('price_unavailable');
 const signed=BigInt(quantityNanos)*BigInt(price.amountNanos), magnitude=signed<0n?-signed:signed;
 return { state:'known', currency:price.currency, magnitudeNanos:(magnitude/NANO).toString(), signedNanos:(signed/NANO).toString(), exactNumerator:magnitude.toString(), discardedNanosNumerator:(magnitude%NANO).toString(), reasonCode:null };
}
const unknownReturn = reasonCode => ({ state: 'unavailable', costBasisNumerator: null, ratePpm: null, reasonCode });
export function calculateSecurityReturnEstimate(quantityNanos, average, result) {
 if (average?.state !== 'known') return unknownReturn('average_unavailable');
 if (result?.state !== 'known') return unknownReturn('result_unavailable');
 if (average.currency !== result.currency) return unknownReturn('currency_mismatch');
 const q = BigInt(quantityNanos), quantity = q < 0n ? -q : q, price = BigInt(average.amountNanos);
 if (quantity === 0n) return unknownReturn('zero_quantity');
 if (price === 0n) return unknownReturn('zero_average');
 const basis = quantity * price;
 return { state: 'known', costBasisNumerator: basis.toString(), ratePpm: (BigInt(result.amountNanos) * NANO * PPM / basis).toString(), reasonCode: null };
}
export function unknownSecurityPositionMetrics(reasonCode = 'source_unavailable') {
 const metric = unknownSecurityMetric(reasonCode);
 return { contractVersion: SECURITY_POSITION_METRICS_VERSION, state: 'unavailable', reasonCode: metric.reasonCode,
  observedAt: null, timeBasis: null, assetType: null, quantityNanos: null, ...Object.fromEntries(fields.map(k => [k, { ...metric }])),
  unrealizedCurrencyBasis: null, returnEstimate: unknownReturn(metric.reasonCode), positionValue: unknownValue(metric.reasonCode) };
}
export function securityResultCurrencyBasis(average, current) {
 const a = average?.state === 'known' ? average.currency : null, c = current?.state === 'known' ? current.currency : null;
 if (a && c && a !== c) return { currency: null, basis: null, reasonCode: 'currency_conflict' };
 return a || c ? { currency: a || c, basis: a && c ? 'both-prices' : a ? 'average-price' : 'current-price', reasonCode: null }
  : { currency: null, basis: null, reasonCode: 'currency_unavailable' };
}
function validMetric(v, name) {
 if (!keys(v, ['state', 'amountNanos', 'currency', 'reasonCode'])) return false;
 if (v.state === 'unavailable') return v.amountNanos === null && v.currency === null && Object.hasOwn(securityPositionMetricReasons, v.reasonCode);
 return v.state === 'known' && nanos(v.amountNanos) && currency(v.currency) && v.reasonCode === null
  && (!['averagePrice', 'currentPrice'].includes(name) || BigInt(v.amountNanos) >= 0n);
}
/** Closed public projection; no raw payload, broker identifier, or catalog fallback. */
export function validSecurityPositionMetrics(v, row) {
 try {
  if (!keys(v, topKeys) || v.contractVersion !== SECURITY_POSITION_METRICS_VERSION || !fields.every(k => validMetric(v[k], k))
   || !keys(v.returnEstimate, ['state', 'costBasisNumerator', 'ratePpm', 'reasonCode'])) return false;
  if (v.state === 'unavailable') {
   if (!Object.hasOwn(securityPositionMetricReasons, v.reasonCode) || v.observedAt !== null || v.timeBasis !== null || v.assetType !== null || v.quantityNanos !== null || v.unrealizedCurrencyBasis !== null
    || !fields.every(k => v[k].state === 'unavailable' && v[k].reasonCode === v.reasonCode)
    || !equal(v.positionValue,unknownValue(v.reasonCode)) || Object.keys(unknownReturn(v.reasonCode)).some(k => v.returnEstimate[k] !== unknownReturn(v.reasonCode)[k])) return false;
  } else {
   if (v.state !== 'verified' || v.reasonCode !== null || !iso(v.observedAt) || !['client-observed','saved-snapshot'].includes(v.timeBasis) || !['share','etf'].includes(v.assetType) || !nanos(v.quantityNanos)) return false;
   if (v.unrealizedPnl.state === 'known') {
    const basis = securityResultCurrencyBasis(v.averagePrice, v.currentPrice);
    if (v.unrealizedPnl.currency !== basis.currency || v.unrealizedCurrencyBasis !== basis.basis) return false;
   } else if (v.unrealizedCurrencyBasis !== null) return false;
   const expected = calculateSecurityReturnEstimate(v.quantityNanos, v.averagePrice, v.unrealizedPnl);
   if (Object.keys(expected).some(k => v.returnEstimate[k] !== expected[k]) || !equal(v.positionValue,calculateSecurityPositionValue(v.quantityNanos,v.currentPrice))) return false;
  }
  if (!row) return true;
  if (!['share','etf'].includes(row.assetType) || v.state === 'verified' && (row.assetType !== v.assetType || row.quantityNanos !== v.quantityNanos || row.asOf !== v.observedAt)) return false;
  const same = (key, value) => row[key] === value;
  return same('positionValueNanos',v.positionValue.magnitudeNanos) && same('positionValueCurrency',v.positionValue.currency)
   && same('currentPriceNanos', v.currentPrice.amountNanos) && same('priceCurrency', v.currentPrice.currency)
   && same('averagePriceNanos', v.averagePrice.amountNanos) && same('entryPriceNanos', v.averagePrice.amountNanos)
   && same('averagePriceCurrency', v.averagePrice.currency) && same('entryPriceCurrency', v.averagePrice.currency)
   && ['totalPnlNanos', 'pnlNanos', 'brokerUnrealizedPnlNanos', 'contractPnlNanos'].every(k => same(k, v.unrealizedPnl.amountNanos))
   && same('pnlCurrency', v.unrealizedPnl.currency) && same('dayPnlNanos', v.dailyPnl.amountNanos) && same('dayPnlCurrency', v.dailyPnl.currency)
   && same('totalReturnRate', securityPositionReturnRate(v)) && same('returnRate', securityPositionReturnRate(v));
 } catch { return false; }
}
export function securityPositionReturnRate(v) {
 return v?.returnEstimate?.state === 'known' && int(v.returnEstimate.ratePpm) ? Number(v.returnEstimate.ratePpm) / 1e6 : null;
}
const esc = v => String(v ?? '').replace(/[&<>"']/gu, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const exactMoney = (v, locale) => v.state === 'known' ? decimalNanos(v.amountNanos, { digits: 9, locale }) + ' ' + v.currency : '—';
const reason = v => securityPositionMetricReasons[v.reasonCode] || securityPositionMetricReasons.unverified;
export function renderSecurityPositionAverage(row, { locale = 'ru' } = {}) {
 const v = validSecurityPositionMetrics(row?.securityPositionMetrics, row) ? row.securityPositionMetrics.averagePrice : unknownSecurityMetric();
 return '<span class="bond-position-average security-position-average" data-security-average="' + v.state + '"><span>' + esc(exactMoney(v, locale))
  + '</span><small>' + (v.state === 'known' ? 'Средняя брокера' : 'Средняя не подтверждена') + '</small></span>';
}
export function renderSecurityPositionResult(row, { locale = 'ru', amountText = '—' } = {}) {
 const v = validSecurityPositionMetrics(row?.securityPositionMetrics, row) ? row.securityPositionMetrics : unknownSecurityPositionMetrics('unverified');
 const result = v.unrealizedPnl, known = result.state === 'known';
 const sign = known ? BigInt(result.amountNanos) < 0n ? 'negative' : BigInt(result.amountNanos) > 0n ? 'positive' : '' : '';
 const percentage = v.returnEstimate.state === 'known' ? new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'ru-RU', { style: 'percent', maximumFractionDigits: 2, signDisplay: 'exceptZero' }).format(securityPositionReturnRate(v)) : null;
 const rows = [['Средняя / шт.', v.averagePrice], ['Текущая / шт.', v.currentPrice], ['Стоимость позиции', {state:v.positionValue.state,amountNanos:v.positionValue.magnitudeNanos,currency:v.positionValue.currency,reasonCode:v.positionValue.reasonCode}], ['Результат брокера', result], ['Результат за день', v.dailyPnl]];
 const detail = rows.map(([label, field]) => '<div><dt>' + esc(label) + '</dt><dd>' + esc(exactMoney(field, locale))
  + (field.state === 'known' || v.state === 'unavailable' ? '' : '<small>' + esc(reason(field)) + '</small>') + '</dd></div>').join('');
 const at = v.observedAt ? new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'ru-RU', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Moscow' }).format(new Date(v.observedAt)) + ' МСК' : null;
 const basisText = v.unrealizedCurrencyBasis === 'both-prices' ? 'Валюта результата подтверждена совпадающими валютами текущей и средней цен.'
  : v.unrealizedCurrencyBasis === 'current-price' ? 'Валюта результата подтверждена текущей ценой; средняя цена недоступна.'
   : v.unrealizedCurrencyBasis === 'average-price' ? 'Валюта результата подтверждена средней ценой; текущая цена недоступна.' : reason(result);
 return '<span class="bond-position-metrics security-position-metrics" data-security-result="' + result.state + '"><strong class="' + sign + '">' + esc(known ? amountText : '—') + '</strong>'
  + (percentage === null ? '' : '<small class="return-rate">' + esc(percentage) + ' оценки</small>')
  + '<small>' + (known ? 'Оценка брокера' : 'Результат не подтверждён') + '</small><details><summary>Оценка и валюта</summary><dl>' + detail + '</dl>'
  + (v.state === 'unavailable' ? '<p>' + esc(reason(v)) + '</p>' : '')
  + '<p>Т‑Инвест · сохранённый портфель.' + (at ? (v.timeBasis === 'client-observed' ? ' Получено ' : ' Дата сохранённого снимка ') + esc(at) + '.' : ' Время снимка не подтверждено.') + '</p>'
  + '<p>Поля выше — в валюте источника; основная сумма — в выбранной валюте.</p>'
  + '<details class="bond-position-metric-method security-position-metric-method"><summary>Как получена оценка</summary><p>' + esc(basisText) + '</p>'
  + '<p>' + (v.returnEstimate.state === 'known' ? 'Процент = результат брокера / (абсолютное количество × средняя цена). Расчёт использует точное произведение; процент усекается до одной миллионной доли.'
   : esc(reason(v.returnEstimate))) + '</p>'
  + '<p>Средняя цена может обновляться с задержкой; это не FIFO и не цена отдельной сделки.</p>'
  + '<p>Стоимость позиции = абсолютное количество × текущая денежная цена за штуку. Размер лота повторно не применяется; остаток меньше одной миллиардной денежной единицы отсекается после произведения.</p>'
  + '<p>Это текущая оценка брокера, а не прибыль за выбранный период или фактические выплаты. Дивиденды и комиссии дополнительно не прибавляются. Дата снимка не подтверждает время биржевой оценки.</p></details></details></span>';
}

export function renderSecurityPositionValue(row,{amountText='—'}={}) {
 const v=validSecurityPositionMetrics(row?.securityPositionMetrics,row)?row.securityPositionMetrics.positionValue:unknownValue('unverified');
 return '<span class="security-position-value" data-security-value="'+v.state+'">'+esc(v.state==='known'?amountText:'—')+'</span>';
}
