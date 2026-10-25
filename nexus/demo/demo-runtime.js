import { runtimeAdapter as fixture } from './runtime.js';
const clone=value=>structuredClone(value);
const names={'fixture-share-sber':['SBER','Сбербанк'],'fixture-share-yndx':['YDEX','Яндекс'],'fixture-share-lkoh':['LKOH','Лукойл'],'fixture-share-gazp':['GAZP','Газпром'],'fixture-future-si-9-26':['Si-9.26','Фьючерс USD/RUB']};
const preferences={textSize:'standard',density:'comfortable',language:'ru',displayCurrency:'RUB',digestEnabled:false,digestTime:'09:00',autoEvents:true,nativeNotifications:false};
const displayFx={baseCurrency:'RUB',availableCurrencies:['RUB','USD'],rates:{USD:{rateNanos:'90000000000',date:'2026-08-12',source:'fixture'}}};
const catalog=Object.entries(names).map(([instrumentUid,[ticker,name]])=>({instrumentUid,ticker,name,assetType:ticker.startsWith('Si')?'future':'share',currency:'RUB',lot:['SBER','GAZP'].includes(ticker)?10:1,inPortfolio:true,exchange:'Учебная площадка',sessionLabel:'Учебная сессия закрыта'}));
const plans=[
 {id:'demo-plan-sber',instrumentUid:'fixture-share-sber',plannedFor:'2026-08-19',action:'watch',status:'watching',entryPrice:'301',stopPrice:'294',targetPrice:'318',priceBasis:{unit:'money-per-unit',currency:'RUB',origin:'owner-declared'},note:'Учебный план: проверить отчётность и объём торгов.',planDetails:{schema:'plan-details-v1',direction:'long',horizonDays:7,thesis:'Вымышленный пример условий инвестиционной идеи.',lifecycle:'watching'}},
 {id:'demo-plan-si',instrumentUid:'fixture-future-si-9-26',plannedFor:'2026-08-14',action:'watch',status:'watching',entryPrice:'99600',stopPrice:'100300',targetPrice:'98200',priceBasis:{unit:'points',currency:null,origin:'owner-declared'},note:'Учебный план: сценарий возврата к среднему диапазону.',planDetails:{schema:'plan-details-v1',direction:'short',horizonDays:2,thesis:'Вымышленный пример фьючерсного плана; уровни заданы в пунктах.',lifecycle:'watching'}}
];
const aiSettings={revision:0,value:{localModel:null,personalModel:null,preferences:{style:'unspecified',experience:'unspecified',notes:''}}};
async function demoPlans(){
 const bootstrap=await fixture.request('/api/bootstrap'),items=[];
 for(const template of plans){
  const instrument=bootstrap.instruments?.find(item=>item.instrumentUid===template.instrumentUid&&item.portfolioId);
  if(!instrument)continue;
  const item={...clone(template),portfolioId:instrument.portfolioId};
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(item)));
  item.writeVersion=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');items.push(item);
 }
 // Keep the journal's DTO contract; this example never persists a draft.
 return {persistence:'local-drafts',execution:'none',fixture:true,readOnly:true,storage:'memory-example',items};
}
function enrich(value){if(!value||typeof value!=='object')return value;for(const item of Object.values(value))enrich(item);if(names[value.instrumentUid]){const [ticker,name]=names[value.instrumentUid];if('name'in value)value.name=name;if('ticker'in value)value.ticker=ticker;}return value;}
async function request(path,options={}){
 const url=new URL(path,'https://demo.invalid'),p=url.pathname,method=(options.method||'GET').toUpperCase();
 if(p==='/api/latency/paint')return {accepted:false,simulated:true};
 if(!['GET','HEAD'].includes(method))throw Object.assign(new Error('Демонстрация доступна только для просмотра.'),{code:'DEMO_READ_ONLY'});
 if(p==='/api/bootstrap'){
  const data=enrich(await fixture.request(path,options));
  data.capabilities={...data.capabilities,tradingPlan:true,marketCalendar:true,marketStream:false};
  data.preview={...data.preview,interactiveTutorial:true,websiteDemo:true,readOnly:true,stream:'none'};data.displayFx=clone(displayFx);
  data.quality.source='Демо';data.quality.connector='Локальный пример';data.quality.note='Вымышленный портфель, без подключения к брокеру.';
  return data;
 }
 if(p==='/api/nexus-ai/capabilities')return {configured:false,mode:'local',model:null,tools:[],fixture:true,readOnly:true};
 if(p==='/api/nexus-ai/conversations')return {items:[],nextCursor:null,fixture:true};
 if(p==='/api/nexus-ai/settings')return clone(aiSettings);
 if(p==='/api/nexus-ai/storage')return {contentBytes:0,currentConversations:0,previousConversations:0,previousDigest:null,fixture:true};
 if(p==='/api/nexus-ai/chatgpt-runtime')return {connected:false,models:[],defaultModel:null,fixture:true};
 if(p==='/api/nexus-ai/local-runtime')return {state:'unavailable',models:[],canStart:false,fixture:true};
 if(p==='/api/ai/company-facts')return {
  title:'Вымышленные финансовые показатели для просмотра интерфейса',dataAsOf:'2026-06-30T12:00:00Z',llmUsed:false,
  metrics:[
   ['revenueTtm','Выручка','8240000000000','RUB','TTM'],['netIncomeTtm','Чистая прибыль','942000000000','RUB','TTM'],['marketCapitalization','Капитализация','3507000000000','RUB','provider_current'],['totalDebtMrq','Совокупный долг','3840000000000','RUB','MRQ'],['computedNetMarginTtm','Чистая рентабельность','11.43','percent','TTM'],['peRatioTtm','P/E','3.72','ratio','TTM'],['freeCashFlowTtm','Свободный денежный поток','518000000000','RUB','TTM'],['totalDebtToEquityMrq','Долг / капитал','0.42','ratio','MRQ'],['roe','Рентабельность капитала','13.1','percent','FY'],['roa','Рентабельность активов','7.8','percent','FY'],
   ['sharesOutstanding','Акции в обращении','12000000000','shares','provider_current'],['ebitdaTtm','EBITDA','1450000000000','RUB','TTM'],['epsTtm','Прибыль на акцию','78.5','RUB/share','TTM'],['totalEnterpriseValueMrq','Стоимость предприятия','4000000000000','RUB','MRQ'],['priceToSalesTtm','P/S','0.4256','ratio','TTM'],['priceToBookTtm','P/B','0.49','ratio','TTM'],['priceToFreeCashFlowTtm','P/FCF','6.77','ratio','TTM'],['evToEbitdaMrq','EV/EBITDA','2.76','ratio','MRQ'],['netMarginMrq','Чистая маржа квартала','12.2','percent','MRQ'],['netDebtToEbitda','Чистый долг / EBITDA','1.7','ratio','provider_unspecified'],['currentRatioMrq','Текущая ликвидность','1.4','ratio','MRQ'],['dividendYieldDailyTtm','Дивидендная доходность','8.2','percent','TTM'],['dividendPayoutRatioFy','Доля прибыли на дивиденды','45','percent','FY'],['oneYearAnnualRevenueGrowthRate','Рост выручки за год','7.4','percent','1Y'],['threeYearAnnualRevenueGrowthRate','Средний рост выручки за 3 года','6.1','percent','3Y'],['fiveYearAnnualRevenueGrowthRate','Средний рост выручки за 5 лет','5.8','percent','5Y'],['computedEbitdaMarginTtm','Маржа EBITDA','17.60','percent','TTM'],['computedFreeCashFlowMarginTtm','Свободный денежный поток / выручка','6.2864','percent','TTM'],['computedPeTtm','P/E по показателям','3.72','ratio','current_market_cap / TTM'],['computedPriceToSalesTtm','P/S по показателям','0.4256','ratio','current_market_cap / TTM'],['computedPriceToFreeCashFlowTtm','P/FCF по показателям','6.77','ratio','current_market_cap / TTM']
  ].map(([key,label,value,unit,period])=>({key,label,value,unit,period,sourceIds:['website-example'],status:'available'})),
  sources:[{id:'website-example',title:'Вымышленные показатели для просмотра интерфейса',asOf:'2026-06-30T12:00:00Z'}],
  limitations:['Эти значения не относятся к отчётности выбранного эмитента.'],sections:[]};
 if(p==='/api/market/preferences'||p==='/api/calendar/settings')return clone(preferences);
 if(p==='/api/market/catalog')return {items:clone(catalog),fixture:true,stale:false};
 if(p==='/api/trading-plan')return demoPlans();
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
 if(p==='/api/market/candles'){
  const bootstrap=await fixture.request('/api/bootstrap'),uid=url.searchParams.get('instrumentUid'),interval=url.searchParams.get('interval')||'CANDLE_INTERVAL_DAY';
  const source=(bootstrap.candles||[]).filter(row=>row.instrumentUid===uid&&(row.interval||'CANDLE_INTERVAL_DAY')===interval);
  const from=url.searchParams.get('from'),to=url.searchParams.get('to'),before=url.searchParams.get('before');
  const bounds=[from,to,before].filter(Boolean).map(value=>Date.parse(value));
  if(bounds.some(value=>!Number.isFinite(value)))throw new Error('Некорректные даты учебной истории.');
  const rows=source.filter(row=>{const at=Date.parse(row.time);return (!from||at>=Date.parse(from))&&(!to||at<Date.parse(to))&&(!before||at<Date.parse(before));});
  return {data:clone(rows),fixture:true,stale:true,source:'Вымышленная история для демонстрации',history:{requestedFrom:rows[0]?.time||null,firstAvailable:source[0]?.time||null,nextBefore:null,hasMore:false,boundaryKnown:true}};
 }
 if(p==='/api/market/quotes'){
  const bootstrap=await fixture.request('/api/bootstrap'),ids=new Set((url.searchParams.get('instrumentUids')||'').split(',').filter(Boolean));
  const items=(bootstrap.positions||[]).filter(row=>ids.has(row.instrumentUid)&&row.currentPriceNanos!=null&&row.asOf).map(row=>({instrumentUid:row.instrumentUid,price:Number(row.currentPriceNanos)/1e9,sourceEventTime:row.asOf,connectorReceivedAt:row.asOf,stale:true,simulated:true,source:'Вымышленная котировка для демонстрации'}));
  return {items,fixture:true,stale:true};
 }
 return fixture.request(path,options);
}
export const runtimeAdapter=Object.freeze({...fixture,request,startMarketStream:()=>Object.freeze({close(){},simulated:true}),downloadOperationsCsv(){},downloadStatisticsPercentCsv(){}});
