import {decimalNanos} from './number-format.js';

const esc=value=>String(value??'').replace(/[&<>"']/gu,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money=value=>value===null?'Нет данных':decimalNanos(value,{digits:9})+' ₽';
const date=value=>value&&Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(value))+' мск':'Нет данных';
const interval=p=>date(p?.observedFrom)+' — '+date(p?.observedTo);
const states={'unchanged':'Не изменилось','changed':'Изменилось','unknown':'Обе суммы неизвестны','became-known':'Сумма стала известна','became-unknown':'Сумма больше не подтверждена','incomparable':'Разные интервалы'};
const PAGE=20;

export function createSessionResultReviewUi({host,controller,focusEntry}){
 let disposed=false,current=null,key=null,baselineKey=null,page=0;
 host.classList.add('session-result-review');
 function render(state,force=false){
  if(disposed)return;current=state;
  const review=state.review,newKey=JSON.stringify([state.status,review]);if(!force&&key===newKey)return;key=newKey;
  const saved=review?.saved,ready=state.status==='ready',comparison=ready?review?.comparison:null;
  const savedKey=JSON.stringify(saved);if(savedKey!==baselineKey){baselineKey=savedKey;page=0;}
  const active=host.contains(document.activeElement)?document.activeElement:null,focus=active?.dataset.reviewAction;
  const open=host.querySelector('[data-review-sources]')?.open===true;
  host.hidden=!review||(!saved&&!ready);
  if(host.hidden){host.replaceChildren();return;}
  const rows=saved?.receipts||[];page=Math.min(page,Math.max(0,Math.ceil(rows.length/PAGE)-1));
  host.innerHTML=`<h4>Сравнение в этой вкладке</h4><div class="local-result-entry">${ready?`<button type="button" data-review-action="remember" ${review.canRemember?'':'disabled'}>${saved?'Заменить сохранённый разбор':'Запомнить для сравнения'}</button>`:''}${saved?'<button type="button" data-review-action="forget">Убрать сохранённый разбор</button>':''}</div><p class="local-result-note" role="status">${saved?'Зафиксировано в этой вкладке: '+esc(date(saved.capturedAt))+'.':'Сохраните текущий разбор, обновите данные и явно сформируйте новый.'} Снимок хранится до перезагрузки вкладки или смены счёта, периода либо доступа.</p>${saved&&!comparison?'<p>Сохранённый разбор останется отдельным от следующего. Для сравнения нужен новый подтверждённый разбор того же периода.</p>':''}${comparison?`<p data-review-classification="${esc(comparison.classification)}">${comparison.classification==='same-calculation'?'Сохранённый расчёт не изменился.':comparison.classification==='different-observations'?'Наблюдаемые интервалы различаются. Разница сумм не вычисляется.':'Сохранённый расчёт изменился. Причина изменения источника не определена.'}</p><table class="session-review-table"><caption>Зафиксированный и текущий разбор</caption><thead><tr><th scope="col">Сумма</th><th scope="col">Было</th><th scope="col">Сейчас</th><th scope="col">Разница</th></tr></thead><tbody>${comparison.rows.map(row=>`<tr data-review-row="${esc(row.id)}"><th scope="row">${esc(row.title)}<small>${esc(states[row.state])}</small></th><td data-review-before><span>Было</span>${esc(money(row.before))}</td><td data-review-current><span>Сейчас</span>${esc(money(row.current))}</td><td data-review-delta><span>Разница</span>${row.delta===null?'Недоступна':esc((BigInt(row.delta)>0n?'+':'')+money(row.delta))}</td></tr>`).join('')}</tbody></table><p class="local-result-note">Было: ${esc(interval(comparison.beforePeriod))}. Сейчас: ${esc(interval(comparison.currentPeriod))}.</p>${comparison.coverageChanged?'<p>Покрытие или причины ограничения изменились. Проверьте сохранённые сведения ниже и текущий разбор.</p>':''}<p>Разница относится к показанным расчётам. Она не является доходностью между снимками или доказательством причины изменения портфеля. Текущие подтверждения доступны в разборе ниже.</p>`:''}${saved&&ready?`<details data-review-sources ${open?'open':''}><summary>Что зафиксировано в сохранённом разборе</summary><p>${saved.dataMode==='synthetic'?'Учебные данные.':'Локально сохранённые данные.'} Это копия ранее показанных сведений; текущее состояние источника ею не подтверждается. Прежние переходы к источникам недоступны.</p><p>Наблюдаемый интервал: ${esc(interval(saved.period))}.</p><dl class="local-result-periods">${['Начальная оценка','Конечная оценка','Пополнения минус выводы'].map((name,i)=>`<div><dt>${name}</dt><dd>${esc(money(saved.basisValues[i]))}</dd></div>`).join('')}</dl><p>Подтверждённых компонентов: ${esc(saved.coverage.knownComponentCount)}. С неизвестными данными: ${esc(saved.coverage.unknownComponentCount)}. Полнота просмотра кандидатов: ${saved.coverage.candidateScanComplete===true?'подтверждена':'не подтверждена'}.</p><ol class="local-result-receipts" start="${page*PAGE+1}">${rows.slice(page*PAGE,(page+1)*PAGE).map((row,index)=>`<li data-review-receipt="${page*PAGE+index}"><strong>${page*PAGE+index+1}. Денежная запись</strong><p>${esc(date(row.at))} · ${esc(row.currency||'Валюта не подтверждена')} · ${esc(money(row.signedNanos))}</p><p>${row.coverage==='source-confirmed'?'Подтверждено в сохранённом разборе.':'Сумма не подтверждена в сохранённом разборе.'}</p></li>`).join('')}</ol>${rows.length>PAGE?`<nav class="local-result-pager" aria-label="Сохранённые подтверждения"><span>${page*PAGE+1}–${Math.min((page+1)*PAGE,rows.length)} из ${rows.length}</span><button type="button" data-review-action="previous" ${page===0?'disabled':''}>Назад</button><button type="button" data-review-action="next" ${(page+1)*PAGE>=rows.length?'disabled':''}>Дальше</button></nav>`:rows.length?'':'<p>Записей нет. Это не подтверждает отсутствие всех доходов и расходов.</p>'}</details>`:''}`;
  if(focus){const target=host.querySelector(`[data-review-action="${focus}"]:not(:disabled)`)||(['next','previous'].includes(focus)?host.querySelector('.local-result-pager button:not(:disabled)'):null)||host.querySelector('[data-review-action="remember"]')||host.querySelector('summary');target?.focus({preventScroll:true});}
 }
 function click(event){
  const control=event.target.closest('[data-review-action]');if(disposed||!control||!host.contains(control)||control.disabled)return;
  const action=control.dataset.reviewAction;
  if(action==='forget'){controller.forgetReview();if(host.hidden)focusEntry();return;}
  if(current?.status!=='ready')return;
  if(action==='remember'){controller.rememberForReview();return;}
  if(action==='previous'||action==='next'){page+=action==='next'?1:-1;render(current,true);}
 }
 host.addEventListener('click',click);
 return Object.freeze({render,dispose(){disposed=true;host.removeEventListener('click',click);host.replaceChildren();}});
}
