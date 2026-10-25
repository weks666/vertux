import {decimalNanos} from './number-format.js';
import {canonicalLocalResultJson} from './local-context-json.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const rate=value=>{
 if(!finite(value))return 'Нет данных';if(value===0)return '0 %';const percent=value*100;
 if(Math.abs(percent)<.01)return value<0?'> −0,01 %':'< 0,01 %';
 const rounded=Number(percent.toFixed(2)),approx=Math.abs(percent-rounded)>Math.max(1e-10,Math.abs(percent)*1e-12);
 return (approx?'≈ ':'')+rounded.toLocaleString('ru-RU',{maximumFractionDigits:2}).replace('-','−')+' %';
};
const number=value=>!finite(value)?'Нет данных':value!==0&&Math.abs(value)<.000001?(value<0?'> −0,000001':'< 0,000001'):value.toLocaleString('ru-RU',{maximumFractionDigits:6}).replace('-','−');
const amount=value=>typeof value==='string'&&/^-?\d+$/.test(value)?decimalNanos(value,{digits:9})+' ₽':'Нет данных';
const date=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('ru-RU',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'})+' мск':'Нет данных';
const range=(from,to)=>date(from)+' — '+date(to);
const count=value=>Number.isSafeInteger(value)&&value>=0?String(value):'не подтверждено';
const duration=value=>!finite(value)||value<0?'Нет данных':value===0?'0 с':value<1000?number(value)+' мс':value<60000?number(value/1000)+' с':value<3600000?number(value/60000)+' мин':value<86400000?number(value/3600000)+' ч':number(value/86400000)+' сут.';
const PAGE_SIZE=20;
const metricValue=metric=>metric?.state==='estimated'&&finite(metric.value)?metric.value:null;
export const formatObservedRiskRate=rate,formatObservedRiskDuration=duration;

/** Render the public saved-observation risk DTO; no financial recalculation. */
export function createObservedNavRiskUi({host,explanationHost=null,onSurfaceChange=()=>{}}){
 let current,signature='',scope='',pages={points:0,episodes:0},evidenceSignature='',evidenceEligible=false,surfaceRevision=0,evidenceReturn=null,disposed=false;
 const changedSurface=records=>{const count=records.filter(row=>row.type==='attributes'&&row.attributeName==='open'&&row.target.classList.contains('nav-risk-disclosure')).length;if(count){surfaceRevision+=count;onSurfaceChange();}};
 const observer=new MutationObserver(changedSurface);if(host)observer.observe(host,{subtree:true,attributes:true,attributeFilter:['open']});
 const drain=()=>changedSurface(observer.takeRecords());
 function pager(key,rows){const page=pages[key],start=page*PAGE_SIZE;return rows.length>PAGE_SIZE?`<nav class="nav-risk-pagination" aria-label="${key==='points'?'Страницы сохранённых оценок':'Страницы периодов просадки'}"><span role="status">${start+1}–${Math.min(start+PAGE_SIZE,rows.length)} из ${rows.length}</span>${[-1,1].map(step=>`<button type="button" data-nav-risk-page="${key}:${step}" ${step<0?page===0?'disabled':'':start+PAGE_SIZE>=rows.length?'disabled':''}>${step<0?'Назад':'Дальше'}</button>`).join('')}</nav>`:'';}
 const facts=rows=>'<dl class="nav-risk-facts">'+rows.map(([label,value])=>'<div><dt>'+esc(label)+'</dt><dd>'+esc(value)+'</dd></div>').join('')+'</dl>';
 function plot(points){
  if(!points.length)return '';
  const width=720,height=180,left=12,top=16,span=Date.parse(points.at(-1).at)-Date.parse(points[0].at),deepest=Math.max(...points.map(row=>Math.abs(row.drawdown))),scale=deepest||1;
  const coordinates=points.map(row=>({x:left+(Date.parse(row.at)-Date.parse(points[0].at))/span*(width-left*2),y:top+Math.abs(row.drawdown)/scale*(height-top*2)}));
  const path=coordinates.map((point,index)=>(index?'L':'M')+point.x.toFixed(3)+','+point.y.toFixed(3)).join(' ');
  return `<figure class="nav-risk-chart"><figcaption>Просадка на сохранённых точках · %</figcaption><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Наблюдаемая просадка. Точные даты и значения доступны в таблице сохранённых оценок."><line x1="${left}" y1="${top}" x2="${width-left}" y2="${top}" class="nav-risk-zero"/><path d="${path}" class="nav-risk-line"/>${coordinates.map(point=>`<circle cx="${point.x.toFixed(3)}" cy="${point.y.toFixed(3)}" r="2"/>`).join('')}</svg><div class="nav-risk-chart-labels"><span>Пик: 0 %</span><span>Нижняя отметка: ${esc(rate(-deepest))}</span></div><p>Пунктир соединяет наблюдения для чтения графика. Промежуточные оценки неизвестны; между точками просадка могла быть глубже.</p></figure>`;
 }
 function update(data){
  if(!host||disposed)return;drain();current=data;
  const dto=data?.portfolio?.observedNavRisk,accounts=data?.clientProduct?.portfolios||[],valid=dto?.contractVersion==='observed-nav-risk-v1';
  const ids=Array.isArray(dto?.scope?.portfolioIds)?dto.scope.portfolioIds:[],account=accounts.length===1&&ids.length===1&&accounts[0].id===ids[0]?accounts[0]:null;
  const eligible=valid&&dto.scope?.kind==='single-account'&&account&&dto.currency==='RUB',multi=accounts.length>1||valid&&dto.scope?.kind==='multi-account';
  let nextEvidence='';try{if(eligible)nextEvidence=canonicalLocalResultJson(dto);}catch{}
  evidenceEligible=Boolean(nextEvidence);if(nextEvidence!==evidenceSignature){evidenceSignature=nextEvidence;clearEvidenceReturn();}
  const nextScope=JSON.stringify([ids,accounts.map(row=>row.id),dto?.period?.requestedFrom,dto?.period?.requestedTo]);const changed=nextScope!==scope;
  if(changed)pages={points:0,episodes:0};
  const available=eligible&&dto.state==='estimated',points=available&&Array.isArray(dto.points)?dto.points:[],episodes=available&&Array.isArray(dto.episodes)?dto.episodes:[];
  for(const [key,rows]of [['points',points],['episodes',episodes]])pages[key]=Math.max(0,Math.min(pages[key],Math.max(0,Math.ceil(rows.length/PAGE_SIZE)-1)));
  const next=JSON.stringify([dto,accounts.map(row=>[row.id,row.label]),pages]);if(signature===next)return;
  const active=host.contains(document.activeElement)?document.activeElement:null,focusedPage=active?.dataset.navRiskPage,focusedScroll=active?.dataset.navRiskScroll,focusedDetails=active?.tagName==='SUMMARY'?active.parentElement.dataset.navRiskDetails:null;
  const extensionFocus=active&&explanationHost?.contains(active);
  const scrollLeft=changed?0:host.querySelector('[data-nav-risk-scroll="points"]')?.scrollLeft||0;
  const open=changed?new Set():new Set([...host.querySelectorAll('details[open]')].map(row=>row.dataset.navRiskDetails));
  scope=nextScope;signature=next;host.dataset.state=available?'estimated':'unavailable';
  const outer=(key,title,body)=>`<details data-nav-risk-details="${key}" ${open.has(key)?'open':''}><summary>${title}</summary>${body}</details>`;
  const metrics=[['maxDrawdown','Максимальная наблюдаемая просадка'],['currentDrawdown','Просадка на конец наблюдений'],['volatility','Разброс доходности за интервал']];
  const blocked=multi?'Выберите один счёт в поле «Счёт портфеля». Наблюдения разных счетов не объединяются.':!valid?'Для выбранного счёта и периода данные риска пока недоступны.':!eligible?'Данные риска не соответствуют выбранному счёту или валюте.':null;
  let body=blocked?'<p>'+esc(blocked)+'</p>':`   <dl class="nav-risk-metrics">${metrics.map(([key,label])=>{const item=dto.metrics?.[key],value=available?metricValue(item):null;return `<div data-nav-risk-metric="${key}"><dt>${label}</dt><dd title="${finite(value)?esc(String(value*100)+' %'):''}">${esc(rate(value))}</dd>${key==='volatility'?'<small>Без годового пересчёта · интервал '+esc(duration(item?.intervalMs))+' · наблюдений доходности: '+count(item?.n)+'</small>':''}${value===null&&item?.reason?'<p>'+esc(item.reason)+'</p>':''}</div>`;}).join('')}</dl><p class="nav-risk-evidence">${dto.evidence?.dataMode==='synthetic'?'Учебный пример на синтетических данных.':'По локально сохранённым наблюдениям.'} Время состояния у брокера не подтверждено.</p>${facts([['Выбранный период',range(dto.period?.requestedFrom,dto.period?.requestedTo)],['Наблюдаемый интервал',range(dto.period?.observedFrom,dto.period?.observedTo)]])}${dto.period?.partialPeriod===true?'<p class="nav-risk-partial">Показатели относятся только к наблюдаемому интервалу, который покрывает часть выбранного периода.</p>'+facts([['До первого наблюдения',duration(dto.period.startGapMs)],['От последнего наблюдения до конца периода',duration(dto.period.endLagMs)]]):''}

   <p class="nav-risk-counts">Сохранённых оценок: ${count(dto.coverage?.observationCount)}. Интервалов: ${count(dto.coverage?.intervalCount)}. Внешних денежных событий: ${count(dto.coverage?.externalFlowCount)}.</p>${Array.isArray(dto.coverage?.blockers)&&dto.coverage.blockers.length?'<ul class="nav-risk-blockers">'+[...new Set(dto.coverage.blockers.map(row=>row.reason).filter(Boolean))].map(reason=>'<li>'+esc(reason)+'</li>').join('')+'</ul>':''}`;
  if(available){
   const deepest=episodes.find(row=>row.depth===dto.metrics.maxDrawdown.value);
   body+=deepest?`<div class="nav-risk-deepest" ${episodes.length===1?'data-nav-risk-episode="0"':''}><h4>Период максимальной наблюдаемой просадки</h4>${facts([['Последний пик перед падением',date(deepest.peakAt)],['Первое наблюдаемое дно',date(deepest.troughAt)],['Восстановление',deepest.unrecovered?'Не наблюдалось до '+date(dto.period.observedTo):date(deepest.recoveryAt)],['От пика до восстановления или конца наблюдений',duration(deepest.durationMs)]])}</div>`:'<p class="nav-risk-flat">На сохранённых точках падений ниже прежнего пика не наблюдалось. Это не означает отсутствие риска между наблюдениями.</p>';
   body+=plot(points);
   const pointSlice=points.slice(pages.points*PAGE_SIZE,(pages.points+1)*PAGE_SIZE);
   body+=outer('points','Сохранённые оценки · '+points.length,`<div class="nav-risk-table-scroll" data-nav-risk-scroll="points" tabindex="0" aria-label="Сохранённые оценки; доступна горизонтальная прокрутка"><table><thead><tr><th>Время наблюдения · мск</th><th>Стоимость · RUB</th><th>Индекс · начало = 1</th><th>Просадка от пика</th></tr></thead><tbody>${pointSlice.map((row,index)=>`<tr data-nav-risk-point="${pages.points*PAGE_SIZE+index}"><td>${esc(date(row.at))}</td><td>${esc(amount(row.navNanos))}</td><td title="${esc(row.index)}">${esc(number(row.index))}</td><td title="${esc(String(row.drawdown*100)+' %')}">${esc(rate(row.drawdown))}</td></tr>`).join('')}</tbody></table></div>${pager('points',points)}`);
   if(episodes.length>1)body+=outer('episodes','Все периоды ниже пика · '+episodes.length,'<ol class="nav-risk-episodes">'+episodes.slice(pages.episodes*PAGE_SIZE,(pages.episodes+1)*PAGE_SIZE).map((row,index)=>'<li data-nav-risk-episode="'+(pages.episodes*PAGE_SIZE+index)+'">'+facts([['Глубина',rate(row.depth)],['Пик',date(row.peakAt)],['Дно',date(row.troughAt)],['Восстановление',row.unrecovered?'Не наблюдалось до конца интервала':date(row.recoveryAt)],['Длительность',duration(row.durationMs)]])+'</li>').join('')+'</ol>'+pager('episodes',episodes));
  }
  if(eligible)body+=outer('method','Метод, источник и ограничения',`<p>Индекс = стоимость / первая стоимость. Просадка = стоимость / наибольшая стоимость до этой точки − 1.</p><p>Разброс = выборочное стандартное отклонение изменений стоимости между соседними наблюдениями: √(Σ(r − среднее r)² / (n − 1)).</p><ul>${Object.values(dto.policies||{}).map(text=>'<li>'+esc(text)+'</li>').join('')}</ul>`);
  host.innerHTML=`<details class="nav-risk-disclosure" data-nav-risk-details="main" ${open.has('main')?'open':''}><summary><span><strong>Риск по сохранённым оценкам</strong><small>Наблюдаемая просадка и разброс${eligible&&account.label?' · '+esc(account.label):''}</small></span><span role="status">${available?'Оценка по наблюдениям':'Расчёт недоступен'}</span></summary><div class="nav-risk-body">${body}</div></details>`;
  if(explanationHost){const anchor=host.querySelector('.nav-risk-metrics');if(anchor)anchor.after(explanationHost);else host.querySelector('.nav-risk-body')?.prepend(explanationHost);}
  const main=host.querySelector('[data-nav-risk-details="main"]>summary');
  const scroller=host.querySelector('[data-nav-risk-scroll="points"]');if(scroller&&!changed)scroller.scrollLeft=scrollLeft;
  let target;
  if(active&&(changed||!open.has('main')))target=main;
  else if(focusedScroll)target=scroller||main;
  else if(focusedPage){const group=focusedPage.split(':')[0];target=host.querySelector(`[data-nav-risk-page="${CSS.escape(focusedPage)}"]:not(:disabled)`)||host.querySelector(`[data-nav-risk-page^="${group}:"]:not(:disabled)`)||host.querySelector(`[data-nav-risk-details="${group}"]>summary`)||main;}
  else if(focusedDetails)target=host.querySelector(`[data-nav-risk-details="${CSS.escape(focusedDetails)}"]>summary`)||main;
  else if(extensionFocus&&active.isConnected)target=active;
  target?.focus({preventScroll:true});
  // A shorter page or collapsed scope can move the restored control offscreen.
  // Reveal only our retained focus; background updates never move outside focus.
  if(target&&(changed||focusedPage||target===main&&(focusedScroll||focusedDetails)))target.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
 }
 function click(event){
  const back=event.target.closest('[data-risk-evidence-return]');if(back&&host.contains(back)){const action=evidenceReturn,state=getEvidenceState();if(action&&state.eligible&&state.signature===action.expectedSignature)action.returnFocus?.();return;}
  const button=event.target.closest('[data-nav-risk-page]');if(!button||button.disabled)return;const [key,step]=button.dataset.navRiskPage.split(':');if(!Object.hasOwn(pages,key))return;pages[key]+=Number(step);signature='';update(current);
 }
 host?.addEventListener('click',click);
 function getEvidenceState(){drain();return {signature:evidenceSignature,eligible:evidenceEligible,surfaceRevision,open:Boolean(host?.querySelector('.nav-risk-disclosure')?.open)};}
 function clearEvidenceReturn(){evidenceReturn=null;host?.querySelectorAll('[data-risk-evidence-return]').forEach(node=>node.remove());host?.querySelectorAll('[data-risk-highlight]').forEach(node=>node.removeAttribute('data-risk-highlight'));}
 function revealEvidence({kind,metricKey,pointIndex,episodeIndex,expectedSignature,returnFocus,isCurrent}={}){
  const guarded=()=>!disposed&&typeof isCurrent==='function'&&isCurrent()===true&&getEvidenceState().eligible&&evidenceSignature===expectedSignature;
  if(!guarded()||!['risk-metric','risk-point','risk-episode','risk-method'].includes(kind))return false;
  const dto=current.portfolio.observedNavRisk;
  if(kind==='risk-metric'&&(!['maxDrawdown','currentDrawdown','volatility'].includes(metricKey)||pointIndex!==null||episodeIndex!==null)
   ||kind==='risk-point'&&(metricKey!==null||episodeIndex!==null||!Number.isSafeInteger(pointIndex)||pointIndex<0||pointIndex>=dto.points.length)
   ||kind==='risk-episode'&&(metricKey!==null||pointIndex!==null||!Number.isSafeInteger(episodeIndex)||episodeIndex<0||episodeIndex>=dto.episodes.length)
   ||kind==='risk-method'&&(metricKey!==null||pointIndex!==null||episodeIndex!==null))return false;
  if(kind==='risk-point'||kind==='risk-episode'){pages[kind==='risk-point'?'points':'episodes']=Math.floor((pointIndex??episodeIndex)/PAGE_SIZE);signature='';update(current);}
  if(!guarded())return false;const main=host.querySelector('.nav-risk-disclosure');if(!main?.open)return false;
  const group=kind==='risk-point'?'points':kind==='risk-episode'&&dto.episodes.length>1?'episodes':kind==='risk-method'?'method':null;
  const details=group?host.querySelector(`[data-nav-risk-details="${group}"]`):null;if(group&&!details)return false;if(details)details.open=true;
  const target=kind==='risk-metric'?host.querySelector(`[data-nav-risk-metric="${metricKey}"]`):kind==='risk-point'?host.querySelector(`[data-nav-risk-point="${pointIndex}"]`):kind==='risk-episode'?host.querySelector(`[data-nav-risk-episode="${episodeIndex}"]`):details.querySelector('summary');
  if(!target||!guarded())return false;clearEvidenceReturn();
  const focusTarget=kind==='risk-point'?target.cells[0]:target,back=document.createElement('button');back.type='button';back.className='button secondary';back.dataset.riskEvidenceReturn='';back.textContent='Вернуться к объяснению';
  (kind==='risk-method'?details:focusTarget).append(back);evidenceReturn={expectedSignature,returnFocus};target.dataset.riskHighlight='';focusTarget.tabIndex=-1;
  focusTarget.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});if(!guarded())return false;focusTarget.focus({preventScroll:true});return guarded();
 }
 return {update,getEvidenceState,revealEvidence,clearEvidenceReturn,dispose(){disposed=true;observer.disconnect();host?.removeEventListener('click',click);clearEvidenceReturn();}};
}
