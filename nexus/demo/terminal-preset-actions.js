import {applyTerminalTaskPreset,restoreTerminalTaskPresentation} from './terminal-task-presets.js';

export function terminalWriteConfirmed(receipt,{key,revision,value,ownerScope}){
 return !!receipt&&receipt.key===key&&receipt.revision===revision+1&&receipt.ownerScope===ownerScope
  &&JSON.stringify(receipt.value)===JSON.stringify(value);
}
export function terminalWriteRecoveryState(receipt, input) {
 if (!/^[a-f0-9]{64}$/.test(input.ownerScope || '') || !receipt || receipt.key !== input.key
   || receipt.ownerScope !== input.ownerScope || !Number.isSafeInteger(receipt.revision) || receipt.revision < 0) return 'conflict';
 if (receipt.revision === input.revision) return 'retry';
 return terminalWriteConfirmed(receipt, input) ? 'confirmed' : 'conflict';
}
/** Save once before changing the screen. Ambiguous writes require a fresh read;
 * neither the old presentation nor a transport retry may overwrite that result. */
export function createTerminalPresetActions({getLayout,getRevision,getOwnerScope,getContext,isPreview,blocked,
 flush,prepareDocking,request,commit,setRevision,setBusy=()=>{},report=()=>{},blockPersistence=()=>{}}){
 let busy=false;
 async function run(id){
  if(busy)return false;
  const reason=blocked();if(reason){report(reason,true);return false;}
  const context=getContext();busy=true;setBusy(true);report('Применяем расположение…');
  const current=()=>context===getContext();let posted=false;
  try{
   if(!await flush()){if(current())report('Сначала сохраните изменения графиков. Пресет не применён.',true);return false;}
   if(!current())return false;
   const unavailable=blocked();if(unavailable){report(unavailable,true);return false;}
   const original=JSON.stringify(getLayout()),value=id==='restore'?restoreTerminalTaskPresentation(getLayout()):applyTerminalTaskPreset(getLayout(),id);
   const prepared=prepareDocking({persist:!isPreview()});if(!prepared.ok){report(prepared.reason,true);return false;}
   if(!current()||JSON.stringify(getLayout())!==original)return false;
   if(isPreview()){commit(value);report('Расположение действует только в этом предпросмотре');return true;}
   const ownerScope=getOwnerScope(),revision=getRevision();
   if(!/^[a-f0-9]{64}$/.test(ownerScope||'')){report('Владелец настроек не подтверждён. Перезагрузите кабинет.',true);return false;}
   const input={key:'layout',revision,value,expectedOwnerScope:ownerScope};posted=true;
   const receipt=await request('/api/market/terminal',{method:'POST',body:JSON.stringify(input)});
   if(!current()||JSON.stringify(getLayout())!==original){blockPersistence();if(current())report('Контекст изменился во время сохранения. Перезагрузите кабинет, чтобы проверить расположение.',true);return false;}
   if(!terminalWriteConfirmed(receipt,{...input,ownerScope}))throw Error('Unconfirmed terminal write');
   setRevision(receipt.revision);commit(value);report(id==='restore'?'Ваше расположение восстановлено и сохранено':'Пресет сохранён на этом устройстве');return true;
  }catch(error){
   if(!current())return false;
   // An explicit native 4xx is a rejected transaction; a dropped/malformed reply
   // is not proof that no write happened. Both need a reload on conflict/access.
   const rejected=Number.isInteger(error?.status)&&error.status>=400&&error.status<500;
   if(posted&&(!rejected||[401,403,409].includes(error.status)))blockPersistence();
   report(posted&&!rejected?'Ответ о сохранении не получен. Перезагрузите кабинет, чтобы проверить расположение.':rejected?(error.message||'Настройки не сохранены. Перезагрузите кабинет.'):'Пресет не применён: не удалось проверить настройки.',true);
   return false;
  }finally{busy=false;setBusy(false);}
 }
 return {run,isBusy:()=>busy};
}
