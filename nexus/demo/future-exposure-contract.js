import { validConcentrationConversion } from './direct-share-concentration-contract.js';
export const FUTURE_EXPOSURE_VERSION = 'future-exposure-v1';
export const FUTURE_EXPOSURE_REASONS = Object.freeze({
 source_unavailable: 'Сохранённый состав счёта не удалось подтвердить. Обновите портфель.',
 snapshot_mismatch: 'Источник и текущая оценка относятся к разным снимкам.',
 projection_mismatch: 'Состав сохранённых позиций расходится с исходным снимком.',
 source_scan_limit: 'Состав превышает предел проверки: 500 позиций.',
 unverified_position: 'Количество, денежная цена или их единицы не подтверждены.',
 fx_unavailable: 'Для этой валюты нет проверенного сохранённого курса на дату снимка.',
 invalid_nav: 'Стоимость счёта не подтверждена в том же снимке.',
 nonpositive_nav: 'Для отношения к капиталу нужна положительная стоимость счёта.',
 virtual_positions: 'Виртуальные позиции не входят в расчёт; полнота состава не подтверждена.',
 incomplete: 'Часть фьючерсов или валют не рассчитана. Показан только известный подытог.',
 unverified: 'Данные расчёта не прошли проверку.'
});
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const keys=(v,names)=>object(v)&&Object.keys(v).sort().join('|')===names.split(' ').sort().join('|');
const integer=v=>typeof v==='string'&&/^(?:0|-?[1-9]\d{0,119})$/u.test(v);
const amount=v=>integer(v)&&BigInt(v)>=-9223372036854775808999999999n&&BigInt(v)<=9223372036854775807999999999n;
const iso=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const label=v=>v===null||typeof v==='string'&&v.length>0&&v.length<=200&&!/[\u0000-\u001f\u007f]/u.test(v);
const uid=v=>typeof v==='string'&&/^[A-Za-z0-9._:@/-]{1,160}$/u.test(v);
const abs=v=>v<0n?-v:v;
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const unknownFutureExposureNav=()=>({state:'unavailable',amountNanos:null,currency:'RUB',reasonCode:'invalid_nav'});
export function calculateFutureExposure(rows,nav,virtualPositions,verified=true) {
 const groups=new Map();let rubLong=0n,rubShort=0n,rubNet=0n,priced=0,converted=0;
 for(const row of rows){
  if(row.state!=='included')continue;
  priced++;const q=BigInt(row.quantityNanos),value=q*BigInt(row.priceNanos),magnitude=abs(value);
  const group=groups.get(row.currency)||{currency:row.currency,long:0n,short:0n,net:0n,rows:0};
  group.long+=q>=0n?magnitude:0n;group.short+=q<0n?magnitude:0n;group.net+=value;group.rows++;groups.set(row.currency,group);
  if(!row.conversion)continue;
  converted++;const rate=BigInt(row.conversion.rateNanos);rubLong+=q>=0n?magnitude*rate:0n;rubShort+=q<0n?magnitude*rate:0n;rubNet+=value*rate;
 }
 const complete=verified&&priced===rows.length&&converted===rows.length&&virtualPositions==='explicit-zero';
 const totals=(long,short,net)=>({longNumerator:long.toString(),shortNumerator:short.toString(),grossNumerator:(long+short).toString(),netNumerator:net.toString()});
 const rub=converted||complete?totals(rubLong,rubShort,rubNet):null;
 const ratio=complete&&nav.state==='known'&&BigInt(nav.amountNanos)>0n?{numerator:(rubLong+rubShort).toString(),denominator:(BigInt(nav.amountNanos)*1000000000000000000n).toString()}:null;
 return {currencyGroups:[...groups.values()].sort((a,b)=>a.currency.localeCompare(b.currency)).map(g=>({currency:g.currency,rows:g.rows,...totals(g.long,g.short,g.net)})),rub,ratio,
  coverage:{futureRows:verified?rows.length:null,pricedRows:priced,convertedRows:converted,complete},
  ratioReason:ratio?null:!verified?'source_unavailable':virtualPositions!=='explicit-zero'?'virtual_positions':!complete?'incomplete':nav.state!=='known'?'invalid_nav':'nonpositive_nav'};
}
export function unavailableFutureExposure(portfolioId='portfolio-1',reasonCode='source_unavailable') {
 const nav=unknownFutureExposureNav();return {contractVersion:FUTURE_EXPOSURE_VERSION,portfolioId,state:'unavailable',reasonCode,observedAt:null,timeBasis:null,virtualPositions:'unknown',nav,rows:[],summary:calculateFutureExposure([],nav,'unknown',false)};
}
export function validFutureExposure(value) {
 try{
  if(!keys(value,'contractVersion portfolioId state reasonCode observedAt timeBasis virtualPositions nav rows summary')||value.contractVersion!==FUTURE_EXPOSURE_VERSION
   ||!/^portfolio-[1-9]\d*$/u.test(value.portfolioId)||!Array.isArray(value.rows)||value.rows.length>500)return false;
  const nav=value.nav;if(!keys(nav,'state amountNanos currency reasonCode')||nav.currency!=='RUB')return false;
  if(nav.state==='known'){if(!amount(nav.amountNanos)||nav.reasonCode!==null)return false;}
  else if(!equal(nav,unknownFutureExposureNav()))return false;
  if(value.state==='unavailable')return Object.hasOwn(FUTURE_EXPOSURE_REASONS,value.reasonCode)&&equal(value,unavailableFutureExposure(value.portfolioId,value.reasonCode));
  if(value.state!=='verified'||value.reasonCode!==null||!iso(value.observedAt)||value.timeBasis!=='client-observed'||!['explicit-zero','present-excluded','unknown'].includes(value.virtualPositions))return false;
  const ids=new Set();for(const [index,row]of value.rows.entries()){
   if(!keys(row,'key instrumentUid ticker name state reasonCode quantityNanos priceNanos currency conversion fxReason')||row.key!=='future-'+(index+1)||!uid(row.instrumentUid)||ids.has(row.instrumentUid)||!label(row.ticker)||!label(row.name))return false;
   ids.add(row.instrumentUid);
   if(row.state==='included'){
    if(row.reasonCode!==null||!amount(row.quantityNanos)||!amount(row.priceNanos)||typeof row.currency!=='string'||!/^[A-Z]{3}$/u.test(row.currency)||row.currency==='PTS')return false;
    if(row.conversion===null){if(row.fxReason!=='fx_unavailable'||row.currency==='RUB')return false;}
    else if(row.fxReason!==null||!validConcentrationConversion(row.conversion,row.currency,value.observedAt))return false;
   }else if(row.state!=='excluded'||row.reasonCode!=='unverified_position'||row.quantityNanos!==null||row.priceNanos!==null||row.currency!==null||row.conversion!==null||row.fxReason!==null)return false;
  }
  return equal(value.summary,calculateFutureExposure(value.rows,nav,value.virtualPositions));
 }catch{return false;}
}
