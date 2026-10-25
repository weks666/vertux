import {money,decimalNanos} from './number-format.js';
import {financialFormula,financialFormulaVariables} from './financial-formulas.js';
import {canonicalLocalResultJson} from './local-context-json.js';
import {checkedPerformancePassport} from './performance-method-explanation.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const text=(value,fallback='Правило расчёта не передано.')=>typeof value==='string'&&value.trim()?value:fallback;
const number=value=>typeof value==='number'&&Number.isFinite(value);
const rate=value=>!number(value)?'Нет данных':value===0?'0 %':Math.abs(value)<.0001?(value<0?'>−0,01 %':'<0,01 %'):(value*100).toLocaleString('ru-RU',{maximumFractionDigits:2})+' %';
export const formatPerformanceMethodRate=rate;
const amount=value=>typeof value==='string'&&/^-?\d+$/.test(value)?money(value,'RUB'):'Нет данных';
const date=value=>{const stamp=typeof value==='string'?Date.parse(value):NaN;return Number.isFinite(stamp)?new Date(stamp).toLocaleString('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'})+' мск':'Нет данных';};
const range=(from,to)=>`${date(from)} — ${date(to)}`;
const shortDate=value=>Number.isFinite(Date.parse(value))?new Date(value).toLocaleDateString('ru-RU',{timeZone:'Europe/Moscow'}):'Нет данных';
const tone=value=>!number(value)||value===0?'neutral':value<0?'negative':'positive';
const kinds={opening:'Начальная оценка',deposit:'Пополнение',withdrawal:'Вывод',closing:'Конечная оценка'};
const policyLabels={date:'Даты и время',valuation:'Оценка портфеля',currency:'Валюты и курсы',flows:'Денежные потоки',fees:'Комиссии и другие расходы',capital:'Положительный капитал'};
const PAGE_SIZE=20;

/** Public method DTO presentation only. No rates, source proofs or schedules are derived here. */
export function createPerformanceMethodsUi({host,explanationHost=null,onSurfaceChange=()=>{}}){
 let signature='',scope='',page=0,lastData,evidenceSignature='',evidenceEligible=false,surfaceRevision=0,evidenceReturn=null,disposed=false;
 const changed=records=>{const count=records.filter(row=>row.type==='attributes'&&row.attributeName==='open'&&row.target.classList.contains('performance-methods-disclosure')).length;if(count){surfaceRevision+=count;onSurfaceChange();}};
 const observer=new MutationObserver(changed);if(host)observer.observe(host,{subtree:true,attributes:true,attributeFilter:['open']});
 const drain=()=>changed(observer.takeRecords());
 function click(event){
  const back=event.target.closest('[data-performance-evidence-return]');if(back&&host.contains(back)){const action=evidenceReturn,state=getEvidenceState();if(action&&state.eligible&&state.signature===action.expectedSignature)action.returnFocus?.();return;}
  const button=event.target.closest('[data-performance-page]');if(!button||button.disabled)return;
  page+=Number(button.dataset.performancePage);signature='';update(lastData);
 }
 host?.addEventListener('click',click);
 function update(data){
  if(!host||disposed)return;drain();lastData=data;
  const dto=data?.portfolio?.performance;let valid=dto?.contractVersion==='portfolio-performance-v1';
  if(dto?.contractVersion==='portfolio-performance-v2')try{checkedPerformancePassport(dto,{portfolioIds:(data?.clientProduct?.portfolios||[]).map(row=>row.id),requestedFrom:data?.selectedPeriod?.from,requestedTo:data?.selectedPeriod?.to},{allowMultiple:true});valid=true;}catch{}
  const ids=Array.isArray(dto?.scope?.portfolioIds)?dto.scope.portfolioIds:[],single=valid&&dto.scope?.kind==='single-account'&&ids.length===1;
  const accounts=data?.clientProduct?.portfolios||[],matched=ids.map(id=>accounts.find(item=>item.id===id)),account=single?matched[0]:null;
  const multi=valid&&dto.scope?.kind==='all-selected-accounts'&&ids.length>1;
  const eligible=valid&&(single||multi)&&new Set(ids).size===ids.length&&matched.every(Boolean)&&dto.currency==='RUB';
  let nextEvidence='';try{if(eligible&&single&&accounts.length===1)nextEvidence=canonicalLocalResultJson(dto);}catch{}
  evidenceEligible=Boolean(nextEvidence);if(nextEvidence!==evidenceSignature){evidenceSignature=nextEvidence;clearEvidenceReturn();}
  const accountLabel=account?.label||(multi?'Все выбранные счета · '+ids.length:'');
  const nextScope=JSON.stringify([ids,dto?.period?.requestedFrom,dto?.period?.requestedTo]);
  if(scope!==nextScope)page=0;
  const flows=eligible&&Array.isArray(dto.cashFlows)?dto.cashFlows:[];
  page=Math.max(0,Math.min(page,Math.max(0,Math.ceil(flows.length/PAGE_SIZE)-1)));
  const nextSignature=JSON.stringify([dto,accountLabel,multi,page]);if(nextSignature===signature)return;
  const scopeChanged=nextScope!==scope;
  const inputsOpen=nextScope===scope&&host.querySelector('.performance-methods-inputs')?.open;
  const active=host.contains(document.activeElement)?document.activeElement:null,extensionFocus=Boolean(active&&explanationHost?.contains(active));
  const focusedPage=active?.dataset.performancePage,focusedDetails=active?.tagName==='SUMMARY'?active.parentElement.className:null;
  signature=nextSignature;scope=nextScope;
  const synthetic=valid&&dto.evidence?.dataMode==='synthetic';
  const available=eligible&&Object.values(dto.methods||{}).some(method=>['estimated','calculated'].includes(method?.state)&&number(method.periodRate));
  const status=!available?'Расчёт недоступен':synthetic?'Учебные данные':'Оценка по сохранённым данным';
  host.dataset.state=available?(synthetic?'synthetic':'estimated'):'unavailable';
  const unavailable=!valid?'Для выбранного периода методы доходности пока недоступны.':!eligible?'Данные расчёта не соответствуют выбранным счетам или валюте.':null;
  const methodCard=(key,title,question)=>{
   const method=dto.methods?.[key]||{},known=['estimated','calculated'].includes(method.state)&&method.rateUnit==='fraction'&&number(method.periodRate);
   const annual=known&&key==='xirr'&&method.primaryRate==='annualRate'&&method.dayCount>=365&&number(method.annualRate);
   const primary=annual?method.annualRate:method.periodRate,days=Number.isSafeInteger(method.dayCount)?method.dayCount:null;
   const periodLabel=days===null?'За фактический период':`Эквивалент за ${days} дн.`;
   const secondary=known&&annual?`<p class="performance-methods-secondary"><span>${periodLabel}</span><strong data-number-tone="${tone(method.periodRate)}">${esc(rate(method.periodRate))}</strong></p>`:'';
   return `<article class="performance-method" data-method="${key}" data-state="${known?esc(method.state):'unavailable'}"><header><h4>${title}</h4><span>${known?method.state==='estimated'?'Оценочно':synthetic?'Учебный расчёт':'Рассчитано':'Недоступно'}</span></header><p>${question}</p><div class="performance-methods-primary"><span>${annual?'Годовой эквивалент':key==='twr'?'За фактический период':periodLabel}</span><strong data-number-tone="${known?tone(primary):'neutral'}">${known?esc(rate(primary)):'Нет данных'}</strong></div>${secondary}${!known?'<p class="performance-methods-reason">'+esc(text(method.reason,'Недостаточно подтверждённых входных данных для этого метода.'))+'</p>':''}</article>`;
  };
  const policies=eligible?Object.entries(policyLabels).map(([key,label])=>`<div><dt>${label}</dt><dd>${esc(text(dto.policies?.[key]))}</dd></div>`).join(''):'';
  const cashRows=flows.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE).map((flow,index)=>{
   const native=typeof flow.nativeCurrency==='string'&&flow.nativeCurrency!=='RUB'?`<small>Исходная сумма: ${esc(typeof flow.nativeAmountNanos==='string'&&/^-?\d+$/.test(flow.nativeAmountNanos)?money(flow.nativeAmountNanos,flow.nativeCurrency):'Нет данных')}. Курс: ${esc(typeof flow.fxRateNanos==='string'&&/^\d+$/.test(flow.fxRateNanos)?decimalNanos(flow.fxRateNanos,{digits:9})+' ₽ за '+flow.nativeCurrency:'Нет данных')}.</small>`:'';
   return `<li data-performance-cash-flow="${page*PAGE_SIZE+index}"><time>${esc(date(flow.at))}</time><span>${esc(kinds[flow.kind]||'Денежное событие')}${flow.basis==='owner-share-valuation'?'<small>Ручная оценка перевода акций</small>':''}</span><strong>${esc(amount(flow.amountNanos))}</strong>${native}</li>`;
  }).join('');
  const blockers=eligible&&Array.isArray(dto.coverage?.blockers)?[...new Set(dto.coverage.blockers.map(item=>text(item?.reason,'Входные данные не подтверждены.')))]:[];
  const flowCount=Number.isSafeInteger(dto?.coverage?.externalFlowCount)&&dto.coverage.externalFlowCount>=0?`Внешних денежных событий: ${dto.coverage.externalFlowCount}.`:'Количество внешних денежных событий не подтверждено.';
  const manualSummary=eligible&&dto.contractVersion==='portfolio-performance-v2'?`<div class="performance-methods-manual" data-state="${esc(dto.funding.state)}"><h4>Результат с ручной стоимостью переводов</h4><p class="performance-methods-note">Оценок владельца: ${dto.evidence.manualValuationCount}. Стоимость акций на дату поручения задана вручную; рыночная цена и момент поставки не подтверждены.</p><dl class="performance-methods-periods"><div><dt>Внесено за вычетом выведенного</dt><dd>${esc(amount(dto.funding.netContributionsNanos))}</dd></div><div><dt>Изменение стоимости за вычетом финансирования</dt><dd>${esc(amount(dto.funding.changeAfterFlowsNanos))}</dd></div></dl><p class="performance-methods-note">Результат = конечная стоимость − начальная стоимость − внесённый капитал. Здесь учтены денежные операции и ручные оценки переводов.</p></div>`:'';
  const pager=flows.length>PAGE_SIZE?`<nav class="performance-methods-pagination" aria-label="Страницы входных денежных потоков"><span role="status">${page*PAGE_SIZE+1}–${Math.min((page+1)*PAGE_SIZE,flows.length)} из ${flows.length}</span><button type="button" data-performance-page="-1" ${page===0?'disabled':''}>Назад</button><button type="button" data-performance-page="1" ${(page+1)*PAGE_SIZE>=flows.length?'disabled':''}>Дальше</button></nav>`:'';
  const xirr=dto?.methods?.xirr;
  const shortAnnual=eligible&&xirr&&['estimated','calculated'].includes(xirr.state)&&number(xirr.annualRate)&&number(xirr.dayCount)&&xirr.dayCount<365;
  host.innerHTML=`<section class="performance-methods-disclosure" aria-labelledby="performanceMethodsTitle"><header class="financial-section-head"><div><h3 id="performanceMethodsTitle">Доходность в процентах</h3><p>Методы TWR и MWR/XIRR учитывают движение денег по-разному.</p></div><span class="performance-methods-status" role="status">${synthetic?'Учебные данные':status}</span></header><div class="performance-methods-body">
   ${unavailable?'<p class="performance-methods-reason">'+esc(unavailable)+'</p>':`
   <p class="financial-period">${esc(accountLabel||'Выбранные счета')} · ${esc(shortDate(dto.period?.observedFrom))} — ${esc(shortDate(dto.period?.observedTo))}${dto.period?.partialPeriod?' · <span>часть выбранного периода</span>':''}</p>
   <div class="performance-methods-grid">${methodCard('twr','TWR · без потоков','Изменение оценки, если между наблюдениями не было пополнений и выводов.')}${methodCard('xirr','MWR / XIRR','Результат с учётом сумм и дат пополнений и выводов.')}</div>
   <p class="performance-methods-evidence">Расчёт по сохранённым наблюдениям. Точное время состояния у брокера и полная денежная сверка не подтверждены.</p>
   <details class="performance-methods-inputs" ${inputsOpen?'open':''}><summary>Формулы и исходные данные</summary>
   <h4>TWR без потоков</h4>${financialFormula('twr')}${financialFormulaVariables('twr')}
   <h4>Годовая ставка XIRR</h4>${financialFormula('xirr')}${financialFormulaVariables('xirr')}
   <h4>Эквивалент за фактический период</h4>${financialFormula('periodEquivalent')}${financialFormulaVariables('periodEquivalent')}
   ${shortAnnual?'<p class="performance-methods-note">Годовой эквивалент XIRR: '+esc(rate(xirr.annualRate))+'. Это экстраполяция '+esc(xirr.dayCount)+' дней, не фактический годовой результат.</p>':''}
   <dl class="performance-methods-periods"><div><dt>Фактический интервал расчёта</dt><dd>${esc(range(dto.period?.observedFrom,dto.period?.observedTo))}</dd></div><div><dt>Выбранный период</dt><dd>${esc(range(dto.period?.requestedFrom,dto.period?.requestedTo))}</dd></div></dl>${manualSummary}
   <dl class="performance-methods-policies">${policies}</dl>${blockers.length?'<ul class="performance-methods-blockers">'+blockers.map(reason=>'<li>'+esc(reason)+'</li>').join('')+'</ul>':''}
   <h4>Денежные входы XIRR · рубли</h4><p class="performance-methods-flow-count">${flowCount}</p><p>Начальная оценка и пополнения — минус; выводы и конечная оценка — плюс. Неизвестная сумма не заменяется нулём.</p>${flows.length?'<ol class="performance-methods-flows">'+cashRows+'</ol>'+pager:'<p>Подтверждённое расписание денежных потоков недоступно.</p>'}<p class="performance-methods-boundary">Численная точность XIRR не подтверждает денежную сверку. Сопоставимый ряд рыночного ориентира не подключён.</p></details>`}
  </div></section>`;
  if(explanationHost){const anchor=host.querySelector('.performance-methods-grid');if(anchor)anchor.after(explanationHost);else host.querySelector('.performance-methods-body')?.prepend(explanationHost);}
  const outer=host.querySelector('.financial-section-head h3');if(outer)outer.tabIndex=-1;
  if(active&&scopeChanged)outer?.focus({preventScroll:true});
  else if(focusedPage!==undefined){const target=host.querySelector(`[data-performance-page="${focusedPage}"]:not(:disabled)`)||host.querySelector('[data-performance-page]:not(:disabled)')||host.querySelector('.performance-methods-inputs>summary');target?.focus({preventScroll:true});}
  else if(['performance-methods-disclosure','performance-methods-inputs'].includes(focusedDetails))host.querySelector('.'+focusedDetails+'>summary')?.focus({preventScroll:true});
  else if(extensionFocus&&active.isConnected)active.focus({preventScroll:true});
  else if(active&&!active.isConnected)outer?.focus({preventScroll:true});
 }
 function getEvidenceState(){drain();return {signature:evidenceSignature,eligible:evidenceEligible,surfaceRevision,open:Boolean(host?.querySelector('.performance-methods-disclosure'))&&!host.closest('[hidden]')};}
 function clearEvidenceReturn(){evidenceReturn=null;host?.querySelectorAll('[data-performance-evidence-return]').forEach(node=>node.remove());host?.querySelectorAll('[data-performance-highlight]').forEach(node=>node.removeAttribute('data-performance-highlight'));}
 function revealEvidence({kind,methodKey,cashFlowIndex,expectedSignature,returnFocus,isCurrent}={}){
  const guarded=()=>!disposed&&typeof isCurrent==='function'&&isCurrent()===true&&getEvidenceState().eligible&&evidenceSignature===expectedSignature;
  if(!guarded()||!['method','cash-flow','cash-flow-schedule'].includes(kind))return false;
  const rows=lastData?.portfolio?.performance?.cashFlows||[];
  if(kind==='method'&&(!['twr','xirr'].includes(methodKey)||cashFlowIndex!==null)
    ||kind==='cash-flow'&&(methodKey!==null||!Number.isSafeInteger(cashFlowIndex)||cashFlowIndex<0||cashFlowIndex>=rows.length)
    ||kind==='cash-flow-schedule'&&(methodKey!==null||cashFlowIndex!==null))return false;
  if(kind==='cash-flow'){page=Math.floor(cashFlowIndex/PAGE_SIZE);signature='';update(lastData);}
  if(!guarded())return false;
  const outer=host.querySelector('.performance-methods-disclosure'),inputs=host.querySelector('.performance-methods-inputs');if(!outer||!inputs)return false;
  if(kind!=='method'&&!inputs.open)inputs.open=true;
  const target=kind==='method'?host.querySelector(`[data-method="${methodKey}"]`):kind==='cash-flow'?host.querySelector(`[data-performance-cash-flow="${cashFlowIndex}"]`):inputs.querySelector('summary');
  if(!target||!guarded())return false;clearEvidenceReturn();
  const back=document.createElement('button');back.type='button';back.className='button secondary';back.dataset.performanceEvidenceReturn='';back.textContent='Вернуться к объяснению';
  if(kind==='cash-flow-schedule')inputs.append(back);else target.append(back);
  evidenceReturn={expectedSignature,returnFocus};target.dataset.performanceHighlight='';target.tabIndex=-1;
  target.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});if(!guarded())return false;target.focus({preventScroll:true});return guarded();
 }
 return {update,getEvidenceState,revealEvidence,clearEvidenceReturn,dispose(){disposed=true;observer.disconnect();host?.removeEventListener('click',click);clearEvidenceReturn();}};
}
