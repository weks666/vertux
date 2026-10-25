import {PRODUCT_FEATURES,FEATURE_TERMS} from './product-features.js';
import {createInstrumentContext} from './instrument-context.js';
import {RESEARCH_QUERY_CATALOG} from './research-query-contract.js';
import {validateResearchQuerySummaries} from './research-query-record.js';

const normalize=value=>String(value??'').toLocaleLowerCase('ru').replace(/ё/gu,'е').replace(/[^\p{L}\p{N}%/]+/gu,' ').trim();
const identifier=value=>String(value??'').trim().toLocaleUpperCase('ru');
const types={share:'Акция',future:'Фьючерс',bond:'Облигация',etf:'Фонд',currency:'Валюта',crypto:'Криптоактив'};
const tabs={price:'Цена',risk:'Риск',performance:'Результат',financials:'Отчётность',seasonality:'Сезонность',technical:'Технические показатели',profile:'Профиль'};
const resolutionReason={ambiguous:'Источник инструмента неоднозначен',missing:'Инструмент отсутствует в доступном каталоге','scoped-legacy':'Источник инструмента не подтверждён'};
const sameRef=(a,b)=>a?.namespace===b?.namespace&&a?.instrumentUid===b?.instrumentUid;
const array=value=>Array.isArray(value)?value:[];
// Provider schedule codes (moex_mrng_evng_e_wknd_dlr, REAL_EXCHANGE_MOEX) are not shown raw.
const exchanges={REAL_EXCHANGE_MOEX:'Мосбиржа',REAL_EXCHANGE_RTS:'СПБ Биржа',REAL_EXCHANGE_OTC:'Внебиржевой рынок',REAL_EXCHANGE_DEALER:'Дилер'};
const exchangeTitle=meta=>exchanges[meta?.realExchange]||(meta?.exchange&&!/^[a-z0-9_]+$/u.test(meta.exchange)&&!/^REAL_EXCHANGE_/u.test(meta.exchange)?meta.exchange:null);
const expiry=value=>typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}/u.test(value)?null:Number(value.slice(0,4))>=2090?'бессрочный':'до '+value.slice(8,10)+'.'+value.slice(5,7)+'.'+value.slice(0,4);
const caption=meta=>[types[meta?.assetType]||'Тип не указан',exchangeTitle(meta),meta?.classCode,meta?.currency?.toUpperCase(),expiry(meta?.expirationDate)].filter(Boolean).join(' · ');
// The main trading board of a ticker is listed before odd-lot and negotiated boards.
const MAIN_BOARDS=new Set(['TQBR','TQTF','TQTD','TQCB','TQOB','TQIR','TQRD','SPBFUT','SPBOPT','CETS','SPBXM','SPBRU','SPBDE']);
const searchable=new WeakMap();
function score(query,row){
 const value=baseScore(query,row);
 return value>0&&row.kind==='instrument'&&row.primaryBoard?value+8:value;
}
function baseScore(query,row){
 if(!query.raw)return row.kind==='saved'?300-(row.pinOrder??100):row.kind==='query'?150:row.kind==='section'?100:0;
 const {exact,words,text}=query;
 let prepared=searchable.get(row);
 if(!prepared){const title=normalize(row.title);prepared={title,all:title+' '+normalize(row.search)};searchable.set(row,prepared);}
 const {title,all}=prepared;
 if(!words.length)return 0;
 if(row.kind==='instrument'){
  if(row.identifiers?.uid===exact)return 1000;
  if(row.identifiers?.isin===exact)return 980;
  if(row.identifiers?.ticker===exact)return 960;
 }
 // A visible heading may duplicate a registered section title, but lacks its
 // navigation behavior (for example opening the catalogue disclosure).
 if(title===text)return row.kind==='instrument'?900:row.kind==='page'?790:800;
 if(!words.every(word=>all.includes(word)))return 0;
 return title.startsWith(text)?700:words.every(word=>title.includes(word))?600:400;
}

function catalogIndex(catalog){
 const context=createInstrumentContext();context.replaceSources({catalog:array(catalog),scopeKey:'search-index'});
 const unique=new Map();
 for(const row of array(catalog))if(typeof row?.instrumentUid==='string'){const entries=unique.get(row.instrumentUid)||[];entries.push(row);unique.set(row.instrumentUid,entries);}
 const instruments=[...unique].map(([uid,candidates])=>{
  const raw=candidates[0];
  const resolved=context.resolve(uid),meta=resolved.meta||raw,exact=resolved.resolution==='exact';
  return {key:'instrument:'+uid,kind:'instrument',title:[meta.ticker,meta.name].filter(Boolean).join(' · ')||'Инструмент без названия',
   caption:resolved.resolution==='ambiguous'?'Данные источников конфликтуют':caption(meta),instrumentRef:resolved.ref,resolution:resolved.resolution,reason:exact?null:resolutionReason[resolved.resolution]||'Источник недоступен',
   actions:exact?['research','terminal']:['catalog'],identifiers:{uid:identifier(uid),isin:identifier(meta.isin),ticker:identifier(meta.ticker)},primaryBoard:MAIN_BOARDS.has(identifier(meta.classCode)),
   search:[meta.classCode,meta.basicAsset,meta.sector,meta.isin,uid,types[meta.assetType],meta.currency,meta.exchange,meta.expirationDate?.slice(0,10),...candidates.flatMap(row=>[row.ticker,row.name])].filter(Boolean).join(' ')};
 });
 for(const row of instruments){const title=normalize(row.title);searchable.set(row,{title,all:title+' '+normalize(row.search)});}
 return {context,instruments};
}

/** Reuse only the immutable catalog snapshot. Access and saved results are read on every search. */
export function createProductSearch(){
 let previous=null,index=null;
 return (query,data={})=>{
  const catalog=Array.isArray(data.catalog)?data.catalog:EMPTY_CATALOG;
  if(catalog!==previous){index=catalogIndex(catalog);previous=catalog;}
  return searchProduct(query,data,index);
 };
}
const EMPTY_CATALOG=Object.freeze([]);

/** Existing product metadata and canonical identity resolver, never an alias registry. */
export function searchProduct(query,{catalog=[],terms=FEATURE_TERMS,pages=[],savedResearch=null,researchQueries=null,features=PRODUCT_FEATURES}={},index=null){
 const {context,instruments}=index||catalogIndex(catalog);
 const saved=savedResearch?.state==='ready'?array(savedResearch.entries).map(entry=>{
  const resolved=context.resolve(entry.instrumentRef),exact=resolved.resolution==='exact'&&sameRef(resolved.ref,entry.instrumentRef),restorable=exact&&entry.restorable===true;
  const resolution=exact?'exact':resolved.resolution==='exact'?'missing':resolved.resolution;
  return {key:'saved:'+entry.id,id:entry.id,kind:'saved',title:entry.title,caption:[resolved.meta?.ticker,caption(resolved.meta),tabs[entry.analysisTab]||'Вкладка недоступна'].filter(Boolean).join(' · '),
   instrumentRef:entry.instrumentRef,resolution,reason:restorable?null:entry.reason||resolutionReason[resolution]||'Сохранённую идентичность пока нельзя подтвердить',
   actions:restorable?['restore']:[],pinOrder:entry.pinOrder,search:[resolved.meta?.ticker,resolved.meta?.name].filter(Boolean).join(' ')};
 }):[];
 let queryState=researchQueries?.state,queryEntries=[];
 if(queryState==='ready')try{queryEntries=validateResearchQuerySummaries(researchQueries.entries);}catch{queryState='error';}
 const queries=queryEntries.map(row=>{const metric=RESEARCH_QUERY_CATALOG.find(metric=>metric.key===row.query.metricKey),condition=`${metric.label} · ${metric.period} ${row.query.operator==='gte'?'≥':'≤'} ${row.query.threshold} ${row.query.unit}`;
  return {key:'query:'+row.id,kind:'query',id:row.id,payloadHash:row.payloadHash,title:row.title,
   caption:`Сохранён ${new Date(row.createdAt).toLocaleDateString('ru-RU',{timeZone:'Europe/Moscow'})} · акций: ${row.query.instrumentUids.length} · ${condition}`,
   reason:'Исторический результат. Текущие данные при открытии не проверяются.',search:condition,actions:['open-query']};
 });
 const queryStatus=['unloaded','loading','error'].includes(queryState)||queryState==='ready'&&!queryEntries.length?{
  key:'query-state:'+queryState,kind:'query-status',title:queryState==='error'?'Сохранённые результаты не прочитаны':queryState==='loading'?'Загружаем сохранённые результаты':queryState==='ready'?'Сохранённых результатов пока нет':'Сохранённые результаты ещё не загружены',
  caption:queryState==='error'?'Количество неизвестно. Можно повторить чтение.':queryState==='ready'?'Личный архив на этом устройстве пуст.':'Личный архив на этом устройстве.',actions:['unloaded','error'].includes(queryState)?['reload-queries']:[]}:null;
 const entries=[...instruments,...saved,...queries,...array(features).map(row=>({...row,key:'section:'+row.id,kind:'section',caption:'Раздел',search:row.keywords,actions:['navigate']})),
  ...Object.entries(terms||{}).map(([id,term])=>({key:'term:'+id,kind:'term',title:term.name,caption:'Термин',view:'glossary',term:id,search:[term.abbr,term.nameEn,term.summary,term.details,term.formula].join(' '),actions:['navigate']})),
  ...array(pages).map(row=>({...row,key:'page:'+row.id,kind:'page',caption:'На экране',actions:['navigate']}))];
 const seen=new Set();
 const raw=String(query??'').trim(),text=normalize(raw),prepared={raw,text,exact:identifier(raw),words:text.split(/\s+/u).filter(Boolean)};
 const found=entries.flatMap(row=>{const value=score(prepared,row);return value>0?[{...row,score:value}]:[];})
  .sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title,'ru')||a.key.localeCompare(b.key))
  .filter(row=>{const key=row.kind==='page'?'target:'+row.view+'|'+row.target:row.key;if(seen.has(key))return false;seen.add(key);return true;}).slice(0,queryStatus?23:24);
 return queryStatus?[...found,queryStatus]:found;
}

export function catalogNotice(state){return ({loading:'Каталог загружается. Разделы приложения доступны.',unavailable:'Каталог недоступен. Поиск по разделам остаётся доступен.',partial:'Результаты ограничены полученной частью каталога.',stale:'Показан сохранённый каталог. Актуальность источника не подтверждена.'})[state]||'Поиск в доступном каталоге и разделах приложения.';}
