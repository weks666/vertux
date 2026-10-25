import { instrumentMark, watchInstrumentImages } from './instrument-mark.js';
import {buildLoadedNewsContext,renderLoadedNewsContext,newsContextRevision,newsSourceUrl} from './news-source-context.js';
import {createNewsContentHistoryDisclosure} from './news-content-history-ui.js';
import {newsClaimEvidence,renderClaimEvidence} from './claim-evidence.js';
import {renderContextEvidence} from './context-evidence.js';
import {buildNewsContextEvidence} from './context-evidence-adapters.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=value=>new Date(value).toLocaleString('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const date=value=>new Date(value+'T12:00:00Z').toLocaleDateString('ru-RU',{timeZone:'UTC',day:'numeric',month:'short',year:'numeric'});
const relationLabels={direct:'Связь от брокера',mentioned:'Упоминание в тексте',theme:'Возможная связь по теме'};
const directions={positive:'Возможный положительный эффект',negative:'Возможный отрицательный эффект',mixed:'Разнонаправленный эффект',unclear:'Направление не установлено'};
const price=(value,currency)=>new Intl.NumberFormat('ru-RU',{style:'currency',currency,maximumFractionDigits:4}).format(Number(BigInt(value))/1e9);
const link=(url,title)=>newsSourceUrl(url)?'<a href="'+esc(newsSourceUrl(url))+'" target="_blank" rel="noopener noreferrer">'+esc(title)+'</a>':'';

export function newsResponseState(data) {
 if(data?.demoUnavailable===true)return 'demo';
 if(!data||!Array.isArray(data.items)||data.items.some(row=>!row||typeof row.id!=='string'||typeof row.title!=='string'||typeof row.summary!=='string'||typeof row.source!=='string'||!Number.isFinite(Date.parse(row.at))))return 'unknown';
 if(data.unavailable===true||data.refreshFailed===true)return 'error';
 if(data.stale===true)return 'stale';
 return data.items.length?'ready':'empty';
}

export function initNewsPanel({request,getCatalog=()=>[],onMore=()=>{},onRetry=()=>{},canReadHistory=()=>false}) {
 const $=id=>document.getElementById(id);
 let items=[],selected='',report=null,busy=false,issue='',generation=0,hasMore=false,feedState='idle',feedFixture=false;
 let cacheCapturedAt=null,selectionRevision=null,contentHistory=null,selectionBinding;
 const invalidNews=new Set();
 const selectionReady=row=>selectionBinding===undefined||(selectionBinding==='local-news-selection-v1'&&typeof row?.analysisVersion==='string'&&/^[a-f0-9]{64}$/u.test(row.analysisVersion));
 function clearAnalysis(){contentHistory?.dispose();contentHistory=null;generation++;report=null;busy=false;issue='';}
 const filterChoices={newsCompany:new Set(),newsSource:new Set()};
 function filtered(){return items;}
 function filterTarget(){return ['newsPeriod','newsRelevance','newsCompany','newsSource'].map(id=>$(id)).find(control=>control&&!control.disabled);}
 function feedCopy(){
  if(feedState==='loading')return items.length?'Обновляем ленту. Пока показаны загруженные публикации.':'Загружаем новости…';
  if(feedState==='demo')return 'В этом демо новостная лента не подключена. Учебные события доступны в календаре.';
  if(feedState==='error')return items.length?'Не удалось обновить ленту. Показаны ранее загруженные публикации.':'Не удалось получить новости. Число подходящих публикаций неизвестно.';
  if(feedState==='unknown')return items.length?'Ответ источника не распознан. Показаны ранее загруженные публикации.':'Ответ источника не распознан. Число подходящих публикаций неизвестно.';
  if(feedState==='stale')return items.length?'Показаны сохранённые публикации. Актуальность ленты не подтверждена.':'В сохранённой выборке нет подходящих публикаций. Актуальность ленты не подтверждена.';
  if(feedState==='idle')return 'Новости ещё не загружены.';
  return 'В загруженных публикациях нет новостей по выбранным условиям.';
 }
 function feedAction(){
  if(['error','unknown','stale'].includes(feedState))return '<button type="button" class="button secondary" data-news-action="retry">Повторить загрузку</button>';
  if(feedState==='demo'&&$('calendarSurface')&&!$('calendarSurface').hidden)return '<button type="button" class="button secondary" data-news-action="calendar">К событиям</button>';
  if(feedState==='empty'&&filterTarget())return '<button type="button" class="button secondary" data-news-action="filters">Изменить фильтры</button>';
  return '';
 }
 function mark(row){return '<span class="instrument-mark mark-news" title="'+esc('Источник: '+row.source)+'" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/></svg></span>';}
 const stamp=value=>'<span>'+esc(new Date(value).toLocaleDateString('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'short',year:'numeric'}))+'</span><span>'+esc(new Date(value).toLocaleTimeString('ru-RU',{timeZone:'Europe/Moscow',hour:'2-digit',minute:'2-digit'}))+'</span>';
 function renderList(){
  const list=$('marketNewsList'),scrollTop=list.scrollTop;
  const rows=filtered(),n=rows.length,last=n%10,lastTwo=n%100;
  const uncertain=['idle','loading','demo','error','unknown'].includes(feedState);
  $('newsFilterCount').textContent=uncertain?(n?n+' загружено':''):n+' '+(last===1&&lastTwo!==11?'публикация':last>=2&&last<=4&&(lastTwo<12||lastTwo>14)?'публикации':'публикаций')+(feedState==='stale'?' в сохранённой выборке':'');
  $('marketNewsStatus').textContent=['ready','empty'].includes(feedState)?(feedFixture?'Учебная лента':''):feedCopy();
  list.setAttribute('aria-busy',String(feedState==='loading'));
  list.dataset.state=feedState;
  $('marketNewsList').innerHTML=rows.map(row=>'<article class="news-item'+(row.id===selected?' selected':'')+'">'+mark(row)+'<div class="news-item-copy">'
   +'<button class="news-select" type="button" data-news-id="'+esc(row.id)+'" aria-pressed="'+(row.id===selected)+'"><h4>'+esc(row.title)+'</h4></button>'
   +'<p>'+esc(row.summary.slice(0,180))+(row.summary.length>180?'…':'')+'</p></div><div class="news-item-meta"><strong>'+esc(row.source)+'</strong><time datetime="'+esc(row.at)+'">'+stamp(row.at)+'</time>'
   +(row.inPortfolio?'<span class="news-relation-dot direct" title="Актив из вашего портфеля" aria-label="Актив из вашего портфеля"></span>':row.relatedToPortfolio?'<span class="news-relation-dot related" title="Возможная связь с портфелем" aria-label="Возможная связь с портфелем"></span>':'')+'</div></article>').join('')
   ||'<p class="empty-copy">'+esc(feedCopy())+'</p>';
  list.innerHTML+=feedAction();
  list.scrollTop=scrollTop;
  $('newsMore').hidden=!hasMore||['idle','loading','demo','error','unknown'].includes(feedState);
  watchInstrumentImages($('marketNewsList'));
 }
 function renderReport(){
  contentHistory?.dispose();contentHistory=null;
  const row=items.find(item=>item.id===selected),panel=$('newsAnalysisContent');
  $('newsGenerate').hidden=!row;
  const invalidSelection=row&&(invalidNews.has(selected)||!selectionReady(row));
  $('newsGenerate').disabled=busy||Boolean(invalidSelection);
  $('newsGenerate').textContent=busy?'Готовим разбор…':report?'Обновить разбор':'Подготовить AI-разбор';
  $('newsAnalysisStatus').textContent=issue||(invalidSelection?'Обновите новости и повторите разбор.':busy?'Готовим разбор…':report?(report.fixture?'Учебный пример':'Разбор подготовлен · '+report.model):'');
  $('newsAnalysisStatus').classList.toggle('negative',Boolean(issue||invalidSelection));
  panel.setAttribute('aria-busy',String(busy));
  if(!row){panel.innerHTML='<p class="empty-copy">'+(['ready'].includes(feedState)?'Выберите публикацию в ленте. Здесь появятся связанные компании, сравнение с прошлым и возможные сценарии.':'Публикация не выбрана. Разбор станет доступен после загрузки и выбора новости.')+'</p>';return;}
  let html='<header class="news-detail-identity">'+mark(row)+'<div><strong>'+esc(row.relations?.[0]?.name||row.source)+'</strong><small>'+esc(row.relations?.[0]?.ticker||'Новости рынка')+'</small></div><div class="news-detail-stamp"><strong>'+esc(row.source)+'</strong><time datetime="'+esc(row.at)+'">'+stamp(row.at)+'</time></div></header><h3 class="news-detail-title" tabindex="-1" id="newsSelectedTitle">'+esc(row.title)+'</h3>';
  if(!report){
   const seen=new Set(),relations=(row.relations||[]).filter(item=>{if(seen.has(item.ticker))return false;seen.add(item.ticker);return true;}).slice(0,6);
   const originalLink=link(row.url,'Читать на сайте '+row.source+' ↗');
   html+='<p class="news-original">'+esc(row.summary)+'</p>'+(originalLink?'<div class="news-detail-link">'+originalLink+'</div>':'')+'<div class="news-company-tags">'
    +relations.map(item=>'<span title="'+esc(relationLabels[item.relation]+': '+item.reason)+'">'+esc(item.ticker)+'</span>').join('')+'</div>';
  }else{
   const analysis=report.analysis;
   const evidence=claim=>renderClaimEvidence(newsClaimEvidence(report,row,claim));
   html+='<section class="news-analysis-section"><h4>Что сообщает источник</h4><p>'+esc(analysis.summary)+'</p>'+evidence(analysis.summaryEvidence)+'</section>';
   html+='<section class="news-analysis-section"><h4>Возможные каналы влияния</h4>'+(analysis.impacts.map(impact=>{
    const company=report.companies.find(item=>item.ticker===impact.ticker);
    return '<div class="news-company"><strong>'+esc(impact.ticker)+' · '+esc(company?.name||'')+'</strong>'+(company?.inPortfolio?'<span class="portfolio-mark">В портфеле</span>':'')
     +'<small>'+esc(directions[impact.direction])+' · '+esc(relationLabels[company?.relation]||'')+'</small><p>'+esc(impact.mechanism)+'</p>'+evidence(impact)+'</div>';
   }).join('')||'<p>Сведений для вывода по конкретной компании недостаточно.</p>')+'</section>';
   html+='<section class="news-analysis-section"><h4>Сравнение с прошлым</h4>'+(report.historicalCases.map(item=>{
    const comparison=analysis.history.find(row=>row.caseId===item.id);
    return '<div class="news-history"><h5>'+esc(item.title)+'</h5><small>'+esc(date(item.date))+' · '+esc(item.source)+'</small><p>'+esc(item.fact)+'</p>'
     +(comparison?'<p><strong>Сходство.</strong> '+esc(comparison.similarity)+'</p><p><strong>Отличие.</strong> '+esc(comparison.difference)+'</p>'+evidence(comparison):'')
     +(item.moves.length?'<div class="news-price-moves">'+item.moves.map(move=>'<p><strong>'+esc(move.ticker)+' <span class="'+(move.changePercent>=0?'positive':'negative')+'">'+esc(new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2,signDisplay:'always'}).format(move.changePercent))+'%</span></strong><span>'+esc(date(move.beforeDate))+' → '+esc(date(move.afterDate))+'</span><small>'+esc(price(move.beforeCloseNanos,move.currency))+' → '+esc(price(move.afterCloseNanos,move.currency))+' · закрытия Т‑Инвест</small></p>').join('')+'</div>':'<p class="news-data-gap">У брокера не найдена полная пара исторических цен для выбранных компаний. Изменение акции не рассчитано.</p>')
     +link(item.url,'Источник события')+'</div>';
   }).join('')||'<p>В проверенном справочнике нет подходящего события для этой темы. Сравнение с прошлым не построено.</p>')+'</section>';
   html+='<section class="news-analysis-section"><h4>Условные сценарии</h4>'+analysis.scenarios.map(item=>'<div class="news-scenario"><strong>'+esc(item.condition)+'</strong><p>'+esc(item.effect)+'</p><p class="news-watch">Проверить: '+esc(item.watch)+'</p>'+evidence(item)+'</div>').join('')+'</section>';
   html+='<details class="news-limitations"><summary>Источники, метод и ограничения</summary>'+report.limitations.map(item=>'<p>'+esc(item)+'</p>').join('')+'</details>';
   html+=renderContextEvidence(buildNewsContextEvidence(report,row,{fixture:feedFixture,receivedAt:cacheCapturedAt}));
  }
  html+=renderLoadedNewsContext(buildLoadedNewsContext({row,fixture:feedFixture,feedState,cacheCapturedAt}));
  panel.innerHTML=html;watchInstrumentImages(panel);
  if(canReadHistory()&&feedState!=='demo'){
   const serial=generation,revision=newsContextRevision(row),id=row.id;
   contentHistory=createNewsContentHistoryDisclosure({newsId:id,request,isCurrent:()=>canReadHistory()&&serial===generation&&id===selected&&revision===newsContextRevision(items.find(item=>item.id===id))});
   panel.append(contentHistory.button,contentHistory.region);
  }
 }
 function choose(id){if(!items.some(row=>row.id===id))return;clearAnalysis();selected=id;selectionRevision=newsContextRevision(items.find(row=>row.id===id));if(invalidNews.has(id)||!selectionReady(items.find(row=>row.id===id)))feedState='stale';renderList();renderReport();if(matchMedia('(max-width: 1100px)').matches)$('newsAnalysisPanel').scrollIntoView({block:'start'});$('newsSelectedTitle')?.focus({preventScroll:true});}
 $('marketNewsList').addEventListener('click',event=>{
  const button=event.target.closest('[data-news-id]');if(button)choose(button.dataset.newsId);
  const action=event.target.closest('[data-news-action]')?.dataset.newsAction;
  if(action==='retry')void onRetry({replace:invalidNews.has(selected)});
  if(action==='filters'){const control=filterTarget();(control?.closest('.filter-select')?.querySelector('.filter-select-trigger')||control)?.focus();}
  if(action==='calendar'){const calendar=$('calendarSurface');calendar?.scrollIntoView({block:'start'});const heading=calendar?.querySelector('h3');if(heading){heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});}}
 });
 $('newsMore').addEventListener('click',()=>void onMore());
 $('newsGenerate').addEventListener('click',async()=>{
  const row=items.find(item=>item.id===selected);
  if(busy||!selected||invalidNews.has(selected)||!selectionReady(row))return;const id=selected,serial=generation,revision=newsContextRevision(row),version=selectionBinding===undefined?undefined:row.analysisVersion;
  if(!revision){issue='Контекст публикации не подтверждён. Повторите загрузку.';renderReport();return;}
  const restoreGenerateFocus=document.activeElement===$('newsGenerate');
  busy=true;issue='';renderReport();
  try{const result=await request('/api/market/news/analyze',{method:'POST',body:JSON.stringify({newsId:id,...(version===undefined?{}:{analysisVersion:version})})});if(serial===generation&&id===selected&&revision===newsContextRevision(items.find(row=>row.id===id))){if(result?.newsId!==id)throw Error('Ответ не соответствует выбранной публикации.');if(version!==undefined&&result.analysisVersion!==version)throw Object.assign(Error('Публикация изменилась. Обновите новости и повторите разбор.'),{code:'NEWS_CONTEXT_CHANGED'});report=result;}}
  catch(error){if(serial===generation&&id===selected){
   issue=error.message;
   if(['NEWS_CONTEXT_CHANGED','NEWS_NOT_FOUND','ACCOUNT_SCOPE_CHANGED','MARKET_CONTEXT_CHANGED'].includes(error.code)||[401,403].includes(error.status)){
    report=null;invalidNews.add(id);feedState='stale';renderList();
   }
  }}
  finally{if(serial===generation){busy=false;renderReport();if(id===selected&&invalidNews.has(id)){
   const retry=$('marketNewsList').querySelector('[data-news-action="retry"]');retry?.focus({preventScroll:true});retry?.scrollIntoView({block:'nearest',behavior:'instant'});
  }else if(id===selected&&issue&&restoreGenerateFocus&&document.activeElement===document.body){
   $('newsGenerate').focus({preventScroll:true});
  }}}
 });
 return {
  loading({preserve=false}={}){feedState='loading';if(!preserve){clearAnalysis();items=[];selected='';hasMore=false;cacheCapturedAt=null;selectionRevision=null;}renderList();renderReport();},
  failed(){feedState='error';renderList();renderReport();},
  show(data,{append=false,refresh=false}={}){const hadItems=items.length>0,priorRevision=selectionRevision,priorFixture=feedFixture,priorBinding=selectionBinding;
   feedState=newsResponseState(data);
   if(feedState==='unknown'){renderList();renderReport();return false;}
   // Once advertised by this feed, missing fields cannot downgrade its contract.
   if(data.analysisBinding!==undefined)selectionBinding=data.analysisBinding;
   for(const row of data.items||[])if(selectionReady(row))invalidNews.delete(row.id);else invalidNews.add(row.id);
   feedFixture=data?.fixture===true;
   if(feedState==='demo'){clearAnalysis();items=[];selected='';hasMore=false;cacheCapturedAt=null;selectionRevision=null;renderList();renderReport();return true;}
   cacheCapturedAt=data?.capturedAt||null;
   if(!append&&!refresh)$('marketNewsList').scrollTop=0;
   const next=append||refresh?[...new Map([...items,...(data.items||[])].map(row=>[row.id,row])).values()]:data.items||[];
   items=next.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)||a.id.localeCompare(b.id));
   if(!refresh||!hadItems)hasMore=data.hasMore===true;
   const current=items.find(item=>item.id===selected);
   for(const [id,title,values] of [['newsCompany','Компании',items.flatMap(row=>(row.relations||[]).map(company=>company.ticker))],['newsSource','Источники',items.map(row=>row.source)]]) {
    const control=$(id);if(!control)continue;const previous=control.value;
    for(const value of [...values,previous].filter(Boolean))filterChoices[id].add(value);
    const choices=[...filterChoices[id]].sort((a,b)=>a.localeCompare(b,'ru'));
    control.innerHTML='<option value="">'+title+'</option>'+choices.map(value=>'<option value="'+esc(value)+'">'+esc(value)+'</option>').join('');control.value=choices.includes(previous)?previous:'';
   }
   if(!current||priorRevision!==newsContextRevision(current)||priorFixture!==feedFixture||priorBinding!==selectionBinding){clearAnalysis();selected=current?.id||filtered()[0]?.id||'';}
   selectionRevision=newsContextRevision(items.find(row=>row.id===selected));
   if(selected&&(invalidNews.has(selected)||!selectionReady(items.find(row=>row.id===selected))))feedState='stale';
   renderList();renderReport();return feedState!=='error';},
  reset(){clearAnalysis();invalidNews.clear();for(const choices of Object.values(filterChoices))choices.clear();items=[];selected='';hasMore=false;cacheCapturedAt=null;selectionRevision=null;selectionBinding=undefined;feedState='idle';renderList();renderReport();}
 };
}
