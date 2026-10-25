import {createProductSearch} from './search-product.js';

const search=createProductSearch();
let catalog=[];
self.onmessage=({data:{id,query,data}})=>{
 try{
  if(Object.hasOwn(data,'catalog'))catalog=data.catalog;
  self.postMessage({id,rows:search(query,{...data,catalog})});
 }catch{self.postMessage({id,error:true});}
};
