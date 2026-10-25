import {createProductSearch} from './search-product.js';

// Catalog indexing and matching run outside the renderer's input thread.
// Actions independently validate the current owner and instrument context.
export function createSearchTransport({createWorker=()=>{throw new Error('Website preview uses in-page search');}}={}){
 let worker=null,previousCatalog=null,sequence=0,pending=null,disposed=false,fallback=null;
 try{
  worker=createWorker();
  worker.onmessage=({data})=>{
   if(disposed||data.id!==pending?.id)return;
   const current=pending;pending=null;current.resolve(data.error?{error:true}:data.rows);
  };
  worker.onerror=()=>{worker?.terminate();worker=null;previousCatalog=null;const current=pending;pending=null;current?.resolve({error:true});};
 }catch{worker=null;}
 return {
  search(query,data){
   pending?.resolve(null);pending=null;
   if(disposed)return Promise.resolve(null);
   const id=++sequence;
   if(!worker){fallback||=createProductSearch();return Promise.resolve().then(()=>disposed||id!==sequence?null:fallback(query,data));}
   return new Promise(resolve=>{
    pending={id,resolve};
    const payload={...data};
    if(data.catalog===previousCatalog)delete payload.catalog;else previousCatalog=data.catalog;
    try{worker.postMessage({id,query,data:payload});}
    catch{worker?.terminate();worker=null;previousCatalog=null;pending=null;resolve({error:true});}
   });
  },
  dispose(){disposed=true;sequence++;pending?.resolve(null);pending=null;worker?.terminate();worker=null;fallback=null;previousCatalog=null;}
 };
}
