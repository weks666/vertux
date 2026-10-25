export const ASSET_FACTS_VERSION = 'asset-facts-v1';
export const ASSET_FACTS_SOURCE = 'https://raw.githubusercontent.com/RussianInvestments/investAPI/main/src/docs/contracts/instruments.proto';
export const ASSET_FACT_FIELDS = Object.freeze({
 etf: Object.freeze([
  ['totalExpense','Общие расходы','percent'],['fixedCommission','Фиксированная комиссия','percent'],
  ['performanceFee','Комиссия за результат','percent'],['hurdleRate','Порог доходности для комиссии','percent'],
  ['buyPremium','Надбавка при покупке','percent'],['sellDiscount','Скидка при продаже','percent'],['expenseCommission','Прочие расходы','percent'],
  ['managementType','Управление','text'],['paymentType','Выплата дохода','text'],['primaryIndex','Основной индекс','text'],
  ['focusType','Направление инвестиций','text'],['description','Стратегия','text'],['primaryIndexDescription','Описание индекса','text'],
  ['leveragedFlag','Заявленное плечо фонда','boolean'],['watermarkFlag','Правило высокой отметки','boolean'],
  ['rebalancingFlag','Ребалансировка','boolean'],['rebalancingFreq','Частота ребалансировки','text'],
 ].map(Object.freeze)),
 bond: Object.freeze([['indexedNominalFlag','Индексируемый номинал','boolean'],['borrowName','Заёмщик по данным источника','text'],['returnCondition','Условия погашения','text']].map(Object.freeze)),
});
export const assetFactUid = value => typeof value === 'string' && /^[A-Za-z0-9._:@/-]{1,160}$/u.test(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value,key));
export const assetFactTime = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value && Date.parse(value) > 0;
export const assetFactSelection = value => exact(value,['instrumentUid','assetUid','assetType']) && assetFactUid(value.instrumentUid) && assetFactUid(value.assetUid) && Object.hasOwn(ASSET_FACT_FIELDS,value.assetType);
export function assetFactField(value, type) {
 if (!object(value) || !['absent','invalid','present'].includes(value.state)) return false;
 if (value.state !== 'present') return exact(value,['state','value']) && value.value === null;
 if (!exact(value,['state','value'])) return false;
 if (type === 'boolean') return typeof value.value === 'boolean';
 if (type === 'time') return assetFactTime(value.value);
 if (type === 'text') return typeof value.value === 'string' && value.value === value.value.trim() && value.value.length > 0 && value.value.length <= 1600 && !/[\u0000-\u0008\u000b-\u001f\u007f]/u.test(value.value);
 return typeof value.value === 'string' && /^(0|[1-9]\d{0,27})$/u.test(value.value) && BigInt(value.value) <= 9223372036854775807999999999n;
}
export function validAssetFactRecord(value, selection, at) {
 if (!exact(value,['contractVersion','selection','capturedAt','sourceUpdatedAt','fields']) || value.contractVersion !== 'asset-facts-record-v1'
  || !assetFactSelection(value.selection) || JSON.stringify(value.selection) !== JSON.stringify(selection)
  || !assetFactTime(value.capturedAt) || !assetFactTime(at) || value.capturedAt > at
  || !assetFactField(value.sourceUpdatedAt,'time') || value.sourceUpdatedAt.state === 'present' && value.sourceUpdatedAt.value > value.capturedAt) return false;
 const definitions = ASSET_FACT_FIELDS[selection.assetType];
 return exact(value.fields,definitions.map(row=>row[0])) && definitions.every(([key,,type])=>assetFactField(value.fields[key],type));
}
export function validAssetFacts(value, selection, contextKey = null) {
 if (!exact(value,['contractVersion','selection','contextKey','readMode','state','evaluatedAt','catalog','record','source','sourceDigest'])
  || value.contractVersion !== ASSET_FACTS_VERSION || !assetFactSelection(selection) || !assetFactSelection(value.selection)
  || JSON.stringify(value.selection) !== JSON.stringify(selection) || !/^[a-f0-9]{64}$/u.test(value.contextKey)
  || contextKey !== null && value.contextKey !== contextKey || !['saved-only','explicit-refresh'].includes(value.readMode)
  || !['missing','invalid','fresh','stale'].includes(value.state) || !assetFactTime(value.evaluatedAt)
  || !exact(value.catalog,['capturedAt','stale']) || !assetFactTime(value.catalog.capturedAt) || value.catalog.capturedAt > value.evaluatedAt || typeof value.catalog.stale !== 'boolean'
  || !exact(value.source,['provider','method','url']) || value.source.provider !== 'Т-Инвестиции' || value.source.method !== 'GetAssetBy' || value.source.url !== ASSET_FACTS_SOURCE) return false;
 if (['missing','invalid'].includes(value.state)) return value.record === null && value.sourceDigest === null && value.readMode === 'saved-only';
 return /^[a-f0-9]{64}$/u.test(value.sourceDigest) && validAssetFactRecord(value.record,selection,value.evaluatedAt);
}
export function assetFactDisplay(field, type) {
 if (field.state !== 'present') return field.state === 'absent' ? 'Источник не передал' : 'Значение не прошло проверку';
 if (type === 'boolean') return field.value ? 'Да' : 'Нет';
 if (type !== 'percent') return field.value;
 const raw = BigInt(field.value), fraction = String(raw % 1000000000n).padStart(9,'0').replace(/0+$/u,'');
 return String(raw / 1000000000n) + (fraction ? ',' + fraction : '') + ' %';
}
