import { decimalNanos } from './number-format.js';
import { formatPerformanceMethodRate as rate } from './performance-methods-ui.js';
const esc=value=>String(value??'').replace(/[&<>"']/gu,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const date=value=>value?new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',dateStyle:'short',timeStyle:'medium'}).format(new Date(value))+' мск':'Нет данных';
const range=(from,to)=>date(from)+' — '+date(to);
const kinds={opening:'Начальная оценка',deposit:'Пополнение',withdrawal:'Вывод',closing:'Конечная оценка'};
const labels={idle:'Объяснение готового паспорта, без обращения к AI-модели.',closed:'Объяснение закрыто. При повторном открытии данные проверяются заново.',loading:'Проверяем сохранённый паспорт…',ready:'Объяснение готово. Свежесть относительно текущего источника не подтверждена.','evidence-loading':'Перепроверяем подтверждение…',forbidden:'Доступ изменился. Объяснение скрыто до обновления доступа.','refresh-required':'Данные изменились. Обновите экран перед новым объяснением.',unavailable:'Объяснение доступно в приложении для одного счёта и подтверждённого периода.',disposed:'Объяснение закрыто.'};
const errors={expired:'Срок хранения объяснения завершился. Сформируйте его заново.',limit:'Паспорт превышает предел объяснения. Исходные данные доступны ниже.','context-changed':'Данные изменились. Обновите экран перед новым объяснением.'};
const PAGE_SIZE=20;
export function createLocalMethodExplanationUi({host,controller,onInvalidateEvidence=()=>{}}){
 let state,packet=null,page=0,renderedPage=-1,disposed=false;
 host.classList.add('local-method-explanation');
 host.innerHTML='<div class="local-method-controls"><button type="button" class="button" data-method-explain>Объяснить методы</button><button type="button" class="button" data-method-close hidden>Закрыть объяснение</button></div><p class="local-method-status" role="status"></p><div class="local-method-report" hidden></div>';
 const explain=host.querySelector('[data-method-explain]'),close=host.querySelector('[data-method-close]'),status=host.querySelector('[role=status]'),reportHost=host.querySelector('.local-method-report');
 const busy=()=>['loading','evidence-loading'].includes(state?.status);
 const disabled=()=>!['idle','closed','ready','error'].includes(state?.status);
 const button=(ref,label)=>`<button type="button" class="button" data-method-evidence="${esc(ref)}">${label}</button>`;
 function draw(){
  const r=state.report,detailsOpen=reportHost.querySelector('details')?.open;
  const rows=r.cashFlows.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
  reportHost.innerHTML=`<header><h4>${esc(r.title)}</h4><small>${esc(r.modeLabel)}</small></header><p>${esc(state.accountLabel)} · ${r.source.dataMode==='synthetic'?'Учебные данные':'Оценка по сохранённым данным'}</p><dl class="performance-methods-periods"><div><dt>Фактический интервал</dt><dd>${esc(range(r.period.observedFrom,r.period.observedTo))}</dd></div><div><dt>Выбранный период</dt><dd>${esc(range(r.period.requestedFrom,r.period.requestedTo))}</dd></div></dl>${r.period.partialPeriod?'<p class="performance-methods-partial">Расчёт покрывает только часть выбранного периода.</p>':''}
   <div class="local-method-grid">${r.methods.map(m=>`<article data-explained-method="${m.key}"><h5>${esc(m.title)}</h5><p>${esc(m.question)}</p><dl><div><dt>${m.primaryRate==='annualRate'?'Годовой эквивалент':m.key==='twr'?'За фактический период':m.dayCount?`Эквивалент за ${m.dayCount} дн.`:'За фактический период'}</dt><dd>${esc(rate(m[m.primaryRate]))}</dd></div>${m.state!=='unavailable'&&m.annualRate!==null?`<div><dt>${m.primaryRate==='annualRate'?'Эквивалент за фактический период':'Годовой эквивалент'}</dt><dd>${esc(rate(m.primaryRate==='annualRate'?m.periodRate:m.annualRate))}</dd></div>`:''}</dl>${m.reason?'<p class="performance-methods-reason">'+esc(m.reason)+'</p>':''}<p>${esc(m.limitation)}</p>${button('method-'+m.key,m.key==='twr'?'Проверить TWR':'Проверить XIRR')}</article>`).join('')}</div>
   <p><strong>Внешних денежных событий: ${r.externalFlows.count===null?'не подтверждено':r.externalFlows.count}.</strong> ${esc(r.externalFlows.explanation)}</p>${button('cash-flow-schedule','Открыть денежные входы')}
   <details ${detailsOpen?'open':''}><summary>Записи расписания · ${r.cashFlows.length}</summary><ol start="${page*PAGE_SIZE+1}">${rows.map((row,index)=>`<li data-method-report-flow="${page*PAGE_SIZE+index}"><strong>${esc(kinds[row.kind])}${row.basis==='owner-share-valuation'?' · ручная оценка перевода акций':''}</strong><p>${esc(date(row.at))} · ${row.amountNanos===null?'Нет данных':esc(decimalNanos(row.amountNanos,{digits:9}))+' ₽'}</p>${button(row.evidenceRef,'Открыть эту запись')}</li>`).join('')}</ol>${r.cashFlows.length>PAGE_SIZE?`<nav class="local-method-pager" aria-label="Страницы записей объяснения"><span role="status">${page*PAGE_SIZE+1}–${Math.min((page+1)*PAGE_SIZE,r.cashFlows.length)} из ${r.cashFlows.length}</span><button class="button" type="button" data-method-page="-1" ${page===0?'disabled':''}>Назад</button><button class="button" type="button" data-method-page="1" ${(page+1)*PAGE_SIZE>=r.cashFlows.length?'disabled':''}>Дальше</button></nav>`:''}</details>
   ${r.gaps.length?'<ul>'+r.gaps.map(row=>'<li>'+esc(row.reason)+'</li>').join('')+'</ul>':''}<ul class="local-method-limitations">${r.limitations.map(value=>'<li>'+esc(value)+'</li>').join('')}</ul>`;
  renderedPage=page;
 }
 function render(next){
  if(disposed)return;state=next;host.dataset.state=next.status;explain.setAttribute('aria-disabled',String(disabled()));close.hidden=!busy()&&!next.report;
  status.textContent=next.status==='error'?(errors[next.error]||'Не удалось подтвердить объяснение. Повторите после обновления данных.'):(labels[next.status]||labels.unavailable);
  if(!next.report){if(packet)onInvalidateEvidence();packet=null;page=0;renderedPage=-1;reportHost.replaceChildren();reportHost.hidden=true;return;}
  const changed=packet!==next.report.packetId;if(changed){onInvalidateEvidence();packet=next.report.packetId;page=0;renderedPage=-1;}
  if(changed||page!==renderedPage)draw();reportHost.hidden=false;
  for(const control of reportHost.querySelectorAll('[data-method-evidence],[data-method-page]'))control.setAttribute('aria-disabled',String(busy()));
 }
 function click(event){
  const control=event.target.closest('button');if(!control||!host.contains(control)||control.disabled)return;
  if(control.hasAttribute('data-method-close')){controller.close();if(controller.getState().status==='closed'&&host.isConnected)explain.focus({preventScroll:true});return;}
  if(control.hasAttribute('data-method-explain')){if(!disabled())void controller.explain();return;}
  if(busy()||state?.status!=='ready')return;
  if(control.hasAttribute('data-method-page')){const direction=control.dataset.methodPage;page+=Number(direction);draw();(reportHost.querySelector(`[data-method-page="${direction}"]:not(:disabled)`)||reportHost.querySelector('[data-method-page]:not(:disabled)')||reportHost.querySelector('summary'))?.focus({preventScroll:true});return;}
  if(control.hasAttribute('data-method-evidence')){
   const origin=packet;void controller.openEvidence(control.dataset.methodEvidence,{returnFocus:({isCurrent})=>{
    if(disposed||packet!==origin||state?.status!=='ready'||!isCurrent())return false;
    const target=control.isConnected?control:explain;target.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
    if(!isCurrent())return false;target.focus({preventScroll:true});return isCurrent();
   }});
  }
 }
 host.addEventListener('click',click);render(controller.getState());
 return Object.freeze({render,dispose(){disposed=true;host.removeEventListener('click',click);onInvalidateEvidence();host.replaceChildren();}});
}
