import { ASSET_FACT_FIELDS, assetFactSelection, assetFactDisplay, validAssetFacts } from './asset-facts-contract.js';
const esc = value => String(value ?? '').replace(/[&<>"']/gu, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stamp = value => new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',dateStyle:'short',timeStyle:'medium'}).format(new Date(value))+' МСК';
const contextError = code => /^(?:ASSET_FACTS_(?:CONTEXT_CHANGED|SELECTION_CHANGED|CATALOG_INVALID)|ACCOUNT_SCOPE_CHANGED|SESSION_|CAPABILITY_|OWNER_|RELEASE_)/u.test(code||'');
export function createAssetFactsUI({host,request}) {
 let generation=0,serial=0,key=null,loadedKey=null,selection=null,allowed=false,canRefresh=false,busy=false,data=null,error='';
 host.hidden=true;host.classList.add('asset-facts');
 host.innerHTML='<h4 data-af="heading"></h4><p data-af="note" class="asset-facts-note"></p><div class="asset-facts-actions"><button type="button" class="button secondary" data-af="read">Перечитать сохранённые сведения</button><button type="button" class="button secondary" data-af="refresh">Обновить сведения у брокера</button></div><p data-af="status" role="status" aria-live="polite"></p><div data-af="result"></div>';
 const get=name=>host.querySelector('[data-af="'+name+'"]');
 function controls() {
  get('read').setAttribute('aria-disabled',String(!allowed||busy));
  get('refresh').setAttribute('aria-disabled',String(!allowed||!canRefresh||busy||!data?.contextKey));
  host.setAttribute('aria-busy',String(busy));
  get('status').textContent=error||(busy?'Читаем сведения об активе…':!allowed?'Эти сведения доступны в установленном Invest для инструмента из каталога подключённого брокера.':!canRefresh?'Сохранённые сведения доступны для чтения. Обновление требует подключения брокера.':'');
 }
 function rows(keys) {
  return '<dl class="asset-facts-grid">'+ASSET_FACT_FIELDS[selection.assetType].filter(row=>keys.includes(row[0])).map(([name,label,type])=>'<div data-asset-fact="'+name+'"><dt>'+esc(label)+'</dt><dd>'+esc(assetFactDisplay(data.record.fields[name],type))+'</dd></div>').join('')+'</dl>';
 }
 function render() {
  controls();const target=get('result');
  if(!data){target.innerHTML='';return;}
  if(!data.record){target.innerHTML='<p>'+(data.state==='invalid'?'Сохранённые сведения не прошли проверку. Обновление у брокера может заменить этот снимок.':'Сведения об этом активе ещё не сохранены. Нажмите «Обновить сведения у брокера».')+'</p>';return;}
  const record=data.record,featured=selection.assetType==='etf'?['totalExpense','managementType','primaryIndex','leveragedFlag']:ASSET_FACT_FIELDS.bond.map(row=>row[0]);
  const remaining=ASSET_FACT_FIELDS[selection.assetType].map(row=>row[0]).filter(name=>!featured.includes(name));
  const update=record.sourceUpdatedAt.state==='present'?stamp(record.sourceUpdatedAt.value):record.sourceUpdatedAt.state==='invalid'?'дата не прошла проверку':'источник не передал';
  target.innerHTML='<p class="asset-facts-clock">Получено: '+esc(stamp(record.capturedAt))+'.'+(data.state==='stale'?' Снимку больше суток; при необходимости обновите сведения.':'')+'</p>'+rows(featured)
   +(remaining.length?'<details><summary>Все условия и стратегия фонда</summary>'+rows(remaining)+'</details>':'')
   +'<details class="asset-facts-source"><summary>Источник и даты сведений</summary><p>Обновление записи у источника: '+esc(update)+'. Эта дата не определяет период действия условий.</p><p>Связь с выбранным инструментом проверена по каталогу, полученному '+esc(stamp(data.catalog.capturedAt))+'.'+(data.catalog.stale?' Каталог требует обновления.':'')+'</p><p><a href="'+esc(data.source.url)+'" target="_blank" rel="noopener noreferrer">Т-Инвестиции · описание источника</a></p></details>';
 }
 async function read(refresh=false) {
  if(!allowed||busy||!host.isConnected||refresh&&(!canRefresh||!data?.contextKey))return;
  const cycle=generation,ticket=++serial,chosen={...selection},binding=refresh?data.contextKey:null;
  const current=()=>cycle===generation&&ticket===serial&&allowed&&host.isConnected&&!host.hidden;
  busy=true;error='';controls();
  try {
   const result=await request('/api/market/asset-facts'+(refresh?'/refresh':'?'+new URLSearchParams({instrumentUid:chosen.instrumentUid,assetUid:chosen.assetUid})),refresh?{method:'POST',body:JSON.stringify({instrumentUid:chosen.instrumentUid,assetUid:chosen.assetUid,contextKey:binding})}:undefined);
   if(!current())return;
   if(!validAssetFacts(result,chosen,binding)||result.readMode!==(refresh?'explicit-refresh':'saved-only'))throw Object.assign(new Error('Invalid asset facts'),{code:'ASSET_FACTS_RESPONSE_INVALID'});
   data=result;
  } catch(reason) {
   if(!current())return;
   if(!refresh||contextError(reason?.code)||[401,403,409].includes(reason?.status)){data=null;error='Контекст или доступ к сведениям изменился. Перечитайте сохранённые сведения.';}
   else error='Не удалось обновить сведения. Прежний снимок сохранён; повторите обновление.';
  } finally {if(current()){busy=false;render();}}
 }
 for(const name of ['read','refresh'])get(name).addEventListener('click',()=>{if(get(name).getAttribute('aria-disabled')!=='true')void read(name==='refresh');});
 return {update({meta,active,accessKey,permitted,refreshPermitted,replay=false}) {
  const type=meta?.assetType,supported=['bond','etf'].includes(type),identity=meta?.catalogIdentity;
  const candidate={instrumentUid:meta?.instrumentUid,assetUid:meta?.assetUid,assetType:type};
  const bound=assetFactSelection(candidate)&&identity?.contractVersion==='tinvest-catalog-identity-v1'&&identity.instrumentUid===candidate.instrumentUid&&identity.assetType===type&&identity.asset?.state==='present'&&identity.asset.uid===candidate.assetUid&&meta.instrumentOrigin?.provider==='tinvest'&&meta.instrumentOrigin?.market==='broker';
  const next=JSON.stringify([accessKey,active,permitted,refreshPermitted,bound,candidate,replay]);
  if(next!==key){key=next;generation++;serial++;busy=false;data=null;error='';}
  selection=bound?candidate:null;allowed=Boolean(active&&supported&&bound&&permitted&&!replay);canRefresh=Boolean(allowed&&refreshPermitted);
  host.hidden=!active||!supported;
  get('heading').textContent=type==='etf'?'Расходы и стратегия фонда':'Дополнительные условия облигации';
  get('note').textContent=type==='etf'?'Проценты указаны источником. Период расчёта расходов, льготы и состав общей суммы не подтверждены. Значения не складываются и не показывают списания с вашего счёта. Состав фонда здесь не раскрывается.':'Индексируемый номинал — отдельный признак выпуска. Имя заёмщика и текст условий не устанавливают связь с другими выпусками или историю изменений.';
  if(replay)get('note').textContent+=' Сведения об активе на дату воспроизведения не подтверждены.';
  render();if(allowed&&!data&&!busy&&loadedKey!==key){loadedKey=key;void read();}
 }};
}
