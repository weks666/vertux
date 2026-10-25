import {decimalNanos} from './number-format.js';
import {formatObservedRiskRate as rate,formatObservedRiskDuration as duration} from './observed-nav-risk-ui.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const date=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'})+' мск':'Нет данных';
const range=(from,to)=>date(from)+' — '+date(to),PAGE_SIZE=20;
const labels={idle:'Объяснение готового расчёта риска, без обращения к AI-модели.',closed:'Объяснение закрыто. При повторном открытии данные проверяются заново.',loading:'Проверяем сохранённый расчёт…',ready:'Объяснение готово. Свежесть относительно текущего источника не подтверждена.','evidence-loading':'Перепроверяем подтверждение…',forbidden:'Доступ изменился. Объяснение скрыто до обновления доступа.','refresh-required':'Данные изменились. Обновите экран перед новым объяснением.',unavailable:'Объяснение доступно в приложении для одного счёта и подтверждённого периода.',disposed:'Объяснение закрыто.'};
export function createLocalObservedRiskExplanationUi({host,controller,onInvalidateEvidence=()=>{}}){
 let state,packet=null,pages={points:0,episodes:0},rendered='',disposed=false;
 host.classList.add('local-risk-explanation');
 host.innerHTML='<div class="local-risk-controls"><button type="button" class="button" data-risk-explain>Объяснить риск</button><button type="button" class="button" data-risk-close hidden>Закрыть объяснение</button></div><p class="local-risk-status" role="status"></p><div class="local-risk-report" hidden></div>';
 const explain=host.querySelector('[data-risk-explain]'),close=host.querySelector('[data-risk-close]'),status=host.querySelector('[role=status]'),reportHost=host.querySelector('.local-risk-report');
 const busy=()=>['loading','evidence-loading'].includes(state?.status),disabled=()=>!['idle','closed','ready','error'].includes(state?.status);
 const button=(ref,label)=>`<button type="button" class="button" data-risk-evidence="${esc(ref)}">${label}</button>`;
 function draw(){
  const r=state.report,open=new Set([...reportHost.querySelectorAll('details[open]')].map(row=>row.dataset.riskList));
  const list=(key,title,renderRow)=>{const rows=r[key],page=pages[key],start=page*PAGE_SIZE;if(!rows.length)return '';
   return `<details data-risk-list="${key}" ${open.has(key)?'open':''}><summary>${title} · ${rows.length}</summary><ol start="${start+1}">${rows.slice(start,start+PAGE_SIZE).map((row,index)=>`<li data-risk-report-${key}="${start+index}">${renderRow(row)}</li>`).join('')}</ol>${rows.length>PAGE_SIZE?`<nav class="local-risk-pager" aria-label="Страницы ${key==='points'?'наблюдений':'периодов'} объяснения"><span role="status">${start+1}–${Math.min(start+PAGE_SIZE,rows.length)} из ${rows.length}</span>${[-1,1].map(step=>`<button class="button" type="button" data-risk-page="${key}:${step}" ${step<0?page===0?'disabled':'':start+PAGE_SIZE>=rows.length?'disabled':''}>${step<0?'Назад':'Дальше'}</button>`).join('')}</nav>`:''}</details>`;
  };
  reportHost.innerHTML=`<header><h4>${esc(r.title)}</h4><small>${esc(r.modeLabel)}</small></header><p>${esc(state.accountLabel)} · ${r.source.dataMode==='synthetic'?'Учебные данные':'Оценка по сохранённым данным'}</p><dl class="nav-risk-facts"><div><dt>Наблюдаемый интервал</dt><dd>${esc(range(r.period.observedFrom,r.period.observedTo))}</dd></div><div><dt>Выбранный период</dt><dd>${esc(range(r.period.requestedFrom,r.period.requestedTo))}</dd></div></dl>${r.period.partialPeriod?'<p class="nav-risk-partial">Наблюдения покрывают только часть выбранного периода.</p>':''}
   <div class="local-risk-grid">${r.metrics.map(m=>`<article data-explained-risk="${m.key}"><h5>${esc(m.title)}</h5><p>${esc(m.question)}</p><strong class="local-risk-value">${esc(rate(m.value))}</strong>${m.key==='volatility'?'<p>Без годового пересчёта · интервал '+esc(duration(m.intervalMs))+' · наблюдений доходности: '+m.n+'</p>':''}${m.reason?'<p>'+esc(m.reason)+'</p>':''}${button('risk-metric-'+m.key,'Проверить показатель')}${m.key==='maxDrawdown'&&r.deepestEpisodeRef?button(r.deepestEpisodeRef,'Открыть период просадки'):''}${m.key==='currentDrawdown'&&r.points.length?button(r.points.at(-1).evidenceRef,'Открыть последнее наблюдение'):''}</article>`).join('')}</div>
   <p>Сохранённых оценок: ${r.coverage.observationCount}. Интервалов: ${r.coverage.intervalCount}. Внешних событий: ${r.coverage.externalFlowCount??'не подтверждено'}.</p>${button('risk-method','Проверить метод и ограничения')}
   ${list('points','Сохранённые наблюдения',row=>`<strong>${esc(date(row.at))}</strong><p>${esc(decimalNanos(row.navNanos,{digits:9}))} ₽ · просадка ${esc(rate(row.drawdown))}</p>${button(row.evidenceRef,'Открыть это наблюдение')}`)}
   ${list('episodes','Периоды ниже пика',row=>`<strong>Просадка ${esc(rate(row.depth))}</strong><p>Пик: ${esc(date(row.peakAt))}. Дно: ${esc(date(row.troughAt))}.</p><p>${row.unrecovered?'Восстановление не наблюдалось до '+esc(date(r.period.observedTo)):'Восстановление: '+esc(date(row.recoveryAt))}. Длительность: ${esc(duration(row.durationMs))}.</p>${button(row.evidenceRef,'Открыть этот период')}`)}
   ${r.coverage.blockers.length?'<ul>'+r.coverage.blockers.map(row=>'<li>'+esc(row.reason)+'</li>').join('')+'</ul>':''}<ul class="local-risk-limitations">${r.limitations.map(value=>'<li>'+esc(value)+'</li>').join('')}</ul>`;
  rendered=JSON.stringify(pages);
 }
 function render(next){
  if(disposed)return;state=next;host.dataset.state=next.status;explain.setAttribute('aria-disabled',String(disabled()));close.hidden=!busy()&&!next.report;
  status.textContent=next.status==='error'?(next.error==='expired'?'Срок хранения объяснения завершился. Сформируйте его заново.':next.error==='limit'?'Расчёт превышает предел объяснения. Исходные наблюдения доступны ниже.':'Не удалось подтвердить объяснение. Повторите после обновления данных.'):(labels[next.status]||labels.unavailable);
  if(!next.report){if(packet)onInvalidateEvidence();packet=null;pages={points:0,episodes:0};rendered='';reportHost.replaceChildren();reportHost.hidden=true;return;}
  const changed=packet!==next.report.packetId;if(changed){onInvalidateEvidence();packet=next.report.packetId;pages={points:0,episodes:0};rendered='';}
  if(changed||rendered!==JSON.stringify(pages))draw();reportHost.hidden=false;
  for(const control of reportHost.querySelectorAll('[data-risk-evidence],[data-risk-page]'))control.setAttribute('aria-disabled',String(busy()));
 }
 function click(event){
  const control=event.target.closest('button');if(!control||!host.contains(control)||control.disabled)return;
  if(control.hasAttribute('data-risk-close')){controller.close();if(controller.getState().status==='closed'&&host.isConnected)explain.focus({preventScroll:true});return;}
  if(control.hasAttribute('data-risk-explain')){if(!disabled())void controller.explain();return;}
  if(busy()||state?.status!=='ready')return;
  if(control.hasAttribute('data-risk-page')){const [key,step]=control.dataset.riskPage.split(':');if(!Object.hasOwn(pages,key))return;pages[key]+=Number(step);draw();(reportHost.querySelector(`[data-risk-page="${key}:${step}"]:not(:disabled)`)||reportHost.querySelector(`[data-risk-page^="${key}:"]:not(:disabled)`)||reportHost.querySelector(`[data-risk-list="${key}"]>summary`))?.focus({preventScroll:true});return;}
  if(control.hasAttribute('data-risk-evidence')){const origin=packet;void controller.openEvidence(control.dataset.riskEvidence,{returnFocus:({isCurrent})=>{
   if(disposed||packet!==origin||state?.status!=='ready'||!isCurrent())return false;
   const target=control.isConnected?control:explain;target.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
   if(!isCurrent())return false;target.focus({preventScroll:true});return isCurrent();
  }});}
 }
 host.addEventListener('click',click);render(controller.getState());
 return Object.freeze({render,dispose(){disposed=true;host.removeEventListener('click',click);onInvalidateEvidence();host.replaceChildren();}});
}
