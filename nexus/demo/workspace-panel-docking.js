import {dockLeaves,pruneDockTree,moveDockBlock} from './terminal-docking-model.js';
import {validatePanelDockTree} from './workspace-panels-model.js';
const percentTree=(tree,toStorage)=>typeof tree==='string'?tree:tree?{...tree,ratio:toStorage?Math.round(tree.ratio*100):tree.ratio/100,a:percentTree(tree.a,toStorage),b:percentTree(tree.b,toStorage)}:null;

// Move controller-owned elements inside their original surface. No cloning of
// financial forms, changing sections, or reissuing their requests is involved.
export function createWorkspacePanelDocking({doc,getItems,getLayout,save,writable,unlocked}) {
 const homes=new Map(),groups=new Map();let resizing=null;
 const peers=item=>getItems().filter(other=>other.home===item.home&&other.group!=='metrics'&&item.group!=='metrics');
 const rootFor=item=>peers(item)[0]?.id;
 function remember(item){if(homes.get(item.id)?.node===item.node)return;const marker=doc.createComment('panel home '+item.id);item.node.before(marker);homes.set(item.id,{marker,node:item.node});}
 function restore(item){const home=homes.get(item.id);if(home?.marker.isConnected&&item.node.previousSibling!==home.marker)home.marker.after(item.node);}
 function treeFor(item){const list=peers(item),saved=percentTree(getLayout()[rootFor(item)]?.dockTree,false);if(saved){let tree=saved;for(const next of list)if(!dockLeaves(tree).includes(next.id))tree={axis:'y',ratio:.7,a:tree,b:next.id};return tree;}return list.sort((a,b)=>(getLayout()[a.id]?.order??a.order)-(getLayout()[b.id]?.order??b.order)).reduce((tree,next)=>tree?{axis:'y',ratio:.5,a:tree,b:next.id}:next.id,null);}
 function move(id,targetId,edge){
  const item=getItems().find(i=>i.id===id),target=peers(item||{}).find(i=>i.id===targetId);
  if(!item||!target||!writable()||item===target)return false;
  const root=rootFor(item),layout=getLayout(),tree=moveDockBlock(treeFor(item),id,targetId,edge);
  return save({...layout,[root]:{...layout[root],dockTree:validatePanelDockTree(percentTree(tree,true))}});
 }
 function commitRatio(root,path,ratio){const layout=getLayout(),tree=structuredClone(layout[root]?.dockTree);if(!tree)return;let node=tree;for(const key of path)node=node?.[key];if(!node||typeof node==='string')return;node.ratio=Math.round(ratio*100);save({...layout,[root]:{...layout[root],dockTree:tree}});}
 function sync(){
  if(resizing)return;
  const items=getItems().filter(i=>i.group!=='metrics');items.forEach(remember);
  for(const home of new Set(items.map(i=>i.home))){const list=items.filter(i=>i.home===home),root=list[0].id,saved=percentTree(getLayout()[root]?.dockTree,false),old=groups.get(home);
   if(!saved){if(old){list.filter(i=>!i.node.hasAttribute('data-panel-borrowed')).forEach(restore);old.host.remove();groups.delete(home);}continue;}
   const visible=list.filter(i=>!getLayout()[i.id]?.hidden&&!i.node.hidden&&!i.node.hasAttribute('data-panel-borrowed')),allowed=new Set(visible.map(i=>i.id));
   let tree=pruneDockTree(saved,k=>allowed.has(k));for(const item of visible)if(!dockLeaves(tree).includes(item.id))tree=tree?{axis:'y',ratio:.7,a:tree,b:item.id}:item.id;
   const signature=JSON.stringify(tree);if(old?.signature===signature&&list.every(i=>old.nodes.includes(i.node))&&visible.every(i=>old.host.contains(i.node)))continue;
   list.filter(i=>!allowed.has(i.id)&&!i.node.hasAttribute('data-panel-borrowed')).forEach(restore);
   if(!tree){old?.host.remove();groups.delete(home);continue;}
   const host=doc.createElement('div');host.className='workspace-panel-dock';host.dataset.panelDockRoot=root;
   const draw=(node,path=[])=>{
    if(typeof node==='string')return visible.find(i=>i.id===node).node;
    const split=doc.createElement('div');split.className='workspace-panel-dock-split';split.dataset.axis=node.axis;
    const divider=doc.createElement('div');divider.className='workspace-panel-divider';divider.tabIndex=0;divider.setAttribute('role','separator');divider.setAttribute('aria-label','Размер соседних блоков');divider.setAttribute('aria-orientation',node.axis==='x'?'vertical':'horizontal');divider.setAttribute('aria-valuemin','15');divider.setAttribute('aria-valuemax','85');
    const update=ratio=>{node.ratio=Math.max(.15,Math.min(.85,ratio));split.style.setProperty('--workspace-dock-a',node.ratio*100+'fr');split.style.setProperty('--workspace-dock-b',(1-node.ratio)*100+'fr');divider.setAttribute('aria-valuenow',Math.round(node.ratio*100));};update(node.ratio);
    // The projected split can omit hidden nodes. Locate the same leaf partition
    // in the saved tree before persisting a divider change.
    const savedPath=(()=>{const left=dockLeaves(node.a),right=dockLeaves(node.b);function find(n,p=[]){if(!n||typeof n==='string')return null;if(left.every(k=>dockLeaves(n.a).includes(k))&&right.every(k=>dockLeaves(n.b).includes(k)))return p;return find(n.a,[...p,'a'])??find(n.b,[...p,'b']);}return find(saved)||path;})();
    divider.dataset.panelDividerPath=savedPath.join('.');
    divider.addEventListener('pointerdown',e=>{if(!writable()||!unlocked()||e.button!==0)return;e.preventDefault();resizing={pointer:e.pointerId,divider,split,axis:node.axis,update,root,path:savedPath,ratio:node.ratio,before:node.ratio};divider.setPointerCapture(e.pointerId);});
    divider.addEventListener('keydown',e=>{if(!writable()||!unlocked()||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();update(node.ratio+(['ArrowLeft','ArrowUp'].includes(e.key)?-.04:.04));commitRatio(root,savedPath,node.ratio);});
    split.append(draw(node.a,[...path,'a']),divider,draw(node.b,[...path,'b']));return split;
   };
   const focused=doc.activeElement,focusedDivider=old?.host.contains(focused)?focused?.dataset.panelDividerPath:undefined;host.append(draw(tree));const anchor=homes.get(root)?.marker;if(anchor?.isConnected)anchor.after(host);else home.append(host);old?.host.remove();groups.set(home,{host,signature,nodes:list.map(i=>i.node)});if(focusedDivider!==undefined)host.querySelector('[data-panel-divider-path="'+focusedDivider+'"]')?.focus({preventScroll:true});else if(focused?.isConnected&&doc.activeElement!==focused)focused.focus({preventScroll:true});
  }
 }
 function end(cancel=false){if(!resizing)return;const r=resizing;resizing=null;if(r.divider.hasPointerCapture(r.pointer))r.divider.releasePointerCapture(r.pointer);if(cancel)r.update(r.before);else commitRatio(r.root,r.path,r.ratio);sync();}
 const pointermove=e=>{const r=resizing;if(!r||e.pointerId!==r.pointer)return;if(!e.buttons){end(true);return;}const box=r.split.getBoundingClientRect();r.ratio=Math.max(.15,Math.min(.85,r.axis==='x'?(e.clientX-box.x)/box.width:(e.clientY-box.y)/box.height));r.update(r.ratio);};
 const up=()=>end(),cancel=()=>end(true),key=e=>{if(e.key==='Escape')end(true);};
 doc.addEventListener('pointermove',pointermove);doc.addEventListener('pointerup',up);doc.addEventListener('pointercancel',cancel);doc.addEventListener('keydown',key);
 return {sync,move,peers,hasLayout:item=>!!getLayout()[rootFor(item)]?.dockTree,cancel,
  resetItem(id,next){const item=getItems().find(i=>i.id===id),root=item&&rootFor(item);if(root&&next[root]){next[root]={...next[root]};delete next[root].dockTree;}return next;},
  dispose(){cancel();for(const [name,fn]of [['pointermove',pointermove],['pointerup',up],['pointercancel',cancel],['keydown',key]])doc.removeEventListener(name,fn);getItems().forEach(restore);for(const g of groups.values())g.host.remove();groups.clear();}
 };
}
