import { marketWatchlist } from './market-watchlist.js';
import { enhanceFilterSelect } from './filter-select.js';
import { createAutoRefresh } from './auto-refresh.js';
import { followTableHeader } from './sticky-table.js';
import { initNewsPanel } from './news-panel.js';
import { connectTableSort, sortRows } from './table-sort.js';
import { instrumentMark, watchInstrumentImages } from './instrument-mark.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const moscowDate=(date=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
const dateLabel=value=>new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'long',year:'numeric'}).format(new Date(value+'T12:00:00Z'));
const money=(value,currency='RUB')=>value==null?'—':new Intl.NumberFormat('ru-RU',{style:'currency',currency:currency.toUpperCase(),maximumFractionDigits:2}).format(Number(BigInt(value))/1e9);
const typeNames={dividend:'Дивиденды',expiration:'Экспирации',report:'Отчёты',reminder:'Мои даты'};
const fieldLabels={currency:'Валюта',exchange:'Биржа',sector:'Сектор',countryOfRiskName:'Страна',basicAsset:'Базовый актив',futuresType:'Тип фьючерса',shareType:'Тип акции',classCode:'Режим торгов',realExchange:'Площадка'};
const boolLabels={shortEnabledFlag:'Доступен шорт',forQualInvestorFlag:'Для квалифицированных',apiTradeAvailableFlag:'Доступен через API',buyAvailableFlag:'Доступна покупка',sellAvailableFlag:'Доступна продажа',liquidityFlag:'Ликвидный',otcFlag:'Внебиржевой',forIisFlag:'Доступен на ИИС',divYieldFlag:'Дивидендная доходность'};
export function selectUpcomingEvents(data, reminders, today) {
 const rows=[...(data?.portfolioUpcoming||[]),...(data?.upcoming||[]),...(data?.events||[]),...reminders];
 return [...new Map(rows.filter(e=>e.date>=today&&!e.cancelled&&(e.inPortfolio||e.type==='reminder'&&!e.acknowledgedAt)).map(e=>[e.id,e])).values()]
  .sort((a,b)=>a.date.localeCompare(b.date)||String(a.at||'').localeCompare(String(b.at||''))).slice(0,3);
}
export function initMarketCalendar({request,getBootstrap,onChartSelect,showToast,refreshPortfolio}) {
 const $=s=>document.querySelector(s);
 const heading=$('.instrument-heading'),shortlist=$('.instrument-shortlist'),chart=$('.instrument-surface');
 if(heading&&shortlist)shortlist.insertBefore(heading,$('.instrument-list-controls'));
 if(chart)chart.after($('#instrumentCatalogBrowser'));
 const stopHeader=followTableHeader($('#catalogSurface .table-scroll'));
 const state={catalog:[],month:'2026-09',day:'2026-09-22',type:'all',assetType:'all',page:0,data:null,busy:false,editing:null,selectedAsset:'',calendarRequest:0,lastError:null,newsInstrument:'',newsRequest:0,newsLoaded:false,newsCursor:'',newsLoading:false,newsLoadedAt:0};
 const newsPanel=initNewsPanel({request,getCatalog:()=>state.catalog,onMore:()=>loadNews(state.newsInstrument,{older:true})});
 for(const [id,icon] of [['newsPeriod','calendar'],['newsRelevance','user'],['newsCompany','building'],['newsSource','news']])enhanceFilterSelect($('#'+id),icon);
 let favoriteList=null,favorites=new Set(),favoritesBusy=false,favoritesLoaded=false,watchLimit=80,watchFilter='';
 function favoriteButton(row){const selected=favorites.has(row.instrumentUid);return '<button type="button" class="instrument-favorite'+(selected?' active':'')+'" data-favorite-uid="'+esc(row.instrumentUid)+'" aria-pressed="'+selected+'" aria-label="'+(selected?'Убрать из избранного: ':'В избранное: ')+esc(row.ticker||row.name)+'" '+(!favoritesLoaded||favoritesBusy?'disabled':'')+'><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m12 3 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3L2.9 9.6l6.3-.9Z"/></svg></button>';}
 async function loadFavorites(){
  try{const result=await request('/api/market/watchlists');favoriteList=(result.items||[]).find(row=>row.name==='Избранное')||null;favorites=new Set((favoriteList?.items||[]).map(row=>row.instrumentUid));favoritesLoaded=true;}
  catch{favoritesLoaded=false;}
 }
 let poller=null,calendarTimer=null,newsTimer=null,disposed=false,lastConnectionKey=null,lastHoldingsKey=null,hydrationRunning=false,hydrationAgain=false;
 const roots=()=>getBootstrap()?.capabilities?.marketCalendar===true&&(!getBootstrap()?.preview?.static || getBootstrap()?.preview?.interactiveTutorial === true)&&!getBootstrap()?.preview?.localReview;
 const label=r=>[r.ticker,r.name,r.classCode].filter(Boolean).join(' · ');
 const eventLabel=e=>e.ticker&&String(e.title||'').startsWith(e.ticker+' · ')?e.title:[e.ticker,e.title].filter(Boolean).join(' · ');
 const instrument=input=>state.catalog.find(r=>label(r)===input || r.instrumentUid===input);
 function populateAssets(query='') {
  const rows=state.catalog.filter(r=>!query||label(r).toLowerCase().includes(query.toLowerCase())).sort((a,b)=>Number(b.inPortfolio)-Number(a.inPortfolio)).slice(0,60);
  $('#marketAssetSuggestions').innerHTML=rows.map(r=>'<option value="'+esc(label(r))+'"></option>').join('');
 }
 function options(){return{month:state.month,universe:$('#calendarUniverse').value,...(state.selectedAsset?{instrumentUid:state.selectedAsset}:{})};}
 function setStatus(text,error=false){$('#calendarStatus').textContent=text;$('#calendarStatus').classList.toggle('negative',error);}
 function fillCatalog(data) {
  state.catalog=data.items||[];populateAssets();
  document.dispatchEvent(new Event('invest:catalog-updated'));
  const filters=$('#catalogExtraFilters');
  const old=Object.fromEntries([...filters.querySelectorAll('select')].map(el=>[el.name,el.value]));
  const attributes=Object.entries(fieldLabels).map(([key,title])=>{
   const values=[...new Set(state.catalog.map(r=>r[key]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru'));
   return '<label><span>'+title+'</span><select name="'+key+'"><option value="">Все</option>'+values.map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join('')+'</select></label>';
  }).join('');
  const availability=Object.entries(boolLabels).map(([key,title])=>'<label><span>'+title+'</span><select name="'+key+'"><option value="">Любое значение</option><option value="true">Да</option><option value="false">Нет</option></select></label>').join('');
  filters.innerHTML='<fieldset><legend>Рынок и характеристики</legend><div class="catalog-filter-fields">'+attributes+'</div></fieldset><fieldset><legend>Доступность и условия</legend><div class="catalog-filter-fields">'+availability+'</div></fieldset>';
  for(const el of filters.querySelectorAll('select'))if(old[el.name])el.value=old[el.name];
  $('#catalogStatus').textContent=data.warnings?.length?'Часть каталога не обновилась. Сохранённые данные доступны.':data.capturedAt?'Каталог Т‑Инвест · '+new Date(data.capturedAt).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})+' мск'+(data.stale?' · требуется обновление':''):'Каталог ещё не загружен.';
  renderCatalog();
 }
 function renderCatalog() {
  const watchCatalog=marketWatchlist(state.catalog,getBootstrap()?.instruments,favorites);
  const held=watchCatalog.filter(r=>r.inPortfolio),scope=$('#instrumentListScope')?.value||'portfolio',search=($('#instrumentListSearch')?.value||'').trim().toLowerCase();
  const filter=scope+':'+search;if(filter!==watchFilter){watchLimit=80;watchFilter=filter;}
  const quick=(scope==='favorites'?watchCatalog.filter(r=>favorites.has(r.instrumentUid)):scope==='all'?watchCatalog:['share','future'].includes(scope)?watchCatalog.filter(r=>r.assetType===scope):held).filter(row=>!search||label(row).toLowerCase().includes(search));
  $('#instrumentShortlistTitle').textContent='Список наблюдения';
  const quotes=getBootstrap()?.positions||[];
  let quickMarkup=quick.slice(0,watchLimit).map(r=>{
   const quote=quotes.find(p=>p.instrumentUid===r.instrumentUid),price=quote?.currentPriceNanos??quote?.priceNanos;
   const priceText=price==null?'':r.assetType==='future'?new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(Number(BigInt(price))/1e9)+' п.':money(price,r.currency||'RUB');
   return '<div class="instrument-watch-row"><button type="button" class="instrument-quick-item" data-chart-uid="'+esc(r.instrumentUid)+'">'+instrumentMark(r)+'<span><strong>'+esc(r.ticker||r.name)+'</strong><small>'+esc(r.name)+'</small></span>'+(price!=null?'<span class="watch-price">'+esc(priceText)+'</span>':'')+'</button>'+favoriteButton(r)+'</div>';
  }).join('')||'<p class="empty-copy">'+(scope==='favorites'?'Добавьте активы в избранное с помощью звезды.':'Активы не найдены.')+'</p>';
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
      (e.amountNanos!=null?'<p>'+esc(money(e.amountNanos,e.currency||'RUB'))+' на бумагу</p>':'')+
      (e.note?'<p>'+esc(e.note)+'</p>':'')+
      (e.reminder?'<div class="agenda-actions"><button type="button" data-edit-reminder="'+esc(e.id)+'">Изменить</button><button type="button" data-delete-reminder="'+esc(e.id)+'">Удалить</button>'+(!e.acknowledgedAt?'<button type="button" data-ack-reminder="'+esc(e.id)+'">Просмотрено</button>':'<small>Просмотрено</small>')+'</div>':'<div class="agenda-actions"><button type="button" data-event-uid="'+esc(e.instrumentUid)+'">Новости компании</button>'+(e.url?'<a href="'+esc(e.url)+'" target="_blank" rel="noopener noreferrer">Источник ↗</a>':'')+'</div><small>'+esc(e.source||'')+'</small>')+'</div></details>';
   }).join('')||'<p class="empty-copy">На этот день нет загруженных событий. Выберите другую дату или добавьте напоминание.</p>';
   agenda.renderedSignature=signature;watchInstrumentImages(agenda);
   if(focused)agenda.querySelector('[data-agenda-key="'+CSS.escape(focused)+'"]')?.focus({preventScroll:true});
  }
  const coverage=state.data?.coverage;
  if(!state.busy&&!state.lastError)setStatus('');
  $('#calendarCoverageNote').textContent='';
  const personal=(state.data?.reminders||[]).filter(r=>r.enabled&&!r.sourceEventId).map(r=>({id:r.id,type:'reminder',date:moscowDate(new Date(r.snoozedUntil||r.dueAt)),at:r.dueAt,title:r.title,acknowledgedAt:r.acknowledgedAt}));
  const upcoming=selectUpcomingEvents(state.data,personal,moscowDate());
  $('#calendarUpcoming').innerHTML=upcoming.map(e=>'<button type="button" class="upcoming-'+esc(e.type)+'" data-upcoming-date="'+e.date+'"><time>'+esc(new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(e.date+'T12:00:00Z')))+'</time><span><small class="upcoming-kind">'+esc(typeNames[e.type])+'</small><strong>'+esc([e.ticker,e.title].filter(Boolean).join(' · '))+'</strong><small>'+esc(e.inPortfolio?'В вашем портфеле':'Личное напоминание')+'</small></span></button>').join('')||'<p class="empty-copy">'+(coverage?.pending||coverage?.stale?'Проверяем опубликованные даты. Загруженные события будут появляться здесь.':'Для ваших активов пока нет ближайших опубликованных дат. Можно добавить своё напоминание.')+'</p>';
  if(state.data){$('#calendarAutoEvents').checked=state.data.preferences.autoEvents;$('#calendarNative').checked=state.data.preferences.nativeNotifications;
   $('#calendarNotificationNote').textContent=state.data.nativeAvailable?'Окно Windows поверх программ, пока Invest запущен. Пропущенные напоминания появятся при следующем запуске. Время — московское.':'В этом просмотре напоминания появляются внутри Invest. Окно поверх программ доступно в установленной версии Windows.';}
 }
 async function refreshHoldings(){
  if(disposed||!roots())return;
  if(hydrationRunning){hydrationAgain=true;return;}
  hydrationRunning=true;
  try{
   const bootstrap=getBootstrap(),connection=bootstrap?.connection;
   const key=bootstrap?.environment==='fixture'?'fixture':connection?.connected?[connection.environment,connection.validatedAt,connection.accountCount].join('|'):'';
   const held=new Set((bootstrap?.clientProduct?.openPositions||[]).map(r=>r.instrumentUid));
   const signature=[...held].sort().join('|'),connectionChanged=key!==lastConnectionKey,holdingsChanged=signature!==lastHoldingsKey;
   lastConnectionKey=key;lastHoldingsKey=signature;
   if(connectionChanged){
    ++state.calendarRequest;++state.newsRequest;clearTimeout(calendarTimer);
    state.data=null;state.catalog=[];state.lastError=null;
    fillCatalog({items:[],capturedAt:null});
    newsPanel.reset();state.newsLoaded=false;state.newsCursor='';state.newsLoadedAt=0;
   }
   if(!key){state.data=null;renderCalendar();setStatus('Подключите брокерский счёт, чтобы загрузить календарь.');$('#catalogStatus').textContent='Каталог появится после подключения брокера.';return;}
   if(connectionChanged||!state.catalog.length){
    const data=await request('/api/market/catalog');fillCatalog(data);
    if(data.stale)await refreshCatalog();
   }
   state.catalog.forEach(r=>r.inPortfolio=held.has(r.instrumentUid));renderCatalog();
   if(state.data){for(const list of [state.data.events,state.data.upcoming,state.data.portfolioUpcoming])list?.forEach(e=>e.inPortfolio=held.has(e.instrumentUid));renderCalendar();}
   if(connectionChanged||holdingsChanged||!state.data)await loadCalendar(true);
   if($('.events-view')?.classList.contains('active')&&(holdingsChanged||connectionChanged||!state.newsLoaded))void loadNews();
  }catch(error){setStatus(error.message,true);}
  finally{hydrationRunning=false;if(hydrationAgain){hydrationAgain=false;void refreshHoldings();}}
 }

 function openEditor(asset,date=state.day){
  $('#reminderFormStatus').textContent='';
  state.editing=null;$('#reminderForm').reset();$('#reminderAsset').value=asset?label(asset):'';$('#reminderDate').value=date;$('#reminderTime').value='09:00';
  $('#reminderSave').textContent='Сохранить напоминание';$('#reminderEditor').hidden=false;$('#reminderEditor').scrollIntoView({block:'center'});$('#reminderAsset').focus({preventScroll:true});
 }
 function editReminder(id){
  const row=state.data.reminders.find(r=>r.id===id);if(!row)return;
  openEditor(state.catalog.find(r=>r.instrumentUid===row.instrumentUid),moscowDate(new Date(row.dueAt)));state.editing=id;
  $('#reminderTime').value=new Date(Date.parse(row.dueAt)+3*3600000).toISOString().slice(11,16);$('#reminderNote').value=row.note;$('#reminderSave').textContent='Сохранить изменения';
 }
 function scheduleCalendar(){
  clearTimeout(calendarTimer);if(disposed||getBootstrap()?.preview?.readOnly)return;
  calendarTimer=setTimeout(()=>{if(document.visibilityState==='visible'&&$('.events-view')?.classList.contains('active'))void loadCalendar(true);else scheduleCalendar();},60000);
 }
 async function loadCalendar(refresh=false){if(getBootstrap()?.preview?.readOnly)refresh=false;
  if(!roots())return;
  clearTimeout(calendarTimer);const serial=++state.calendarRequest,query=options();
  state.busy=true;state.lastError=null;if(!state.data)setStatus('Загружаем события…');
  try{
   const data=refresh?await request('/api/calendar/refresh',{method:'POST',body:JSON.stringify(query)}):await request('/api/calendar?'+new URLSearchParams(query));
   if(serial!==state.calendarRequest)return;state.data=data;
   if(data.warnings?.length){state.lastError='Часть событий не обновилась. Сохранённые даты доступны; попробуйте позже.';setStatus(state.lastError,true);}
   scheduleCalendar();
  }catch(error){if(serial===state.calendarRequest){state.lastError=error.message;setStatus(error.message,true);scheduleCalendar();}}
  finally{if(serial===state.calendarRequest){state.busy=false;renderCalendar();}}
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
  if(!refresh)$('#marketNewsStatus').textContent=older?'Загружаем ещё публикации…':'Загружаем новости…';
  $('#newsMore').disabled=true;
  try{
   const query=new URLSearchParams({period:$('#newsPeriod').value,limit:'20',relevance:$('#newsRelevance').value,company:$('#newsCompany').value,source:$('#newsSource').value});
   if(instrumentUid)query.set('instrumentUid',instrumentUid);if(force)query.set('force','1');if(older&&state.newsCursor)query.set('cursor',state.newsCursor);
   const data=await request('/api/market/news?'+query);
   if(serial!==state.newsRequest)return;state.newsLoaded=true;state.newsLoadedAt=Date.now();
   if(!refresh)state.newsCursor=data.nextCursor||'';
   $('#marketNewsStatus').textContent=data.unavailable?'Источник новостей временно недоступен. Повторим автоматически.':data.refreshFailed?'Пока показаны сохранённые новости. Повторим автоматически.':data.fixture?'Учебная лента':'';
   newsPanel.show(data,{append:older,refresh});
  }catch(error){if(serial===state.newsRequest)$('#marketNewsStatus').textContent=error.message;}
  finally{if(serial===state.newsRequest){state.newsLoading=false;$('#newsMore').disabled=false;scheduleNews();}}
 }
 async function refreshCatalog(){
  $('#catalogRefresh').disabled=true;$('#catalogStatus').textContent='Загружаем акции и фьючерсы…';
  try{fillCatalog(await request('/api/market/catalog/refresh',{method:'POST',body:'{}'}));}
  catch(error){$('#catalogStatus').textContent=error.message;}
  finally{$('#catalogRefresh').disabled=false;}
 }
 async function start(){
  const available=roots();$('#catalogSurface').hidden=!available;$('#calendarSurface').hidden=!available;$('#marketNewsSurface').hidden=!available;
  $('#calendarAddReminder').disabled=!available;
  $('#autoRefreshStatus').hidden=!available;
  if(!available)return;
  if(getBootstrap()?.environment==='fixture')$('#autoRefreshStatus').textContent='Учебный просмотр · реальные позиции не обновляются';
  await refreshHoldings();
  if(getBootstrap()?.capabilities?.portfolioRefresh) {
   poller=createAutoRefresh({eligible:()=>!disposed&&roots()&&getBootstrap()?.connection?.connected&&document.visibilityState==='visible'&&!$('#syncButton').disabled,
    refresh:refreshPortfolio,onState:event=>{
     const node=$('#autoRefreshStatus');
      node.textContent=event.state==='updating'?'Обновляем позиции…':event.state==='ready'?'Позиции обновляются автоматически · 10 сек':event.state==='waiting'?'Ожидаем окончания синхронизации':'Обновление задерживается · повторим автоматически';
      node.title=event.state==='error' ? [event.message,event.code].filter(Boolean).join(' · ') : '';
     node.classList.toggle('negative',event.state==='error');
    }});
   if(getBootstrap()?.environment!=='fixture')poller.start();
  }
 }
 const change=()=>{state.page=0;renderCatalog();};
 $('#instrumentListSearch')?.addEventListener('input',renderCatalog);
 $('#instrumentListScope')?.addEventListener('change',renderCatalog);
 $('#instrumentQuickList')?.addEventListener('click',event=>{if(event.target.closest('[data-watch-more]')){watchLimit+=80;renderCatalog();}});
 document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-favorite-uid]');if(!button||favoritesBusy||!favoritesLoaded)return;
  favoritesBusy=true;renderCatalog();
  try{
   if(!favoriteList)favoriteList=await request('/api/market/watchlists',{method:'POST',body:JSON.stringify({name:'Избранное'})});
   const id=button.dataset.favoriteUid,add=!favorites.has(id);
   await request('/api/market/watchlists/'+encodeURIComponent(favoriteList.id)+'/items',{method:add?'POST':'DELETE',body:JSON.stringify({instrumentUid:id})});
   if(add)favorites.add(id);else favorites.delete(id);
  }catch(error){showToast(error.message,true);}finally{favoritesBusy=false;renderCatalog();}
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
 $('#calendarUpcoming').addEventListener('click',event=>{const button=event.target.closest('[data-upcoming-date]');if(!button)return;state.day=button.dataset.upcomingDate;state.month=state.day.slice(0,7);state.type='all';state.selectedAsset='';$('#calendarType').value='all';$('#calendarUniverse').value='portfolio';$('#calendarAsset').value='';renderCalendar();void loadCalendar(true);$('#calendarGrid').scrollIntoView({block:'center'});});
 $('#calendarToday').addEventListener('click',()=>{state.day=moscowDate();state.month=state.day.slice(0,7);renderCalendar();void loadCalendar(true);});
 $('#calendarUniverse').addEventListener('change',()=>void loadCalendar(true));
 $('#calendarAsset').addEventListener('input',e=>populateAssets(e.target.value));$('#reminderAsset').addEventListener('input',e=>populateAssets(e.target.value));
 $('#calendarAsset').addEventListener('change',e=>{state.selectedAsset=instrument(e.target.value)?.instrumentUid||'';if(e.target.value&&!state.selectedAsset){setStatus('Выберите актив из подсказок.',true);return;}void loadCalendar(true);});
 $('#calendarType').addEventListener('change',e=>{state.type=e.target.value;renderCalendar();});
 $('#calendarAddReminder').addEventListener('click',()=>openEditor(state.catalog.find(r=>r.instrumentUid===state.selectedAsset),state.day));
 $('#reminderCancel').addEventListener('click',()=>{$('#reminderEditor').hidden=true;$('#calendarAddReminder').focus();});
 $('#reminderForm').addEventListener('submit',async e=>{
  e.preventDefault();const asset=instrument($('#reminderAsset').value);if(!asset){$('#reminderFormStatus').textContent='Выберите актив из подсказок.';return;}
  const due=new Date($('#reminderDate').value+'T'+$('#reminderTime').value+':00+03:00');if(!Number.isFinite(due.getTime()))return;
  $('#reminderSave').disabled=true;
  try {await request('/api/calendar/reminders',{method:'POST',body:JSON.stringify({...(state.editing?{id:state.editing}:{}),instrumentUid:asset.instrumentUid,title:asset.ticker+' · Посмотреть актив',note:$('#reminderNote').value,dueAt:due.toISOString(),timezone:'Europe/Moscow'})});
   $('#reminderEditor').hidden=true;showToast('Напоминание сохранено');await loadCalendar();$('#calendarAddReminder').focus();
  }catch(error){$('#reminderFormStatus').textContent=error.message;}finally{$('#reminderSave').disabled=false;}
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
 void start().then(async()=>{if(roots()){await loadFavorites();renderCatalog();void showDue();}});
 window.addEventListener('pagehide',()=>{disposed=true;stopHeader();poller?.stop();clearTimeout(calendarTimer);clearTimeout(newsTimer);clearTimeout(dueTimer);},{once:true});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void poller?.tick();});
 return { refreshHoldings,loadNews,ensureNews:()=>state.newsLoading?Promise.resolve():state.newsLoaded&&Date.now()-state.newsLoadedAt<60000?Promise.resolve():loadNews(state.newsInstrument,{refresh:state.newsLoaded}),getCatalog:()=>state.catalog,
  openInstrumentChart:id=>onChartSelect(state.catalog.find(row=>row.instrumentUid===id)),
  openCatalogInstrument:id=>{$('#instrumentCatalogBrowser').open=true;const asset=state.catalog.find(row=>row.instrumentUid===id);if(!asset)return;state.assetType=asset.assetType;$('#catalogFilters').reset();$('#catalogSearch').value=asset.ticker||asset.name;state.page=0;renderCatalog();}
 };
}
