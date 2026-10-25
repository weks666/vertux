import {basisNanos,basisTime} from './futures-basis-contract.js';
export const BOND_YIELD_VERSION='bond-yield-v1';
export const BOND_YIELD_LIMITS=Object.freeze({sourceBytes:2097152,totalBytes:8388608,recordBytes:4194304,ttlMs:60000,quoteAgeMs:300000,batchMs:60000,minRate:-0.999999,maxRate:100,relativeResidual:1e-10});
export const BOND_YIELD_REASONS=Object.freeze({
 'catalog-old':'На момент расчёта каталог устарел. Обновите каталог и повторите расчёт.',
 'catalog-day':'Условия выпуска и цена относятся к разным датам UTC. Нужен каталог на дату цены.',
 'terms-missing':'Номинал, срок и явные признаки типа выпуска должны быть подтверждены источником.',
 'terms-unsupported':'Эта модель рассчитана на конечные выпуски без плавающего купона, амортизации и субординации.',
 'currency':'Номинал, расчёты и все выплаты должны иметь одну подтверждённую валюту. FX не применяется.',
 'nominal':'Текущий и первоначальный номиналы различаются либо не подтверждены положительными суммами.',
 'quote-missing':'Источник не передал цену с проверенным временем.',
 'quote-type':'Нужна положительная цена последней биржевой сделки. Дилерская цена не используется.',
 'quote-future':'Время цены позже получения ответа.',
 'quote-old':'На момент получения цена была старше пяти минут.',
 'batch':'Ответы получены дольше чем за минуту или перешли границу даты UTC. Обновите расчёт.',
 'accrued-missing':'Для даты цены нет единственной строки с НКД, процентом и номиналом.',
 'accrued-date':'Дата НКД не совпадает с датой цены либо строка ещё не наступила.',
 'accrued-nominal':'Номинал строки НКД не совпадает с условиями выпуска.',
 'accrued-value':'НКД отрицателен или его сумма не согласуется с процентом от номинала.',
 'matured':'На дату расчёта погашение уже наступило либо срок не определён.',
 'lifecycle':'Оферты, конвертации, частичные погашения или признаки дефолта требуют другой модели.',
 'principal':'Нужна одна явная будущая выплата полного номинала на дату погашения.',
 'coupons-missing':'Нет проверенной цепочки известных купонов до погашения. Пропущенные суммы не достраиваются.',
 'coupon-type':'Не все будущие купоны имеют известную фиксированную сумму и подходящий тип.',
 'coupon-chain':'Периоды или номера купонов прерываются, пересекаются либо не доходят до погашения.',
 'entitlement':'Ближайшая выплата уже прошла дату фиксации или её период закончился. Право на неё требует отдельной проверки.',
 'accrued-coupon':'НКД превышает ближайший известный купон. Условия расчёта не согласованы.',
 'root-range':'Решение находится за пределами поддерживаемого диапазона от −99,9999 % до 10 000 % годовых.',
 'precision':'Численная проверка цены не достигла требуемой точности. Доходность не показана.',
});
export const yieldNanos=basisNanos,yieldTime=basisTime;
export const yieldDay=value=>{const at=basisTime(value);return at===null?null:new Date(Number(at/1000000n)).toISOString().slice(0,10);};
const D=86400000,N=1000000000n,DIV=100n*N,abs=n=>n<0n?-n:n;
const elapsed=(left,right)=>Number((basisTime(left)-basisTime(right))/1000000n);
const amount=value=>basisNanos(value);
const days=(from,to)=>(Date.parse(to+'T00:00:00.000Z')-Date.parse(from+'T00:00:00.000Z'))/D;
function solve(flows,priceNumerator,priceDenominator){
 const total=flows.reduce((sum,row)=>sum+BigInt(row.amountNanos),0n),difference=total*priceDenominator-priceNumerator,direction=difference===0n?0:difference>0n?1:-1;
 if(direction===0)return {rate:0,direction:0,relativePriceResidual:0,iterations:0};
 const logs=flows.filter(row=>BigInt(row.amountNanos)>0n).map(row=>({log:Math.log(Number(BigInt(row.amountNanos)*priceDenominator))-Math.log(Number(priceNumerator)),years:row.days/365}));
 const value=u=>{const terms=logs.map(row=>row.log-row.years*u),peak=Math.max(...terms);return peak+Math.log(terms.reduce((sum,v)=>sum+Math.exp(v-peak),0));};
 let lo=Math.log1p(BOND_YIELD_LIMITS.minRate),hi=Math.log1p(BOND_YIELD_LIMITS.maxRate);
 if(value(lo)<0||value(hi)>0)return null;
 let mid=0,iteration=0;for(;iteration<100;iteration++){mid=(lo+hi)/2;const v=value(mid);if(v>0)lo=mid;else hi=mid;if(hi-lo<=1e-14)break;}
 const candidates=[lo,hi,(lo+hi)/2].map(u=>({u,error:Math.abs(Math.expm1(value(u)))})).sort((a,b)=>a.error-b.error),best=candidates[0];
 if(!Number.isFinite(best.error)||best.error>BOND_YIELD_LIMITS.relativeResidual)return {precision:false};
 let rate=Math.expm1(best.u);if(rate*direction<0||Math.abs(rate)<1e-13)rate=0;
 return {rate,direction,relativePriceResidual:best.error,iterations:iteration+1};
}
/** Only validated records enter this model. All amounts are per one bond. */
export function calculateBondYield(record){
 const stop=code=>({state:'unavailable',code,reason:BOND_YIELD_REASONS[code]});
 const {terms,quote,accrued,schedule,catalog,startedAt,capturedAt}=record;
 if(catalog.expiresAt<=capturedAt)return stop('catalog-old');
 if(terms.priceUnit!=='percent-of-nominal'||terms.flags.some(v=>v===null)||!terms.placementAt||!terms.maturityAt||terms.couponPaymentsPerYear===null)return stop('terms-missing');
 if(terms.flags.some(v=>v===true))return stop('terms-unsupported');
 if(!terms.currency||terms.nominalCurrency!==terms.currency||terms.initialNominalCurrency!==terms.currency)return stop('currency');
 const nominal=amount(terms.nominalNanos),initial=amount(terms.initialNominalNanos);
 if(nominal===null||nominal<=0n||initial!==nominal)return stop('nominal');
 if(quote.at===null||quote.priceNanos===null||quote.kind==='missing')return stop('quote-missing');
 if(quote.kind!=='exchange'||amount(quote.priceNanos)<=0n)return stop('quote-type');
 if(basisTime(quote.at)>basisTime(quote.receivedAt))return stop('quote-future');
 if(basisTime(quote.receivedAt)-basisTime(quote.at)>BigInt(BOND_YIELD_LIMITS.quoteAgeMs)*1000000n)return stop('quote-old');
 const date=yieldDay(quote.at),maturity=yieldDay(terms.maturityAt);
 if(yieldDay(catalog.capturedAt)!==date)return stop('catalog-day');
 if(elapsed(capturedAt,startedAt)>BOND_YIELD_LIMITS.batchMs||yieldDay(startedAt)!==date||yieldDay(capturedAt)!==date)return stop('batch');
 if(!maturity||maturity<=date||yieldDay(terms.placementAt)>date)return stop('matured');
 if(accrued.rows.length!==1||['valueNanos','percentNanos','nominalNanos'].some(k=>accrued.rows[0][k]===null))return stop('accrued-missing');
 const aci=accrued.rows[0],value=BigInt(aci.valueNanos),percent=BigInt(aci.percentNanos);
 if(yieldDay(aci.at)!==date||basisTime(aci.at)>basisTime(accrued.receivedAt))return stop('accrued-date');
 if(BigInt(aci.nominalNanos)!==nominal)return stop('accrued-nominal');
 // Two independently rounded 9-decimal quotations may each differ by half a nanounit.
 if(value<0n||percent<0n||abs(value*DIV-percent*nominal)>(DIV+nominal+1n)/2n)return stop('accrued-value');
 const rows=schedule.events;
 if(rows.some(row=>['offer','conversion'].includes(row.kind)||row.defaultAt||row.kind==='maturity'&&!row.fullRedemption))return stop('lifecycle');
 const principals=rows.filter(row=>row.kind==='maturity');
 if(principals.length!==1)return stop('principal');
 const principal=principals[0];
 if(principal.amountNanos!==nominal.toString()||principal.currency!==terms.currency||yieldDay(principal.eventAt)!==maturity||yieldDay(principal.paymentAt)!==maturity||principal.executionAt!==null||principal.execution!=='')return stop('principal');
 const allCoupons=rows.filter(row=>row.kind==='coupon'),coupons=allCoupons.filter(row=>yieldDay(row.paymentAt)>date).sort((a,b)=>a.paymentAt.localeCompare(b.paymentAt)||a.id.localeCompare(b.id));
 if(terms.couponPaymentsPerYear===0){if(allCoupons.length||value!==0n)return stop('coupons-missing');}
 else{
  if(!coupons.length)return stop('coupons-missing');
  if(coupons.some(row=>row.amountNanos===null||!['Постоянный','Фиксированный'].includes(row.couponType)))return stop('coupon-type');
  if(coupons.some(row=>row.currency!==terms.currency))return stop('currency');
  if(coupons.some(row=>!row.couponStartAt||!row.couponEndAt||yieldDay(row.couponStartAt)>=yieldDay(row.couponEndAt)||yieldDay(row.paymentAt)<yieldDay(row.couponEndAt)||yieldDay(row.paymentAt)>maturity))return stop('coupon-chain');
  if(yieldDay(coupons[0].couponStartAt)>date||yieldDay(coupons.at(-1).couponEndAt)!==maturity)return stop('coupon-chain');
  if(coupons.some((row,i)=>i>0&&(yieldDay(row.couponStartAt)!==yieldDay(coupons[i-1].couponEndAt)||BigInt(row.number)!==BigInt(coupons[i-1].number)+1n)))return stop('coupon-chain');
  if(yieldDay(coupons[0].couponEndAt)<=date||coupons.some(row=>row.recordAt&&yieldDay(row.recordAt)<=date))return stop('entitlement');
  if(value>BigInt(coupons[0].amountNanos))return stop('accrued-coupon');
 }
 const flows=[...coupons.map(row=>({id:row.id,kind:'coupon',date:yieldDay(row.paymentAt),amountNanos:row.amountNanos})),{id:principal.id,kind:'principal',date:maturity,amountNanos:principal.amountNanos}]
  .sort((a,b)=>a.date.localeCompare(b.date)||a.kind.localeCompare(b.kind)||a.id.localeCompare(b.id)).map(row=>({...row,days:days(date,row.date)}));
 const clean=BigInt(quote.priceNanos)*nominal,dirty=clean+value*DIV,root=solve(flows,dirty,DIV);
 if(root===null)return stop('root-range');if(root.precision===false)return stop('precision');
 return {state:'ready',code:null,reason:null,valuationDate:date,maturityDate:maturity,currency:terms.currency,
  nominalNanos:nominal.toString(),cleanPrice:{numerator:clean.toString(),denominator:DIV.toString()},accruedNanos:value.toString(),dirtyPrice:{numerator:dirty.toString(),denominator:DIV.toString()},
  couponTotalNanos:coupons.reduce((sum,row)=>sum+BigInt(row.amountNanos),0n).toString(),principalNanos:principal.amountNanos,flows,
  effectiveAnnualRate:root.rate,direction:root.direction,relativePriceResidual:root.relativePriceResidual,iterations:root.iterations,
  dayCount:'ACT/365',compounding:'effective-annual',costs:'gross-no-tax-fee-fx',cashflowAssumption:'recorded-full-payments-at-stated-dates',settlementEntitlementVerified:false};
}
export function bondYieldPercent(result){
 if(result.direction===0)return '0 %';
 const percent=result.effectiveAnnualRate*100,sign=result.direction<0?'−':'+';
 if(Math.abs(percent)<0.0001)return sign+'менее 0,0001 %';
 return '≈ '+new Intl.NumberFormat('ru-RU',{maximumFractionDigits:4,minimumFractionDigits:2}).format(percent).replace('-','−')+' %';
}
export function bondYieldMoney(value,currency=''){
 const numerator=typeof value==='string'?BigInt(value):BigInt(value.numerator),denominator=typeof value==='string'?1n:BigInt(value.denominator),negative=numerator<0n,n=abs(numerator),scale=denominator*N;
 const whole=n/scale,fraction=(n%scale*100n)/scale,remainder=n%scale*100n%scale;
 if(n>0n&&n*100n<scale)return (negative?'−':'')+'менее 0,01'+(currency?' '+currency:'');
 return (remainder?'≈ ':'')+(negative?'−':'')+whole.toString().replace(/\B(?=(\d{3})+(?!\d))/gu,' ')+','+fraction.toString().padStart(2,'0')+(currency?' '+currency:'');
}
