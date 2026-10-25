import {createSessionResultReviewUi} from './session-result-review-ui.js';
import {renderContextEvidence} from './context-evidence.js';
import {buildPortfolioContextEvidence} from './context-evidence-adapters.js';
const esc=value=>String(value??'').replace(/[&<>"']/gu,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const date=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(value))+' мск':'Нет данных';
const errors={unavailable:'Локальное объяснение сейчас недоступно. Дождитесь подтверждения данных и повторите действие.',expired:'Срок хранения объяснения завершился. Нажмите «Объяснить результат», чтобы сформировать новое.',limit:'Расчёт превышает объём этого объяснения. Исходные компоненты остаются доступны ниже.','invalid-request':'Не удалось подтвердить запрос. Обновите экран и повторите действие.','context-changed':'Данные изменились. Обновите экран и явно сформируйте новое объяснение.'};
const labels={idle:'Объяснение строится из сохранённого расчёта, без обращения к AI-модели.',loading:'Проверяем сохранённый расчёт…',ready:'Объяснение готово. Свежесть относительно текущего источника не подтверждена.','evidence-loading':'Перепроверяем подтверждение…',closed:'Объяснение закрыто. При открытии расчёт будет проверен заново.',forbidden:'Доступ к объяснению больше не подтверждён. Обновите экран после восстановления доступа.','refresh-required':errors['context-changed'],unavailable:'Объяснение доступно в локальном приложении для одного подтверждённого счёта и открытого расчёта.',disposed:''};
const PAGE_SIZE=20;

export function createLocalResultExplanationUi({host,controller,onInvalidateEvidence=()=>{}}){
 let disposed=false,snapshot=null,packet=null,page=0,renderedPage=-1;
 host.classList.add('local-result-explanation');
 host.innerHTML='<div class="local-result-entry"><button type="button" data-local-explain>Объяснить результат</button><button type="button" data-local-close hidden>Закрыть объяснение</button></div><p class="local-result-status" role="status" aria-live="polite" data-local-status></p><section class="local-result-report" aria-label="Объяснение результата" data-local-report hidden></section>';
 const explain=host.querySelector('[data-local-explain]'),close=host.querySelector('[data-local-close]'),status=host.querySelector('[data-local-status]'),reportHost=host.querySelector('[data-local-report]');
 const reviewHost=document.createElement('section');reviewHost.setAttribute('aria-label','Сравнение разборов');reportHost.after(reviewHost);
 const reviewUi=createSessionResultReviewUi({host:reviewHost,controller,focusEntry:()=>{if(!disposed&&host.isConnected&&host.getClientRects().length)(close.hidden?explain:close).focus({preventScroll:true});}});
 const busy=()=>['loading','evidence-loading'].includes(snapshot?.status);
 const disabled=()=>busy()||['forbidden','unavailable','refresh-required','disposed'].includes(snapshot?.status);
 const button=(ref,label)=>`<button type="button" data-local-evidence="${esc(ref)}">${esc(label)}</button>`;
 function drawReport(){
  const report=snapshot.report;if(!report)return;
  const contextOpen=reportHost.querySelector('[data-context-evidence]')?.open===true;
  const rows=report.receipts.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
  reportHost.innerHTML=`<header><h4>Основания результата</h4><p>${esc(snapshot.accountLabel)} · ${esc(report.sourceLabel)} · ${esc(report.modeLabel)}</p></header>
    <p class="local-result-note">${esc(report.limitation)}</p>
    <div class="local-result-basis-action">${button('opening-nav','Оценки и формула')}</div>
    <section data-local-receipts aria-label="Операции, подтверждающие результат"><h5>Операции, подтверждающие результат · ${report.receipts.length}</h5>
    ${report.receipts.length?`<ol class="local-result-receipts" start="${page*PAGE_SIZE+1}">${rows.map((row,index)=>`<li data-local-receipt-index="${page*PAGE_SIZE+index}"><strong>${esc(row.title)}</strong><p>${esc(date(row.at))} · ${esc(row.currency||'Валюта не подтверждена')} · ${esc(row.text)}</p>${row.coverage==='source-confirmed'?'':'<p class="local-result-note">'+esc(row.reason||'Данные не подтверждены.')+'</p>'}${button(row.evidenceRef,'Открыть эту запись')}</li>`).join('')}</ol>${report.receipts.length>PAGE_SIZE?`<nav class="local-result-pager" aria-label="Страницы подтверждений объяснения"><span role="status">${page*PAGE_SIZE+1}–${Math.min((page+1)*PAGE_SIZE,report.receipts.length)} из ${report.receipts.length}</span><button type="button" data-local-page="-1" ${page===0?'disabled':''}>Назад</button><button type="button" data-local-page="1" ${(page+1)*PAGE_SIZE>=report.receipts.length?'disabled':''}>Дальше</button></nav>`:''}`:'<p>Доступных записей нет. Это не заменяет неизвестную сумму нулём.</p>'}</section>`;
  reportHost.insertAdjacentHTML('beforeend',renderContextEvidence(buildPortfolioContextEvidence(report,snapshot.accountLabel),{open:contextOpen}));
  reportHost.querySelector('.context-evidence-body')?.insertAdjacentHTML('beforeend',`<p>${esc(report.method)}</p>${button('opening-nav','Открыть оценки и метод')}<p>Подтверждённых компонентов: ${esc(report.coverage.knownComponentCount)}. С неизвестными данными: ${esc(report.coverage.unknownComponentCount)}.</p>${report.coverage.absenceText?'<p>'+esc(report.coverage.absenceText)+'</p>':''}`);
  renderedPage=page;
 }
 function render(next){
  if(disposed)return;const entryFocused=document.activeElement===explain,reportFocused=reportHost.contains(document.activeElement);snapshot=next;host.dataset.state=next.status;reviewUi.render(next);
  explain.setAttribute('aria-disabled',String(disabled()));explain.hidden=Boolean(next.report);close.hidden=!busy()&&!next.report;
  status.textContent=next.status==='error'?(errors[next.error]||errors.unavailable):(labels[next.status]||errors.unavailable);
  if(!next.report){if(packet){onInvalidateEvidence();}packet=null;page=0;renderedPage=-1;reportHost.replaceChildren();reportHost.hidden=true;if(reportFocused&&host.isConnected&&host.getClientRects().length)explain.focus({preventScroll:true});return;}
  const changed=packet!==next.report.packetId;if(changed){packet=next.report.packetId;page=0;renderedPage=-1;}
  page=Math.min(page,Math.max(0,Math.ceil(next.report.receipts.length/PAGE_SIZE)-1));
  if(changed||page!==renderedPage)drawReport();reportHost.hidden=false;
  if(entryFocused&&host.isConnected&&host.getClientRects().length)close.focus({preventScroll:true});
  for(const control of reportHost.querySelectorAll('[data-local-evidence],[data-local-page]'))control.setAttribute('aria-disabled',String(busy()));
 }
 function click(event){
  const control=event.target.closest('button');if(!control||!host.contains(control)||control.disabled)return;
  if(control.hasAttribute('data-local-close')){controller.close();const current=controller.getState();if(current.status==='closed'&&snapshot?.revision===current.revision&&host.isConnected&&host.getClientRects().length)explain.focus({preventScroll:true});return;}
  if(control.hasAttribute('data-local-explain')){if(!disabled())void controller.explain();return;}
  if(busy()||snapshot?.status!=='ready')return;
  if(control.hasAttribute('data-local-page')){const direction=control.dataset.localPage;page+=Number(direction);drawReport();(reportHost.querySelector(`[data-local-page="${direction}"]:not(:disabled)`)||reportHost.querySelector('[data-local-page]:not(:disabled)')||reportHost.querySelector('summary'))?.focus({preventScroll:true});return;}
  if(control.hasAttribute('data-local-evidence')){
   const ref=control.dataset.localEvidence,originPacket=packet;
   void controller.openEvidence(ref,{returnFocus:({isCurrent})=>{if(disposed||packet!==originPacket||snapshot?.status!=='ready'||!isCurrent())return false;const target=control.isConnected?control:explain;if(!isCurrent())return false;target.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});if(!isCurrent())return false;target.focus({preventScroll:true});return isCurrent();}});
  }
 }
 const escape=event=>{if(event.key==='Escape'&&host.contains(event.target)&&(busy()||snapshot?.report)){event.preventDefault();event.stopPropagation();controller.close();explain.focus({preventScroll:true});}};
 host.addEventListener('click',click);host.addEventListener('keydown',escape);render(controller.getState());
 return Object.freeze({render,dispose(){disposed=true;host.removeEventListener('click',click);host.removeEventListener('keydown',escape);reviewUi.dispose();onInvalidateEvidence();host.replaceChildren();}});
}
