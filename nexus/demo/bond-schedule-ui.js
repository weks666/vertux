import { BOND_SCHEDULE_REASONS, bondScheduleSelection, validBondSchedule, bondScheduleAmount, bondScheduleDisplayRows } from './bond-schedule-contract.js';
const PAGE=20;
const esc=value=>String(value??'').replace(/[&<>"']/gu,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const day=value=>value?new Intl.DateTimeFormat('ru-RU',{timeZone:'UTC',dateStyle:'medium'}).format(new Date(value)):'Дата не указана';
const stamp=value=>new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',dateStyle:'short',timeStyle:'medium'}).format(new Date(value))+' МСК';
const title=row=>row.kind==='coupon'?'Купон №'+row.number:row.kind==='offer'?'Оферта / опцион №'+row.number:row.kind==='conversion'?'Конвертация №'+row.number:row.fullRedemption?'Полное погашение №'+row.number:['CA','OA'].includes(row.operationType)?'Частичное погашение №'+row.number:'Погашение №'+row.number;
const contextError=code=>/^(?:BOND_SCHEDULE_(?:CONTEXT_CHANGED|SELECTION_CHANGED|CATALOG_INVALID)|ACCOUNT_SCOPE_CHANGED|SESSION_|CAPABILITY_|OWNER_|RELEASE_)/u.test(code||'');
export function createBondScheduleUI({host,request}) {
 let generation=0,serial=0,key=null,loadedKey=null,selection=null,allowed=false,canRefresh=false,busy=false,data=null,error='',showAll=false,shown=PAGE;
 host.hidden=true;host.classList.add('bond-schedule');
 host.innerHTML='<h4>Выплаты за срок облигации</h4><p class="bond-schedule-note" data-bs="note"></p><div class="bond-schedule-actions"><button type="button" class="button secondary" data-bs="read">Перечитать сохранённый график</button><button type="button" class="button secondary" data-bs="refresh">Обновить график у брокера</button></div><p data-bs="status" role="status" aria-live="polite"></p><div data-bs="result"></div>';
 const get=name=>host.querySelector('[data-bs="'+name+'"]');
 function controls(){
  get('read').setAttribute('aria-disabled',String(!allowed||busy));
  get('refresh').setAttribute('aria-disabled',String(!allowed||!canRefresh||busy||!data?.range));
  host.setAttribute('aria-busy',String(busy));
  get('status').textContent=error||(busy?'Читаем график облигации…':!allowed?'График доступен в установленном Invest для облигации из каталога подключённого брокера.':!canRefresh?'Сохранённый график доступен для чтения. Обновление требует подключения брокера.':'');
 }
 function rowMarkup(row){
  const warnings=[row.kind==='offer'?'Участие в оферте не подтверждено.':row.kind==='conversion'?'Условия конвертации не считаются денежной выплатой.':'',
   row.defaultAt?'Источник указал дату дефолта: '+day(row.defaultAt)+'.':'',
   row.executionAt?'Дата исполнения у источника: '+day(row.executionAt)+'. Зачисление на ваш счёт не подтверждено.':''].filter(Boolean);
  return '<li data-bond-schedule-event="'+esc(row.id)+'" data-bond-schedule-kind="'+esc(row.kind)+'"><div class="bond-schedule-event-head"><div><strong>'+esc(title(row))+'</strong><span>Дата выплаты: '+esc(day(row.paymentAt))+'</span></div><div class="bond-schedule-amount"><strong>'+esc(bondScheduleAmount(row))+'</strong><span>на одну облигацию</span></div></div>'
   +(warnings.length?'<p class="bond-schedule-warning">'+warnings.map(esc).join(' ')+'</p>':'')
   +'<details><summary>Даты и условия события</summary><dl><div><dt>Дата события</dt><dd>'+esc(day(row.eventAt))+'</dd></div>'
   +'<div><dt>Фиксация владельцев</dt><dd>'+esc(day(row.recordAt))+'</dd></div>'
   +(row.kind==='coupon'?'<div><dt>Тип купона</dt><dd>'+esc(row.couponType)+'</dd></div><div><dt>Купонный период</dt><dd>'+esc(day(row.couponStartAt))+' — '+esc(day(row.couponEndAt))+'</dd></div>':'<div><dt>Тип операции у источника</dt><dd>'+esc(row.operationType||'Не указан')+'</dd></div><div><dt>Признак исполнения у источника</dt><dd>'+esc(row.execution||'Не указан')+'</dd></div>')
   +'</dl>'+(row.note?'<p>'+esc(row.note)+'</p>':'')+'</details></li>';
 }
 function render(){
  controls();const target=get('result'),focused=host.contains(document.activeElement)?document.activeElement?.dataset?.bs:null;
  if(!data){target.innerHTML='';return;}
  if(data.state==='unsupported'){target.innerHTML='<p>'+esc(BOND_SCHEDULE_REASONS[data.reason])+'</p>';return;}
  const range='<p class="bond-schedule-range">Запрошенный срок: '+esc(day(data.range.from))+' — '+esc(day(data.range.to))+'. Даты взяты из каталога.</p>';
  if(!data.record){target.innerHTML=range+'<p>'+(data.state==='invalid'?'Сохранённый график не прошёл проверку. Явное обновление может заменить этот снимок.':'График на весь этот срок ещё не сохранён. Нажмите «Обновить график у брокера».')+'</p>';return;}
  const record=data.record,filtered=bondScheduleDisplayRows(record.events,data.evaluatedAt,showAll),visible=filtered.slice(0,shown);
  const sourceNames={coupons:'Купоны',EVENT_TYPE_CALL:'Оферты',EVENT_TYPE_MTY:'Погашения',EVENT_TYPE_CONV:'Конвертации'};
  target.innerHTML=range+'<p class="bond-schedule-clock">Получено: '+esc(stamp(record.capturedAt))+'.'+(data.state==='stale'?' Снимку больше шести часов; при необходимости обновите график.':'')+'</p>'
   +'<label class="bond-schedule-filter"><input type="checkbox" data-bs="all"'+(showAll?' checked':'')+'>Показать весь запрошенный срок</label>'
   +'<p data-bs="count" role="status">'+(showAll?'Все даты.':'Даты выплат с '+esc(day(data.evaluatedAt))+' и события без даты выплаты.')+' Показано '+visible.length+' из '+filtered.length+'; в сохранённом графике '+record.events.length+' записей.</p>'
   +(record.events.length?filtered.length?'<ol class="bond-schedule-events">'+visible.map(rowMarkup).join('')+'</ol>':'<p>В этом фильтре нет записей. Откройте весь запрошенный срок, чтобы посмотреть прежние даты.</p>':'<p>Источник не вернул событий за запрошенный срок. Это не подтверждает отсутствие обязательств по выпуску.</p>')
   +(filtered.length>PAGE?'<button type="button" class="button secondary" data-bs="more" aria-disabled="'+String(shown>=filtered.length)+'">'+(shown>=filtered.length?'Показаны все записи':'Показать ещё '+Math.min(PAGE,filtered.length-shown))+'</button>':'')
   +'<details class="bond-schedule-source"><summary>Источник, время и пределы графика</summary><p>Загружены опубликованные купоны, погашения, оферты и конвертации. Для купонов границы относятся к дате выплаты, для остальных событий — к дате события. Дата выплаты может выходить за указанный срок.</p><p>Четыре ответа получены последовательно с '+esc(stamp(record.startedAt))+' до '+esc(stamp(record.capturedAt))+'. Это время чтения, а не дата публикации или единый снимок источника.</p><ul>'
   +record.sources.map(row=>'<li>'+esc(sourceNames[row.kind])+': '+row.events+' записей; ответ '+esc(stamp(row.receivedAt))+'.</li>').join('')
   +'</ul><p>Каталог получен '+esc(stamp(data.catalog.capturedAt))+'.'+(data.catalog.stale?' Каталог требует обновления.':'')+'</p><p>Полнота договорных обязательств и будущих сумм не подтверждена. Неизвестные купоны, номинал и налоги не достраиваются. Сведения не определяют право на выплату, доходность или зачисления на ваш счёт.</p><p><a href="'+esc(data.source.url)+'" target="_blank" rel="noopener noreferrer">Т-Инвестиции · описание источника</a></p></details>';
  if(focused&&['all','more'].includes(focused))get(focused)?.focus({preventScroll:true});
 }
 async function read(refresh=false){
  if(!allowed||busy||!host.isConnected||refresh&&(!canRefresh||!data?.range))return;
  const cycle=generation,ticket=++serial,chosen={...selection},binding=refresh?data.contextKey:null;
  const current=()=>cycle===generation&&ticket===serial&&allowed&&host.isConnected&&!host.hidden;
  busy=true;error='';controls();
  try{
   const result=await request('/api/market/bond-schedule'+(refresh?'/refresh':'?'+new URLSearchParams({instrumentUid:chosen.instrumentUid,assetUid:chosen.assetUid})),refresh?{method:'POST',body:JSON.stringify({instrumentUid:chosen.instrumentUid,assetUid:chosen.assetUid,contextKey:binding})}:undefined);
   if(!current())return;
   if(!validBondSchedule(result,chosen,binding)||result.readMode!==(refresh?'explicit-refresh':'saved-only'))throw Object.assign(new Error('Invalid bond schedule'),{code:'BOND_SCHEDULE_RESPONSE_INVALID'});
   data=result;shown=PAGE;
  }catch(reason){
   if(!current())return;
   if(!refresh||contextError(reason?.code)||[401,403,409].includes(reason?.status)){data=null;error='Контекст или доступ к графику изменился. Перечитайте сохранённый график.';}
   else error='Не удалось обновить график. Прежний снимок сохранён; повторите обновление.';
  }finally{if(current()){busy=false;render();}}
 }
 for(const name of ['read','refresh'])get(name).addEventListener('click',()=>{if(get(name).getAttribute('aria-disabled')!=='true')void read(name==='refresh');});
 host.addEventListener('change',event=>{if(event.target===get('all')&&data?.record){showAll=event.target.checked;shown=PAGE;render();}});
 host.addEventListener('click',event=>{if(event.target.closest('[data-bs="more"]')?.getAttribute('aria-disabled')==='false'&&data?.record){shown+=PAGE;render();}});
 return {update({meta,active,accessKey,permitted,refreshPermitted,replay=false}){
  const supported=meta?.assetType==='bond',identity=meta?.catalogIdentity,candidate={instrumentUid:meta?.instrumentUid,assetUid:meta?.assetUid,assetType:meta?.assetType};
  const bound=bondScheduleSelection(candidate)&&identity?.contractVersion==='tinvest-catalog-identity-v1'&&identity.instrumentUid===candidate.instrumentUid&&identity.assetType==='bond'&&identity.asset?.state==='present'&&identity.asset.uid===candidate.assetUid&&meta.instrumentOrigin?.provider==='tinvest'&&meta.instrumentOrigin?.market==='broker';
  const next=JSON.stringify([accessKey,active,permitted,refreshPermitted,bound,candidate,replay,meta?.placementDate,meta?.maturityDate]);
  if(next!==key){key=next;generation++;serial++;busy=false;data=null;error='';showAll=false;shown=PAGE;}
  selection=bound?candidate:null;allowed=Boolean(active&&supported&&bound&&permitted&&!replay);canRefresh=Boolean(allowed&&refreshPermitted);
  host.hidden=!active||!supported;
  get('note').textContent='Опубликованные даты и суммы на одну бумагу за срок от размещения до погашения. Указанная сумма не подтверждает зачисление. Для годового календаря используйте «Открыть купонный график».'+(replay?' График на дату воспроизведения не подтверждён.':'');
  render();if(allowed&&!data&&!busy&&loadedKey!==key){loadedKey=key;void read();}
 }};
}
