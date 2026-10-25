import {bondScheduleSelection,BOND_SCHEDULE_REASONS} from './bond-schedule-contract.js';
import {validBondYield} from './bond-yield-contract.js';
import {bondYieldPercent,bondYieldMoney} from './bond-yield-model.js';
import {mountBondSensitivity} from './bond-sensitivity-ui.js';
const esc=value=>String(value??'').replace(/[&<>"']/gu,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=value=>new Intl.DateTimeFormat('ru-RU',{timeZone:'UTC',dateStyle:'medium'}).format(new Date(value));
const stamp=value=>new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',dateStyle:'short',timeStyle:'medium'}).format(new Date(value))+' МСК';
const contextError=code=>/^(?:BOND_YIELD_(?:CONTEXT_CHANGED|SELECTION_CHANGED|CATALOG_INVALID)|ACCOUNT_SCOPE_CHANGED|SESSION_|CAPABILITY_|OWNER_|RELEASE_)/u.test(code||'');
export function createBondYieldUI({host,request}){
 let generation=0,serial=0,key=null,loadedKey=null,scope=null,deniedScope=null,selection=null,allowed=false,canRefresh=false,busy=false,data=null,error='',shown=20,shockBp=100,sensitivityKey=null;
 host.hidden=true;host.classList.add('bond-yield');
 host.innerHTML='<h4>Доходность к погашению</h4><p class="bond-yield-note" data-by="note"></p><div class="bond-yield-actions"><button type="button" class="button secondary" data-by="read">Перечитать сохранённый расчёт</button><button type="button" class="button secondary" data-by="refresh">Обновить данные и расчёт</button></div><p role="status" aria-live="polite" data-by="status"></p><div data-by="result"></div>';
 const get=name=>host.querySelector('[data-by="'+name+'"]');
 function focusVisible(target){if(!target)return;const top=document.querySelector('.topbar')?.getBoundingClientRect().bottom||0;target.style.scrollMarginTop=Math.ceil(top+12)+'px';target.focus({preventScroll:true});const rect=target.getBoundingClientRect();if(rect.top<top+4||rect.bottom>innerHeight-4)target.scrollIntoView({block:'nearest',behavior:'instant'});}
 function controls(){
  get('read').setAttribute('aria-disabled',String(!allowed||busy));get('refresh').setAttribute('aria-disabled',String(!allowed||!canRefresh||busy||!data?.range));host.setAttribute('aria-busy',String(busy));
  get('status').textContent=error||(busy?'Читаем цену, НКД и график выплат…':deniedScope===scope?'Доступ к расчёту отозван. После восстановления прав перезагрузите Invest.':!allowed?'Расчёт доступен в установленном Invest для облигации подключённого брокера.':!canRefresh?'Сохранённый расчёт доступен для чтения. Для обновления нужно подключение брокера.':'');
 }
 function details(record,model){
  const q=record.quote,a=record.accrued.rows[0];
  return '<details data-bond-yield-method><summary data-by="method">Метод, цена и источники</summary><p>Это условная эффективная годовая ставка YTM: цена с НКД равна сумме будущих выплат, дисконтированных по (1 + ставка)<sup>дни / 365</sup>. Дни — календарные даты UTC, база ACT/365.</p>'
   +'<p>Предполагается получение всех перечисленных выплат полностью в указанные даты. Это не обещание доходности и не исполнимая цена. Комиссии, налоги, FX, риск дефолта, реинвестирование по доступной ставке и расчёты сделки не моделируются. Право на купон и доходность к оферте отдельно не подтверждены.</p>'
   +'<dl><div><dt>Время биржевой цены</dt><dd>'+esc(q.at?stamp(q.at):'Не указано')+'</dd></div><div><dt>Дата строки НКД, UTC</dt><dd>'+esc(a?date(a.at):'Не указана')+'</dd></div><div><dt>Каталог получен</dt><dd>'+esc(stamp(record.catalog.capturedAt))+'</dd></div><div><dt>Ответы получены</dt><dd>'+esc(stamp(record.startedAt))+' — '+esc(stamp(record.capturedAt))+'</dd></div></dl>'
   +'<p>Ответы читаются последовательно. Дата получения не является доказанной датой публикации или исторической версией договора. Проверяется связность опубликованного графика; полнота обязательств вне источника не утверждается.</p>'
   +(model?.state==='ready'?'<p>Цена и НКД сохранены без промежуточного округления. Проверка приведённой цены: относительная погрешность '+esc(model.relativePriceResidual.toExponential(2))+'. Доходность решается численно и округляется только для показа. ≈ означает приближение.</p>':'')
   +'<p><a href="'+esc(data.source.contractUrl)+'" target="_blank" rel="noopener noreferrer">Контракт источника</a> · <a href="'+esc(data.source.unitsUrl)+'" target="_blank" rel="noopener noreferrer">Единицы цены</a> · <a href="'+esc(data.source.methodUrl)+'" target="_blank" rel="noopener noreferrer">Определение YTM</a></p></details>';
 }
 function render(){
  controls();const target=get('result'),focused=host.contains(document.activeElement)?document.activeElement?.dataset?.by:null,methodOpen=host.querySelector('[data-bond-yield-method]')?.open,flowsOpen=host.querySelector('[data-bond-yield-flows]')?.open,sensitivityOpen=host.querySelector('[data-bond-sensitivity]')?.open,sensitivityMethodOpen=get('sensitivity-method')?.parentElement.open;
  if(!data){target.innerHTML='';host.dataset.yieldState=deniedScope===scope?'forbidden':'empty';return;}
  if(data.state==='unsupported'){host.dataset.yieldState='unsupported';target.innerHTML='<p>'+esc(BOND_SCHEDULE_REASONS[data.reason]||'Для выпуска не определён конечный срок.')+'</p>';return;}
  if(!data.record){host.dataset.yieldState=data.state;target.innerHTML='<p>'+(data.state==='invalid'?'Сохранённые данные не прошли проверку текущего контекста. Обновите данные и расчёт.':'Расчёт ещё не сохранён. «Обновить данные и расчёт» отдельно прочитает цену, НКД и опубликованные выплаты.')+'</p>';return;}
  const record=data.record,model=data.model;host.dataset.yieldState=model.state;
  let markup='<p class="bond-yield-clock">Получено: '+esc(stamp(record.capturedAt))+'.'+(data.state==='stale'?' Снимку больше минуты; показан сохранённый расчёт на прежнюю дату цены.':'')+'</p>';
  if(model.state==='unavailable')markup+='<p class="bond-yield-unavailable" data-by="reason">'+esc(model.reason)+'</p><p class="bond-yield-note">Доходность не рассчитана; отсутствующие выплаты и НКД не заменены нулями.</p>';
  else{
   markup+='<div class="bond-yield-summary"><div><span>Эффективная доходность, в год</span><strong data-by="value">'+esc(bondYieldPercent(model))+'</strong><span>На '+esc(date(model.valuationDate))+' UTC · до '+esc(date(model.maturityDate))+'</span></div><p>До налогов и комиссий, при получении всех показанных выплат. На одну облигацию.</p></div>'
    +'<dl class="bond-yield-price"><div><dt>Цена без НКД</dt><dd data-by="clean">'+esc(bondYieldMoney(model.cleanPrice,model.currency))+'</dd></div><div><dt>НКД на дату цены</dt><dd data-by="accrued">'+esc(bondYieldMoney(model.accruedNanos,model.currency))+'</dd></div><div><dt>Цена с НКД</dt><dd data-by="dirty">'+esc(bondYieldMoney(model.dirtyPrice,model.currency))+'</dd></div></dl>'
    +'<div data-by="sensitivity"></div><details data-bond-yield-flows><summary data-by="flows">Выплаты в расчёте · '+model.flows.length+'</summary><p>Купоны: '+esc(bondYieldMoney(model.couponTotalNanos,model.currency))+'. Погашение: '+esc(bondYieldMoney(model.principalNanos,model.currency))+'.</p><ol class="bond-yield-flows">'
    +model.flows.slice(0,shown).map(row=>'<li><span>'+esc(row.kind==='principal'?'Полное погашение':'Купон')+' · '+esc(date(row.date))+'</span><strong>'+esc(bondYieldMoney(row.amountNanos,model.currency))+'</strong><span>'+row.days+' дней от даты расчёта</span></li>').join('')+'</ol>'
    +(model.flows.length>20?'<button type="button" class="button secondary" data-by="more" aria-disabled="'+String(shown>=model.flows.length)+'">'+(shown>=model.flows.length?'Показаны все выплаты':'Показать ещё '+Math.min(20,model.flows.length-shown))+'</button>':'')+'</details>';
  }
  target.innerHTML=markup+details(record,model);
  if(model.state==='ready'){mountBondSensitivity(get('sensitivity'),data,selection,{bp:shockBp,onChange:bp=>{shockBp=bp;}});if(sensitivityOpen&&host.querySelector('[data-bond-sensitivity]'))host.querySelector('[data-bond-sensitivity]').open=true;if(sensitivityMethodOpen&&get('sensitivity-method'))get('sensitivity-method').parentElement.open=true;}
  if(methodOpen)host.querySelector('[data-bond-yield-method]').open=true;if(flowsOpen&&host.querySelector('[data-bond-yield-flows]'))host.querySelector('[data-bond-yield-flows]').open=true;
  if(focused&&['method','flows','more','sensitivity-summary','sensitivity-method','shock'].includes(focused))focusVisible(get(focused));
 }
 async function read(refresh=false){
  if(!allowed||busy||!host.isConnected||refresh&&(!canRefresh||!data?.range))return;
  const cycle=generation,ticket=++serial,chosen={...selection},binding=refresh?data.contextKey:null,access=scope,current=()=>cycle===generation&&ticket===serial&&allowed&&host.isConnected&&!host.hidden;
  busy=true;error='';controls();
  try{
   const result=await request('/api/market/bond-yield'+(refresh?'/refresh':'?'+new URLSearchParams({instrumentUid:chosen.instrumentUid,assetUid:chosen.assetUid})),refresh?{method:'POST',body:JSON.stringify({instrumentUid:chosen.instrumentUid,assetUid:chosen.assetUid,contextKey:binding})}:undefined);
   if(!current())return;
   if(!validBondYield(result,chosen,binding)||result.readMode!==(refresh?'explicit-refresh':'saved-only'))throw Object.assign(new Error('Invalid bond yield'),{code:'BOND_YIELD_RESPONSE_INVALID'});
   const nextSensitivityKey=JSON.stringify([result.contextKey,result.sourceDigest]);if(nextSensitivityKey!==sensitivityKey)shockBp=100;sensitivityKey=nextSensitivityKey;data=result;shown=20;
  }catch(reason){
   if(!current())return;
   if([401,403].includes(reason?.status)){data=null;deniedScope=access;error='Доступ к расчёту отозван. После восстановления прав перезагрузите Invest.';}
   else if(!refresh||contextError(reason?.code)||reason?.status===409){data=null;error='Контекст или доступ изменился. Перечитайте сохранённый расчёт.';}
   else error='Не удалось обновить данные. Прежний датированный расчёт сохранён; повторите обновление.';
  }finally{if(cycle===generation&&ticket===serial&&host.isConnected&&!host.hidden){busy=false;if(deniedScope===scope)allowed=false;render();}}
 }
 for(const name of ['read','refresh'])get(name).addEventListener('click',()=>{if(get(name).getAttribute('aria-disabled')!=='true')void read(name==='refresh');});
 host.addEventListener('click',event=>{if(event.target.closest('[data-by="more"]')?.getAttribute('aria-disabled')==='false'&&data?.model?.state==='ready'){shown+=20;render();}});
 host.addEventListener('focusin',event=>{if(event.target.matches?.('button,summary,a,input')){const rect=event.target.getBoundingClientRect(),top=document.querySelector('.topbar')?.getBoundingClientRect().bottom||0;if(rect.top<top+4||rect.bottom>innerHeight-4)focusVisible(event.target);}});
 host.addEventListener('keydown',event=>{if(event.key==='Escape'){const details=event.target.closest('details[open]');if(details){details.open=false;focusVisible(details.querySelector('summary'));event.preventDefault();}}});
 return {update({meta,active,accessKey,permitted,refreshPermitted,replay=false}){
  const supported=meta?.assetType==='bond',identity=meta?.catalogIdentity,candidate={instrumentUid:meta?.instrumentUid,assetUid:meta?.assetUid,assetType:meta?.assetType};
  const bound=bondScheduleSelection(candidate)&&identity?.contractVersion==='tinvest-catalog-identity-v1'&&identity.instrumentUid===candidate.instrumentUid&&identity.assetType==='bond'&&identity.asset?.state==='present'&&identity.asset.uid===candidate.assetUid&&meta.instrumentOrigin?.provider==='tinvest'&&meta.instrumentOrigin?.market==='broker';
  scope=JSON.stringify([accessKey,candidate]);const next=JSON.stringify([scope,active,permitted,refreshPermitted,bound,replay,meta?.placementDate,meta?.maturityDate]);
  if(next!==key){key=next;generation++;serial++;busy=false;data=null;error='';shown=20;shockBp=100;sensitivityKey=null;}
  selection=bound?candidate:null;allowed=Boolean(active&&supported&&bound&&permitted&&!replay&&deniedScope!==scope);canRefresh=Boolean(allowed&&refreshPermitted);host.hidden=!active||!supported;
  get('note').textContent='Условная ставка по проверенным опубликованным выплатам до полного погашения. Цена без НКД и НКД читаются отдельно на одну дату.'+(replay?' Расчёт на дату воспроизведения не подтверждён.':'');
  render();if(allowed&&!data&&!busy&&loadedKey!==key){loadedKey=key;void read();}
 }};
}
