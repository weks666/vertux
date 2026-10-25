const sameRef=(a,b)=>a?.namespace===b?.namespace&&a?.instrumentUid===b?.instrumentUid;
const fail=code=>({ok:false,code});
const syncAccepted=value=>value===true;

/** All navigation callbacks are synchronous acceptance boundaries except restoreSaved. */
export function createSearchActions({context,currentResearch,getAccessToken,canResearch,canTerminal,openTerminal,openCatalog,navigate,restoreSaved,queryArchive}){
 const tickets=new WeakSet();let disposed=false;
 function capture(){const state=context.resolve(null),ticket=Object.freeze({scope:state.scopeKey,revision:state.revision,access:getAccessToken(),research:currentResearch.capture()});tickets.add(ticket);return ticket;}
 function isCurrent(ticket){const state=context.resolve(null);return !disposed&&tickets.has(ticket)&&ticket.scope===state.scopeKey&&ticket.revision===state.revision&&ticket.access===getAccessToken()&&currentResearch.isCurrent(ticket.research);}
 function canExecute(row,action){
  if(disposed||!row.actions?.includes(action))return false;
  if(action==='open-query')return row.kind==='query'&&queryArchive?.canOpen(row)===true;
  if(action==='reload-queries')return row.kind==='query-status'&&queryArchive?.canRefresh()===true;
  if(['research','terminal','restore'].includes(action)){
   if(action==='restore'&&typeof restoreSaved!=='function')return false;
   const resolved=context.resolve(row.instrumentRef);
   if(resolved.resolution!=='exact'||!resolved.meta||!sameRef(resolved.ref,row.instrumentRef))return false;
   return action==='terminal'?canTerminal(resolved)===true:canResearch(resolved)===true&&currentResearch.canResearch(resolved)===true;
  }
  return action==='catalog'?typeof openCatalog==='function':action==='navigate'&&typeof navigate==='function';
 }
 async function execute(row,action,ticket,{isCurrent:interactionCurrent=()=>true}={}){
  const active=()=>isCurrent(ticket)&&interactionCurrent()===true;
  if(!active())return fail('stale');
  if(!canExecute(row,action))return fail('unavailable');
  if(!active())return fail('stale');
  const guard={isCurrent:active};
  try{
   if(action==='reload-queries'){await queryArchive.refresh();return {ok:true};}
   if(action==='open-query')return await queryArchive.open(row,guard);
   if(action==='research')return syncAccepted(currentResearch.commit({target:'research.instrument',instrumentRef:structuredClone(row.instrumentRef),scopeKey:ticket.scope,analysisTab:'price'},guard))?{ok:true}:fail('not-opened');
   if(action==='restore'){
    if(typeof restoreSaved!=='function')return fail('unavailable');
    // The saved-view controller captures and guards the starting context, then
    // verifies its own source publication and intentional instrument/tab commit.
    // Keep only the external owner and user intent guard alive across that commit.
    const result=await restoreSaved(row.id,{isCurrent:()=>!disposed&&ticket.access===getAccessToken()&&interactionCurrent()===true});
    // The controller guards its own intentional context commit. Owner/access
    // changes still suppress its result; old ticket cannot survive that change.
    return !disposed&&ticket.access===getAccessToken()&&result?.ok===true?{ok:true}:fail(result?.code==='stale'?'stale':'not-opened');
   }
   const callback=action==='terminal'?openTerminal:action==='catalog'?openCatalog:navigate;
   if(typeof callback!=='function')return fail('unavailable');
   const result=callback(action==='terminal'?{instrumentRef:structuredClone(row.instrumentRef),meta:context.resolve(row.instrumentRef).meta,scopeKey:ticket.scope}:row,guard);
   if(result&&typeof result.then==='function'){Promise.resolve(result).catch(()=>{});return fail('async-bridge');}
   return syncAccepted(result)?{ok:true}:fail('not-opened');
  }catch{return fail('not-opened');}
 }
 return Object.freeze({capture,isCurrent,canExecute,execute,dispose(){disposed=true;}});
}
