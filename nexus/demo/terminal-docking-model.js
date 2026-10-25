const directions=['left','right','top','bottom'];
export function dockLeaves(node){return typeof node==='string'?[node]:node?[...dockLeaves(node.a),...dockLeaves(node.b)]:[];}
export function normalizeDockTree(value,depth=0,seen=new Set()){
 if(depth>16)return null;
 if(typeof value==='string'){if(!/^(chart:(?:\d{1,2}|chart-[a-zA-Z0-9_-]{1,64})|watch|ticker|panel:(?:book|tape|plan|alerts|trade)|context)$/.test(value)||seen.has(value))return null;seen.add(value);return value;}
 if(!value||!['x','y'].includes(value.axis))return null;
 const a=normalizeDockTree(value.a,depth+1,seen),b=normalizeDockTree(value.b,depth+1,seen);if(!a||!b)return a||b;
 return {axis:value.axis,ratio:Math.max(.15,Math.min(.85,Number(value.ratio)||.5)),a,b};
}
export function pruneDockTree(tree,keep){if(typeof tree==='string')return keep(tree)?tree:null;if(!tree)return null;const a=pruneDockTree(tree.a,keep),b=pruneDockTree(tree.b,keep);return a&&b?{...tree,a,b}:a||b;}
/** New chart documents join the chart area. Appending them to the whole root
 * makes the summary occupy an entire column when the previous chart is hidden.
 * Keep existing document keys and all surrounding panel positions intact. */
export function appendDockChart(tree,key){
 const leaves=dockLeaves(tree);if(leaves.includes(key))return tree;
 const anchor=leaves.find(value=>value.startsWith('chart:'));
 if(!anchor)return tree?{axis:tree==='ticker'?'y':'x',ratio:tree==='ticker'?.18:.7,a:tree,b:key}:key;
 const insert=node=>node===anchor?{axis:'x',ratio:.5,a:node,b:key}:typeof node==='string'?node:{...node,a:insert(node.a),b:insert(node.b)};
 return insert(tree);
}
/** Version1 used tab indexes. Version2 binds the actual chart document, so a
 * closed/reordered tab cannot silently move a different chart into its place. */
export function stabilizeDockTree(tree,tabs){
 if(typeof tree==='string'){if(!/^chart:\d{1,2}$/.test(tree))return tree;const id=tabs[Number(tree.slice(6))];return /^chart-[a-zA-Z0-9_-]{1,64}$/.test(id||'')?'chart:'+id:null;}
 if(!tree)return null;const a=stabilizeDockTree(tree.a,tabs),b=stabilizeDockTree(tree.b,tabs);return a&&b?{...tree,a,b}:a||b;
}
export function readDockingSettings(text){
 if(text===null)return {version:2,tree:null,pins:[]};
 if(typeof text!=='string'||new TextEncoder().encode(text).length>512*1024)throw Error('Docking size');
 const value=JSON.parse(text);
 if(!value||![1,2].includes(value.version)||Object.keys(value).length!==3||!['version','tree','pins'].every(k=>Object.hasOwn(value,k))
  ||!Array.isArray(value.pins)||value.pins.some(k=>!/^(watch|context|panel:(book|tape|plan|alerts|trade))$/.test(k))||new Set(value.pins).size!==value.pins.length)throw Error('Unknown docking settings');
 const tree=normalizeDockTree(value.tree);
 const equal=(a,b)=>a===b||!!a&&!!b&&typeof a==='object'&&typeof b==='object'&&Object.keys(b).length===4&&a.axis===b.axis&&a.ratio===b.ratio&&equal(a.a,b.a)&&equal(a.b,b.b);
 if(!equal(tree,value.tree)||dockLeaves(tree).some(k=>value.version===2?/^chart:\d+$/.test(k):/^chart:chart-/.test(k)))throw Error('Invalid docking tree');
 return {...value,tree};
}
/** Storage has no transaction: compare the last read, verify the write, and never
 * overwrite a different value when trying to roll back an unconfirmed write. */
export function preserveDockingSettings(storage,key,previous,next=previous){
 let attempted=false;
 try{
  if(storage.getItem(key)!==previous)return {ok:false,reason:'Расположение изменено в другом окне. Перезагрузите кабинет перед выбором пресета.'};
  if(next===previous)return {ok:true,text:previous};
  attempted=true;storage.setItem(key,next);if(storage.getItem(key)!==next)throw Error('Unconfirmed docking write');
  return {ok:true,text:next};
 }catch{
  let restored=!attempted;
  if(attempted)try{const current=storage.getItem(key);if(current===previous)restored=true;else if(current===next){if(previous===null)storage.removeItem(key);else storage.setItem(key,previous);restored=storage.getItem(key)===previous;}}catch{}
  return {ok:false,reason:restored?'Не удалось сохранить расположение. Прежние настройки сохранены; пресет не применён.':'Не удалось подтвердить сохранение расположения. Перезагрузите кабинет после проверки хранилища.'};
 }
}
export function moveDockBlock(tree,source,target,edge){
 if(source===target||!directions.includes(edge)||!dockLeaves(tree).includes(target))return tree;
 const rest=pruneDockTree(tree,key=>key!==source),before=['left','top'].includes(edge);
 const insert=node=>node===target?{axis:['left','right'].includes(edge)?'x':'y',ratio:before?.35:.65,a:before?source:target,b:before?target:source}:typeof node==='string'?node:{...node,a:insert(node.a),b:insert(node.b)};
 return insert(rest);
}
