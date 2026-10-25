import {instrumentListingLabel,instrumentSearchMatches} from './instrument-search-model.js';
import { createTodayCalendarBridge } from './today-calendar-bridge.js';
import { createBondLifecycleHistoryUi, createBondCouponHistoryUi } from './bond-lifecycle-history-ui.js';
import { createPersonalRemindersTransferUi } from './personal-reminders-transfer-ui.js';
import { createNativeListsTransferUi } from './native-watchlists-transfer-ui.js';
import { marketWatchlist } from './market-watchlist.js';
import { enhanceFilterSelect } from './filter-select.js';
import { followTableHeader } from './sticky-table.js';
import { initNewsPanel } from './news-panel.js';
import { connectTableSort, sortRows } from './table-sort.js';
import { instrumentMark, watchInstrumentImages } from './instrument-mark.js';
import { decimalNanos } from './number-format.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const moscowDate=(date=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
const dateLabel=value=>new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'long',year:'numeric'}).format(new Date(value+'T12:00:00Z'));
const money=(value,currency='RUB')=>value==null?'—':new Intl.NumberFormat('ru-RU',{style:'currency',currency:currency.toUpperCase(),maximumFractionDigits:2}).format(Number(BigInt(value))/1e9);
const typeNames={dividend:'Дивиденды',coupon:'Купоны',offer:'Оферты',maturity:'Погашение',conversion:'Конвертации',expiration:'Экспирации',report:'Отчёты',reminder:'Мои даты'};
function bondLifecycleDetails(event){
 if(event.sourceKind!=='bond-lifecycle')return '';
 const rows=[['Дата события (UTC)',dateLabel(event.date)],['Статус события у источника',event.sourceExecution||'Не указан']];
 for(const [field,label]of [['recordDate','Фиксация владельцев'],['rateDate','Определение условий'],['paymentDate','Дата выплаты'],['executionDate','Дата исполнения у источника'],['defaultDate','Дата дефолта у источника']]){
  if(event[field])rows.push([label+' (UTC)',dateLabel(event[field].slice(0,10))]);
 }
 if(event.operationType)rows.push(['Код операции у источника',event.operationType]);
 if(event.type==='conversion'){
  rows.push(['Коэффициент конвертации',event.conversionRatioNanos==null?'Источник не указал':decimalNanos(event.conversionRatioNanos,{digits:9})]);
  rows.push(['Инструмент конвертации (код источника)',event.conversionInstrumentId||'Источник не указал']);
 }
 if(event.capturedAt)rows.push(['Данные получены',new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',dateStyle:'short',timeStyle:'short'}).format(new Date(event.capturedAt))+' МСК']);
 return (event.amountNanos==null?'<p>Источник не указал сумму на одну облигацию.</p>':'')+rows.map(([label,value])=>'<p>'+esc(label)+': '+esc(value)+'</p>').join('')+
  (event.sourceNote?'<p>Примечание источника: '+esc(event.sourceNote)+'</p>':'')+(event.stale?'<p role="status">Сохранённые события выпуска устарели. Обновите их отдельной кнопкой в фильтрах.</p>':'');
}
function couponDetails(event){
 if(event.type!=='coupon')return '';
 const rows=[['Тип купона',event.couponType||'Не указан'],['Фиксация реестра',event.recordDate?dateLabel(event.recordDate.slice(0,10)):'Источник не указал дату']];
 if(event.couponStartDate||event.couponEndDate)rows.push(['Купонный период',(event.couponStartDate?dateLabel(event.couponStartDate.slice(0,10)):'Начало не указано')+' — '+(event.couponEndDate?dateLabel(event.couponEndDate.slice(0,10)):'Окончание не указано')]);
 if(event.capturedAt)rows.push(['Данные получены',new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',dateStyle:'short',timeStyle:'short'}).format(new Date(event.capturedAt))+' МСК']);
 return (event.amountNanos==null?'<p>Источник не указал размер выплаты.</p>':'')+rows.map(([label,value])=>'<p>'+esc(label)+': '+esc(value)+'</p>').join('')+(event.stale?'<p role="status">Сохранённый график устарел. Дата и сумма могли измениться; обновите события.</p>':'');
}
const fieldLabels={currency:'Валюта',exchange:'Биржа',sector:'Сектор',countryOfRiskName:'Страна',basicAsset:'Базовый актив',futuresType:'Тип фьючерса',shareType:'Тип акции',classCode:'Режим торгов',realExchange:'Площадка'};
const boolLabels={shortEnabledFlag:'Доступен шорт',forQualInvestorFlag:'Для квалифицированных',apiTradeAvailableFlag:'Доступен через API',buyAvailableFlag:'Доступна покупка',sellAvailableFlag:'Доступна продажа',liquidityFlag:'Ликвидный',otcFlag:'Внебиржевой',forIisFlag:'Доступен на ИИС',divYieldFlag:'Дивидендная доходность'};
export function selectUpcomingEvents(data, reminders, today, {instrumentUid='',type='all'}={}) {
 const rows=[...(data?.portfolioUpcoming||[]),...(data?.upcoming||[]),...(data?.events||[]),...reminders];
 return [...new Map(rows.filter(e=>e.date>=today&&!e.cancelled&&(e.type!=='reminder'||!e.acknowledgedAt)&&(instrumentUid?e.instrumentUid===instrumentUid:e.inPortfolio||e.type==='reminder')&&(type==='all'||e.type===type)).map(e=>[e.id,e])).values()]
  .sort((a,b)=>a.date.localeCompare(b.date)||String(a.at||'').localeCompare(String(b.at||''))).slice(0,3);
}
// Independent from calendar reads: changing the visible month cannot revoke a
// catalogue request, while owner/access ABA and a newer catalogue request can.
export function createMarketCatalogPublicationGuard({getAuthority}) {
 let signature=null,generation=0,sequence=0,disposed=false;
 const cycles=new WeakSet(),requests=new WeakSet(),settled=new WeakSet();
 function observe(){
  let value=null;try{value=getAuthority();}catch{}
  const next=JSON.stringify([value?.key??null,value?.allowed===true]);
  const changed=next!==signature;if(changed){signature=next;generation++;}
  return {changed,allowed:!disposed&&value?.allowed===true};
 }
 function capture(){observe();const value=Object.freeze({generation});cycles.add(value);return value;}
 function currentCycle(value){const access=observe();return access.allowed&&cycles.has(value)&&value.generation===generation;}
 function begin(cycle){const value=Object.freeze({cycle,sequence:++sequence});requests.add(value);return value;}
 function current(value){return requests.has(value)&&value.sequence===sequence&&currentCycle(value.cycle);}
 function publish(value,callback){
  if(settled.has(value)||!current(value)||typeof callback!=='function')return false;
  settled.add(value);let active=true;
  try{const result=callback(()=>active&&current(value));return !(result&&typeof result.then==='function')&&result!==false&&current(value);}
  finally{active=false;}
 }
 function dispose(){disposed=true;generation++;sequence++;}
 return Object.freeze({observe,capture,currentCycle,begin,current,publish,dispose});
}
export function initMarketCalendar({request,getBootstrap,onChartSelect,showToast,refreshPortfolio,getTodayAccess,getReminderAccess,resolveTodayInstrument,onTodayChange=()=>{},onTodayNavigate=()=>false}) {
 const $=s=>document.querySelector(s);
 const heading=$('.instrument-heading'),shortlist=$('.instrument-shortlist'),chart=$('.instrument-surface');
 if(heading&&shortlist)shortlist.insertBefore(heading,$('.instrument-list-controls'));
 if(chart)chart.after($('#instrumentCatalogBrowser'));
 const stopHeader=followTableHeader($('#catalogSurface .table-scroll'));
 const state={catalog:[],month:'2026-08',day:'2026-08-12',type:'all',assetType:'all',page:0,data:null,calendarDataKey:null,busy:false,editing:null,selectedAsset:'',calendarRequest:0,lastError:null,newsInstrument:'',newsRequest:0,newsLoaded:false,newsCursor:'',newsLoading:false,newsLoadedAt:0};
 const today=createTodayCalendarBridge({getAccess:getTodayAccess||(()=>null),resolve:resolveTodayInstrument||(()=>null),onChange:onTodayChange,onOpen:openTodayRecord});
 let todayGeneration=today.getSnapshot().generation;
 function updateTodayAccess(){
  today.updateAccess();const generation=today.getSnapshot().generation;
  const catalogChanged=catalogPublication.observe().changed;
  if(generation===todayGeneration&&!catalogChanged)return;
  todayGeneration=generation;++state.calendarRequest;state.data=null;state.catalog=[];state.busy=false;state.lastError=null;lastConnectionKey=null;lastHoldingsKey=null;
  favoritesEpoch++;favoriteList=null;favorites=new Set();favoritesLoaded=false;favoritesBusy=false;listsTransfer.update();updateReminderAccess();
  ++state.newsRequest;clearTimeout(newsTimer);state.newsLoaded=false;state.newsCursor='';state.newsLoading=false;state.newsLoadedAt=0;state.newsInstrument='';newsPanel.reset();
  $('#marketNewsTitle').textContent='Новости';$('#marketNewsAll').hidden=true;
  $('#catalogRefresh').disabled=!roots();populateAssets();
  document.dispatchEvent(new Event('invest:catalog-updated'));
  renderCatalog();renderCalendar();
  if(catalogPublication.currentCycle(catalogPublication.capture()))void loadFavorites().then(()=>{if(!disposed)renderCatalog();});
 }
 function openTodayRecord({kind,id,date,isCurrent}){
  if(!isCurrent()||disposed||!roots())return false;
  // This route callback is synchronous and explicitly skips ensureNews.
  if(onTodayNavigate({isCurrent})!==true||!isCurrent())return false;
  state.day=date;state.month=date.slice(0,7);state.type='all';state.selectedAsset='';
  if(!isCurrent())return false;
  $('#calendarType').value='all';$('#calendarAsset').value='';renderCalendar();
  if(!isCurrent())return false;
  const node=[...$('#calendarAgenda').querySelectorAll('details[data-event-id]')].find(row=>row.dataset.eventId===id);
  const summary=node?.querySelector('summary');if(!node||!summary)return false;
  if(!isCurrent())return false;node.open=true;
  if(!isCurrent())return false;summary.focus({preventScroll:true});
  if(!isCurrent())return false;node.scrollIntoView({block:'nearest',behavior:'instant'});
  return isCurrent()&&document.activeElement===summary;
 }
 const newsPanel=initNewsPanel({request,getCatalog:()=>state.catalog,onMore:()=>loadNews(state.newsInstrument,{older:true}),onRetry:({replace=false}={})=>loadNews(state.newsInstrument,{force:true,refresh:!replace}),
  canReadHistory:()=>getBootstrap()?.capabilities?.newsContentHistory===true&&(!getBootstrap()?.preview?.static || getBootstrap()?.preview?.interactiveTutorial === true)&&!getBootstrap()?.preview?.localReview});
 for(const [id,icon] of [['newsPeriod','calendar'],['newsRelevance','user'],['newsCompany','building'],['newsSource','news']])enhanceFilterSelect($('#'+id),icon);
 let favoriteList=null,favorites=new Set(),favoritesBusy=false,favoritesLoaded=false,favoritesEpoch=0,watchLimit=80,watchFilter='';
 function favoriteButton(row){const selected=favorites.has(row.instrumentUid);return '<button type="button" class="instrument-favorite'+(selected?' active':'')+'" data-favorite-uid="'+esc(row.instrumentUid)+'" aria-pressed="'+selected+'" aria-label="'+(selected?'Убрать из избранного: ':'В избранное: ')+esc(row.ticker||row.name)+'" '+(!favoritesLoaded||favoritesBusy?'disabled':'')+'><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m12 3 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3L2.9 9.6l6.3-.9Z"/></svg></button>';}
 async function loadFavorites(){
  const epoch=++favoritesEpoch,cycle=catalogPublication.capture(),current=()=>epoch===favoritesEpoch&&catalogPublication.currentCycle(cycle);
  try{const result=await request('/api/market/watchlists');if(!current())return;favoriteList=(result.items||[]).find(row=>row.name==='Избранное')||null;favorites=new Set((favoriteList?.items||[]).map(row=>row.instrumentUid));favoritesLoaded=true;}
  catch{if(current())favoritesLoaded=false;}
 }
 let calendarTimer=null,newsTimer=null,disposed=false,lastConnectionKey=null,lastHoldingsKey=null,hydrationRunning=false,hydrationAgain=false,started=false;
 const roots=()=>getBootstrap()?.capabilities?.marketCalendar===true&&!getBootstrap()?.preview?.static&&!getBootstrap()?.preview?.localReview;
 const nativeBondEvents=()=>roots()&&!getBootstrap()?.preview?.static&&!getBootstrap()?.preview?.localReview;
 const catalogPublication=createMarketCatalogPublicationGuard({getAuthority:()=>{
  if(typeof getTodayAccess==='function'){
   const snapshot=today.getSnapshot();
   return {key:JSON.stringify([snapshot.generation,snapshot.ownerScope,snapshot.accessRevision,snapshot.sourceKey]),allowed:!disposed&&roots()&&Boolean(snapshot.ownerScope)&&snapshot.state!=='forbidden'};
  }
  // Older callers have no Today bridge. Preserve their calendar capability,
  // but still bind publication to the available owner/connection/public scope.
  const bootstrap=getBootstrap(),connection=bootstrap?.connection||{},identity=bootstrap?.identity||bootstrap?.session?.identity||{};
  return {key:JSON.stringify([bootstrap?.environment,bootstrap?.savedResearch?.ownerScope,identity.preferenceScope||identity.userId||identity.subject||null,
   connection.connected,connection.environment,connection.validatedAt,(bootstrap?.clientProduct?.portfolios||[]).map(row=>row.preferenceKey||row.id).sort()]),allowed:!disposed&&roots()};
 }});
 const listsTransfer=createNativeListsTransferUi({host:$('#nativeListsTransfer'),request,getAccess:()=>{
  const snapshot=today.getSnapshot(),bootstrap=getBootstrap(),staticFile=bootstrap?.preview?.static===true&&bootstrap.preview.brokerNetwork===false&&bootstrap.preview.persistence==='none';
  // The website widens roots() for its synthetic calendar. Personal persistence
  // must still require a native profile independently of that tutorial flag.
  const allowed=roots()&&bootstrap?.preview?.static!==true&&bootstrap?.preview?.localReview!==true&&Boolean(snapshot.ownerScope)&&snapshot.state!=='forbidden'&&!disposed;
  return{key:JSON.stringify([snapshot.generation,snapshot.ownerScope,snapshot.accessRevision,snapshot.sourceKey,allowed,staticFile]),canNative:allowed,canOpen:allowed||staticFile};
 },onApplied:async()=>{favoritesEpoch++;favoritesLoaded=false;favoritesBusy=false;await loadFavorites();renderCatalog();}});
 Object.assign(state,{editorRevision:0,editorBusy:false,editingRow:null});let reminderAccessKey=null;
 const reminderAccess=()=>{const access=getReminderAccess?.()||{key:'unavailable',canNative:false,canOpen:getBootstrap()?.preview?.static===true};return{...access,key:JSON.stringify([access.key,today.getSnapshot().generation])};};
 const bondHistory=createBondLifecycleHistoryUi({host:$('#calendarBondHistory'),request,getContext:()=>({key:reminderAccess().key,instrumentUid:state.selectedAsset,year:state.month.slice(0,4),allowed:!disposed&&nativeBondEvents()&&state.catalog.some(row=>row.instrumentUid===state.selectedAsset&&row.assetType==='bond')})});
 const couponHistory=createBondCouponHistoryUi({host:$('#calendarCouponHistory'),request,getContext:()=>({key:reminderAccess().key,instrumentUid:state.selectedAsset,year:state.month.slice(0,4),allowed:!disposed&&nativeBondEvents()&&state.catalog.some(row=>row.instrumentUid===state.selectedAsset&&row.assetType==='bond')})});
 const remindersTransfer=createPersonalRemindersTransferUi({host:$('#personalRemindersTransfer'),request,getAccess:reminderAccess,getEditor:()=>({revision:state.editorRevision,busy:state.editorBusy,dirty:!$('#reminderEditor').hidden}),onEdit:row=>editReminder(row.id,row),onApplied:snapshot=>{if(state.data){state.data.reminders=[...(state.data.reminders||[]).filter(r=>r.sourceEventId),...snapshot.rows.map(r=>({...r.value,id:r.id,sourceEventId:null,importedAt:r.importedAt,sourceExportedAt:r.sourceExportedAt}))];renderCalendar();}void loadCalendar();}});
 function updateReminderAccess(){const key=reminderAccess().key;if(reminderAccessKey!==key){reminderAccessKey=key;state.editorRevision++;state.editing=null;state.editingRow=null;state.editorBusy=false;$('#reminderEditor').hidden=true;$('#reminderForm').reset();$('#reminderForm').querySelectorAll('input,textarea,button').forEach(el=>el.disabled=false);}remindersTransfer.update();}
 updateReminderAccess();
 const label=r=>[r.ticker,r.name,r.classCode].filter(Boolean).join(' · ');
 const eventLabel=e=>e.ticker&&String(e.title||'').startsWith(e.ticker+' · ')?e.title:[e.ticker,e.title].filter(Boolean).join(' · ');
 const instrument=input=>state.catalog.find(r=>label(r)===input || r.instrumentUid===input);
 function populateAssets(query='') {
  const rows=state.catalog.filter(r=>!query||label(r).toLowerCase().includes(query.toLowerCase())).sort((a,b)=>Number(b.inPortfolio)-Number(a.inPortfolio)).slice(0,60);
  $('#marketAssetSuggestions').innerHTML=rows.map(r=>'<option value="'+esc(label(r))+'"></option>').join('');
 }
 function options(){return{month:state.month,universe:$('#calendarUniverse').value,...(state.selectedAsset?{instrumentUid:state.selectedAsset}:{})};}
 function openBondCoupons(instrumentUid,{isCurrent=()=>false,date=null,type='coupon',refresh=true}={}){
  updateTodayAccess();
  const asset=state.catalog.find(row=>row.instrumentUid===instrumentUid&&row.assetType==='bond');
  if(disposed||!roots()||getBootstrap()?.preview?.static||getBootstrap()?.preview?.localReview||!asset||!isCurrent())return false;
  const requestedDay=date===null?moscowDate():date;
  if(typeof requestedDay!=='string'||!/^20\d{2}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(requestedDay)||!Number.isFinite(Date.parse(requestedDay+'T00:00:00Z'))||new Date(requestedDay+'T00:00:00Z').toISOString().slice(0,10)!==requestedDay||!['coupon','all'].includes(type)||typeof refresh!=='boolean')return false;
  if(onTodayNavigate({isCurrent})!==true||!isCurrent())return false;
  state.day=requestedDay;state.month=state.day.slice(0,7);state.selectedAsset=asset.instrumentUid;state.type=type;state.data=null;state.lastError=null;state.busy=true;
  $('#calendarAsset').value=label(asset);$('#calendarType').value=type;$('#calendarUniverse').value='all';
  $('.calendar-upcoming').open=true;$('.calendar-source-details').open=true;renderCalendar();
  // Navigation and focus finish before the read. Its response only paints the
  // still-current calendar query and cannot navigate back after the user leaves.
  void loadCalendar(refresh);
  const target=$('#calendarInstrumentContext');target.focus({preventScroll:true});target.scrollIntoView({block:'center',behavior:'instant'});
  return true;
 }
 function setStatus(text,error=false){$('#calendarStatus').textContent=text;$('#calendarStatus').classList.toggle('negative',error);}
 function fillCatalog(data,isCurrent=()=>true) {
  if(!isCurrent())return false;
  state.catalog=data.items||[];populateAssets();
  if(!isCurrent())return false;
  document.dispatchEvent(new Event('invest:catalog-updated'));
  if(!isCurrent())return false;
  const filters=$('#catalogExtraFilters');
  const old=Object.fromEntries([...filters.querySelectorAll('select')].map(el=>[el.name,el.value]));
  const attributes=Object.entries(fieldLabels).map(([key,title])=>{
   const values=[...new Set(state.catalog.map(r=>r[key]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru'));
   return '<label><span>'+title+'</span><select name="'+key+'"><option value="">Все</option>'+values.map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join('')+'</select></label>';
  }).join('');
  const availability=Object.entries(boolLabels).map(([key,title])=>'<label><span>'+title+'</span><select name="'+key+'"><option value="">Любое значение</option><option value="true">Да</option><option value="false">Нет</option></select></label>').join('');
  filters.innerHTML='<fieldset><legend>Рынок и характеристики</legend><div class="catalog-filter-fields">'+attributes+'</div></fieldset><fieldset><legend>Доступность и условия</legend><div class="catalog-filter-fields">'+availability+'</div></fieldset>';
  for(const el of filters.querySelectorAll('select'))if(old[el.name])el.value=old[el.name];
  const staticCatalog=getBootstrap()?.environment==='fixture'&&getBootstrap()?.preview?.static===true;
  const catalogTime=typeof data.capturedAt==='string'&&Number.isFinite(Date.parse(data.capturedAt));
  $('#catalogStatus').textContent=staticCatalog?'Учебный каталог · показана ограниченная выборка.':data.warnings?.length?'Часть каталога не обновилась. Сохранённые данные доступны.':catalogTime?'Каталог Т‑Инвест · '+new Date(data.capturedAt).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})+' мск'+(data.stale?' · требуется обновление':''):state.catalog.length?'Показана сохранённая выборка. Время обновления не подтверждено.':'Каталог ещё не загружен.';
  const missingTypes=(data.coverage||[]).filter(row=>row.state==='missing').map(row=>({share:'акции',future:'фьючерсы',bond:'облигации',etf:'фонды',currency:'валюты'})[row.assetType]).filter(Boolean);
  if(!staticCatalog&&missingTypes.length)$('#catalogStatus').textContent+=' Ещё не загружены: '+missingTypes.join(', ')+'. Нажмите «Обновить каталог».';
  renderCatalog();return isCurrent();
 }
 function renderCatalog() {
  const watchCatalog=marketWatchlist(state.catalog,getBootstrap()?.instruments,favorites);
  const held=watchCatalog.filter(r=>r.inPortfolio),scope=$('#instrumentListScope')?.value||'portfolio',search=($('#instrumentListSearch')?.value||'').trim().toLowerCase();
  const filter=scope+':'+search;if(filter!==watchFilter){watchLimit=80;watchFilter=filter;}
  const quick=instrumentSearchMatches((scope==='favorites'?watchCatalog.filter(r=>favorites.has(r.instrumentUid)):scope==='all'?watchCatalog:scope.startsWith('custom:')?watchCatalog.filter(r=>JSON.parse(shortlist.dataset.customUids||'[]').includes(r.instrumentUid)):['share','future','currency','crypto','bond','etf'].includes(scope)?watchCatalog.filter(r=>r.assetType===scope):held),search);
  $('#instrumentShortlistTitle').textContent='Список наблюдения';
  const quotes=getBootstrap()?.positions||[];
  let quickMarkup=quick.slice(0,watchLimit).map(r=>{
   const quote=quotes.find(p=>p.instrumentUid===r.instrumentUid),price=quote?.currentPriceNanos??quote?.priceNanos;
   const priceText=price==null?'':r.assetType==='future'?new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(Number(BigInt(price))/1e9)+' п.':money(price,r.currency||'RUB');
   return '<div class="instrument-watch-row"><button type="button" class="instrument-quick-item" data-chart-uid="'+esc(r.instrumentUid)+'">'+instrumentMark(r)+'<span><strong>'+esc(r.ticker||r.name)+'</strong><small>'+esc(r.name)+'</small><small class="watch-listing" title="'+esc(instrumentListingLabel(r))+'">'+esc(instrumentListingLabel(r))+'</small></span>'+(price!=null?'<span class="watch-price">'+esc(priceText)+'</span>':'')+'</button>'+favoriteButton(r)+'</div>';
  }).join('')||'<p class="empty-copy">'+(scope==='favorites'?'Добавьте активы в избранное с помощью звезды.':['currency','crypto','bond','etf'].includes(scope)?'Источник пока не передал инструменты этой категории.':'Активы не найдены.')+'</p>';
  if(quick.length>watchLimit)quickMarkup+='<button type="button" class="terminal-watch-more" data-watch-more>Показать ещё '+Math.min(80,quick.length-watchLimit)+'</button>';
  const quickHost=$('#instrumentQuickList');
  if(quickHost.renderedMarkup!==quickMarkup){const focused=document.activeElement?.dataset?.favoriteUid||document.activeElement?.dataset?.chartUid;quickHost.innerHTML=quickMarkup;quickHost.renderedMarkup=quickMarkup;watchInstrumentImages(quickHost);if(focused)quickHost.querySelector('[data-favorite-uid="'+CSS.escape(focused)+'"],[data-chart-uid="'+CSS.escape(focused)+'"]')?.focus({preventScroll:true});}
  document.dispatchEvent(new Event('invest:watchlist-rendered'));
  const query=$('#catalogSearch').value.trim().toLowerCase(),filters=Object.fromEntries([...$('#catalogExtraFilters').querySelectorAll('select')].filter(el=>el.value!=='').map(el=>[el.name,el.value]));
  const min=Number($('#catalogLotMin').value),max=$('#catalogLotMax').value?Number($('#catalogLotMax').value):Infinity;
  const expiry=$('#catalogExpiry').value;
  const rows=sortRows(state.catalog.filter(r=>(state.assetType==='all'||r.assetType===state.assetType)&&(!query||label(r).toLowerCase().includes(query))&&(!$('#catalogHeld').checked||r.inPortfolio)
   &&(!$('#catalogLotMin').value||r.lot!==null&&r.lot>=min)&&(!$('#catalogLotMax').value||r.lot!==null&&r.lot<=max)
   &&(!expiry||r.expirationDate&&r.expirationDate.slice(0,10)<=expiry)
   &&Object.entries(filters).every(([k,v])=>String(r[k])===v)),state.sort||{key:'name',direction:'asc'},{name:label,sector:r=>r.assetType==='future'?r.basicAsset:r.sector,expirationDate:r=>r.expirationDate?Date.parse(r.expirationDate):null});
  state.page=Math.max(0,Math.min(state.page,Math.ceil(rows.length/25)-1));
  $('#catalogBody').innerHTML=rows.slice(state.page*25,(state.page+1)*25).map(r=>'<tr><td><button class="instrument-link" type="button" data-chart-uid="'+esc(r.instrumentUid)+'">'+instrumentMark(r)+'<span class="instrument-label"><strong>'+esc(r.ticker)+'</strong><span>'+esc(r.name)+'</span></span></button>'+(r.inPortfolio?'<small class="portfolio-mark">В портфеле</small>':'')+'</td><td>'+esc(r.currency.toUpperCase()||'—')+'</td><td>'+esc(r.exchange||'—')+'</td><td class="numeric">'+esc(r.lot??'—')+'</td><td>'+esc(r.assetType==='future'?(r.basicAsset||'—'):(r.sector||'—'))+'</td><td>'+esc(r.expirationDate?r.expirationDate.slice(0,10):'—')+'</td><td><button class="button secondary compact" type="button" data-plan-uid="'+esc(r.instrumentUid)+'">Напомнить</button></td></tr>').join('')||'<tr><td colspan="7" class="empty-cell">Нет инструментов по этим фильтрам. Измените условия или обновите каталог.</td></tr>';
  watchInstrumentImages($('#catalogBody'));
  $('#catalogCount').textContent=rows.length?((state.page*25+1)+'–'+Math.min(rows.length,(state.page+1)*25)+' из '+rows.length):'0 инструментов';
  $('#catalogPrevious').disabled=state.page===0;$('#catalogNext').disabled=(state.page+1)*25>=rows.length;
  document.querySelectorAll('[data-catalog-type]').forEach(b=>{b.classList.toggle('active',b.dataset.catalogType===state.assetType);b.setAttribute('aria-pressed',String(b.dataset.catalogType===state.assetType));const unavailable=!['all','share','future'].includes(b.dataset.catalogType)&&!state.catalog.some(row=>row.assetType===b.dataset.catalogType);b.disabled=unavailable;b.title=unavailable?'Этот тип пока не загружен в каталог':'';});
 }
 function events(){
  const data=state.data;if(!data)return[];
  const reminders=(data.reminders||[]).filter(r=>r.enabled && !r.sourceEventId).map(r=>({id:r.id,type:'reminder',date:moscowDate(new Date(r.snoozedUntil||r.dueAt)),at:r.dueAt,title:r.title,note:r.note,
   instrumentUid:r.instrumentUid,name:state.catalog.find(a=>a.instrumentUid===r.instrumentUid)?.name||'',ticker:state.catalog.find(a=>a.instrumentUid===r.instrumentUid)?.ticker||'',
   acknowledgedAt:r.acknowledgedAt,reminder:r,inPortfolio:state.catalog.some(a=>a.instrumentUid===r.instrumentUid&&a.inPortfolio)}));
  return [...data.events,...reminders].filter(e=>(state.type==='all'||e.type===state.type)&&(!state.selectedAsset||e.instrumentUid===state.selectedAsset));
 }
 function renderCalendar(){
  bondHistory.update();couponHistory.update();
  if($('#calendarRefresh'))$('#calendarRefresh').disabled=state.busy;
  const selection=$('#calendarInstrumentContext'),selected=state.catalog.find(row=>row.instrumentUid===state.selectedAsset);
  const bondControls=$('#calendarBondEvents');
  if(bondControls){
   const coverage=state.data?.coverage?.bondLifecycle;
   bondControls.hidden=selected?.assetType!=='bond';
   const button=$('#calendarBondEventsRefresh'),note=$('#calendarBondEventsStatus');
   button.disabled=state.busy||!nativeBondEvents();
   button.textContent=coverage?.instruments===1&&coverage.pending===0?'Обновить события выпуска':'Загрузить события выпуска';
   note.textContent=!nativeBondEvents()?'Оферты, погашения и конвертации доступны в подключённой локальной рабочей среде.':state.busy?'Читаем сведения для выбранной облигации…':
    coverage?.invalid?'Сохранённые события выпуска не удалось прочитать. Загрузите их заново.':
    coverage?.stale?'Оферты, погашения и конвертации сохранены ранее; сведения требуют обновления.':
    !coverage||coverage.pending?'Оферты, погашения и конвертации за '+state.month.slice(0,4)+' год ещё не загружены.':
    'Показаны сохранённые события выпуска за '+state.month.slice(0,4)+' год. Участие в оферте и зачисление денег этим не подтверждаются.';
  }
  if(selection){selection.hidden=!state.selectedAsset;selection.textContent=state.selectedAsset?(state.type==='all'?'События':typeNames[state.type]||'События')+' · '+(selected?label(selected):'Выбранный актив недоступен'):'';}
  const focusDate=document.activeElement?.dataset?.calendarDate;
  const all=events(),monthStart=new Date(state.month+'-01T12:00:00Z'),offset=(monthStart.getUTCDay()+6)%7,days=new Date(Date.UTC(monthStart.getUTCFullYear(),monthStart.getUTCMonth()+1,0)).getUTCDate();
  $('#calendarMonth').textContent=new Intl.DateTimeFormat('ru-RU',{timeZone:'UTC',month:'long',year:'numeric'}).format(monthStart);
  const gridMarkup=Array.from({length:Math.ceil((offset+days)/7)*7},(_,index)=>{
   const number=index-offset+1;
   if(number<1||number>days){const adjacent=new Date(monthStart);adjacent.setUTCDate(number);return '<span class="calendar-day outside" aria-hidden="true"><span class="calendar-number">'+adjacent.getUTCDate()+'</span></span>';}
   const date=state.month+'-'+String(number).padStart(2,'0'),items=all.filter(e=>e.date===date),owned=items.some(e=>e.inPortfolio);
   return '<button class="calendar-day'+(date===state.day?' selected':'')+(date===moscowDate()?' today':'')+'" type="button" data-calendar-date="'+date+'" aria-pressed="'+(date===state.day)+'" aria-label="'+esc(dateLabel(date)+', событий: '+items.length+(owned?', есть активы из портфеля':''))+'"><span class="calendar-number">'+number+'</span>'+
    items.slice(0,2).map(e=>'<span class="calendar-event '+e.type+'">'+esc(e.ticker||typeNames[e.type])+'</span>').join('')+(items.length>2?'<small>ещё '+(items.length-2)+'</small>':'')+(owned?'<span class="calendar-held" title="В портфеле">П</span>':'')+'</button>';
  }).join('');
  const grid=$('#calendarGrid');if(grid.renderedMarkup!==gridMarkup){grid.innerHTML=gridMarkup;grid.renderedMarkup=gridMarkup;}
  $('#calendarSelectedDay').textContent='События на '+dateLabel(state.day);
  if(focusDate)$('#calendarGrid [data-calendar-date="'+focusDate+'"]')?.focus({preventScroll:true});
  const rows=all.filter(e=>e.date===state.day).sort((a,b)=>String(a.at||'').localeCompare(String(b.at||'')));
  $('#calendarDayCount').textContent=rows.length ? String(rows.length) : '';
  const agenda=$('#calendarAgenda'),signature=JSON.stringify([state.day,rows]);
  if(agenda.renderedSignature!==signature){
   const expanded=new Set([...agenda.querySelectorAll('details[open]')].map(el=>el.dataset.eventId));
   const focused=document.activeElement?.dataset?.agendaKey;
   agenda.innerHTML=rows.map(e=>{
    const asset=state.catalog.find(r=>r.instrumentUid===e.instrumentUid)||e;
    const time=e.reminder?new Date(e.at).toLocaleTimeString('ru-RU',{timeZone:'Europe/Moscow',hour:'2-digit',minute:'2-digit'}):'';
    const title=e.ticker&&String(e.title||'').startsWith(e.ticker+' · ')?e.title.slice(e.ticker.length+3):e.title;
    return '<details class="agenda-event '+esc(e.type)+'" data-event-id="'+esc(e.id)+'"'+(expanded.has(e.id)?' open':'')+'><summary data-agenda-key="'+esc(e.id)+'">'+instrumentMark(asset)+'<span class="agenda-heading"><span class="agenda-meta"><span class="event-kind">'+esc(typeNames[e.type])+'</span>'+(time?'<time>'+esc(time)+'</time>':'')+'</span><strong>'+esc(title||eventLabel(e))+'</strong><small>'+esc(asset.name||e.ticker||'Личное напоминание')+'</small></span><svg class="agenda-chevron"><use href="#i-chevron"/></svg></summary><div class="agenda-body">'+
      (e.cancelled?'<strong class="negative">Выплата отменена</strong>':'')+
      (e.amountNanos!=null?'<p>'+esc(e.sourceKind==='bond-lifecycle'?decimalNanos(e.amountNanos,{digits:9})+' '+e.currency:money(e.amountNanos,e.currency||'RUB'))+(e.type==='coupon'||e.sourceKind==='bond-lifecycle'?' на одну облигацию':' на бумагу')+'</p>':'')+couponDetails(e)+bondLifecycleDetails(e)+
      (e.note?'<p>'+esc(e.note)+'</p>':'')+
      (e.reminder?'<div class="agenda-actions"><button type="button" data-edit-reminder="'+esc(e.id)+'">Изменить</button><button type="button" data-delete-reminder="'+esc(e.id)+'">Удалить</button>'+(!e.acknowledgedAt?'<button type="button" data-ack-reminder="'+esc(e.id)+'">Просмотрено</button>':'<small>Просмотрено</small>')+'</div>':'<div class="agenda-actions"><button type="button" data-event-uid="'+esc(e.instrumentUid)+'">Новости инструмента</button>'+(e.url?'<a href="'+esc(e.url)+'" target="_blank" rel="noopener noreferrer">Источник ↗</a>':'')+'</div><small>'+esc(e.source||'')+'</small>')+'</div></details>';
   }).join('')||'<p class="empty-copy">На этот день нет загруженных событий. Выберите другую дату или добавьте напоминание.</p>';
   agenda.renderedSignature=signature;watchInstrumentImages(agenda);
   if(focused)agenda.querySelector('[data-agenda-key="'+CSS.escape(focused)+'"]')?.focus({preventScroll:true});
  }
  const coverage=state.data?.coverage;
  if(!state.busy&&!state.lastError)setStatus('');
  const coupons=coverage?.bondCoupons;
  $('#calendarCoverageNote').textContent=coupons?.pending?'Купонный график не загружен для облигаций: '+coupons.pending+'. Обновите события.':coupons?.stale?'Сохранённые купонные графики требуют обновления: '+coupons.stale+'.':coupons?.instruments?'Купоны показаны по опубликованному графику за '+coverage.year+' год. Отсутствие выплаты на выбранную дату не подтверждает отсутствие будущих выплат.':'';
  const personal=(state.data?.reminders||[]).filter(r=>r.enabled&&!r.sourceEventId).map(r=>({id:r.id,instrumentUid:r.instrumentUid,type:'reminder',date:moscowDate(new Date(r.snoozedUntil||r.dueAt)),at:r.dueAt,title:r.title,acknowledgedAt:r.acknowledgedAt}));
  const upcoming=selectUpcomingEvents(state.data,personal,moscowDate(),{instrumentUid:state.selectedAsset,type:state.type});
  const unreadBondEvents=selected?.assetType==='bond'&&['all','offer','maturity','conversion'].includes(state.type)&&(!coverage?.bondLifecycle||coverage.bondLifecycle.pending>0);
  const upcomingTitle=$('#calendarUpcomingTitle');upcomingTitle.firstChild.textContent=state.selectedAsset?(state.type==='coupon'?'Ближайшие купоны выбранной облигации':'Ближайшие даты выбранного актива')+' ':'Ваши ближайшие даты ';
  $('#calendarUpcoming').innerHTML=upcoming.map(e=>'<button type="button" class="upcoming-'+esc(e.type)+'" data-upcoming-date="'+e.date+'"><time>'+esc(new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(e.date+'T12:00:00Z')))+'</time><span><small class="upcoming-kind">'+esc(typeNames[e.type])+'</small><strong>'+esc([e.ticker,e.title].filter(Boolean).join(' · '))+'</strong><small>'+esc(e.inPortfolio?'В вашем портфеле':e.type==='reminder'?'Личное напоминание':'Опубликованное событие')+'</small></span></button>').join('')||'<p class="empty-copy">'+(state.busy?'Загружаем опубликованные даты…':state.lastError?'Не удалось прочитать график. Обновите события, чтобы проверить ближайшие даты.':!state.data?'График ещё не прочитан. Обновите события.':unreadBondEvents?'События выпуска за выбранный год ещё не загружены. Используйте кнопку в фильтрах.':coverage?.pending||coverage?.stale?'Проверяем опубликованные даты. Загруженные события будут появляться здесь.':state.selectedAsset?'В загруженном графике за '+state.month.slice(0,4)+' год нет ближайших дат для выбранного фильтра. Другой год можно проверить переключением месяца.':'Для ваших активов пока нет ближайших опубликованных дат. Можно добавить своё напоминание.')+'</p>';
  if(state.data){$('#calendarAutoEvents').checked=state.data.preferences.autoEvents;$('#calendarNative').checked=state.data.preferences.nativeNotifications;
   $('#calendarNotificationNote').textContent=state.data.nativeAvailable?'Окно Windows поверх программ, пока Invest запущен. Пропущенные напоминания появятся при следующем запуске. Время — московское.':'В этом просмотре напоминания появляются внутри Invest. Окно поверх программ доступно в установленной версии Windows.';}
 }
 async function refreshHoldings(){
  updateSurfaces();
  updateTodayAccess();
  if(disposed||!roots())return;
  if(hydrationRunning){hydrationAgain=true;return;}
  hydrationRunning=true;
  const cycle=catalogPublication.capture();
  let catalogTicket=null;
  try{
   const bootstrap=getBootstrap(),connection=bootstrap?.connection;
   const key=bootstrap?.environment==='fixture'?'fixture':connection?.connected?[connection.environment,connection.validatedAt,connection.accountCount].join('|'):'';
   const held=new Set((bootstrap?.clientProduct?.openPositions||[]).map(r=>r.instrumentUid));
   const signature=[...held].sort().join('|'),connectionChanged=key!==lastConnectionKey,holdingsChanged=signature!==lastHoldingsKey;
   lastConnectionKey=key;lastHoldingsKey=signature;
   if(connectionChanged){
    ++state.calendarRequest;++state.newsRequest;clearTimeout(calendarTimer);
    state.data=null;state.catalog=[];state.lastError=null;
    if(!fillCatalog({items:[],capturedAt:null},()=>catalogPublication.currentCycle(cycle)))return;
    newsPanel.reset();state.newsLoaded=false;state.newsCursor='';state.newsLoadedAt=0;
   }
   if(!key){state.data=null;renderCalendar();setStatus('Подключите брокерский счёт, чтобы загрузить календарь.');$('#catalogStatus').textContent='Каталог появится после подключения брокера.';return;}
   if(connectionChanged||!state.catalog.length){
    catalogTicket=catalogPublication.begin(cycle);
    try{
     const data=await request('/api/market/catalog');
     if(!catalogPublication.publish(catalogTicket,isCurrent=>fillCatalog(data,isCurrent)))return;
     if(data.stale&&await refreshCatalog(cycle)!==true)return;
    }finally{if(catalogPublication.current(catalogTicket))$('#catalogRefresh').disabled=false;}
   }
   if(!catalogPublication.currentCycle(cycle))return;
   if(connectionChanged||holdingsChanged){
    state.catalog.forEach(r=>r.inPortfolio=held.has(r.instrumentUid));renderCatalog();
    if(state.data){for(const list of [state.data.events,state.data.upcoming,state.data.portfolioUpcoming])list?.forEach(e=>e.inPortfolio=held.has(e.instrumentUid));renderCalendar();}
   }
   if(connectionChanged||holdingsChanged||!state.data)await loadCalendar(true);
   if(!catalogPublication.currentCycle(cycle))return;
   if($('.events-view')?.classList.contains('active')&&(holdingsChanged||connectionChanged||!state.newsLoaded))void loadNews();
  }catch(error){if(catalogPublication.currentCycle(cycle)&&(!catalogTicket||catalogPublication.current(catalogTicket))){setStatus(error.message,true);if(catalogTicket)$('#catalogStatus').textContent=error.message;}}
  finally{hydrationRunning=false;if(hydrationAgain){hydrationAgain=false;void refreshHoldings();}}
 }

 function openEditor(asset,date=state.day){
  $('#reminderFormStatus').textContent='';
  state.editing=null;state.editingRow=null;state.editorRevision++;$('#reminderForm').reset();$('#reminderTitle').value=asset?asset.ticker+' · Посмотреть актив':'Посмотреть актив';$('#reminderEnabled').checked=true;$('#reminderProvenance').textContent='Уведомление с отметкой просмотра не появится повторно, пока не изменена дата.';$('#reminderAsset').value=asset?label(asset):'';$('#reminderDate').value=date;$('#reminderTime').value='09:00';
  $('#reminderSave').textContent='Сохранить напоминание';$('#reminderEditor').hidden=false;$('#reminderEditor').scrollIntoView({block:'center'});$('#reminderAsset').focus({preventScroll:true});remindersTransfer.update();
 }
 function editReminder(id,provided){
  const row=provided||state.data?.reminders?.find(r=>r.id===id);if(!row)return;
  openEditor(state.catalog.find(r=>r.instrumentUid===row.instrumentUid),moscowDate(new Date(row.dueAt)));state.editing=id;state.editingRow=row;$('#reminderTitle').value=row.title;$('#reminderEnabled').checked=row.enabled;if(!state.catalog.some(r=>r.instrumentUid===row.instrumentUid))$('#reminderAsset').value=row.instrumentUid;if(row.importedAt)$('#reminderProvenance').textContent='Восстановлено из непроверенного файла: '+row.importedAt+'. Исходные даты и отметки просмотра взяты из файла. Для включения нужен доступный актив и допустимая дата.';
  $('#reminderTime').value=new Date(Date.parse(row.dueAt)+3*3600000).toISOString().slice(11,16);$('#reminderNote').value=row.note;$('#reminderSave').textContent='Сохранить изменения';
 }
 function scheduleCalendar(){
  clearTimeout(calendarTimer);if(disposed||getBootstrap()?.preview?.readOnly)return;
  calendarTimer=setTimeout(()=>{if(document.visibilityState==='visible'&&$('.events-view')?.classList.contains('active'))void loadCalendar(true);else scheduleCalendar();},60000);
 }
 async function loadCalendar(refresh=false){if(getBootstrap()?.preview?.readOnly)refresh=false;
  if(!roots())return;
  if(refresh==='bond-events'&&(state.busy||!nativeBondEvents()||!state.catalog.some(row=>row.instrumentUid===state.selectedAsset&&row.assetType==='bond')))return;
  updateTodayAccess();clearTimeout(calendarTimer);const serial=++state.calendarRequest,query=options(),todayTicket=today.beginRead(query);
  const queryKey=JSON.stringify(query);if(state.calendarDataKey!==queryKey)state.data=null;
  state.busy=true;state.lastError=null;renderCalendar();if(!state.data)setStatus('Загружаем события…');
  try{
   const data=refresh==='bond-events'?await request('/api/calendar/bond-events/refresh',{method:'POST',body:JSON.stringify({month:query.month,instrumentUid:query.instrumentUid})}):refresh?await request('/api/calendar/refresh',{method:'POST',body:JSON.stringify(refresh==='force'?{...query,force:true}:query)}):await request('/api/calendar?'+new URLSearchParams(query));
   if(serial!==state.calendarRequest)return;
   if(todayTicket){if(!today.accept(todayTicket,data,{beforeNotify:()=>{state.data=data;state.calendarDataKey=queryKey;}}))return;}else{state.data=data;state.calendarDataKey=queryKey;}
   if(refresh==='bond-events')bondHistory.refresh();else if(refresh)couponHistory.refresh();
   if(data.warnings?.length){
    const couponIssue=data.warnings.find(w=>['BOND_COUPON_HISTORY_CHANGED','BOND_COUPON_HISTORY_LIMIT','BOND_COUPON_HISTORY_INVALID'].includes(w.code));
    const couponMessages={BOND_COUPON_HISTORY_CHANGED:'Купонный график уже обновлён другим запросом. Загрузите сохранённые сведения.',BOND_COUPON_HISTORY_LIMIT:'История купонов заполнена. Прежние версии и график сохранены; новый график не записан.',BOND_COUPON_HISTORY_INVALID:'Сохранённую историю купонов не удалось проверить. Требуется проверка локального хранилища; обновление источника не исправляет историю.'};
    state.lastError=couponIssue?couponMessages[couponIssue.code]:'Часть событий не обновилась. Сохранённые даты доступны; попробуйте позже.';setStatus(state.lastError,true);
   }
   scheduleCalendar();
  }catch(error){if(serial===state.calendarRequest){
   const sourceFailure=refresh==='bond-events'&&Number(error.status)>=500;
   if(sourceFailure){
    // Refresh only the retained view and its age after a failed source read.
    // This GET cannot start another provider request or retry the failed action.
    try{const saved=await request('/api/calendar?'+new URLSearchParams(query));if(serial===state.calendarRequest&&(!todayTicket||today.isCurrent(todayTicket))){state.data=saved;state.calendarDataKey=queryKey;}}catch{}
   }
   if(serial!==state.calendarRequest||todayTicket&&!today.isCurrent(todayTicket))return;
   if(todayTicket)today.reject(todayTicket);state.lastError=sourceFailure?'Не удалось обновить события выпуска. Сохранённые сведения не заменены; повторите загрузку.':error.message;setStatus(state.lastError,true);scheduleCalendar();
  }}
  finally{if(serial===state.calendarRequest&&(!todayTicket||today.isCurrent(todayTicket))){state.busy=false;renderCalendar();}}
 }
 function scheduleNews(){
  clearTimeout(newsTimer);if(disposed)return;
  newsTimer=setTimeout(()=>{if(document.visibilityState==='visible'&&$('.events-view')?.classList.contains('active')&&!state.newsLoading)void loadNews(state.newsInstrument,{refresh:true});else scheduleNews();},60000);
 }
 async function loadNews(instrumentUid=state.newsInstrument,{force=false,older=false,refresh=false}={}){
  if(!roots()||older&&state.newsLoading)return;
  state.newsInstrument=instrumentUid;const serial=++state.newsRequest;
  state.newsLoading=true;
  const asset=state.catalog.find(row=>row.instrumentUid===instrumentUid);
  $('#marketNewsTitle').textContent=instrumentUid?'Новости · '+(asset?.ticker||'выбранный актив'):'Новости';
  $('#marketNewsAll').hidden=!instrumentUid;
  newsPanel.loading({preserve:older||refresh});
  $('#newsMore').disabled=true;
  try{
   const query=new URLSearchParams({period:$('#newsPeriod').value,limit:'20',relevance:$('#newsRelevance').value,company:$('#newsCompany').value,source:$('#newsSource').value});
   if(instrumentUid)query.set('instrumentUid',instrumentUid);if(force)query.set('force','1');if(older&&state.newsCursor)query.set('cursor',state.newsCursor);
   const data=await request('/api/market/news?'+query);
   if(serial!==state.newsRequest)return;
   const previouslyLoaded=state.newsLoaded;
   state.newsLoaded=newsPanel.show(data,{append:older,refresh});state.newsLoadedAt=Date.now();
   if(!refresh||!previouslyLoaded)state.newsCursor=state.newsLoaded?data.nextCursor||'':'';
  }catch{if(serial===state.newsRequest){state.newsLoaded=false;newsPanel.failed();}}
  finally{if(serial===state.newsRequest){state.newsLoading=false;$('#newsMore').disabled=false;scheduleNews();}}
 }
 async function refreshCatalog(cycle=catalogPublication.capture()){
  if(disposed||!roots())return false;
  const ticket=catalogPublication.begin(cycle);
  $('#catalogRefresh').disabled=true;$('#catalogStatus').textContent='Загружаем акции и фьючерсы…';
  try{const data=await request('/api/market/catalog/refresh',{method:'POST',body:'{}'});return catalogPublication.publish(ticket,isCurrent=>fillCatalog(data,isCurrent));}
  catch(error){if(catalogPublication.current(ticket))$('#catalogStatus').textContent=error.message;return false;}
  finally{if(catalogPublication.current(ticket))$('#catalogRefresh').disabled=false;}
 }
 function updateSurfaces(){
  const available=roots();$('#catalogSurface').hidden=!available;$('#calendarSurface').hidden=!available;$('#marketNewsSurface').hidden=!available;
  $('#calendarAddReminder').disabled=!available;
  if(!available){started=false;clearTimeout(dueTimer);return;}
  if(!started){started=true;queueMicrotask(()=>{if(!disposed&&roots()){void loadFavorites().then(renderCatalog);void showDue();}});}
 }
 const change=()=>{state.page=0;renderCatalog();};
 $('#instrumentListSearch')?.addEventListener('input',renderCatalog);
 $('#instrumentListScope')?.addEventListener('change',renderCatalog);
 $('#instrumentQuickList')?.addEventListener('click',event=>{if(event.target.closest('[data-watch-more]')){watchLimit+=80;renderCatalog();}});
 document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-favorite-uid]');if(!button||favoritesBusy||!favoritesLoaded)return;
  const epoch=++favoritesEpoch,cycle=catalogPublication.capture(),current=()=>epoch===favoritesEpoch&&catalogPublication.currentCycle(cycle);
  favoritesBusy=true;renderCatalog();
  try{
   if(!favoriteList){const result=await request('/api/market/watchlists',{method:'POST',body:JSON.stringify({name:'Избранное'})});if(!current())return;favoriteList=result;}
   if(!current())return;
   const id=button.dataset.favoriteUid,add=!favorites.has(id);
   await request('/api/market/watchlists/'+encodeURIComponent(favoriteList.id)+'/items',{method:add?'POST':'DELETE',body:JSON.stringify({instrumentUid:id})});
   if(!current())return;
   if(add)favorites.add(id);else favorites.delete(id);
  }catch(error){if(current())showToast(error.message,true);}finally{
   if(catalogPublication.currentCycle(cycle)){favoritesBusy=false;if(current())renderCatalog();else void loadFavorites().then(()=>{if(!disposed)renderCatalog();});}
  }
 });
 connectTableSort($('#catalogBody').closest('table'),['name','currency','exchange','lot','sector','expirationDate',null],sort=>{state.sort=sort;change();});
 $('#catalogFilters').addEventListener('submit',event=>event.preventDefault());
 $('#catalogSearch').addEventListener('input',change);$('#catalogExtraFilters').addEventListener('change',change);
 for(const id of ['catalogHeld','catalogLotMin','catalogLotMax','catalogExpiry'])$('#'+id).addEventListener('input',change);
 $('#catalogReset').addEventListener('click',()=>{$('#catalogFilters').reset();state.page=0;renderCatalog();});
 $('#catalogPrevious').addEventListener('click',()=>{state.page--;renderCatalog();});$('#catalogNext').addEventListener('click',()=>{state.page++;renderCatalog();});
 $('#catalogRefresh').addEventListener('click',()=>void refreshCatalog());
 document.querySelectorAll('[data-catalog-type]').forEach(b=>b.addEventListener('click',()=>{state.assetType=b.dataset.catalogType;state.page=0;renderCatalog();}));
 $('#calendarGrid').addEventListener('click',event=>{const b=event.target.closest('[data-calendar-date]');if(b){state.day=b.dataset.calendarDate;renderCalendar();$('#calendarGrid [data-calendar-date="'+state.day+'"]')?.focus();}});
 $('#calendarGrid').addEventListener('keydown',event=>{
  const b=event.target.closest('[data-calendar-date]'),delta=({ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7})[event.key];if(!b||!delta)return;
  const day=new Date(b.dataset.calendarDate+'T12:00:00Z');day.setUTCDate(day.getUTCDate()+delta);const next=day.toISOString().slice(0,10);if(next.slice(0,7)!==state.month)return;
  event.preventDefault();state.day=next;renderCalendar();$('#calendarGrid [data-calendar-date="'+next+'"]')?.focus();
 });
 document.querySelectorAll('[data-month-step]').forEach(b=>b.addEventListener('click',()=>{const d=new Date(state.month+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+Number(b.dataset.monthStep));state.month=d.toISOString().slice(0,7);state.day=state.month+'-01';renderCalendar();void loadCalendar(true);}));
 $('#calendarUpcoming').addEventListener('click',event=>{const button=event.target.closest('[data-upcoming-date]');if(!button)return;state.day=button.dataset.upcomingDate;state.month=state.day.slice(0,7);if(!state.selectedAsset){state.type='all';$('#calendarType').value='all';$('#calendarUniverse').value='portfolio';$('#calendarAsset').value='';}renderCalendar();void loadCalendar(true);const target=$('#calendarGrid [data-calendar-date="'+state.day+'"]');target?.focus({preventScroll:true});target?.scrollIntoView({block:'center',behavior:'instant'});});
 $('#calendarToday').addEventListener('click',()=>{state.day=moscowDate();state.month=state.day.slice(0,7);renderCalendar();void loadCalendar(true);});
 $('#calendarRefresh')?.addEventListener('click',()=>void loadCalendar('force'));
 $('#calendarBondEventsRefresh')?.addEventListener('click',()=>void loadCalendar('bond-events'));
 $('#calendarUniverse').addEventListener('change',()=>void loadCalendar(true));
 $('#calendarAsset').addEventListener('input',e=>populateAssets(e.target.value));$('#reminderAsset').addEventListener('input',e=>populateAssets(e.target.value));
 $('#calendarAsset').addEventListener('change',e=>{state.selectedAsset=instrument(e.target.value)?.instrumentUid||'';if(e.target.value&&!state.selectedAsset){setStatus('Выберите актив из подсказок.',true);return;}void loadCalendar(true);});
 $('#calendarType').addEventListener('change',e=>{state.type=e.target.value;renderCalendar();});
 $('#calendarAddReminder').addEventListener('click',()=>openEditor(state.catalog.find(r=>r.instrumentUid===state.selectedAsset),state.day));
 $('#reminderCancel').addEventListener('click',()=>{if(state.editorBusy)return;state.editorRevision++;state.editing=null;state.editingRow=null;$('#reminderEditor').hidden=true;remindersTransfer.update();$('#calendarAddReminder').focus();});
 $('#reminderForm').addEventListener('input',()=>{state.editorRevision++;remindersTransfer.update();});
 $('#reminderForm').addEventListener('submit',async e=>{
  e.preventDefault();if(state.editorBusy||!reminderAccess().canNative)return;const asset=instrument($('#reminderAsset').value),retained=state.editingRow&&!$('#reminderEnabled').checked&&$('#reminderAsset').value===state.editingRow.instrumentUid?state.editingRow:null;if(!asset&&!retained){$('#reminderFormStatus').textContent='Выберите актив из подсказок.';return;}
  const due=new Date($('#reminderDate').value+'T'+$('#reminderTime').value+':00+03:00');if(!Number.isFinite(due.getTime()))return;
  const key=reminderAccess().key,revision=state.editorRevision,current=()=>key===reminderAccess().key&&revision===state.editorRevision;state.editorBusy=true;remindersTransfer.update();$('#reminderForm').querySelectorAll('input,textarea,button').forEach(el=>el.disabled=true);
  try {await request('/api/calendar/reminders',{method:'POST',body:JSON.stringify({...(state.editing?{id:state.editing}:{}),instrumentUid:(asset||retained).instrumentUid,title:$('#reminderTitle').value,note:$('#reminderNote').value,dueAt:state.editingRow&&due.toISOString().slice(0,16)===state.editingRow.dueAt.slice(0,16)?state.editingRow.dueAt:due.toISOString(),timezone:'Europe/Moscow',enabled:$('#reminderEnabled').checked})});
   if(!current())return;$('#reminderEditor').hidden=true;state.editing=null;state.editingRow=null;state.editorBusy=false;state.editorRevision++;remindersTransfer.update();showToast('Напоминание сохранено');await remindersTransfer.refresh();await loadCalendar();if(key===reminderAccess().key)$('#calendarAddReminder').focus();
  }catch(error){if(current())$('#reminderFormStatus').textContent=error.message;}finally{if(key===reminderAccess().key){state.editorBusy=false;$('#reminderForm').querySelectorAll('input,textarea,button').forEach(el=>el.disabled=false);remindersTransfer.update();}}
 });
 for(const [id,key]of [['calendarAutoEvents','autoEvents'],['calendarNative','nativeNotifications']])$('#'+id).addEventListener('change',async e=>{
  const value=e.target.checked;try{await request('/api/calendar/settings',{method:'POST',body:JSON.stringify({[key]:value})});await loadCalendar();}catch(error){e.target.checked=!value;showToast(error.message,true);}
 });
 document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-chart-uid],[data-plan-uid],[data-edit-reminder],[data-delete-reminder],[data-ack-reminder],[data-event-uid]');
  if(!b)return;
  try {
   if(b.dataset.chartUid){const asset=state.catalog.find(r=>r.instrumentUid===b.dataset.chartUid)||(getBootstrap()?.instruments||[]).find(r=>r.instrumentUid===b.dataset.chartUid);onChartSelect(asset);}
   if(b.dataset.planUid){document.querySelector('[data-view="events"]')?.click();openEditor(state.catalog.find(r=>r.instrumentUid===b.dataset.planUid),b.dataset.planDate||state.day);}
   if(b.dataset.editReminder)editReminder(b.dataset.editReminder);
   if(b.dataset.deleteReminder){await request('/api/calendar/reminders/'+b.dataset.deleteReminder,{method:'DELETE'});await loadCalendar();}
   if(b.dataset.ackReminder){await request('/api/calendar/reminders/'+b.dataset.ackReminder+'/acknowledge',{method:'POST',body:'{}'});await loadCalendar();}
   if(b.dataset.eventUid){void loadNews(b.dataset.eventUid);$('#marketNewsSurface').scrollIntoView({block:'start'});}
  }catch(error){showToast(error.message,true);}
 });


 for(const id of ['newsPeriod','newsRelevance','newsCompany','newsSource'])$('#'+id).addEventListener('change',()=>{state.newsCursor='';void loadNews();});
 document.addEventListener('invest:terminal-news',e=>{void loadNews(e.detail?.instrumentUid||'');$('#marketNewsSurface').scrollIntoView({block:'start'});});
 $('#marketNewsAll').addEventListener('click',()=>void loadNews(''));
 let dueTimer;
 async function showDue(){
  if(disposed||!roots())return;
  try{const result=await request('/api/calendar/due');if(!result.nativeAvailable&&result.reminders.length&&!$('#calendarDueDialog').open){
   $('#calendarDueContent').textContent=result.reminders.map(r=>r.title+'\n'+r.note).join('\n\n');
   $('#calendarDueDialog').dataset.ids=JSON.stringify(result.reminders.map(r=>r.id));$('#calendarDueDialog').showModal();
  }}catch{}finally{if(!disposed)dueTimer=setTimeout(showDue,30000);}
 }
 for(const [id,action]of [['calendarDueAck','acknowledge'],['calendarDueSnooze','snooze']])$('#'+id).addEventListener('click',async()=>{
  try{for(const id of JSON.parse($('#calendarDueDialog').dataset.ids||'[]'))await request('/api/calendar/reminders/'+id+'/'+action,{method:'POST',body:'{}'});$('#calendarDueDialog').close();await loadCalendar();}
  catch(error){showToast(error.message,true);}
 });
 $('#calendarDueDialog').addEventListener('cancel',e=>{e.preventDefault();$('#calendarDueSnooze').click();});
 void refreshHoldings();
 window.addEventListener('pagehide',()=>{disposed=true;bondHistory.dispose();couponHistory.dispose();listsTransfer.dispose();remindersTransfer.dispose();catalogPublication.dispose();today.dispose();stopHeader();clearTimeout(calendarTimer);clearTimeout(newsTimer);clearTimeout(dueTimer);},{once:true});
 // An access or research-scope change empties the overview «Сегодня» dates; read
 // them again instead of leaving the block «Недоступно» until the calendar page opens.
 function ensureTodayCalendar(){if(!disposed&&!state.busy&&roots()&&today.getSnapshot().state==='unavailable')void loadCalendar();}
 return { getTodaySnapshot:today.getSnapshot,ensureTodayCalendar,updateTodayAccess,updateReminderAccess,openBondCoupons,openEvent:today.openEvent,openReminder:today.openReminder,refreshHoldings,loadNews,ensureNews:()=>state.newsLoading?Promise.resolve():state.newsLoaded&&Date.now()-state.newsLoadedAt<60000?Promise.resolve():loadNews(state.newsInstrument,{refresh:state.newsLoaded}),getCatalog:()=>state.catalog,
  openInstrumentChart:id=>onChartSelect(state.catalog.find(row=>row.instrumentUid===id)),
  openCatalogInstrument:id=>{$('#instrumentCatalogBrowser').open=true;const asset=state.catalog.find(row=>row.instrumentUid===id);if(!asset)return;state.assetType=asset.assetType;$('#catalogFilters').reset();$('#catalogSearch').value=asset.ticker||asset.name;state.page=0;renderCatalog();}
 };
}
