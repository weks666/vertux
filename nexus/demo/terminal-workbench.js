import {terminalChartSymbol,tradingViewSymbol} from './terminal-chart-source.js';
import {chartSlots,selectChartSlot} from './terminal-chart-slots.js';
import {createWorldMarketChart} from './world-market-chart.js';
import {worldMarketCatalog,worldSymbol,isWorldInstrument,worldInstrument,mergeWorldDirectory} from './world-market-catalog.js';
import {createTerminalWorkspaceTransfer} from './terminal-workspace-transfer-ui.js';
import {createTerminalDockingTransfer} from './terminal-docking-transfer-ui.js';
import {createOrderTicket} from './terminal-order-ticket.js';
import {createTerminalCustomization} from './terminal-customization.js';
import {createChartMenus} from './terminal-chart-menus.js';
import {aggregateCandles,baseInterval,defaultResolution} from './chart-resolutions.js';
import {createTerminalDocking} from './terminal-docking.js';
import {createChartCursor} from './chart-cursor.js';
import {studyIcon} from './chart-study-legend.js';
import {chartFreshness} from './chart-freshness.js';
import {marketSessionLabel} from './market-session.js';
import {createInstrumentInsights} from './instrument-insights.js';
import {initTerminalWatchlist} from './terminal-watchlist.js';
import {createMarketActivity} from './terminal-market-activity.js';
import {createTerminalContextNavigation} from './terminal-context-navigation.js';
import {applyLiveCache,applySnapshotCache} from './terminal-live-cache.js';
import {liveDisplayTail} from './chart-live-tail.js';
import {createMarketChart,normalizeMarketCandles} from './charts.js';
import {initParticipantsPanel} from './market-participants.js';
import {radarMeasure,indicatorCatalog,normalizeStudy} from './chart-indicators.js';
import {isMeasuredVolume} from './chart-indicators-extra.js';
import {buildTerminalVolumeExplanation} from './terminal-volume-explanation.js';
import {createTerminalVolumeExplanationUi} from './terminal-volume-explanation-ui.js';
import {instrumentMark,watchInstrumentImages} from './instrument-mark.js';
import {createChartPreferences} from './chart-preferences.js';
import {initReplayControls} from './terminal-replay.js';
import {drawingGroups,drawingIcon} from './chart-tool-catalog.js';
import {initTerminalEditors} from './terminal-editors.js';
import {resolveInstrumentContext} from './instrument-context.js';
import {createTerminalSeriesPassportUi} from './terminal-series-passport-ui.js';
import {createTerminalStudyExplanationUi} from './terminal-study-explanation-ui.js';
import {TERMINAL_TASK_PRESETS,terminalPresetState,reconcileTerminalTaskPreset} from './terminal-task-presets.js';
import {createTerminalPresetActions,terminalWriteConfirmed,terminalWriteRecoveryState} from './terminal-preset-actions.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>Number.isFinite(v)?v.toLocaleString('ru-RU',{maximumFractionDigits:5}):'—';
const ohlcText=row=>row?`О ${num(row.open)}  М ${num(row.high)}  м ${num(row.low)}  З ${num(row.close)}  V ${isMeasuredVolume(row)?num(row.volume):'—'}`:'';
const pct=v=>Number.isFinite(v)?(v>0?'+':'')+v.toLocaleString('ru-RU',{maximumFractionDigits:2})+'%':'—';
const quoteNum=(value,meta)=>{const tick=Number(meta?.minPriceIncrementNanos)/1e9,precision=tick>0?Math.max(0,Math.min(8,Math.ceil(-Math.log10(tick)))):Math.abs(value)>0&&Math.abs(value)<.01?6:2;return Number.isFinite(value)?value.toLocaleString('ru-RU',{maximumFractionDigits:precision}):'—';};
const stamp=t=>new Date(t*1000).toLocaleString('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})+' мск';
const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${({menu:'M4 6h16M4 12h16M4 18h16',watch:'M4 4h16v16H4zM8 8h8M8 12h8M8 16h5',book:'M4 4v16M20 4v16M4 7h7M4 12h5M4 17h8M20 7h-5M20 12h-8M20 17h-6',tape:'M5 4h14v16H5zM8 8h8M8 12h5M8 16h7',plan:'M5 3h14v18H5zM8 7h8M8 11h8M8 15h4',layout:'M3 4h18v16H3zM12 4v16M12 12h9',magnet:'M5 3v10a7 7 0 0 0 14 0V3h-4v10a3 3 0 0 1-6 0V3zM5 7h4M15 7h4',eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0',zoomout:'M4 12h16',close:'m6 6 12 12M6 18 18 6',add:'M12 4v16M4 12h16',detach:'M14 3h7v7M21 3 11 13M9 5H4v15h15v-5',left:'M8 3v18M3 3h18v18H3z',right:'M16 3v18M3 3h18v18H3z',fit:'M4 4v16M20 4v16M7 12h10M10 9l-3 3 3 3M14 9l3 3-3 3',expand:'M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5',undo:'M9 5 3 10l6 5M4 10h10a6 6 0 0 1 0 12',redo:'m15 5 6 5-6 5M20 10H10a6 6 0 0 0 0 12',horizontal:'M3 12h18',trend:'m4 19 16-14M4 19h1M19 5h1',ray:'m3 20 17-16M14 4h6v6',rectangle:'M4 5h16v14H4z',freehand:'M3 16C5 2 8 23 12 9s5 9 9-4',fibonacci:'M3 4h18M3 10h18M3 14h18M3 20h18',trash:'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7',erase:'m3 15 10-11 8 7-9 10H8zM8 10l8 7M12 21h9',cursor:'M5 3v16l5-4 4 7 3-2-4-6h7z',bell:'M6 9a6 6 0 0 1 12 0v5l3 3H3l3-3zM10 21h4',chevron:'m6 9 6 6 6-6'})[name]||'M4 4h16v16H4z'}"/></svg>`;
const btn=(name,label,attr='')=>`<button type="button" class="terminal-icon" aria-label="${label}" title="${label}" ${attr}>${icon(name)}</button>`;
const choices=[['1_MIN','1 минута'],['5_MIN','5 минут'],['15_MIN','15 минут'],['HOUR','1 час'],['4_HOUR','4 часа'],['DAY','1 день'],['WEEK','1 неделя'],['MONTH','1 месяц']].map(([v,t])=>`<option value="CANDLE_INTERVAL_${v}">${t}</option>`).join('');
const freshChart=meta=>({instrumentUid:meta.instrumentUid,ticker:meta.ticker,interval:'CANDLE_INTERVAL_DAY',view:{range:{from:1780272000,to:1786536000},type:'candles',indicators:{volume:true},studies:[{id:'demo-sma20',type:'sma',period:20,color:'#e1b264',visible:true},{id:'demo-ema50',type:'ema',period:50,color:'#b9a9ff',visible:true}],drawings:[]},note:'',plans:[],plan:null});
// A UID-only persisted chart cannot prove a provider/listing identity. Keep this
// proof only for charts opened in the current runtime; do not infer it on load.
const chartIdentityFields=['assetType','currency','priceUnit','assetUid','figi','isin','classCode','exchange','realExchange','expirationDate','lastTradeDate','futuresType','basicAsset','underlyingType'];
function chartIdentity(meta){const resolved=resolveInstrumentContext(meta,{catalog:meta?[meta]:[]});return resolved.resolution==='exact'?JSON.stringify([resolved.ref,chartIdentityFields.map(key=>resolved.meta[key]??null)]):null;}
const emptyLayout=()=>({tabs:[],active:'',count:1,panelsVersion:2,auxiliary:'',watchCollapsed:true,sideCollapsed:true,dockCollapsed:true,dock:'stats',side:'plan',linkPeriod:false,linkCursor:false,radar:{change:0,volume:0,distance:0},radarSaved:[]});
function spark(rows){if(rows.length<2)return '';const values=rows.slice(-24).map(r=>r.close),min=Math.min(...values),max=Math.max(...values);return `<svg class="terminal-spark" viewBox="0 0 80 26" aria-hidden="true"><polyline points="${values.map((v,i)=>`${i/(values.length-1)*78+1},${23-(v-min)/(max-min||1)*20}`).join(' ')}"/></svg>`;}

export function initTerminal({request:baseRequest,getSelection,getBootstrap,onSelection,onChart,onPreparePlan,showToast=()=>{},readyPromise=Promise.resolve()}){
 let accountScope='',accountChanging=false,stagedAccountDocs=null;
 const request=(path,options)=>{if(accountScope&&(path==='/api/market/terminal'||path.startsWith('/api/market/terminal?')||path.startsWith('/api/market/terminal/'))){const url=new URL(path,location.origin);url.searchParams.set('account',accountScope);path=url.pathname+url.search;}return baseRequest(path,options);};
 const $=s=>document.querySelector(s),panel=$('[data-view-panel="terminal"]');
 const terminalAllowed=()=>getBootstrap()?.planAccess?.terminal!==false;
 let previousTerminalAccess=true;
 const planGate=document.createElement('section');planGate.className='terminal-plan-availability';planGate.hidden=true;
 planGate.innerHTML='<h2>Терминал доступен в Plus и Pro</h2><p>В Обычном доступны портфель, операции, аналитика, план и календарь. Для работы с терминалом выберите Plus или Pro.</p><button type="button">Посмотреть тарифы</button>';
 planGate.querySelector('button').addEventListener('click',()=>document.querySelector('[data-system-section="subscription"]')?.click());
 panel.prepend(planGate);
 const oldSurface=panel.querySelector('.instrument-surface'),shortlist=panel.querySelector('.instrument-shortlist'),catalog=$('#instrumentCatalogBrowser'),dock=panel.querySelector('.terminal-dock');
 const interval=$('#marketInterval'),type=$('#marketChartType');
 const compat=document.createElement('div');compat.hidden=true;compat.className='terminal-compat';compat.append(oldSurface);panel.append(compat);$('#marketChart').id='legacyMarketChart';
 panel.querySelector('.terminal-workbench')?.classList.remove('terminal-workbench');panel.classList.add('terminal-workbench');
 const toolbar=document.createElement('header');toolbar.className='terminal-workspace-bar';toolbar.innerHTML=`${btn('menu','Разделы Workspace','data-workspace-menu')}<div class="terminal-tabs" role="tablist" aria-label="Открытые инструменты"></div><details class="terminal-layout-menu"><summary aria-label="Раскладка графиков">${icon('layout')}<span>Раскладка</span></summary><div class="terminal-layout-tools"><div class="terminal-layout-switch" role="group" aria-label="Число графиков">${[1,2,4].map(n=>`<button type="button" data-layout="${n}" aria-pressed="${n===1}">${n===1?'Один график':n+' графика'}</button>`).join('')}</div><button type="button" data-link="cursor" aria-pressed="false">Общий курсор для графиков</button><button type="button" data-link="period" aria-pressed="false">Общий период</button></div></details><button type="button" id="terminalReturn" hidden>Вернуть в Workspace</button>`;toolbar.querySelector('[data-workspace-menu]').classList.add('terminal-workspace-menu');

 const presetUi=document.createElement('section');presetUi.className='terminal-task-presets';presetUi.innerHTML='<p>Рабочий пресет</p><div role="group" aria-label="Рабочий пресет">'+TERMINAL_TASK_PRESETS.map(row=>`<button type="button" data-task-preset="${row.id}" aria-pressed="false"><span>${row.label}</span><small>${row.description}</small></button>`).join('')+'</div><button type="button" data-task-preset="restore" hidden>Вернуть своё расположение</button><p class="terminal-preset-hint"></p>';toolbar.querySelector('.terminal-layout-tools').prepend(presetUi);
 const presetResult=document.createElement('p');presetResult.className='terminal-preset-result';presetResult.setAttribute('role','status');presetUi.append(presetResult);
 const main=document.createElement('section');main.className='terminal-main';main.innerHTML='<div class="terminal-chart-controls"><div class="terminal-timeframes"></div><div class="terminal-common-tools"></div></div><div class="terminal-favorites-bar" role="toolbar" aria-label="Избранные инструменты и индикаторы" hidden></div><div class="terminal-grid" data-count="1"></div><p class="terminal-save-state" role="status"></p>';
 const sizeGrid=main.querySelector('.terminal-grid'),sizeHint=document.createElement('p');sizeHint.className='terminal-size-hint';sizeHint.id='terminalSizeHint';sizeHint.hidden=true;sizeHint.textContent='Для этой раскладки нужна прокрутка. Прокрутите область или разверните нужный график кнопкой в его заголовке.';sizeGrid.before(sizeHint);sizeGrid.setAttribute('role','region');sizeGrid.setAttribute('aria-label','Область графиков');sizeGrid.setAttribute('aria-describedby',sizeHint.id);
 let sizeHintFrame=0;const sizeCards=new Set(),updateSizeHint=()=>{if(sizeHintFrame)return;sizeHintFrame=requestAnimationFrame(()=>{sizeHintFrame=0;for(const card of sizeCards)if(!sizeGrid.contains(card)){sizeObserver.unobserve(card);sizeCards.delete(card);}if(!sizeGrid.clientWidth||!sizeGrid.clientHeight)return;const overflow=sizeGrid.scrollWidth>sizeGrid.clientWidth+1||sizeGrid.scrollHeight>sizeGrid.clientHeight+1;sizeHint.hidden=!overflow;sizeGrid.tabIndex=overflow?0:-1;for(const card of sizeGrid.querySelectorAll('.terminal-chart-card'))if(!sizeCards.has(card)){sizeCards.add(card);sizeObserver.observe(card);}});};
 const sizeObserver=new ResizeObserver(updateSizeHint);sizeObserver.observe(sizeGrid);new MutationObserver(updateSizeHint).observe(sizeGrid,{childList:true,subtree:true});
 const controls=main.querySelector('.terminal-common-tools');type.parentElement.removeChild(type);controls.append(type);interval.innerHTML=choices;interval.setAttribute('aria-label','Интервал свечей');main.querySelector('.terminal-timeframes').append(interval);
 controls.insertAdjacentHTML('beforeend','<button type="button" id="terminalCompare">Сравнить</button><button type="button" id="terminalDate">К дате</button><button type="button" id="terminalLive" hidden>К последним свечам</button><button type="button" id="terminalScale">Шкала</button><button type="button" id="terminalObjects">Объекты</button><button type="button" id="terminalIndicators">Индикаторы</button><button type="button" id="terminalReplay" aria-pressed="false">Воспроизведение</button><button type="button" class="terminal-icon" id="terminalSettings" aria-label="Настройки графика" title="Настройки графика">'+studyIcon('gear')+'</button>');
 for(const n of ['sma','ema','bb','vwap','rsi','macd','volume']){const b=document.createElement('button');b.type='button';b.dataset.terminalIndicator=n;b.dataset.indicator=n;b.textContent=({sma:'SMA 20',ema:'EMA 20',bb:'Bollinger',vwap:'VWAP',rsi:'RSI 14',macd:'MACD',volume:'Объём'})[n];b.setAttribute('aria-pressed',String(n==='volume'));if(n!=='volume')b.className='terminal-quick-indicator';controls.append(b);}
 controls.insertAdjacentHTML('beforeend',`${btn('undo','Отменить разметку','data-history="undo"')}${btn('redo','Повторить разметку','data-history="redo"')}${btn('add','Приблизить график','data-chart-zoom="0.7"')}${btn('zoomout','Отдалить график','data-chart-zoom="1.4"')}${btn('fit','Вместить всю историю','id="terminalFit"')}<label class="terminal-flash" hidden><input type="checkbox" id="terminalFlash">Подсветка цены</label>`);
 const side=document.createElement('aside');side.className='terminal-side';side.innerHTML=`<header class="terminal-panel-heading"><strong id="terminalAuxiliaryTitle">План сделки</strong><button type="button" data-market-bottom title="Переместить под график" hidden>Вниз</button><button type="button" data-keep-panel title="Оставить панель открытой при выборе другой">Оставить</button>${btn('close','Закрыть панель','data-close-panel')}</header><div id="terminalPlan"><p class="terminal-caption">Сценарий · заявки брокеру не отправляются</p><div class="terminal-plan-versions"></div><form id="terminalPlanForm"><label>Направление<select name="action"><option value="buy">Покупка</option><option value="sell">Продажа</option></select></label>${[['entry','Вход'],['stop','Стоп'],['target','Цель'],['quantity','Количество лотов']].map(([name,label])=>`<label>${label}<input name="${name}" inputmode="decimal" type="number" step="${name==='quantity'?'1':'any'}" min="${name==='quantity'?'1':'0.000000001'}" required></label>`).join('')}<p class="terminal-plan-risk"></p><label class="terminal-note-label">Условие входа<textarea name="note" rows="3" maxlength="1000" placeholder="Что должно подтвердиться перед входом"></textarea></label><button class="button primary" type="submit">Сохранить план</button><button class="button secondary" type="button" id="terminalPlanNew">Новый сценарий</button></form><div class="terminal-plan-message" role="status"></div></div><div id="terminalSideAlerts" hidden></div><label class="terminal-note-label">Заметка к инструменту<textarea id="terminalNote" maxlength="2000" rows="3" placeholder="Что важно проверить"></textarea></label>`;
 dock.innerHTML=`<header><div role="tablist" aria-label="Контекст инструмента">${[['stats','Статистика'],['book','Стакан'],['tape','Лента сделок'],['participants','Позиции участников'],['events','События'],['radar','Радар рынка']].map(([key,label])=>`<button type="button" role="tab" id="terminalTab${key}" data-terminal-tab="${key}" aria-controls="terminal${key[0].toUpperCase()+key.slice(1)}" aria-selected="${key==='stats'}">${label}</button>`).join('')}</div><div class="terminal-dock-actions"><button type="button" data-market-side hidden>Справа</button>${btn('close','Закрыть нижнюю панель','data-collapse="dock"')}</div></header><div class="terminal-dock-body"><div id="terminalStats" data-dock="stats" role="tabpanel"></div><div id="terminalBook" data-dock="book" role="tabpanel" hidden></div><div id="terminalTape" data-dock="tape" role="tabpanel" hidden></div><div id="terminalParticipants" data-dock="participants" role="tabpanel" hidden></div><div id="terminalEvents" data-dock="events" role="tabpanel" hidden></div><div id="terminalRadar" data-dock="radar" role="tabpanel" hidden></div></div>`;
 side.id='terminalAuxiliary';side.setAttribute('aria-labelledby','terminalAuxiliaryTitle');shortlist.id='terminalWatchlist';shortlist.querySelector('.surface-head').insertAdjacentHTML('beforeend','<button type="button" data-keep-watch title="Оставить котировки открытыми при выборе другой панели">Оставить</button>'+btn('close','Закрыть котировки','data-close-panel'));
 side.insertAdjacentHTML('beforeend','<div id="terminalSideMarket" hidden><div id="terminalSideBook"></div><div id="terminalSideTape"></div></div>');
 const quoteHead=document.createElement('div');quoteHead.className='terminal-quote-head';quoteHead.innerHTML='<span>Инструмент</span><span title="Последняя дневная свеча">Последняя</span><span title="Изменение к предыдущему дневному закрытию">Изм.</span><span>Изм. %</span>';shortlist.querySelector('#instrumentQuickList').before(quoteHead);
 const panelRail=document.createElement('nav');panelRail.className='terminal-panel-rail';panelRail.setAttribute('aria-label','Панели терминала');panelRail.innerHTML=[['watch','watch','Котировки'],['book','book','Стакан'],['tape','tape','Лента'],['trade','plan','Заявка'],['plan','plan','План'],['alerts','bell','Уровни']].map(([key,glyph,label])=>`<button type="button" data-panel="${key}" aria-label="${label}" title="${label} · Ctrl+нажатие открывает рядом" aria-expanded="false" aria-controls="${key==='watch'?'terminalWatchlist':'terminalAuxiliary'}">${icon(glyph)}<span>${label}</span></button>`).join('');const stage=document.createElement('div');stage.className='terminal-stage';stage.append(main,shortlist,side,panelRail);panel.prepend(toolbar,stage,dock);panel.append(catalog);catalog.querySelector('summary').addEventListener('click',event=>{event.preventDefault();catalog.open=false;editors.picker(event.currentTarget);});
 // Focus keeps every context module in one inspector; custom dock trees still
 // retain their original live nodes and explicit pinned panels.
 stage.insertBefore(dock,panelRail);
 dock.querySelector('[role=tablist]').remove();
 dock.querySelector('header').insertAdjacentHTML('afterbegin','<strong id="terminalContextTitle">Обзор актива</strong>');
 dock.querySelector('[data-collapse=dock]').setAttribute('aria-label','Закрыть обзор инструмента');
 panelRail.insertAdjacentHTML('beforeend',[['stats','watch','Обзор'],['events','bell','События'],['radar','layout','Радар'],['participants','book','Участники']].map(([key,glyph,label])=>`<button type="button" data-terminal-tab="${key}" aria-label="${label}" title="${label}" aria-pressed="false" aria-expanded="false" aria-controls="terminal${key[0].toUpperCase()+key.slice(1)}">${icon(glyph)}<span>${label}</span></button>`).join(''));
 const oldBoard=panel.querySelector('.market-vision-surface');if(oldBoard)oldBoard.hidden=true;
 for(const host of [side,dock.querySelector('.terminal-dock-body')]){const note=document.createElement('p');note.className='terminal-external-context';note.textContent='Котировки и инструменты анализа этого источника находятся на графике TradingView. Брокерские расчёты к нему не подключены.';host.append(note);}
 const streamStatus=document.createElement('span');streamStatus.className='terminal-stream-status';streamStatus.setAttribute('role','status');toolbar.append(streamStatus);
 const planJournal=document.createElement('button');planJournal.type='button';planJournal.id='terminalPlanJournal';planJournal.className='button secondary';planJournal.textContent='В журнал идей';planJournal.disabled=true;
 side.querySelector('#terminalPlanNew').before(planJournal);
 planJournal.addEventListener('click',()=>{
  if(planJournal.disabled||!ready||presetBusy||persistenceBlocked||previewOnly())return;
  const doc=activeDoc(),id=layout.active,epoch=identityEpoch,values=Object.fromEntries(new FormData($('#terminalPlanForm')));
  const input={...values,instrumentUid:doc?.instrumentUid},signature=JSON.stringify(values);
  const isCurrent=()=>ready&&!presetBusy&&!persistenceBlocked&&!previewOnly()&&identityEpoch===epoch&&layout.active===id&&activeDoc()===doc&&JSON.stringify(Object.fromEntries(new FormData($('#terminalPlanForm'))))===signature;
  const result=onPreparePlan?.(input,{isCurrent});$('.terminal-plan-message').textContent=result?.message||'';
 });
 const activity=createMarketActivity({bookHost:$('#terminalBook'),tapeHost:$('#terminalTape'),statusHost:streamStatus,onPreferencesChange:value=>{layout.activity=value;dirty('layout');}});
 const insights=createInstrumentInsights({host:$('#terminalStats'),request,getBootstrap,compact:true});
 const cacheVersions=new Map();let streamGeneration=0;
 const participants=initParticipantsPanel({host:$('#terminalParticipants'),request,getAccess:()=>getBootstrap()?.planAccess?.participants!==false});
 const documents=new Map(),charts=new Map(),cache=new Map(),requests=new Map(),revisions=new Map(),pending=new Set(),saving=new Map(),detached=new Set(),chartIdentities=new Map();
 let expandedId=null,expandFocus=null,expandAnchor=null,nativeFullscreen=false,fullscreenRequest=null;let layout=emptyLayout(),catalogRows=[],alerts=[],events=[],ready=false,visible=false,saveTimer=null,refreshTimer=null,contextGeneration=0,quoteGeneration=0,syncCursor=false,syncPeriod=false;
 let ownerScope=null,identityTag=null,identityEpoch=0,persistenceBlocked=false,presetBusy=false,volumeExplanation=null,marketPhase='waiting';
 let worldRows=worldMarketCatalog.map(row=>({...row,featured:true})),worldDirectoryTask=null;
 const metaFor=doc=>catalogRows.find(r=>r.instrumentUid===doc?.instrumentUid)||worldRows.find(r=>r.instrumentUid===doc?.instrumentUid)||(isWorldInstrument(doc)?worldInstrument(worldSymbol(doc)):null)||(getBootstrap()?.instruments||[]).find(r=>r.instrumentUid===doc?.instrumentUid)||doc||{};
 const widgetSymbol=doc=>terminalChartSymbol(doc,metaFor(doc));
 const usesWidget=doc=>Boolean(widgetSymbol(doc));
 const pickerCatalog=()=>previewOnly()?catalogRows:[...catalogRows,...worldRows,...[...documents.values()].filter(isWorldInstrument).map(metaFor)];
 function resetWorldCharts(){for(const entry of charts.values()){entry.world?.dispose();entry.world=null;}}
 async function loadWorldDirectory(){if(previewOnly())return;worldDirectoryTask??=fetch(new URL('./world-market-directory.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Public directory');return r.json();}).then(data=>{worldRows=mergeWorldDirectory(data).map(row=>({...row,featured:worldMarketCatalog.some(m=>m.instrumentUid===row.instrumentUid)}));}).catch(()=>{});await worldDirectoryTask;}
 window.addEventListener('pagehide',resetWorldCharts,{once:true});
 // A click inside a cross-origin chart cannot bubble to the grid. Observe only
 // focus on our own iframe element, without reading the provider's document.
 window.addEventListener('blur',()=>{setTimeout(()=>{const target=document.activeElement;if(target?.tagName!=='IFRAME')return;const id=target.closest('.terminal-chart-card')?.dataset.chartId;if(visible&&id&&id!==layout.active&&!accountChanging&&!persistenceBlocked)selection(id);},0);});
 const retryableSaves=new Map();let hardPersistenceBlock=false,recoveryPromise=null;
 function blockPersistence(){persistenceBlocked=true;hardPersistenceBlock=true;retryableSaves.clear();}
 async function recoverTransientSaves(){
  if(hardPersistenceBlock||!retryableSaves.size)return false;
  if(recoveryPromise)return recoveryPromise;
  recoveryPromise=(async()=>{
   const verified=[];
   try{
    for(const [key,{input,epoch}] of retryableSaves){
     const receipt=await request('/api/market/terminal?'+new URLSearchParams({key}));
     if(hardPersistenceBlock||epoch!==identityEpoch||input.expectedOwnerScope!==ownerScope){blockPersistence();return false;}
     const state=terminalWriteRecoveryState(receipt,{...input,ownerScope:input.expectedOwnerScope});
     if(state==='conflict'){blockPersistence();message('Сохранённая версия изменилась. Не закрывайте окно: проверьте изменения перед повторным сохранением.',true);return false;}
     verified.push({key,input,receipt,state});
    }
    if(hardPersistenceBlock)return false;
    for(const {key,input,receipt,state} of verified){
     revisions.set(key,receipt.revision);
     const current=key==='layout'?layout:documents.get(key);
     if(state==='confirmed'&&JSON.stringify(current)===JSON.stringify(input.value))pending.delete(key);
    }
    retryableSaves.clear();persistenceBlocked=false;paintPresetUi();return true;
   }catch(error){
    if([401,403,409].includes(error.status))blockPersistence();
    message('Не удалось проверить сохранение. Оставьте окно открытым и повторите возврат после восстановления связи.',true);return false;
   }
  })().finally(()=>{recoveryPromise=null;});
  return recoveryPromise;
 }
 const identityKey=value=>JSON.stringify([value.organizationId,value.productId,value.preferenceScope||value.userId||value.id||value.displayName||value.name||'device']);
 const detachedId=location.hash.match(/^#terminal\/(chart-[a-zA-Z0-9_-]{1,64})$/)?.[1]||'';
 const watchTable=initTerminalWatchlist({shortlist,stage,panel,isPreview:()=>settingsPreview(),getCatalog:()=>catalogRows,openNews:()=>{document.querySelector('[data-view="events"]')?.click();document.dispatchEvent(new CustomEvent('invest:terminal-news',{detail:activeMeta()}));}});
 const activeDoc=()=>documents.get(layout.active);
 const activeMeta=()=>metaFor(activeDoc());
 const passportButton=document.createElement('button');passportButton.type='button';passportButton.id='terminalDataPassport';passportButton.textContent='О данных';controls.append(passportButton);
 // TradingView-like toolbar: icon buttons keep their words as accessible names
 // (and in textContent), only "Индикаторы" and "Повтор" stay visible as text.
 const toolIcon=d=>'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+d+'"/></svg>';
 for(const [id,d,text]of [['terminalCompare','M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v8M8 12h8'],['terminalObjects','M12 3 3 7.5l9 4.5 9-4.5L12 3zM3 12l9 4.5 9-4.5M3 16.5 12 21l9-4.5'],
  ['terminalScale','M4 4v16h16M8 15l3-4 3 2 5-6'],['terminalReplay','M11 7 5 12l6 5V7zM19 7l-6 5 6 5V7z','Повтор'],['terminalDataPassport','M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5v.5']]){
  const button=main.querySelector('#'+id);if(!button)continue;const label=button.textContent.trim();button.setAttribute('aria-label',label);button.title=label;button.classList.add('terminal-tool');
  button.innerHTML=toolIcon(d)+'<span class="'+(text?'terminal-tool-text':'ui-sr-only')+'">'+esc(text||label)+'</span>';}
 main.querySelector('#terminalIndicators')?.insertAdjacentHTML('afterbegin','<span class="terminal-tool-fx" aria-hidden="true">ƒx</span>');
 const seriesSnapshot=(contextOnly=false)=>{
  const entry=charts.get(layout.active),doc=activeDoc(),meta=activeMeta(),cached=cache.get(entry?.key)||{};
  return {ownerEpoch:identityEpoch,paneId:layout.active,instrument:meta,interval:doc?.interval,displayResolution:doc?.resolution,historyDate:doc?.historyDate,
   rows:contextOnly?[]:entry?.api?.getSourceRows()||[],calculationRows:contextOnly?[]:entry?.api?.getRows()||[],state:entry?.seriesState,
   view:entry?.api?.getState()||{type:doc?.view?.type,timezone:doc?.view?.timezone||'Europe/Moscow'},replay:entry?.api?.getReplay()||{active:false},
   visibleRange:contextOnly?null:entry?.api?.chart.timeScale().getVisibleRange(),source:{label:cached.source||(getBootstrap()?.environment==='fixture'?'Учебные данные':meta.publicMarketData?'Публичные котировки':'Т‑Инвест'),
    fixture:cached.fixture===true||getBootstrap()?.preview?.static===true||getBootstrap()?.environment==='fixture'&&!meta.publicMarketData,
    capturedAt:cached.capturedAt,stale:cached.stale,hasMore:cached.history?.hasMore,
    liveEventAt:entry?.liveEventAt,liveReceivedAt:entry?.liveReceivedAt,streamState:marketPhase,
    historyLoading:Boolean(entry?.historyPending||entry?.autoHistory),historyPartial:Boolean(entry?.historyError||entry?.historyPaused)}};
 };
 const seriesPassport=createTerminalSeriesPassportUi({main,button:passportButton,getSnapshot:seriesSnapshot});
 const studyExplanation=createTerminalStudyExplanationUi({main,button:$('#terminalIndicators'),getSnapshot:seriesSnapshot});
 window.addEventListener('pagehide',()=>{seriesPassport.dispose();studyExplanation.dispose();volumeExplanation?.dispose();},{once:true});
 const invalidateExplanations=()=>{seriesPassport.invalidate();studyExplanation.invalidate();};
 const closeExplanations=()=>{seriesPassport.close(false);studyExplanation.close(false);volumeExplanation?.close(false);};
 const preferences=createChartPreferences({isPreview:()=>settingsPreview(),onChange:()=>{paintQuickTools();paintFavorites();}});
 const replayControls=initReplayControls({main,button:$('#terminalReplay'),activeChart:()=>charts.get(layout.active),onStop:()=>void loadChart(layout.active,true)});
 const preferenceSection=document.createElement('section');preferenceSection.className='chart-preferences-section';preferenceSection.innerHTML='<h3>Графики и инструменты</h3><div></div>';$('#'+ 'mainContent').querySelector('[data-view-panel=settings]').append(preferenceSection);preferences.mount(preferenceSection.querySelector('div'),{compact:true});
 const editors=initTerminalEditors({panel,preferences,explainStudy:(id,anchor)=>{seriesPassport.close(false);studyExplanation.open(id,anchor);},activeChart:()=>charts.get(layout.active),activeDoc,openInstrument,getCatalog:pickerCatalog,getBootstrap,
  compare:compareInstrument,loadHistory:()=>loadEarlier(layout.active,true),jumpDate,showToast,
  plan:price=>{if(expandedId)expandChart(null);openPanel('plan');$('#terminalPlanForm').elements.entry.value=price;renderRisk();dirty(layout.active);},
  alert:price=>{$('#instrumentPriceAlert').click();const field=document.querySelector('#priceAlertForm [name="targetPrice"]');if(field){field.value=price;field.dispatchEvent(new Event('input',{bubbles:true}));}}});
 const pinnedWidgets=new Map();let customization=null;
 const docking=createTerminalDocking({panel,main,stage,toolbar,onPinsChange:()=>paintPanels(),isExpanded:()=>!!expandedId,getChartIds:()=>ready?layout.tabs:null,isPreview:()=>settingsPreview(),showToast,getItems:()=>[
  ...(customization?[customization.dockItem()]:[]),
  ...[...charts].map(([id,e])=>({key:'chart:'+id,node:e.card,header:e.card.querySelector('header'),label:e.card.querySelector('.terminal-chart-identity strong')?.textContent||documents.get(id)?.ticker||'График',visible:!e.card.hidden})),
  {key:'watch',node:shortlist,header:shortlist.querySelector('.surface-head'),label:'Котировки',visible:!shortlist.hidden},
  ...[...pinnedWidgets].map(([name,node])=>({key:'panel:'+name,node,header:node.querySelector('header'),label:panelLabels[name],visible:true})),
  {key:'panel:'+(layout.auxiliary||'plan'),node:side,header:side.querySelector('header'),label:panelLabels[layout.auxiliary]||'Панель инструмента',visible:!side.hidden},
  {key:'context',node:dock,header:dock.querySelector('header'),label:'Анализ и данные',visible:!layout.dockCollapsed}
 ]});
 customization=createTerminalCustomization({panel,main,toolbar,onLayoutChange:()=>docking.sync(),isPreview:()=>settingsPreview(),getMeta:()=>{const meta=activeMeta(),symbol=widgetSymbol(activeDoc());return symbol?{...meta,chartProvider:'tradingview',exchange:symbol.split(':')[0]}:meta;},getRows:()=>cache.get(activeMeta().instrumentUid+':CANDLE_INTERVAL_DAY')?.rows||normalizeMarketCandles((getBootstrap()?.candles||[]).filter(r=>r.instrumentUid===activeMeta().instrumentUid&&r.interval==='CANDLE_INTERVAL_DAY')),getCurrentRows:()=>charts.get(layout.active)?.api?.getRows()||[],getReplay:()=>charts.get(layout.active)?.api?.getReplay().active,onSymbol:()=>editors.picker(main.querySelector('.ticker-symbol'))});
 const orderHost=document.createElement('div');orderHost.id='terminalOrder';orderHost.hidden=true;side.append(orderHost);const orderTicket=createOrderTicket({host:orderHost,getMeta:activeMeta,getPrice:()=>charts.get(layout.active)?.api?.getRows().at(-1)?.close,getContext:()=>{const snapshot=seriesSnapshot(true);return {identity:JSON.stringify([identityEpoch,identityTag]),blocked:persistenceBlocked,replay:snapshot.replay?.active===true,history:!!snapshot.historyDate,adjusted:snapshot.view?.dividendAdjusted===true,state:snapshot.state,stale:snapshot.source.stale===true,time:charts.get(layout.active)?.api?.getRows().at(-1)?.time};}});
 const chartMenus=createChartMenus({panel,main,interval,type,activeDoc,activeChart:()=>charts.get(layout.active),request,getBootstrap,showToast,isPreview:()=>settingsPreview(),changeResolution:r=>{const doc=activeDoc();if(!doc)return;const entry=charts.get(layout.active);entry?.api?.stopReplay();doc.resolution=r;doc.interval=baseInterval(r);doc.view={...doc.view,range:null};if(entry){entry.cursor?.destroy();entry.api?.destroy();entry.api=null;entry.key='';entry.historyPaused=false;entry.emptyPages=0;}selection(layout.active);dirty(layout.active);void loadChart(layout.active);}});
 const message=(text,error=false)=>{const host=main.querySelector('.terminal-save-state');host.textContent=text;host.classList.toggle('negative',error);if(error&&persistenceBlocked&&!hardPersistenceBlock){const retry=document.createElement('button');retry.type='button';retry.dataset.retryTerminalSave='';retry.textContent='Повторить сохранение';host.append(' ',retry);}};
 const previewOnly=()=>getBootstrap()?.preview?.static||getBootstrap()?.preview?.localReview;
 const settingsPreview=()=>!!previewOnly()||getBootstrap()?.environment==='fixture';
 async function read(key){if(previewOnly())return null;const epoch=identityEpoch,doc=stagedAccountDocs?.get(key)||await request('/api/market/terminal?'+new URLSearchParams({key}));if(epoch!==identityEpoch||!doc||doc.key!==key||!Number.isSafeInteger(doc.revision)||doc.revision<0||! /^[a-f0-9]{64}$/.test(doc.ownerScope||'')||ownerScope&&ownerScope!==doc.ownerScope){blockPersistence();throw Error('Владелец или версия настроек не подтверждены. Перезагрузите кабинет.');}ownerScope=doc.ownerScope;revisions.set(key,doc.revision);return doc.value;}
 let workspaceSerial=0;
 function dirty(key){if(getBootstrap()?.preview?.readOnly)return;if(!ready||detachedId&&key==='layout'||persistenceBlocked)return;if(key==='layout'){if(terminalPresetState(layout).state==='invalid'){message('Версия настроек не поддерживается. Расположение сохранено без изменений.',true);return;}layout=reconcileTerminalTaskPreset(layout);paintPresetUi();}workspaceSerial++;pending.add(key);if(!presetBusy){message('Сохраняем…');clearTimeout(saveTimer);saveTimer=setTimeout(()=>void flush(),250);}}
 async function flush({preset=false}={}){clearTimeout(saveTimer);if(presetBusy&&!preset)return false;await Promise.all([...saving.values()]);if(persistenceBlocked&&!await recoverTransientSaves())return false;if(previewOnly()){pending.clear();message('Изменения действуют только в этом предпросмотре');return true;}let failed=false;
  const keys=[...pending];await Promise.all(keys.map(async key=>{
   if(saving.has(key))return;pending.delete(key);const value=key==='layout'?layout:documents.get(key);if(!value)return;
   const epoch=identityEpoch,input={key,revision:revisions.get(key)||0,value:structuredClone(value),expectedOwnerScope:ownerScope};
   const task=request('/api/market/terminal',{method:'POST',body:JSON.stringify(input)}).then(r=>{if(epoch!==identityEpoch||!terminalWriteConfirmed(r,{...input,ownerScope})){blockPersistence();throw Error('Сохранение не подтверждено. Перезагрузите кабинет.');}revisions.set(key,r.revision);}).catch(error=>{failed=true;if(!hardPersistenceBlock&&epoch===identityEpoch&&(!Number.isInteger(error.status)||error.status>=500)){persistenceBlocked=true;retryableSaves.set(key,{input,epoch});}else if([401,403,409].includes(error.status)||epoch!==identityEpoch)blockPersistence();message(error.code==='NEXUS_UNAVAILABLE'?'Связь с Nexus прервалась. Изменения остаются в этом окне; сохранение повторится автоматически.':error.message||'Не удалось подтвердить сохранение. Повторите после восстановления связи.',true);pending.add(key);paintPresetUi();});saving.set(key,task);await task;saving.delete(key);
  }));if(pending.size&&!failed)return flush({preset});if(!failed&&!pending.size&&!saving.size)message('Сохранено на этом устройстве');return !failed;
 }
 function presetBlocked(){return !ready?'Дождитесь загрузки графиков.':persistenceBlocked?'Перезагрузите кабинет, чтобы проверить сохранённое расположение.':terminalPresetState(layout).state==='invalid'?'Эта версия расположения пока не поддерживается. Настройки сохранены без изменений.':detachedId||detached.size?'Верните графики из отдельных окон перед выбором пресета.':expandedId?'Верните график из полного экрана перед выбором пресета.':panel.dataset.layoutLocked==='true'?'Расположение закреплено. Снимите закрепление в настройках раскладки.':'';}
 function paintPresetUi(){
  const state=terminalPresetState(layout),selected=state.state==='active'?(state.matches?state.selected:'custom'):'',reason=presetBlocked();
  panel.dataset.taskPreset=selected;panel.dataset.presetBusy=String(presetBusy);
  for(const button of presetUi.querySelectorAll('button')){const restore=button.dataset.taskPreset==='restore';button.hidden=restore&&state.state!=='active';button.disabled=presetBusy||!!reason;button.setAttribute('aria-pressed',String(!restore&&button.dataset.taskPreset===selected));}
  presetUi.querySelector('.terminal-preset-hint').textContent=presetBusy?'Сохраняем расположение…':reason||(selected?'Свободное перемещение блоков доступно после возврата своего расположения.':'Открытые инструменты и заметки сохранятся. Можно вернуть своё расположение.');
  toolbar.querySelector('.terminal-layout-menu summary span').textContent='Раскладка'+(selected?' · '+(TERMINAL_TASK_PRESETS.find(row=>row.id===selected)?.label||'Своя'):'');
 }
 const presetActions=createTerminalPresetActions({getLayout:()=>layout,getRevision:()=>revisions.get('layout')||0,getOwnerScope:()=>ownerScope,getContext:()=>JSON.stringify([identityEpoch,getBootstrap()?.identity?.preferenceScope,getBootstrap()?.savedResearch?.ownerScope,!!previewOnly()]),isPreview:previewOnly,blocked:presetBlocked,flush:()=>flush({preset:true}),prepareDocking:options=>docking.preparePreset(options),request,
  setRevision:value=>revisions.set('layout',value),blockPersistence:()=>{blockPersistence();clearTimeout(saveTimer);paintPresetUi();},report:(text,error=false)=>{message(text,error);presetResult.textContent=text;presetResult.classList.toggle('negative',error);},
  commit:value=>{layout=value;docking.setSuspended(terminalPresetState(layout).state==='active');layoutView();if(!layout.dockCollapsed)dockTab(layout.dock,true,false);subscriptionChanged();},
  setBusy:value=>{presetBusy=value;stage.inert=value;toolbar.querySelector('.terminal-tabs').inert=value;for(const child of toolbar.querySelector('.terminal-layout-tools').children)if(child!==presetUi)child.inert=value;paintPresetUi();if(!value&&pending.size&&!persistenceBlocked)saveTimer=setTimeout(()=>void flush(),250);}});
 new MutationObserver(paintPresetUi).observe(panel,{attributes:true,attributeFilter:['data-layout-locked']});
 document.addEventListener('invest:identity',event=>{const value=event.detail||{},tag=identityKey(value);if(identityTag!==null&&identityTag!==tag){resetWorldCharts();identityEpoch++;blockPersistence();clearTimeout(saveTimer);message('Профиль изменился. Перезагрузите кабинет перед сохранением настроек.',true);paintPresetUi();}identityTag=tag;orderTicket.update();});
 let workspaceTransferHeld=false;
 createTerminalWorkspaceTransfer({panel,toolbar,request,isPreview:previewOnly,getIdentityContext:()=>identityEpoch,getContext:()=>JSON.stringify([identityEpoch,workspaceSerial,ownerScope]),getOwnerScope:()=>ownerScope,
  async prepare(){const reason=presetBlocked();if(reason||presetBusy)throw Error(reason||'Терминал занят');workspaceTransferHeld=true;presetBusy=true;paintPresetUi();if(!await flush({preset:true})||persistenceBlocked)throw Error('Сохранение не подтверждено');},
  release(){if(!workspaceTransferHeld)return;workspaceTransferHeld=false;presetBusy=false;stage.inert=persistenceBlocked;toolbar.querySelector('.terminal-tabs').inert=persistenceBlocked;paintPresetUi();if(pending.size&&!persistenceBlocked)saveTimer=setTimeout(()=>void flush(),250);},
  blockPersistence(){blockPersistence();clearTimeout(saveTimer);stage.inert=true;toolbar.querySelector('.terminal-tabs').inert=true;paintPresetUi();},report:message});
 let dockingTransferHeld=false;
 createTerminalDockingTransfer({panel,toolbar,store:docking.transfer,request,isPreview:previewOnly,getContext:()=>JSON.stringify([identityEpoch,workspaceSerial,ownerScope,!!previewOnly()]),
  getLocal:()=>({ownerScope,layoutRevision:revisions.get('layout')||0,references:layout.tabs.map(id=>{const value=documents.get(id);return {id,revision:revisions.get(id)||0,instrumentUid:value?.instrumentUid,ticker:value?.ticker,interval:value?.interval,resolution:value?.resolution??null};})}),
  async prepare(){const reason=presetBlocked();if(reason||presetBusy||terminalPresetState(layout).state==='active')throw Object.assign(Error(reason||'Верните своё расположение перед переносом.'),{code:'DOCKING_TRANSFER_BLOCKED'});dockingTransferHeld=true;presetBusy=true;paintPresetUi();if(!await flush({preset:true})||persistenceBlocked)throw Error('Сохранение не подтверждено');},
  release(){if(!dockingTransferHeld)return;dockingTransferHeld=false;presetBusy=false;paintPresetUi();if(pending.size&&!persistenceBlocked)saveTimer=setTimeout(()=>void flush(),250);}});
 async function candles(meta,tf='CANDLE_INTERVAL_DAY',force=false,{before,purpose,at}={}) {
  const base=meta.instrumentUid+':'+tf,key=base+(at?':at:'+at:'')+(purpose?':'+purpose:''),prior=cache.get(key);
  if(purpose&&!at&&cache.has(base))return cache.get(base).rows;
  if(prior&&!force&&!before&&Date.now()-prior.at<(meta.assetType==='crypto'?4500:55000))return prior.rows;
  const requestKey=key+':'+(before||'latest');if(requests.has(requestKey))return requests.get(requestKey);
  const version=cacheVersions.get(key)||0,generation=streamGeneration;
  const task=(async()=>{
   let page=[],metadata={};const boot=getBootstrap();
   if((boot?.preview?.static||boot?.preview?.localReview)&&!meta.publicMarketData) {
    page=(boot.candles||[]).filter(r=>r.instrumentUid===meta.instrumentUid&&(!r.interval||r.interval===tf));
    const source=normalizeMarketCandles(page,tf),target=at?Date.parse(at):Date.now(),span=1095*86400000;
    const end=before?Date.parse(before):at?Math.min(Date.now()+1,target+span/2):Date.now()+1;
    const start=!before&&!at&&!purpose?(source[0]?.time*1000||end-span):end-span;page=source.filter(r=>r.time*1000>=start&&r.time*1000<end);
    const first=source[0]?.time*1000,hasMore=Number.isFinite(first)&&first<start;
    metadata={fixture:true,stale:false,history:{requestedFrom:new Date(start).toISOString(),nextBefore:hasMore?new Date(start).toISOString():null,hasMore,firstAvailable:Number.isFinite(first)?new Date(first).toISOString():null,boundaryKnown:true}};
   } else {
    const response=await request('/api/market/candles?'+new URLSearchParams({instrumentUid:meta.instrumentUid,interval:tf,...(before?{before}:{}),...(purpose?{purpose}:{}),...(at?{at}:{})}));
    if(!Array.isArray(response.data))throw new Error('Неверный ответ истории котировок.');
    page=response.data;metadata={stale:response.stale===true,capturedAt:response.capturedAt,fixture:response.fixture===true||boot?.environment==='fixture'&&!meta.publicMarketData,source:response.source,history:response.history};
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
  requests.set(requestKey,task);try{return await task;}finally{if(requests.get(requestKey)===task)requests.delete(requestKey);}
 }

 function renderComparisons(id){
  const e=charts.get(id),doc=documents.get(id);if(!e||!doc)return;
  const host=e.card.querySelector('.terminal-comparison-legend'),items=doc.comparisons||[],values=new Map((e.api?.getComparisons()||[]).map(m=>[m.instrumentUid,m]));
  let unavailable=false,failed=false;
  host.hidden=!items.length;host.innerHTML=items.map(m=>{
   const value=values.get(m.instrumentUid),state=e.seriesState!=='ready'?e.seriesState:e.comparisonStates?.get(m.instrumentUid)?.status||'loading';
   const label=state==='ready'?(Number.isFinite(value?.anchor)?pct(value.change):'нет общих свечей'):state==='empty'?'нет свечей для сравнения':state==='error'?'сравнение не загрузилось':'загружаем сравнение…';
   unavailable ||= state==='empty';failed ||= state==='error';
   return `<span class="terminal-compare-chip" style="--compare-color:${/^#[0-9a-f]{6}$/i.test(m.color)?m.color:'#e1b264'}"><button type="button" data-compare-toggle="${esc(m.instrumentUid)}" aria-pressed="${m.visible!==false}">${instrumentMark(catalogRows.find(row=>row.instrumentUid===m.instrumentUid)||m)}<span>${esc(m.ticker)} · ${label}</span></button><button type="button" data-compare-remove="${esc(m.instrumentUid)}" aria-label="Убрать ${esc(m.ticker)}">×</button></span>`;
  }).join('')+(items.length?'<small>От первой общей свечи · без конвертации валют</small>':'')+(unavailable&&doc.interval!=='CANDLE_INTERVAL_DAY'?'<button type="button" data-compare-daily>Показать 1д</button>':'')+(failed?'<button type="button" data-compare-retry>Повторить сравнение</button>':'');watchInstrumentImages(host);
 }
 const panelLabels={watch:'Котировки',book:'Стакан',tape:'Лента сделок',plan:'План сделки',trade:'Покупка и продажа',alerts:'Ценовые уровни'};let paintedPanel='';
 const contextNavigation=createTerminalContextNavigation({rail:panelRail,headers:[
  {header:side.querySelector('header'),title:'#terminalAuxiliaryTitle',pinAttribute:'data-keep-panel',isPinned:()=>docking.pins().has('panel:'+layout.auxiliary)},
  {header:dock.querySelector('header'),title:'#terminalContextTitle',pinAttribute:'data-keep-context',isPinned:()=>docking.pins().has('context')},
  {header:shortlist.querySelector('.surface-head'),title:'h2,h3',pinAttribute:'data-keep-watch',isPinned:()=>docking.pins().has('watch')}
 ],open:(name,isDock)=>isDock?dockTab(name):openPanel(name),getCurrent:()=>layout.auxiliary||(!layout.dockCollapsed?layout.dock:'')});
 function pinContents(name){return name==='trade'?[$('#terminalOrder')]:name==='plan'?[$('#terminalPlan'),$('#terminalNote').closest('label')]:name==='alerts'?[$('#terminalSideAlerts')]:[$('#terminalSide'+(name==='book'?'Book':'Tape'))];}
 function syncPinnedWidgets(){const pins=docking.pins();
  for(const name of ['plan','alerts','book','tape','trade']){
   if(pins.has('panel:'+name)&&!pinnedWidgets.has(name)){const widget=document.createElement('aside');widget.className='terminal-widget-panel';widget.dataset.widget=name;widget.innerHTML=`<header class="terminal-panel-heading"><strong>${panelLabels[name]}</strong>${btn('close','Закрыть '+panelLabels[name],`data-close-widget="${name}"`)}</header>`;stage.append(widget);widget.append(...pinContents(name));pinnedWidgets.set(name,widget);}
   else if(!pins.has('panel:'+name)&&pinnedWidgets.has(name)){for(const content of pinContents(name))(['book','tape'].includes(name)?$('#terminalSideMarket'):side).append(content);pinnedWidgets.get(name).remove();pinnedWidgets.delete(name);}
  }
 }
 function marketPlacement(){for(const name of ['book','tape']){const content=$('#terminal'+(name==='book'?'Book':'Tape'));if(!content)continue;const inSide=layout.auxiliary===name||pinnedWidgets.has(name),target=inSide?$('#terminalSide'+(name==='book'?'Book':'Tape')):dock.querySelector('.terminal-dock-body');if(content.parentElement!==target)target.append(content);content.hidden=!inSide&&(layout.dockCollapsed||layout.dock!==name);}}
 function paintPanels(){paintPresetUi();syncPinnedWidgets();const aux=layout.auxiliary||'',pins=docking.pins(),shown=name=>aux===name||pins.has(name==='watch'?'watch':'panel:'+name);layout.watchCollapsed=!shown('watch');layout.sideCollapsed=!['book','tape','plan','alerts','trade'].includes(aux)||pinnedWidgets.has(aux);
  if(aux&&!panel.classList.contains('terminal-custom-layout'))layout.dockCollapsed=true;
  shortlist.hidden=layout.watchCollapsed;side.hidden=layout.sideCollapsed;panel.classList.toggle('watch-collapsed',layout.watchCollapsed);panel.classList.toggle('side-collapsed',layout.sideCollapsed);panel.classList.toggle('dock-collapsed',layout.dockCollapsed);
  $('#terminalAuxiliaryTitle').textContent=panelLabels[aux]||'';$('#terminalOrder').hidden=!shown('trade');orderTicket.update();$('#terminalPlan').hidden=!shown('plan');$('#terminalSideAlerts').hidden=!shown('alerts');$('#terminalSideMarket').hidden=!['book','tape'].includes(aux);$('#terminalNote').closest('label').hidden=!shown('plan');side.querySelector('[data-market-bottom]').hidden=!['book','tape'].includes(aux);
  for(const b of panelRail.querySelectorAll('[data-panel]')){const active=shown(b.dataset.panel);b.setAttribute('aria-expanded',String(active));b.setAttribute('aria-pressed',String(active));}
  dock.hidden=layout.dockCollapsed;
  $('#terminalContextTitle').textContent=({stats:'Обзор актива',book:'Стакан',tape:'Лента сделок',participants:'Позиции участников',events:'События',radar:'Радар рынка'})[layout.dock]||'Обзор актива';
  for(const b of panelRail.querySelectorAll('[data-terminal-tab]')){const active=!layout.dockCollapsed&&b.dataset.terminalTab===layout.dock;b.setAttribute('aria-pressed',String(active));b.setAttribute('aria-expanded',String(active));}
  dock.querySelector('.terminal-dock-body').hidden=layout.dockCollapsed;dock.querySelector('[data-collapse=dock]').hidden=layout.dockCollapsed;dock.querySelector('[data-market-side]').hidden=layout.dockCollapsed||!['book','tape'].includes(layout.dock);
  for(const b of dock.querySelectorAll('[data-terminal-tab]')){const active=!layout.dockCollapsed&&b.dataset.terminalTab===layout.dock;b.setAttribute('aria-selected',String(active));b.tabIndex=b.dataset.terminalTab===layout.dock?0:-1;}
  for(const el of dock.querySelectorAll('[data-dock]'))el.hidden=el.dataset.dock!==layout.dock;marketPlacement();
  if(shown('watch')&&paintedPanel!=='watch')void enrichWatchlist();paintedPanel=aux;activity.preferences(layout.activity);contextNavigation.update();docking.sync();
 }
 function openPanel(name,toggle=false,additive=false){if(name&&!Object.hasOwn(panelLabels,name))return;const pin=name==='watch'?'watch':'panel:'+name;
  if(name&&!additive&&!docking.pins().has('context')){layout.dockCollapsed=true;participants.hide();}
  if(additive&&layout.auxiliary&&layout.auxiliary!==name){if(!docking.pin(layout.auxiliary==='watch'?'watch':'panel:'+layout.auxiliary))return;}
  if(toggle&&docking.pins().has(pin)){docking.unpin(pin);if(layout.auxiliary===name)layout.auxiliary='';paintPanels();dirty('layout');return;}
  layout.auxiliary=toggle&&layout.auxiliary===name?'':name;if(['book','tape'].includes(layout.auxiliary)&&['book','tape'].includes(layout.dock))layout.dockCollapsed=true;layout.side=['plan','alerts'].includes(name)?name:'market';paintPanels();dirty('layout');}
 function sideTab(name){openPanel(name==='market'?'book':name);}
 function expandChart(id,button){
  if(id&&!documents.has(id))return;if(id){expandFocus=button;expandedId=id;selection(id);}else expandedId=null;
  if(id&&!expandAnchor){expandAnchor=document.createComment('terminal workspace position');panel.before(expandAnchor);document.body.append(panel);}else if(!id&&expandAnchor){expandAnchor.replaceWith(panel);expandAnchor=null;}
  document.body.classList.toggle('terminal-fullscreen',!!id);panel.classList.toggle('chart-expanded',!!id);
  const expandButton=$('#terminalExpand');expandButton.setAttribute('aria-pressed',String(!!id));expandButton.setAttribute('aria-label',id?'Выйти из полного экрана':'График на весь экран');expandButton.title=expandButton.getAttribute('aria-label')+' · Alt+Enter';
  if(id&&!document.fullscreenElement&&!fullscreenRequest&&document.documentElement.requestFullscreen){
   fullscreenRequest=document.documentElement.requestFullscreen({navigationUI:'hide'}).then(()=>{
    nativeFullscreen=true;
    if(!expandedId&&document.fullscreenElement)void document.exitFullscreen().catch(()=>{});
   }).catch(()=>{}).finally(()=>{fullscreenRequest=null;});
  }else if(!id&&nativeFullscreen&&document.fullscreenElement)void document.exitFullscreen().catch(()=>{});
  toolbar.querySelector('details').open=false;
  layoutView();for(const [key,e]of charts){const b=e.card.querySelector('[data-expand-chart]');b.setAttribute('aria-pressed',String(key===id));b.setAttribute('aria-label',key===id?'Свернуть график':'Развернуть этот график');b.title=b.getAttribute('aria-label');}
  if(id)charts.get(id)?.card.querySelector('[data-expand-chart]').focus({preventScroll:true});else {expandFocus?.focus?.({preventScroll:true});expandFocus=null;}
  window.dispatchEvent(new Event('resize'));
 }
 controls.insertAdjacentHTML('beforeend',btn('expand','График на весь экран','id="terminalExpand" aria-pressed="false"'));
 document.addEventListener('fullscreenchange',()=>{
  if(document.fullscreenElement)nativeFullscreen=Boolean(expandedId);
  else if(nativeFullscreen){nativeFullscreen=false;if(expandedId)expandChart(null);}
 });
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
  status.replaceChildren();const text=document.createElement('span');text.textContent=(e.rows.length?' · с '+new Date(e.rows[0].time*1000).toLocaleDateString('ru-RU'):'')+(e.historyRetry?' · Загрузка продолжится автоматически':e.historyError?' · Источник временно не отвечает':e.historyPending||e.autoHistory?' · Загружаем всю историю…':h?.hasMore===false?' · вся доступная история':e.rows.length>=100000?' · Для всей истории выберите дневной интервал':e.historyPaused?' · История загружена частично':'');status.append(text);
  if(h?.hasMore&&e.rows.length<100000&&!e.historyRetry&&(e.historyPaused||e.historyError||documents.get(id)?.historyDate)){const button=document.createElement('button');button.type='button';button.dataset.earlier=id;button.disabled=!!e.historyPending;button.textContent=e.historyError?'Повторить загрузку':'Продолжить загрузку';status.append(button);}
 }
 function resetHistoryRetry(e){if(e.historyRetry)clearTimeout(e.historyRetry);e.historyRetry=null;e.historyRetryCount=0;}
 function scheduleHistoryRetry(id,delay=15_000,failure=true){const e=charts.get(id);if(!e||e.historyRetry||(failure&&e.historyRetryCount>=5))return;if(failure)e.historyRetryCount=(e.historyRetryCount||0)+1;const key=e.key;e.historyRetry=setTimeout(()=>{e.historyRetry=null;if(charts.get(id)!==e||e.key!==key)return;e.historyPaused=false;e.emptyPages=0;if(visible&&!document.hidden&&!e.card.hidden)void loadAllHistory(id);},delay);}
 function loadEarlier(id,manual=false){const e=charts.get(id),doc=documents.get(id);if(isWorldInstrument(doc))return Promise.resolve();if(!e||!doc||e.api?.getReplay().active||!visible||(!manual&&(e.historyPaused||e.autoHistory)))return Promise.resolve();
  if(e.historyTask)return e.historyTask;
  const history=cache.get(e.key)?.history;if(!history?.hasMore||!history.nextBefore)return Promise.resolve();
  const key=e.key,seq=e.seq,interval=doc.interval,first=e.rows[0]?.time;e.historyPending=true;e.historyError=false;if(manual)e.historyPaused=false;historyStatus(id);
  const task=(async()=>{
   if(!e.api){e.emptyPages=(e.emptyPages||0)+1;if(e.emptyPages>=3&&!history.boundaryKnown){e.historyPaused=true;scheduleHistoryRetry(id,60_000);return;}await loadChart(id,false,{before:history.nextBefore,at:doc.historyDate||undefined,historyPage:true});return;}
   try{const rows=aggregateCandles(await candles(doc,interval,false,{before:history.nextBefore,at:doc.historyDate||undefined}),doc.resolution);if(e.key!==key||e.seq!==seq||e.api?.getReplay().active)return;e.rows=rows;e.api.setData(rows);e.emptyPages=rows[0]?.time===first?(e.emptyPages||0)+1:0;if(!e.emptyPages)e.historyRetryCount=0;e.historyPaused=e.emptyPages>=3&&!history.boundaryKnown;if(e.historyPaused)scheduleHistoryRetry(id,60_000);if(e.autoHistory&&!e.historyUserInteraction)e.api.fitContent();
    for(const meta of doc.comparisons||[])void loadComparison(id,meta,history.nextBefore);if(id===layout.active)renderStats();
   }catch{if(e.key===key){e.historyError=true;e.historyPaused=true;scheduleHistoryRetry(id);}}
  })();
  const pending=task.finally(()=>{if(e.historyTask===pending){e.historyTask=null;e.historyPending=false;}if(e.key===key)historyStatus(id);});e.historyTask=pending;return pending;
 }
 async function loadAllHistory(id){
  const e=charts.get(id),doc=documents.get(id);if(isWorldInstrument(doc))return;if(!e||!doc||e.api?.getReplay().active||doc.historyDate||e.historyPaused||!visible)return;
  if(e.autoHistory?.key===e.key&&e.autoHistory?.seq===e.seq)return;
  const token={key:e.key,seq:e.seq};e.autoHistory=token;const cursors=new Set();let pages=0;
  try{while(visible&&!e.api?.getReplay().active&&charts.get(id)===e&&!e.card.hidden&&e.key===token.key&&e.seq===token.seq){
   if(e.historyTask){await e.historyTask;continue;}
   const h=cache.get(e.key)?.history;if(!h?.hasMore||!h.nextBefore||e.historyPaused)break;
   if(e.rows.length>=100000){e.historyPaused=true;break;}if(cursors.has(h.nextBefore)){e.historyPaused=true;scheduleHistoryRetry(id,60_000);break;}if(pages>=40){scheduleHistoryRetry(id,1000,false);break;}
   cursors.add(h.nextBefore);pages++;await loadEarlier(id,true);if(e.key===token.key&&e.seq===token.seq+1)token.seq=e.seq;
   if(e.historyError||e.historyPaused)break;
  }}finally{if(e.autoHistory===token){e.autoHistory=null;
   // A same-symbol refresh may finish while the backfill is pending. Reconcile
   // the rendered chart with the merged cache before announcing full history.
   const merged=cache.get(e.key);if(e.key===token.key&&e.seq===token.seq&&!e.api?.getReplay().active&&merged&&e.rows!==merged.rows)await loadChart(id,false,{historyPage:true});
   historyStatus(id);}}
 }
 async function loadComparison(id,meta,before){const e=charts.get(id),doc=documents.get(id);if(!e?.api||!doc)return;const key=e.key,seq=e.seq,token={status:'loading'};
  e.comparisonStates??=new Map();e.comparisonStates.set(meta.instrumentUid,token);e.api.setComparison(meta,null);renderComparisons(id);
  const current=()=>charts.get(id)===e&&e.key===key&&e.seq===seq&&e.api&&e.comparisonStates.get(meta.instrumentUid)===token&&doc.comparisons?.includes(meta);
  try{const rows=await candles(meta,doc.interval,false,{before,at:doc.historyDate||undefined});if(!current())return;
   token.status=rows.length?'ready':'empty';if(rows.length)e.api.setComparison(meta,aggregateCandles(rows,doc.resolution));renderComparisons(id);
  }catch{if(!current())return;token.status='error';renderComparisons(id);}}
 async function compareInstrument(meta,remove=false){const doc=activeDoc(),e=charts.get(layout.active);if(!doc||!e||isWorldInstrument(doc)||isWorldInstrument(meta))return;doc.comparisons??=[];
  if(remove){doc.comparisons=doc.comparisons.filter(m=>m.instrumentUid!==meta.instrumentUid);e.comparisonStates?.delete(meta.instrumentUid);e.api?.setComparison(meta,null);}else{if(doc.instrumentUid===meta.instrumentUid)return;if(!doc.comparisons.some(m=>m.instrumentUid===meta.instrumentUid)){if(doc.comparisons.length>=5){showToast('Можно сравнить до пяти инструментов.');return;}doc.comparisons.push({instrumentUid:meta.instrumentUid,ticker:meta.ticker,color:['#e1b264','#45c9cf','#ef7b76','#5ed0a0','#e88cc5'][doc.comparisons.length]});}await loadComparison(layout.active,doc.comparisons.find(m=>m.instrumentUid===meta.instrumentUid));}renderComparisons(layout.active);dirty(layout.active);}

 function demoMarketSnapshot(meta){
  const row=(getBootstrap()?.candles||[]).filter(r=>r.instrumentUid===meta.instrumentUid).at(-1);if(!row)return;
  const price=row.close,step=Math.max(.01,Math.round(price*.00005*100)/100),at='2026-08-12T12:00:00Z';
  activity.reset();activity.state({state:'fixture',simulated:true});
  activity.receive({type:'market.book',instrumentUid:meta.instrumentUid,consistent:true,sourceEventTime:at,connectorReceivedAt:at,simulated:true,
   bids:Array.from({length:20},(_,i)=>({price:price-step*(i+1),quantity:10+i*7})),
   asks:Array.from({length:20},(_,i)=>({price:price+step*(i+1),quantity:18+i*5}))});
  for(let i=0;i<20;i++)activity.receive({type:'market.trade',instrumentUid:meta.instrumentUid,price:price+(i%2?1:-1)*step,quantity:1+i%8,side:i%2?'buy':'sell',sourceEventTime:new Date(Date.parse(at)-(19-i)*1000).toISOString(),connectorReceivedAt:at,simulated:true});
 }
 function selection(id,{focusContext=true,targetId=layout.active}={}){const doc=documents.get(id);if(!doc)return;const previous=layout.active;layout=selectChartSlot(layout,id,{targetId,excluded:detached});panel.classList.toggle('terminal-external-active',isWorldInstrument(doc));panel.classList.toggle('terminal-tradingview-active',usesWidget(doc));if(previous!==id)charts.get(previous)?.api?.pauseReplay();layout.active=id;editors.drawing(charts.get(id)?.api?.drawings.getSelected()||null);const meta=activeMeta();onSelection?.(meta,{focusContext});onChart?.(charts.get(id)?.api||null);interval.value=doc.interval;type.value=doc.view?.type||'candles';$('#terminalLive').hidden=!doc.historyDate;$('#terminalDate').textContent=doc.historyDate?'История · '+doc.historyDate.slice(0,4):'К дате';
  if(detachedId)document.title=(meta.ticker||'График')+' · Терминал · Vertux Nexus';
  const select=$('#instrumentSelect');if(![...select.options].some(o=>o.value===meta.instrumentUid))select.add(new Option(meta.ticker||meta.instrumentUid,meta.instrumentUid));select.value=meta.instrumentUid;
  for(const b of controls.querySelectorAll('[data-terminal-indicator]')){b.setAttribute('aria-pressed',String(doc.view?.indicators?.[b.dataset.terminalIndicator]===true));if(b.dataset.terminalIndicator==='vwap'){b.disabled=doc.interval==='CANDLE_INTERVAL_DAY';b.title='VWAP с 00:00 МСК · доступен на внутридневных интервалах';}}$('#terminalFlash').checked=doc.view?.flash===true;
  for(const[cid,entry]of charts){entry.host.id=cid===id?'marketChart':'';entry.card.classList.toggle('active',cid===id);}
  for(const b of $('#instrumentQuickList').querySelectorAll('[data-chart-uid]'))b.setAttribute('aria-pressed',String(b.dataset.chartUid===doc.instrumentUid));renderTabs();renderPlan();renderStats();replayControls.selection();chartMenus.update();customization.update();orderTicket.update();participants.update(isWorldInstrument(meta)?null:meta);activity.select(meta);demoMarketSnapshot(meta);subscriptionChanged();void loadContext();void refreshSummaryQuote();if(!detachedId)dirty('layout');}
 function renderTabs(){const host=toolbar.querySelector('.terminal-tabs');host.innerHTML=layout.tabs.map(id=>{const doc=documents.get(id),meta=metaFor(doc),ticker=meta.ticker||doc?.ticker||'График';return `<div class="terminal-tab${id===layout.active?' active':''}"><button type="button" role="tab" data-chart-tab="${id}" aria-selected="${id===layout.active}" tabindex="${id===layout.active?'0':'-1'}" title="${esc((isWorldInstrument(meta)?'TradingView · '+meta.exchange+' · ':'')+(meta.name||ticker))}">${instrumentMark(meta)}<span>${esc(ticker)}${detached.has(id)?' ↗':''}</span></button>${btn('close','Закрыть вкладку '+esc(ticker),`data-close-chart="${id}"`)}</div>`;}).join('')+btn('add','Добавить инструмент','id="terminalAdd"');watchInstrumentImages(host);}
 function idsVisible(){if(expandedId)return[expandedId];if(detachedId)return[detachedId];return chartSlots(layout,detached);}
 function layoutView(){panel.classList.toggle('watch-collapsed',layout.watchCollapsed);panel.classList.toggle('side-collapsed',layout.sideCollapsed);panel.classList.toggle('dock-collapsed',layout.dockCollapsed);
  for(const b of toolbar.querySelectorAll('[data-layout]'))b.setAttribute('aria-pressed',String(Number(b.dataset.layout)===layout.count));
  for(const b of toolbar.querySelectorAll('[data-link]')){b.setAttribute('aria-pressed',String(layout[b.dataset.link==='cursor'?'linkCursor':'linkPeriod']));b.disabled=layout.count<2||idsVisible().some(id=>usesWidget(documents.get(id)));b.title=idsVisible().some(id=>usesWidget(documents.get(id)))?'Общий курсор и период недоступны для внешних графиков TradingView':layout.count<2?'Выберите два или четыре графика':b.dataset.link==='cursor'?'Перекрестие показывает одно время на открытых графиках':'Прокрутка и масштаб времени меняются вместе';}
  for(const b of panel.querySelectorAll('[data-collapse]')){const key=b.dataset.collapse+'Collapsed';b.setAttribute('aria-expanded',String(!layout[key]));}
  panel.classList.toggle('terminal-multiple-charts',!expandedId&&layout.count>1);layout.visibleTabs=chartSlots(layout,detached);main.querySelector('.terminal-grid').dataset.count=expandedId?1:layout.count;main.dataset.singleChart=String(Boolean(expandedId)||layout.count===1);renderTabs();renderCharts();paintPanels();syncChartActions();}
 // One chart needs no strip of its own above the chart. Its source switch and
 // window action move into the instrument summary; the buttons carry the same
 // data attributes, so the existing click handler serves both places.
 function syncChartActions(){const strip=main.querySelector('.terminal-ticker-strip');if(!strip)return;let slot=strip.querySelector('.terminal-chart-actions');
  if(!slot){slot=document.createElement('div');slot.className='terminal-chart-actions';slot.setAttribute('role','group');slot.setAttribute('aria-label','Источник и окно графика');strip.querySelector('.ticker-settings')?.before(slot);}
  const id=layout.active,card=charts.get(id)?.card,single=main.dataset.singleChart==='true';slot.hidden=!single||!card;if(slot.hidden){slot.replaceChildren();return;}
  slot.dataset.chartId=id;const source=card.querySelector('[data-chart-source]'),copyButton=card.querySelector('[data-duplicate-chart]'),expandButton=card.querySelector('[data-expand-chart]'),detachButton=card.querySelector('[data-detach-chart]'),parts=[];
  if(source){const widget=source.textContent==='TradingView';parts.push('<div class="terminal-source-toggle">'+[['TradingView',widget],['Т‑Банк',!widget]].map(([label,on])=>'<button type="button" data-chart-source aria-pressed="'+on+'"'+(on?' disabled':'')+' title="'+esc(on?'Сейчас: '+label:source.title)+'">'+label+'</button>').join('')+'</div>');}
  if(copyButton&&!expandedId)parts.push(btn('add',copyButton.getAttribute('aria-label'),'data-duplicate-chart="'+esc(copyButton.dataset.duplicateChart)+'"'));
  if(expandButton)parts.push(btn('expand',expandButton.getAttribute('aria-label'),'data-expand-chart="'+esc(expandButton.dataset.expandChart)+'" aria-pressed="'+(expandButton.getAttribute('aria-pressed')==='true')+'"'));
  if(detachButton)parts.push(btn('detach',detachButton.getAttribute('aria-label'),'data-detach-chart="'+esc(detachButton.dataset.detachChart)+'"'));slot.innerHTML=parts.join('');}
 function renderCharts(){const ids=idsVisible();for(const[id,entry]of charts){entry.card.hidden=!ids.includes(id);if(ids.includes(id)&&usesWidget(documents.get(id)))void loadChart(id);}
  main.querySelectorAll('.terminal-chart-slot').forEach(el=>el.remove());
  for(const id of ids){if(charts.has(id))continue;const doc=documents.get(id);if(!doc)continue;const card=document.createElement('article');card.className='terminal-chart-card';card.dataset.chartId=id;card.classList.toggle('terminal-external-chart',usesWidget(doc));card.tabIndex=0;
   card.innerHTML=`<header><button type="button" class="terminal-chart-identity" data-change-symbol aria-label="Сменить инструмент"><strong>${esc(doc.ticker)}</strong><small></small></button><div class="terminal-chart-quote"></div>${detachedId?'':btn('add','Открыть копию графика',`data-duplicate-chart="${id}"`)}${btn('expand',expandedId===id?'Свернуть график':'Развернуть этот график',`data-expand-chart="${id}" aria-pressed="${expandedId===id}"`)}${btn('detach',detachedId?'Вернуть график':'В отдельное окно',`data-detach-chart="${id}"`)}</header><div class="terminal-cell-controls"><select data-cell-interval aria-label="Интервал свечей этого графика">${choices}</select><button type="button" data-cell-indicators>Индикаторы</button>${btn('fit','Вместить историю','data-cell-fit')}<button type="button" class="terminal-icon" data-cell-settings aria-label="Настройки этого графика">${studyIcon('gear')}</button></div><div class="terminal-comparison-legend" aria-label="Сравнение инструментов" hidden></div><div class="terminal-chart-area"><div class="terminal-drawing-tools" role="toolbar" aria-label="Рисование">${['cursor','horizontal','trend','ray','rectangle','freehand','fibonacci','erase'].map(tool=>btn(tool,({cursor:'Выбор',horizontal:'Горизонталь',trend:'Тренд',ray:'Луч',rectangle:'Прямоугольник',freehand:'Свободная линия',fibonacci:'Фибоначчи',erase:'Ластик'})[tool],`data-tool="${tool}"`)).join('')}${btn('magnet','Магнит к свечам','data-magnet aria-pressed="false"')}${btn('eye','Скрыть разметку','data-hide-drawings aria-pressed="false"')}${btn('trash','Удалить всю разметку','data-clear-drawings')}</div><div class="terminal-chart-plot" tabindex="0" aria-label="График ${esc(doc.ticker)}"><div class="terminal-crosshair"></div><p class="empty-copy">Загружаем котировки…</p></div></div><footer class="terminal-chart-source"></footer>`;
   const tools=card.querySelector('.terminal-drawing-tools');for(const button of tools.querySelectorAll('[data-tool]')){if(!['cursor','erase'].includes(button.dataset.tool))button.classList.add('terminal-legacy-tool');}
   const cursorSlot=document.createElement('span');cursorSlot.className='terminal-tool-slot terminal-cursor-slot';const cursorButton=tools.querySelector('[data-tool=cursor]');cursorButton.before(cursorSlot);cursorSlot.append(cursorButton);cursorButton.setAttribute('aria-pressed','true');cursorSlot.insertAdjacentHTML('beforeend',`<button type="button" class="terminal-tool-menu" data-cursor-menu aria-label="Варианты курсора" aria-haspopup="dialog" aria-expanded="false">${icon('chevron')}</button>`);
   cursorSlot.insertAdjacentHTML('afterend',drawingGroups.map((g,i)=>{const type=preferences.get().tools[g.id],label=g.tools.find(([t])=>t===type)[1];return `<span class="terminal-tool-slot"><button type="button" class="terminal-icon" data-tool="${type}" data-quick-tool="${i}" aria-label="${label} — рисовать" title="${label}">${drawingIcon(type)}</button><button type="button" class="terminal-tool-menu" data-tool-group="${i}" aria-label="Другие инструменты: ${g.label}" aria-haspopup="dialog" aria-expanded="false">${icon('chevron')}</button></span>`;}).join(''));
   const host=card.querySelector('.terminal-chart-plot');for(const event of ['pointerdown','wheel'])host.addEventListener(event,()=>{const entry=charts.get(id);if(entry)entry.historyUserInteraction=true;},{passive:true});main.querySelector('.terminal-grid').append(card);charts.set(id,{card,host,api:null,rows:[],seq:0});void loadChart(id);}
  for(let i=ids.length;i<(expandedId?1:layout.count);i++){const slot=document.createElement('button');slot.type='button';slot.className='terminal-chart-slot';slot.dataset.addSlot='';slot.innerHTML=icon('add')+'<span>Выбрать инструмент</span>';main.querySelector('.terminal-grid').append(slot);}
  for(const [index,id]of ids.entries()){const entry=charts.get(id);if(entry)entry.card.style.order=String(index);}
   selectionVisual();subscriptionChanged();docking.sync();}
 function paintFavorites(){const host=main.querySelector('.terminal-favorites-bar'),f=preferences.get().favorites,names=new Map(drawingGroups.flatMap(g=>g.tools));host.hidden=!f.tools.length&&!f.indicators.length;host.innerHTML='<span>Избранное</span>'+f.tools.map(t=>`<button type="button" data-favorite-draw="${t}" title="${esc(names.get(t))}" aria-label="${esc(names.get(t))}">${drawingIcon(t)}</button>`).join('')+f.indicators.map(t=>`<button type="button" data-favorite-study="${t}" title="${esc(indicatorCatalog.find(d=>d.type===t)?.label)}">${esc(t.toUpperCase())}</button>`).join('');}
 paintFavorites();
 main.querySelector('.terminal-favorites-bar').addEventListener('click',e=>{const b=e.target.closest('button'),api=charts.get(layout.active)?.api;if(!b||!api)return;if(b.dataset.favoriteDraw)api.beginDrawing(b.dataset.favoriteDraw);if(b.dataset.favoriteStudy){const studies=api.getState().studies;if(studies.length>=24){showToast('На графике уже 24 индикатора.');return;}api.setStudies([...studies,normalizeStudy({id:'study-'+crypto.randomUUID(),type:b.dataset.favoriteStudy})]);}});
 function paintQuickTools(){for(const e of charts.values())for(const b of e.card.querySelectorAll('[data-quick-tool]')){const g=drawingGroups[Number(b.dataset.quickTool)],type=preferences.get().tools[g.id],label=g.tools.find(([t])=>t===type)[1];b.dataset.tool=type;b.title=label;b.setAttribute('aria-label',label+' — рисовать');b.innerHTML=drawingIcon(type);}}
 function refreshOhlc(entry){const hovered=entry.crosshairTime!=null?(entry.api?.getDisplayedRows?.()||[]).find(row=>row.time===entry.crosshairTime):null,legend=entry.host.querySelector('.terminal-crosshair');if(legend)legend.textContent=ohlcText(hovered||entry.api?.getRows().at(-1)||entry.rows.at(-1));}
 function replayChanged(id){const e=charts.get(id);if(!e?.api)return;const r=e.api.getReplay(),subscriptionChangedNow=(e.replayActive===true)!==r.active;e.replayActive=r.active;e.card.classList.toggle('replaying',r.active);refreshOhlc(e);if(r.active){const rows=e.api.getRows(),last=rows.at(-1),prior=rows.at(-2);e.card.querySelector('.terminal-chart-quote').innerHTML='<strong>'+num(last.close)+'</strong><small>Воспроизведение · '+pct(prior?.close?(last.close/prior.close-1)*100:null)+'</small>';e.card.querySelector('.terminal-chart-source').textContent='Воспроизведение · '+stamp(last.time);renderComparisons(id);}if(id===layout.active){replayControls.update();chartMenus.update();customization.update();orderTicket.update();renderStats();}if(subscriptionChangedNow)subscriptionChanged();}
 function updateIndicatorButtons(view){for(const button of main.querySelectorAll('[data-indicator]')){const active=!!view?.indicators?.[button.dataset.indicator];button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}}
 function selectionVisual(){for(const [id,e]of charts){const select=e.card.querySelector('[data-cell-interval]');if(select)select.value=documents.get(id)?.interval;}updateIndicatorButtons(charts.get(layout.active)?.api?.getState());invalidateExplanations();for(const[id,e]of charts){e.card.classList.toggle('active',id===layout.active);e.host.id=id===layout.active?'marketChart':'';}onChart?.(charts.get(layout.active)?.api||null);}
 async function loadChart(id,force=false,range={}){const entry=charts.get(id),doc=documents.get(id);if(!entry||!doc||detached.has(id)||entry.api?.getReplay().active)return;
  if(usesWidget(doc)){if(!visible||!terminalAllowed()||hardPersistenceBlock)return;const meta=metaFor(doc);entry.seq++;entry.key='';entry.loading=false;resetHistoryRetry(entry);if(entry.api){entry.cursor?.destroy();entry.api.destroy();entry.api=null;}entry.card.classList.add('terminal-external-chart');entry.seriesState='external';entry.rows=[];entry.card.querySelector('.terminal-chart-identity').innerHTML=instrumentMark(meta)+'<span><strong>'+esc(meta.ticker)+'</strong><small>'+esc(meta.name)+' · TradingView · '+esc(meta.exchange)+'</small></span>';entry.card.querySelector('.terminal-chart-quote').textContent='';entry.card.querySelector('.terminal-chart-source').textContent='';entry.world??=createWorldMarketChart({host:entry.host,allowed:()=>visible&&terminalAllowed()&&!accountChanging&&!hardPersistenceBlock,preview:()=>previewOnly()||getBootstrap()?.environment==='fixture'});entry.world.show(widgetSymbol(doc),({CANDLE_INTERVAL_1_MIN:'1',CANDLE_INTERVAL_5_MIN:'5',CANDLE_INTERVAL_15_MIN:'15',CANDLE_INTERVAL_HOUR:'60',CANDLE_INTERVAL_4_HOUR:'240',CANDLE_INTERVAL_DAY:'D',CANDLE_INTERVAL_WEEK:'W',CANDLE_INTERVAL_MONTH:'M'})[doc.interval]);watchInstrumentImages(entry.card);paintChartSource(id);return;}
 if(entry.world){entry.world.dispose();entry.world=null;entry.host.classList.remove('terminal-world-market');entry.host.hidden=false;entry.host.innerHTML='<div class="terminal-crosshair"></div>';entry.key='';}entry.card.classList.remove('terminal-external-chart');paintChartSource(id);
  if(id===layout.active)invalidateExplanations();const serial=++entry.seq,meta=metaFor(doc);
  range={at:doc.historyDate||undefined,...range};const key=doc.instrumentUid+':'+doc.interval+(doc.historyDate?':at:'+doc.historyDate:'');
  if(entry.key!==key){
   resetHistoryRetry(entry);entry.api?.destroy();entry.api=null;entry.rows=[];entry.crosshairTime=null;entry.key=key;entry.liveEventAt=null;entry.liveReceivedAt=null;entry.historyPending=false;entry.historyPaused=false;entry.emptyPages=0;entry.historyUserInteraction=Boolean(doc.view?.range);
   entry.seriesState='loading';entry.comparisonStates=new Map();renderComparisons(id);
   entry.host.innerHTML='<p class="empty-copy">Загружаем свечи выбранного интервала…</p>';
   entry.card.querySelector('.terminal-chart-quote').textContent='—';
   entry.card.querySelector('.terminal-chart-source').textContent='Загружаем котировки…';
   if(id===layout.active){selectionVisual();renderStats();orderTicket.update();}
  }
  try{const rows=aggregateCandles(await candles(meta,doc.interval,force,range),doc.resolution);if(serial!==entry.seq||entry.api?.getReplay().active)return;entry.rows=rows;
   entry.key=key;
   if(!rows.length){entry.cursor?.destroy();entry.api?.destroy();entry.api=null;entry.seriesState='empty';entry.comparisonStates=new Map();renderComparisons(id);entry.host.innerHTML='<p class="empty-copy">Свечей за этот интервал нет. Загрузите более раннюю историю или выберите другой интервал.</p>';entry.card.querySelector('.terminal-chart-quote').textContent='—';entry.card.querySelector('.terminal-chart-source').textContent='Данные за запрошенный период отсутствуют';historyStatus(id);if(id===layout.active){selectionVisual();renderStats();orderTicket.update();}if(!range.historyPage)void loadAllHistory(id);return;}
   entry.key=key;entry.loading=true;
   if(entry.api)entry.api.setData(rows);else{entry.cursor?.destroy();entry.host.replaceChildren();const legend=document.createElement('div');legend.className='terminal-crosshair';entry.host.append(legend);
    entry.cursor=createChartCursor(entry.host);entry.api=createMarketChart(entry.host,rows,{onCrosshair:row=>{entry.crosshairTime=row?.time??null;legend.textContent=ohlcText(row||entry.api?.getRows().at(-1)||entry.rows.at(-1));
     if(layout.linkCursor&&!syncCursor){syncCursor=true;for(const[other,e]of charts)if(other!==id&&!e.card.hidden)e.api?.setCrosshair(row?.time);syncCursor=false;}},
     onState:view=>{if(entry.loading)return;doc.view=view;if(id===layout.active){invalidateExplanations();updateIndicatorButtons(view);}entry.card.querySelector('[data-magnet]')?.setAttribute('aria-pressed',String(view.magnet));entry.card.querySelector('[data-hide-drawings]')?.setAttribute('aria-pressed',String(view.drawingsHidden));dirty(id);},onMode:mode=>{if(mode)entry.cursor?.set('crosshair');entry.card.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===(mode||'cursor'))));},
     getDrawingDefaults:type=>preferences.styleFor(type),onDrawingStyle:(type,style)=>preferences.rememberStyle(type,style),onReplay:()=>replayChanged(id),
     onStudySettings:(studyId,anchor)=>{if(id!==layout.active)selection(id);editors.studySettings(studyId,anchor);},onHistory:()=>void loadEarlier(id),onDrawingSelect:item=>{if(id===layout.active)editors.drawing(item);},
     onRange:range=>{if(id===layout.active)invalidateExplanations();if(!layout.linkPeriod||syncPeriod)return;syncPeriod=true;for(const[other,e]of charts)if(other!==id&&!e.card.hidden)e.api?.setRange(range);syncPeriod=false;}});
    entry.api?.restore({...doc.view,colors:doc.view?.colors||preferences.colorsFor(doc.instrumentUid),range:doc.view?.range||null});if(!doc.view?.range)entry.api?.fitContent();}
   entry.loading=false;const last=rows.at(-1),previous=rows.at(-2);refreshOhlc(entry);entry.card.querySelector('.terminal-chart-identity').innerHTML=instrumentMark(meta)+`<span><strong>${esc(meta.ticker||doc.ticker)}</strong><small>${esc(meta.name||'')}</small></span>`;watchInstrumentImages(entry.card);
   const change=previous?.close>0?(last.close/previous.close-1)*100:null;
   entry.card.querySelector('.terminal-chart-quote').innerHTML=`<strong>${num(last.close)}${meta.assetType==='future'?' п.':''}</strong><small class="${change<0?'negative':'positive'}">${pct(change)} · к прошлой свече</small>`;
   const freshness=cache.get(key)||{},captured=freshness.capturedAt||last.capturedAt,source=entry.card.querySelector('.terminal-chart-source');
   source.textContent=`${doc.historyDate?'История · ':''}${freshness.source||(freshness.fixture?'Демо':'Демо')} · свеча ${stamp(last.time)}${captured?' · получено '+stamp(Date.parse(captured)/1000):''}${freshness.latestEmpty?' · в последнем запросе свечей нет':''}${freshness.stale?' · обновление задерживается':''}`;source.classList.toggle('stale',Boolean(freshness.stale));
   entry.seriesState='ready';historyStatus(id);renderComparisons(id);for(const meta of doc.comparisons||[])void loadComparison(id,meta);if(!range.historyPage)void loadAllHistory(id);
   if(id===layout.active){selectionVisual();renderStats();applyContext();replayControls.update();chartMenus.update();customization.update();orderTicket.update();}
  }catch(error){if(serial!==entry.seq)return;entry.loading=false;entry.seriesState='error';renderComparisons(id);entry.card.querySelector('.terminal-chart-source').textContent='Обновление задерживается. Повторим автоматически.';entry.card.querySelector('.terminal-chart-source').classList.add('stale');if(id===layout.active){invalidateExplanations();orderTicket.update();}if(!entry.api){entry.host.innerHTML='<p class="empty-copy"></p>';entry.host.querySelector('.empty-copy').textContent=error.message||'Нет котировок. Выберите другой инструмент.';}}}
 function paintChartSource(id){queueMicrotask(syncChartActions);const entry=charts.get(id),doc=documents.get(id),meta=metaFor(doc);if(!entry)return;let switcher=entry.card.querySelector('[data-chart-source]');if(!isWorldInstrument(doc)&&tradingViewSymbol(meta)){if(!switcher){switcher=document.createElement('button');switcher.type='button';switcher.dataset.chartSource='';switcher.className='terminal-source-switch';entry.card.querySelector('header').append(switcher);}switcher.textContent=usesWidget(doc)?'TradingView':'Т‑Банк';switcher.setAttribute('aria-label',usesWidget(doc)?'Источник графика: TradingView. Переключить на котировки Т-Банка':'Источник графика: Т-Банк. Переключить на TradingView');switcher.title=usesWidget(doc)?'Котировки TradingView могут поступать с задержкой. Нажмите для графика по данным Т-Банка.':'Открыть готовый график TradingView';}else switcher?.remove();}
 function renderStats(){invalidateExplanations();if(layout.dockCollapsed||layout.dock!=='stats'||isWorldInstrument(activeDoc()))return;const entry=charts.get(layout.active),replay=entry?.api?.getReplay().active,rows=replay?entry.api.getRows():entry?.rows||[];insights.update({meta:activeMeta(),rows,interval:activeDoc()?.interval,replay,events,externalChart:usesWidget(activeDoc())});}
 function dockTab(name,open=true,persist=true){if(open&&pinnedWidgets.has(name))docking.unpin('panel:'+name);layout.dock=name;layout.dockCollapsed=!open;if(open)layout.auxiliary='';paintPanels();if(open&&name==='participants')participants.show();else participants.hide();if(open&&name==='radar')void renderRadar();if(open&&name==='stats')renderStats();if(persist)dirty('layout');}
 function applyContext(){const doc=activeDoc(),entry=charts.get(layout.active);if(!doc||!entry?.api)return;const plan=doc.plan&&[doc.plan.entry,doc.plan.stop,doc.plan.target].every(v=>Number(v)>0)?{entry:Number(doc.plan.entry),stop:Number(doc.plan.stop),target:Number(doc.plan.target)}:null;entry.api.setContext({alerts:alerts.filter(r=>r.symbol===doc.ticker),events,scenario:plan});}
 async function loadContext(){const meta=activeMeta(),serial=++contextGeneration;if(!meta.instrumentUid)return;if(isWorldInstrument(meta)){alerts=[];events=[];$('#terminalEvents').textContent='События этого источника доступны на графике TradingView.';$('#terminalSideAlerts').textContent='Уведомления по внешним котировкам не подключены.';return;}
  const [a,c]=await Promise.allSettled([request('/api/alerts'),request('/api/calendar?'+new URLSearchParams({month:new Date().toISOString().slice(0,7),universe:'all',instrumentUid:meta.instrumentUid}))]);if(serial!==contextGeneration)return;
  if(a.status==='fulfilled')alerts=a.value.rules||[];events=c.status==='fulfilled'?[...(c.value.events||[]),...(c.value.reminders||[])].filter(r=>!r.instrumentUid||r.instrumentUid===meta.instrumentUid).map(r=>({title:r.title||r.note||'Событие',time:Date.parse(r.at||r.dueAt||r.date+'T09:00:00+03:00')/1000})).filter(r=>Number.isFinite(r.time)):[];
  $('#terminalEvents').innerHTML=events.length?'<div class="terminal-event-list">'+events.map(r=>`<div><time>${esc(stamp(r.time))}</time><span>${esc(r.title)}</span></div>`).join('')+'</div>':'<p class="empty-copy">Для этого инструмента нет опубликованных событий за текущий месяц.</p>';
  const rules=alerts.filter(r=>r.symbol===meta.ticker);$('#terminalSideAlerts').innerHTML=`<button class="button secondary" type="button" data-create-alert>${icon('bell')} Создать уведомление</button>`+(rules.length?rules.map(r=>`<div class="terminal-alert-row"><strong>${esc(r.targetPrice)} · ${r.condition==='below'?'Ниже':'Выше'}</strong><span>${esc(r.note||'Без комментария')}</span><small>${r.enabled===false?'Приостановлено':'Условие сохранено'}</small></div>`).join(''):'<p class="empty-copy">Добавьте уровень — он появится на графике с вашим комментарием.</p>');applyContext();}
 function renderPlan(){const doc=activeDoc();if(!doc||isWorldInstrument(doc))return;$('.terminal-plan-message').textContent='';const form=$('#terminalPlanForm');for(const name of ['action','entry','stop','target','quantity','note'])form.elements[name].value=doc.plan?.[name]??(name==='action'?'buy':name==='quantity'?'1':'');$('#terminalNote').value=doc.note||'';
  $('.terminal-plan-versions').innerHTML=(doc.plans||[]).map((p,i)=>`<button type="button" data-plan-version="${i}">${esc(p.name||'План '+(i+1))}</button>`).join('');renderRisk();}
 function renderRisk(){const form=$('#terminalPlanForm'),doc=activeDoc();if(!doc)return;const values=Object.fromEntries(new FormData(form));doc.plan=values;const entry=Number(values.entry),stop=Number(values.stop),target=Number(values.target),qty=Number(values.quantity),direction=values.action==='buy'?1:-1,risk=(entry-stop)*direction,reward=(target-entry)*direction,lot=Number(activeMeta().lot)||1;
  const valid=entry>0&&stop>0&&target>0&&risk>0&&reward>0&&Number.isInteger(qty)&&qty>0;
  $('.terminal-plan-risk').innerHTML=valid?`<span>Риск / цель <strong>1 : ${num(reward/risk)}</strong></span><span>${num(qty)} лотов · ${num(qty*lot)} ${activeMeta().assetType==='future'?'контрактов':'единиц'}</span><span>До стопа ${num(risk)} · до цели ${num(reward)}<small>В единицах котировки на один инструмент</small></span>`:'<span>Задайте вход, стоп и цель по выбранному направлению.</span>';
  form.querySelector('[type="submit"]').disabled=!valid;const journal=$('#terminalPlanJournal');journal.disabled=previewOnly()||getBootstrap()?.capabilities?.tradingPlan!==true||typeof onPreparePlan!=='function';journal.title=journal.disabled?'Перенос доступен в приложении с журналом идей.':'Подготовить новую идею из уровней и условия';applyContext();}
 function currentChartIdentity(meta){const resolved=resolveInstrumentContext(meta,{catalog:catalogRows,holdings:getBootstrap()?.instruments||[],companies:getBootstrap()?.companyAnalysisInstruments||[]});return resolved.resolution==='exact'?chartIdentity(resolved.meta):null;}
 function openInstrumentNow(meta,{focusContext=true,targetId=null}={}){if(!terminalAllowed()||presetBusy||persistenceBlocked||!meta?.instrumentUid)return false;
  if(detachedId&&activeDoc()?.instrumentUid!==meta.instrumentUid){const entry=charts.get(detachedId);entry?.world?.dispose();entry?.api?.destroy();entry?.card.remove();charts.delete(detachedId);documents.set(detachedId,freshChart(meta));chartIdentities.set(detachedId,currentChartIdentity(meta));layout.tabs=[detachedId];layout.active=detachedId;dirty(detachedId);layoutView();selection(detachedId,{focusContext});return activeDoc()?.instrumentUid===meta.instrumentUid;}
  if(targetId&&!documents.has(targetId))return false;
  const shown=idsVisible();const existing=layout.tabs.find(id=>documents.get(id)?.instrumentUid===meta.instrumentUid&&(!targetId||id===targetId||!shown.includes(id)));if(existing){if(detached.has(existing)){showToast('Этот график открыт в отдельном окне.');return false;}if(expandedId)expandChart(existing,expandFocus);else{selection(existing,{focusContext,targetId:targetId||layout.active});layoutView();}return activeDoc()?.instrumentUid===meta.instrumentUid;}
  if(layout.tabs.length>=12){showToast('Открыто 12 вкладок. Закройте ненужную.');return false;}const id='chart-'+crypto.randomUUID();documents.set(id,freshChart(meta));chartIdentities.set(id,currentChartIdentity(meta));const previous=targetId||layout.active;layout.tabs.push(id);layout=selectChartSlot(layout,id,{targetId:previous,excluded:detached});if(expandedId)expandedId=id;dirty(id);layoutView();selection(id,{focusContext});return activeDoc()?.instrumentUid===meta.instrumentUid;}
 async function openInstrument(meta,options){if(persistenceBlocked&&!hardPersistenceBlock)await flush();return openInstrumentNow(meta,options);}
 function openCurrentInstrument(meta,{isCurrent}={}){
  if(!ready||typeof isCurrent!=='function'||isCurrent()!==true)return false;
  const supplied=resolveInstrumentContext(meta,{catalog:meta?[meta]:[]});
  const current=resolveInstrumentContext(meta,{catalog:catalogRows,holdings:getBootstrap()?.instruments||[],companies:getBootstrap()?.companyAnalysisInstruments||[]});
  const identity=value=>value.meta?JSON.stringify([value.ref,chartIdentityFields.map(key=>value.meta[key]??null)]):null;
  if(!identity(supplied)||identity(supplied)!==identity(current)){showToast('Данные инструмента в терминале изменились. Обновите каталог и повторите переход.');return false;}
  // Explicit navigation selects a current UID like the terminal picker. A saved
  // tab is retained; this does not attest to its original metadata or source.
  // Scoped legacy UIDs stay scoped legacy; no provider identity is inferred.
  return isCurrent()===true&&openInstrumentNow(meta);
 }
 function openInstrumentChecked(meta,{isCurrent}={}){
  if(!ready||typeof isCurrent!=='function'||!isCurrent())return false;
  const identity=chartIdentity(meta);
  if(!identity||identity!==currentChartIdentity(meta)){showToast('Данные инструмента в терминале изменились. Обновите каталог и повторите поиск.');return false;}
  const existing=layout.tabs.find(id=>documents.get(id)?.instrumentUid===meta.instrumentUid);
  if(existing&&chartIdentities.get(existing)!==identity){showToast('Сохранённая вкладка не подтверждает источник инструмента. Закройте её и откройте инструмент заново.');return false;}
  if(!isCurrent())return false;
  return openInstrumentNow(meta);
 }
 let watchObserver=null,watchQueue=[],watchBusy=0;
 async function watchWorker(){while(watchBusy<3&&watchQueue.length){const {control,generation}=watchQueue.shift();if(!visible||generation!==quoteGeneration||!control.isConnected)continue;watchBusy++;
  const meta=catalogRows.find(r=>r.instrumentUid===control.dataset.chartUid)||(getBootstrap()?.instruments||[]).find(r=>r.instrumentUid===control.dataset.chartUid);
  void (async()=>{try{if(!meta)return;const rows=await candles(meta,'CANDLE_INTERVAL_DAY',false,{purpose:'preview'});if(generation!==quoteGeneration||!control.isConnected)return;watchTable.update(control,meta,rows);
  }catch{if(generation===quoteGeneration&&control.isConnected&&!watchTable.hasQuote(control.dataset.chartUid)){control.querySelector('.terminal-watch-quote')?.remove();control.insertAdjacentHTML('beforeend','<span class="terminal-watch-quote terminal-quote-empty">Источник временно недоступен</span>');}}
  finally{watchBusy--;void watchWorker();}})();}}
 function enrichWatchlist(){const generation=++quoteGeneration;watchObserver?.disconnect();watchQueue=[];
  watchObserver=new IntersectionObserver(entries=>{
   const controls=entries.filter(entry=>entry.isIntersecting).map(entry=>entry.target);
   for(const control of controls){watchObserver.unobserve(control);watchQueue.push({control,generation});}
   // Paint visible prices in one request while histories fill change/volume.
   const brokerControls=controls.filter(control=>!control.dataset.chartUid.startsWith('crypto:'));
   for(let offset=0;offset<brokerControls.length;offset+=100){const batch=brokerControls.slice(offset,offset+100),ids=[...new Set(batch.map(control=>control.dataset.chartUid))];
    void request('/api/market/quotes?'+new URLSearchParams({instrumentUids:ids.join(',')})).then(result=>{
     if(generation!==quoteGeneration||!visible)return;
     for(const quote of result.items||[])for(const control of batch.filter(control=>control.isConnected&&control.dataset.chartUid===quote.instrumentUid)){
      const meta=catalogRows.find(row=>row.instrumentUid===quote.instrumentUid)||(getBootstrap()?.instruments||[]).find(row=>row.instrumentUid===quote.instrumentUid)||{};
      watchTable.updateQuote(control,meta,quote);
     }
    }).catch(()=>{});
   }
   void watchWorker();
  },{root:$('#instrumentQuickList'),rootMargin:'100px'});
  for(const control of $('#instrumentQuickList').querySelectorAll('[data-chart-uid]'))watchObserver.observe(control);
 }
 async function renderRadar(){const host=$('#terminalRadar');if(!host.querySelector('form'))host.innerHTML=`<form class="terminal-radar-filter"><label>Изменение, % от<input name="change" type="number" min="0" step=".1" value="${layout.radar.change}"></label><label>Объём / средний от<input name="volume" type="number" min="0" step=".1" value="${layout.radar.volume}"></label><label>До моего уровня, % до<input name="distance" type="number" min="0" step=".1" value="${layout.radar.distance}"></label><button type="submit" class="button secondary">Применить</button><button type="button" data-save-filter>Сохранить фильтр</button><select aria-label="Сохранённые фильтры" id="terminalRadarSaved"><option value="">Мои фильтры</option></select></form><p class="terminal-caption">Последняя дневная свеча. Объём сравнивается с доступными предыдущими свечами (до 20). Нулевой фильтр отключён. Выборка — первые 40 инструментов текущего списка наблюдения.</p><div class="terminal-radar-table"></div>`;
  if(!volumeExplanation)volumeExplanation=createTerminalVolumeExplanationUi({host,getContext:()=>JSON.stringify([identityEpoch,identityTag]),readOnly:previewOnly()});
  $('#terminalRadarSaved').innerHTML='<option value="">Мои фильтры</option>'+(layout.radarSaved||[]).map((r,i)=>`<option value="${i}">${esc(r.name)}</option>`).join('');
  const items=[...$('#instrumentQuickList').querySelectorAll('[data-chart-uid]')].slice(0,40),result=[];
  for(const item of items){const meta=catalogRows.find(r=>r.instrumentUid===item.dataset.chartUid),key=item.dataset.chartUid+':CANDLE_INTERVAL_DAY';const cached=cache.get(key)||cache.get(key+':preview'),rows=cached?.rows;if(!meta||!rows?.length)continue;
   const levels=alerts.filter(a=>a.symbol===meta.ticker).map(a=>Number(a.targetPrice));for(const doc of documents.values())if(doc.instrumentUid===meta.instrumentUid)levels.push(...(doc.view?.drawings||[]).filter(d=>d.type==='horizontal').map(d=>d.points[0].price));
   const m=radarMeasure(rows,levels),f=layout.radar;
    const volumeReport=buildTerminalVolumeExplanation({instrument:meta,rows,expectedRatio:m.volumeRatio,source:{label:cached.source,
     fixture:cached.fixture===true||getBootstrap()?.preview?.static===true||getBootstrap()?.environment==='fixture'&&!meta.publicMarketData,
     capturedAt:cached.capturedAt,stale:cached.stale,hasMore:cached.history?.hasMore}});
    m.volumeRatio=volumeReport.state==='ready'?volumeReport.ratio:null;if((f.change&&Math.abs(m.change??0)<f.change)||(f.volume&&(m.volumeRatio===null||m.volumeRatio<f.volume))||(f.distance&&(m.distance===null||m.distance>f.distance)))continue;result.push({meta,rows,m,volumeReport});}
  volumeExplanation.setReports(result.map(row=>[row.meta.instrumentUid,row.volumeReport]));
  host.querySelector('.terminal-radar-table').innerHTML=result.length?`<table><thead><tr><th>Инструмент</th><th>Цена</th><th>За день</th><th>Объём / средний</th><th>До уровня</th><th>Динамика</th></tr></thead><tbody>${result.sort((a,b)=>(b.m.volumeRatio||0)-(a.m.volumeRatio||0)).map(({meta,rows,m})=>`<tr><td><button data-radar-uid="${esc(meta.instrumentUid)}">${esc(meta.ticker)}</button></td><td>${num(m.price)}</td><td class="${m.change<0?'negative':'positive'}">${pct(m.change)}</td><td><button type="button" data-radar-volume="${esc(meta.instrumentUid)}" aria-label="Как рассчитан объём ${esc(meta.ticker)}" aria-expanded="false">${m.volumeRatio===null?'— · расчёт':num(m.volumeRatio)+'×'}</button></td><td>${m.distance===null?'—':num(m.distance)+'%'}</td><td class="${m.change<0?'negative':'positive'}">${spark(rows)}</td></tr>`).join('')}</tbody></table>`:'<p class="empty-copy">Совпадений с этими условиями пока нет. Измените фильтр или дождитесь загрузки котировок списка.</p>';}
 async function detach(id){const native=globalThis.nexusProduct?.terminal;if(detachedId){await native?.returnChart();return;}await flush();if(pending.has(id)){showToast('Сначала сохраните изменения графика.');return;}
  if(!native){showToast('Отдельное окно доступно в обновлённом Nexus.');return;}
  const result=await native.openChart(id);if(!result?.ok){showToast(result?.error?.message||'Не удалось открыть окно. График остаётся здесь.');return;}
  detached.add(id);const e=charts.get(id);e?.world?.dispose();e?.api?.destroy();e?.card.remove();charts.delete(id);layout.active=layout.tabs.find(key=>!detached.has(key))||id;layoutView();if(!detached.has(layout.active))selection(layout.active);}
 async function returned(id){if(!detached.has(id))return;try{const doc=await read(id);if(doc){documents.set(id,doc);chartIdentities.delete(id);}}catch{message('Не удалось восстановить график после возврата.',true);return;}detached.delete(id);layout.active=id;layoutView();selection(id);}
 const tabMenu=document.createElement('div');tabMenu.className='terminal-tab-context-menu';tabMenu.hidden=true;tabMenu.setAttribute('role','menu');tabMenu.setAttribute('aria-label','Окно графика');tabMenu.innerHTML='<button type="button" role="menuitem">Открыть в отдельном окне</button>';panel.append(tabMenu);let tabMenuTarget=null,tabMenuAnchor=null;
 const closeTabMenu=(focus=false)=>{tabMenu.hidden=true;if(focus&&tabMenuAnchor?.isConnected)tabMenuAnchor.focus();tabMenuTarget=null;};
 toolbar.querySelector('.terminal-tabs').addEventListener('contextmenu',event=>{const tab=event.target.closest('[data-chart-tab]');if(!tab)return;event.preventDefault();tabMenuTarget=tab.dataset.chartTab;tabMenuAnchor=tab;const action=tabMenu.querySelector('button');action.disabled=detached.has(tabMenuTarget);action.textContent=action.disabled?'График уже в отдельном окне':'Открыть в отдельном окне';tabMenu.hidden=false;const r=tab.getBoundingClientRect();tabMenu.style.left=Math.max(8,Math.min(event.clientX||r.left,innerWidth-tabMenu.offsetWidth-8))+'px';tabMenu.style.top=Math.max(8,Math.min(event.clientY||r.bottom,innerHeight-tabMenu.offsetHeight-8))+'px';action.focus();});
 tabMenu.querySelector('button').addEventListener('click',()=>{const id=tabMenuTarget;closeTabMenu();if(id&&documents.has(id))void detach(id);});
 document.addEventListener('pointerdown',event=>{if(!tabMenu.hidden&&!tabMenu.contains(event.target))closeTabMenu();},true);tabMenu.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();closeTabMenu(true);}if(event.key==='Tab')closeTabMenu();});
 async function init(){await readyPromise;if(!terminalAllowed())return;if(!getBootstrap()){message('Дождитесь загрузки кабинета и откройте терминал заново.',true);return;}try{catalogRows=accountChanging&&catalogRows.length?catalogRows:previewOnly()?(getBootstrap()?.instruments||[]):(await request('/api/market/catalog')).items||[];await loadWorldDirectory();const stored=await read('layout');if(stored){layout={...emptyLayout(),...stored};if(stored.panelsVersion!==undefined&&![1,2].includes(stored.panelsVersion)){blockPersistence();}else{if(stored.panelsVersion!==2){layout.auxiliary='';layout.dockCollapsed=true;}if(!Object.hasOwn(panelLabels,layout.auxiliary))layout.auxiliary='';layout.panelsVersion=2;}}
   if(detachedId){layout.tabs=[detachedId];layout.active=detachedId;layout.count=1;document.body.classList.add('terminal-detached');$('#terminalReturn').hidden=false;}
   layout.tabs=layout.tabs.filter(id=>/^chart-[a-zA-Z0-9_-]{1,64}$/.test(id)).slice(0,12);await Promise.all(layout.tabs.map(async id=>{const doc=await read(id);if(doc?.instrumentUid)documents.set(id,doc);}));layout.tabs=layout.tabs.filter(id=>documents.has(id));
  }catch{message('Настройки не загрузились. Откройте раздел заново после восстановления связи.',true);return;}
  ready=true;const settingsIdentity=getBootstrap()?.identity||getBootstrap()?.session?.identity||{};if(identityTag===null)identityTag=identityKey(settingsIdentity);preferences.setIdentity(settingsIdentity,{preview:settingsPreview(),accountScope});chartMenus.setIdentity(settingsIdentity,{preview:settingsPreview(),accountScope});customization.setIdentity(settingsIdentity,{preview:settingsPreview(),accountScope});watchTable.setIdentity(settingsIdentity,{preview:settingsPreview(),accountScope});docking.setIdentity(settingsIdentity,{preview:settingsPreview(),accountScope});docking.setSuspended(terminalPresetState(layout).state==='active');if(!layout.tabs.length){const meta=getSelection()||getBootstrap()?.instruments?.[0];if(meta)await openInstrument(meta,{focusContext:false});}else{if(!documents.has(layout.active))layout.active=layout.tabs[0];layoutView();selection(layout.active,{focusContext:false});}dockTab(layout.dock,!layout.dockCollapsed,false);void enrichWatchlist();
  if(detachedId)document.querySelector('.nav-item[data-view="terminal"]')?.click();}
 panel.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;const data=button.dataset,id=button.closest('[data-chart-id]')?.dataset.chartId;if(!button.closest('.terminal-layout-menu'))toolbar.querySelector('details').open=false;
  if(data.taskPreset){void presetActions.run(data.taskPreset).then(()=>{if(visible&&document.activeElement===document.body)(button.disabled?toolbar.querySelector('.terminal-layout-menu summary'):button).focus();});}
  else if(button.hasAttribute('data-retry-terminal-save'))void flush();
  else if(presetBusy)return;
  else if(button.hasAttribute('data-workspace-menu')){$('[data-open-rail]')?.click();}
  else if(button.hasAttribute('data-keep-panel')||button.hasAttribute('data-keep-watch')||button.hasAttribute('data-keep-context')){const name=button.hasAttribute('data-keep-watch')?'watch':button.hasAttribute('data-keep-context')?'context':'panel:'+layout.auxiliary;if(docking.pins().has(name)){docking.unpin(name);paintPanels();showToast('Панель откреплена.');}else if(docking.pin(name)){paintPanels();showToast('Панель останется открытой. Выберите другую справа.');}}
  else if(data.panel){openPanel(data.panel,true,event.ctrlKey||event.metaKey);}
  else if(data.closeWidget){docking.unpin('panel:'+data.closeWidget);if(layout.auxiliary===data.closeWidget)layout.auxiliary='';paintPanels();dirty('layout');}
  else if(button.hasAttribute('data-close-panel')){const previous=button.closest('#terminalWatchlist')?'watch':layout.auxiliary;docking.unpin(previous==='watch'?'watch':'panel:'+previous);if(layout.auxiliary===previous)layout.auxiliary='';paintPanels();dirty('layout');panelRail.querySelector('[data-panel="'+previous+'"]')?.focus();}
  else if(data.chartTab){if(detached.has(data.chartTab)){showToast('График вынесен в отдельное окно. Верните его кнопкой в том окне.');return;}if(expandedId)expandChart(data.chartTab,expandFocus);else{selection(data.chartTab);layoutView();}}
  else if(data.closeChart){if(expandedId)expandChart(null);if(detached.has(data.closeChart)){showToast('Сначала верните график из отдельного окна.');return;}if(layout.tabs.length===1){showToast('Оставьте хотя бы один график.');return;}const entry=charts.get(data.closeChart);entry?.world?.dispose();entry?.api?.destroy();entry?.card.remove();charts.delete(data.closeChart);pending.delete(data.closeChart);documents.delete(data.closeChart);chartIdentities.delete(data.closeChart);layout.tabs=layout.tabs.filter(x=>x!==data.closeChart);layout.visibleTabs=(layout.visibleTabs||[]).filter(x=>x!==data.closeChart);if(layout.active===data.closeChart)layout.active=layout.visibleTabs[0]||layout.tabs[0];layoutView();selection(layout.active);}
  else if(data.duplicateChart){if(layout.tabs.length>=12){showToast('Открыто 12 вкладок. Закройте ненужную.');return;}const next='chart-'+crypto.randomUUID();documents.set(next,structuredClone(documents.get(data.duplicateChart)));chartIdentities.set(next,chartIdentities.get(data.duplicateChart)||null);layout.tabs.push(next);layout=selectChartSlot(layout,next,{excluded:detached});if(expandedId)expandedId=next;dirty(next);layoutView();selection(next);}
  else if(data.layout){layout.count=Number(data.layout);toolbar.querySelector('details').open=false;layoutView();dirty('layout');}
  else if(data.link){const key=data.link==='cursor'?'linkCursor':'linkPeriod';layout[key]=!layout[key];layoutView();dirty('layout');}
  else if(data.collapse){if(data.collapse==='dock'){docking.unpin('context');dockTab(layout.dock,false);}else openPanel(data.collapse==='watch'?'watch':'plan',true);}
  else if(data.terminalTab)dockTab(data.terminalTab,layout.dockCollapsed||layout.dock!==data.terminalTab);
  else if(data.side)sideTab(data.side);
  else if(button.hasAttribute('data-market-bottom')){const name=layout.auxiliary;openPanel('');dockTab(name);}
  else if(button.hasAttribute('data-market-side')){const name=layout.dock;dockTab(name,false);openPanel(name);}
  else if(data.toolGroup!==undefined){selection(id);editors.tools(button,Number(data.toolGroup));}
  else if(button.hasAttribute('data-change-symbol')){selection(id);const epoch=identityEpoch;editors.picker(button,false,meta=>epoch===identityEpoch&&openInstrument(meta,{targetId:id}));}
  else if(button.hasAttribute('data-cell-indicators')){selection(id);editors.indicators(button);}
  else if(button.hasAttribute('data-cell-settings')){selection(id);editors.settings(button);}
  else if(button.hasAttribute('data-cell-fit')){selection(id);charts.get(id)?.api?.fitContent();}
  else if(button.hasAttribute('data-insight-native-chart')){const active=layout.active,doc=documents.get(active);if(!doc||persistenceBlocked||isWorldInstrument(doc))return;doc.chartSource='native';dirty(active);selection(active);void loadChart(active);}
  else if(button.hasAttribute('data-chart-source')){const doc=documents.get(id);if(!doc||persistenceBlocked)return;doc.chartSource=usesWidget(doc)?'native':'tradingview';dirty(id);selection(id);void loadChart(id);}
  else if(button.hasAttribute('data-cursor-menu')){selection(id);editors.cursor(button);}
  else if(data.tool){selection(id);const entry=charts.get(id);if(data.tool==='cursor'&&button.getAttribute('aria-pressed')==='true'){editors.cursor(button);}else{entry?.cursor?.set('crosshair');entry?.api?.beginDrawing(data.tool==='cursor'?null:data.tool);}}
  else if(button.hasAttribute('data-clear-drawings'))charts.get(id)?.api?.clearDrawings();
  else if(data.history)charts.get(layout.active)?.api?.drawings[data.history]();
  else if(data.expandChart)expandChart(expandedId?null:data.expandChart,button);
  else if(button.hasAttribute('data-magnet')){const layer=charts.get(id)?.api?.drawings;layer?.setMagnet(!layer.isMagnet());}
  else if(button.hasAttribute('data-hide-drawings')){const layer=charts.get(id)?.api?.drawings;layer?.hide(!layer.isHidden());}
  else if(data.compareRemove){selection(id);void compareInstrument({instrumentUid:data.compareRemove},true);}
  else if(data.compareToggle){selection(id);const doc=activeDoc(),meta=doc.comparisons.find(m=>m.instrumentUid===data.compareToggle);meta.visible=meta.visible===false;void loadComparison(id,meta);renderComparisons(id);dirty(id);}
  else if(button.hasAttribute('data-compare-daily')){selection(id);interval.value='CANDLE_INTERVAL_DAY';interval.dispatchEvent(new Event('change'));}
  else if(button.hasAttribute('data-compare-retry')){selection(id);void loadChart(id,true);}
  else if(data.detachChart){if(expandedId)expandChart(null);void detach(data.detachChart);}
  else if(data.terminalIndicator){const api=charts.get(layout.active)?.api,name=data.terminalIndicator,value=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(value));api?.toggle(name,value);}
  else if(data.radarUid)void openInstrument(catalogRows.find(r=>r.instrumentUid===data.radarUid));
  else if(button.hasAttribute('data-create-alert'))$('#instrumentPriceAlert').click();
  else if(data.planVersion!==undefined){activeDoc().plan={...activeDoc().plans[Number(data.planVersion)]};renderPlan();dirty(layout.active);}
  else if(button.hasAttribute('data-save-filter')){layout.radarSaved=[...(layout.radarSaved||[]),{name:'Фильтр '+((layout.radarSaved||[]).length+1),filter:{...layout.radar}}].slice(-10);dirty('layout');void renderRadar();}
  else if(button.id==='terminalAdd'||button.hasAttribute('data-add-slot')){const epoch=identityEpoch;editors.picker(button,false,meta=>epoch===identityEpoch&&openInstrument(meta));}
  else if(button.id==='terminalFit')charts.get(layout.active)?.api?.fitContent();
  else if(button.id==='terminalPlanNew'){activeDoc().plan=null;renderPlan();dirty(layout.active);}
  else if(data.chartZoom)charts.get(layout.active)?.api?.zoom(Number(data.chartZoom));
  else if(data.earlier){const e=charts.get(data.earlier);if(e){resetHistoryRetry(e);e.historyPaused=false;e.emptyPages=0;}if(documents.get(data.earlier)?.historyDate)void loadEarlier(data.earlier,true);else void loadAllHistory(data.earlier);}
  else if(button.id==='terminalDate')editors.datePicker(button);
  else if(button.id==='terminalLive')void jumpDate(null);
  else if(button.id==='terminalScale')editors.scale(button);
  else if(button.id==='terminalObjects')editors.objects(button);
  else if(button.id==='terminalSettings')editors.settings(button);
  else if(button.id==='terminalReplay')replayControls.toggle();
  else if(button.id==='terminalIndicators')editors.indicators(button);
  else if(button.id==='terminalCompare')editors.picker(button,true);
  else if(button.id==='terminalExpand')expandChart(expandedId?null:layout.active,button);
  else if(button.id==='terminalReturn')void detach(detachedId);
 });
 main.querySelector('.terminal-grid').addEventListener('pointerdown',event=>{if(event.target.closest('button,select,input,textarea'))return;const id=event.target.closest('[data-chart-id]')?.dataset.chartId;if(id&&id!==layout.active)selection(id);},true);
 panel.addEventListener('change',event=>{if(event.target.matches('[data-cell-interval]')){selection(event.target.closest('[data-chart-id]').dataset.chartId);interval.value=event.target.value;interval.dispatchEvent(new Event('change',{bubbles:true}));}});
 type.addEventListener('change',()=>{try{charts.get(layout.active)?.api?.setType(type.value);}catch(error){type.value=charts.get(layout.active)?.api?.getState().type||'candles';showToast(error.message);}});
 interval.addEventListener('change',()=>{const doc=activeDoc();if(!doc)return;charts.get(layout.active)?.api?.stopReplay();doc.interval=interval.value;doc.resolution=defaultResolution(doc.interval);doc.view={...doc.view,range:null};const e=charts.get(layout.active);if(e){e.historyPaused=false;e.emptyPages=0;}if(doc.interval==='CANDLE_INTERVAL_DAY')doc.view.indicators.vwap=false;selection(layout.active);dirty(layout.active);void loadChart(layout.active);});
 $('#terminalFlash').addEventListener('change',event=>charts.get(layout.active)?.api?.setFlash(event.target.checked));
 $('#terminalNote').addEventListener('input',event=>{activeDoc().note=event.target.value;dirty(layout.active);});
 $('#terminalPlanForm').addEventListener('input',()=>{renderRisk();dirty(layout.active);});
 $('#terminalPlanForm').addEventListener('submit',async event=>{event.preventDefault();const doc=activeDoc();doc.plans=[...(doc.plans||[]),{...doc.plan,name:'План '+((doc.plans||[]).length+1)}].slice(-12);dirty(layout.active);await flush();renderPlan();$('.terminal-plan-message').textContent=pending.has(layout.active)?'План пока не сохранён. Повторите.':'План сохранён на этом устройстве.';});
 dock.addEventListener('submit',event=>{if(!event.target.matches('.terminal-radar-filter'))return;event.preventDefault();layout.radar=Object.fromEntries([...new FormData(event.target)].map(([k,v])=>[k,Number(v)]));dirty('layout');void renderRadar();});
 dock.addEventListener('change',event=>{if(event.target.id!=='terminalRadarSaved'||event.target.value==='')return;layout.radar={...layout.radarSaved[Number(event.target.value)].filter};for(const[k,v]of Object.entries(layout.radar))$('#terminalRadar form').elements[k].value=v;dirty('layout');void renderRadar();});
 panel.addEventListener('keydown',event=>{const tab=event.target.closest('[role="tab"]');if(!tab||event.ctrlKey||event.metaKey||event.altKey||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const tabs=[...tab.closest('[role="tablist"]').querySelectorAll('[role="tab"]')],i=tabs.indexOf(tab);const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[next].click();tabs[next].focus();});
 document.addEventListener('invest:watchlist-rendered',()=>{if(ready&&visible)void enrichWatchlist();});
 document.addEventListener('invest:catalog-updated',()=>{const epoch=identityEpoch;void request('/api/market/catalog').then(result=>{if(epoch!==identityEpoch)return;catalogRows=result.items||[];orderTicket.update();if(ready&&visible){void enrichWatchlist();for(const id of idsVisible())void loadChart(id);}}).catch(()=>{});});
 globalThis.nexusProduct?.terminal?.onReturned?.(id=>void returned(id));
 globalThis.nexusProduct?.terminal?.onPrepareClose?.(async()=>{if(await flush())globalThis.nexusProduct.terminal.closeReady();else message('Окно оставлено открытым: не удалось сохранить изменения. Повторите возврат после восстановления связи.',true);});
 let initial=init();
 document.addEventListener('keydown',e=>{if(presetBusy)return;if(e.key==='Escape'&&toolbar.querySelector('details').open)toolbar.querySelector('details').open=false;else if(e.key==='Escape'&&expandedId)expandChart(null);else if(e.key==='Escape'&&visible&&layout.auxiliary&&!panel.querySelector('.terminal-popover:not([hidden])')){const previous=layout.auxiliary;openPanel('');panelRail.querySelector('[data-panel="'+previous+'"]')?.focus();}if(visible&&e.altKey&&e.key==='Enter'){e.preventDefault();expandChart(expandedId?null:layout.active,document.activeElement);}});
 function marketSubscription(){return {charts:visible?idsVisible().flatMap(id=>{const doc=documents.get(id);return !usesWidget(doc)&&doc?.instrumentUid&&!doc.instrumentUid.startsWith('crypto:')&&!doc.historyDate&&!charts.get(id)?.api?.getReplay().active?[{instrumentUid:doc.instrumentUid,interval:doc.interval}]:[];}):[],focus:visible&&!isWorldInstrument(activeDoc())&&!activeDoc()?.instrumentUid?.startsWith('crypto:')?activeDoc()?.instrumentUid||'':''};}
 // A bounded broker snapshot fills the quote strip even when no local candles
 // are needed by TradingView. Late replies cannot cross an account or tab.
 let summaryQuoteSerial=0;
 async function refreshSummaryQuote(){
  const serial=++summaryQuoteSerial,meta=activeMeta(),epoch=identityEpoch,scope=accountScope,id=layout.active;
  if(!visible||!meta.instrumentUid||isWorldInstrument(meta)||meta.instrumentUid.startsWith('crypto:')||hardPersistenceBlock)return;
  try{
   const result=await request('/api/market/quotes?'+new URLSearchParams({instrumentUids:meta.instrumentUid}));
   if(serial!==summaryQuoteSerial||epoch!==identityEpoch||scope!==accountScope||id!==layout.active||!visible||hardPersistenceBlock)return;
   const row=result.items?.find(item=>item.instrumentUid===meta.instrumentUid);
   if(row)customization.receive({...row,type:'market.trade',simulated:result.fixture===true});
  }catch{/* Existing prices keep their original timestamp; absence stays explicit. */}
 }
 function subscriptionChanged(){document.dispatchEvent(new Event('invest:market-subscription'));}
 function updateCandle(row){
  if(['waiting','live'].includes(marketPhase))marketPhase='live';const key=row.instrumentUid+':'+row.interval,prior=cache.get(key),next=applyLiveCache(prior,row,row.interval);if(!next)return;
  cacheVersions.set(key,(cacheVersions.get(key)||0)+1);cache.set(key,next);if(row.interval==='CANDLE_INTERVAL_DAY'){const meta=catalogRows.find(m=>m.instrumentUid===row.instrumentUid);if(meta)watchTable.updateLive(meta,next.rows);}
  for(const[id,e]of charts)if(e.key===key){
   if(e.api?.getReplay().active)continue;
   e.liveEventAt=row.sourceEventTime;e.liveReceivedAt=row.capturedAt;
   if(!e.api){void loadChart(id);continue;}
   const normalized=normalizeMarketCandles([row],row.interval)[0];
   const tail=liveDisplayTail(next.rows,e.rows,documents.get(id)?.resolution,normalized.time);
   if(tail)e.rows=e.api.updateCandle(tail)||e.rows;
   else {e.rows=aggregateCandles(next.rows,documents.get(id)?.resolution);e.api.setData(e.rows);}
   const last=e.rows.at(-1),previous=e.rows.at(-2);if(!last)continue;refreshOhlc(e);
   e.card.querySelector('.terminal-chart-quote').innerHTML='<strong>'+num(last.close)+(metaFor(documents.get(id)).assetType==='future'?' п.':'')+'</strong><small class="'+(last.close<previous?.close?'negative':'positive')+'">'+pct(previous?.close?(last.close/previous.close-1)*100:null)+' · к прошлой свече</small>';
   const source=e.card.querySelector('.terminal-chart-source');
   source.textContent=(next.fixture?'Тестовые данные':'Т‑Инвест')+' · свеча '+stamp(last.time)+' · получено '+stamp(Date.parse(row.capturedAt)/1000);source.classList.remove('stale');historyStatus(id);renderComparisons(id);
   if(id===layout.active){renderStats();customization.update();orderTicket.update();}
  }
 }
 function applySnapshot(message){
  const key=message.instrumentUid+':'+message.interval;
  if(![...documents.values()].some(doc=>doc.instrumentUid===message.instrumentUid&&doc.interval===message.interval))return;
  cacheVersions.set(key,(cacheVersions.get(key)||0)+1);
  cache.set(key,applySnapshotCache(cache.get(key),message,message.interval));
  for(const[id,e]of charts)if(e.key===key)void loadChart(id);
 }
 function resetMarket(){marketPhase='waiting';closeExplanations();streamGeneration++;cache.clear();cacheVersions.clear();requests.clear();activity.reset();for(const[id,e]of charts){if(usesWidget(documents.get(id)))continue;e.seq++;e.cursor?.destroy();e.api?.destroy();e.api=null;e.rows=[];e.liveEventAt=null;e.liveReceivedAt=null;e.seriesState='loading';e.comparisonStates=new Map();renderComparisons(id);e.host.textContent='Восстанавливаем котировки…';e.card.querySelector('.terminal-chart-quote').textContent='—';}customization.resetQuote();renderStats();orderTicket.update();}
 const cryptoTimer=setInterval(()=>{if(!visible||document.hidden)return;for(const id of idsVisible())if(documents.get(id)?.instrumentUid?.startsWith('crypto:')&&!charts.get(id)?.api?.getReplay().active)void loadChart(id);},5000);window.addEventListener('pagehide',()=>clearInterval(cryptoTimer),{once:true});
 function paintChartFreshness(){for(const id of idsVisible()){
  const entry=charts.get(id),doc=documents.get(id);if(!entry||!doc)continue;if(usesWidget(doc)){entry.card.querySelector('.terminal-chart-freshness')?.remove();continue;}
  const cached=cache.get(entry.key)||{},value=chartFreshness({receivedAt:entry.liveReceivedAt||cached.capturedAt,sourceEventTime:entry.liveEventAt,streamState:marketPhase,
   fixture:cached.fixture===true||getBootstrap()?.environment==='fixture',history:!!doc.historyDate,replay:entry.api?.getReplay().active});
  let label=entry.card.querySelector('.terminal-chart-freshness');if(!label){label=document.createElement('span');label.className='terminal-chart-freshness';label.setAttribute('aria-label','Актуальность графика');entry.card.querySelector('header').append(label);}
  if(id===layout.active&&label.dataset.state!==value.state)seriesPassport.invalidate();if(label.textContent!==value.text)label.textContent=value.text;label.dataset.state=value.state;
  if(id===layout.active){let active=controls.querySelector('.terminal-active-freshness');if(!active){active=document.createElement('span');active.className='terminal-chart-freshness terminal-active-freshness';controls.append(active);}active.textContent=value.text;active.dataset.state=value.state;}
 }}
 const activityTimer=setInterval(()=>{if(visible&&!document.hidden){activity.tick();paintChartFreshness();}},1000);
 const saveRecoveryTimer=setInterval(()=>{if(visible&&!document.hidden&&persistenceBlocked&&!hardPersistenceBlock&&!recoveryPromise&&!saving.size)void flush();},15000);
 window.addEventListener('pagehide',()=>clearInterval(saveRecoveryTimer),{once:true});
 window.addEventListener('pagehide',()=>clearInterval(activityTimer),{once:true});
 function activateTerminal(view){visible=view==='terminal'&&terminalAllowed();if(!visible){resetWorldCharts();closeExplanations();}if(!visible&&expandedId)expandChart(null);subscriptionChanged();clearInterval(refreshTimer);if(visible){for(const id of idsVisible()){if(usesWidget(documents.get(id)))void loadChart(id);else void loadAllHistory(id);}refreshTimer=setInterval(()=>{if(document.hidden)return;for(const id of idsVisible())void loadChart(id);void enrichWatchlist();void loadContext();},60000);if(ready&&!layout.dockCollapsed&&layout.dock==='participants')participants.show();}else{for(const e of charts.values())e.api?.pauseReplay();participants.hide();void flush();}}
 async function switchAccount(portfolioId){
  await initial;
  const next=portfolioId?(getBootstrap()?.clientProduct?.portfolios||[]).find(row=>row.id===portfolioId)?.preferenceKey:'';
  if(next===accountScope)return true;
  if(next===undefined||next&&!/^[a-f0-9]{32}$/.test(next)){showToast('Счёт не подтверждён. Обновите кабинет.');return false;}
  if(accountChanging||detachedId||detached.size||presetBusy){showToast('Закройте отдельные окна графиков и завершите сохранение перед сменой счёта.');return false;}
  accountChanging=true;
  try{
   if(!await flush()||persistenceBlocked){showToast('Сначала сохраните изменения терминала.');return false;}
   const path='/api/market/terminal?'+new URLSearchParams({key:'layout',...(next?{account:next}:{})});
   let staged=null;
   if(!previewOnly()){
    const check=await baseRequest(path);if(!check||check.key!=='layout'||!Number.isSafeInteger(check.revision)||!/^[a-f0-9]{64}$/.test(check.ownerScope||''))throw Error('Счёт не подтвердил настройки');
    const tabs=check.value?.tabs||[];if(!Array.isArray(tabs)||tabs.length>12||tabs.some(key=>!/^chart-[a-zA-Z0-9_-]{1,64}$/.test(key)))throw Error('Сохранённый набор графиков не подтверждён');
    staged=new Map([['layout',check]]);
    await Promise.all(tabs.map(async key=>{const value=await baseRequest('/api/market/terminal?'+new URLSearchParams({key,...(next?{account:next}:{})}));if(value?.key!==key||value.ownerScope!==check.ownerScope||!value.value?.instrumentUid||!Number.isSafeInteger(value.revision)||value.revision<1)throw Error('Не удалось прочитать сохранённый график. Текущее пространство сохранено.');staged.set(key,value);}));
   }
   resetWorldCharts();editors.close(false);closeExplanations();if(expandedId)expandChart(null);contextGeneration++;quoteGeneration++;identityEpoch++;workspaceSerial++;
   for(const entry of charts.values()){entry.seq++;entry.cursor?.destroy();entry.api?.destroy();entry.card.remove();}
   charts.clear();documents.clear();chartIdentities.clear();revisions.clear();pending.clear();retryableSaves.clear();
   stagedAccountDocs=staged;accountScope=next;ownerScope=null;layout=emptyLayout();ready=false;activity.reset();subscriptionChanged();initial=init();await initial;
   message(portfolioId?'Графики и индикаторы сохраняются отдельно для выбранного счёта.':'Общее рабочее пространство. Прежние графики сохранены.');return ready;
  }catch(error){showToast(error.message||'Не удалось переключить счёт. Повторите.');return false;}
  finally{accountChanging=false;stagedAccountDocs=null;if(visible&&ready&&!persistenceBlocked)for(const id of idsVisible())if(usesWidget(documents.get(id)))void loadChart(id);}
 }
 return {switchAccount,openInstrument,openCurrentInstrument,openInstrumentChecked,activate:activateTerminal,
  async refresh(){if(!terminalAllowed())return;await initial;if(!ready){initial=init();await initial;}if(!ready)return;const selected=getSelection();if(selected?.instrumentUid&&selected.instrumentUid!==activeDoc()?.instrumentUid)await openInstrument(selected);else if(ready)for(const id of idsVisible())void loadChart(id);if(visible)void enrichWatchlist();},
  updateAccess(){const allowed=terminalAllowed(),changed=allowed!==previousTerminalAccess;previousTerminalAccess=allowed;planGate.hidden=allowed;panel.classList.toggle('terminal-plan-locked',!allowed);participants.accessChanged();if(!allowed){resetWorldCharts();visible=false;clearInterval(refreshTimer);participants.hide();for(const e of charts.values())e.api?.pauseReplay();subscriptionChanged();}else if(changed){if(!ready)initial=init();void initial.then(()=>{if(terminalAllowed())activateTerminal(document.body.dataset.currentView);});}},
  update(){},updateCandle,marketSubscription,applySnapshot,resetMarket,
  marketEvent:event=>{activity.receive(event);watchTable.receive(event);customization.receive(event);if(event.type==='market.status'){const meta=catalogRows.find(m=>m.instrumentUid===event.instrumentUid);if(meta){meta.tradingStatus=event.status;meta.sessionLabel=marketSessionLabel(event.status);if(activeDoc()?.instrumentUid===event.instrumentUid)renderStats();}}},marketState:event=>{marketPhase=event.state;activity.state(event);paintChartFreshness();seriesPassport.invalidate();},flush};
}
