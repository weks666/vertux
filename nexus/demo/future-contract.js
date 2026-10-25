import {decimalNanos} from './number-format.js';
const NANO=1000000000n,MAX_MONEY=9223372036854775807999999999n;
const currency=value=>typeof value==='string'&&/^[A-Za-z]{3}$/u.test(value)?value.toUpperCase():null;
const valueOf=item=>item?.state==='present'&&typeof item.amountNanos==='string'&&/^\d{1,28}$/u.test(item.amountNanos)&&BigInt(item.amountNanos)<=MAX_MONEY?BigInt(item.amountNanos):null;
const termsOf=meta=>meta.futureContractTerms?.contractVersion==='future-contract-terms-v1'?meta.futureContractTerms:null;
export function futurePriceNanos(value){
 if(typeof value!=='string'||value.length>64)return null;
 const match=/^\+?(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d{1,2}))?$/u.exec(value.trim());if(!match)return null;
 let digits=(match[1]+(match[2]||'')).replace(/^0+/u,'')||'0',scale=(match[2]||'').length-Number(match[3]||0);
 while(scale>0&&digits.endsWith('0')){digits=digits.slice(0,-1);scale--;}
 if(scale<0){if(digits.length-scale>19)return null;digits+='0'.repeat(-scale);scale=0;}
 if(scale>9||digits.length-scale>19||digits.length>28)return null;
 const valueNanos=BigInt(digits||'0')*10n**BigInt(9-scale);
 return valueNanos>0n?valueNanos.toString():null;
}
export function futureCatalogNote(meta={}){
 const source=meta.futureContractSource,at=source?.kind==='catalog'&&typeof source.capturedAt==='string'&&Number.isFinite(Date.parse(source.capturedAt))?new Date(source.capturedAt).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'}):null;
 return (at?'Каталог сохранён: '+at+' МСК.':'Дата сохранения каталога неизвестна.')+(source?.stale===true?' Срок обновления каталога истёк.':'')+' Время действия стоимости шага и ГО источник не указал; эти параметры могут изменяться в течение дня.';
}
export function futureContractFields(meta={}){
 const legacy=!Object.hasOwn(meta,'futureContractTerms'),terms=termsOf(meta)||(legacy?{step:{state:meta.minPriceIncrementNanos==null?'absent':'present',amountNanos:meta.minPriceIncrementNanos},stepAmount:{state:'absent'},marginBuy:{state:'absent'},marginSell:{state:'absent'}}:null),settlement=currency(meta.currency);
 const display=(item,unit,{positive=false,money=false}={})=>{
  if(!terms||item?.state==='absent')return 'Источник не передал';
  const amount=valueOf(item);if(amount===null||positive&&amount<=0n)return 'Данные не прошли проверку';
  const own=money?currency(item.currency):unit;
  return decimalNanos(amount.toString(),{digits:9})+(own?' '+own:money||unit===null?' · валюта не подтверждена':'');
 };
 return [['Валюта расчётов',settlement||'Источник не передал'],['Шаг цены',display(terms?.step,'п.',{positive:true})],
  ['Стоимость шага',display(terms?.stepAmount,settlement,{positive:true})],['ГО при покупке за контракт',display(terms?.marginBuy,null,{money:true})],['ГО при продаже за контракт',display(terms?.marginSell,null,{money:true})]];
}
const messages={
 scope:'Контекст кабинета изменился. Перезагрузите его перед расчётом.',
 historical:'Для исторической цены нужны условия контракта на ту же дату. Вернитесь к последним свечам.',
 adjusted:'Для расчёта нужна цена без корректировки графика.',
 quote:'Последняя свеча недоступна или её обновление задерживается. Дождитесь обновления либо введите цену самостоятельно.',
 unsupported:'Источник и единицы цены этого фьючерса не подтверждены.',
 price:'Укажите положительную цену в пунктах, не более 9 знаков после запятой.',
 lots:'Укажите целое число лотов от 1 до 1 000 000.',lot:'Источник не передал проверенный размер лота.',
 side:'Выберите покупку или продажу.',terms:'Нужны проверенные условия контракта. Обновите каталог инструментов.',
 step:'Нужны положительные шаг цены и стоимость шага из каталога.',currency:'Валюта расчётов не подтверждена.',
 price_step:'Цена должна быть кратна шагу цены из каталога.',margin:'ГО для выбранного направления отсутствует или не прошло проверку.',
 margin_currency:'Валюта ГО для выбранного направления не подтверждена.',stop:'Стоп и цель должны быть положительными, кратными шагу и находиться по разные стороны от цены.'
};
const missing=code=>({state:'unavailable',code,reason:messages[code],amountNanos:null,currency:null});
const ready=(amount,currency)=>({state:'ready',code:null,reason:null,amountNanos:amount.toString(),currency});
/** Saved-catalog scenario only: no execution, available-margin check, FX or settlement prediction. */
export function estimateFutureOrder({instrument={},pricePoints,lots,side='buy',priceKind='manual',context={},stopPoints=null,targetPoints=null}={}){
 const fail=code=>({state:'unavailable',code,reason:messages[code],execution:'none',quantity:null,notional:missing(code),margin:missing(code),stopRisk:missing(code)});
 if(context.blocked===true)return fail('scope');
 if(context.replay===true||context.history===true)return fail('historical');
 if(priceKind==='chart'&&context.adjusted===true)return fail('adjusted');
 if(priceKind==='chart'&&(context.state!=='ready'||context.stale===true))return fail('quote');
 if(instrument.assetType!=='future'||instrument.priceUnit!=='points'||instrument.instrumentOrigin?.provider!=='tinvest'||instrument.instrumentOrigin?.market!=='broker')return fail('unsupported');
 if(!['buy','sell'].includes(side))return fail('side');
 const priceRaw=futurePriceNanos(pricePoints);if(priceRaw===null)return fail('price');const price=BigInt(priceRaw);
 const countRaw=futurePriceNanos(lots);if(countRaw===null||BigInt(countRaw)%NANO!==0n||BigInt(countRaw)>1000000n*NANO)return fail('lots');
 if(!Number.isSafeInteger(instrument.lot)||instrument.lot<=0)return fail('lot');
 const quantity=BigInt(countRaw)/NANO*BigInt(instrument.lot),terms=termsOf(instrument);if(!terms)return fail('terms');
 const step=valueOf(terms.step),stepAmount=valueOf(terms.stepAmount),settlement=currency(instrument.currency);
 if(step!==null&&step>0n&&price%step!==0n)return fail('price_step');
 const convert=points=>(points*stepAmount*quantity+step/2n)/step;
 const notional=step===null||step<=0n||stepAmount===null||stepAmount<=0n?missing('step'):!settlement?missing('currency'):ready(convert(price),settlement);
 const marginField=side==='buy'?terms.marginBuy:terms.marginSell,marginAmount=valueOf(marginField),marginCurrency=currency(marginField?.currency);
 const margin=marginAmount===null?missing('margin'):!marginCurrency?missing('margin_currency'):ready(marginAmount*quantity,marginCurrency);
 let stopRisk=notional.state==='ready'?missing('stop'):missing(notional.code),rewardRiskNanos=null;
 if(stopPoints!==null&&notional.state==='ready'){
  const stopRaw=futurePriceNanos(stopPoints),targetRaw=futurePriceNanos(targetPoints),stop=stopRaw===null?null:BigInt(stopRaw),target=targetRaw===null?null:BigInt(targetRaw);
  const direction=side==='buy'?1n:-1n,distance=stop===null?null:(price-stop)*direction,reward=target===null?null:(target-price)*direction;
  if(distance!==null&&distance>0n&&reward!==null&&reward>0n&&stop%step===0n&&target%step===0n){stopRisk=ready(convert(distance),settlement);rewardRiskNanos=((reward*NANO+distance/2n)/distance).toString();}
 }
 return {state:notional.state==='ready'&&margin.state==='ready'?'ready':'partial',code:null,reason:null,execution:'none',side,quantity:quantity.toString(),pricePointsNanos:priceRaw,
  stepNanos:step?.toString()??null,stepAmountNanos:stepAmount?.toString()??null,notional,margin,stopRisk,rewardRiskNanos,
  rounding:'nearest-nanounit-half-up-on-total',termsAsOf:null,catalogCapturedAt:instrument.futureContractSource?.capturedAt??null};
}
