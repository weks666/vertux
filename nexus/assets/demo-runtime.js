import { runtimeAdapter as fixture } from './runtime.js';
const clone=value=>structuredClone(value);
const names={'fixture-share-sber':['SBER','Сбербанк'],'fixture-share-yndx':['YDEX','Яндекс'],'fixture-share-lkoh':['LKOH','Лукойл'],'fixture-share-gazp':['GAZP','Газпром'],'fixture-future-si-9-26':['Si-9.26','Фьючерс USD/RUB']};
const preferences={textSize:'standard',density:'comfortable',language:'ru',displayCurrency:'RUB',digestEnabled:false,digestTime:'09:00',autoEvents:true,nativeNotifications:false};
const displayFx={baseCurrency:'RUB',availableCurrencies:['RUB','USD'],rates:{USD:{rateNanos:'90000000000',date:'2026-08-12',source:'fixture'}}};
const catalog=Object.entries(names).map(([instrumentUid,[ticker,name]])=>({instrumentUid,ticker,name,assetType:ticker.startsWith('Si')?'future':'share',currency:'RUB',lot:['SBER','GAZP'].includes(ticker)?10:1,inPortfolio:true}));
const plans=[{id:'demo-plan-sber',instrumentUid:'fixture-share-sber',ticker:'SBER',name:'Сбербанк',direction:'long',allocationPpm:120000,positionAmountNanos:'150900000000000',entryPriceNanos:'301000000000',exitPriceNanos:'318000000000',priceCurrency:'RUB',expectedHold:'3–7 торговых дней',note:'Проверить отчётность и объём торгов.'},{id:'demo-plan-si',instrumentUid:'fixture-future-si-9-26',ticker:'Si-9.26',name:'Фьючерс USD/RUB',direction:'short',allocationPpm:50000,positionAmountNanos:'62875000000000',entryPriceNanos:'99600000000000',exitPriceNanos:'98200000000000',priceCurrency:'PTS',expectedHold:'1–2 торговых дня',note:'Сценарий возврата к среднему диапазону.'}];
function enrich(value){if(!value||typeof value!=='object')return value;for(const item of Object.values(value))enrich(item);if(names[value.instrumentUid]){const [ticker,name]=names[value.instrumentUid];if('name'in value)value.name=name;if('ticker'in value)value.ticker=ticker;}return value;}
async function request(path,options={}){
 const url=new URL(path,'https://demo.invalid'),p=url.pathname,method=(options.method||'GET').toUpperCase();
 if(p==='/api/latency/paint')return {accepted:false,simulated:true};
 if(!['GET','HEAD'].includes(method))throw Object.assign(new Error('Демонстрация доступна только для просмотра.'),{code:'DEMO_READ_ONLY'});
 if(p==='/api/bootstrap'){
  const data=enrich(await fixture.request(path,options));
  data.capabilities={...data.capabilities,tradingPlan:true,marketCalendar:true,marketStream:false};
  data.preview={...data.preview,interactiveTutorial:true,readOnly:true,stream:'none'};data.displayFx=clone(displayFx);
  data.quality.source='Демо';data.quality.connector='Локальный пример';data.quality.note='Вымышленный портфель, без подключения к брокеру.';
  return data;
 }
 if(p==='/api/ai/company-facts')return {
  title:'Пример финансовых показателей',dataAsOf:'2026-06-30T12:00:00Z',llmUsed:false,
  metrics:[['revenueTtm','Выручка',8240000000000,'RUB'],['netIncomeTtm','Чистая прибыль',942000000000,'RUB'],['marketCapitalization','Капитализация',3507000000000,'RUB'],['totalDebtMrq','Совокупный долг',3840000000000,'RUB'],['computedNetMarginTtm','Чистая рентабельность',11.43,'percent'],['peRatioTtm','P/E',3.72,'ratio'],['freeCashFlowTtm','Свободный денежный поток',518000000000,'RUB'],['totalDebtToEquityMrq','Долг / капитал',.42,'ratio'],['roe','Рентабельность капитала',13.1,'percent'],['roa','Рентабельность активов',7.8,'percent']].map(([key,label,value,unit])=>({key,label,value,unit,period:'TTM',sourceIds:['website-example'],status:'available'})),
  sources:[{id:'website-example',title:'Вымышленные показатели для просмотра интерфейса',asOf:'2026-06-30T12:00:00Z'}],
  limitations:['Эти значения не относятся к отчётности выбранного эмитента.'],sections:[]};
 if(p==='/api/market/preferences'||p==='/api/calendar/settings')return clone(preferences);
 if(p==='/api/market/catalog')return {items:clone(catalog),fixture:true,stale:false};
 if(p==='/api/trading-plan')return {persistence:'none',execution:'none',items:clone(plans)};
 if(p==='/api/calendar/due')return {nativeAvailable:false,reminders:[]};
 if(p==='/api/alerts')return {rules:[{id:'demo-price-level',symbol:'SBER',instrumentUid:'fixture-share-sber',targetPrice:318,condition:'above',note:'Пересмотреть сценарий',enabled:true}],events:[],enabled:false};
 if(p==='/api/calendar'){
  const month=url.searchParams.get('month')||new Date().toISOString().slice(0,7);
  const events=[['report','SBER','18','Отчётность за полугодие'],['dividend','LKOH','22','Дата закрытия реестра'],['expiration','Si-9.26','24','Экспирация фьючерса'],['report','YDEX','25','Операционные результаты'],['report','GAZP','28','Обзор финансовых результатов']].map(([type,ticker,day,title],i)=>({id:'demo-event-'+i,type,date:month+'-'+day,instrumentUid:catalog.find(a=>a.ticker===ticker)?.instrumentUid,ticker,title,inPortfolio:true,source:'Вымышленный пример'}));
  const reminders=[{id:'demo-review',title:'Проверить баланс портфеля',note:'Сверить доли активов и план на неделю',dueAt:month+'-23T09:00:00+03:00',status:'pending',enabled:true}];
  return {fixture:true,events,upcoming:events,reminders,preferences:clone(preferences),nativeAvailable:false,warnings:[],coverage:{scope:'portfolio',instruments:5,pending:0,stale:0,note:'Вымышленные даты для демонстрации.'}};
 }
 if(p==='/api/market/participants'){
  const rows=Array.from({length:60},(_,i)=>{const net=Math.round(31500+i*145+Math.sin(i*.35)*2300),long=128460+(i-59)*190,short=long-net;return {time:new Date(Date.UTC(2026,7,12,5,5*i)).toISOString(),FIZ:{long,short,net,longParticipants:24182,shortParticipants:16904},YUR:{long:92180,short:92180+net,net:-net,longParticipants:842,shortParticipants:1106}};});
  return {state:'ready',ticker:'Si',fixture:true,items:rows,latest:rows.at(-1),partial:false,stale:false};
 }
 if(p==='/api/market/news')return {items:[],fixture:true,unavailable:false,hasMore:false,coverage:'В примере показаны события по активам.'};
 if(p==='/api/market/candles'){const data=await fixture.request('/api/bootstrap');return {data:clone(data.candles||[]),fixture:true};}
 return fixture.request(path,options);
}
export const runtimeAdapter=Object.freeze({...fixture,request,startMarketStream:()=>Object.freeze({close(){},simulated:true}),downloadOperationsCsv(){},downloadStatisticsPercentCsv(){}});
