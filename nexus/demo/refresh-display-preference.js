const path='/api/market/display-preferences';
const valid=value=>value&&Object.keys(value).length===1&&(value.showRefreshStatus===null||typeof value.showRefreshStatus==='boolean');

// The rest of the workspace appearance remains browser-scoped. Only the
// requested refresh-status preference is persisted in the owner's Local Node.
export function createRefreshDisplayPreference({store,request,onState=()=>{}}){
 let scope=null,epoch=0,accessToken=null,confirmed=null,desired=true,loaded=false,busy=false,suppress=false,changedDuringLoad=false,disposed=false,message='';
 const current=token=>!disposed&&scope!==null&&token===epoch&&store.getAccessToken()===accessToken&&store.status().ready;
 const selected=()=>store.get().presentation.refreshStatus!==false;
 const notify=()=>onState({active:scope!==null,pending:busy,message});
 function apply(value){
  suppress=true;
  try{return store.write({...store.get(),presentation:{...store.get().presentation,refreshStatus:value}});}
  finally{suppress=false;}
 }
 async function flush(token){
  if(!current(token)||!loaded||busy||desired===confirmed)return;
  const writing=desired,previous=confirmed??!writing;let failed=false;busy=true;message='Сохраняем показ статуса обновления на компьютере…';notify();
  try{
   const result=await request(path,{method:'POST',body:JSON.stringify({showRefreshStatus:writing})});
   if(!current(token))return;
   if(!valid(result)||result.showRefreshStatus!==writing)throw Error('DISPLAY_PREFERENCE_UNCONFIRMED');
   confirmed=writing;message='Показ статуса обновления сохранён на компьютере.';
  }catch{
   if(!current(token))return;
   failed=true;desired=previous;apply(previous);message='Не удалось сохранить показ статуса. Вернули прежнее значение; повторите попытку.';
  }finally{
   if(current(token)){busy=false;notify();if(!failed&&desired!==confirmed)void flush(token);}
  }
 }
 const unsubscribe=store.subscribe(reason=>{
  if(disposed||suppress||scope===null||reason!=='saved'||store.getAccessToken()!==accessToken)return;
  const next=selected();if(next===desired)return;desired=next;
  if(!loaded)changedDuringLoad=true;
  else queueMicrotask(()=>{void flush(epoch);});
 });
 async function bind({key,allowed=false}={}){
  const next=allowed&&typeof key==='string'&&key?key:null;
  if(next===scope&&accessToken===store.getAccessToken())return;
  const token=++epoch;scope=next;accessToken=store.getAccessToken();confirmed=null;desired=selected();loaded=false;changedDuringLoad=false;busy=Boolean(scope);message='';notify();
  if(!scope)return;
  try{
   const result=await request(path);
   if(!current(token))return;
   if(!valid(result))throw Error('DISPLAY_PREFERENCE_INVALID');
   confirmed=result.showRefreshStatus??true;
   if(!changedDuringLoad&&result.showRefreshStatus!==null){desired=confirmed;if(!apply(confirmed))throw Error('DISPLAY_PREFERENCE_APPLY');}
   loaded=true;busy=false;notify();
   // A previously chosen browser preference can be adopted without copying
   // any other appearance setting or another owner's storage.
   if(desired!==confirmed)void flush(token);
  }catch{
   if(!current(token))return;
   loaded=true;busy=false;confirmed=selected();desired=confirmed;message='Не удалось получить сохранённый показ статуса. Изменение можно повторить.';notify();
  }
 }
 return {bind,dispose(){disposed=true;++epoch;unsubscribe();}};
}
