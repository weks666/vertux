import {bondScheduleSelection,sameBondScheduleSelection,bondScheduleTime,validBondScheduleRange,validBondScheduleRecord} from './bond-schedule-contract.js';
import {BOND_YIELD_VERSION,BOND_YIELD_LIMITS,yieldNanos,yieldTime,yieldDay,calculateBondYield} from './bond-yield-model.js';
export {BOND_YIELD_VERSION,BOND_YIELD_LIMITS};
export const BOND_YIELD_SOURCE=Object.freeze({provider:'Т-Инвестиции',methods:['GetBondCoupons','GetBondEvents','GetLastPrices','GetAccruedInterests'],
 contractUrl:'https://raw.githubusercontent.com/RussianInvestments/investAPI/main/src/docs/contracts/instruments.proto',
 unitsUrl:'https://developer.tbank.ru/invest/services/quotes/head-marketdata',methodUrl:'https://www.finra.org/investors/insights/bond-yield-return'});
export const yieldObject=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export const yieldExact=(v,keys)=>yieldObject(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
export const yieldHash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v);
const nullableNano=v=>v===null||yieldNanos(v)!==null,nullableTime=v=>v===null||bondScheduleTime(v),currency=v=>v===null||typeof v==='string'&&/^[A-Z]{3}$/u.test(v);
const clockPair=v=>bondScheduleTime(v.requestedAt)&&bondScheduleTime(v.receivedAt)&&v.requestedAt<=v.receivedAt;
export const validYieldTerms=v=>yieldExact(v,['priceUnit','currency','nominalCurrency','initialNominalCurrency','nominalNanos','initialNominalNanos','flags','placementAt','maturityAt','couponPaymentsPerYear'])
 &&[null,'percent-of-nominal'].includes(v.priceUnit)&&[v.currency,v.nominalCurrency,v.initialNominalCurrency].every(currency)&&[v.nominalNanos,v.initialNominalNanos].every(nullableNano)
 &&Array.isArray(v.flags)&&v.flags.length===4&&v.flags.every(x=>x===null||typeof x==='boolean')&&nullableTime(v.placementAt)&&nullableTime(v.maturityAt)
 &&(v.couponPaymentsPerYear===null||Number.isSafeInteger(v.couponPaymentsPerYear)&&v.couponPaymentsPerYear>=0&&v.couponPaymentsPerYear<=366);
export function validBondYieldRecord(v,selection,contextKey,evaluatedAt){
 if(!yieldExact(v,['contractVersion','selection','contextKey','startedAt','capturedAt','catalog','terms','schedule','quote','accrued'])||v.contractVersion!==BOND_YIELD_VERSION
  ||!sameBondScheduleSelection(v.selection,selection)||v.contextKey!==contextKey||!yieldHash(contextKey)||!bondScheduleTime(evaluatedAt)
  ||!bondScheduleTime(v.startedAt)||!bondScheduleTime(v.capturedAt)||v.startedAt>v.capturedAt||v.capturedAt>evaluatedAt
  ||!yieldExact(v.catalog,['capturedAt','expiresAt'])||!bondScheduleTime(v.catalog.capturedAt)||!bondScheduleTime(v.catalog.expiresAt)||v.catalog.capturedAt>v.startedAt||v.catalog.expiresAt<v.catalog.capturedAt
  ||!validYieldTerms(v.terms)||!validBondScheduleRange(v.schedule?.range)||!validBondScheduleRecord(v.schedule,selection,v.schedule.range,v.capturedAt)
  ||v.schedule.startedAt!==v.startedAt||v.schedule.capturedAt>v.capturedAt
  ||v.schedule.range.from!==yieldDay(v.terms.placementAt)+'T00:00:00.000Z'||v.schedule.range.to!==yieldDay(v.terms.maturityAt)+'T23:59:59.999Z')return false;
 const q=v.quote,a=v.accrued;
 if(!yieldExact(q,['requestedAt','receivedAt','instrumentUid','at','kind','priceNanos'])||!clockPair(q)||q.requestedAt<v.schedule.capturedAt||q.receivedAt>v.capturedAt
  ||q.instrumentUid!==selection.instrumentUid||!(q.at===null||yieldTime(q.at)!==null)||!['exchange','dealer','unknown','missing'].includes(q.kind)||!nullableNano(q.priceNanos))return false;
 if(!yieldExact(a,['requestedAt','receivedAt','from','to','rows'])||!clockPair(a)||a.requestedAt<q.receivedAt||a.receivedAt>v.capturedAt
  ||!bondScheduleTime(a.from)||!bondScheduleTime(a.to)||a.from!==yieldDay(v.startedAt)+'T00:00:00.000Z'||a.to!==yieldDay(v.startedAt)+'T23:59:59.999Z'
  ||!Array.isArray(a.rows)||a.rows.length>4)return false;
 if(!a.rows.every(row=>yieldExact(row,['at','valueNanos','percentNanos','nominalNanos'])&&yieldTime(row.at)!==null&&yieldTime(row.at)>=yieldTime(a.from)&&yieldTime(row.at)<=yieldTime(a.to)
  &&[row.valueNanos,row.percentNanos,row.nominalNanos].every(nullableNano))||new Set(a.rows.map(row=>yieldDay(row.at))).size!==a.rows.length)return false;
 return true;
}
function sameYieldModel(actual,expected){
 if(expected.state!=='ready')return JSON.stringify(actual)===JSON.stringify(expected);
 if(!yieldExact(actual,Object.keys(expected)))return false;
 // Math log/exp residuals vary by a few ULPs between supported JS engines.
 // Monetary inputs, cash flows, dates, direction and the closed shape stay exact.
 const numeric=['effectiveAnnualRate','relativePriceResidual','iterations'];
 if(Object.keys(expected).some(k=>!numeric.includes(k)&&JSON.stringify(actual[k])!==JSON.stringify(expected[k])))return false;
 if(!Number.isFinite(actual.effectiveAnnualRate)||actual.effectiveAnnualRate<BOND_YIELD_LIMITS.minRate||actual.effectiveAnnualRate>BOND_YIELD_LIMITS.maxRate
  ||Math.abs(actual.effectiveAnnualRate-expected.effectiveAnnualRate)>1e-12*Math.max(1,Math.abs(expected.effectiveAnnualRate)))return false;
 if(!Number.isFinite(actual.relativePriceResidual)||actual.relativePriceResidual<0||actual.relativePriceResidual>BOND_YIELD_LIMITS.relativeResidual
  ||Math.abs(actual.relativePriceResidual-expected.relativePriceResidual)>1e-12)return false;
 if(!Number.isInteger(actual.iterations)||actual.iterations<0||actual.iterations>100||Math.abs(actual.iterations-expected.iterations)>1)return false;
 if(expected.direction===0)return actual.effectiveAnnualRate===0&&actual.relativePriceResidual===0&&actual.iterations===0;
 return actual.effectiveAnnualRate===0||Math.sign(actual.effectiveAnnualRate)===expected.direction;
}
export function validBondYield(v,selection,binding=null){
 if(!yieldExact(v,['contractVersion','selection','contextKey','readMode','state','reason','range','evaluatedAt','catalog','record','sourceDigest','source','model'])
  ||v.contractVersion!==BOND_YIELD_VERSION||!bondScheduleSelection(selection)||!sameBondScheduleSelection(v.selection,selection)||!yieldHash(v.contextKey)||binding!==null&&v.contextKey!==binding
  ||!['saved-only','explicit-refresh'].includes(v.readMode)||!['unsupported','missing','invalid','fresh','stale'].includes(v.state)||!bondScheduleTime(v.evaluatedAt)
  ||!yieldExact(v.catalog,['capturedAt','expiresAt'])||!bondScheduleTime(v.catalog.capturedAt)||!bondScheduleTime(v.catalog.expiresAt)||v.catalog.capturedAt>v.evaluatedAt||v.catalog.expiresAt<v.catalog.capturedAt
  ||JSON.stringify(v.source)!==JSON.stringify(BOND_YIELD_SOURCE))return false;
 if(v.state==='unsupported')return typeof v.reason==='string'&&v.reason.length<=200&&v.range===null&&v.record===null&&v.sourceDigest===null&&v.model===null&&v.readMode==='saved-only';
 if(v.reason!==null||!validBondScheduleRange(v.range))return false;
 if(['missing','invalid'].includes(v.state))return v.record===null&&v.sourceDigest===null&&v.model===null&&v.readMode==='saved-only';
 if(!yieldHash(v.sourceDigest)||!validBondYieldRecord(v.record,selection,v.contextKey,v.evaluatedAt)||JSON.stringify(v.record.catalog)!==JSON.stringify(v.catalog)
  ||v.record.schedule.range.from!==v.range.from||v.record.schedule.range.to!==v.range.to||(v.state==='stale')!==(Date.parse(v.record.capturedAt)+BOND_YIELD_LIMITS.ttlMs<=Date.parse(v.evaluatedAt)))return false;
 try{return sameYieldModel(v.model,calculateBondYield(v.record));}catch{return false;}
}
