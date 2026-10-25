export function applyLastQuote(current={},quote={}){
 const eventTime=Date.parse(quote.sourceEventTime)/1000;
 if(!Number.isFinite(quote.price)||!Number.isFinite(eventTime)||eventTime<(current.lastTradeTime??current.lastTime??0))return current;
 const day=t=>new Date((t+10800)*1000).toISOString().slice(0,10);
 const base=Number.isFinite(current.lastTime)?day(eventTime)===day(current.lastTime)?current.previousClose:current.dayClose:null;
 return {...current,lastTradeTime:eventTime,price:quote.price,change:Number.isFinite(base)?quote.price-base:null,percent:base>0?(quote.price/base-1)*100:null,
  title:'Последняя сделка · '+new Date(quote.sourceEventTime).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})+' мск'+(quote.stale?' · сохранённая котировка':'')+(Number.isFinite(current.volume)?' · Объём из дневной свечи':'')};
}
