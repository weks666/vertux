import {decimalNanos} from './number-format.js';
export const FUTURES_BASIS_VERSION='futures-basis-v1';
export const FUTURES_BASIS_SOURCE='https://raw.githubusercontent.com/RussianInvestments/investAPI/main/src/docs/contracts/marketdata.proto';
export const FUTURES_BASIS_UNITS='https://raw.githubusercontent.com/RussianInvestments/investAPI/main/src/docs/faq_marketdata.md';
export const FUTURES_BASIS_LIMITS=Object.freeze({family:50,spots:50,sourceBytes:2097152,recordBytes:131072,ttlMs:60000,quoteAgeMs:300000,quoteGapMs:60000});
export const FUTURES_BASIS_REASONS=Object.freeze({
 'underlying-missing':'В каталоге нет точного идентификатора базовой позиции.',
 'underlying-type':'Для этого базового актива ещё не подтверждены сопоставимые единицы цены. Сравнение доступно для акций и фондов с валютной ценой.',
 'spot-missing':'Базовой бумаги нет в сохранённом каталоге. Совпадение тикера не создаёт связь.',
 'family-limit':'В каталоге больше 50 связанных контрактов. Неполная кривая не строится.',
 'spot-limit':'В каталоге больше 50 режимов базовой бумаги. Список не сокращается до случайного варианта.',
 'quote-missing':'Источник не вернул цену одного из инструментов.',
 'quote-type':'Для обеих цен не подтверждён биржевой источник.',
 'price-missing':'Источник не передал обе цены.',
 'price-nonpositive':'Для сравнения нужны две положительные цены.',
 'time-missing':'Время одной из цен не указано.',
 'time-future':'Время цены позже получения ответа.',
 'price-old':'На момент получения одна из цен была старше пяти минут.',
 'time-gap':'Время двух цен различается больше чем на минуту.',
 'catalog-old':'На момент получения цен каталог уже требовал обновления.',
 'currency-mismatch':'Для обеих сторон не подтверждена одна валюта. Конвертация не выполняется.',
 'units-missing':'Шаг, стоимость шага или размер базового актива не подтверждены положительными значениями.',
 'expiry-missing':'Дата истечения контракта не подтверждена.',
 'expired':'На момент этих цен срок контракта уже истёк.',
});
const N=1000000000n,DAY=86400n*N,MAX=9223372036854775807999999999n;
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,keys)=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
export const basisUid=v=>typeof v==='string'&&/^[A-Za-z0-9._:@/-]{1,160}$/u.test(v);
const text=(v,max)=>typeof v==='string'&&v.length<=max&&!/[\u0000-\u001f\u007f]/u.test(v);
const currency=v=>v===null||typeof v==='string'&&/^[A-Z]{3}$/u.test(v);
export function basisNanos(v){
 if(typeof v!=='string'||! /^-?\d{1,28}$/u.test(v))return null;
 const n=BigInt(v);return n>=-MAX-1n&&n<=MAX?n:null;
}
// Preserve source fractional seconds. Date arithmetic and thresholds use integer
// nanoseconds; display formatting is deliberately separate.
export function basisTime(v){
 if(typeof v!=='string'||v.length>40)return null;
 const m=/^(\d{4}-\d\d-\d\d)T(\d\d):(\d\d):(\d\d)(?:\.(\d{1,9}))?(Z|[+-]\d\d:\d\d)$/u.exec(v);
 if(!m||+m[2]>23||+m[3]>59||+m[4]>59)return null;
 const d=Date.parse(m[1]+'T00:00:00Z');
 if(!Number.isFinite(d)||new Date(d).toISOString().slice(0,10)!==m[1])return null;
 if(m[6]!=='Z'&&(+m[6].slice(1,3)>23||+m[6].slice(4)>59))return null;
 const base=Date.parse(m[1]+'T'+m[2]+':'+m[3]+':'+m[4]+m[6]);
 if(!Number.isFinite(base)||base<0)return null;
 return BigInt(base)*1000000n+BigInt((m[5]||'').padEnd(9,'0'));
}
export const basisSelection=v=>exact(v,['instrumentUid','assetUid','assetType'])&&basisUid(v.instrumentUid)&&basisUid(v.assetUid)&&v.assetType==='future';
const selectionEqual=(a,b)=>basisSelection(a)&&basisSelection(b)&&a.instrumentUid===b.instrumentUid&&a.assetUid===b.assetUid;
const nullableMoney=v=>v===null||basisNanos(v)!==null;
const validSpot=v=>exact(v,['instrumentUid','assetUid','assetType','ticker','name','classCode','currency','lot'])
 &&basisUid(v.instrumentUid)&&basisUid(v.assetUid)&&['share','etf'].includes(v.assetType)&&text(v.ticker,64)&&text(v.name,240)&&text(v.classCode,240)
 &&currency(v.currency)&&(v.lot===null||Number.isSafeInteger(v.lot)&&v.lot>0);
const validFuture=v=>exact(v,['instrumentUid','assetUid','ticker','name','classCode','currency','expirationAt','stepNanos','stepAmountNanos','underlyingSizeNanos'])
 &&basisUid(v.instrumentUid)&&basisUid(v.assetUid)&&text(v.ticker,64)&&text(v.name,240)&&text(v.classCode,240)&&currency(v.currency)
 &&(v.expirationAt===null||basisTime(v.expirationAt)!==null)&&[v.stepNanos,v.stepAmountNanos,v.underlyingSizeNanos].every(nullableMoney);
const quoteKeys=['instrumentUid','priceNanos','at','kind'];
export function validFuturesBasisRecord(v,selection,spotUid,contextKey,evaluatedAt,ids){
 if(!exact(v,['contractVersion','selection','spotInstrumentUid','contextKey','requestedAt','receivedAt','quotes'])
  ||v.contractVersion!==FUTURES_BASIS_VERSION||!selectionEqual(v.selection,selection)||v.spotInstrumentUid!==spotUid||v.contextKey!==contextKey
  ||!basisUid(spotUid)||!Array.isArray(v.quotes)||v.quotes.length!==ids.length)return false;
 const start=basisTime(v.requestedAt),end=basisTime(v.receivedAt),now=basisTime(evaluatedAt);
 if(start===null||end===null||now===null||start>end||end>now)return false;
 const requested=[...ids].sort();if(new Set(requested).size!==requested.length||requested.length>FUTURES_BASIS_LIMITS.family+1)return false;
 return v.quotes.every((q,i)=>exact(q,quoteKeys)&&q.instrumentUid===requested[i]&&nullableMoney(q.priceNanos)
  &&(q.at===null||basisTime(q.at)!==null)&&['missing','exchange','dealer','unknown'].includes(q.kind)
  &&(q.kind!=='missing'||q.priceNanos===null&&q.at===null));
}
export function validFuturesBasis(v,selection,spotUid=null,binding=null){
 if(!exact(v,['contractVersion','selection','spotOptions','selectedSpotUid','family','catalogs','contextKey','readMode','state','reason','evaluatedAt','record','source','sourceDigest'])
  ||v.contractVersion!==FUTURES_BASIS_VERSION||!selectionEqual(v.selection,selection)||v.selectedSpotUid!==spotUid
  ||!/^[a-f0-9]{64}$/u.test(v.contextKey)||binding!==null&&binding!==v.contextKey||!['saved-only','explicit-refresh'].includes(v.readMode)
  ||basisTime(v.evaluatedAt)===null||!Array.isArray(v.spotOptions)||v.spotOptions.length>FUTURES_BASIS_LIMITS.spots||!v.spotOptions.every(validSpot)
  ||!Array.isArray(v.family)||v.family.length>FUTURES_BASIS_LIMITS.family||!v.family.every(validFuture)
  ||new Set(v.spotOptions.map(x=>x.instrumentUid)).size!==v.spotOptions.length||new Set(v.family.map(x=>x.instrumentUid)).size!==v.family.length
  ||v.family.some(x=>v.spotOptions.some(s=>s.instrumentUid===x.instrumentUid))
  ||!Array.isArray(v.catalogs)||!v.catalogs.length||v.catalogs.length>3)return false;
 if(!v.catalogs.every(c=>exact(c,['assetType','capturedAt','expiresAt'])&&['future','share','etf'].includes(c.assetType)
  &&basisTime(c.capturedAt)!==null&&basisTime(c.expiresAt)!==null&&basisTime(c.capturedAt)<=basisTime(v.evaluatedAt)&&basisTime(c.expiresAt)>=basisTime(c.capturedAt))
  ||new Set(v.catalogs.map(c=>c.assetType)).size!==v.catalogs.length||!v.catalogs.some(c=>c.assetType==='future'))return false;
 if(!exact(v.source,['method','url','unitsUrl'])||v.source.method!=='GetLastPrices'||v.source.url!==FUTURES_BASIS_SOURCE||v.source.unitsUrl!==FUTURES_BASIS_UNITS)return false;
 if(v.state==='unsupported')return v.record===null&&v.sourceDigest===null&&spotUid===null&&['underlying-missing','underlying-type','spot-missing','family-limit','spot-limit'].includes(v.reason);
 if(v.reason!==null||!v.family.some(x=>x.instrumentUid===selection.instrumentUid)||!v.spotOptions.length)return false;
 if(v.state==='choose-spot')return spotUid===null&&v.record===null&&v.sourceDigest===null;
 const spot=v.spotOptions.find(s=>s.instrumentUid===spotUid);
 if(!spot||!v.catalogs.some(c=>c.assetType===spot.assetType))return false;
 if(['missing','invalid'].includes(v.state))return v.record===null&&v.sourceDigest===null;
 if(!['fresh','stale'].includes(v.state)||!validFuturesBasisRecord(v.record,selection,spotUid,v.contextKey,v.evaluatedAt,[spotUid,...v.family.map(x=>x.instrumentUid)])
  ||!/^[a-f0-9]{64}$/u.test(v.sourceDigest))return false;
 return (basisTime(v.evaluatedAt)-basisTime(v.record.receivedAt)>=BigInt(FUTURES_BASIS_LIMITS.ttlMs)*1000000n)===(v.state==='stale');
}
function round(n,d){
 if(d<=0n)throw new Error('BASIS_DENOMINATOR');
 const sign=n<0n?-1n:1n,abs=n<0n?-n:n;
 return sign*((abs+d/2n)/d);
}
export function futuresBasisRows(data){
 if(!validFuturesBasis(data,data?.selection,data?.selectedSpotUid)||!data.record)return [];
 const {record}=data,spot=data.spotOptions.find(x=>x.instrumentUid===data.selectedSpotUid),sq=record.quotes.find(x=>x.instrumentUid===spot.instrumentUid);
 const received=basisTime(record.receivedAt),catalogs=data.catalogs.filter(x=>x.assetType==='future'||x.assetType===spot.assetType);
 return data.family.map(future=>{
  const fq=record.quotes.find(x=>x.instrumentUid===future.instrumentUid),base={instrumentUid:future.instrumentUid,state:'unavailable',reason:null,asOf:null,daysNanos:null,futureUnitPriceNanos:null,differenceNanos:null,premiumPercentNanos:null,annualizedPercentNanos:null};
  const reject=reason=>({...base,reason});
  if(fq.kind==='missing'||sq.kind==='missing')return reject('quote-missing');
  if(fq.kind!=='exchange'||sq.kind!=='exchange')return reject('quote-type');
  if(fq.priceNanos===null||sq.priceNanos===null)return reject('price-missing');
  const fp=basisNanos(fq.priceNanos),sp=basisNanos(sq.priceNanos);
  if(fp<=0n||sp<=0n)return reject('price-nonpositive');
  const ft=basisTime(fq.at),st=basisTime(sq.at);
  if(ft===null||st===null)return reject('time-missing');
  if(ft>received||st>received)return reject('time-future');
  if(received-ft>BigInt(FUTURES_BASIS_LIMITS.quoteAgeMs)*1000000n||received-st>BigInt(FUTURES_BASIS_LIMITS.quoteAgeMs)*1000000n)return reject('price-old');
  if((ft>st?ft-st:st-ft)>BigInt(FUTURES_BASIS_LIMITS.quoteGapMs)*1000000n)return reject('time-gap');
  if(catalogs.some(c=>basisTime(c.expiresAt)<=received||basisTime(c.capturedAt)>received))return reject('catalog-old');
  if(!future.currency||future.currency!==spot.currency)return reject('currency-mismatch');
  const step=basisNanos(future.stepNanos),amount=basisNanos(future.stepAmountNanos),size=basisNanos(future.underlyingSizeNanos);
  if(step===null||amount===null||size===null||step<=0n||amount<=0n||size<=0n)return reject('units-missing');
  const expiry=basisTime(future.expirationAt);if(expiry===null)return reject('expiry-missing');
  const asOf=ft>st?ft:st,remaining=expiry-asOf;if(remaining<=0n)return reject('expired');
  const numerator=fp*amount*N-sp*step*size,denominator=sp*step*size;
  return {...base,state:'ready',asOf:ft>st?fq.at:sq.at,daysNanos:round(remaining*N,DAY).toString(),
   futureUnitPriceNanos:round(fp*amount*N,step*size).toString(),differenceNanos:round(numerator,step*size).toString(),
   premiumPercentNanos:round(numerator*100n*N,denominator).toString(),
   annualizedPercentNanos:round(numerator*100n*N*365n*DAY,denominator*remaining).toString()};
 });
}
export const basisNumber=(value,{maxFractionDigits=9}={})=>value===null?'Не указано':decimalNanos(value,{digits:maxFractionDigits});
