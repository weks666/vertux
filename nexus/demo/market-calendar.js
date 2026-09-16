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
export function initMarketCalendar({request,getBootstrap,onChartSelect,showToast,refreshPortfolio}) {
 const $=s=>document.querySelector(s);
 const stopHeader=followTableHeader($('#catalogSurface .table-scroll'));
 const state={catalog:[],month:moscowDate().slice(0,7),day:moscowDate(),type:'all',assetType:'share',page:0,data:null,busy:false,editing:null,selectedAsset:'',calendarRequest:0,lastError:null,newsInstrument:'',newsRequest:0,newsLoaded:false};
 const newsPanel=initNewsPanel({request});
 let poller=null,calendarTimer=null,disposed=false,lastConnectionKey=null,lastHoldingsKey=null,hydrationRunning=false,hydrationAgain=false;
 const roots=()=>getBootstrap()?.capabilities?.marketCalendar===true&&(!getBootstrap()?.preview?.static || getBootstrap()?.preview?.interactiveTutorial === true)&&!getBootstrap()?.preview?.localReview;
 const label=r=>[r.ticker,r.name,r.classCode].filter(Boolean).join(' · ');
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
  filters.innerHTML=Object.entries(fieldLabels).map(([key,title])=>{
   const values=[...new Set(state.catalog.map(r=>r[key]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru'));
   return '<label><span>'+title+'</span><select name="'+key+'"><option value="">Все</option>'+values.map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join('')+'</select></label>';
  }).join('')+Object.entries(boolLabels).map(([key,title])=>'<label><span>'+title+'</span><select name="'+key+'"><option value="">Любое значение</option><option value="true">Да</option><option value="false">Нет</option></select></label>').join('');
  for(const el of filters.querySelectorAll('select'))if(old[el.name])el.value=old[el.name];
  $('#catalogStatus').textContent=data.warnings?.length?'Часть каталога не обновилась. Сохранённые данные доступны.':data.capturedAt?'Каталог Т‑Инвест · '+new Date(data.capturedAt).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})+' мск'+(data.stale?' · требуется обновление':''):'Каталог ещё не загружен.';
  renderCatalog();
 }
 function renderCatalog() {
  const query=$('#catalogSearch').value.trim().toLowerCase(),filters=Object.fromEntries([...$('#catalogExtraFilters').querySelectorAll('select')].filter(el=>el.value!=='').map(el=>[el.name,el.value]));
  const min=Number($('#catalogLotMin').value),max=$('#catalogLotMax').value?Number($('#catalogLotMax').value):Infinity;
  const expiry=$('#catalogExpiry').value;
  const rows=sortRows(state.catalog.filter(r=>r.assetType===state.assetType&&(!query||label(r).toLowerCase().includes(query))&&(!$('#catalogHeld').checked||r.inPortfolio)
   &&(!$('#catalogLotMin').value||r.lot!==null&&r.lot>=min)&&(!$('#catalogLotMax').value||r.lot!==null&&r.lot<=max)
   &&(!expiry||r.expirationDate&&r.expirationDate.slice(0,10)<=expiry)
   &&Object.entries(filters).every(([k,v])=>String(r[k])===v)),state.sort||{key:'name',direction:'asc'},{name:label,sector:r=>r.assetType==='future'?r.basicAsset:r.sector,expirationDate:r=>r.expirationDate?Date.parse(r.expirationDate):null});
  state.page=Math.max(0,Math.min(state.page,Math.ceil(rows.length/25)-1));
  $('#catalogBody').innerHTML=rows.slice(state.page*25,(state.page+1)*25).map(r=>'<tr><td><button class="instrument-link" type="button" data-chart-uid="'+esc(r.instrumentUid)+'">'+instrumentMark(r)+'<span class="instrument-label"><strong>'+esc(r.ticker)+'</strong><span>'+esc(r.name)+'</span></span></button>'+(r.inPortfolio?'<small class="portfolio-mark">В портфеле</small>':'')+'</td><td>'+esc(r.currency.toUpperCase()||'—')+'</td><td>'+esc(r.exchange||'—')+'</td><td class="numeric">'+esc(r.lot??'—')+'</td><td>'+esc(r.assetType==='future'?(r.basicAsset||'—'):(r.sector||'—'))+'</td><td>'+esc(r.expirationDate?r.expirationDate.slice(0,10):'—')+'</td><td><button class="button secondary compact" type="button" data-plan-uid="'+esc(r.instrumentUid)+'">Напомнить</button></td></tr>').join('')||'<tr><td colspan="7" class="empty-cell">Нет инструментов по этим фильтрам. Измените условия или обновите каталог.</td></tr>';
  watchInstrumentImages($('#catalogBody'));
  $('#catalogCount').textContent=rows.length?((state.page*25+1)+'–'+Math.min(rows.length,(state.page+1)*25)+' из '+rows.length):'0 инструментов';
  $('#catalogPrevious').disabled=state.page===0;$('#catalogNext').disabled=(state.page+1)*25>=rows.length;
  document.querySelectorAll('[data-catalog-type]').forEach(b=>{b.classList.toggle('active',b.dataset.catalogType===state.assetType);b.setAttribute('aria-pressed',String(b.dataset.catalogType===state.assetType));});
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
  $('#calendarGrid').innerHTML=Array.from({length:Math.ceil((offset+days)/7)*7},(_,index)=>{
   const number=index-offset+1;
   if(number<1||number>days)return '<span class="calendar-day outside" aria-hidden="true"></span>';
   const date=state.month+'-'+String(number).padStart(2,'0'),items=all.filter(e=>e.date===date),owned=items.some(e=>e.inPortfolio);
   return '<button class="calendar-day'+(date===state.day?' selected':'')+(date===moscowDate()?' today':'')+'" type="button" data-calendar-date="'+date+'" aria-pressed="'+(date===state.day)+'" aria-label="'+esc(dateLabel(date)+', событий: '+items.length+(owned?', есть активы из портфеля':''))+'"><span class="calendar-number">'+number+'</span>'+
    items.slice(0,2).map(e=>'<span class="calendar-event '+e.type+'">'+esc(e.ticker||typeNames[e.type])+'</span>').join('')+(items.length>2?'<small>ещё '+(items.length-2)+'</small>':'')+(owned?'<span class="calendar-held" title="В портфеле">П</span>':'')+'</button>';
  }).join('');
  $('#calendarSelectedDay').textContent=dateLabel(state.day);
  if(focusDate)$('#calendarGrid [data-calendar-date="'+focusDate+'"]')?.focus({preventScroll:true});
  const rows=all.filter(e=>e.date===state.day).sort((a,b)=>String(a.at).localeCompare(String(b.at)));
  $('#calendarAgenda').innerHTML=rows.map(e=>'<article class="agenda-event"><div class="agenda-meta"><span>'+typeNames[e.type]+'</span>'+(e.inPortfolio?'<span class="portfolio-mark">В портфеле</span>':'')+'</div><h4>'+esc([e.ticker,e.title].filter(Boolean).join(' · '))+'</h4>'+
   (e.cancelled?'<strong class="negative">Выплата отменена</strong>':'')+
   (e.amountNanos!=null?'<p>'+esc(money(e.amountNanos,e.currency||'RUB'))+' на бумагу</p>':'')+
   '<p>'+esc(e.note||'')+'</p>'+(e.reminder?'<small>'+new Date(e.at).toLocaleTimeString('ru-RU',{timeZone:'Europe/Moscow',hour:'2-digit',minute:'2-digit'})+' мск'+(e.acknowledgedAt?' · просмотрено':'')+'</small><div class="agenda-actions"><button type="button" data-edit-reminder="'+e.id+'">Изменить</button><button type="button" data-delete-reminder="'+e.id+'">Удалить</button>'+(!e.acknowledgedAt?'<button type="button" data-ack-reminder="'+e.id+'">Просмотрено</button>':'')+'</div>':
   '<div class="agenda-actions"><button type="button" data-event-uid="'+esc(e.instrumentUid)+'">Новости актива</button><button type="button" data-plan-uid="'+esc(e.instrumentUid)+'" data-plan-date="'+e.date+'">Моя заметка</button>'+(e.url?'<a href="'+esc(e.url)+'" target="_blank" rel="noopener noreferrer">Карточка Т‑Инвест</a>':'')+'</div><small>'+esc(e.source)+'</small>')+'</article>').join('')||'<p class="empty-copy">На выбранный день в загруженных данных событий нет. Ближайшие даты показаны выше; можно добавить свою заметку.</p>';
  $('#calendarAddForDay').textContent='Напомнить '+new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(state.day+'T12:00:00Z'));
  const coverage=state.data?.coverage;
  if(coverage&&!state.busy&&!state.lastError)setStatus((state.data.fixture?'Учебные события · ':'')+({portfolio:'Портфель и ваши заметки',market:'Акции Мосбиржи и фьючерсы',all:'Каталог Т‑Инвест',instrument:'Выбранный актив'})[coverage.scope]+' · проверено '+Math.max(0,coverage.instruments-coverage.pending-coverage.stale)+' из '+coverage.instruments+(coverage.pending||coverage.stale?' · загрузка продолжается':' · опубликованные даты загружены'));
  $('#calendarCoverageNote').textContent=coverage?.note||'';
  const upcoming=[...(state.data?.upcoming||[]),...all.filter(e=>e.type==='reminder')].filter(e=>e.date>=moscowDate()&&(state.type==='all'||e.type===state.type)).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,8);
  $('#calendarUpcoming').innerHTML=upcoming.map(e=>'<button type="button" data-upcoming-date="'+e.date+'"><time>'+esc(new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(e.date+'T12:00:00Z')))+'</time><span><strong>'+esc([e.ticker,e.title].filter(Boolean).join(' · '))+'</strong><small>'+esc(e.inPortfolio?'Актив из портфеля':typeNames[e.type])+'</small></span></button>').join('')||'<p class="empty-copy">'+(coverage?.pending||coverage?.stale?'Проверяем опубликованные даты. Загруженные события будут появляться здесь.':'В проверенном периоде будущих дат нет. Можно выбрать другой список активов или создать напоминание.')+'</p>';
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
    newsPanel.reset();state.newsLoaded=false;
   }
   if(!key){state.data=null;renderCalendar();setStatus('Подключите брокерский счёт, чтобы загрузить календарь.');$('#catalogStatus').textContent='Каталог появится после подключения брокера.';return;}
   if(connectionChanged||!state.catalog.length){
    const data=await request('/api/market/catalog');fillCatalog(data);
    if(data.stale)await refreshCatalog();
   }
   state.catalog.forEach(r=>r.inPortfolio=held.has(r.instrumentUid));renderCatalog();
   if(state.data){state.data.events.forEach(e=>e.inPortfolio=held.has(e.instrumentUid));renderCalendar();}
   if(connectionChanged||holdingsChanged||!state.data)await loadCalendar(true);
   if(holdingsChanged&&state.newsLoaded)void loadNews();
  }catch(error){setStatus(error.message,true);}
  finally{hydrationRunning=false;if(hydrationAgain){hydrationAgain=false;void refreshHoldings();}}
 }

 function openEditor(asset,date=state.day){
  $('#reminderFormStatus').textContent='';
  state.editing=null;$('#reminderForm').reset();$('#reminderAsset').value=asset?label(asset):'';$('#reminderDate').value=date;$('#reminderTime').value='09:00';
  $('#reminderSave').textContent='Сохранить напоминание';$('#reminderEditor').hidden=false;$('#reminderAsset').focus();
 }
 function editReminder(id){
  const row=state.data.reminders.find(r=>r.id===id);if(!row)return;
  openEditor(state.catalog.find(r=>r.instrumentUid===row.instrumentUid),moscowDate(new Date(row.dueAt)));state.editing=id;
  $('#reminderTime').value=new Date(Date.parse(row.dueAt)+3*3600000).toISOString().slice(11,16);$('#reminderNote').value=row.note;$('#reminderSave').textContent='Сохранить изменения';
 }
 async function loadCalendar(refresh=false){
  if(!roots())return;
  clearTimeout(calendarTimer);const serial=++state.calendarRequest,query=options();
  state.busy=true;state.lastError=null;$('#calendarRefresh').disabled=true;setStatus('Обновляем события…');
  try{
   const data=refresh?await request('/api/calendar/refresh',{method:'POST',body:JSON.stringify(query)}):await request('/api/calendar?'+new URLSearchParams(query));
   if(serial!==state.calendarRequest)return;state.data=data;
   if(data.warnings?.length){state.lastError='Часть событий не обновилась. Сохранённые даты доступны; попробуйте позже.';setStatus(state.lastError,true);}
   calendarTimer=setTimeout(()=>void loadCalendar(true),60000);
  }catch(error){if(serial===state.calendarRequest){state.lastError=error.message;setStatus(error.message,true);calendarTimer=setTimeout(()=>void loadCalendar(true),60000);}}
  finally{if(serial===state.calendarRequest){state.busy=false;$('#calendarRefresh').disabled=false;renderCalendar();}}
 }
 async function loadNews(instrumentUid=state.newsInstrument,{force=false,older=false}={}){
  if(!roots())return;
  state.newsInstrument=instrumentUid;const serial=++state.newsRequest;
  const asset=state.catalog.find(row=>row.instrumentUid===instrumentUid);
  $('#marketNewsTitle').textContent=instrumentUid?'Новости · '+(asset?.ticker||'выбранный актив'):'Новости компаний';
  $('#marketNewsAll').hidden=!instrumentUid;$('#marketNewsStatus').textContent='Загружаем новости…';
  try{
   const query=new URLSearchParams({period:$('#newsPeriod').value});
   if(instrumentUid)query.set('instrumentUid',instrumentUid);if(force)query.set('force','1');if(older)query.set('older','1');
   const data=await request('/api/market/news?'+query);
   if(serial!==state.newsRequest)return;state.newsLoaded=true;
   $('#marketNewsStatus').textContent=data.unavailable?'Источник новостей сейчас недоступен. Повторите позже.':(data.fixture?'Учебная лента · ':'')+(data.refreshFailed?'Источник не ответил. Показана сохранённая лента · ':data.stale?'Сохранённая лента · ':'')+(data.coverage||'');
   newsPanel.show(data);$('#newsOlder').hidden=!data.hasMore;
  }catch(error){if(serial===state.newsRequest)$('#marketNewsStatus').textContent=error.message;}
 }
 async function refreshCatalog(){
  $('#catalogRefresh').disabled=true;$('#catalogStatus').textContent='Загружаем акции и фьючерсы…';
  try{fillCatalog(await request('/api/market/catalog/refresh',{method:'POST',body:'{}'}));}
  catch(error){$('#catalogStatus').textContent=error.message;}
  finally{$('#catalogRefresh').disabled=false;}
 }
 async function start(){
  const available=roots();$('#catalogSurface').hidden=!available;$('#calendarSurface').hidden=!available;$('#marketNewsSurface').hidden=!available;
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
 $('#calendarUpcoming').addEventListener('click',event=>{const button=event.target.closest('[data-upcoming-date]');if(!button)return;state.day=button.dataset.upcomingDate;const changed=state.month!==state.day.slice(0,7);state.month=state.day.slice(0,7);renderCalendar();if(changed)void loadCalendar(true);$('#calendarGrid').scrollIntoView({block:'center'});});
 $('#calendarToday').addEventListener('click',()=>{state.day=moscowDate();state.month=state.day.slice(0,7);renderCalendar();void loadCalendar(true);});
 $('#calendarUniverse').addEventListener('change',()=>void loadCalendar(true));
 $('#calendarAsset').addEventListener('input',e=>populateAssets(e.target.value));$('#reminderAsset').addEventListener('input',e=>populateAssets(e.target.value));
 $('#calendarAsset').addEventListener('change',e=>{state.selectedAsset=instrument(e.target.value)?.instrumentUid||'';if(e.target.value&&!state.selectedAsset){setStatus('Выберите актив из подсказок.',true);return;}void loadCalendar(true);});
 $('#calendarType').addEventListener('change',e=>{state.type=e.target.value;renderCalendar();});
 $('#calendarRefresh').addEventListener('click',()=>void loadCalendar(true));
 $('#calendarAddForDay').addEventListener('click',()=>openEditor(state.catalog.find(r=>r.instrumentUid===state.selectedAsset)));
 $('#reminderCancel').addEventListener('click',()=>{$('#reminderEditor').hidden=true;$('#calendarAddForDay').focus();});
 $('#reminderForm').addEventListener('submit',async e=>{
  e.preventDefault();const asset=instrument($('#reminderAsset').value);if(!asset){$('#reminderFormStatus').textContent='Выберите актив из подсказок.';return;}
  const due=new Date($('#reminderDate').value+'T'+$('#reminderTime').value+':00+03:00');if(!Number.isFinite(due.getTime()))return;
  $('#reminderSave').disabled=true;
  try {await request('/api/calendar/reminders',{method:'POST',body:JSON.stringify({...(state.editing?{id:state.editing}:{}),instrumentUid:asset.instrumentUid,title:asset.ticker+' · Посмотреть актив',note:$('#reminderNote').value,dueAt:due.toISOString(),timezone:'Europe/Moscow'})});
   $('#reminderEditor').hidden=true;showToast('Напоминание сохранено');await loadCalendar();$('#calendarAddForDay').focus();
  }catch(error){$('#reminderFormStatus').textContent=error.message;}finally{$('#reminderSave').disabled=false;}
 });
 for(const [id,key]of [['calendarAutoEvents','autoEvents'],['calendarNative','nativeNotifications']])$('#'+id).addEventListener('change',async e=>{
  const value=e.target.checked;try{await request('/api/calendar/settings',{method:'POST',body:JSON.stringify({[key]:value})});await loadCalendar();}catch(error){e.target.checked=!value;showToast(error.message,true);}
 });
 document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-chart-uid],[data-plan-uid],[data-edit-reminder],[data-delete-reminder],[data-ack-reminder],[data-event-uid]');
  if(!b)return;
  try {
   if(b.dataset.chartUid){const asset=state.catalog.find(r=>r.instrumentUid===b.dataset.chartUid);onChartSelect(asset);}
   if(b.dataset.planUid){document.querySelector('[data-view="events"]')?.click();openEditor(state.catalog.find(r=>r.instrumentUid===b.dataset.planUid),b.dataset.planDate||state.day);}
   if(b.dataset.editReminder)editReminder(b.dataset.editReminder);
   if(b.dataset.deleteReminder){await request('/api/calendar/reminders/'+b.dataset.deleteReminder,{method:'DELETE'});await loadCalendar();}
   if(b.dataset.ackReminder){await request('/api/calendar/reminders/'+b.dataset.ackReminder+'/acknowledge',{method:'POST',body:'{}'});await loadCalendar();}
   if(b.dataset.eventUid){void loadNews(b.dataset.eventUid);$('#marketNewsSurface').scrollIntoView({block:'start'});}
  }catch(error){showToast(error.message,true);}
 });
 $('#marketNewsRefresh').addEventListener('click',()=>void loadNews(state.newsInstrument,{force:true}));
 $('#newsOlder').addEventListener('click',async()=>{const button=$('#newsOlder');button.disabled=true;try{await loadNews(state.newsInstrument,{older:true});}finally{button.disabled=false;}});
 $('#newsPeriod').addEventListener('change',()=>void loadNews());
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
 void start().then(()=>{if(roots())void showDue();});
 window.addEventListener('pagehide',()=>{disposed=true;stopHeader();poller?.stop();clearTimeout(calendarTimer);clearTimeout(dueTimer);},{once:true});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void poller?.tick();});
 return { refreshHoldings,loadNews,ensureNews:()=>state.newsLoaded?Promise.resolve():loadNews(),getCatalog:()=>state.catalog,
  openInstrumentChart:id=>onChartSelect(state.catalog.find(row=>row.instrumentUid===id)),
  openCatalogInstrument:id=>{const asset=state.catalog.find(row=>row.instrumentUid===id);if(!asset)return;state.assetType=asset.assetType;$('#catalogFilters').reset();$('#catalogSearch').value=asset.ticker||asset.name;state.page=0;renderCatalog();}
 };
}
