import { runtimeAdapter as fixture } from './runtime.js';
// In-memory tutorial state. Reload resets everything; CSP blocks connections.
const clone = value => JSON.parse(JSON.stringify(value));
const today = new Date().toISOString().slice(0, 10);
let preferences = { textSize:'standard', density:'comfortable', language:'ru', displayCurrency:'RUB', digestEnabled:false, digestTime:'09:00', autoEvents:true, nativeNotifications:false };
const displayFx = { baseCurrency:'RUB', availableCurrencies:['RUB','USD'], rates:{USD:{rateNanos:'90000000000',date:'2026-08-12',source:'fixture'}} };
let plans = [], reminders = [], nextId = 1;
const catalog = [
  { instrumentUid:'fixture-share-sber', ticker:'SBER', name:'Сбербанк', assetType:'share', currency:'RUB', lot:10, inPortfolio:true },
  { instrumentUid:'fixture-future-si-9-26', ticker:'Si-9.26', name:'Фьючерс USD/RUB', assetType:'future', currency:'RUB', lot:1, inPortfolio:true },
  { instrumentUid:'fixture-share-yndx', ticker:'YDEX', name:'Яндекс', assetType:'share', currency:'RUB', lot:1, inPortfolio:false },
];
async function request(path, options = {}) {
  const url = new URL(path, 'https://demo.invalid'), p = url.pathname;
  const method = (options.method || 'GET').toUpperCase();
  const body = options.body ? JSON.parse(options.body) : {};
  if (p === '/api/bootstrap') {
    const data = await fixture.request(path, options);
    data.capabilities.tradingPlan = true;
    data.capabilities.marketCalendar = true;
    data.preview.interactiveTutorial = true;
    data.displayFx = clone(displayFx);
    data.quality.source = 'Учебный портфель'; data.quality.connector = 'Демонстрация';
    data.quality.note = 'Учебные данные. Подключения к брокеру нет.';
    return data;
  }
  if (p === '/api/market/preferences' || p === '/api/calendar/settings') {
    if (method === 'POST') preferences = { ...preferences, ...body };
    return clone(preferences);
  }
  if (p === '/api/market/catalog' || p === '/api/market/catalog/refresh') return { items:clone(catalog), fixture:true, capturedAt:new Date().toISOString(), stale:false };
  if (p === '/api/trading-plan' || p.startsWith('/api/trading-plan/')) {
    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      const item = { ...body, id:body.id || 'demo-plan-' + nextId++ };
      plans = [item, ...plans.filter(plan => plan.id !== item.id)].slice(0, 100);
    }
    if (method === 'DELETE') plans = plans.filter(plan => plan.id !== p.split('/').pop());
    return { persistence:'local-drafts', execution:'none', items:clone(plans) };
  }
  if (p === '/api/calendar/reminders' && method === 'POST') {
    const item = { ...body, id:body.id || 'demo-reminder-' + nextId++, status:'pending', enabled:true };
    const asset=catalog.find(row=>row.instrumentUid===item.instrumentUid);
    if(asset && item.title?.startsWith(asset.ticker+' · ')) item.title=item.title.slice(asset.ticker.length+3);
    reminders = [item, ...reminders.filter(r => r.id !== item.id)].slice(0, 100);
    return clone(item);
  }
  if (p.startsWith('/api/calendar/reminders/')) { reminders = reminders.filter(r => r.id !== p.split('/')[4]); return { ok:true }; }
  if (p === '/api/calendar/due') return { nativeAvailable:false, reminders:[] };
  if (p === '/api/calendar' || p === '/api/calendar/refresh') {
    const events = [
      { id:'demo-report',type:'report',date:today,instrumentUid:catalog[0].instrumentUid,ticker:'SBER',title:'Пример публикации отчётности',inPortfolio:true,source:'Учебный пример' },
      { id:'demo-expiry',type:'expiration',date:today.slice(0,8)+'24',instrumentUid:catalog[1].instrumentUid,ticker:'Si-9.26',title:'Пример экспирации',inPortfolio:true,source:'Учебный пример' },
    ];
    return { fixture:true,events,upcoming:events,reminders:clone(reminders),preferences:clone(preferences),nativeAvailable:false,warnings:[],
      coverage:{scope:body.scope||url.searchParams.get('scope')||'portfolio',instruments:3,pending:0,stale:0,note:'Все даты и события в демонстрации вымышлены.'} };
  }
  if (p === '/api/market/news') return { items:[],fixture:true,unavailable:false,hasMore:false,coverage:'В демо доступны учебные события. Новостная лента работает в установленном Workspace.' };
  if (p === '/api/market/candles') { const data = await fixture.request('/api/bootstrap'); return { candles:clone(data.candles || []), fixture:true, interval:url.searchParams.get('interval'), capturedAt:new Date().toISOString() }; }
  if (p === '/api/portfolio/refresh') return { simulated:true };
  if (p === '/api/display-fx/refresh') return clone(displayFx);
  return fixture.request(path, options);
}
export const runtimeAdapter = Object.freeze({ ...fixture, request });
