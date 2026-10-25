export const BOND_SCHEDULE_VERSION = 'bond-schedule-v1';
export const BOND_SCHEDULE_SOURCE = 'https://raw.githubusercontent.com/RussianInvestments/investAPI/main/src/docs/contracts/instruments.proto';
export const BOND_SCHEDULE_LIMITS = Object.freeze({ events: 2000, sourceBytes: 2 * 1024 * 1024, totalBytes: 6 * 1024 * 1024, recordBytes: 4 * 1024 * 1024, years: 100, ttlMs: 6 * 3600000 });
export const BOND_SCHEDULE_KINDS = Object.freeze(['coupons','EVENT_TYPE_CALL','EVENT_TYPE_MTY','EVENT_TYPE_CONV']);
export const BOND_SCHEDULE_REASONS = Object.freeze({
 'placement-unknown':'В каталоге нет проверенной даты размещения. Используйте годовой календарь.',
 'maturity-unknown':'В каталоге нет проверенной даты погашения. Используйте годовой календарь.',
 'perpetual':'Для бессрочного выпуска нет конечного срока. Доступен годовой календарь.',
 'range-invalid':'Даты размещения и погашения в каталоге противоречат друг другу.',
 'range-too-long':'Срок выпуска превышает предел загрузки в 100 лет. Используйте годовой календарь.',
});
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value,keys) => object(value) && Object.keys(value).length === keys.length && keys.every(key=>Object.hasOwn(value,key));
export const bondScheduleUid = value => typeof value === 'string' && /^[A-Za-z0-9._:@/-]{1,160}$/u.test(value);
export const bondScheduleTime = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value && value >= '1900-01-01T00:00:00.000Z' && value < '2200-01-01T00:00:00.000Z';
const text = (value,limit) => typeof value === 'string' && value.length <= limit && !/[\u0000-\u0008\u000b-\u001f\u007f]/u.test(value);
const optionalTime = value => value === null || bondScheduleTime(value);
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
export const bondScheduleSelection = value => exact(value,['instrumentUid','assetUid','assetType']) && bondScheduleUid(value.instrumentUid) && bondScheduleUid(value.assetUid) && value.assetType === 'bond';
export const sameBondScheduleSelection = (left,right) => bondScheduleSelection(left) && bondScheduleSelection(right) && ['instrumentUid','assetUid','assetType'].every(key=>left[key]===right[key]);
export function validBondScheduleRange(value) {
 return exact(value,['from','to']) && bondScheduleTime(value.from) && bondScheduleTime(value.to)
  && value.from.endsWith('T00:00:00.000Z') && value.to.endsWith('T23:59:59.999Z') && value.from <= value.to
  && value.to.slice(0,10) <= new Date(Date.UTC(Number(value.from.slice(0,4))+BOND_SCHEDULE_LIMITS.years,Number(value.from.slice(5,7))-1,Number(value.from.slice(8,10)))).toISOString().slice(0,10);
}
export function bondScheduleRange(meta) {
 if (meta?.bondIssueTerms?.perpetual?.state === 'present' && meta.bondIssueTerms.perpetual.value === true) return {range:null,reason:'perpetual'};
 if (!bondScheduleTime(meta?.placementDate)) return {range:null,reason:'placement-unknown'};
 if (!bondScheduleTime(meta?.maturityDate)) return {range:null,reason:'maturity-unknown'};
 const range={from:meta.placementDate.slice(0,10)+'T00:00:00.000Z',to:meta.maturityDate.slice(0,10)+'T23:59:59.999Z'};
 if (range.from > range.to) return {range:null,reason:'range-invalid'};
 if (!validBondScheduleRange(range)) return {range:null,reason:'range-too-long'};
 return {range,reason:null};
}
const eventKeys=['id','sourceKind','kind','number','eventAt','paymentAt','amountNanos','currency','recordAt','couponType','couponStartAt','couponEndAt','executionAt','defaultAt','execution','operationType','fullRedemption','note'];
const nano = value => typeof value === 'string' && /^(0|[1-9]\d{0,27})$/u.test(value) && BigInt(value) <= 9223372036854775807999999999n;
export function validBondScheduleEvent(value,range) {
 if (!exact(value,eventKeys) || !/^[a-f0-9]{32}$/u.test(value.id) || !BOND_SCHEDULE_KINDS.includes(value.sourceKind)
  || !['coupon','offer','maturity','conversion'].includes(value.kind) || !bondScheduleTime(value.eventAt) || value.eventAt < range.from || value.eventAt > range.to
  || !['paymentAt','recordAt','couponStartAt','couponEndAt','executionAt','defaultAt'].every(key=>optionalTime(value[key]))
  || !text(value.execution,160) || !text(value.operationType,64) || !text(value.note,1200) || typeof value.fullRedemption !== 'boolean'
  || !(value.amountNanos === null ? value.currency === '' : nano(value.amountNanos) && /^[A-Z]{3}$/u.test(value.currency))) return false;
 if (value.kind === 'coupon') return value.sourceKind === 'coupons' && typeof value.number === 'string' && /^[1-9]\d{0,18}$/u.test(value.number)
  && BigInt(value.number) <= 9223372036854775807n && value.paymentAt === value.eventAt && text(value.couponType,32) && value.couponType.length > 0
  && (!value.couponStartAt || !value.couponEndAt || value.couponStartAt <= value.couponEndAt)
  && value.executionAt === null && value.defaultAt === null && value.execution === '' && value.operationType === '' && value.fullRedemption === false && value.note === '';
 return value.sourceKind === ({offer:'EVENT_TYPE_CALL',maturity:'EVENT_TYPE_MTY',conversion:'EVENT_TYPE_CONV'})[value.kind]
  && Number.isInteger(value.number) && value.number >= 0 && value.number <= 2147483647
  && value.couponType === null && value.couponStartAt === null && value.couponEndAt === null
  && value.fullRedemption === (value.kind === 'maturity' && ['CM','OM'].includes(value.operationType));
}
export function validBondScheduleRecord(value,selection,range,at) {
 if (!exact(value,['contractVersion','selection','range','startedAt','capturedAt','sources','events']) || value.contractVersion !== 'bond-schedule-record-v1'
  || !sameBondScheduleSelection(value.selection,selection) || !validBondScheduleRange(value.range) || value.range.from !== range?.from || value.range.to !== range?.to
  || !bondScheduleTime(value.startedAt) || !bondScheduleTime(value.capturedAt) || !bondScheduleTime(at) || value.startedAt > value.capturedAt || value.capturedAt > at
  || !Array.isArray(value.events) || value.events.length > BOND_SCHEDULE_LIMITS.events || !value.events.every(row=>validBondScheduleEvent(row,range))
  || new Set(value.events.map(row=>row.id)).size !== value.events.length
  || !Array.isArray(value.sources) || value.sources.length !== BOND_SCHEDULE_KINDS.length) return false;
 let last=value.startedAt;
 for (let index=0; index<value.sources.length; index++) {
  const source=value.sources[index];
  if (!exact(source,['kind','requestedAt','receivedAt','events']) || source.kind !== BOND_SCHEDULE_KINDS[index]
   || !bondScheduleTime(source.requestedAt) || !bondScheduleTime(source.receivedAt) || source.requestedAt < last || source.requestedAt > source.receivedAt || source.receivedAt > value.capturedAt
   || source.events !== value.events.filter(row=>row.sourceKind === source.kind).length) return false;
  last=source.receivedAt;
 }
 return value.events.every((row,index)=>index===0 || (value.events[index-1].eventAt+'|'+value.events[index-1].id) <= (row.eventAt+'|'+row.id));
}
export function validBondSchedule(value,selection,binding=null) {
 if (!exact(value,['contractVersion','selection','contextKey','readMode','state','reason','range','evaluatedAt','catalog','record','source','sourceDigest'])
  || value.contractVersion !== BOND_SCHEDULE_VERSION || !sameBondScheduleSelection(value.selection,selection) || !hash(value.contextKey) || binding !== null && value.contextKey !== binding
  || !['saved-only','explicit-refresh'].includes(value.readMode) || !['missing','invalid','fresh','stale','unsupported'].includes(value.state) || !bondScheduleTime(value.evaluatedAt)
  || !exact(value.catalog,['capturedAt','stale']) || !bondScheduleTime(value.catalog.capturedAt) || value.catalog.capturedAt > value.evaluatedAt || typeof value.catalog.stale !== 'boolean'
  || !exact(value.source,['provider','methods','url']) || value.source.provider !== 'Т-Инвестиции' || value.source.url !== BOND_SCHEDULE_SOURCE
  || JSON.stringify(value.source.methods) !== JSON.stringify(['GetBondCoupons','GetBondEvents'])) return false;
 if (value.state === 'unsupported') return value.readMode === 'saved-only' && Object.hasOwn(BOND_SCHEDULE_REASONS,value.reason) && value.range === null && value.record === null && value.sourceDigest === null;
 if (value.reason !== null || !validBondScheduleRange(value.range)) return false;
 if (['missing','invalid'].includes(value.state)) return value.readMode === 'saved-only' && value.record === null && value.sourceDigest === null;
 return hash(value.sourceDigest) && validBondScheduleRecord(value.record,selection,value.range,value.evaluatedAt)
  && (value.state === 'stale') === (Date.parse(value.record.capturedAt)+BOND_SCHEDULE_LIMITS.ttlMs <= Date.parse(value.evaluatedAt));
}
export function bondScheduleAmount(row) {
 if (row.amountNanos === null) return 'Сумма не указана';
 const value=BigInt(row.amountNanos), fraction=String(value % 1000000000n).padStart(9,'0').replace(/0+$/u,'');
 return String(value/1000000000n).replace(/\B(?=(\d{3})+(?!\d))/gu,' ') + (fraction ? ','+fraction : '') + ' '+row.currency;
}
export function bondScheduleDisplayRows(rows,at,showAll=false) {
 const output=showAll?[...rows]:rows.filter(row=>row.paymentAt === null || row.paymentAt.slice(0,10) >= at.slice(0,10));
 const key=row=>(row.paymentAt||'9999-12-31T23:59:59.999Z')+'|'+row.eventAt+'|'+row.id;
 return output.sort((left,right)=>key(left).localeCompare(key(right)));
}
export const bondScheduleFutureRows = (rows,at) => bondScheduleDisplayRows(rows,at,false);
