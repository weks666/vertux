const NANO=1000000000n,MAX_MONEY=9223372036854775807999999999n;
const messages={
 unsupported:'Для этого источника единицы цены облигации не подтверждены.',
 scope:'Контекст кабинета изменился. Перезагрузите его перед расчётом.',
 historical:'Для исторической цены нужны номинал и НКД на ту же дату. Вернитесь к последним свечам.',
 adjusted:'Для расчёта нужна цена без корректировки графика.',
 quote:'Последняя свеча недоступна или её обновление задерживается. Дождитесь обновления либо введите цену самостоятельно.',
 price:'Укажите положительную цену в процентах номинала, не более 9 знаков после запятой.',
 lots:'Укажите целое число лотов от 1 до 1 000 000.',
 lot:'Источник не передал проверенный размер лота.',
 terms:'Нужны проверенные условия выпуска. Обновите каталог инструментов.',
 nominal:'Нужен положительный номинал из каталога.',
 accrued:'НКД отсутствует или не прошёл проверку. Нулевой НКД допустим, если его передал источник.',
 currency:'Нужны подтверждённые валюты номинала, НКД и расчётов.',
 currency_mismatch:'Валюты номинала, НКД и расчётов различаются. Без подтверждённой конвертации сумма неизвестна.'
};
export function bondPricePercentNanos(value){
 if(typeof value!=='string'||value.length>64)return null;
 const match=/^\+?(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d{1,2}))?$/u.exec(value.trim());
 if(!match)return null;
 let digits=(match[1]+(match[2]||'')).replace(/^0+/u,'')||'0',scale=(match[2]||'').length-Number(match[3]||0);
 while(scale>0&&digits.endsWith('0')){digits=digits.slice(0,-1);scale--;}
 if(scale<0){if(digits.length-scale>19)return null;digits+='0'.repeat(-scale);scale=0;}
 if(scale>9||digits.length-scale>19||digits.length>28)return null;
 const result=BigInt(digits||'0')*10n**BigInt(9-scale);
 return result>0n?result.toString():null;
}
const money=value=>value?.state==='present'&&typeof value.amountNanos==='string'&&/^\d{1,28}$/u.test(value.amountNanos)&&BigInt(value.amountNanos)<=MAX_MONEY?BigInt(value.amountNanos):null;
const currency=value=>typeof value==='string'&&/^[A-Za-z]{3}$/u.test(value)?value.toUpperCase():null;
/** Local arithmetic for a draft only. No settlement quote, FX, rights or broker calls. */
export function estimateBondOrder({instrument={},pricePercent,lots,priceKind='manual',context={}}={}){
 const stop=code=>({state:'unavailable',code,reason:messages[code],execution:'none',quantity:null,cleanAmountNanos:null,accruedAmountNanos:null,totalAmountNanos:null,currency:null});
 if(context.blocked===true)return stop('scope');
 if(context.replay===true||context.history===true)return stop('historical');
 if(priceKind==='chart'&&context.adjusted===true)return stop('adjusted');
 if(priceKind==='chart'&&(context.state!=='ready'||context.stale===true))return stop('quote');
 if(instrument.assetType!=='bond'||instrument.priceUnit!=='percent-of-nominal')return stop('unsupported');
 const price=bondPricePercentNanos(pricePercent);if(price===null)return stop('price');
 const countNanos=bondPricePercentNanos(lots);
 if(countNanos===null||BigInt(countNanos)%NANO!==0n||BigInt(countNanos)>1000000n*NANO)return stop('lots');
 const count=BigInt(countNanos)/NANO;
 if(!Number.isSafeInteger(instrument.lot)||instrument.lot<=0)return stop('lot');
 const terms=instrument.bondIssueTerms;if(terms?.contractVersion!=='bond-issue-terms-v1')return stop('terms');
 const nominal=money(terms.nominal),accrued=money(terms.accruedInterest);
 if(nominal===null||nominal<=0n)return stop('nominal');if(accrued===null)return stop('accrued');
 const nominalCurrency=currency(terms.nominal.currency),accruedCurrency=currency(terms.accruedInterest.currency),settlementCurrency=currency(instrument.currency);
 if(!nominalCurrency||!accruedCurrency||!settlementCurrency)return stop('currency');
 if(nominalCurrency!==accruedCurrency||nominalCurrency!==settlementCurrency)return stop('currency_mismatch');
 const quantity=count*BigInt(instrument.lot),divisor=100n*NANO;
 // Multiply the whole requested quantity before rounding once to 1 nanounit.
 const numerator=BigInt(price)*nominal*quantity,clean=(numerator+divisor/2n)/divisor,aci=accrued*quantity;
 return {state:'ready',code:null,reason:null,execution:'none',quantity:quantity.toString(),pricePercentNanos:price,nominalNanos:nominal.toString(),accruedPerUnitNanos:accrued.toString(),
  cleanAmountNanos:clean.toString(),accruedAmountNanos:aci.toString(),totalAmountNanos:(clean+aci).toString(),currency:nominalCurrency,rounding:'nearest-nanounit-half-up-on-total',catalogAsOf:null};
}
