import {decimalNanos} from './number-format.js';
import {financialFormula,financialFormulaVariables} from './financial-formulas.js';
import {canonicalLocalResultJson} from './local-context-json.js';
import {isBookedComponentsVersion,bookedComponentScope,bookedComponentScopeText,bookedComponentTitle,COMBINED_BOOKED_COMPONENTS_VERSION,BOOKED_COMPONENT_SCOPE} from './booked-components-contract.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const known=value=>typeof value==='string'&&/^-?\d+$/.test(value);
const amount=value=>known(value)?decimalNanos(value,{digits:9})+' ₽':'Нет данных';
// Valuations are estimates in rubles; show them like every other money value.
const rubles=value=>known(value)?decimalNanos(value,{trim:false})+' ₽':'Нет данных';
const tone=value=>!known(value)||BigInt(value)===0n?'neutral':BigInt(value)<0n?'negative':'positive';
const shortDate=value=>Number.isFinite(Date.parse(value))?new Date(value).toLocaleDateString('ru-RU',{timeZone:'Europe/Moscow'}):'Нет данных';
const date=value=>{const at=typeof value==='string'?Date.parse(value):NaN;return Number.isFinite(at)?new Date(at).toLocaleString('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'})+' мск':'Нет данных';};
const range=(from,to)=>date(from)+' — '+date(to);
const count=value=>Number.isSafeInteger(value)&&value>=0?String(value):'не подтверждено';
const reason=value=>typeof value==='string'&&value.trim()?value:'Данные компонента не подтверждены.';
const PAGE_SIZE=20;
// The same value-history numbers as the overview card. They stay a labelled
// estimate beside the confirmed metrics, which never borrow these values.
function valueHistoryEstimate(portfolio){
 const details=portfolio?.resultDetails;
 if(details?.contractVersion!=='portfolio-result-v1'||portfolio.currency!=='RUB'||!known(portfolio.netPnlNanos))return '';
 const lead=(tone(portfolio.netPnlNanos)==='positive'?'+':'')+rubles(portfolio.netPnlNanos);
 const rows=[['Стоимость в начале',details.opening?.valueNanos],['Стоимость в конце',details.closing?.valueNanos],['Пополнения минус выводы',details.externalFlows?.valueNanos]];
 return `<section class="booked-estimate" data-booked-estimate aria-label="Оценка по истории стоимости"><div class="booked-estimate-lead"><span>Результат за период · по истории стоимости</span><strong data-number-tone="${tone(portfolio.netPnlNanos)}">${esc(lead)}</strong><small>Оценка, как в «Обзоре портфеля». Без сверки с операциями брокера.</small></div><dl>${rows.map(([label,value])=>`<div><dt>${label}</dt><dd>${esc(rubles(value))}</dd></div>`).join('')}</dl></section>`;
}

/** Render public receipts without recalculating the bridge or classifying its remainder. */
export function createBookedComponentsUi({host,explanationHost=null,onSurfaceChange=()=>{}}){
 let signature='',scope='',page=0,lastData,evidenceSignature='',evidenceEligible=false,surfaceRevision=0,evidenceReturn=null,disposed=false;
 const changed=records=>{const count=records.filter(row=>row.type==='attributes'&&row.attributeName==='open'&&row.target.classList.contains('booked-components-disclosure')).length;if(count){surfaceRevision+=count;onSurfaceChange();}};
 const observer=new MutationObserver(changed);if(host)observer.observe(host,{subtree:true,attributes:true,attributeFilter:['open']});
 const drain=()=>changed(observer.takeRecords());
 function click(event){
  const back=event.target.closest('[data-booked-evidence-return]');if(back&&host.contains(back)){const action=evidenceReturn,state=getEvidenceState();if(action&&state.eligible&&state.signature===action.expectedSignature)action.returnFocus?.();return;}
  const button=event.target.closest('[data-booked-page]');if(!button||button.disabled)return;page+=Number(button.dataset.bookedPage);signature='';update(lastData);
 }
 host?.addEventListener('click',click);
 function update(data){
  if(!host||disposed)return;drain();lastData=data;
  const dto=data?.portfolio?.resultComponents,legacy=dto?.contractVersion==='booked-result-components-v1';
  const combined=dto?.contractVersion===COMBINED_BOOKED_COMPONENTS_VERSION;
  const valid=combined?dto?.coverage?.componentScope===BOOKED_COMPONENT_SCOPE:isBookedComponentsVersion(dto?.contractVersion)&&dto?.coverage?.componentScope===bookedComponentScope(dto.contractVersion);
  const ids=Array.isArray(dto?.scope?.portfolioIds)?dto.scope.portfolioIds:[],accounts=data?.clientProduct?.portfolios||[];
  const single=valid&&dto.scope?.kind==='single-account'&&ids.length===1,account=single?accounts.find(row=>row.id===ids[0]):null;
  const multi=accounts.length>1||valid&&dto.scope?.kind!=='single-account';
  const singleEligible=single&&!combined&&Boolean(account)&&accounts.length===1&&dto.currency==='RUB';
  const combinedEligible=valid&&combined&&dto.scope?.kind==='all-selected-accounts'&&dto.currency==='RUB'
   &&ids.length>1&&ids.length===accounts.length&&new Set(ids).size===ids.length&&new Set(accounts.map(row=>row.id)).size===accounts.length
   &&ids.every(id=>accounts.some(row=>row.id===id))&&Array.isArray(dto.components)&&dto.components.every(row=>ids.includes(row.portfolioId))
   &&Array.isArray(dto.accountValuations)&&dto.accountValuations.every(row=>ids.includes(row.portfolioId))
   &&new Set(dto.accountValuations.map(row=>row.portfolioId)).size===dto.accountValuations.length;
  const eligible=singleEligible||combinedEligible;
  let nextEvidence='';try{if(singleEligible)nextEvidence=canonicalLocalResultJson(dto);}catch{}evidenceEligible=singleEligible&&Boolean(nextEvidence);
  if(nextEvidence!==evidenceSignature){evidenceSignature=nextEvidence;evidenceReturn=null;}
  const nextScope=JSON.stringify([ids,dto?.period?.requestedFrom,dto?.period?.requestedTo,accounts.map(row=>row.id)]);if(nextScope!==scope)page=0;
  const rows=eligible&&Array.isArray(dto.components)?dto.components:[];page=Math.max(0,Math.min(page,Math.max(0,Math.ceil(rows.length/PAGE_SIZE)-1)));
  const nextSignature=JSON.stringify([dto,accounts.map(row=>[row.id,row.label]),page]);if(signature===nextSignature)return;
  const scopeChanged=nextScope!==scope,receiptsOpen=!scopeChanged&&host.querySelector('.booked-components-receipts')?.open;
  const active=host.contains(document.activeElement)?document.activeElement:null,extensionFocus=Boolean(active&&explanationHost?.contains(active)),focusedPage=active?.dataset.bookedPage,focusedDetails=active?.tagName==='SUMMARY'?active.parentElement.className:null;
  signature=nextSignature;scope=nextScope;
  const partial=eligible&&dto.state==='partial-components',synthetic=eligible&&dto.evidence?.dataMode==='synthetic';host.dataset.state=partial?'partial-components':'unavailable';
  const unavailable=eligible?null:combined?'Данные общего результата не соответствуют выбранному набору счетов.':multi?'Выберите один счёт в поле «Счёт портфеля». Для этого набора данных общий разбор недоступен.':!valid?'Для выбранного периода компоненты результата пока недоступны.':'Данные компонентов не соответствуют выбранному счёту или валюте.';
  const blockers=eligible&&Array.isArray(dto.coverage?.blockers)?[...new Set(dto.coverage.blockers.map(row=>reason(row?.reason)))]:[];
  const receiptRows=rows.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE).map((row,index)=>{
   const confirmed=row.coverage==='source-confirmed'&&known(row.signedNanos)&&row.currency==='RUB';
   const numberTone=confirmed&&['broker-fee','cash-fee','tax','stamp-duty','other-fee'].includes(row.kind)?'expense':confirmed?tone(row.signedNanos):'neutral';
   return `<li class="booked-components-receipt" data-booked-receipt-index="${page*PAGE_SIZE+index}" data-coverage="${confirmed?'source-confirmed':'unknown'}"><header><strong>${esc(bookedComponentTitle(row))}</strong><span>${confirmed?'Подтверждённая операция':'Данные не подтверждены'}</span></header>${combinedEligible?'<p data-booked-account>Счёт: '+esc(accounts.find(account=>account.id===row.portfolioId)?.label||'Без названия')+'</p>':''}<dl><div><dt>Дата операции</dt><dd>${esc(date(row.at))}</dd></div><div><dt>Исходная валюта</dt><dd>${esc(typeof row.currency==='string'?row.currency:'Нет данных')}</dd></div><div><dt>Сумма со знаком</dt><dd data-number-tone="${numberTone}">${confirmed?esc(amount(row.signedNanos)):'Нет данных'}</dd></div></dl><p>${confirmed?'Источник: сохранённая отдельная денежная операция. Выплата показана в исходном размере, без пересчёта до налога.':esc(reason(row.reason))}</p></li>`;
  }).join('');
  const pager=rows.length>PAGE_SIZE?`<nav class="booked-components-pagination" aria-label="Страницы операций результата"><span role="status">${page*PAGE_SIZE+1}–${Math.min((page+1)*PAGE_SIZE,rows.length)} из ${rows.length}</span><button type="button" data-booked-page="-1" ${page===0?'disabled':''}>Назад</button><button type="button" data-booked-page="1" ${(page+1)*PAGE_SIZE>=rows.length?'disabled':''}>Дальше</button></nav>`:'';
  const metrics=eligible?[
   ['Результат за интервал',partial?dto.navResultNanos:null,'nav-result'],
   ['Подтверждено операциями',dto.knownSubtotalNanos,'known-subtotal'],
   ['Ещё не объяснено',partial?dto.unallocatedRemainderNanos:null,'unallocated'],
  ].map(([label,value,key])=>`<div data-booked-metric="${key}"><dt>${label}</dt><dd data-number-tone="${key==='unallocated'&&known(value)&&BigInt(value)!==0n?'unknown':tone(value)}">${esc(amount(value))}</dd></div>`).join(''):'';
  const valuations=combinedEligible&&dto.accountValuations.length?'<p>Сохранённые оценки по счетам:</p><ul class="booked-components-list" data-booked-valuations>'+dto.accountValuations.map(row=>'<li class="booked-components-receipt"><strong>'+esc(accounts.find(account=>account.id===row.portfolioId)?.label||'Без названия')+'</strong><dl><div><dt>В начале</dt><dd>'+esc(amount(row.openingNanos))+'</dd></div><div><dt>В конце</dt><dd>'+esc(amount(row.closingNanos))+'</dd></div></dl></li>').join('')+'</ul>':'';
  const transferNote=combinedEligible&&dto.internalTransfers?.authority==='owner-confirmed'?'<p class="booked-components-boundary" data-booked-transfers>Отмеченные владельцем внутренние пары: денежные — '+count(dto.internalTransfers.cashPairCount)+', акции — '+count(dto.internalTransfers.sharePairCount)+'. Денежные пары исключены из внешних потоков выбранного набора. Стоимость перевода акций отдельно не вычисляется. Отметка владельца и дата поручения не подтверждают расчёты у брокера.</p>':'';
  const observedBounds=[dto?.period?.observedFrom,dto?.period?.observedTo].map(value=>typeof value==='string'&&Number.isFinite(Date.parse(value)));
  const observedPeriod=observedBounds.every(Boolean)?`${esc(shortDate(dto.period.observedFrom))} — ${esc(shortDate(dto.period.observedTo))}${dto.period.partialPeriod?' · <span>часть выбранного периода</span>':''}`:observedBounds.some(Boolean)?'Недостаточно оценок за выбранный период':'Нет оценок за выбранный период';
  // Shared widgets own their instances and DOM references. Restore them before
  // returning so synchronous period rendering cannot observe missing controls.
  const persistentUi=[...host.querySelectorAll('[data-persist-ui]')];
  host.innerHTML=`<section class="booked-components-disclosure" aria-labelledby="bookedResultTitle"><header class="financial-section-head"><div><h3 id="bookedResultTitle">Результат в деньгах</h3><p>Изменение стоимости за вычетом пополнений и выводов.</p></div><span class="booked-components-status" role="status">${synthetic?'Учебные данные':partial?'Сохранённые данные':'Недостаточно данных'}</span></header><div class="booked-components-body">
   ${unavailable?valueHistoryEstimate(data?.portfolio)+'<p>'+esc(unavailable)+'</p>':`
   ${partial?'':valueHistoryEstimate(data?.portfolio)}
   <p class="financial-period">${combinedEligible?'Все выбранные счета':esc(account?.label||'Выбранный счёт')} · ${observedPeriod}</p>
   <dl class="booked-components-metrics"${partial?'':' data-unconfirmed'}>${metrics}</dl>
   <p class="booked-components-boundary">Причины остатка ещё не установлены. Он не означает подтверждённую рыночную прибыль. Денежная сверка не выполнена.</p>
   ${!partial?'<p class="booked-components-unavailable">Подтверждённый результат появится, когда будут сохранены оценки на обеих границах периода. Известные операции показаны отдельно.</p>':''}
   <dl class="booked-components-inputs"><div><dt>Оценка в начале</dt><dd>${esc(amount(dto.openingNanos))}</dd></div><div><dt>Оценка в конце</dt><dd>${esc(amount(dto.closingNanos))}</dd></div><div><dt>Пополнения минус выводы</dt><dd>${esc(amount(dto.netExternalFlowNanos))}</dd></div></dl>
   <details class="booked-components-receipts" ${receiptsOpen?'open':''}><summary>Операции и способ расчёта · ${rows.length}</summary>
   ${rows.length?'<ol class="booked-components-list">'+receiptRows+'</ol>'+pager:!dto.coverage?.confirmedNoCandidates?'<p>Нет подтверждённых записей. Неизвестная сумма не заменяется нулём.</p>':''}
   <h4>Как получены суммы</h4>${financialFormula('bookedResult')}${financialFormulaVariables('bookedResult')}${financialFormula('bookedRemainder')}${financialFormulaVariables('bookedRemainder')}
   <dl class="booked-components-periods"><div><dt>Интервал сохранённых наблюдений</dt><dd>${esc(range(dto.period?.observedFrom,dto.period?.observedTo))}</dd></div><div><dt>Выбранный период</dt><dd>${esc(range(dto.period?.requestedFrom,dto.period?.requestedTo))}</dd></div></dl>
   <p class="booked-components-evidence">${combinedEligible?(dto.evidence?.independentSavedPair===true?'Для каждого счёта использована независимая пара оценок с одинаковыми границами наблюдений.':'Независимые пары оценок всех счетов с одинаковыми границами не подтверждены.'):(dto.evidence?.independentSavedPair===true?'Использована независимая пара сохранённых оценок.':'Независимая пара сохранённых оценок не подтверждена.')} Время сохранения не подтверждает точное время состояния у брокера.${combinedEligible?' Сумма оценок не подтверждает одновременное состояние счетов.':''}</p>
   ${valuations}${transferNote}<p>${esc(bookedComponentScopeText(dto.coverage.componentScope))}</p><p class="booked-components-counts">Подтверждённых операций: ${count(dto.coverage?.knownComponentCount)}. Неизвестных: ${count(dto.unknownComponentCount)}. Внешних денежных событий: ${count(dto.coverage?.externalFlowCount)}.</p>
   ${blockers.length?'<ul class="booked-components-blockers">'+blockers.map(item=>'<li>'+esc(item)+'</li>').join('')+'</ul>':''}${dto.coverage?.candidateScanComplete===true?'':'<p class="booked-components-scan">Полнота просмотра операций не подтверждена.</p>'}${dto.coverage?.confirmedNoCandidates===true?'<p class="booked-components-empty">В просмотренных записях нет поддерживаемых денежных операций. Это не подтверждает отсутствие всех доходов и расходов.</p>':''}
   <p class="booked-components-boundary">Нулевой остаток сам по себе не подтверждает полную денежную сверку. Ценовые и валютные причины отдельно не установлены.</p></details>`}
  </div></section>`;
  host.querySelector('.booked-components-body')?.append(...persistentUi);
  if(explanationHost){const anchor=host.querySelector('.booked-components-receipts');if(anchor)anchor.before(explanationHost);else host.querySelector('.booked-components-body')?.append(explanationHost);}
  const outer=host.querySelector('#bookedResultTitle');if(outer)outer.tabIndex=-1;
  if(active&&scopeChanged)outer?.focus({preventScroll:true});
  else if(focusedPage!==undefined)(host.querySelector(`[data-booked-page="${focusedPage}"]:not(:disabled)`)||host.querySelector('[data-booked-page]:not(:disabled)')||host.querySelector('.booked-components-receipts>summary')||outer)?.focus({preventScroll:true});
  else if(['booked-components-disclosure','booked-components-receipts'].includes(focusedDetails))(host.querySelector('.'+focusedDetails+'>summary')||outer)?.focus({preventScroll:true});
  else if(extensionFocus&&active.isConnected)active.focus({preventScroll:true});
  else if(active&&!active.isConnected)outer?.focus({preventScroll:true});
 }
 function getEvidenceState(){drain();return {signature:evidenceSignature,eligible:evidenceEligible,surfaceRevision,open:Boolean(host?.querySelector('.booked-components-disclosure'))&&!host.closest('[hidden]')};}
 function clearEvidenceReturn(){evidenceReturn=null;host?.querySelectorAll('[data-booked-evidence-return]').forEach(node=>node.remove());}
 function revealEvidence({kind,receiptIndex,expectedSignature,returnFocus,isCurrent}={}){
  const guarded=()=>!disposed&&typeof isCurrent==='function'&&isCurrent()===true&&getEvidenceState().eligible&&evidenceSignature===expectedSignature;
  if(!guarded()||!['component-receipt','basis-and-method'].includes(kind))return false;
  const count=lastData?.portfolio?.resultComponents?.components?.length||0;
  if(kind==='component-receipt'&&(!Number.isSafeInteger(receiptIndex)||receiptIndex<0||receiptIndex>=count)||kind==='basis-and-method'&&receiptIndex!==null)return false;
  if(kind==='component-receipt'){page=Math.floor(receiptIndex/PAGE_SIZE);signature='';update(lastData);}
  if(!guarded())return false;
  const outer=host.querySelector('.booked-components-disclosure'),details=host.querySelector('.booked-components-receipts');if(!outer||!details)return false;
  if(kind==='component-receipt'&&!details.open)details.open=true;
  const target=kind==='component-receipt'?host.querySelector(`[data-booked-receipt-index="${receiptIndex}"]`):host.querySelector('.booked-components-inputs');if(!target||!guarded())return false;
  host.querySelectorAll('[data-booked-evidence-return]').forEach(node=>node.remove());
  const back=document.createElement('button');back.type='button';back.dataset.bookedEvidenceReturn='';back.textContent='Вернуться к объяснению';target.after(back);evidenceReturn={returnFocus,expectedSignature};
  target.tabIndex=-1;target.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});if(!guarded())return false;target.focus({preventScroll:true});return guarded();
 }
 return {update,getEvidenceState,revealEvidence,clearEvidenceReturn,dispose(){disposed=true;observer.disconnect();host?.removeEventListener('click',click);evidenceReturn=null;}};
}
