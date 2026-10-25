import {canonicalRule,decimal,label,utc,fail} from './price-alert-rule-model.js';
import {validatePriceRulesFile} from './price-rules-transfer-model.js';

export const ALERT_ARCHIVE_LIMITS=Object.freeze({rules:1000,versions:64000,events:100000,pageRows:2000,responseBytes:12*1024*1024,lineBytes:16*1024,fileBytes:384*1024*1024,cursorChars:2048,lifetimeMs:3600000});
const kinds=['rule','version','event'],plural={rule:'rules',version:'versions',event:'events'};
const bytes=v=>new TextEncoder().encode(v).length,hex=(v,n=64)=>typeof v==='string'&&new RegExp('^[a-f0-9]{'+n+'}$').test(v);
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const valid=v=>{if(!v)fail('ALERT_ARCHIVE_INVALID',400);},same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const stamp=(v,nullable=false)=>{if(nullable&&v===null)return null;valid(typeof v==='string'&&utc(v)===v);return v;};
function data(value){
  let count=0;const seen=new Set();
  function visit(v,depth){
    if(++count>120000||depth>9)fail('ALERT_ARCHIVE_LIMIT',413);
    if(v===null||typeof v==='boolean'||typeof v==='number'&&Number.isSafeInteger(v)||typeof v==='string'&&v.length<=ALERT_ARCHIVE_LIMITS.cursorChars)return;
    valid(v&&typeof v==='object'&&!seen.has(v)&&(Array.isArray(v)?Object.getPrototypeOf(v)===Array.prototype:[Object.prototype,null].includes(Object.getPrototypeOf(v))));
    seen.add(v);if(Array.isArray(v)&&v.length>ALERT_ARCHIVE_LIMITS.pageRows)fail('ALERT_ARCHIVE_LIMIT',413);
    for(const key of Reflect.ownKeys(v)){if(Array.isArray(v)&&key==='length')continue;const d=Object.getOwnPropertyDescriptor(v,key);valid(typeof key==='string'&&!['__proto__','prototype','constructor'].includes(key)&&Object.hasOwn(d,'value')&&d.enumerable&&(!Array.isArray(v)||/^\d+$/.test(key)));visit(d.value,depth+1);}
    if(Array.isArray(v))valid(Object.keys(v).length===v.length);seen.delete(v);
  }
  visit(value,0);if(bytes(JSON.stringify(value))>ALERT_ARCHIVE_LIMITS.responseBytes)fail('ALERT_ARCHIVE_LIMIT',413);
}
export function validateArchiveCounts(input){data(input);valid(exact(input,['rules','versions','events']));const result={};for(const name of ['rules','versions','events']){valid(Number.isInteger(input[name])&&input[name]>=0&&input[name]<=ALERT_ARCHIVE_LIMITS[name]);result[name]=input[name];}return result;}
export function validateArchiveHeader(input){
  data(input);valid(exact(input,['type','format','version','coverage','archiveId','startedAt','counts','deliveryObservation'])&&input.type==='header'&&input.format==='vertux.price-alert-archive'&&input.version===1&&input.coverage==='retained-at-start'&&hex(input.archiveId,32)&&input.deliveryObservation==='per-part');
  return{type:'header',format:input.format,version:1,coverage:input.coverage,archiveId:input.archiveId,startedAt:stamp(input.startedAt),counts:validateArchiveCounts(input.counts),deliveryObservation:'per-part'};
}
export function validateArchiveRule(input){
  data(input);return validatePriceRulesFile({format:'vertux.price-rules',version:1,coverage:'current-conditions',exportedAt:'2000-01-01T00:00:00.000Z',rules:[input]}).rules[0];
}
export function validateArchiveVersion(input){
  data(input);valid(exact(input,['key','ruleKey','version','createdAt','status','config','recoveryRecorded'])&&hex(input.key)&&(input.ruleKey===null||hex(input.ruleKey))&&Number.isInteger(input.version)&&input.version>=1&&input.version<=64&&['available','corrupt','unsupported'].includes(input.status)&&typeof input.recoveryRecorded==='boolean');
  const createdAt=stamp(input.createdAt,true);let config=null;
  if(input.status==='available'){valid(input.ruleKey!==null&&createdAt!==null);config=canonicalRule(input.config);valid(same(config,input.config));}else valid(input.config===null);
  return{key:input.key,ruleKey:input.ruleKey,version:input.version,createdAt,status:input.status,config,recoveryRecorded:input.recoveryRecorded};
}
function eventDetails(input){
  valid(exact(input,['ruleVersion','source','subject','targetPrice','actualPrice','intent','sourceTime','receivedAt','readAt','telegramStatus','telegramErrorCode','attempts','nextAttemptAt','evaluationState','nextAllowedAt']));
  valid(Number.isInteger(input.ruleVersion)&&input.ruleVersion>=0&&input.ruleVersion<=64&&input.source==='tradingview'&&exact(input.subject,['exchange','symbol'])&&['buy','sell','watch'].includes(input.intent));
  valid(label(input.subject.exchange,'exchange')===input.subject.exchange&&label(input.subject.symbol,'symbol')===input.subject.symbol&&decimal(input.targetPrice)===input.targetPrice&&decimal(input.actualPrice)===input.actualPrice);
  valid(['pending','not_configured','sent','failed','unknown'].includes(input.telegramStatus)&&(input.telegramErrorCode===null||typeof input.telegramErrorCode==='string'&&/^(?:ALERT|TELEGRAM)_[A-Z0-9_]{1,54}$/.test(input.telegramErrorCode))&&Number.isInteger(input.attempts)&&input.attempts>=0&&input.attempts<=20);
  valid(input.ruleVersion===0?input.evaluationState==='legacy'&&input.nextAllowedAt===null:['accepted','cooldown-suppressed'].includes(input.evaluationState)&&input.nextAllowedAt!==null);
  const result={...input,subject:{exchange:input.subject.exchange,symbol:input.subject.symbol}};
  for(const name of ['sourceTime','receivedAt','readAt','nextAttemptAt','nextAllowedAt'])result[name]=stamp(input[name],['readAt','nextAttemptAt','nextAllowedAt'].includes(name));return result;
}
export function validateArchiveEvent(input){
  data(input);valid(exact(input,['key','ruleKey','status','details'])&&hex(input.key)&&(input.ruleKey===null||hex(input.ruleKey))&&['recorded','unavailable'].includes(input.status));
  if(input.status==='unavailable'){valid(input.details===null);return{key:input.key,ruleKey:input.ruleKey,status:input.status,details:null};}
  valid(input.ruleKey!==null);return{key:input.key,ruleKey:input.ruleKey,status:'recorded',details:eventDetails(input.details)};
}
export function validateArchiveCursor(value){valid(typeof value==='string'&&value.length<=ALERT_ARCHIVE_LIMITS.cursorChars&&/^[A-Za-z0-9_-]+\.[a-f0-9]{64}$/.test(value));return value;}
const archiveRoot='/api/alerts/versioned/archive';
export function priceAlertArchivePath(cursor=null){return cursor===null?archiveRoot:archiveRoot+'/'+validateArchiveCursor(cursor);}
export function isPriceAlertArchivePath(path){return typeof path==='string'&&(path===archiveRoot||path.startsWith(archiveRoot+'/')&&path.length<=archiveRoot.length+1+ALERT_ARCHIVE_LIMITS.cursorChars&&/^[A-Za-z0-9_-]+\.[a-f0-9]{64}$/.test(path.slice(archiveRoot.length+1)));}
export function validateArchiveStart(input){
  data(input);valid(exact(input,['schema','ownerScope','header','rules','cursor'])&&input.schema==='price-alert-archive-start-v1'&&hex(input.ownerScope)&&Array.isArray(input.rules));
  const header=validateArchiveHeader(input.header),rules=input.rules.map(validateArchiveRule);valid(rules.length===header.counts.rules&&new Set(rules.map(r=>r.key)).size===rules.length);
  const cursor=header.counts.versions+header.counts.events===0?(valid(input.cursor===null),null):validateArchiveCursor(input.cursor);
  return{schema:input.schema,ownerScope:input.ownerScope,header,rules,cursor};
}
export function validateArchivePart(input,header=null){
  data(input);if(header!==null)header=validateArchiveHeader(header);valid(exact(input,['schema','archiveId','observedAt','section','offset','entries','nextCursor'])&&input.schema==='price-alert-archive-part-v1'&&hex(input.archiveId,32)&&(header===null||input.archiveId===header.archiveId)&&['versions','events'].includes(input.section)&&Number.isInteger(input.offset)&&input.offset>=0&&Array.isArray(input.entries)&&input.entries.length>0&&input.entries.length<=ALERT_ARCHIVE_LIMITS.pageRows&&input.offset+input.entries.length<=(header?.counts??ALERT_ARCHIVE_LIMITS)[input.section]);
  const observedAt=stamp(input.observedAt);valid(header===null||Date.parse(observedAt)>=Date.parse(header.startedAt));
  const entries=input.entries.map(input.section==='versions'?validateArchiveVersion:validateArchiveEvent),nextCursor=input.nextCursor===null?null:validateArchiveCursor(input.nextCursor);
  return{schema:input.schema,archiveId:input.archiveId,observedAt,section:input.section,offset:input.offset,entries,nextCursor};
}
export function archiveLine(value){const line=JSON.stringify(value)+'\n';if(bytes(line)>ALERT_ARCHIVE_LIMITS.lineBytes)fail('ALERT_ARCHIVE_LIMIT',413);return line;}
const business=config=>JSON.stringify([config.subject.exchange,config.subject.symbol,config.targetPrice,config.intent]);
export function createArchiveAccumulator(input,{collect=true}={}){
  const header=validateArchiveHeader(input),counts={rules:0,versions:0,events:0},keys={rules:new Set(),versions:new Set(),events:new Set()},versions=new Map(),heads=new Map(),versionCounts=new Map(),rows={rules:[],versions:[],events:[]};let ended=false,totalBytes=bytes(archiveLine(header));
  function checkHeads(){for(const [key,head]of heads){const retained=versionCounts.get(key)??{count:0,maximum:0};valid(head.version===0?retained.count===0:head.matched&&retained.count===head.version&&retained.maximum===head.version);}}
  function push(input){
    data(input);valid(!ended);
    if(input.type==='end'){
      valid(exact(input,['type','archiveId','counts'])&&input.archiveId===header.archiveId&&same(validateArchiveCounts(input.counts),header.counts)&&same(counts,header.counts));checkHeads();ended=true;totalBytes+=bytes(archiveLine(input));
      if(totalBytes>ALERT_ARCHIVE_LIMITS.fileBytes)fail('ALERT_ARCHIVE_LIMIT',413);return{type:'end',archiveId:header.archiveId,counts:{...counts}};
    }
    valid(exact(input,['type','observedAt','value'])&&kinds.includes(input.type));const kind=plural[input.type],rank=kinds.indexOf(input.type);
    valid(kinds.slice(0,rank).every(k=>counts[plural[k]]===header.counts[plural[k]])&&kinds.slice(rank+1).every(k=>counts[plural[k]]===0)&&counts[kind]<header.counts[kind]);
    const observedAt=stamp(input.observedAt);valid(Date.parse(observedAt)>=Date.parse(header.startedAt));
    if(kind==='rules')valid(observedAt===header.startedAt);
    const value=({rules:validateArchiveRule,versions:validateArchiveVersion,events:validateArchiveEvent})[kind](input.value);valid(!keys[kind].has(value.key));
    if(kind==='rules'&&['active','paused','legacy'].includes(value.state))heads.set(value.key,{version:value.ruleVersion,config:JSON.stringify(value.config),matched:false});
    if(kind==='versions'){
      valid(value.ruleKey===null||keys.rules.has(value.ruleKey));
      if(value.ruleKey!==null){const pair=value.ruleKey+':'+value.version;valid(!versions.has(pair));versions.set(pair,value.status==='available'?business(value.config):null);
        const retained=versionCounts.get(value.ruleKey)??{count:0,maximum:0};retained.count++;retained.maximum=Math.max(retained.maximum,value.version);versionCounts.set(value.ruleKey,retained);
        const head=heads.get(value.ruleKey);if(head?.version===value.version){valid(value.status==='available'&&JSON.stringify(value.config)===head.config);head.matched=true;}
      }
    }else if(kind==='events'){
      valid(value.ruleKey===null||keys.rules.has(value.ruleKey));
      if(value.status==='recorded'&&value.details.ruleVersion>0)valid(versions.get(value.ruleKey+':'+value.details.ruleVersion)===business(value.details));
    }
    const record={type:input.type,observedAt,value};totalBytes+=bytes(archiveLine(record));if(totalBytes>ALERT_ARCHIVE_LIMITS.fileBytes)fail('ALERT_ARCHIVE_LIMIT',413);
    counts[kind]++;keys[kind].add(value.key);if(collect)rows[kind].push(record);return record;
  }
  return Object.freeze({header,push,get counts(){return{...counts};},get byteLength(){return totalBytes;},get complete(){return ended;},result(){valid(ended);return{header,...rows};}});
}
// Parts become a downloadable file only after the complete ordered set and its
// references have passed validation. Cursors and native authority stay outside it.
export function createArchiveDownload(input){
  const start=validateArchiveStart(input),acc=createArchiveAccumulator(start.header,{collect:false});
  const parts=[archiveLine(start.header)+start.rules.map(value=>archiveLine(acc.push({type:'rule',observedAt:start.header.startedAt,value}))).join('')];
  let cursor=start.cursor,finished=false,reads=0;
  return Object.freeze({get cursor(){return cursor;},get counts(){return acc.counts;},get header(){return structuredClone(start.header);},
    append(input){
      valid(!finished&&cursor!==null&&++reads<=82);const part=validateArchivePart(input,start.header),counts=acc.counts;
      valid(part.section===(counts.versions<start.header.counts.versions?'versions':'events')&&part.offset===counts[part.section]);
      parts.push(part.entries.map(value=>archiveLine(acc.push({type:part.section==='versions'?'version':'event',observedAt:part.observedAt,value}))).join(''));
      const remaining=acc.counts.versions<start.header.counts.versions||acc.counts.events<start.header.counts.events;
      valid(remaining?part.nextCursor!==null&&part.nextCursor!==cursor:part.nextCursor===null);cursor=part.nextCursor;
    },finish(){
      valid(!finished&&cursor===null);parts.push(archiveLine(acc.push({type:'end',archiveId:start.header.archiveId,counts:start.header.counts})));finished=true;
      return{parts,header:structuredClone(start.header),byteLength:acc.byteLength};
    }});
}
export async function decodePriceAlertArchiveStream(stream,{isCurrent=()=>true,onProgress=()=>{},collect=true}={}){
  if(typeof stream?.getReader!=='function')fail('ALERT_ARCHIVE_INVALID',400);
  const reader=stream.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let pending='',byteCount=0,lines=0,accumulator=null,complete=false;
  function line(text){
    if(!text||bytes(text)+1>ALERT_ARCHIVE_LIMITS.lineBytes)fail('ALERT_ARCHIVE_INVALID',400);let value;try{value=JSON.parse(text);}catch{fail('ALERT_ARCHIVE_INVALID',400);}
    if(!accumulator)accumulator=createArchiveAccumulator(value,{collect});else accumulator.push(value);lines++;
  }
  try{
    for(;;){
      if(!isCurrent())fail('ALERT_ARCHIVE_CANCELLED',409);const {value,done}=await reader.read();if(!isCurrent())fail('ALERT_ARCHIVE_CANCELLED',409);
      if(done)break;if(!(value instanceof Uint8Array)||(byteCount+=value.byteLength)>ALERT_ARCHIVE_LIMITS.fileBytes)fail('ALERT_ARCHIVE_LIMIT',413);
      pending+=decoder.decode(value,{stream:true});let newline;
      while((newline=pending.indexOf('\n'))>=0){line(pending.slice(0,newline));pending=pending.slice(newline+1);if(lines%500===0){onProgress({bytes:byteCount,records:lines-1});await new Promise(resolve=>setTimeout(resolve,0));if(!isCurrent())fail('ALERT_ARCHIVE_CANCELLED',409);}}
      if(bytes(pending)>ALERT_ARCHIVE_LIMITS.lineBytes)fail('ALERT_ARCHIVE_LIMIT',413);
    }
    pending+=decoder.decode();valid(pending===''&&accumulator?.complete);complete=true;onProgress({bytes:byteCount,records:lines-2});return accumulator.result();
  }catch(error){if(error?.code)throw error;fail('ALERT_ARCHIVE_INVALID',400);}
  finally{if(!complete)try{await reader.cancel();}catch{}reader.releaseLock();}
}
