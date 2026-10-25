import {validateResearchQuerySummaries,validateResearchQueryRecord} from './research-query-record.js';
import {validateResearchQueryResponse} from './research-query-contract.js';

const clone=value=>structuredClone(value),fail=code=>({ok:false,code});
// Personal titles live only in this owner/access-scoped memory. Opening never
// executes the saved predicate or grants access to its current instrument data.
export function createResearchQuerySearch({request,getAccess,onChange=()=>{},onOpen}) {
 let key=null,allowed=false,denied=false,epoch=0,read=null,openSerial=0,disposed=false,state='forbidden',entries=[];
 const publish=()=>onChange();
 function sync(notify=true){
  const access=getAccess()||{},nextAllowed=!disposed&&access.allowed===true&&typeof access.key==='string',nextKey=nextAllowed?access.key:null;
  if(nextKey!==key||nextAllowed!==allowed){key=nextKey;allowed=nextAllowed;denied=false;++epoch;++openSerial;read=null;entries=[];state=allowed?'unloaded':'forbidden';if(notify)publish();}
  return allowed&&!denied&&!disposed;
 }
 const current=(version,owner)=>sync(false)&&version===epoch&&owner===key;
 const snapshot=()=>{sync(false);return {state,entries:state==='ready'?clone(entries):[]};};
 const selected=row=>state==='ready'&&entries.find(entry=>entry.id===row?.id&&entry.payloadHash===row?.payloadHash);
 function invalidate(){sync(false);++epoch;++openSerial;read=null;entries=[];state=allowed&&!denied?'unloaded':'forbidden';publish();}
 async function refresh(){
  if(!sync())return snapshot();if(read)return read;
  const version=++epoch,owner=key;++openSerial;entries=[];state='loading';publish();
  const work=Promise.resolve().then(async()=>{
   try{const value=await request('/api/research/query/archive');if(!current(version,owner))return snapshot();entries=clone(validateResearchQuerySummaries(value?.records));state='ready';}
   catch(error){if(current(version,owner)){entries=[];denied=[401,403].includes(error?.status);state=denied?'forbidden':'error';}}
   finally{if(version===epoch&&owner===key){read=null;publish();}}
   return snapshot();
  });read=work;return work;
 }
 function canOpen(row){return sync(false)&&Boolean(selected(row));}
 function canRefresh(){return sync(false)&&state!=='loading';}
 async function open(row,{isCurrent}={}){
  if(typeof isCurrent!=='function'||!isCurrent()||!canOpen(row)||typeof onOpen!=='function')return fail('stale');
  const summary=clone(selected(row)),version=epoch,owner=key,operation=++openSerial;
  try{
   const value=await request('/api/research/query/archive?id='+encodeURIComponent(summary.id));
   if(!current(version,owner)||operation!==openSerial||!isCurrent()||!selected(summary))return fail('stale');
   const record=validateResearchQueryRecord(value?.record,{wire:true});
   if(record.id!==summary.id||record.payloadHash!==summary.payloadHash||record.title!==summary.title||record.createdAt!==summary.createdAt)throw Error('Saved query identity changed');
   validateResearchQueryResponse(record.packet,summary.query,{result:true});
   const accepted=onOpen(clone(record),{isCurrent:()=>current(version,owner)&&operation===openSerial&&isCurrent()});
   if(accepted&&typeof accepted.then==='function'){Promise.resolve(accepted).catch(()=>{});return fail('async-bridge');}
   return current(version,owner)&&accepted===true?{ok:true}:fail('not-opened');
  }catch(error){
   if(!current(version,owner)||operation!==openSerial||!isCurrent())return fail('stale');
   // The chooser displays the failure and rerenders this state. Publishing here
   // would invalidate its own pending interaction before it can show recovery.
   entries=[];denied=[401,403].includes(error?.status);state=denied?'forbidden':'error';return fail('query-unavailable');
  }
 }
 function dispose(){disposed=true;++epoch;++openSerial;read=null;entries=[];state='forbidden';key=null;allowed=false;publish();}
 sync(false);return Object.freeze({snapshot,refresh,canRefresh,canOpen,open,invalidate,updateAccess:()=>sync(),dispose});
}
