const CONTRACT='tinvest-catalog-identity-v1', TYPES=new Set(['share','bond','etf','currency','future']), LIMIT=50;
const uid=value=>typeof value==='string'&&/^[A-Za-z0-9._:@/-]{1,160}$/u.test(value)?value:null;
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const exact=(value,keys)=>object(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const iso=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&Date.parse(value)>0?new Date(value).toISOString():null;
const copy=value=>structuredClone(value), refEqual=(a,b)=>a?.namespace===b?.namespace&&a?.instrumentUid===b?.instrumentUid;
const field=(value,notApplicable=false)=>{
 if(!exact(value,['state','uid']))return {state:'invalid',uid:null};
 if(value.state==='present'&&uid(value.uid))return {state:'present',uid:value.uid};
 if(value.uid===null&&['absent','invalid',...(notApplicable?['not-applicable']:[])].includes(value.state))return {state:value.state,uid:null};
 return {state:'invalid',uid:null};
};
// Only the native catalog producer can supply these links. User selections and
// holdings never complete missing catalog identity, source dates or membership.
export function catalogIdentityForDisplay(row){
 const raw=row?.catalogIdentity,source=row?.catalogIdentitySource;
 if(!exact(raw,['contractVersion','instrumentUid','assetType','asset','position','underlyingPosition'])||raw.contractVersion!==CONTRACT)
  return {contractVersion:CONTRACT,state:'unsupported',reason:'legacy-catalog'};
 const asset=field(raw.asset),position=field(raw.position),underlyingPosition=field(raw.underlyingPosition,raw.assetType!=='future');
 const value={contractVersion:CONTRACT,state:'invalid',reason:'invalid-identity',instrumentUid:uid(raw.instrumentUid),assetType:raw.assetType,asset,position,underlyingPosition,source:null};
 const valid=raw.instrumentUid===row.instrumentUid&&TYPES.has(raw.assetType)&&raw.assetType===row.assetType
  &&row.instrumentOrigin?.provider==='tinvest'&&row.instrumentOrigin?.market==='broker'
  &&[asset,position,underlyingPosition].every(item=>item.state!=='invalid')
  &&(raw.assetType==='future'?underlyingPosition.state!=='not-applicable':underlyingPosition.state==='not-applicable')
  &&(asset.uid??null)===(uid(row.assetUid)??null);
 if(!valid)return value;
 if(!exact(source,['kind','assetType','capturedAt','stale','validAt'])||source.kind!=='catalog'||source.assetType!==raw.assetType||!iso(source.capturedAt)||typeof source.stale!=='boolean'||source.validAt!==null){value.state='unavailable';value.reason='catalog-date-unverified';return value;}
 value.source={kind:'catalog',assetType:raw.assetType,capturedAt:iso(source.capturedAt),stale:source.stale,validAt:null};
 value.state='verified';value.reason=null;return value;
}
const indexes=new WeakMap();
function indexFor(registry){
 if(indexes.has(registry))return indexes.get(registry);
 const index={position:new Map(),asset:new Map()};
 for(const entry of registry.values())for(const claim of entry.catalogClaims||[]){
  for(const kind of ['position','asset']){
   const id=claim?.[kind]?.state==='present'&&uid(claim[kind].uid);if(!id)continue;
   let group=index[kind].get(id);if(!group){group={rows:new Map(),blocked:false,types:new Set(),assets:new Set()};index[kind].set(id,group);}
   group.types.add(claim.assetType);if(claim.asset?.uid)group.assets.add(claim.asset.uid);
   const usable=entry.catalogClaims.length===1&&entry.resolution==='exact'&&entry.ref.namespace==='tinvest:broker'&&entry.meta?.catalogIdentity?.state==='verified'&&claim.state==='verified';
   if(!usable)group.blocked=true;
   group.rows.set(entry.ref.instrumentUid,entry);
  }
 }
 indexes.set(registry,index);return index;
}
const absent=(state,code)=>({state,code,items:[],count:0});
function candidate(entry){
 const meta=entry.meta,identity=meta.catalogIdentity;
 return {ref:copy(entry.ref),assetType:meta.assetType,ticker:meta.ticker||'',name:meta.name||'',classCode:meta.classCode||null,
  exchange:meta.exchange||meta.realExchange||null,currency:meta.currency||null,lot:Number.isSafeInteger(meta.lot)&&meta.lot>0?meta.lot:null,source:copy(identity.source)};
}
export function catalogLinksForInstrument(registry,entry){
 const identity=entry?.meta?.catalogIdentity,meta=entry?.meta;
 if(entry?.ref?.namespace!=='tinvest:broker'||!meta||!TYPES.has(meta.assetType))return null;
 const base={contractVersion:'instrument-catalog-links-v1',ref:copy(entry.ref),source:identity?.source?copy(identity.source):null,
  underlying:absent(meta.assetType==='future'?'unavailable':'not-applicable',meta.assetType==='future'?'legacy-catalog':'not-applicable'),
  samePosition:absent('unavailable','legacy-catalog'),sameAsset:absent('unavailable','legacy-catalog')};
 if(entry.catalogClaims?.length>1){for(const key of ['samePosition','sameAsset',...(meta.assetType==='future'?['underlying']:[])])base[key]=absent('ambiguous','conflicting-catalog');return base;}
 if(identity?.state!=='verified'){const code=identity?.reason||'legacy-catalog';for(const key of ['samePosition','sameAsset',...(meta.assetType==='future'?['underlying']:[])])base[key]=absent('unavailable',code);return base;}
 const index=indexFor(registry);
 function matches(kind,id,{underlying=false}={}){
  if(!id)return absent('unavailable','identifier-not-provided');
  if(underlying&&id===identity.position.uid)return absent('ambiguous','self-reference');
  const group=index[kind].get(id);if(!group)return absent(underlying?'unavailable':'empty','not-in-saved-catalog');
  if(group.blocked||group.types.size>1||kind==='position'&&group.assets.size>1)return {...absent('ambiguous','conflicting-catalog'),count:group.rows.size};
  if(group.rows.size>LIMIT)return {...absent('unavailable','catalog-link-limit'),count:group.rows.size};
  const rows=[...group.rows.values()].filter(row=>row.ref.instrumentUid!==entry.ref.instrumentUid
   &&(kind!=='asset'||!identity.position.uid||row.meta.catalogIdentity.position.uid!==identity.position.uid));
  if(underlying&&rows.some(row=>meta.assetType==='future'&&row.meta.assetType==='future'&&identity.position.uid&&row.meta.catalogIdentity.underlyingPosition.uid===identity.position.uid))return absent('ambiguous','circular-reference');
  const items=rows.map(candidate).sort((a,b)=>a.ref.instrumentUid.localeCompare(b.ref.instrumentUid));
  return {state:items.length?'ready':underlying?'unavailable':'empty',code:items.length?null:'not-in-saved-catalog',items,count:items.length};
 }
 if(meta.assetType==='future')base.underlying=matches('position',identity.underlyingPosition.uid,{underlying:true});
 base.samePosition=matches('position',identity.position.uid);base.sameAsset=matches('asset',identity.asset.uid);return base;
}
const kinds=new Set(['underlying','samePosition','sameAsset']);
export function catalogLinkTarget(snapshot,selection){
 if(!snapshot?.meta||snapshot.resolution!=='exact'||!kinds.has(selection?.kind)||selection.revision!==snapshot.revision||!refEqual(selection.fromRef,snapshot.ref))return null;
 const group=snapshot.identity?.catalogLinks?.[selection.kind];
 return group?.state==='ready'?group.items.find(item=>refEqual(item.ref,selection.ref))||null:null;
}
// A single return step is tied to the exact context revision. Source replacement,
// scope changes, manual selection, pins or a reentrant listener invalidate it.
export function createCatalogLinkNavigation(context,{surface='research'}={}){
 let back=null;
 const currentBack=()=>{const snapshot=context.get(surface);if(!back||snapshot.revision!==back.revision||snapshot.scopeKey!==back.scopeKey||!refEqual(snapshot.ref,back.targetRef)){back=null;return null;}return back;};
 return {
  open(selection,{analysisTab='profile'}={}){
   const from=context.get(surface),item=catalogLinkTarget(from,selection);if(!item)return false;
   const target=context.resolve(item.ref);if(!target.meta||target.resolution!=='exact'||!refEqual(target.ref,item.ref))return false;
   const token=context.capture(surface);if(!context.isCurrent(token,surface))return false;
   back=null;context.select(item.ref,{surface});const selected=context.get(surface);
   if(!refEqual(selected.ref,item.ref)||selected.scopeKey!==from.scopeKey||selected.resolution!=='exact')return false;
   back={ref:copy(from.ref),label:[from.meta.ticker,from.meta.name!==from.meta.ticker?from.meta.name:null].filter(Boolean).join(' · ')||'Исходный инструмент',analysisTab,targetRef:copy(selected.ref),scopeKey:selected.scopeKey,revision:selected.revision};return true;
  },
  returnTarget(){const value=currentBack();return value?copy({ref:value.ref,label:value.label,analysisTab:value.analysisTab}):null;},
  back(){const value=currentBack();if(!value)return null;const origin=context.resolve(value.ref);if(!origin.meta||origin.resolution!=='exact'){back=null;return null;}
   back=null;context.select(value.ref,{surface});const selected=context.get(surface);return refEqual(selected.ref,value.ref)&&selected.scopeKey===value.scopeKey?{analysisTab:value.analysisTab}:null;
  },
  clear(){back=null;},
 };
}
export function catalogLinkReason(code){return ({
 'legacy-catalog':'В этой копии каталога связь по идентификаторам не подтверждена. Она появится после обычного обновления, если источник передаст данные.',
 'invalid-identity':'В каталоге противоречивые идентификаторы. Связь не используется.',
 'catalog-date-unverified':'Дата получения этой копии каталога не подтверждена.',
 'identifier-not-provided':'Брокер не передал идентификатор связи.',
 'not-in-saved-catalog':'Подходящего инструмента нет в сохранённом каталоге. Полный рынок здесь не проверяется.',
 'conflicting-catalog':'Сохранённые записи противоречат друг другу. Выбор по этой связи недоступен.',
 'self-reference':'Каталог связывает контракт с его собственной позицией. Такая связь не используется.',
 'circular-reference':'В каталоге взаимная ссылка между контрактами. Такая связь не используется.',
 'catalog-link-limit':'С этой связью совпало больше 50 записей. Список не сокращается до случайного первого варианта.',
})[code]||'Связь в сохранённом каталоге не подтверждена.';}

const esc=value=>String(value??'').replace(/[&<>"']/gu,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function catalogSourceLabel(source){
 const at=iso(source?.capturedAt);if(!at)return 'Дата каталога не подтверждена.';
 const date=new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'}).format(new Date(at));
 return 'Каталог получен '+date+' МСК'+(source.stale?' · копия устарела.':'.');
}
export function catalogReturnMarkup(target){return target?'<button type="button" class="button secondary catalog-link-return" data-catalog-return>Вернуться к '+esc(target.label)+'</button>':'';}
export function catalogLinksMarkup(value){
 if(value?.replay||!value?.catalogLinks)return '';
 const links=value.catalogLinks,groups=[['underlying','Базовый актив'],['samePosition','Другие режимы торгов'],['sameAsset','Другие инструменты этого актива']];
 return groups.flatMap(([kind,title])=>{
  const group=links[kind];if(!group||group.state==='not-applicable'||kind!=='underlying'&&group.state!=='ready'&&group.state!=='ambiguous'&&group.code!=='catalog-link-limit')return [];
  const items=group.state==='ready'?'<ul>'+group.items.map(item=>{
   const label=[item.ticker,item.name!==item.ticker?item.name:null].filter(Boolean).join(' · ')||'Инструмент';
   const detail=[item.exchange,item.classCode,item.currency,item.lot?'Лот '+item.lot:'Лот не указан'].filter(Boolean).join(' · ');
   return '<li><button type="button" class="button secondary" data-catalog-link-kind="'+kind+'" data-catalog-link-uid="'+esc(item.ref.instrumentUid)+'" data-catalog-link-namespace="'+esc(item.ref.namespace)+'"><span>Открыть '+esc(label)+'</span><small>'+esc(detail)+'</small></button><p class="catalog-link-source">'+esc(catalogSourceLabel(item.source))+'</p></li>';
  }).join('')+'</ul>':'<p>'+esc(catalogLinkReason(group.code))+'</p>';
  return ['<section class="instrument-catalog-links" data-catalog-link-group="'+kind+'"><h4>'+title+'</h4>'+(group.state==='ready'?'<p>'+(kind==='underlying'?'Связь по идентификатору базовой позиции брокера. ':kind==='samePosition'?'Одна позиция брокера, разные торговые инструменты. ':'Один актив брокера; это не связь с эмитентом. ')+(group.items.length>1?'Выберите режим торгов с нужной валютой и размером лота.':'')+'</p><p class="catalog-link-source">'+esc(catalogSourceLabel(links.source))+'</p>':'')+items+'</section>'];
 }).join('');
}
