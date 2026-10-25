import {decimalNanos} from './number-format.js';
import {validPositionBalance} from './position-balance-contract.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const states={'not-performed':'Сравнение не выполнено',partial:'Сравнение с ограничениями',matched:'Количество совпало',mismatch:'Есть расхождение количества'};
const explanations={
 missing_balance_pair:'Нужны два сохранённых баланса бумаг внутри выбранного периода.',
 unknown_balance_contract:'В старых наблюдениях не сохранены исходные признаки наличия полей баланса. Нужны два новых наблюдения.',
 invalid_balance_observation:'Целостность исходного баланса бумаг не подтверждена.',
 conflicting_balance_observation:'На одно время сохранены разные балансы; однозначная пара не выбрана.',
 unknown_balance_timing:'Не подтверждён интервал получения баланса бумаг.',
 overlapping_balance_windows:'Интервалы получения двух балансов пересекаются.',
 ambiguous_balance_identity:'В балансе есть повторяющийся или неизвестный идентификатор инструмента.',
 balance_limits_loading:'Источник ещё загружал лимиты или не подтвердил их готовность. Расчёт изменений недоступен.',
 balance_source_scan_limit:'Объём сохранённых балансов превышает предел этого сравнения.',
 execution_boundary_timing:'Исполнение попало в интервал получения баланса. Нельзя однозначно отнести его к периоду сравнения.',
 transfer_quantity_details_missing:'Для перевода нужны согласованные количество, исполненная часть и остаток из одного сообщения брокера.',
 conflicting_transfer_quantities:'Сохранённые сведения об исполненном количестве перевода противоречат друг другу.',
 unexpected_transfer_executions:'В переводе найдены сделки; однозначный состав движения бумаг не подтверждён.',
 unknown_transfer_timing:'Не подтверждено время сохранения начального и конечного наблюдения для сравнения перевода.',
 transfer_boundary_timing:'Дата перевода попадает в интервал получения снимка; принадлежность к сравнению неоднозначна.',
 unverified_transfer_time:'Переводы отнесены к интервалу по дате поручения; время фактического зачисления или списания отдельно не подтверждено.',
 missing_saved_pair:'Нужны два независимо сохранённых состава портфеля внутри выбранного периода.',
 no_share_observations:'В сохранённых составах нет доступных количеств обычных акций для сравнения.',
 unknown_source_time:'Время состояния у брокера неизвестно. Использовано время сохранения наблюдений на устройстве.',
 incomplete_requested_period:'Сохранённые наблюдения покрывают только часть выбранного периода.',
 incomplete_positions:'Полнота списков позиций не подтверждена. Отсутствие строки не означает нулевой остаток.',
 unknown_quantity_unit:'Единицы количества не подтверждены для полного сравнения.',
 unknown_position_quantity:'Количество позиции неизвестно; пропуск не заменяется нулём.',
 unknown_absent_position:'Инструмента нет в неполном снимке; нулевой остаток не подтверждён.',
 incomplete_operations:'Полная загрузка операций между наблюдениями не подтверждена.',
 unsupported_quantity_policy:'Не подтверждено, что учтены все виды событий изменения количества.',
 unverified_action_completeness:'Сравнение использует сохранённые события; полнота всех корпоративных действий отдельно не подтверждена.',
 unsupported_quantity_event:'Есть перенос, корпоративное действие или другой неподдержанный вид события.',
 unsupported_asset:'В этом сравнении поддерживаются только обычные акции.',
 unknown_execution_detail:'Полный набор исполнений операции не подтверждён.',
 unknown_operation_quantity:'Количество исполненной операции неизвестно.',
 unknown_execution_quantity:'Количество исполнения неизвестно.',
 unknown_operation_state:'Исполнение операции не подтверждено.',
 invalid_operation_time:'Время операции или исполнения неизвестно.',
 reconstructed_boundary:'Расчётная история не заменяет независимо сохранённый состав портфеля.',
 invalid_requested_period:'Для сравнения нужны корректные начало и конец периода.',
 snapshots_outside_period:'Нет подходящей пары сохранённых наблюдений внутри выбранного периода.',
 unordered_snapshots:'Нужны два наблюдения с разным временем: конечное позже начального.',
 invalid_snapshot_time:'Время сохранённых наблюдений не подтверждено.',
 unknown_snapshot_provenance:'Происхождение сохранённых наблюдений не подтверждено.',
 account_scope_mismatch:'Наблюдения не относятся к одному подтверждённому счёту.',
 operation_scope_mismatch:'Операция и её исполнения не относятся к одному подтверждённому счёту и инструменту.',
 invalid_instrument_identity:'Не удалось точно сопоставить инструмент между наблюдениями.',
 duplicate_position:'В одном снимке есть несколько строк одного инструмента.',
 duplicate_operation:'Одна операция передана несколько раз.',
 source_identity_conflict:'Сохранённые сведения могут описывать одну операцию. Независимость записей не подтверждена.',
 duplicate_execution:'Одно исполнение передано несколько раз.',
 execution_total_mismatch:'Сумма исполнений не совпадает с полным количеством операции.',
 execution_details_unavailable:'Не удалось проверить исходные сведения об исполненном количестве.',
 conflicting_execution_details:'Сведения об исполненной или оставшейся части противоречат сохранённым сделкам.',
 partial_execution_details_missing:'Для частичного исполнения нужны согласованные количество, исполненная часть и остаток из одного сообщения брокера.',
 conflicting_execution_state:'У неисполненной операции есть сделки или ненулевое исполненное количество; движение бумаг не подтверждено.',
 inconsistent_execution_side:'Направление исполнения не совпадает с операцией.',
};
const reason=item=>explanations[item?.code]||'Недостаточно подтверждённых данных для полного сравнения.';
const reasons=items=>[...new Set((Array.isArray(items)?items:[]).map(reason))];
const number=(value,unit)=>typeof value==='string'&&/^-?\d+$/.test(value)?decimalNanos(value,{digits:9})+(unit==='instrument-units'?' шт.':''):'Нет данных';
const date=value=>{const time=typeof value==='string'?Date.parse(value):NaN;return Number.isFinite(time)?new Date(time).toLocaleString('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'})+' мск':'Нет данных';};
const period=value=>`${date(value?.from)} — ${date(value?.to)}`;
const list=values=>values.length?'<ul>'+values.map(value=>'<li>'+esc(value)+'</li>').join('')+'</ul>':'';

/** Render the public quantity DTO only; never derive totals or match by ticker. */
export function createPositionReconciliation({host,getInstrumentLabel=()=>({name:'Название недоступно'})}){
 let signature='',scope='',source='portfolio',latest=null;
 const change=event=>{if(event.target?.matches('[data-position-source]')&&['portfolio','balance'].includes(event.target.value)){
  source=event.target.value;update(latest);
 }};
 host?.addEventListener('change',change);
 function update(data){
  if(!host)return;
  latest=data;
  const reference=data?.portfolio?.positionReconciliation,wrapper=data?.portfolio?.positionBalanceComparison,balance=source==='balance';
  const balanceValid=validPositionBalance(wrapper,reference);
  const dto=balance?(balanceValid?wrapper.comparison:{...reference,state:'not-performed',rows:[],blockers:[{code:wrapper?'invalid_balance_observation':'unknown_balance_contract'}]}):reference;
  const valid=['position-quantity-comparison-v1','position-quantity-comparison-v2','position-quantity-comparison-v3'].includes(dto?.contractVersion);
  const transfers=dto?.contractVersion==='position-quantity-comparison-v3';
  const ids=Array.isArray(dto?.scope?.portfolioIds)?dto.scope.portfolioIds:[],single=valid&&dto.scope?.kind==='single-account'&&ids.length===1;
  const accounts=data?.clientProduct?.portfolios||[],account=single?accounts.find(item=>item.id===ids[0]):null;
  const multi=valid&&dto.scope?.kind==='multi-account'||accounts.length>1&&!single;
  const rows=single&&account&&['partial','matched','mismatch'].includes(dto.state)&&Array.isArray(dto.rows)?dto.rows:[];
  const named=rows.map(row=>({row,label:getInstrumentLabel(row.instrumentUid)||{}}));
  const nextScope=JSON.stringify([ids,dto?.requestedPeriod]),nextSignature=JSON.stringify([source,dto,balance?wrapper:null,named.map(item=>item.label),account?.label,multi]);
  if(nextSignature===signature)return;
  const expanded=nextScope===scope&&host.querySelector('.position-reconciliation-items')?.open;
  const limitsExpanded=nextScope===scope&&host.querySelector('.position-reconciliation-limits')?.open;
  const focused=host.contains(document.activeElement)?document.activeElement.matches('[data-position-source]')?'source':document.activeElement.closest('details')?.className:null;
  const focusedPart=nextScope===scope&&host.contains(document.activeElement)?document.activeElement.closest('[data-position-parts]')?.dataset.positionParts:null;
  const openParts=nextScope===scope?[...host.querySelectorAll('[data-position-parts][open]')].map(item=>item.dataset.positionParts):[];
  signature=nextSignature;scope=nextScope;
  const state=single&&account&&states[dto.state]?dto.state:'not-performed';
  host.dataset.state=state;
  const limitations=reasons(dto?.blockers),fixture=valid&&(dto.observedPeriod?.timeBasis==='fixture-exact'||dto.evidence?.dataMode==='synthetic');
  const unavailable=multi?'Выберите один счёт в поле «Счёт портфеля» вверху страницы. Количество по разным счетам не объединяется.':!valid?'Для выбранного периода сравнение количества пока недоступно.':!account?'Данные сравнения не соответствуют выбранному счёту.':limitations[0]||'Для сравнения нужны два сохранённых состава портфеля и известные операции между ними.';
  const body=named.map(({row,label},index)=>{
   const sourceParts=balance&&balanceValid?wrapper.parts[index]:null;
   const knownUnit=row.unit==='instrument-units',rowState=states[row.state]?row.state:'partial';
   const partial=['position-quantity-comparison-v2','position-quantity-comparison-v3'].includes(dto.contractVersion)&&Number.isSafeInteger(row.partialExecutionCount)
    &&row.partialExecutionCount>0&&row.partialExecutionCount<=30000&&typeof row.observedDifferenceNanos==='string'
    &&/^-?(?:0|[1-9]\d*)$/.test(row.observedDifferenceNanos)?row.partialExecutionCount:0;
   const title=label.ticker||label.name||'Название недоступно',subtitle=label.name&&label.name!==title?label.name:'';
   const transferCount=transfers&&Number.isSafeInteger(row.transferCount)&&row.transferCount>0&&row.transferCount<=30000
    &&Number.isSafeInteger(row.partialTransferCount)&&row.partialTransferCount>=0&&row.partialTransferCount<=row.transferCount
    &&knownUnit&&[row.transferredInQuantityNanos,row.transferredOutQuantityNanos].every(value=>typeof value==='string'&&/^(?:0|[1-9]\d*)$/.test(value))
    &&[row.transferredInQuantityNanos,row.transferredOutQuantityNanos].some(value=>BigInt(value)>0n)
    &&typeof row.observedDifferenceNanos==='string'&&/^-?(?:0|[1-9]\d*)$/.test(row.observedDifferenceNanos)?row.transferCount:0;
   const values=[['Количество в начале',row.openingQuantityNanos],['Покупки',row.boughtQuantityNanos],['Продажи',row.soldQuantityNanos],
    ...(transfers?[['Входящие переводы',row.transferredInQuantityNanos],['Исходящие переводы',row.transferredOutQuantityNanos]]:[]),
    ['Расчётный остаток',row.expectedClosingQuantityNanos],['Количество в конце',row.closingQuantityNanos],[rowState==='partial'?'Наблюдаемая разница':'Расхождение количества',rowState==='partial'?row.observedDifferenceNanos:row.residualNanos]];
   const transferNote=transferCount?'<p class="position-reconciliation-limit" data-position-transfers>Переводов: '+transferCount
    +(row.partialTransferCount?' · частично исполненных: '+row.partialTransferCount:'')+'. Учтено исполненное количество по дате поручения. Неисполненный остаток исключён. Время фактического зачисления или списания отдельно не подтверждено.</p>':'';
   const partsMarkup=sourceParts?`<details class="position-reconciliation-parts" data-position-parts="${esc(row.instrumentUid)}" ${openParts.includes(row.instrumentUid)?'open':''}><summary>Свободные и заблокированные бумаги</summary>${[['opening','В начале'],['closing','В конце']].map(([key,title])=>{
    const part=sourceParts[key];return `<h5>${title}</h5><dl>${[['Свободно',part.freeQuantityNanos],['Заблокировано заявками',part.blockedQuantityNanos],['Всего',part.totalQuantityNanos]].map(([label,value])=>`<div><dt>${label}</dt><dd>${esc(number(value,'instrument-units'))}</dd></div>`).join('')}</dl>${part.presence==='absent'?'<p>Инструмента нет в явно полученном полном списке бумаг. Остаток в этом наблюдении принят равным нулю.</p>':part.presence==='unknown'?'<p>Состав бумаг или идентичность инструмента не подтверждены; нулевой остаток неизвестен.</p>':''}${part.exchangeBlocked===true?'<p>Источник также указал блокировку на бирже. Это признак состояния, дополнительное количество не прибавляется.</p>':''}`;
   }).join('')}</details>`:'';
   return `<article class="position-reconciliation-row" aria-labelledby="positionQuantityRow${index}"><header><div><h4 id="positionQuantityRow${index}">${esc(title)}</h4>${subtitle?'<p>'+esc(subtitle)+'</p>':''}</div><span>${esc(states[rowState])}</span></header><dl>${values.map(([name,value])=>`<div><dt>${name}</dt><dd>${esc(number(value,row.unit))}</dd></div>`).join('')}</dl>${partsMarkup}${partial?'<p class="position-reconciliation-limit" data-position-partial-executions>Частично исполненных операций: '+partial+'. Учтены только сделки внутри интервала наблюдений. Неисполненный остаток не прибавляется к позиции.</p>':''}${transferNote}${!knownUnit?'<p>Единицы количества не подтверждены для полного сравнения.</p>':''}${rowState==='partial'?'<p class="position-reconciliation-limit">Наблюдаемая разница — только арифметика доступных данных. Даже ноль не подтверждает полную сверку.</p>':''}${list(reasons(row.blockers))}</article>`;
  }).join('');
  host.innerHTML=`<header class="position-reconciliation-head"><div><h3 id="positionReconciliationTitle">Количество акций</h3><p>${balance?'Сравнение двух сохранённых балансов бумаг':'Сравнение двух сохранённых составов портфеля'}${account?.label?' · '+esc(account.label):''}</p></div><strong class="position-reconciliation-state" role="status">${esc(states[state])}</strong></header>
   <label class="position-reconciliation-source">Источник количества<select data-position-source aria-label="Источник количества"><option value="portfolio" ${balance?'':'selected'}>Состав портфеля</option><option value="balance" ${balance?'selected':''}>Баланс бумаг</option></select></label>
   ${balance?'<p class="position-reconciliation-method">Баланс бумаг (GetPositions): свободное количество + бумаги, заблокированные заявками. Сравнение использует время получения ответа; точное время состояния у брокера неизвестно.</p>':''}
   ${fixture?'<p class="position-reconciliation-fixture">Учебный пример · сравнение построено на синтетических данных.</p>':''}
   ${rows.length?`<p class="position-reconciliation-summary">Инструментов: ${rows.length}. ${state==='partial'?'Полная сверка количества не подтверждена.':state==='mismatch'?'Конечные количества отличаются от расчётных.':'Конечные количества совпали с расчётными в пределах этого сравнения.'}</p>`:'<p class="position-reconciliation-summary">'+esc(unavailable)+'</p>'}
   ${valid&&single&&account?`<dl class="position-reconciliation-periods"><div><dt>Выбранный период</dt><dd>${esc(period(dto.requestedPeriod))}</dd></div><div><dt>Сохранённые наблюдения</dt><dd>${esc(period(dto.observedPeriod))}</dd></div></dl>`:''}
   ${rows.length?`<details class="position-reconciliation-items" ${expanded?'open':''}><summary>Инструменты и расчёт · ${rows.length}</summary><p class="position-reconciliation-method">Начало + покупки − продажи${transfers?' + входящие переводы − исходящие переводы':''} = расчётный остаток. Разница = количество в конце − расчётный остаток.${transfers?' Для переводов используется дата поручения.':''}</p>${body}</details>`:''}
   ${single&&account&&limitations.length?`<details class="position-reconciliation-limits" ${limitsExpanded?'open':''}><summary>Ограничения сравнения · ${limitations.length}</summary>${list(limitations)}</details>`:''}
   <p class="position-reconciliation-boundary">Сравнивается количество обычных акций. Денежный результат, стоимость портфеля и доходность здесь не сверяются.</p>`;
  if(['position-reconciliation-items','position-reconciliation-limits'].includes(focused))host.querySelector('.'+focused+'>summary')?.focus({preventScroll:true});
  if(focused==='source')host.querySelector('[data-position-source]')?.focus({preventScroll:true});
  if(focusedPart)[...host.querySelectorAll('[data-position-parts]')].find(item=>item.dataset.positionParts===focusedPart)?.querySelector('summary')?.focus({preventScroll:true});
 }
 return {update,dispose(){host?.removeEventListener('change',change);latest=null;}};
}
