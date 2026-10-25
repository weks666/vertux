import {validBondYield} from './bond-yield-contract.js';
import {calculateBondYield,BOND_YIELD_LIMITS} from './bond-yield-model.js';
export const BOND_SENSITIVITY_LIMITS=Object.freeze({minBp:-200,maxBp:200,stepBp:1,defaultBp:100});
export const BOND_SENSITIVITY_SOURCES=Object.freeze({duration:'https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/yield-based-bond-duration-measures-and-properties',convexity:'https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/yield-based-bond-convexity-and-portfolio-properties'});
const absent=(code,reason)=>Object.freeze({state:'unavailable',code,reason});
/** Prepare once from the closed, source-bound YTM response. No response fields are trusted without recomputation. */
export function prepareBondSensitivity(response,selection){
 try{
  if(!validBondYield(response,selection))return absent('input','Исходный расчёт не прошёл проверку. Перечитайте данные облигации.');
  if(response.model?.state!=='ready')return absent('yield','Для сценария нужна рассчитанная доходность и проверенные выплаты.');
  const model=calculateBondYield(response.record),rate=model.effectiveAnnualRate,annual=1+rate;
  const terms=model.flows.filter(row=>BigInt(row.amountNanos)>0n).map(row=>({years:row.days/365,log:Math.log(Number(row.amountNanos))-row.days/365*Math.log1p(rate)}));
  const peak=Math.max(...terms.map(row=>row.log)),total=terms.reduce((sum,row)=>sum+Math.exp(row.log-peak),0);
  const weights=terms.map(row=>({years:row.years,weight:Math.exp(row.log-peak)/total}));
  const macaulayYears=weights.reduce((sum,row)=>sum+row.weight*row.years,0),modifiedDurationYears=macaulayYears/annual;
  const convexityYearsSquared=weights.reduce((sum,row)=>sum+row.weight*row.years*(row.years+1),0)/(annual*annual);
  const dirtyPrice=Number(model.dirtyPrice.numerator)/Number(model.dirtyPrice.denominator)/1e9;
  if(![macaulayYears,modifiedDurationYears,convexityYearsSquared,dirtyPrice].every(v=>Number.isFinite(v)&&v>0))return absent('precision','Чувствительность не рассчитана: численные значения вышли за поддерживаемый диапазон.');
  function scenario(bp){
   if(!Number.isInteger(bp)||bp<BOND_SENSITIVITY_LIMITS.minBp||bp>BOND_SENSITIVITY_LIMITS.maxBp)return absent('shock','Задайте целый сдвиг от −200 до +200 базисных пунктов.');
   const delta=bp/10000,shiftedRate=rate+delta;
   if(shiftedRate<BOND_YIELD_LIMITS.minRate||shiftedRate>BOND_YIELD_LIMITS.maxRate)return absent('rate','Сдвиг вывел YTM за диапазон модели: от −99,9999 % до 10 000 % годовых.');
   // The ratio is anchored to the observed dirty price. At zero shock it is exactly one.
   // expm1/log1p retain small changes without subtracting two nearly equal present values.
   const change=bp===0?0:weights.reduce((sum,row)=>sum+row.weight*Math.expm1(-row.years*Math.log1p(delta/annual)),0);
   const price=dirtyPrice*(1+change),moneyChange=dirtyPrice*change,linearChange=-modifiedDurationYears*delta,quadraticChange=linearChange+0.5*convexityYearsSquared*delta*delta;
   if(![change,price,moneyChange,linearChange,quadraticChange].every(Number.isFinite)||price<=0)return absent('precision','Сценарий выходит за численный диапазон. Цена и изменение не показаны.');
   return Object.freeze({state:'ready',bp,shiftedRate,dirtyPrice:price,moneyChange,relativeChange:change,linearChange:bp===0?0:linearChange,quadraticChange:bp===0?0:quadraticChange});
  }
  return Object.freeze({state:'ready',valuationDate:model.valuationDate,capturedAt:response.record.capturedAt,currency:model.currency,rate,dirtyPrice,macaulayYears,modifiedDurationYears,convexityYearsSquared,dayCount:model.dayCount,compounding:model.compounding,cashflowAssumption:model.cashflowAssumption,costs:model.costs,settlementEntitlementVerified:false,scenario});
 }catch{return absent('input','Исходный расчёт не прошёл проверку. Перечитайте данные облигации.');}
}
const number=(value,digits)=>new Intl.NumberFormat('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:digits}).format(Math.abs(value));
export function sensitivityNumber(value,{digits=4,signed=false,unit=''}={}){
 if(!Number.isFinite(value))return 'Не рассчитано';
 const suffix=unit?' '+unit:'',sign=value<0?'−':signed&&value>0?'+':'';
 if(value===0)return '0'+suffix;
 if(Math.abs(value)<10**(-digits))return sign+'менее '+new Intl.NumberFormat('ru-RU',{maximumFractionDigits:digits}).format(10**(-digits))+suffix;
 return '≈ '+sign+number(value,digits)+suffix;
}
export const sensitivityPercent=value=>sensitivityNumber(value*100,{digits:4,signed:true,unit:'%'});
export const sensitivityMoney=(value,currency,signed=false)=>sensitivityNumber(value,{digits:2,signed,unit:currency});
