const tabs=new Set(['price','risk','performance','financials','seasonality','technical','profile']);
const sameRef=(a,b)=>a?.namespace===b?.namespace&&a?.instrumentUid===b?.instrumentUid;
const clone=value=>structuredClone(value);

/** Saved Research lifecycle only. Does not own storage, account selection or pins. */
export function createResearchLifecycle({context,getAnalysisTab,setAnalysisTab,getMode,setMode,readCatalog,publishCatalog,canResearch,onNavigate=()=>{},loadTarget=()=>{},onCommitStart=()=>{},onCommitEnd=()=>{}}){
 let interactionRevision=0,sourceRevision=0,lastContextRevision=context.resolve(null).revision,disposed=false,committing=false;
 const captures=new WeakSet();
 function onContext(event){
  // Context subscribers can synchronously publish a newer event before this
  // listener runs. Missing event kinds are conservatively interactions, never
  // permission to rebase an awaited catalogue publication.
  const gap=Math.max(0,event.revision-lastContextRevision-1);interactionRevision+=gap;
  lastContextRevision=Math.max(lastContextRevision,event.revision);
  if(event.reason==='sources-replaced')sourceRevision++;
  else interactionRevision++;
 }
 const unsubscribe=context.subscribe(onContext);
 function capture(){
  const snapshot=context.get('research'),token=context.capture('research');
  const value=Object.freeze({scopeKey:snapshot.scopeKey,instrumentRef:snapshot.ref?Object.freeze(clone(snapshot.ref)):null,analysisTab:getAnalysisTab(),mode:getMode(),interactionRevision,sourceRevision,contextToken:token});
  captures.add(value);return value;
 }
 function isCurrent(value){
  if(disposed||!value||!captures.has(value)||value.interactionRevision!==interactionRevision||value.sourceRevision!==sourceRevision||value.analysisTab!==getAnalysisTab()||value.mode!==getMode())return false;
  const snapshot=context.get('research');
  return snapshot.scopeKey===value.scopeKey&&sameRef(snapshot.ref,value.instrumentRef)&&context.isCurrent(value.contextToken,'research');
 }
 function permitted(resolved){try{return !disposed&&resolved?.scopeKey===context.get('research').scopeKey&&resolved.resolution==='exact'&&Boolean(resolved.meta)&&canResearch(resolved)===true;}catch{return false;}}
 async function prepare(lease){
  if(disposed||typeof readCatalog!=='function'||typeof publishCatalog!=='function'||!lease?.isCurrent?.())return false;
  const before=capture();let response;
  try{response=await readCatalog();}catch{return false;}
  if(!isCurrent(before)||!lease.isCurrent()||!Array.isArray(response?.items))return false;
  // The read callback must be side-effect free. Publication happens once and
  // synchronously inside the controller's bounded source-publication lease.
  let publicationResult;
  return lease.publishSources(()=>{publicationResult=publishCatalog(response.items);return publicationResult;})===true
    && !(publicationResult&&typeof publicationResult.then==='function');
 }
 function atExpected(ref,scope,tab,mode,interaction,source){
  const value=capture();return value.scopeKey===scope&&sameRef(value.instrumentRef,ref)&&value.analysisTab===tab&&value.mode===mode&&value.interactionRevision===interaction&&value.sourceRevision===source&&isCurrent(value)&&permitted(context.resolve(ref));
 }
 function commit(intent,guard){
  if(disposed||committing||!tabs.has(intent?.analysisTab)||intent?.target!=='research.instrument'||typeof guard?.isCurrent!=='function')return false;
  const navigationCurrent=()=>{try{return guard.isNavigationCurrent===undefined||typeof guard.isNavigationCurrent==='function'&&guard.isNavigationCurrent()===true;}catch{return false;}};
  const before=capture(),resolved=context.resolve(intent.instrumentRef);
  if(intent.scopeKey!==before.scopeKey||!sameRef(resolved.ref,intent.instrumentRef)||!permitted(resolved)||!guard.isCurrent()||!navigationCurrent())return false;
  let target=null,complete=false;committing=true;
  try{
   onCommitStart();
   // onCommitStart is synchronous but may be an observer; recheck immediately
   // before the first selection side effect.
   if(!isCurrent(before)||!guard.isCurrent()||!navigationCurrent())return false;
   context.select(intent.instrumentRef,{surface:'research',force:true});
   let expectedInteraction=before.interactionRevision+1;
   if(!atExpected(intent.instrumentRef,before.scopeKey,before.analysisTab,before.mode,expectedInteraction,before.sourceRevision)||!navigationCurrent())return false;
   // The fresh target token is captured after selection. No old authorization
   // token is reused for rendering/loading the newly selected instrument.
   target=capture();
   if(setAnalysisTab(intent.analysisTab)!==true)return false;
   if(intent.analysisTab!==before.analysisTab)expectedInteraction++;
   if(!atExpected(intent.instrumentRef,before.scopeKey,intent.analysisTab,before.mode,expectedInteraction,before.sourceRevision)||!navigationCurrent())return false;
   if(setMode('instrument')!==true)return false;
   if(before.mode!=='instrument')expectedInteraction++;
   if(!atExpected(intent.instrumentRef,before.scopeKey,intent.analysisTab,'instrument',expectedInteraction,before.sourceRevision)||!navigationCurrent())return false;
   target=capture();
   const navigation=onNavigate({instrumentRef:clone(intent.instrumentRef),analysisTab:intent.analysisTab,isCurrent:()=>isCurrent(target)&&navigationCurrent()});
   if(navigation&&typeof navigation.then==='function'||!isCurrent(target)||!navigationCurrent())return false;
   complete=true;
  }catch{return false;}
  finally{try{onCommitEnd();}finally{committing=false;}}
  if(!complete||!isCurrent(target)||!navigationCurrent()||!permitted(context.resolve(intent.instrumentRef)))return false;
  // Loading is a separate guarded operation; it cannot reopen the old context.
  try{loadTarget(target);}catch{return false;}
  return isCurrent(target)&&navigationCurrent();
 }
 return Object.freeze({capture,isCurrent,resolve:value=>context.resolve(value),canResearch:permitted,prepare,commit,
  analysisTabChanged(){interactionRevision++;},modeChanged(){interactionRevision++;},
  isCommitting:()=>committing,
  dispose(){if(disposed)return;disposed=true;interactionRevision++;unsubscribe();}});
}
