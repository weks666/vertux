const clone=value=>structuredClone(value);
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const ok=value=>value===true||value?.ok===true;

export function createLayoutDraftSession(){
 const adapters=new Map(),listeners=new Set();let draft=null,busy=false;
 const emit=()=>{for(const listener of listeners)listener();};
 const dirty=()=>!!draft&&[...draft.values()].some(row=>!equal(row.value,row.ticket.value));
 function register(name,adapter){adapters.set(name,adapter);if(draft){const ticket=adapter.snapshot();if(ticket)draft.set(name,{ticket,value:clone(ticket.value)});}return()=>adapters.delete(name);}
 function begin(){if(draft)return true;draft=new Map();for(const [name,adapter]of adapters){const ticket=adapter.snapshot();if(ticket)draft.set(name,{ticket,value:clone(ticket.value)});}if(!draft.size){draft=null;return false;}emit();return true;}
 function read(name,fallback){return clone(draft?.get(name)?.value??fallback());}
 function stage(name,value){const row=draft?.get(name);if(!row||busy)return false;row.value=clone(value);adapters.get(name)?.apply?.(clone(value));emit();return true;}
 function discard(){draft=null;for(const adapter of adapters.values())adapter.apply?.(adapter.get());emit();}
 function commit(){
  if(!draft)return {ok:true};busy=true;
  try{
   const changes=[...draft].filter(([,row])=>!equal(row.value,row.ticket.value));
   if(changes.some(([name,row])=>!adapters.get(name)?.isCurrent(row.ticket)))return {ok:false,message:'Настройки изменились в другом окне. Отмените черновик и обновите страницу.'};
   const written=[];
   for(const [name,row]of changes){const adapter=adapters.get(name);if(!ok(adapter.restore(row.ticket,row.value))){
     let reverted=true;for(const [previous,old]of written.reverse())reverted=ok(adapters.get(previous).write(old.ticket.value))&&reverted;
     for(const [key,entry]of draft){const ticket=adapters.get(key)?.snapshot();if(ticket)entry.ticket=ticket;}
     return {ok:false,message:reverted?'Не удалось сохранить настройки. Черновик открыт; прежние сохранённые значения восстановлены.':'Сохранение не подтверждено. Проверьте доступ к хранилищу и перезагрузите страницу.'};
    }written.push([name,row]);}
   draft=null;for(const adapter of adapters.values())adapter.apply?.(adapter.get());emit();return {ok:true};
  }finally{busy=false;}
 }
 return {register,begin,read,stage,commit,discard,dirty,active:()=>draft!==null,busy:()=>busy,
  subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);}};
}
export const layoutDraft=createLayoutDraftSession();
