import {FUTURES_BASIS_REASONS as REASONS,basisSelection,validFuturesBasis,futuresBasisRows,basisNumber} from './futures-basis-contract.js';
const esc=v=>String(v??'').replace(/[&<>"']/gu,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stamp=v=>v?new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',dateStyle:'short',timeStyle:'medium'}).format(new Date(v))+' МСК':'Время не указано';
const day=v=>v?new Intl.DateTimeFormat('ru-RU',{timeZone:'UTC',dateStyle:'medium'}).format(new Date(v)):'Дата не указана';
const num=v=>basisNumber(v);
const money=(v,c)=>num(v)+(v===null?'':' '+(c||'валюта не указана'));
const signed=v=>v===null?'Не рассчитано':(BigInt(v)>0n?'+':'')+num(v)+' %';
const label=v=>[v.ticker,v.name!==v.ticker?v.name:null].filter(Boolean).join(' · ')||'Инструмент';
const contextError=code=>/^(?:FUTURES_BASIS_(?:CONTEXT_CHANGED|SELECTION_CHANGED|CATALOG_INVALID)|ACCOUNT_SCOPE_CHANGED|SESSION_|CAPABILITY_|OWNER_|RELEASE_)/u.test(code||'');
function curve(data,rows){
 const ready=rows.filter(x=>x.state==='ready');if(ready.length<2)return '';
 const values=ready.map(x=>({x:Date.parse(data.family.find(f=>f.instrumentUid===x.instrumentUid).expirationAt),y:Number(x.premiumPercentNanos)/1e9,uid:x.instrumentUid}));
 const xs=values.map(x=>x.x),ys=[0,...values.map(x=>x.y)],lo=Math.min(...ys),hi=Math.max(...ys),left=Math.min(...xs),right=Math.max(...xs);
 const px=v=>32+(right===left ? .5 : (v-left)/(right-left))*656,py=v=>168-(hi===lo ? .5 : (v-lo)/(hi-lo))*136;
 const path=values.map((v,i)=>(i?'L':'M')+px(v.x).toFixed(3)+' '+py(v.y).toFixed(3)).join(' ');
 return '<figure class="futures-basis-curve"><figcaption>Премия или дисконт к базовой бумаге, %</figcaption><svg viewBox="0 0 720 200" role="img" aria-label="Премия или дисконт по доступным срокам. Точные значения перечислены ниже."><line class="futures-basis-zero" x1="24" x2="696" y1="'+py(0)+'" y2="'+py(0)+'"/><path d="'+path+'"/>'
  +values.map(v=>'<circle cx="'+px(v.x)+'" cy="'+py(v.y)+'" r="5"><title>'+esc(label(data.family.find(f=>f.instrumentUid===v.uid)))+': '+esc(signed(ready.find(r=>r.instrumentUid===v.uid).premiumPercentNanos))+'</title></circle>').join('')
  +'</svg><div class="futures-basis-axis"><span>'+esc(day(new Date(left).toISOString()))+'</span><span>'+esc(day(new Date(right).toISOString()))+'</span></div><p>Линия соединяет только доступные сроки; промежуточные значения не рассчитаны.</p></figure>';
}
export function createFuturesBasisUI({host,request}){
 let generation=0,serial=0,key=null,loadedKey=null,selection=null,allowed=false,canRefresh=false,busy=false,data=null,error='',spotUid=null,choices=[],choiceKey='';
 host.hidden=true;host.classList.add('futures-basis');
 host.innerHTML='<h4>Срочные цены базовой бумаги</h4><p class="futures-basis-note" data-fb="note"></p><label class="futures-basis-choice">Базовая бумага для сравнения<select data-fb="spot"><option value="">Выберите режим торгов</option></select></label><div class="futures-basis-actions"><button type="button" class="button secondary" data-fb="read">Перечитать сохранённое сравнение</button><button type="button" class="button secondary" data-fb="refresh">Обновить цены у брокера</button></div><p data-fb="status" role="status" aria-live="polite"></p><div data-fb="result"></div>';
 const get=name=>host.querySelector('[data-fb="'+name+'"]');
 function controls(){
  get('read').setAttribute('aria-disabled',String(!allowed||busy));
  get('refresh').setAttribute('aria-disabled',String(!allowed||!canRefresh||busy||!data||!spotUid||Boolean(data.reason)));
  get('spot').setAttribute('aria-disabled',String(!allowed||busy||!choices.length));host.setAttribute('aria-busy',String(busy));
  const next=JSON.stringify(choices);
  if(choiceKey!==next){choiceKey=next;get('spot').innerHTML='<option value="">Выберите режим торгов</option>'+choices.map(c=>'<option value="'+esc(c.instrumentUid)+'">'+esc([label(c),c.classCode,c.currency,c.lot?'лот '+c.lot:'лот не указан'].filter(Boolean).join(' · '))+'</option>').join('');}
  get('spot').value=spotUid??'';
  get('status').textContent=error||(busy?'Читаем сохранённые сведения и цены…':!allowed?'В режиме истории сравнение на ту дату не подтверждено.':!canRefresh?'Доступно сохранённое сравнение. Для обновления требуется подключённый брокер.':'');
 }
 function render(){
  controls();const target=get('result');
  if(!data){target.innerHTML='';return;}
  if(data.state==='unsupported'){target.innerHTML='<p>'+esc(REASONS[data.reason])+'</p>';return;}
  if(data.state==='choose-spot'){target.innerHTML='<p>Найдено контрактов: '+data.family.length+'. Выберите базовую бумагу. Режимы торгов могут отличаться валютой и размером лота.</p>';return;}
  if(!data.record){target.innerHTML='<p>'+(data.state==='invalid'?'Сохранённое сравнение не соответствует текущему каталогу или не прошло проверку. Обновите цены, чтобы получить новое.':'Для этого выбора цены ещё не сохранены. Нажмите «Обновить цены у брокера».')+'</p>';return;}
  const rows=futuresBasisRows(data),spot=data.spotOptions.find(s=>s.instrumentUid===data.selectedSpotUid),sq=data.record.quotes.find(q=>q.instrumentUid===spot.instrumentUid);
  target.innerHTML='<p class="futures-basis-clock">Получено: '+esc(stamp(data.record.receivedAt))+'.'+(data.state==='stale'?' Сохранённой записи больше минуты. Значения относятся к указанным ценам; текущее сравнение не подтверждено.':'')+'</p>'
   +'<div class="futures-basis-spot"><strong>'+esc(label(spot))+'</strong><p>Цена базовой бумаги: '+esc(money(sq.priceNanos,spot.currency))+' за одну бумагу. '+esc(stamp(sq.at))+'.</p><p>'+esc([spot.classCode,spot.currency,spot.lot?'Лот '+spot.lot:null].filter(Boolean).join(' · '))+'</p></div>'
   +'<p>Сопоставимые цены: '+rows.filter(r=>r.state==='ready').length+' из '+rows.length+' контрактов сохранённого каталога. Каждая строка использует собственное время цены.</p>'
   +curve(data,rows)+'<ol class="futures-basis-rows">'+rows.map(row=>{
    const f=data.family.find(x=>x.instrumentUid===row.instrumentUid),q=data.record.quotes.find(x=>x.instrumentUid===row.instrumentUid);
    return '<li data-futures-basis-row="'+esc(row.instrumentUid)+'" data-basis-state="'+row.state+'"><div class="futures-basis-row-head"><strong>'+esc(label(f))+'</strong><span>Истечение: '+esc(day(f.expirationAt))+'</span></div>'
     +(row.state==='ready'?'<dl class="futures-basis-values"><div><dt>Фьючерс на одну базовую бумагу</dt><dd>'+esc(money(row.futureUnitPriceNanos,f.currency))+'</dd></div><div><dt>Разница с базовой ценой</dt><dd>'+esc(money(row.differenceNanos,f.currency))+'</dd></div><div><dt>Премия / дисконт</dt><dd data-basis-premium>'+esc(signed(row.premiumPercentNanos))+'</dd></div><div><dt>Простое годовое выражение</dt><dd data-basis-annual>'+esc(signed(row.annualizedPercentNanos))+'</dd></div></dl><p>До истечения на момент цен: '+esc(num(row.daysNanos))+' суток. Основание: '+esc(stamp(row.asOf))+'.</p>':'<p class="futures-basis-unavailable">'+esc(REASONS[row.reason])+'</p>')
     +'<details><summary>Цены, единицы и время</summary><dl><div><dt>Котировка фьючерса</dt><dd>'+esc(num(q.priceNanos))+' пунктов</dd></div><div><dt>Время цены фьючерса</dt><dd>'+esc(stamp(q.at))+'</dd></div><div><dt>Время цены базовой бумаги</dt><dd>'+esc(stamp(sq.at))+'</dd></div><div><dt>Шаг цены</dt><dd>'+esc(num(f.stepNanos))+' пунктов</dd></div><div><dt>Стоимость шага</dt><dd>'+esc(money(f.stepAmountNanos,f.currency))+'</dd></div><div><dt>Базовых бумаг в контракте</dt><dd>'+esc(num(f.underlyingSizeNanos))+'</dd></div></dl></details></li>';
   }).join('')+'</ol><details class="futures-basis-method"><summary>Метод и ограничения сравнения</summary><p>Цена фьючерса в пунктах × стоимость шага ÷ шаг ÷ количество базовых бумаг. Лот обеих сторон повторно не умножается. Премия = (цена на бумагу ÷ цена базовой бумаги − 1) × 100 %. Годовое выражение = премия × 365 ÷ дробное число суток до истечения (ACT/365).</p>'
   +'<p>Расчёт условен: используются сохранённые условия контракта. Дата их получения не доказывает время действия денежного шага. Каталог, который уже устарел к получению цен, не допускается.</p><p>Обе цены должны быть биржевыми, одной валюты, не старше пяти минут при получении; разница их времени — не больше минуты. Это правило сопоставления, а не подтверждение одновременных или исполнимых цен. Значения после сохранения не пересчитываются по текущему времени.</p>'
   +'<p>Это премия цены, а не доходность сделки или безрисковый доход. Не учтены дивиденды, финансирование, комиссии, спрос/предложение и исполнение; простое годовое выражение особенно чувствительно к короткому остатку срока. Историческая кривая и полный рынок не подтверждены.</p><ul>'+data.catalogs.map(c=>'<li>'+({future:'Фьючерсы',share:'Акции',etf:'Фонды'})[c.assetType]+': каталог получен '+esc(stamp(c.capturedAt))+'.</li>').join('')
   +'</ul><p><a href="'+esc(data.source.url)+'" target="_blank" rel="noopener noreferrer">Т-Инвестиции · источник цен</a> · <a href="'+esc(data.source.unitsUrl)+'" target="_blank" rel="noopener noreferrer">Правила единиц цены</a></p></details>';
 }
 async function read(refresh=false){
  if(!allowed||busy||!host.isConnected||refresh&&(!canRefresh||!data||!spotUid||data.reason))return;
  const cycle=generation,ticket=++serial,chosen={...selection},spot=spotUid,binding=refresh?data.contextKey:null;
  const current=()=>cycle===generation&&ticket===serial&&allowed&&host.isConnected&&!host.hidden;
  busy=true;error='';controls();
  try{
   const input={instrumentUid:chosen.instrumentUid,assetUid:chosen.assetUid,...(spot?{spotInstrumentUid:spot}:{})};
   const result=await request('/api/market/futures-basis'+(refresh?'/refresh':'?'+new URLSearchParams(input)),refresh?{method:'POST',body:JSON.stringify({...input,contextKey:binding})}:undefined);
   if(!current())return;
   if(!validFuturesBasis(result,chosen,spot,binding)||result.readMode!==(refresh?'explicit-refresh':'saved-only'))throw Object.assign(new Error('Invalid futures basis'),{code:'FUTURES_BASIS_RESPONSE_INVALID'});
   data=result;choices=result.spotOptions;
  }catch(reason){
   if(!current())return;
   if(!refresh||contextError(reason?.code)||[401,403,409].includes(reason?.status)){data=null;choices=[];spotUid=null;error='Сохранённое сравнение недоступно или контекст изменился. Перечитайте сведения и снова выберите базовую бумагу.';}
   else error='Не удалось обновить цены. Прежнее сравнение сохранено с его датами; повторите обновление.';
  }finally{if(current()){busy=false;render();}}
 }
 for(const name of ['read','refresh'])get(name).addEventListener('click',()=>{if(get(name).getAttribute('aria-disabled')!=='true')void read(name==='refresh');});
 get('spot').addEventListener('change',()=>{
  if(get('spot').getAttribute('aria-disabled')==='true'){get('spot').value=spotUid??'';return;}
  const next=get('spot').value;if(next&&!choices.some(x=>x.instrumentUid===next))return;
  generation++;serial++;busy=false;spotUid=next||null;data=null;error='';render();void read();
 });
 return {update({meta,active,accessKey,permitted,refreshPermitted,replay=false}){
  const supported=meta?.assetType==='future',candidate={instrumentUid:meta?.instrumentUid,assetUid:meta?.assetUid,assetType:meta?.assetType},identity=meta?.catalogIdentity;
  const bound=basisSelection(candidate)&&identity?.contractVersion==='tinvest-catalog-identity-v1'&&identity.instrumentUid===candidate.instrumentUid&&identity.assetType==='future'
   &&identity.asset?.state==='present'&&identity.asset.uid===candidate.assetUid&&meta.instrumentOrigin?.provider==='tinvest'&&meta.instrumentOrigin?.market==='broker';
  const next=JSON.stringify([accessKey,active,permitted,refreshPermitted,bound,candidate,replay,meta?.futureContractTerms,meta?.basicAssetSizeNanos,meta?.expirationDate]);
  if(next!==key){key=next;generation++;serial++;busy=false;data=null;error='';choices=[];spotUid=null;}
  selection=bound?candidate:null;allowed=Boolean(active&&supported&&bound&&permitted&&!replay);canRefresh=Boolean(allowed&&refreshPermitted);
  host.hidden=!active||!supported||!permitted;
  get('note').textContent='Сравнение связанных фьючерсов с выбранной акцией или фондом. Сначала выберите режим торгов базовой бумаги, затем явно обновите цены.'+(replay?' Исторические условия и цены для этого сравнения не подтверждены.':'');
  render();if(allowed&&!data&&!busy&&loadedKey!==key){loadedKey=key;void read();}
 }};
}
