import {createMarketActivity} from './terminal-market-activity.js';
import {applyLiveCache,applySnapshotCache} from './terminal-live-cache.js';
import {createMarketChart,normalizeMarketCandles} from './charts.js';
import {initParticipantsPanel} from './market-participants.js';
import {radarMeasure} from './chart-indicators.js';
import {instrumentMark,watchInstrumentImages} from './instrument-mark.js';
import {createChartPreferences} from './chart-preferences.js';
import {initReplayControls} from './terminal-replay.js';
import {drawingGroups,drawingIcon} from './chart-tool-catalog.js';
import {initTerminalEditors} from './terminal-editors.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>Number.isFinite(v)?v.toLocaleString('ru-RU',{maximumFractionDigits:5}):'—';
const pct=v=>Number.isFinite(v)?(v>0?'+':'')+v.toLocaleString('ru-RU',{maximumFractionDigits:2})+'%':'—';
const quoteNum=(value,meta)=>{const tick=Number(meta?.minPriceIncrementNanos)/1e9,precision=tick>0?Math.max(0,Math.min(8,Math.ceil(-Math.log10(tick)))):Math.abs(value)>0&&Math.abs(value)<.01?6:2;return Number.isFinite(value)?value.toLocaleString('ru-RU',{maximumFractionDigits:precision}):'—';};
const stamp=t=>new Date(t*1000).toLocaleString('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})+' мск';
const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${({menu:'M4 6h16M4 12h16M4 18h16',watch:'M4 4h16v16H4zM8 8h8M8 12h8M8 16h5',book:'M4 4v16M20 4v16M4 7h7M4 12h5M4 17h8M20 7h-5M20 12h-8M20 17h-6',tape:'M5 4h14v16H5zM8 8h8M8 12h5M8 16h7',plan:'M5 3h14v18H5zM8 7h8M8 11h8M8 15h4',layout:'M3 4h18v16H3zM12 4v16M12 12h9',magnet:'M5 3v10a7 7 0 0 0 14 0V3h-4v10a3 3 0 0 1-6 0V3zM5 7h4M15 7h4',eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0',zoomout:'M4 12h16',close:'m6 6 12 12M6 18 18 6',add:'M12 4v16M4 12h16',detach:'M14 3h7v7M21 3 11 13M9 5H4v15h15v-5',left:'M8 3v18M3 3h18v18H3z',right:'M16 3v18M3 3h18v18H3z',fit:'M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5',undo:'M9 5 3 10l6 5M4 10h10a6 6 0 0 1 0 12',redo:'m15 5 6 5-6 5M20 10H10a6 6 0 0 0 0 12',horizontal:'M3 12h18',trend:'m4 19 16-14M4 19h1M19 5h1',ray:'m3 20 17-16M14 4h6v6',rectangle:'M4 5h16v14H4z',freehand:'M3 16C5 2 8 23 12 9s5 9 9-4',fibonacci:'M3 4h18M3 10h18M3 14h18M3 20h18',trash:'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7',erase:'m3 15 10-11 8 7-9 10H8zM8 10l8 7M12 21h9',cursor:'M5 3v16l5-4 4 7 3-2-4-6h7z',bell:'M6 9a6 6 0 0 1 12 0v5l3 3H3l3-3zM10 21h4',chevron:'m6 9 6 6 6-6'})[name]||'M4 4h16v16H4z'}"/></svg>`;
const btn=(name,label,attr='')=>`<button type="button" class="terminal-icon" aria-label="${label}" title="${label}" ${attr}>${icon(name)}</button>`;
const choices=[['1_MIN','1 минута'],['5_MIN','5 минут'],['15_MIN','15 минут'],['HOUR','1 час'],['4_HOUR','4 часа'],['DAY','1 день'],['WEEK','1 неделя'],['MONTH','1 месяц']].map(([v,t])=>`<option value="CANDLE_INTERVAL_${v}">${t}</option>`).join('');
const freshChart=meta=>({instrumentUid:meta.instrumentUid,ticker:meta.ticker,interval:'CANDLE_INTERVAL_DAY',view:{type:'candles',indicators:{volume:true},studies:[{id:'demo-sma20',type:'sma',period:20,color:'#e1b264',visible:true},{id:'demo-ema50',type:'ema',period:50,color:'#b9a9ff',visible:true}],drawings:[]},note:'',plans:[],plan:null});
const emptyLayout=()=>({tabs:[],active:'',count:1,panelsVersion:2,auxiliary:'',watchCollapsed:true,sideCollapsed:true,dockCollapsed:true,dock:'stats',side:'plan',linkPeriod:false,linkCursor:false,radar:{change:0,volume:0,distance:0},radarSaved:[]});
function spark(rows){if(rows.length<2)return '';const values=rows.slice(-24).map(r=>r.close),min=Math.min(...values),max=Math.max(...values);return `<svg class="terminal-spark" viewBox="0 0 80 26" aria-hidden="true"><polyline points="${values.map((v,i)=>`${i/(values.length-1)*78+1},${23-(v-min)/(max-min||1)*20}`).join(' ')}"/></svg>`;}

export function initTerminal({request,getSelection,getBootstrap,onSelection,onChart,showToast=()=>{}}){
 const $=s=>document.querySelector(s),panel=$('[data-view-panel="terminal"]');
 const oldSurface=panel.querySelector('.instrument-surface'),shortlist=panel.querySelector('.instrument-shortlist'),catalog=$('#instrumentCatalogBrowser'),dock=panel.querySelector('.terminal-dock');
 const interval=$('#marketInterval'),type=$('#marketChartType');
 const compat=document.createElement('div');compat.hidden=true;compat.className='terminal-compat';compat.append(oldSurface);panel.append(compat);$('#marketChart').id='legacyMarketChart';
 panel.querySelector('.terminal-workbench')?.classList.remove('terminal-workbench');panel.classList.add('terminal-workbench');
 const toolbar=document.createElement('header');toolbar.className='terminal-workspace-bar';toolbar.innerHTML=`${btn('menu','Разделы Workspace','data-workspace-menu')}<div class="terminal-tabs" role="tablist" aria-label="Открытые инструменты"></div><details class="terminal-layout-menu"><summary aria-label="Раскладка графиков">${icon('layout')}<span>Раскладка</span></summary><div class="terminal-layout-tools"><div class="terminal-layout-switch" role="group" aria-label="Число графиков">${[1,2,4].map(n=>`<button type="button" data-layout="${n}" aria-pressed="${n===1}">${n===1?'Один график':n+' графика'}</button>`).join('')}</div><button type="button" data-link="cursor" aria-pressed="false">Связать курсор</button><button type="button" data-link="period" aria-pressed="false">Общий период</button></div></details>${btn('fit','На весь экран','id="terminalExpand"')}<button type="button" id="terminalReturn" hidden>Вернуть в Workspace</button>`;toolbar.querySelector('[data-workspace-menu]').classList.add('terminal-workspace-menu');
 const main=document.createElement('section');main.className='terminal-main';main.innerHTML='<div class="terminal-chart-controls"><div class="terminal-timeframes"></div><div class="terminal-common-tools"></div></div><div class="terminal-grid" data-count="1"></div><p class="terminal-save-state" role="status"></p>';
 const controls=main.querySelector('.terminal-common-tools');type.parentElement.removeChild(type);controls.append(type);interval.innerHTML=choices;interval.setAttribute('aria-label','Интервал свечей');main.querySelector('.terminal-timeframes').append(interval);
 controls.insertAdjacentHTML('beforeend','<button type="button" id="terminalSymbolSearch">Поиск</button><button type="button" id="terminalCompare">Сравнить</button><button type="button" id="terminalDate">К дате</button><button type="button" id="terminalLive" hidden>К последним свечам</button><button type="button" id="terminalScale">Шкала</button><button type="button" id="terminalObjects">Объекты</button><button type="button" id="terminalIndicators">Индикаторы</button><button type="button" id="terminalReplay" aria-pressed="false">Воспроизведение</button><button type="button" id="terminalSettings">Настройки</button>');
 for(const n of ['sma','ema','bb','vwap','rsi','macd','volume']){const b=document.createElement('button');b.type='button';b.dataset.terminalIndicator=n;b.dataset.indicator=n;b.textContent=({sma:'SMA 20',ema:'EMA 20',bb:'Bollinger',vwap:'VWAP',rsi:'RSI 14',macd:'MACD',volume:'Объём'})[n];b.setAttribute('aria-pressed',String(n==='volume'));if(n!=='volume')b.className='terminal-quick-indicator';controls.append(b);}
 controls.insertAdjacentHTML('beforeend',`${btn('undo','Отменить разметку','data-history="undo"')}${btn('redo','Повторить разметку','data-history="redo"')}${btn('add','Приблизить график','data-chart-zoom="0.7"')}${btn('zoomout','Отдалить график','data-chart-zoom="1.4"')}${btn('fit','Показать весь график','id="terminalFit"')}<label class="terminal-flash" hidden><input type="checkbox" id="terminalFlash">Подсветка цены</label>`);
 const side=document.createElement('aside');side.className='terminal-side';side.innerHTML=`<header class="terminal-panel-heading"><strong id="terminalAuxiliaryTitle">План сделки</strong><button type="button" data-market-bottom title="Переместить под график" hidden>Вниз</button>${btn('close','Закрыть панель','data-close-panel')}</header><div id="terminalPlan"><p class="terminal-caption">Сценарий · заявки брокеру не отправляются</p><div class="terminal-plan-versions"></div><form id="terminalPlanForm"><label>Направление<select name="action"><option value="buy">Покупка</option><option value="sell">Продажа</option></select></label>${[['entry','Вход'],['stop','Стоп'],['target','Цель'],['quantity','Количество лотов']].map(([name,label])=>`<label>${label}<input name="${name}" inputmode="decimal" type="number" step="${name==='quantity'?'1':'any'}" min="${name==='quantity'?'1':'0.000000001'}" required></label>`).join('')}<p class="terminal-plan-risk"></p><label class="terminal-note-label">Условие входа<textarea name="note" rows="3" maxlength="1000" placeholder="Что должно подтвердиться перед входом"></textarea></label><button class="button primary" type="submit">Сохранить план</button><button class="button secondary" type="button" id="terminalPlanNew">Новый сценарий</button></form><div class="terminal-plan-message" role="status"></div></div><div id="terminalSideAlerts" hidden></div><label class="terminal-note-label">Заметка к инструменту<textarea id="terminalNote" maxlength="2000" rows="3" placeholder="Что важно проверить"></textarea></label>`;
 dock.innerHTML=`<header><div role="tablist" aria-label="Контекст инструмента">${[['stats','Статистика'],['book','Стакан'],['tape','Лента сделок'],['participants','Позиции участников'],['events','События'],['radar','Радар рынка']].map(([key,label])=>`<button type="button" role="tab" id="terminalTab${key}" data-terminal-tab="${key}" aria-controls="terminal${key[0].toUpperCase()+key.slice(1)}" aria-selected="${key==='stats'}">${label}</button>`).join('')}</div><div class="terminal-dock-actions"><button type="button" data-market-side hidden>Справа</button>${btn('close','Закрыть нижнюю панель','data-collapse="dock"')}</div></header><div class="terminal-dock-body"><div id="terminalStats" data-dock="stats" role="tabpanel"></div><div id="terminalBook" data-dock="book" role="tabpanel" hidden></div><div id="terminalTape" data-dock="tape" role="tabpanel" hidden></div><div id="terminalParticipants" data-dock="participants" role="tabpanel" hidden></div><div id="terminalEvents" data-dock="events" role="tabpanel" hidden></div><div id="terminalRadar" data-dock="radar" role="tabpanel" hidden></div></div>`;
 side.id='terminalAuxiliary';side.setAttribute('aria-labelledby','terminalAuxiliaryTitle');shortlist.id='terminalWatchlist';shortlist.querySelector('.surface-head').insertAdjacentHTML('beforeend',btn('close','Закрыть котировки','data-close-panel'));
 side.insertAdjacentHTML('beforeend','<div id="terminalSideMarket" hidden><div id="terminalSideBook"></div><div id="terminalSideTape"></div></div>');
 const quoteHead=document.createElement('div');quoteHead.className='terminal-quote-head';quoteHead.innerHTML='<span>Инструмент</span><span title="Последняя дневная свеча">Последняя</span><span title="Изменение к предыдущему дневному закрытию">Изм.</span><span>Изм. %</span>';shortlist.querySelector('#instrumentQuickList').before(quoteHead);
 const panelRail=document.createElement('nav');panelRail.className='terminal-panel-rail';panelRail.setAttribute('aria-label','Панели терминала');panelRail.innerHTML=[['watch','watch','Котировки'],['book','book','Стакан'],['tape','tape','Лента'],['plan','plan','План'],['alerts','bell','Уровни']].map(([key,glyph,label])=>`<button type="button" data-panel="${key}" aria-label="${label}" title="${label}" aria-expanded="false" aria-controls="${key==='watch'?'terminalWatchlist':'terminalAuxiliary'}">${icon(glyph)}<span>${label}</span></button>`).join('');const stage=document.createElement('div');stage.className='terminal-stage';stage.append(main,shortlist,side,panelRail);panel.prepend(toolbar,stage,dock);panel.append(catalog);
 const oldBoard=panel.querySelector('.market-vision-surface');if(oldBoard)oldBoard.hidden=true;
 const streamStatus=document.createElement('span');streamStatus.className='terminal-stream-status';streamStatus.setAttribute('role','status');dock.querySelector('header').append(streamStatus);
 const activity=createMarketActivity({bookHost:$('#terminalBook'),tapeHost:$('#terminalTape'),statusHost:streamStatus});
 const cacheVersions=new Map();let streamGeneration=0;
 const participants=initParticipantsPanel({host:$('#terminalParticipants'),request});
 const documents=new Map(),charts=new Map(),cache=new Map(),requests=new Map(),revisions=new Map(),pending=new Set(),saving=new Map(),detached=new Set();
 let expandedId=null,expandFocus=null,expandAnchor=null;let layout=emptyLayout(),catalogRows=[],alerts=[],events=[],ready=false,visible=false,saveTimer=null,refreshTimer=null,contextGeneration=0,quoteGeneration=0,syncCursor=false,syncPeriod=false;
 const detachedId=location.hash.match(/^#terminal\/(chart-[a-zA-Z0-9_-]{1,64})$/)?.[1]||'';
 const activeDoc=()=>documents.get(layout.active);
 const activeMeta=()=>catalogRows.find(r=>r.instrumentUid===activeDoc()?.instrumentUid)||(getBootstrap()?.instruments||[]).find(r=>r.instrumentUid===activeDoc()?.instrumentUid)||activeDoc()||{};
 const preferences=createChartPreferences({onChange:()=>paintQuickTools()});
 const replayControls=initReplayControls({main,button:$('#terminalReplay'),activeChart:()=>charts.get(layout.active),onStop:()=>void loadChart(layout.active,true)});
 const preferenceSection=document.createElement('section');preferenceSection.className='chart-preferences-section';preferenceSection.innerHTML='<h3>Графики и инструменты</h3><div></div>';$('#'+ 'mainContent').querySelector('[data-view-panel=settings]').append(preferenceSection);preferences.mount(preferenceSection.querySelector('div'));
 const editors=initTerminalEditors({panel,preferences,activeChart:()=>charts.get(layout.active),activeDoc,openInstrument,getCatalog:()=>catalogRows,
  compare:compareInstrument,loadHistory:()=>loadEarlier(layout.active,true),jumpDate,showToast,
  plan:price=>{if(expandedId)expandChart(null);openPanel('plan');$('#terminalPlanForm').elements.entry.value=price;renderRisk();dirty(layout.active);},
  alert:price=>{$('#instrumentPriceAlert').click();const field=document.querySelector('#priceAlertForm [name="targetPrice"]');if(field){field.value=price;field.dispatchEvent(new Event('input',{bubbles:true}));}}});
 const message=(text,error=false)=>{main.querySelector('.terminal-save-state').textContent=text;main.querySelector('.terminal-save-state').classList.toggle('negative',error);};
 const previewOnly=()=>getBootstrap()?.preview?.static||getBootstrap()?.preview?.localReview;
 async function read(key){if(previewOnly())return null;const doc=await request('/api/market/terminal?'+new URLSearchParams({key}));revisions.set(key,doc.revision);return doc.value;}
 function dirty(key){if(getBootstrap()?.preview?.readOnly)return;if(!ready||detachedId&&key==='layout')return;pending.add(key);message('Сохраняем…');clearTimeout(saveTimer);saveTimer=setTimeout(()=>void flush(),250);}
 async function flush(){clearTimeout(saveTimer);if(previewOnly()){pending.clear();message('Изменения действуют только в этом предпросмотре');return true;}await Promise.all([...saving.values()]);let failed=false;
  const keys=[...pending];await Promise.all(keys.map(async key=>{
   if(saving.has(key))return;pending.delete(key);const value=key==='layout'?layout:documents.get(key);if(!value)return;
   const task=request('/api/market/terminal',{method:'POST',body:JSON.stringify({key,revision:revisions.get(key)||0,value})}).then(r=>{revisions.set(key,r.revision);}).catch(error=>{failed=true;message(error.message||'Не удалось сохранить. Повторите сохранение.',true);pending.add(key);});saving.set(key,task);await task;saving.delete(key);
  }));if(pending.size&&!failed)return flush();if(!failed&&!pending.size&&!saving.size)message('Сохранено на этом устройстве');return !failed;
 }
 async function candles(meta,tf='CANDLE_INTERVAL_DAY',force=false,{before,purpose,at}={}) {
  const base=meta.instrumentUid+':'+tf,key=base+(at?':at:'+at:'')+(purpose?':'+purpose:''),prior=cache.get(key);
  if(purpose&&!at&&cache.has(base))return cache.get(base).rows;
  if(prior&&!force&&!before&&Date.now()-prior.at<55000)return prior.rows;
  const requestKey=key+':'+(before||'latest');if(requests.has(requestKey))return requests.get(requestKey);
  const version=cacheVersions.get(key)||0,generation=streamGeneration;
  const task=(async()=>{
   let page=[],metadata={};const boot=getBootstrap();
   if(boot?.preview?.static||boot?.preview?.localReview) {
    page=(boot.candles||[]).filter(r=>r.instrumentUid===meta.instrumentUid&&(!r.interval||r.interval===tf));
    const source=normalizeMarketCandles(page,tf),target=at?Date.parse(at):Date.now(),span=1095*86400000;
    const end=before?Date.parse(before):at?Math.min(Date.now()+1,target+span/2):Date.now()+1;
    const start=!before&&!at&&!purpose?(source[0]?.time*1000||end-span):end-span;page=source.filter(r=>r.time*1000>=start&&r.time*1000<end);
    const first=source[0]?.time*1000,hasMore=Number.isFinite(first)&&first<start;
    metadata={fixture:true,stale:false,history:{requestedFrom:new Date(start).toISOString(),nextBefore:hasMore?new Date(start).toISOString():null,hasMore,firstAvailable:Number.isFinite(first)?new Date(first).toISOString():null,boundaryKnown:true}};
   } else {
    const response=await request('/api/market/candles?'+new URLSearchParams({instrumentUid:meta.instrumentUid,interval:tf,...(before?{before}:{}),...(purpose?{purpose}:{}),...(at?{at}:{})}));
    if(!Array.isArray(response.data))throw new Error('Неверный ответ истории котировок.');
    page=response.data;metadata={stale:response.stale===true,capturedAt:response.capturedAt,fixture:response.fixture===true||boot?.environment==='fixture',history:response.history};
   }
   if(generation!==streamGeneration||!before&&version!==(cacheVersions.get(key)||0))return cache.get(key)?.rows||[];
   page=normalizeMarketCandles(page,tf);
   // Replace only the latest request's coverage: its rolling lower boundary
   // can leave confirmed bars between the new page and previously loaded history.
   // Backfill retains its own provenance and cannot refresh the current quote.
   const current=cache.get(key),latestRows=before?(current?.latestRows||[]):page;
   const from=Date.parse(metadata.history?.requestedFrom||metadata.history?.nextBefore||metadata.history?.firstAvailable||'');
   const outsideCoverage=Number.isFinite(from)?(current?.rows||[]).filter(row=>row.time*1000<from):(current?.olderRows||[]);
   const olderRows=before?normalizeMarketCandles([...(current?.olderRows||[]),...page],tf):outsideCoverage;
   const latestTimes=new Set(latestRows.map(row=>row.time));
   const rows=normalizeMarketCandles([...olderRows.filter(row=>!latestTimes.has(row.time)),...latestRows],tf);
   const entry=before?{...current,at:current?.at||0,stale:current?.stale??true,fixture:current?.fixture??metadata.fixture,
     capturedAt:current?.capturedAt,latestEmpty:current?.latestEmpty??true,history:metadata.history,olderLoaded:true}:
    {...metadata,at:Date.now(),latestEmpty:page.length===0,history:current?.olderLoaded?current.history:metadata.history,olderLoaded:current?.olderLoaded||false};
   cache.set(key,{...entry,rows,latestRows,olderRows});return rows;
  })();
  requests.set(requestKey,task);try{return await task;}finally{requests.delete(requestKey);}
 }

 function renderComparisons(id){
  const e=charts.get(id);if(!e?.api)return;const host=e.card.querySelector('.terminal-comparison-legend'),items=e.api.getComparisons();
  host.hidden=!items.length;host.innerHTML=items.map(m=>`<span class="terminal-compare-chip" style="--compare-color:${/^#[0-9a-f]{6}$/i.test(m.color)?m.color:'#e1b264'}"><button type="button" data-compare-toggle="${esc(m.instrumentUid)}" aria-pressed="${m.visible!==false}">${esc(m.ticker)} · ${m.anchor?pct(m.change):'нет общих свечей'}</button><button type="button" data-compare-remove="${esc(m.instrumentUid)}" aria-label="Убрать ${esc(m.ticker)}">×</button></span>`).join('')+'<small>От первой общей свечи · без конвертации валют</small>';
 }
 const panelLabels={watch:'Котировки',book:'Стакан',tape:'Лента сделок',plan:'План сделки',alerts:'Ценовые уровни'};let paintedPanel='';
 function marketPlacement(){const book=$('#terminalBook'),tape=$('#terminalTape'),aux=layout.auxiliary;if(!book||!tape)return;
  if(aux==='book'||aux==='tape'){$('#terminalSideBook').append(book);$('#terminalSideTape').append(tape);book.hidden=aux!=='book';tape.hidden=aux!=='tape';}
  else{dock.querySelector('.terminal-dock-body').append(book,tape);book.hidden=layout.dock!=='book';tape.hidden=layout.dock!=='tape';}
 }
 function paintPanels(){const aux=layout.auxiliary||'';layout.watchCollapsed=aux!=='watch';layout.sideCollapsed=!['book','tape','plan','alerts'].includes(aux);
  shortlist.hidden=layout.watchCollapsed;side.hidden=layout.sideCollapsed;panel.classList.toggle('watch-collapsed',layout.watchCollapsed);panel.classList.toggle('side-collapsed',layout.sideCollapsed);panel.classList.toggle('dock-collapsed',layout.dockCollapsed);
  $('#terminalAuxiliaryTitle').textContent=panelLabels[aux]||'';$('#terminalPlan').hidden=aux!=='plan';$('#terminalSideAlerts').hidden=aux!=='alerts';$('#terminalSideMarket').hidden=!['book','tape'].includes(aux);side.querySelector('#terminalNote').closest('label').hidden=aux!=='plan';side.querySelector('[data-market-bottom]').hidden=!['book','tape'].includes(aux);
  for(const b of panelRail.querySelectorAll('[data-panel]')){const active=b.dataset.panel===aux;b.setAttribute('aria-expanded',String(active));b.setAttribute('aria-pressed',String(active));}
  dock.querySelector('.terminal-dock-body').hidden=layout.dockCollapsed;dock.querySelector('[data-collapse=dock]').hidden=layout.dockCollapsed;dock.querySelector('[data-market-side]').hidden=layout.dockCollapsed||!['book','tape'].includes(layout.dock);
  for(const b of dock.querySelectorAll('[data-terminal-tab]')){const active=!layout.dockCollapsed&&b.dataset.terminalTab===layout.dock;b.setAttribute('aria-selected',String(active));b.tabIndex=b.dataset.terminalTab===layout.dock?0:-1;}
  for(const el of dock.querySelectorAll('[data-dock]'))el.hidden=el.dataset.dock!==layout.dock;marketPlacement();
  if(aux==='watch'&&paintedPanel!=='watch')void enrichWatchlist();paintedPanel=aux;
 }
 function openPanel(name,toggle=false){if(name&&!Object.hasOwn(panelLabels,name))return;layout.auxiliary=toggle&&layout.auxiliary===name?'':name;if(['book','tape'].includes(layout.auxiliary)&&['book','tape'].includes(layout.dock))layout.dockCollapsed=true;layout.side=['plan','alerts'].includes(name)?name:'market';paintPanels();dirty('layout');}
 function sideTab(name){openPanel(name==='market'?'book':name);}
 function expandChart(id,button){
  if(id&&!documents.has(id))return;if(id){expandFocus=button;expandedId=id;selection(id);}else expandedId=null;
  if(id&&!expandAnchor){expandAnchor=document.createComment('terminal workspace position');panel.before(expandAnchor);document.body.append(panel);}else if(!id&&expandAnchor){expandAnchor.replaceWith(panel);expandAnchor=null;}
  document.body.classList.toggle('terminal-fullscreen',!!id);panel.classList.toggle('chart-expanded',!!id);
  $('#terminalExpand').setAttribute('aria-label',id?'Выйти из полного экрана':'На весь экран');$('#terminalExpand').title=id?'Выйти из полного экрана':'На весь экран';toolbar.querySelector('details').open=false;$('#terminalExpand').setAttribute('aria-pressed',String(!!id));
  layoutView();for(const [key,e]of charts){const b=e.card.querySelector('[data-expand-chart]');b.setAttribute('aria-pressed',String(key===id));b.setAttribute('aria-label',key===id?'Свернуть график':'Развернуть этот график');b.title=b.getAttribute('aria-label');}
  if(id)charts.get(id)?.card.querySelector('[data-expand-chart]').focus({preventScroll:true});else {expandFocus?.focus?.({preventScroll:true});expandFocus=null;}
  window.dispatchEvent(new Event('resize'));
 }
 async function jumpDate(date,wholeYear=false){
  const id=layout.active,doc=activeDoc(),entry=charts.get(id);if(!doc||!entry)return;entry.api?.stopReplay();
  if(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Выберите дату.');
  const h=cache.get(entry.key)?.history,target=date?Date.parse(date):null;
  if(date&&h?.firstAvailable&&target<Date.parse(h.firstAvailable))throw new Error('Источник предоставляет этот интервал с '+new Date(h.firstAvailable).toLocaleDateString('ru-RU')+'.');
  doc.historyDate=date;doc.view={...doc.view,range:null};selection(id);dirty(id);await loadChart(id,false);
  if(doc.historyDate!==date)return;
  if(!entry.api||!entry.rows.length)throw new Error('За этот период свечей нет. Выберите другую дату или интервал.');
  if(date){const day=86400,year=Number(date.slice(0,4)),intraday=!['CANDLE_INTERVAL_DAY','CANDLE_INTERVAL_WEEK','CANDLE_INTERVAL_MONTH'].includes(doc.interval);
   const range=wholeYear&&!intraday?{from:Date.UTC(year,0,1)/1000,to:Date.UTC(year+1,0,1)/1000-1}:{from:target/1000-(intraday?.25:25)*day,to:target/1000+(intraday?.75:65)*day};
   const inside=entry.rows.some(r=>r.time>=range.from&&r.time<=range.to);if(!inside)throw new Error('В выбранном периоде источник не вернул свечей. Выберите другую дату.');
   entry.api.setRange(range);
  }else entry.api.latest();
  doc.view=entry.api.getState();historyStatus(id);renderComparisons(id);dirty(id);
 }
 function historyStatus(id){const e=charts.get(id);if(!e)return;let status=e.card.querySelector('.terminal-history');if(e.api?.getReplay().active)return;if(!status){status=document.createElement('span');status.className='terminal-history';e.card.querySelector('footer').append(status);}const h=cache.get(e.key)?.history;
  status.replaceChildren();const text=document.createElement('span');text.textContent=(e.rows.length?' · с '+new Date(e.rows[0].time*1000).toLocaleDateString('ru-RU'):'')+(e.historyError?' · История загружена частично':e.historyPending||e.autoHistory?' · Загружаем всю историю…':h?.hasMore===false?' · вся доступная история':e.rows.length>=100000?' · Для всей истории выберите дневной интервал':e.historyPaused?' · История загружена частично':'');status.append(text);
  if(h?.hasMore&&e.rows.length<100000&&(e.historyPaused||e.historyError||documents.get(id)?.historyDate)){const button=document.createElement('button');button.type='button';button.dataset.earlier=id;button.disabled=!!e.historyPending;button.textContent=e.historyError?'Повторить загрузку':'Продолжить загрузку';status.append(button);}
 }
 function loadEarlier(id,manual=false){const e=charts.get(id),doc=documents.get(id);if(!e||!doc||e.api?.getReplay().active||!visible||(!manual&&(e.historyPaused||e.autoHistory)))return Promise.resolve();
  if(e.historyTask)return e.historyTask;
  const history=cache.get(e.key)?.history;if(!history?.hasMore||!history.nextBefore)return Promise.resolve();
  const key=e.key,seq=e.seq,interval=doc.interval,first=e.rows[0]?.time;e.historyPending=true;e.historyError=false;if(manual)e.historyPaused=false;historyStatus(id);
  const task=(async()=>{
   if(!e.api){e.emptyPages=(e.emptyPages||0)+1;if(e.emptyPages>=3&&!history.boundaryKnown){e.historyPaused=true;return;}await loadChart(id,false,{before:history.nextBefore,at:doc.historyDate||undefined,historyPage:true});return;}
   try{const rows=await candles(doc,interval,false,{before:history.nextBefore,at:doc.historyDate||undefined});if(e.key!==key||e.seq!==seq||e.api?.getReplay().active)return;e.rows=rows;e.api.setData(rows);e.emptyPages=rows[0]?.time===first?(e.emptyPages||0)+1:0;e.historyPaused=e.emptyPages>=3&&!history.boundaryKnown;if(e.autoHistory&&!e.historyUserInteraction)e.api.fitContent();
    for(const meta of doc.comparisons||[])void loadComparison(id,meta,history.nextBefore);if(id===layout.active)renderStats();
   }catch{if(e.key===key){e.historyError=true;e.historyPaused=true;}}
  })();
  const pending=task.finally(()=>{if(e.historyTask===pending){e.historyTask=null;e.historyPending=false;}if(e.key===key)historyStatus(id);});e.historyTask=pending;return pending;
 }
 async function loadAllHistory(id){
  const e=charts.get(id),doc=documents.get(id);if(!e||!doc||e.api?.getReplay().active||doc.historyDate||e.historyPaused||!visible)return;
  if(e.autoHistory?.key===e.key&&e.autoHistory?.seq===e.seq)return;
  const token={key:e.key,seq:e.seq};e.autoHistory=token;const cursors=new Set();let pages=0;
  try{while(visible&&!e.api?.getReplay().active&&charts.get(id)===e&&!e.card.hidden&&e.key===token.key&&e.seq===token.seq){
   if(e.historyTask){await e.historyTask;continue;}
   const h=cache.get(e.key)?.history;if(!h?.hasMore||!h.nextBefore||e.historyPaused)break;
   if(pages>=40||e.rows.length>=100000||cursors.has(h.nextBefore)){e.historyPaused=true;break;}
   cursors.add(h.nextBefore);pages++;await loadEarlier(id,true);if(e.key===token.key&&e.seq===token.seq+1)token.seq=e.seq;
   if(e.historyError||e.historyPaused)break;
  }}finally{if(e.autoHistory===token){e.autoHistory=null;historyStatus(id);}}
 }
 async function loadComparison(id,meta,before){const e=charts.get(id),doc=documents.get(id);if(!e?.api)return;const key=e.key,seq=e.seq;
  try{const rows=await candles(meta,doc.interval,false,{before,at:doc.historyDate||undefined});if(e.key!==key||e.seq!==seq||!doc.comparisons?.some(m=>m.instrumentUid===meta.instrumentUid))return;
   if(!rows.length){showToast('Для '+meta.ticker+' нет свечей на выбранном интервале.');return;}e.api.setComparison(meta,rows);renderComparisons(id);
  }catch{showToast('Сравнение '+meta.ticker+' не загрузилось. Повторите выбор.');}}
 async function compareInstrument(meta,remove=false){const doc=activeDoc(),e=charts.get(layout.active);if(!doc||!e?.api)return;doc.comparisons??=[];
  if(remove){doc.comparisons=doc.comparisons.filter(m=>m.instrumentUid!==meta.instrumentUid);e.api.setComparison(meta,null);}else{if(doc.instrumentUid===meta.instrumentUid)return;if(!doc.comparisons.some(m=>m.instrumentUid===meta.instrumentUid)){if(doc.comparisons.length>=5){showToast('Можно сравнить до пяти инструментов.');return;}doc.comparisons.push({instrumentUid:meta.instrumentUid,ticker:meta.ticker,color:['#e1b264','#45c9cf','#ef7b76','#5ed0a0','#e88cc5'][doc.comparisons.length]});}await loadComparison(layout.active,doc.comparisons.find(m=>m.instrumentUid===meta.instrumentUid));}renderComparisons(layout.active);dirty(layout.active);}

 function demoMarketSnapshot(meta){
  const row=(getBootstrap()?.candles||[]).filter(r=>r.instrumentUid===meta.instrumentUid).at(-1);if(!row)return;
  const price=row.close,step=Math.max(.01,Math.round(price*.00005*100)/100),at='2026-08-12T12:00:00Z';
  activity.reset();activity.state({state:'fixture',simulated:true});
  activity.receive({type:'market.book',instrumentUid:meta.instrumentUid,consistent:true,sourceEventTime:at,connectorReceivedAt:at,simulated:true,
   bids:Array.from({length:20},(_,i)=>({price:price-step*(i+1),quantity:10+i*7})),
   asks:Array.from({length:20},(_,i)=>({price:price+step*(i+1),quantity:18+i*5}))});
  for(let i=0;i<20;i++)activity.receive({type:'market.trade',instrumentUid:meta.instrumentUid,price:price+(i%2?1:-1)*step,quantity:1+i%8,side:i%2?'buy':'sell',sourceEventTime:new Date(Date.parse(at)-(19-i)*1000).toISOString(),connectorReceivedAt:at,simulated:true});
 }
 function selection(id){const doc=documents.get(id);if(!doc)return;if(layout.active!==id)charts.get(layout.active)?.api?.pauseReplay();layout.active=id;const meta=activeMeta();onSelection?.(meta);onChart?.(charts.get(id)?.api||null);interval.value=doc.interval;type.value=doc.view?.type||'candles';$('#terminalLive').hidden=!doc.historyDate;$('#terminalDate').textContent=doc.historyDate?'История · '+doc.historyDate.slice(0,4):'К дате';
  if(detachedId)document.title=(meta.ticker||'График')+' · Терминал · Vertux Nexus';
  const select=$('#instrumentSelect');if(![...select.options].some(o=>o.value===meta.instrumentUid))select.add(new Option(meta.ticker||meta.instrumentUid,meta.instrumentUid));select.value=meta.instrumentUid;
  for(const b of controls.querySelectorAll('[data-terminal-indicator]')){b.setAttribute('aria-pressed',String(doc.view?.indicators?.[b.dataset.terminalIndicator]===true));if(b.dataset.terminalIndicator==='vwap'){b.disabled=doc.interval==='CANDLE_INTERVAL_DAY';b.title='VWAP с 00:00 МСК · доступен на внутридневных интервалах';}}$('#terminalFlash').checked=doc.view?.flash===true;
  for(const[cid,entry]of charts){entry.host.id=cid===id?'marketChart':'';entry.card.classList.toggle('active',cid===id);}
  for(const b of $('#instrumentQuickList').querySelectorAll('[data-chart-uid]'))b.setAttribute('aria-pressed',String(b.dataset.chartUid===doc.instrumentUid));renderTabs();renderPlan();renderStats();replayControls.selection();participants.update(meta);activity.select(meta);demoMarketSnapshot(meta);subscriptionChanged();void loadContext();if(!detachedId)dirty('layout');}
 function renderTabs(){const host=toolbar.querySelector('.terminal-tabs');host.innerHTML=layout.tabs.map(id=>{const doc=documents.get(id);return `<div class="terminal-tab${id===layout.active?' active':''}"><button type="button" role="tab" data-chart-tab="${id}" aria-selected="${id===layout.active}" tabindex="${id===layout.active?'0':'-1'}">${esc(doc?.ticker||'График')}${detached.has(id)?' ↗':''}</button>${btn('close','Закрыть вкладку '+esc(doc?.ticker||''),`data-close-chart="${id}"`)}</div>`;}).join('')+btn('add','Добавить инструмент','id="terminalAdd"');}
 function idsVisible(){if(expandedId)return[expandedId];if(detachedId)return[detachedId];const ids=layout.tabs.filter(id=>!detached.has(id));let selected=ids.slice(0,layout.count);if(ids.includes(layout.active)&&!selected.includes(layout.active)){selected[selected.length-1]=layout.active;}return selected;}
 function layoutView(){panel.classList.toggle('watch-collapsed',layout.watchCollapsed);panel.classList.toggle('side-collapsed',layout.sideCollapsed);panel.classList.toggle('dock-collapsed',layout.dockCollapsed);
  for(const b of toolbar.querySelectorAll('[data-layout]'))b.setAttribute('aria-pressed',String(Number(b.dataset.layout)===layout.count));
  for(const b of toolbar.querySelectorAll('[data-link]'))b.setAttribute('aria-pressed',String(layout[b.dataset.link==='cursor'?'linkCursor':'linkPeriod']));
  for(const b of panel.querySelectorAll('[data-collapse]')){const key=b.dataset.collapse+'Collapsed';b.setAttribute('aria-expanded',String(!layout[key]));}
  main.querySelector('.terminal-grid').dataset.count=expandedId?1:layout.count;renderTabs();renderCharts();paintPanels();}
 function renderCharts(){const ids=idsVisible();for(const[id,entry]of charts)entry.card.hidden=!ids.includes(id);
  main.querySelectorAll('.terminal-chart-slot').forEach(el=>el.remove());
  for(const id of ids){if(charts.has(id))continue;const doc=documents.get(id);if(!doc)continue;const card=document.createElement('article');card.className='terminal-chart-card';card.dataset.chartId=id;card.tabIndex=0;
   card.innerHTML=`<header><div class="terminal-chart-identity"><strong>${esc(doc.ticker)}</strong><small></small></div><div class="terminal-chart-quote"></div>${detachedId?'':btn('add','Открыть копию графика',`data-duplicate-chart="${id}"`)}${btn('fit',expandedId===id?'Свернуть график':'Развернуть этот график',`data-expand-chart="${id}" aria-pressed="${expandedId===id}"`)}${btn('detach',detachedId?'Вернуть график':'В отдельное окно',`data-detach-chart="${id}"`)}</header><div class="terminal-comparison-legend" aria-label="Сравнение инструментов" hidden></div><div class="terminal-chart-area"><div class="terminal-drawing-tools" role="toolbar" aria-label="Рисование">${['cursor','horizontal','trend','ray','rectangle','freehand','fibonacci','erase'].map(tool=>btn(tool,({cursor:'Выбор',horizontal:'Горизонталь',trend:'Тренд',ray:'Луч',rectangle:'Прямоугольник',freehand:'Свободная линия',fibonacci:'Фибоначчи',erase:'Ластик'})[tool],`data-tool="${tool}"`)).join('')}${btn('magnet','Магнит к свечам','data-magnet aria-pressed="false"')}${btn('eye','Скрыть разметку','data-hide-drawings aria-pressed="false"')}${btn('trash','Удалить всю разметку','data-clear-drawings')}</div><div class="terminal-chart-plot" tabindex="0" aria-label="График ${esc(doc.ticker)}"><div class="terminal-crosshair"></div><p class="empty-copy">Загружаем котировки…</p></div></div><footer class="terminal-chart-source"></footer>`;
   const tools=card.querySelector('.terminal-drawing-tools');for(const button of tools.querySelectorAll('[data-tool]')){if(!['cursor','erase'].includes(button.dataset.tool))button.classList.add('terminal-legacy-tool');}
   tools.querySelector('[data-tool=cursor]').insertAdjacentHTML('afterend',drawingGroups.map((g,i)=>{const type=preferences.get().tools[g.id],label=g.tools.find(([t])=>t===type)[1];return `<span class="terminal-tool-slot"><button type="button" class="terminal-icon" data-tool="${type}" data-quick-tool="${i}" aria-label="${label} — рисовать" title="${label}">${drawingIcon(type)}</button><button type="button" class="terminal-tool-menu" data-tool-group="${i}" aria-label="Другие инструменты: ${g.label}" aria-haspopup="dialog" aria-expanded="false">${icon('chevron')}</button></span>`;}).join(''));
   const host=card.querySelector('.terminal-chart-plot');for(const event of ['pointerdown','wheel'])host.addEventListener(event,()=>{const entry=charts.get(id);if(entry)entry.historyUserInteraction=true;},{passive:true});main.querySelector('.terminal-grid').append(card);charts.set(id,{card,host,api:null,rows:[],seq:0});void loadChart(id);}
  for(let i=ids.length;i<(expandedId?1:layout.count);i++){const slot=document.createElement('button');slot.type='button';slot.className='terminal-chart-slot';slot.dataset.addSlot='';slot.innerHTML=icon('add')+'<span>Выбрать инструмент</span>';main.querySelector('.terminal-grid').append(slot);}
  selectionVisual();subscriptionChanged();}
 function paintQuickTools(){for(const e of charts.values())for(const b of e.card.querySelectorAll('[data-quick-tool]')){const g=drawingGroups[Number(b.dataset.quickTool)],type=preferences.get().tools[g.id],label=g.tools.find(([t])=>t===type)[1];b.dataset.tool=type;b.title=label;b.setAttribute('aria-label',label+' — рисовать');b.innerHTML=drawingIcon(type);}}
 function replayChanged(id){const e=charts.get(id);if(!e?.api)return;const r=e.api.getReplay(),subscriptionChangedNow=(e.replayActive===true)!==r.active;e.replayActive=r.active;e.card.classList.toggle('replaying',r.active);if(r.active){const rows=e.api.getRows(),last=rows.at(-1),prior=rows.at(-2);e.card.querySelector('.terminal-chart-quote').innerHTML='<strong>'+num(last.close)+'</strong><small>Воспроизведение · '+pct(prior?.close?(last.close/prior.close-1)*100:null)+'</small>';e.card.querySelector('.terminal-chart-source').textContent='Воспроизведение · '+stamp(last.time);renderComparisons(id);}if(id===layout.active){replayControls.update();renderStats();}if(subscriptionChangedNow)subscriptionChanged();}
 function selectionVisual(){for(const[id,e]of charts){e.card.classList.toggle('active',id===layout.active);e.host.id=id===layout.active?'marketChart':'';}onChart?.(charts.get(layout.active)?.api||null);}
 async function loadChart(id,force=false,range={}){const entry=charts.get(id),doc=documents.get(id);if(!entry||!doc||detached.has(id)||entry.api?.getReplay().active)return;const serial=++entry.seq,meta=catalogRows.find(r=>r.instrumentUid===doc.instrumentUid)||(getBootstrap()?.instruments||[]).find(r=>r.instrumentUid===doc.instrumentUid)||doc;
  range={at:doc.historyDate||undefined,...range};const key=doc.instrumentUid+':'+doc.interval+(doc.historyDate?':at:'+doc.historyDate:'');
  if(entry.key!==key){
   entry.api?.destroy();entry.api=null;entry.rows=[];entry.key=key;entry.historyPending=false;entry.historyPaused=false;entry.emptyPages=0;entry.historyUserInteraction=false;
   entry.host.innerHTML='<p class="empty-copy">Загружаем свечи выбранного интервала…</p>';
   entry.card.querySelector('.terminal-chart-quote').textContent='—';
   entry.card.querySelector('.terminal-chart-source').textContent='Загружаем котировки…';
   if(id===layout.active){selectionVisual();renderStats();}
  }
  try{const rows=await candles(meta,doc.interval,force,range);if(serial!==entry.seq||entry.api?.getReplay().active)return;entry.rows=rows;
   entry.key=key;
   if(!rows.length){entry.api?.destroy();entry.api=null;entry.host.innerHTML='<p class="empty-copy">Свечей за этот интервал нет. Загрузите более раннюю историю или выберите другой интервал.</p>';entry.card.querySelector('.terminal-chart-quote').textContent='—';entry.card.querySelector('.terminal-chart-source').textContent='Данные за запрошенный период отсутствуют';historyStatus(id);if(id===layout.active){selectionVisual();renderStats();}if(!range.historyPage)void loadAllHistory(id);return;}
   entry.key=key;entry.loading=true;
   if(entry.api)entry.api.setData(rows);else{entry.host.replaceChildren();const legend=document.createElement('div');legend.className='terminal-crosshair';entry.host.append(legend);
    entry.api=createMarketChart(entry.host,rows,{onCrosshair:row=>{legend.textContent=row?`${stamp(row.time)}   О ${num(row.open)}  М ${num(row.high)}  м ${num(row.low)}  З ${num(row.close)}  V ${num(row.volume)}`:'';
     if(layout.linkCursor&&!syncCursor){syncCursor=true;for(const[other,e]of charts)if(other!==id&&!e.card.hidden)e.api?.setCrosshair(row?.time);syncCursor=false;}},
     onState:view=>{if(entry.loading)return;doc.view=view;entry.card.querySelector('[data-magnet]')?.setAttribute('aria-pressed',String(view.magnet));entry.card.querySelector('[data-hide-drawings]')?.setAttribute('aria-pressed',String(view.drawingsHidden));dirty(id);},onMode:mode=>{entry.card.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===(mode||'cursor'))));},
     getDrawingDefaults:type=>preferences.styleFor(type),onDrawingStyle:(type,style)=>preferences.rememberStyle(type,style),onReplay:()=>replayChanged(id),
     onHistory:()=>void loadEarlier(id),onDrawingSelect:item=>{if(id===layout.active)editors.drawing(item);},
     onRange:range=>{if(!layout.linkPeriod||syncPeriod)return;syncPeriod=true;for(const[other,e]of charts)if(other!==id&&!e.card.hidden)e.api?.setRange(range);syncPeriod=false;}});
    entry.api?.restore({...doc.view,colors:doc.view?.colors||preferences.colorsFor(doc.instrumentUid),range:doc.historyDate?doc.view?.range:null});if(!doc.historyDate)entry.api?.fitContent();}
   entry.loading=false;const last=rows.at(-1),previous=rows.at(-2);entry.card.querySelector('.terminal-chart-identity').innerHTML=instrumentMark(meta)+`<span><strong>${esc(meta.ticker||doc.ticker)}</strong><small>${esc(meta.name||'')}</small></span>`;watchInstrumentImages(entry.card);
   const change=previous?.close>0?(last.close/previous.close-1)*100:null;
   entry.card.querySelector('.terminal-chart-quote').innerHTML=`<strong>${num(last.close)}${meta.assetType==='future'?' п.':''}</strong><small class="${change<0?'negative':'positive'}">${pct(change)} · к прошлой свече</small>`;
   const freshness=cache.get(key)||{},captured=freshness.capturedAt||last.capturedAt,source=entry.card.querySelector('.terminal-chart-source');
   source.textContent=`${doc.historyDate?'История · ':''}${freshness.fixture?'Демо':'Демо'} · свеча ${stamp(last.time)}${captured?' · получено '+stamp(Date.parse(captured)/1000):''}${freshness.latestEmpty?' · в последнем запросе свечей нет':''}${freshness.stale?' · обновление задерживается':''}`;source.classList.toggle('stale',Boolean(freshness.stale));
   historyStatus(id);for(const meta of doc.comparisons||[])void loadComparison(id,meta);if(!range.historyPage)void loadAllHistory(id);
   if(id===layout.active){selectionVisual();renderStats();applyContext();replayControls.update();}
  }catch(error){if(serial!==entry.seq)return;entry.loading=false;entry.card.querySelector('.terminal-chart-source').textContent='Обновление задерживается. Повторим автоматически.';entry.card.querySelector('.terminal-chart-source').classList.add('stale');if(!entry.api){entry.host.innerHTML='<p class="empty-copy"></p>';entry.host.querySelector('.empty-copy').textContent=error.message||'Нет котировок. Выберите другой инструмент.';}}}
 function renderStats(){const entry=charts.get(layout.active),rows=entry?.api?.getReplay().active?entry.api.getRows():entry?.rows||[];const last=rows.at(-1),first=rows[0];$('#terminalStats').innerHTML=last?`<dl class="terminal-stat-grid">${[['Изменение за период',pct((last.close/first.open-1)*100)],['Максимум',num(rows.reduce((max,r)=>Math.max(max,r.high),-Infinity))],['Минимум',num(rows.reduce((min,r)=>Math.min(min,r.low),Infinity))],['Объём',num(rows.reduce((s,r)=>s+r.volume,0))],['Свечей',rows.length]].map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl><p class="terminal-caption">${stamp(first.time)} — ${stamp(last.time)}. По выбранному интервалу.</p>`:'<p class="empty-copy">Выберите инструмент с доступными свечами.</p>';}
 function dockTab(name,open=true,persist=true){layout.dock=name;layout.dockCollapsed=!open;if(open&&['book','tape'].includes(name)&&['book','tape'].includes(layout.auxiliary))layout.auxiliary='';paintPanels();if(open&&name==='participants')participants.show();else participants.hide();if(open&&name==='radar')void renderRadar();if(persist)dirty('layout');}
 function applyContext(){const doc=activeDoc(),entry=charts.get(layout.active);if(!doc||!entry?.api)return;const plan=doc.plan&&[doc.plan.entry,doc.plan.stop,doc.plan.target].every(v=>Number(v)>0)?{entry:Number(doc.plan.entry),stop:Number(doc.plan.stop),target:Number(doc.plan.target)}:null;entry.api.setContext({alerts:alerts.filter(r=>r.symbol===doc.ticker),events,scenario:plan});}
 async function loadContext(){const meta=activeMeta(),serial=++contextGeneration;if(!meta.instrumentUid)return;
  const [a,c]=await Promise.allSettled([request('/api/alerts'),request('/api/calendar?'+new URLSearchParams({month:new Date().toISOString().slice(0,7),universe:'all',instrumentUid:meta.instrumentUid}))]);if(serial!==contextGeneration)return;
  if(a.status==='fulfilled')alerts=a.value.rules||[];events=c.status==='fulfilled'?[...(c.value.events||[]),...(c.value.reminders||[])].filter(r=>!r.instrumentUid||r.instrumentUid===meta.instrumentUid).map(r=>({title:r.title||r.note||'Событие',time:Date.parse(r.at||r.dueAt||r.date+'T09:00:00+03:00')/1000})).filter(r=>Number.isFinite(r.time)):[];
  $('#terminalEvents').innerHTML=events.length?'<div class="terminal-event-list">'+events.map(r=>`<div><time>${esc(stamp(r.time))}</time><span>${esc(r.title)}</span></div>`).join('')+'</div>':'<p class="empty-copy">Для этого инструмента нет опубликованных событий за текущий месяц.</p>';
  const rules=alerts.filter(r=>r.symbol===meta.ticker);$('#terminalSideAlerts').innerHTML=`<button class="button secondary" type="button" data-create-alert>${icon('bell')} Создать уведомление</button>`+(rules.length?rules.map(r=>`<div class="terminal-alert-row"><strong>${esc(r.targetPrice)} · ${r.condition==='below'?'Ниже':'Выше'}</strong><span>${esc(r.note||'Без комментария')}</span><small>${r.enabled===false?'Приостановлено':'Условие сохранено'}</small></div>`).join(''):'<p class="empty-copy">Добавьте уровень — он появится на графике с вашим комментарием.</p>');applyContext();}
 function renderPlan(){const doc=activeDoc();if(!doc)return;const form=$('#terminalPlanForm');for(const name of ['action','entry','stop','target','quantity','note'])form.elements[name].value=doc.plan?.[name]??(name==='action'?'buy':name==='quantity'?'1':'');$('#terminalNote').value=doc.note||'';
  side.querySelector('.terminal-plan-versions').innerHTML=(doc.plans||[]).map((p,i)=>`<button type="button" data-plan-version="${i}">${esc(p.name||'План '+(i+1))}</button>`).join('');renderRisk();}
 function renderRisk(){const form=$('#terminalPlanForm'),doc=activeDoc();if(!doc)return;const values=Object.fromEntries(new FormData(form));doc.plan=values;const entry=Number(values.entry),stop=Number(values.stop),target=Number(values.target),qty=Number(values.quantity),direction=values.action==='buy'?1:-1,risk=(entry-stop)*direction,reward=(target-entry)*direction,lot=Number(activeMeta().lot)||1;
  const valid=entry>0&&stop>0&&target>0&&risk>0&&reward>0&&Number.isInteger(qty)&&qty>0;
  side.querySelector('.terminal-plan-risk').innerHTML=valid?`<span>Риск / цель <strong>1 : ${num(reward/risk)}</strong></span><span>${num(qty)} лотов · ${num(qty*lot)} ${activeMeta().assetType==='future'?'контрактов':'единиц'}</span><span>До стопа ${num(risk)} · до цели ${num(reward)}<small>В единицах котировки на один инструмент</small></span>`:'<span>Задайте вход, стоп и цель по выбранному направлению.</span>';
  form.querySelector('[type="submit"]').disabled=!valid;applyContext();}
 async function openInstrument(meta){if(!meta?.instrumentUid)return;
  if(detachedId&&activeDoc()?.instrumentUid!==meta.instrumentUid){const entry=charts.get(detachedId);entry?.api?.destroy();entry?.card.remove();charts.delete(detachedId);documents.set(detachedId,freshChart(meta));layout.tabs=[detachedId];layout.active=detachedId;dirty(detachedId);layoutView();selection(detachedId);return;}
  const existing=layout.tabs.find(id=>documents.get(id)?.instrumentUid===meta.instrumentUid);if(existing){if(detached.has(existing)){showToast('Этот график открыт в отдельном окне.');return;}if(expandedId)expandChart(existing,expandFocus);else{selection(existing);layoutView();}return;}
  if(layout.tabs.length>=12){showToast('Открыто 12 вкладок. Закройте ненужную.');return;}const id='chart-'+crypto.randomUUID();documents.set(id,freshChart(meta));layout.tabs.push(id);layout.active=id;if(expandedId)expandedId=id;dirty(id);layoutView();selection(id);}
 let watchObserver=null,watchQueue=[],watchBusy=0;
 async function watchWorker(){while(watchBusy<3&&watchQueue.length){const {control,generation}=watchQueue.shift();if(!visible||generation!==quoteGeneration||!control.isConnected)continue;watchBusy++;
  const meta=catalogRows.find(r=>r.instrumentUid===control.dataset.chartUid)||(getBootstrap()?.instruments||[]).find(r=>r.instrumentUid===control.dataset.chartUid);
  void (async()=>{try{if(!meta)return;const rows=await candles(meta,'CANDLE_INTERVAL_DAY',false,{purpose:'preview'});if(generation!==quoteGeneration||!control.isConnected)return;const measure=radarMeasure(rows),absolute=rows.length>1?rows.at(-1).close-rows.at(-2).close:null;control.querySelector('.watch-price')?.remove();control.querySelector('.terminal-watch-quote')?.remove();
   control.insertAdjacentHTML('beforeend',measure?`<span class="terminal-watch-quote"><b>${quoteNum(measure.price,meta)}</b><small class="${absolute<0?'negative':absolute>0?'positive':''}">${absolute>0?'+':''}${quoteNum(absolute,meta)}</small><small class="${measure.change<0?'negative':measure.change>0?'positive':''}">${pct(measure.change)}</small></span>`:'<span class="terminal-watch-quote terminal-quote-empty">Нет дневных свечей</span>');if(measure)control.title=(meta.name||meta.ticker)+' · Последняя дневная свеча · '+stamp(measure.time)+' · Изменение к предыдущему дневному закрытию';
  }catch{if(control.isConnected){control.querySelector('.terminal-watch-quote')?.remove();control.insertAdjacentHTML('beforeend','<span class="terminal-watch-quote terminal-quote-empty">Источник временно недоступен</span>');}}
  finally{watchBusy--;void watchWorker();}})();}}
 function enrichWatchlist(){const generation=++quoteGeneration;watchObserver?.disconnect();watchQueue=[];
  watchObserver=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){watchObserver.unobserve(entry.target);watchQueue.unshift({control:entry.target,generation});}void watchWorker();},{root:$('#instrumentQuickList'),rootMargin:'100px'});
  for(const control of $('#instrumentQuickList').querySelectorAll('[data-chart-uid]'))watchObserver.observe(control);
 }
 async function renderRadar(){const host=$('#terminalRadar');if(!host.querySelector('form'))host.innerHTML=`<form class="terminal-radar-filter"><label>Изменение, % от<input name="change" type="number" min="0" step=".1" value="${layout.radar.change}"></label><label>Объём / средний от<input name="volume" type="number" min="0" step=".1" value="${layout.radar.volume}"></label><label>До моего уровня, % до<input name="distance" type="number" min="0" step=".1" value="${layout.radar.distance}"></label><button type="submit" class="button secondary">Применить</button><button type="button" data-save-filter>Сохранить фильтр</button><select aria-label="Сохранённые фильтры" id="terminalRadarSaved"><option value="">Мои фильтры</option></select></form><p class="terminal-caption">Последняя дневная свеча. Объём сравнивается с доступными предыдущими свечами (до 20). Нулевой фильтр отключён. Выборка — первые 40 инструментов текущего списка наблюдения.</p><div class="terminal-radar-table"></div>`;
  $('#terminalRadarSaved').innerHTML='<option value="">Мои фильтры</option>'+(layout.radarSaved||[]).map((r,i)=>`<option value="${i}">${esc(r.name)}</option>`).join('');
  const items=[...$('#instrumentQuickList').querySelectorAll('[data-chart-uid]')].slice(0,40),result=[];
  for(const item of items){const meta=catalogRows.find(r=>r.instrumentUid===item.dataset.chartUid),key=item.dataset.chartUid+':CANDLE_INTERVAL_DAY';const rows=(cache.get(key)||cache.get(key+':preview'))?.rows;if(!meta||!rows?.length)continue;
   const levels=alerts.filter(a=>a.symbol===meta.ticker).map(a=>Number(a.targetPrice));for(const doc of documents.values())if(doc.instrumentUid===meta.instrumentUid)levels.push(...(doc.view?.drawings||[]).filter(d=>d.type==='horizontal').map(d=>d.points[0].price));
   const m=radarMeasure(rows,levels),f=layout.radar;if((f.change&&Math.abs(m.change??0)<f.change)||(f.volume&&(m.volumeRatio===null||m.volumeRatio<f.volume))||(f.distance&&(m.distance===null||m.distance>f.distance)))continue;result.push({meta,rows,m});}
  host.querySelector('.terminal-radar-table').innerHTML=result.length?`<table><thead><tr><th>Инструмент</th><th>Цена</th><th>За день</th><th>Объём / средний</th><th>До уровня</th><th>Динамика</th></tr></thead><tbody>${result.sort((a,b)=>(b.m.volumeRatio||0)-(a.m.volumeRatio||0)).map(({meta,rows,m})=>`<tr><td><button data-radar-uid="${esc(meta.instrumentUid)}">${esc(meta.ticker)}</button></td><td>${num(m.price)}</td><td class="${m.change<0?'negative':'positive'}">${pct(m.change)}</td><td title="Предыдущих свечей: ${m.volumeSamples}">${num(m.volumeRatio)}×</td><td>${m.distance===null?'—':num(m.distance)+'%'}</td><td class="${m.change<0?'negative':'positive'}">${spark(rows)}</td></tr>`).join('')}</tbody></table>`:'<p class="empty-copy">Совпадений с этими условиями пока нет. Измените фильтр или дождитесь загрузки котировок списка.</p>';}
 async function detach(id){const native=globalThis.nexusProduct?.terminal;if(detachedId){await native?.returnChart();return;}await flush();if(pending.has(id)){showToast('Сначала сохраните изменения графика.');return;}
  if(!native){showToast('Отдельное окно доступно в обновлённом Nexus.');return;}
  const result=await native.openChart(id);if(!result?.ok){showToast(result?.error?.message||'Не удалось открыть окно. График остаётся здесь.');return;}
  detached.add(id);const e=charts.get(id);e?.api?.destroy();e?.card.remove();charts.delete(id);layout.active=layout.tabs.find(key=>!detached.has(key))||id;layoutView();if(!detached.has(layout.active))selection(layout.active);}
 async function returned(id){if(!detached.has(id))return;try{const doc=await read(id);if(doc)documents.set(id,doc);}catch{message('Не удалось восстановить график после возврата.',true);return;}detached.delete(id);layout.active=id;layoutView();selection(id);}
 async function init(){try{catalogRows=previewOnly()?(getBootstrap()?.instruments||[]):(await request('/api/market/catalog')).items||[];const stored=await read('layout');if(stored){layout={...emptyLayout(),...stored};if(stored.panelsVersion!==2){layout.auxiliary='';layout.dockCollapsed=true;}if(!Object.hasOwn(panelLabels,layout.auxiliary))layout.auxiliary='';layout.panelsVersion=2;}
   if(detachedId){layout.tabs=[detachedId];layout.active=detachedId;layout.count=1;document.body.classList.add('terminal-detached');$('#terminalReturn').hidden=false;}
   layout.tabs=layout.tabs.filter(id=>/^chart-[a-zA-Z0-9_-]{1,64}$/.test(id)).slice(0,12);await Promise.all(layout.tabs.map(async id=>{const doc=await read(id);if(doc?.instrumentUid)documents.set(id,doc);}));layout.tabs=layout.tabs.filter(id=>documents.has(id));
  }catch{message('Настройки не загрузились. Откройте раздел заново после восстановления связи.',true);return;}
  ready=true;if(!layout.tabs.length){const meta=getSelection()||getBootstrap()?.instruments?.[0];if(meta)await openInstrument(meta);}else{if(!documents.has(layout.active))layout.active=layout.tabs[0];layoutView();selection(layout.active);}dockTab(layout.dock,!layout.dockCollapsed,false);void enrichWatchlist();
  if(detachedId)document.querySelector('.nav-item[data-view="terminal"]')?.click();}
 panel.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;const data=button.dataset,id=button.closest('[data-chart-id]')?.dataset.chartId;if(!button.closest('.terminal-layout-menu'))toolbar.querySelector('details').open=false;
  if(button.hasAttribute('data-workspace-menu')){$('[data-open-rail]')?.click();}
  else if(data.panel){openPanel(data.panel,true);}
  else if(button.hasAttribute('data-close-panel')){const previous=layout.auxiliary;openPanel('');panelRail.querySelector('[data-panel="'+previous+'"]')?.focus();}
  else if(data.chartTab){if(detached.has(data.chartTab)){showToast('График вынесен в отдельное окно. Верните его кнопкой в том окне.');return;}if(expandedId)expandChart(data.chartTab,expandFocus);else{selection(data.chartTab);layoutView();}}
  else if(data.closeChart){if(expandedId)expandChart(null);if(detached.has(data.closeChart)){showToast('Сначала верните график из отдельного окна.');return;}if(layout.tabs.length===1){showToast('Оставьте хотя бы один график.');return;}const entry=charts.get(data.closeChart);entry?.api?.destroy();entry?.card.remove();charts.delete(data.closeChart);pending.delete(data.closeChart);documents.delete(data.closeChart);layout.tabs=layout.tabs.filter(x=>x!==data.closeChart);layout.active=layout.tabs[0];layoutView();selection(layout.active);}
  else if(data.duplicateChart){if(layout.tabs.length>=12){showToast('Открыто 12 вкладок. Закройте ненужную.');return;}const next='chart-'+crypto.randomUUID();documents.set(next,structuredClone(documents.get(data.duplicateChart)));layout.tabs.push(next);layout.active=next;if(expandedId)expandedId=next;dirty(next);layoutView();selection(next);}
  else if(data.layout){layout.count=Number(data.layout);toolbar.querySelector('details').open=false;layoutView();dirty('layout');}
  else if(data.link){const key=data.link==='cursor'?'linkCursor':'linkPeriod';layout[key]=!layout[key];layoutView();dirty('layout');}
  else if(data.collapse){if(data.collapse==='dock')dockTab(layout.dock,!layout.dockCollapsed);else openPanel(data.collapse==='watch'?'watch':'plan',true);}
  else if(data.terminalTab)dockTab(data.terminalTab,layout.dockCollapsed||layout.dock!==data.terminalTab);
  else if(data.side)sideTab(data.side);
  else if(button.hasAttribute('data-market-bottom')){const name=layout.auxiliary;openPanel('');dockTab(name);}
  else if(button.hasAttribute('data-market-side')){const name=layout.dock;dockTab(name,false);openPanel(name);}
  else if(data.toolGroup!==undefined){selection(id);editors.tools(button,Number(data.toolGroup));}
  else if(data.tool){selection(id);charts.get(id)?.api?.beginDrawing(data.tool==='cursor'?null:data.tool);}
  else if(button.hasAttribute('data-clear-drawings'))charts.get(id)?.api?.clearDrawings();
  else if(data.history)charts.get(layout.active)?.api?.drawings[data.history]();
  else if(data.expandChart)expandChart(expandedId?null:data.expandChart,button);
  else if(button.hasAttribute('data-magnet')){const layer=charts.get(id)?.api?.drawings;layer?.setMagnet(!layer.isMagnet());}
  else if(button.hasAttribute('data-hide-drawings')){const layer=charts.get(id)?.api?.drawings;layer?.hide(!layer.isHidden());}
  else if(data.compareRemove)void compareInstrument({instrumentUid:data.compareRemove},true);
  else if(data.compareToggle){const doc=activeDoc(),meta=doc.comparisons.find(m=>m.instrumentUid===data.compareToggle);meta.visible=meta.visible===false;void loadComparison(layout.active,meta);dirty(layout.active);}
  else if(data.detachChart){if(expandedId)expandChart(null);void detach(data.detachChart);}
  else if(data.terminalIndicator){const api=charts.get(layout.active)?.api,name=data.terminalIndicator,value=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(value));api?.toggle(name,value);}
  else if(data.radarUid)void openInstrument(catalogRows.find(r=>r.instrumentUid===data.radarUid));
  else if(button.hasAttribute('data-create-alert'))$('#instrumentPriceAlert').click();
  else if(data.planVersion!==undefined){activeDoc().plan={...activeDoc().plans[Number(data.planVersion)]};renderPlan();dirty(layout.active);}
  else if(button.hasAttribute('data-save-filter')){layout.radarSaved=[...(layout.radarSaved||[]),{name:'Фильтр '+((layout.radarSaved||[]).length+1),filter:{...layout.radar}}].slice(-10);dirty('layout');void renderRadar();}
  else if(button.id==='terminalAdd'||button.hasAttribute('data-add-slot'))editors.picker(button);
  else if(button.id==='terminalFit')charts.get(layout.active)?.api?.fitContent();
  else if(button.id==='terminalPlanNew'){activeDoc().plan=null;renderPlan();dirty(layout.active);}
  else if(data.chartZoom)charts.get(layout.active)?.api?.zoom(Number(data.chartZoom));
  else if(data.earlier){const e=charts.get(data.earlier);if(e){e.historyPaused=false;e.emptyPages=0;}if(documents.get(data.earlier)?.historyDate)void loadEarlier(data.earlier,true);else void loadAllHistory(data.earlier);}
  else if(button.id==='terminalDate')editors.datePicker(button);
  else if(button.id==='terminalLive')void jumpDate(null);
  else if(button.id==='terminalScale')editors.scale(button);
  else if(button.id==='terminalObjects')editors.objects(button);
  else if(button.id==='terminalSettings')editors.settings(button);
  else if(button.id==='terminalReplay')replayControls.toggle();
  else if(button.id==='terminalIndicators')editors.indicators(button);
  else if(button.id==='terminalSymbolSearch')editors.picker(button);
  else if(button.id==='terminalCompare')editors.picker(button,true);
  else if(button.id==='terminalExpand')expandChart(expandedId?null:layout.active,button);
  else if(button.id==='terminalReturn')void detach(detachedId);
 });
 main.querySelector('.terminal-grid').addEventListener('pointerdown',event=>{const id=event.target.closest('[data-chart-id]')?.dataset.chartId;if(id&&id!==layout.active)selection(id);});
 type.addEventListener('change',()=>charts.get(layout.active)?.api?.setType(type.value));
 interval.addEventListener('change',()=>{const doc=activeDoc();if(!doc)return;charts.get(layout.active)?.api?.stopReplay();doc.interval=interval.value;doc.view={...doc.view,range:null};const e=charts.get(layout.active);if(e){e.historyPaused=false;e.emptyPages=0;}if(doc.interval==='CANDLE_INTERVAL_DAY')doc.view.indicators.vwap=false;selection(layout.active);dirty(layout.active);void loadChart(layout.active);});
 $('#terminalFlash').addEventListener('change',event=>charts.get(layout.active)?.api?.setFlash(event.target.checked));
 $('#terminalNote').addEventListener('input',event=>{activeDoc().note=event.target.value;dirty(layout.active);});
 $('#terminalPlanForm').addEventListener('input',()=>{renderRisk();dirty(layout.active);});
 $('#terminalPlanForm').addEventListener('submit',async event=>{event.preventDefault();const doc=activeDoc();doc.plans=[...(doc.plans||[]),{...doc.plan,name:'План '+((doc.plans||[]).length+1)}].slice(-12);dirty(layout.active);await flush();renderPlan();side.querySelector('.terminal-plan-message').textContent=pending.has(layout.active)?'План пока не сохранён. Повторите.':'План сохранён на этом устройстве.';});
 dock.addEventListener('submit',event=>{if(!event.target.matches('.terminal-radar-filter'))return;event.preventDefault();layout.radar=Object.fromEntries([...new FormData(event.target)].map(([k,v])=>[k,Number(v)]));dirty('layout');void renderRadar();});
 dock.addEventListener('change',event=>{if(event.target.id!=='terminalRadarSaved'||event.target.value==='')return;layout.radar={...layout.radarSaved[Number(event.target.value)].filter};for(const[k,v]of Object.entries(layout.radar))$('#terminalRadar form').elements[k].value=v;dirty('layout');void renderRadar();});
 panel.addEventListener('keydown',event=>{const tab=event.target.closest('[role="tab"]');if(!tab||event.ctrlKey||event.metaKey||event.altKey||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const tabs=[...tab.closest('[role="tablist"]').querySelectorAll('[role="tab"]')],i=tabs.indexOf(tab);const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[next].click();tabs[next].focus();});
 document.addEventListener('invest:watchlist-rendered',()=>{if(ready&&visible)void enrichWatchlist();});
 document.addEventListener('invest:catalog-updated',()=>{void request('/api/market/catalog').then(result=>{catalogRows=result.items||[];if(ready&&visible){void enrichWatchlist();for(const id of idsVisible())void loadChart(id);}}).catch(()=>{});});
 globalThis.nexusProduct?.terminal?.onReturned?.(id=>void returned(id));
 globalThis.nexusProduct?.terminal?.onPrepareClose?.(async()=>{if(await flush())globalThis.nexusProduct.terminal.closeReady();else message('Окно оставлено открытым: не удалось сохранить изменения. Повторите возврат после восстановления связи.',true);});
 let initial=init();
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&toolbar.querySelector('details').open)toolbar.querySelector('details').open=false;else if(e.key==='Escape'&&expandedId)expandChart(null);else if(e.key==='Escape'&&visible&&layout.auxiliary&&!panel.querySelector('.terminal-popover:not([hidden])')){const previous=layout.auxiliary;openPanel('');panelRail.querySelector('[data-panel="'+previous+'"]')?.focus();}if(visible&&e.altKey&&e.key==='Enter'){e.preventDefault();expandChart(expandedId?null:layout.active,document.activeElement);}});
 function marketSubscription(){return {charts:visible?idsVisible().flatMap(id=>{const doc=documents.get(id);return doc?.instrumentUid&&!doc.historyDate&&!charts.get(id)?.api?.getReplay().active?[{instrumentUid:doc.instrumentUid,interval:doc.interval}]:[];}):[],focus:visible?activeDoc()?.instrumentUid||'':''};}
 function subscriptionChanged(){document.dispatchEvent(new Event('invest:market-subscription'));}
 function updateCandle(row){
  const key=row.instrumentUid+':'+row.interval,prior=cache.get(key),next=applyLiveCache(prior,row,row.interval);if(!next)return;
  cacheVersions.set(key,(cacheVersions.get(key)||0)+1);cache.set(key,next);
  for(const[id,e]of charts)if(e.key===key){
   if(e.api?.getReplay().active)continue;
   if(!e.api){void loadChart(id);continue;}
   const normalized=normalizeMarketCandles([row],row.interval)[0];
   if(normalized.time<e.rows.at(-1)?.time){e.api.setData(next.rows);e.rows=next.rows;}else e.rows=e.api.updateCandle(row)||e.rows;
   const last=e.rows.at(-1),previous=e.rows.at(-2);if(!last)continue;
   e.card.querySelector('.terminal-chart-quote').innerHTML='<strong>'+num(last.close)+'</strong><small class="'+(last.close<previous?.close?'negative':'positive')+'">'+pct(previous?.close?(last.close/previous.close-1)*100:null)+' · к прошлой свече</small>';
   const source=e.card.querySelector('.terminal-chart-source');
   source.textContent=(next.fixture?'Тестовые данные':'Т‑Инвест')+' · свеча '+stamp(last.time)+' · получено '+stamp(Date.parse(row.capturedAt)/1000);source.classList.remove('stale');historyStatus(id);
   if(id===layout.active)renderStats();
  }
 }
 function applySnapshot(message){
  const key=message.instrumentUid+':'+message.interval;
  if(![...documents.values()].some(doc=>doc.instrumentUid===message.instrumentUid&&doc.interval===message.interval))return;
  cacheVersions.set(key,(cacheVersions.get(key)||0)+1);
  cache.set(key,applySnapshotCache(cache.get(key),message,message.interval));
  for(const[id,e]of charts)if(e.key===key)void loadChart(id);
 }
 function resetMarket(){streamGeneration++;cache.clear();cacheVersions.clear();activity.reset();for(const e of charts.values()){e.seq++;e.api?.destroy();e.api=null;e.rows=[];e.host.textContent='Восстанавливаем котировки…';e.card.querySelector('.terminal-chart-quote').textContent='—';}renderStats();}
 const activityTimer=setInterval(()=>{if(visible&&!document.hidden)activity.tick();},1000);
 window.addEventListener('pagehide',()=>clearInterval(activityTimer),{once:true});
 return {openInstrument,activate(view){visible=view==='terminal';if(!visible&&expandedId)expandChart(null);subscriptionChanged();clearInterval(refreshTimer);if(visible){for(const id of idsVisible())void loadAllHistory(id);refreshTimer=setInterval(()=>{if(document.hidden)return;for(const id of idsVisible())void loadChart(id);void enrichWatchlist();void loadContext();},60000);if(ready&&!layout.dockCollapsed&&layout.dock==='participants')participants.show();}else{for(const e of charts.values())e.api?.pauseReplay();participants.hide();void flush();}},
  async refresh(){await initial;if(!ready){initial=init();await initial;}if(!ready)return;const selected=getSelection();if(selected?.instrumentUid&&selected.instrumentUid!==activeDoc()?.instrumentUid)await openInstrument(selected);else if(ready)for(const id of idsVisible())void loadChart(id);if(visible)void enrichWatchlist();},
  update(){},updateCandle,marketSubscription,applySnapshot,resetMarket,
  marketEvent:event=>activity.receive(event),marketState:event=>activity.state(event),flush};
}
