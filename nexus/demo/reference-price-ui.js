import {decimalNanos} from './number-format.js';
import {financialFormula,financialFormulaVariables} from './financial-formulas.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const date=value=>{const time=Date.parse(value);return Number.isFinite(time)?new Date(time).toLocaleDateString('ru-RU',{timeZone:'Europe/Moscow'}):'Дата неизвестна';};
const timestamp=value=>{const time=Date.parse(value);return Number.isFinite(time)?new Date(time).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})+' мск':'Время неизвестно';};
const day=value=>{const time=Date.parse(value);return Number.isFinite(time)?new Date(time).toLocaleDateString('en-CA',{timeZone:'Europe/Moscow'}):null;};
const price=value=>typeof value==='string'&&/^\d+$/.test(value)?decimalNanos(value,{digits:9})+' ₽':'Нет данных';
const rate=value=>value===0?'0 %':Math.abs(value)<.0001?(value<0?'>−0,01 %':'<0,01 %'):(value>0?'+':'−')+(Math.abs(value)*100).toLocaleString('ru-RU',{maximumFractionDigits:2})+' %';
const validCandidate=item=>item&&typeof item.instrumentUid==='string'&&item.instrumentUid.length>0&&item.ref?.instrumentUid===item.instrumentUid&&item.ref?.namespace==='tinvest:broker'&&['eligible','ineligible','unknown'].includes(item.eligibility?.state)&&(item.eligibility.state!=='eligible'||(['share','etf'].includes(item.assetType)&&item.currency==='RUB'&&item.priceUnit==='currency'));
const candidateLabel=item=>{const ticker=item.ticker&&item.ticker!==item.instrumentUid?item.ticker:'',name=item.name&&item.name!==item.instrumentUid&&item.name!==ticker?item.name:'';return [ticker,name,...(!ticker&&!name?['Инструмент без подтверждённого названия']:[]),item.classCode,item.exchange].filter(Boolean).join(' · ');};
const boundary=value=>value&&typeof value.valueNanos==='string'&&/^\d+$/.test(value.valueNanos)&&BigInt(value.valueNanos)>0n&&/^\d{4}-\d{2}-\d{2}$/.test(value.sessionDate);
const disclaimer='Изменение опубликованной котировки. Выплаты не включены; корректировки корпоративных действий источником не подтверждены.';

/** Saved-only price reference. The server owns source validation and calculation; this UI never loads candles. */
export function createReferencePriceUi({host,request,getScopeKey=()=>'',getPortfolioId=()=>''}){
 let currentData=null,scope=null,queryKey='',selection='',candidates=[],revision=0,controller=null,destroyed=false;
 if(!host)return {update(){},refresh(){},destroy(){}};
 host.classList.add('reference-price');
 host.setAttribute('aria-label','Ценовой ориентир');
 host.innerHTML=`<header class="reference-price-head"><div><h3>Ценовой ориентир</h3><p>Изменение котировки, без выплат</p></div><span class="reference-price-tag">Сохранённые данные</span></header>
 <p class="reference-price-intro">Выберите акцию или фонд в RUB. Используем только уже сохранённые дневные цены; новые котировки здесь не загружаются.</p>
 <div class="reference-price-controls"><label>Инструмент ориентира<select data-reference-select aria-label="Инструмент ценового ориентира"><option value="">Выберите инструмент</option></select></label><button type="button" class="button" data-reference-refresh>Проверить снова</button></div>
 <p class="reference-price-status" data-reference-status role="status" aria-live="polite"></p>
 <div class="reference-price-result" data-reference-result hidden><div class="reference-price-measure"><span>Закрытие → закрытие</span><strong data-reference-rate>Нет данных</strong></div><p data-reference-observed></p><p data-reference-partial hidden>Доступная часть выбранного периода. Начало или конец не совпадают с выбранными границами.</p><p data-reference-freshness></p></div>
 <p class="reference-price-disclaimer" data-reference-disclaimer hidden></p>
 <details data-reference-details hidden><summary>Даты, источник и ограничения</summary>${financialFormula('referencePrice')}${financialFormulaVariables('referencePrice')}<dl data-reference-facts></dl><p class="reference-price-method">Дневное закрытие допускается после конца соответствующего дня по Москве. Даты между наблюдениями не заполняются; непрерывность ряда не подтверждена.</p></details>`;
 const find=name=>host.querySelector(`[data-reference-${name}]`),select=find('select'),refreshButton=find('refresh');
 const controls={select:event=>{selection=event.target.value;void refresh();},refresh:()=>void refresh()};
 select.addEventListener('change',controls.select);refreshButton.addEventListener('click',controls.refresh);
 function resetResult(){find('result').hidden=true;find('rate').textContent='Нет данных';find('rate').dataset.numberTone='neutral';find('observed').textContent='';find('partial').hidden=true;find('freshness').textContent='';find('disclaimer').hidden=true;find('details').hidden=true;find('facts').innerHTML='';}
 function status(state,message){host.dataset.state=state;host.setAttribute('aria-busy',String(state==='loading'));find('status').textContent=message;refreshButton.textContent=state==='loading'?'Начать проверку заново':'Проверить снова';}
 function query(){const chosen=currentData?.selectedPeriod||{};const params=new URLSearchParams({period:'custom',from:chosen.from||'',to:chosen.to||''});const id=getPortfolioId();if(id)params.set('portfolioId',id);return params;}
 function currentScope(){return JSON.stringify([getScopeKey(currentData),getPortfolioId()]);}
 function renderCandidates(){
  const counts=new Map();for(const item of candidates){const label=candidateLabel(item);counts.set(label,(counts.get(label)||0)+1);}
  const placeholder=candidates.length>0&&!candidates.some(item=>item.eligibility.state==='eligible')?'Нет доступных инструментов':'Выберите инструмент';
  select.innerHTML=`<option value="">${placeholder}</option>`+candidates.map(item=>{const label=candidateLabel(item),enabled=item.eligibility.state==='eligible';return `<option value="${escape(item.instrumentUid)}" ${enabled?'':'disabled'}>${escape(label+(counts.get(label)>1?' · '+item.instrumentUid:'')+(enabled?'':' · '+(item.eligibility.reason||'Данные инструмента не подтверждены')))}</option>`;}).join('');
  if(selection&&!candidates.some(item=>item.instrumentUid===selection))select.insertAdjacentHTML('beforeend',`<option value="${escape(selection)}">Выбранный инструмент сейчас недоступен</option>`);
  select.value=selection;select.disabled=!candidates.some(item=>item.eligibility.state==='eligible')&&!selection;
 }
 function present(dto){
  const rows=Array.isArray(dto?.candidates)?dto.candidates:[];
  if(dto?.contractVersion!=='reference-price-v1'||dto.basis!=='saved-quote-change-excluding-income'||!rows.every(validCandidate)||new Set(rows.map(item=>item.instrumentUid)).size!==rows.length||!['calculated','unavailable'].includes(dto.state))throw new Error('Данные ориентира не прошли проверку формата.');
  const requestedAccount=getPortfolioId(),ids=dto.scope?.portfolioIds,expectedIds=requestedAccount?[requestedAccount]:(currentData?.clientProduct?.portfolios||[]).map(item=>item.id);
  if(!Array.isArray(ids)||ids.some(id=>typeof id!=='string'||!id)||new Set(ids).size!==ids.length||JSON.stringify([...ids].sort())!==JSON.stringify([...new Set(expectedIds)].sort()))throw new Error('Источник ответа не соответствует выбранным счетам.');
  const expectedFrom=Date.parse(currentData?.selectedPeriod?.from),expectedTo=Date.parse(currentData?.selectedPeriod?.to),from=Date.parse(dto.selectedPeriod?.from),to=Date.parse(dto.selectedPeriod?.to);
  if(!Number.isFinite(expectedFrom)||!Number.isFinite(expectedTo)||from!==expectedFrom||to!==expectedTo||dto.selectedPeriod?.timeZone!=='Europe/Moscow'||[dto.opening,dto.closing].some(item=>item&&(!Number.isFinite(Date.parse(item.sourceAt))||Date.parse(item.sourceAt)<from||Date.parse(item.sourceAt)>to||!Number.isFinite(Date.parse(item.availableAt))||Date.parse(item.availableAt)<Date.parse(item.sourceAt)||Date.parse(item.availableAt)>to||item.sessionDate!==day(item.sourceAt))))throw new Error('Даты ответа не соответствуют выбранному периоду.');
  if(dto.instrument&&(!validCandidate(dto.instrument)||dto.instrument.instrumentUid!==selection||!rows.some(item=>item.instrumentUid===selection)))throw new Error('Источник ответа не соответствует выбранному инструменту.');
  const calculated=dto.state==='calculated';
  if(calculated&&(!ids.length||!selection||!dto.instrument||dto.instrument.eligibility.state!=='eligible'||!boundary(dto.opening)||!boundary(dto.closing)||dto.opening.sessionDate>=dto.closing.sessionDate||typeof dto.priceChangeRate!=='number'||!Number.isFinite(dto.priceChangeRate)))throw new Error('Недостаточно подтверждённых наблюдений для изменения цены.');
  candidates=rows;renderCandidates();host.querySelector('.reference-price-tag').textContent=dto.evidence?.dataMode==='synthetic'?'Учебные данные':'Сохранённые данные';
  const noEligible=!selection&&rows.length>0&&!rows.some(item=>item.eligibility.state==='eligible');
  const eligibilityReason=noEligible?'В сохранённых данных нет доступных акций или фондов в RUB. '+[...new Set(rows.map(item=>item.eligibility.reason).filter(Boolean))].slice(0,3).join(' · '):null;
  status(dto.state,!selection?(eligibilityReason||dto.reason||'Выберите инструмент, чтобы увидеть изменение сохранённой котировки.'):(dto.reason|| (calculated?'Изменение котировки за фактический интервал.':'Сопоставимое изменение цены недоступно.')));
  const hasObservations=Boolean(dto.opening||dto.closing);
  find('result').hidden=!selection;find('rate').textContent=calculated?rate(dto.priceChangeRate):'Нет данных';
  find('rate').dataset.numberTone=!calculated||dto.priceChangeRate===0?'neutral':dto.priceChangeRate>0?'positive':'negative';
  find('observed').textContent=hasObservations?`${dto.opening?date(dto.opening.sessionDate):'Начальная цена не найдена'} → ${dto.closing?date(dto.closing.sessionDate):'Конечная цена не найдена'}`:'Для двух завершённых дневных наблюдений пока недостаточно данных.';
  find('partial').hidden=!selection||!dto.coverage?.partialPeriod||!dto.opening||!dto.closing||dto.opening.sessionDate===dto.closing.sessionDate;
  const freshness=dto.freshness||{};
  find('freshness').textContent=freshness.state==='stale'?'Сохранённый источник устарел. '+(freshness.reason||'Актуальность этих данных не подтверждена.'):freshness.state==='unknown'?'Актуальность сохранённого источника неизвестна.':freshness.lastCapturedAt?'Последнее сохранение: '+timestamp(freshness.lastCapturedAt)+'.':'';
  find('disclaimer').hidden=!selection;find('disclaimer').textContent=dto.disclaimer||disclaimer;
  find('details').hidden=!selection;
  const item=dto.instrument||candidates.find(row=>row.instrumentUid===selection);
  const facts=[['Выбранный период',`${date(dto.selectedPeriod?.from)} — ${date(dto.selectedPeriod?.to)} · мск`],['Начальная цена закрытия',price(dto.opening?.valueNanos)],['Конечная цена закрытия',price(dto.closing?.valueNanos)],['Источник',item?['Т-Инвестиции',item.classCode,item.exchange,item.currency||'Валюта неизвестна'].filter(Boolean).join(' · '):'Не подтверждён'],['Точный инструмент',item?.instrumentUid||selection],['Дневных наблюдений',Number.isSafeInteger(dto.coverage?.pointCount)?String(dto.coverage.pointCount):'Не подтверждено'],['Сохранение начальной / конечной цены',`${timestamp(dto.opening?.capturedAt)} / ${timestamp(dto.closing?.capturedAt)}`],['Закрытия доступны не раньше',`${timestamp(dto.opening?.availableAt)} / ${timestamp(dto.closing?.availableAt)}`],['Время источника','Дата свечи обозначает день наблюдения, сохранение — локальное получение. Точное время состояния у провайдера не подтверждено.'],['Корпоративные действия',dto.coverage?.adjustmentBasis==='unknown'?'Основа корректировок не подтверждена.':'Сведения о корректировках: '+(dto.coverage?.adjustmentBasis||'не подтверждены')]];
  find('facts').innerHTML=facts.map(([label,value])=>`<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('');
 }
 async function refresh(){
  if(destroyed||!currentData)return;
  const nextScope=currentScope();if(scope!==nextScope){scope=nextScope;selection='';candidates=[];renderCandidates();find('details').open=false;}
  const params=query();queryKey=params.toString();if(selection)params.set('instrumentUid',selection);
  controller?.abort();controller=new AbortController();const ownController=controller,ownRevision=++revision,ownScope=scope,ownSelection=selection,ownQuery=queryKey;
  if(!Number.isFinite(Date.parse(currentData?.selectedPeriod?.from))||!Number.isFinite(Date.parse(currentData?.selectedPeriod?.to))){resetResult();status('unavailable','Выберите период, чтобы проверить сохранённые цены.');return;}
  resetResult();status('loading',selection?'Проверяем сохранённые цены выбранного инструмента…':'Проверяем доступные сохранённые инструменты…');
  try{
   const dto=await request('/api/analytics/reference-price?'+params.toString(),{signal:ownController.signal});
   if(destroyed||ownRevision!==revision||ownScope!==currentScope()||ownSelection!==selection||ownQuery!==query().toString())return;
   present(dto);
  }catch(error){
   if(destroyed||ownRevision!==revision||ownScope!==currentScope()||ownSelection!==selection||ownQuery!==query().toString())return;
   resetResult();status('error','Не удалось прочитать сохранённые цены. '+(error?.message||'Повторите проверку.'));
  }
 }
 function update(data){if(destroyed)return;currentData=data;if(scope!==currentScope()||queryKey!==query().toString())void refresh();}
 function destroy(){destroyed=true;revision++;controller?.abort();select.removeEventListener('change',controls.select);refreshButton.removeEventListener('click',controls.refresh);}
 return {update,refresh,destroy};
}
