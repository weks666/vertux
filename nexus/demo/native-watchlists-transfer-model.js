export const NATIVE_LIST_LIMITS=Object.freeze({lists:20,items:100,bytes:1024*1024,commandBytes:1024*1024+65536});
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const clone=value=>JSON.parse(JSON.stringify(value));
const bytes=value=>new TextEncoder().encode(JSON.stringify(value)).length;
const iso=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const uid=value=>typeof value==='string'&&/^[A-Za-z0-9._:@/-]{1,160}$/.test(value);
const id=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const title=value=>typeof value==='string'&&value.length>0&&value.length<=60&&value===value.trim()&&!/[\x00-\x1f\x7f]/.test(value);
function plain(value,limit=NATIVE_LIST_LIMITS.commandBytes){let nodes=0;const ancestors=new Set();function visit(v,depth){
 if(++nodes>16000||depth>9)throw Error('List data limit');if(v===null||typeof v==='boolean'||typeof v==='number'&&Number.isSafeInteger(v))return;
 if(typeof v==='string'&&v.length<=2000)return;if(!v||typeof v!=='object'||ancestors.has(v))throw Error('List data');
 const array=Array.isArray(v);if(array?Object.getPrototypeOf(v)!==Array.prototype:![Object.prototype,null].includes(Object.getPrototypeOf(v)))throw Error('List prototype');
 const keys=Reflect.ownKeys(v);if(keys.some(k=>typeof k!=='string')||array&&keys.length!==v.length+1)throw Error('List properties');ancestors.add(v);
 for(const key of keys){if(array&&key==='length')continue;const d=Object.getOwnPropertyDescriptor(v,key);if(!Object.hasOwn(d,'value')||!d.enumerable||['__proto__','constructor','prototype'].includes(key)||array&&!/^(0|[1-9]\d*)$/.test(key))throw Error('List property');visit(d.value,depth+1);}ancestors.delete(v);
 }visit(value,0);if(bytes(value)>limit)throw Error('List bytes');}
function lists(value,file){if(!Array.isArray(value)||value.length>NATIVE_LIST_LIMITS.lists)throw Error('List count');const seen=new Set();
 for(const [index,row]of value.entries()){
  const key=file?'key':'id';if(!exact(row,[key,'name','createdAt','updatedAt','items'])||!title(row.name)||!iso(row.createdAt)||!iso(row.updatedAt)||!(file?row.key==='list-'+(index+1):id(row.id))||seen.has(row[key])||!Array.isArray(row.items)||row.items.length>NATIVE_LIST_LIMITS.items)throw Error('List record');seen.add(row[key]);
  const refs=new Set();for(const item of row.items){if(!exact(item,['instrumentUid','addedAt'])||!uid(item.instrumentUid)||!iso(item.addedAt)||refs.has(item.instrumentUid))throw Error('List reference');refs.add(item.instrumentUid);}
 }return value;
}
export function validateNativeListRows(value){plain(value);lists(value,false);return clone(value);}
export function validateNativeListsFile(value){plain(value,NATIVE_LIST_LIMITS.bytes);if(!exact(value,['format','version','exportedAt','lists'])||value.format!=='vertux.personal-watchlists'||value.version!==1||!iso(value.exportedAt))throw Error('List file version');lists(value.lists,true);return clone(value);}
export function makeNativeListsFile(rows,exportedAt){validateNativeListRows(rows);return validateNativeListsFile({format:'vertux.personal-watchlists',version:1,exportedAt,lists:rows.map((row,index)=>({key:'list-'+(index+1),name:row.name,createdAt:row.createdAt,updatedAt:row.updatedAt,items:row.items}))});}
export function encodeNativeListsFile(value){return JSON.stringify(validateNativeListsFile(value));}
export function decodeNativeListsFile(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>NATIVE_LIST_LIMITS.bytes)throw Error('List file size');return validateNativeListsFile(JSON.parse(text));}
export function validateNativeListsSnapshot(value){plain(value);if(!exact(value,['schema','ownerScope','revision','snapshotToken','capturedAt','lists'])||value.schema!=='personal-watchlists-snapshot-v1'||!hash(value.ownerScope)||!Number.isSafeInteger(value.revision)||value.revision<0||!hash(value.snapshotToken)||!iso(value.capturedAt))throw Error('List snapshot');lists(value.lists,false);if(value.lists.length&&value.revision===0)throw Error('List revision');return clone(value);}
export function validateNativeListsCommand(value,{apply=false}={}){plain(value);if(!exact(value,['ownerScope','revision','snapshotToken','file','mapping',...(apply?['previewToken']:[])])||!hash(value.ownerScope)||!Number.isSafeInteger(value.revision)||value.revision<0||!hash(value.snapshotToken)||apply&&!hash(value.previewToken))throw Error('List command');
 const file=validateNativeListsFile(value.file);if(!Array.isArray(value.mapping)||value.mapping.length!==file.lists.length)throw Error('List mapping');const keys=new Set(),targets=new Set();
 for(const row of value.mapping){if(!exact(row,['key','targetId'])||!file.lists.some(l=>l.key===row.key)||keys.has(row.key)||row.targetId!==null&&(!id(row.targetId)||targets.has(row.targetId)))throw Error('List target');keys.add(row.key);if(row.targetId!==null)targets.add(row.targetId);}
 return clone(value);
}
// Each file list has an explicit, distinct destination. Existing elements and
// list names remain authoritative; imported timestamps stay in the file only.
export function previewNativeListsTransfer(snapshot,command,catalogUids){
 validateNativeListsSnapshot(snapshot);validateNativeListsCommand(command);if(command.ownerScope!==snapshot.ownerScope||command.revision!==snapshot.revision||command.snapshotToken!==snapshot.snapshotToken)throw Error('List context changed');
 if(!Array.isArray(catalogUids)||catalogUids.some(v=>!uid(v)))throw Error('List catalogue');const known=new Set(catalogUids),targets=new Map(snapshot.lists.map(row=>[row.id,row]));
 const changes=command.file.lists.map(source=>{
  const mapping=command.mapping.find(row=>row.key===source.key),target=mapping.targetId===null?null:targets.get(mapping.targetId);if(mapping.targetId!==null&&!target)throw Error('List target missing');
  const existing=new Set(target?.items.map(item=>item.instrumentUid)||[]),added=source.items.filter(item=>!existing.has(item.instrumentUid)).map(item=>item.instrumentUid),unavailable=added.filter(ref=>!known.has(ref));
  return {key:source.key,targetId:mapping.targetId,name:target?.name||source.name,beforeCount:existing.size,added,matchedCount:source.items.length-added.length,unavailable,afterCount:existing.size+added.length};
 });
 const createdLists=changes.filter(row=>row.targetId===null).length,addedItems=changes.reduce((sum,row)=>sum+row.added.length,0),matchedItems=changes.reduce((sum,row)=>sum+row.matchedCount,0),listCount=snapshot.lists.length+createdLists;
 return {schema:'personal-watchlists-plan-v1',canApply:listCount<=NATIVE_LIST_LIMITS.lists&&changes.every(row=>!row.unavailable.length&&row.afterCount<=NATIVE_LIST_LIMITS.items),createdLists,addedItems,matchedItems,listCount,changes};
}
export function validateNativeListsPreview(value,snapshot,command){
 plain(value);validateNativeListsSnapshot(snapshot);validateNativeListsCommand(command);
 if(!exact(value,['schema','ownerScope','revision','snapshotToken','previewToken','plan'])||value.schema!=='personal-watchlists-preview-v1'||!hash(value.previewToken)||value.ownerScope!==snapshot.ownerScope||value.revision!==snapshot.revision||value.snapshotToken!==snapshot.snapshotToken)throw Error('List preview context');
 const p=value.plan;if(!exact(p,['schema','canApply','createdLists','addedItems','matchedItems','listCount','changes'])||!Array.isArray(p.changes)||p.changes.length!==command.file.lists.length)throw Error('List preview');
 const missing=new Set();for(const row of p.changes){if(!exact(row,['key','targetId','name','beforeCount','added','matchedCount','unavailable','afterCount'])||!Array.isArray(row.unavailable)||new Set(row.unavailable).size!==row.unavailable.length||row.unavailable.some(ref=>!uid(ref)||!Array.isArray(row.added)||!row.added.includes(ref)))throw Error('List preview references');for(const ref of row.unavailable)missing.add(ref);}
 const known=command.file.lists.flatMap(row=>row.items.map(item=>item.instrumentUid)).filter(ref=>!missing.has(ref));
 const expected=previewNativeListsTransfer(snapshot,command,known);
 // Normalize object key order without accepting extra fields or inconsistent counts.
 for(const key of Object.keys(expected)){if(key==='changes')continue;if(p[key]!==expected[key])throw Error('List preview totals');}
 for(const [index,row]of expected.changes.entries())for(const key of Object.keys(row))if(JSON.stringify(p.changes[index][key])!==JSON.stringify(row[key]))throw Error('List preview change');
 return clone(value);
}
export function validateNativeListsApplied(value,snapshot,command,preview){
 plain(value);validateNativeListsPreview(preview,snapshot,command);validateNativeListsSnapshot(value?.snapshot);
 if(!exact(value,['schema','action','createdLists','addedItems','matchedItems','created','snapshot'])||value.schema!=='personal-watchlists-applied-v1'||!preview.plan.canApply||!Array.isArray(value.created)||value.created.length!==preview.plan.createdLists)throw Error('List apply response');
 const changed=preview.plan.createdLists>0||preview.plan.addedItems>0,next=value.snapshot;
 if(value.action!==(changed?'imported':'unchanged')||next.ownerScope!==snapshot.ownerScope||next.lists.length!==preview.plan.listCount||(changed?next.revision<=snapshot.revision:next.revision!==snapshot.revision||next.snapshotToken!==snapshot.snapshotToken))throw Error('List apply context');
 for(const key of ['createdLists','addedItems','matchedItems'])if(value[key]!==preview.plan[key])throw Error('List apply counts');
 const created=new Map(),ids=new Set(snapshot.lists.map(row=>row.id));for(const row of value.created){if(!exact(row,['key','id'])||!id(row.id)||ids.has(row.id)||created.has(row.key)||!preview.plan.changes.some(c=>c.key===row.key&&c.targetId===null))throw Error('List created target');ids.add(row.id);created.set(row.key,row.id);}
 if(next.lists.some(row=>!ids.has(row.id)))throw Error('List unexpected target');
 for(const old of snapshot.lists){const current=next.lists.find(row=>row.id===old.id),change=preview.plan.changes.find(row=>row.targetId===old.id);if(!current||current.name!==old.name||current.createdAt!==old.createdAt||current.items.length!==old.items.length+(change?.added.length||0)||(!change?.added.length&&current.updatedAt!==old.updatedAt))throw Error('List existing target changed');for(const item of old.items)if(!current.items.some(row=>row.instrumentUid===item.instrumentUid&&row.addedAt===item.addedAt))throw Error('List existing item changed');}
 for(const change of preview.plan.changes){const row=next.lists.find(row=>row.id===(change.targetId||created.get(change.key)));if(!row||row.name!==change.name||row.items.length!==change.afterCount||change.added.some(ref=>!row.items.some(item=>item.instrumentUid===ref)))throw Error('List merge not confirmed');}
 return clone(value);
}
