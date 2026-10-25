import { decimalNanos } from './number-format.js';

export const FUTURE_POSITION_METRICS_VERSION = 'future-position-metrics-v1';
export const futurePositionReasons = Object.freeze({
 source_unavailable: 'Сохранённый источник не удалось проверить. Обновите состав портфеля.',
 snapshot_mismatch: 'Поля не подтверждены в одном снимке текущей позиции.',
 source_scan_limit: 'Состав превышает предел проверки: 500 позиций.',
 ambiguous_position: 'Исходная позиция неоднозначна.',
 projection_mismatch: 'Сохранённое поле расходится с исходными сведениями.',
 legacy_source: 'В старом снимке единицы цены фьючерса не подтверждены. Обновите состав портфеля.',
 unknown_quantity: 'Количество позиции не прошло проверку.',
 missing_field: 'Брокер не передал это поле.',
 invalid_field: 'Значение поля не прошло проверку.',
 unknown_currency: 'Валюта денежного поля не подтверждена.',
 currency_conflict: 'Текущая и средняя денежные цены переданы в разных валютах.',
 currency_unavailable: 'Для результата не подтверждена валюта инструмента в этом снимке.',
 currency_mismatch: 'Валюта результата расходится с валютой его основания.',
 price_unavailable: 'Для расчёта нужна подтверждённая текущая цена.',
 points_not_money: 'Цена передана в пунктах. Денежный размер не определяется без подтверждённой стоимости шага и валюты на дату оценки.',
 average_unavailable: 'Для изменения цены нужна подтверждённая средняя цена брокера.',
 incompatible_prices: 'Текущая и средняя цены имеют разные единицы или валюты.',
 zero_average: 'При нулевой средней цене относительное изменение не определяется.',
 zero_quantity: 'При нулевом количестве направление изменения не определяется.',
 unverified: 'Поля фьючерсной позиции не прошли проверку.'
});
const NANO = 1000000000n, PPM = 1000000n;
const MAX = 9223372036854775807n * NANO + NANO - 1n;
const MIN = -9223372036854775808n * NANO - NANO + 1n;
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const keys = (v, names) => object(v) && Object.keys(v).sort().join('|') === [...names].sort().join('|');
const integer = v => typeof v === 'string' && /^-?(?:0|[1-9]\d{0,80})$/u.test(v) && v !== '-0';
const nanos = v => integer(v) && BigInt(v) >= MIN && BigInt(v) <= MAX;
const currency = v => typeof v === 'string' && /^[A-Z]{3}$/u.test(v) && v !== 'PTS';
const iso = v => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
const abs = n => n < 0n ? -n : n;
const fields = ['averagePrice', 'currentPrice', 'unrealizedPnl', 'dailyPnl'];
export const unknownFutureField = (reasonCode = 'unverified') => ({ state: 'unavailable', amountNanos: null, unit: null, currency: null,
 reasonCode: Object.hasOwn(futurePositionReasons, reasonCode) ? reasonCode : 'unverified' });
const unknownValue = reasonCode => ({ state: 'unavailable', currency: null, magnitudeNanos: null, signedNanos: null, exactNumerator: null, discardedNanosNumerator: null, reasonCode });
const unknownChange = reasonCode => ({ state: 'unavailable', ratePpm: null, unit: null, currency: null, reasonCode });
export function calculateFuturePositionValue(quantityNanos, price) {
 if (price?.state !== 'known') return unknownValue('price_unavailable');
 if (price.unit !== 'money') return unknownValue('points_not_money');
 const signed = BigInt(quantityNanos) * BigInt(price.amountNanos), magnitude = abs(signed);
 return { state: 'known', currency: price.currency, magnitudeNanos: (magnitude / NANO).toString(), signedNanos: (signed / NANO).toString(),
  exactNumerator: magnitude.toString(), discardedNanosNumerator: (magnitude % NANO).toString(), reasonCode: null };
}
export function calculateFuturePriceChange(quantityNanos, average, current) {
 if (average?.state !== 'known') return unknownChange('average_unavailable');
 if (current?.state !== 'known') return unknownChange('price_unavailable');
 if (average.unit !== current.unit || average.currency !== current.currency) return unknownChange('incompatible_prices');
 const quantity = BigInt(quantityNanos), price = BigInt(average.amountNanos);
 if (quantity === 0n) return unknownChange('zero_quantity');
 if (price === 0n) return unknownChange('zero_average');
 return { state: 'known', ratePpm: ((BigInt(current.amountNanos) - price) * (quantity < 0n ? -1n : 1n) * PPM / abs(price)).toString(),
  unit: current.unit, currency: current.currency, reasonCode: null };
}
export function futureResultCurrencyBasis(average, current) {
 const a = average?.state === 'known' && average.unit === 'money' ? average.currency : null;
 const c = current?.state === 'known' && current.unit === 'money' ? current.currency : null;
 if (a && c && a !== c) return { currency: null, basis: null, reasonCode: 'currency_conflict' };
 return { currency: c || a, basis: a && c ? 'both-money-prices' : c ? 'current-money-price' : a ? 'average-money-price' : null,
  reasonCode: c || a ? null : 'currency_unavailable' };
}
export function unknownFuturePositionMetrics(reasonCode = 'source_unavailable') {
 const field = unknownFutureField(reasonCode), code = field.reasonCode;
 return { contractVersion: FUTURE_POSITION_METRICS_VERSION, state: 'unavailable', reasonCode: code, observedAt: null, timeBasis: null,
  quantityNanos: null, ...Object.fromEntries(fields.map(name => [name, { ...field }])), unrealizedCurrencyBasis: null,
  positionValue: unknownValue(code), priceChange: unknownChange(code) };
}
const equal = (a, b) => keys(a, Object.keys(b)) && Object.keys(b).every(k => a[k] === b[k]);
function validField(v, price = false) {
 if (!keys(v, ['state','amountNanos','unit','currency','reasonCode'])) return false;
 if (v.state === 'unavailable') return Object.hasOwn(futurePositionReasons, v.reasonCode) && v.amountNanos === null && v.unit === null && v.currency === null;
 return v.state === 'known' && v.reasonCode === null && nanos(v.amountNanos)
  && (v.unit === 'money' && currency(v.currency) || price && v.unit === 'points' && v.currency === null);
}
export const futureFieldCurrency = field => field?.state !== 'known' ? null : field.unit === 'points' ? 'PTS' : field.currency;
export const futurePriceChangeRate = value => value?.priceChange?.state === 'known' && integer(value.priceChange.ratePpm) ? Number(value.priceChange.ratePpm) / 1e6 : null;
export function validFuturePositionMetrics(v, row) {
 try {
  if (!keys(v, ['contractVersion','state','reasonCode','observedAt','timeBasis','quantityNanos',...fields,'unrealizedCurrencyBasis','positionValue','priceChange'])
   || v.contractVersion !== FUTURE_POSITION_METRICS_VERSION || !fields.every(k => validField(v[k], k.endsWith('Price')))) return false;
  if (v.state === 'unavailable') {
   const expected = unknownFuturePositionMetrics(v.reasonCode);
   if (!Object.hasOwn(futurePositionReasons, v.reasonCode) || v.observedAt !== null || v.timeBasis !== null || v.quantityNanos !== null || v.unrealizedCurrencyBasis !== null
    || !fields.every(k => equal(v[k], expected[k])) || !equal(v.positionValue, expected.positionValue) || !equal(v.priceChange, expected.priceChange)) return false;
  } else {
   if (v.state !== 'verified' || v.reasonCode !== null || !iso(v.observedAt) || v.timeBasis !== 'client-observed' || !nanos(v.quantityNanos)) return false;
   if (v.unrealizedPnl.state === 'known') {
    const basis = futureResultCurrencyBasis(v.averagePrice, v.currentPrice);
    if (v.unrealizedPnl.currency !== basis.currency || v.unrealizedCurrencyBasis !== basis.basis) return false;
   } else if (v.unrealizedCurrencyBasis !== null) return false;
   if (!equal(v.positionValue, calculateFuturePositionValue(v.quantityNanos, v.currentPrice))
    || !equal(v.priceChange, calculateFuturePriceChange(v.quantityNanos, v.averagePrice, v.currentPrice))) return false;
  }
  if (!row) return true;
  if (row.assetType !== 'future' || v.state === 'verified' && (row.quantityNanos !== v.quantityNanos || row.asOf !== v.observedAt)) return false;
  return row.currentPriceNanos === v.currentPrice.amountNanos && row.priceCurrency === futureFieldCurrency(v.currentPrice)
   && row.entryPriceNanos === v.averagePrice.amountNanos && row.averagePriceNanos === v.averagePrice.amountNanos
   && row.entryPriceCurrency === futureFieldCurrency(v.averagePrice) && row.averagePriceCurrency === futureFieldCurrency(v.averagePrice)
   && row.positionValueNanos === v.positionValue.magnitudeNanos && row.positionValueCurrency === v.positionValue.currency
   && ['totalPnlNanos','pnlNanos','brokerUnrealizedPnlNanos'].every(k => row[k] === v.unrealizedPnl.amountNanos)
   && row.pnlCurrency === v.unrealizedPnl.currency && row.dayPnlNanos === v.dailyPnl.amountNanos && row.dayPnlCurrency === v.dailyPnl.currency
   && row.totalReturnRate === futurePriceChangeRate(v) && row.returnRate === futurePriceChangeRate(v) && row.contractPnlNanos === null;
 } catch { return false; }
}
const esc = value => String(value ?? '').replace(/[&<>"']/gu, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const reason = value => futurePositionReasons[value?.reasonCode] || futurePositionReasons.unverified;
const number = (value, locale) => decimalNanos(value, { digits: 9, locale });
const tone = value => value == null ? '' : BigInt(value) < 0n ? 'negative' : BigInt(value) > 0n ? 'positive' : '';
const fieldText = (v, locale) => v.state === 'known' ? number(v.amountNanos, locale) + ' ' + (v.unit === 'points' ? 'п.' : v.currency) : '—';
const checked = row => validFuturePositionMetrics(row?.futurePositionMetrics, row) ? row.futurePositionMetrics : unknownFuturePositionMetrics('unverified');
export function renderFuturePositionAverage(row, { locale = 'ru' } = {}) {
 const value = checked(row).averagePrice;
 return '<span class="future-position-average" data-future-average="' + value.state + '"><span>' + esc(fieldText(value, locale))
  + '</span><small>' + (value.state === 'known' ? 'Средняя брокера' : 'Средняя не подтверждена') + '</small></span>';
}
export function renderFuturePositionValue(row, { amountText = '—' } = {}) {
 const value = checked(row).positionValue;
 return '<span class="future-position-value" data-future-value="' + value.state + '"><span>' + esc(value.state === 'known' ? amountText : '—')
  + '</span><small>Размер контрактов</small></span>';
}
export function renderFuturePositionMetrics(row, { locale = 'ru' } = {}) {
 const value = checked(row), change = value.priceChange;
 const percentage = change.state === 'known' ? new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'ru-RU', { style: 'percent', maximumFractionDigits: 2, signDisplay: 'exceptZero' }).format(futurePriceChangeRate(value)) : null;
 const vmKnown = row?.variationMarginEvidence === 'direct' && ['present','legacy-nonzero'].includes(row.variationMarginPresence) && nanos(row.variationMarginNanos);
 const vm = vmKnown ? number(row.variationMarginNanos, locale) + ' ' + (currency(row.variationMarginCurrency) ? row.variationMarginCurrency : '· валюта неизвестна') : '—';
 const details = [['Средняя / контракт',value.averagePrice],['Текущая / контракт',value.currentPrice],['Оценка брокера',value.unrealizedPnl],['Результат за день',value.dailyPnl]]
  .map(([label, field]) => '<div><dt>' + esc(label) + '</dt><dd>' + esc(fieldText(field, locale)) + (field.state === 'known' ? '' : '<small>' + esc(reason(field)) + '</small>') + '</dd></div>').join('');
 const at = value.observedAt ? new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'ru-RU', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Moscow' }).format(new Date(value.observedAt)) + ' МСК' : null;
 const magnitude = value.positionValue.state === 'known' ? number(value.positionValue.magnitudeNanos, locale) + ' ' + value.positionValue.currency : '—';
 const basis = { 'both-money-prices':'Валюта оценки брокера подтверждена совпадающими валютами текущей и средней денежных цен.',
  'current-money-price':'Валюта оценки брокера подтверждена денежной текущей ценой.', 'average-money-price':'Валюта оценки брокера подтверждена денежной средней ценой.' }[value.unrealizedCurrencyBasis];
 return '<span class="future-position-metrics" data-future-result="' + value.unrealizedPnl.state + '"><strong>Итог не рассчитан</strong>'
  + (percentage === null ? '' : '<small class="return-rate"><span class="' + tone(change.ratePpm) + '">' + esc(percentage) + '</span>' + (change.unit === 'points' ? ' пунктов' : ' денежной цены') + '</small>')
  + '<small>Оценка брокера: <span class="' + tone(value.unrealizedPnl.amountNanos) + '">' + esc(fieldText(value.unrealizedPnl, locale)) + '</span></small><small>Вар. маржа: <span class="' + tone(vmKnown ? row.variationMarginNanos : null) + '">' + esc(vm) + '</span></small>'
  + '<details><summary>Цена, единицы и оценка</summary><dl>' + details + '<div><dt>Размер контрактов</dt><dd>' + esc(magnitude) + '</dd></div></dl>'
  + (value.state === 'unavailable' ? '<p>' + esc(reason(value)) + '</p>' : '')
  + '<p>Т‑Инвест · сохранённый портфель.' + (at ? ' Получено ' + esc(at) + '.' : ' Время получения не подтверждено.') + '</p>'
  + '<p>Денежная цена сохраняет валюту источника; пункты обозначены отдельно. Средняя цена может обновляться с задержкой; это не FIFO.</p>'
  + '<details class="future-position-method"><summary>Как получены показатели</summary>'
  + '<p>' + (value.positionValue.state === 'known' ? 'Размер контрактов = абсолютная величина произведения количества и денежной цены одного контракта. Шаг цены, размер лота и базового актива повторно не умножаются. Остаток менее одной миллиардной денежной единицы отсекается после произведения.' : esc(reason(value.positionValue))) + '</p>'
  + '<p>' + (change.state === 'known' ? 'Изменение цены = разница текущей и средней цен / абсолютная средняя цена, с учётом направления позиции. Сравниваются одинаковые единицы и валюты; процент усекается до одной миллионной доли.' : esc(reason(change))) + '</p>'
  + '<p>' + esc(basis || reason(value.unrealizedPnl)) + '</p>'
  + '<p>Размер контрактов — не стоимость имущества счёта, не гарантийное обеспечение и не доступные деньги. Изменение цены — не доходность на ГО и не прибыль за период.</p>'
  + '<p>Оценка брокера и вариационная маржа не складываются. Полный денежный итог контракта требует подтверждённых расчётов и комиссий. Дата получения не подтверждает время биржевой оценки.</p>'
  + '<p>' + esc(row?.variationMarginReason || 'Вариационная маржа относится к отдельному полю снимка портфеля, а не к выбранному периоду.') + '</p></details></details></span>';
}
