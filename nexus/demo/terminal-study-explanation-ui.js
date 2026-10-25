import {buildTerminalStudyExplanation} from './terminal-study-explanation.js';
import {renderContextEvidence} from './context-evidence.js';
import {buildTerminalContextEvidence} from './context-evidence-adapters.js';

const esc=value=>String(value??'Не подтверждено').replace(/[&<>"']/gu,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const number=value=>Number.isFinite(value)?new Intl.NumberFormat('ru-RU',{maximumSignificantDigits:12}).format(value):'—';
const completion={complete:'Завершена',incomplete:'Не завершена',unknown:'Не подтверждено'};
const phase={baseline:'Исходная цена',seed:'Начальное значение',warmup:'Прогрев',calculated:'На графике'};

export function createTerminalStudyExplanationUi({main,button,getSnapshot}){
 // Retain the original DOM hooks for existing native/demo integrations.
 const host=document.createElement('section');host.id='terminalSmaExplanation';host.className='terminal-series-passport terminal-sma-explanation';host.hidden=true;host.setAttribute('role','dialog');main.append(host);
 let selected=null,scope=null,report=null,anchor=button,disposed=false,page=0,capturedInput=null,capturedAt=null,pointTime=null,originView=null;
 const key=()=>{try{const s=getSnapshot(true),study=s?.view?.studies?.find(row=>row.id===selected);return JSON.stringify([s?.ownerEpoch,s?.paneId,s?.instrument?.instrumentUid,s?.interval,s?.displayResolution,s?.historyDate,
  s?.view?.type,s?.view?.timezone,s?.view?.dividendAdjusted,s?.replay?.active,s?.replay?.time,study?.id,study?.type,study?.period,study?.visible]);}catch{return null;}};
 const place=()=>{if(host.hidden)return;const rect=anchor.getBoundingClientRect();host.style.left=Math.max(8,Math.min(rect.left,innerWidth-host.offsetWidth-8))+'px';host.style.top=Math.max(8,Math.min(rect.bottom+6,innerHeight-host.offsetHeight-8))+'px';};
 const observer=new ResizeObserver(place);observer.observe(host);
 function close(focus=false){if(host.hidden)return;host.hidden=true;host.replaceChildren();report=null;scope=null;selected=null;capturedInput=null;capturedAt=null;pointTime=null;originView=null;anchor.setAttribute('aria-expanded','false');if(focus&&anchor.isConnected&&anchor.getClientRects().length)anchor.focus({preventScroll:true});}
 const date=value=>new Intl.DateTimeFormat('ru-RU',{timeZone:report?.series.method.timezone||'Europe/Moscow',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
 const evidenceRows=()=>report?.study?.type==='sma'?report.window:report?.trace||[];
 function evidence(){
  const target=host.querySelector('[data-sma-rows]'),rows=evidenceRows();if(!target||!rows.length)return;
  const size=25,total=rows.length,start=page*size,type=report.study.type;
  target.innerHTML=rows.slice(start,start+size).map(row=>{
   const extra=type==='ema'?[number(row.value),phase[row.phase]+(row.phase==='seed'?(row.plotted?' · на графике':' · прогрев'):'')]:
    type==='rsi'?[number(row.change),number(row.averageGain),number(row.averageLoss),number(row.value),phase[row.phase]+(row.phase==='seed'?' · на графике':'')]:[];
   const available=Date.parse(row.at)>=Date.parse(report.history.firstPlottedAt),current=row.at===report.pointAt;
   const action=current?'<span>Текущая точка</span>':available?'<button type="button" data-study-point="'+esc(row.at)+'" aria-label="Разобрать точку '+esc(date(row.at))+'">Разобрать точку</button>':'<span>Прогрев</span>';
   return '<tr>'+[date(row.at),String(row.close).replace('.',','),...extra,completion[row.completion]].map(value=>'<td>'+esc(value)+'</td>').join('')+'<td class="study-point-action">'+action+'</td></tr>';
  }).join('');
  host.querySelector('[data-sma-page]').textContent=`${type==='sma'?'Цены':'Шаги'} ${start+1}–${Math.min(start+size,total)} из ${total}`;
  host.querySelector('[data-sma-prev]').disabled=page===0;host.querySelector('[data-sma-next]').disabled=start+size>=total;
  for(const selector of ['[data-study-first]','[data-study-last]']){const node=host.querySelector(selector);if(node)node.disabled=selector.includes('first')?page===0:start+size>=total;}
 }
 function equation(){
  const r=report,s=r.lastStep,n=number;
  if(r.study.type==='sma')return `${n(r.windowSum)} ÷ ${r.study.period} ≈ ${n(r.value)}`;
  if(r.study.type==='ema')return s.previousValue===null?`Начальная EMA = ${n(s.close)}`:`${n(s.previousValue)} + ${n(r.alpha)} × (${n(s.close)} − ${n(s.previousValue)}) ≈ ${n(r.value)}`;
  if(s.averageLoss===0)return s.averageGain===0?'Средние рост и падение равны 0 → RSI = 50':'Среднее падение равно 0, рост больше 0 → RSI = 100';
  return `100 − 100 ÷ (1 + ${n(s.averageGain)} ÷ ${n(s.averageLoss)}) ≈ ${n(r.value)}`;
 }
 function initialization(){
  const r=report,period=r.study.period,n=number;if(r.study.type==='sma')return '';
  const seed=r.seed,step=r.lastStep;
  const body=r.study.type==='ema'?`<p>Начальная EMA равна первой загруженной цене закрытия: ${esc(n(seed.value))} (${esc(date(seed.at))}).</p><p>α = 2 ÷ (N + 1) = ${esc(n(r.alpha))}. На каждом следующем шаге: EMA = предыдущая EMA + α × (закрытие − предыдущая EMA).</p><p>Первые ${period-1} точек скрыты как прогрев. Первая точка на графике появляется после ${period} цен.</p>`:
   `<p>Изменение = текущее закрытие − предыдущее; рост = max(изменение, 0), падение = max(−изменение, 0).</p><p>Начальные средние — суммы ростов и падений первых ${period} изменений, делённые на ${period}. Требуется цен закрытия: ${period+1}. Начальные значения: рост ${esc(n(seed.averageGain))}, падение ${esc(n(seed.averageLoss))} (${esc(date(seed.at))}).</p><p>Далее используется сглаживание Уайлдера: новое среднее = (предыдущее среднее × (N − 1) + текущий рост или падение) ÷ N.</p>
    ${step.previousAverageGain===null?'<p>Последняя точка совпадает с начальной; последующих шагов ещё нет.</p>':`<p>Последний шаг: рост (${esc(n(step.previousAverageGain))} × ${period-1} + ${esc(n(step.gain))}) ÷ ${period} ≈ ${esc(n(step.averageGain))}; падение (${esc(n(step.previousAverageLoss))} × ${period-1} + ${esc(n(step.loss))}) ÷ ${period} ≈ ${esc(n(step.averageLoss))}.</p>`}
    <p>Если средние рост и падение равны нулю, RSI = 50. При нулевом падении и положительном росте RSI = 100; при нулевом росте и положительном падении RSI = 0.</p>`;
  return `<details data-study-method><summary>Начальное значение и прогрев</summary>${body}<p>Первая точка на графике: ${esc(date(r.history.firstPlottedAt))}. Прогрев здесь означает порог показа, а не подтверждённую сходимость или полноту истории. Добавление более ранних свечей может изменить начальное состояние и итог.</p></details>`;
 }
 function render(focus=true,{capture=true,restore=null}={}){
  const outdated=!capture&&host.dataset.outdated==='true';
  if(capture){capturedInput=null;capturedAt=new Date().toISOString();pointTime=null;originView=null;scope=key();}
  try{
   if(capture)capturedInput=structuredClone(getSnapshot(false));
   report=buildTerminalStudyExplanation(capturedInput,selected,{pointTime});
  }catch{report=null;}
  page=restore?.page||0;if(!outdated)host.removeAttribute('data-outdated');host.dataset.state=report?.state||'unavailable';
  const series=report?.series,ready=report?.state==='ready',type=report?.study?.type,label=type?.toUpperCase(),recursive=ready&&type!=='sma';
  host.dataset.study=type||'';
  const title=label?`Как рассчитан${type==='rsi'?'':'а'} ${label} ${report.study.period}`:'Как рассчитан индикатор';host.setAttribute('aria-label',title);
  const fact=(label,value)=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
  const columns=['Начало свечи','Цена закрытия',...(type==='ema'?['EMA после шага','Этап']:type==='rsi'?['Изменение','Средний рост','Среднее падение','RSI','Этап']:[]),'Завершённость','Проверка'];
  host.innerHTML=`<header><h3 tabindex="-1">${esc(title)}</h3><button type="button" data-sma-close>Закрыть</button></header>
   <p data-sma-status role="status">${outdated?'Данные графика могли измениться. Показан прежний снимок; нажмите «Обновить расчёт» для текущего ряда.':'Снимок при открытии · '+esc(date(capturedAt))+'. Локальный расчёт без AI-модели.'}</p><button type="button" data-sma-refresh>Обновить расчёт</button>
   ${pointTime!==null?`<div class="study-point-selection"><p data-study-selected-at="${esc(new Date(pointTime*1000).toISOString())}">Выбрана свеча: ${esc(date(new Date(pointTime*1000).toISOString()))}. Более поздние цены не использованы.</p><button type="button" data-study-point-return>Вернуться к исходному расчёту</button>${series?.method.dividendAdjusted?'<p data-study-point-adjustment>Цены содержат поправку текущего снимка. Корпоративные действия после выбранной свечи могут входить в эту поправку; её доступность на ту дату не подтверждена.</p>':''}<p>«Обновить расчёт» откроет последнюю точку нового снимка.</p></div>`:''}
   ${series?`<p><strong>${esc(series.instrument.ticker)}</strong> · ${esc(series.instrument.name)} · ${esc(series.method.displayLabel)} · ${esc(series.method.timezone)}</p><p>${series.source.dataMode==='synthetic'?'Учебные данные':series.source.dataMode==='public-crypto'?'Публичная серия криптобиржи':'Загруженная рыночная серия'}</p>`:''}
   ${!ready?`<p data-sma-unavailable>${esc(report?.reason||'Контекст расчёта не подтверждён. Откройте выбранный индикатор заново.')}</p>${report?.history?`<p>Загружено свечей: ${report.history.loadedBars}. Для первой точки нужно: ${report.history.requiredBars}.</p>`:''}`:`<dl class="series-passport-facts">${fact((pointTime===null?'Последняя':'Выбранная')+' точка '+label,number(report.value))}${fact(pointTime===null?'Начало последней свечи':'Начало выбранной свечи',date(report.pointAt))}${fact('Период',report.study.period+' свечей')}${type==='sma'?fact('Сумма выбранных цен',number(report.windowSum)):fact('История расчёта',report.history.loadedBars+' свечей с '+date(report.trace[0].at))}${fact('Единицы',report.unitLabel)}${fact('Цена для расчёта',report.basis==='dividend-adjusted-close'?'Закрытие с поправкой на дивиденды':'Закрытие')}${fact('Источник',series.source.label)}${fact('Получен ответ',series.source.receivedAt?date(series.source.receivedAt):'Не подтверждено')}</dl>
    <p class="sma-equation" data-sma-value="${esc(report.value)}">${esc(equation())}</p>
    <p>${pointTime===null?'Последняя точка загруженного ряда'+(series.replay.active?' до курсора воспроизведения':''):'Точка из зафиксированного среза; проверка не перемещает график или курсор воспроизведения'}. Масштаб цены и видимая часть графика не меняют ${recursive?'историю расчёта':'окно средней'}.</p>
    ${recursive?'<p data-study-history>Использована вся загруженная история. Её начало влияет на результат; последние N цен не заменяют предыдущие шаги.</p>':''}
    ${report.completion.incomplete||report.completion.unknown?`<p data-sma-completion>В ${recursive?'истории расчёта':'окне'}: незавершённых ${report.completion.incomplete}, с неизвестной завершённостью ${report.completion.unknown}.</p>`:'<p data-sma-completion>Все свечи расчёта помечены источником как завершённые.</p>'}
    ${initialization()}
    <details data-sma-evidence><summary>${recursive?'Цены и шаги':'Цены в расчёте'} · ${evidenceRows().length}</summary><div class="sma-evidence-table" tabindex="0" role="region" aria-label="Цены и шаги расчёта; таблицу можно прокручивать"><table><caption>Время начала свечи · ${esc(series.method.timezone)}${type==='rsi'?' · Средние и RSI до завершения прогрева не показаны':type==='ema'?' · EMA на прогреве ещё скрыта на графике':''}</caption><thead><tr>${columns.map(c=>'<th scope="col">'+esc(c)+'</th>').join('')}</tr></thead><tbody data-sma-rows></tbody></table></div><div class="sma-evidence-pages">${recursive?'<button type="button" data-study-first>В начало</button>':''}<button type="button" data-sma-prev>Назад</button><span data-sma-page role="status"></span><button type="button" data-sma-next>Далее</button>${recursive?'<button type="button" data-study-last>В конец</button>':''}</div></details>
    <details><summary>Метод и ограничения</summary>${report.limits.map(line=>'<p>'+esc(line)+'</p>').join('')}${series.method.aggregated?'<p>Использован агрегированный ряд приложения; завершённость его свечей не подтверждена.</p>':''}</details>`}`;
  host.insertAdjacentHTML('beforeend',renderContextEvidence(buildTerminalContextEvidence(report,capturedAt)));
  evidence();host.hidden=false;host.scrollTop=0;anchor.setAttribute('aria-expanded','true');
  if(restore){for(const [selector,open]of [['[data-sma-evidence]',restore.evidenceOpen],['[data-study-method]',restore.methodOpen]]){const node=host.querySelector(selector);if(node)node.open=open===true;}const table=host.querySelector('.sma-evidence-table');if(table)table.scrollLeft=restore.tableScrollLeft||0;host.scrollTop=restore.scrollTop;}
  place();if(focus)host.querySelector('h3').focus({preventScroll:true});
 }
 function inspectPoint(at){
  if(!scope||scope!==key()||getSnapshot(true)?.state!=='ready'){close(false);return;}
  const row=evidenceRows().find(row=>row.at===at);
  if(!row||row.at===report.pointAt||Date.parse(row.at)<Date.parse(report.history.firstPlottedAt))return;
  originView??={page,scrollTop:host.scrollTop,tableScrollLeft:host.querySelector('.sma-evidence-table')?.scrollLeft||0,evidenceOpen:host.querySelector('[data-sma-evidence]')?.open===true,methodOpen:host.querySelector('[data-study-method]')?.open===true,at};
  pointTime=Date.parse(at)/1000;render(true,{capture:false});
 }
 function returnToOrigin(){
  if(!originView||!scope||scope!==key()||getSnapshot(true)?.state!=='ready'){close(false);return;}
  const restore=originView;pointTime=null;originView=null;render(false,{capture:false,restore});
  const target=[...host.querySelectorAll('[data-study-point]')].find(node=>node.dataset.studyPoint===restore.at)||host.querySelector('h3');
  target.focus({preventScroll:true});
 }
 function open(studyId,returnTo=button){if(disposed)return;selected=studyId;anchor=returnTo?.getBoundingClientRect&&returnTo?.focus?returnTo:button;render();}
 function invalidate(){
  if(disposed||host.hidden)return;
  const current=getSnapshot(true);if(!scope||scope!==key()||current?.state!=='ready'){close(false);return;}
  if(host.dataset.outdated==='true')return;host.dataset.outdated='true';host.querySelector('[data-sma-status]').textContent='Данные графика могли измениться. Показан прежний снимок; нажмите «Обновить расчёт» для текущего ряда.';
 }
 const click=event=>{if(event.target.closest('[data-study-point]'))inspectPoint(event.target.closest('[data-study-point]').dataset.studyPoint);else if(event.target.closest('[data-study-point-return]'))returnToOrigin();else if(event.target.closest('[data-sma-close]'))close(true);else if(event.target.closest('[data-sma-refresh]')){render(false);host.querySelector('[data-sma-refresh]').focus({preventScroll:true});}else if(event.target.closest('[data-sma-prev]')){page--;evidence();}else if(event.target.closest('[data-sma-next]')){page++;evidence();}else if(event.target.closest('[data-study-first]')){page=0;evidence();}else if(event.target.closest('[data-study-last]')){page=Math.floor((evidenceRows().length-1)/25);evidence();}};
 const outside=event=>{if(!host.hidden&&!host.contains(event.target)&&!anchor.contains(event.target))close(false);};
 const escape=event=>{if(!host.hidden&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close(true);}};
 host.addEventListener('click',click);host.addEventListener('toggle',place,true);document.addEventListener('pointerdown',outside);document.addEventListener('focusin',outside);document.addEventListener('keydown',escape,true);window.addEventListener('resize',place);
 return Object.freeze({open,close,invalidate,dispose(){if(disposed)return;disposed=true;close(false);observer.disconnect();host.removeEventListener('click',click);host.removeEventListener('toggle',place,true);document.removeEventListener('pointerdown',outside);document.removeEventListener('focusin',outside);document.removeEventListener('keydown',escape,true);window.removeEventListener('resize',place);host.remove();}});
}
