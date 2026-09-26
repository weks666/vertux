const directions=['left','right','top','bottom'];
export function dockLeaves(node){return typeof node==='string'?[node]:node?[...dockLeaves(node.a),...dockLeaves(node.b)]:[];}
export function normalizeDockTree(value,depth=0,seen=new Set()){
 if(depth>16)return null;
 if(typeof value==='string'){if(!/^(chart:\d{1,2}|watch|panel:(?:book|tape|plan|alerts)|context)$/.test(value)||seen.has(value))return null;seen.add(value);return value;}
 if(!value||!['x','y'].includes(value.axis))return null;
 const a=normalizeDockTree(value.a,depth+1,seen),b=normalizeDockTree(value.b,depth+1,seen);if(!a||!b)return a||b;
 return {axis:value.axis,ratio:Math.max(.15,Math.min(.85,Number(value.ratio)||.5)),a,b};
}
export function pruneDockTree(tree,keep){if(typeof tree==='string')return keep(tree)?tree:null;if(!tree)return null;const a=pruneDockTree(tree.a,keep),b=pruneDockTree(tree.b,keep);return a&&b?{...tree,a,b}:a||b;}
export function moveDockBlock(tree,source,target,edge){
 if(source===target||!directions.includes(edge)||!dockLeaves(tree).includes(target))return tree;
 const rest=pruneDockTree(tree,key=>key!==source),before=['left','top'].includes(edge);
 const insert=node=>node===target?{axis:['left','right'].includes(edge)?'x':'y',ratio:before?.35:.65,a:before?source:target,b:before?target:source}:typeof node==='string'?node:{...node,a:insert(node.a),b:insert(node.b)};
 return insert(rest);
}
const grip='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5h1M15 5h1M8 12h1M15 12h1M8 19h1M15 19h1"/></svg>';
/** Dock the actual live nodes; charts, forms and focus keep their identity. */
export function createTerminalDocking({panel,main,stage,toolbar,getItems,isExpanded,showToast=()=>{},onPinsChange=()=>{}}){
 const grid=main.querySelector('.terminal-grid'),homes=new Map();let tree=null,custom=false,drag=null,resize=null,queued=false,scope='device',pins=new Set();
 const key=()=>`invest:terminal-docking:${scope}`;
 function load(){try{const saved=JSON.parse(localStorage.getItem(key())||'null');tree=normalizeDockTree(saved?.tree);custom=!!tree;pins=new Set((saved?.pins||[]).filter(k=>/^(watch|panel:(book|tape|plan|alerts))$/.test(k)));}catch{tree=null;custom=false;pins=new Set();}}
 function save(){try{localStorage.setItem(key(),JSON.stringify({version:1,tree,pins:[...pins]}));}catch{showToast('Раскладка применена, но браузер не разрешил её сохранить.');}}
 const live=document.createElement('p');live.className='terminal-dock-announcement';live.setAttribute('role','status');panel.append(live);
 const menu=document.createElement('div');menu.className='terminal-dock-menu';menu.hidden=true;menu.setAttribute('role','dialog');menu.setAttribute('aria-label','Переместить блок');panel.append(menu);
 let menuItem=null;
 function closeMenu(){menu.hidden=true;menuItem=null;}
 function items(){return getItems().filter(item=>item.node.isConnected);}
 function visibleItems(){return items().filter(item=>item.visible);}
 function remember(item){item.node.dataset.dockBlock=item.key;item.header.dataset.dockHandle=item.key;if(homes.has(item.node)){const grip=item.header.querySelector('.terminal-dock-grip');if(grip){grip.setAttribute('aria-label','Переместить блок: '+item.label);grip.hidden=!item.visible;}return;}const marker=document.createComment('dock home '+item.key);item.node.before(marker);homes.set(item.node,{marker,parent:item.node.parentElement});item.node.dataset.dockBlock=item.key;
  item.header.dataset.dockHandle=item.key;const b=document.createElement('button');b.type='button';b.className='terminal-dock-grip';b.setAttribute('aria-label','Переместить блок: '+item.label);b.hidden=!item.visible;b.title='Перетащить блок · нажать для выбора места';b.innerHTML=grip;item.header.prepend(b);
 }
 function restore(item){const home=homes.get(item.node);if(!home)return;if(home.marker.isConnected)home.marker.after(item.node);else home.parent.append(item.node);item.node.style.removeProperty('flex');}
 function defaultTree(list){let result=null;for(const item of list){if(!result){result=item.key;continue;}result={axis:item.key==='context'?'y':'x',ratio:item.key.startsWith('chart:')?.5:item.key==='context'?.7:.72,a:result,b:item.key};}return result;}
 function ensureTree(list){if(!tree)tree=defaultTree(list);for(const item of list)if(!dockLeaves(tree).includes(item.key))tree=tree?{axis:item.key==='context'?'y':'x',ratio:.7,a:tree,b:item.key}:item.key;}
 function render(){queued=false;const all=items();all.forEach(remember);if(drag||resize)return;
  const enabled=custom&&!isExpanded();panel.classList.toggle('terminal-custom-layout',enabled);grid.querySelectorAll('.terminal-dock-split').forEach(n=>n.dataset.stale='true');
  if(!enabled){for(const item of all)restore(item);grid.querySelectorAll('.terminal-dock-split').forEach(n=>n.remove());return;}
  const shown=all.filter(item=>item.visible);ensureTree(shown);const visible=new Set(shown.map(i=>i.key));const projected=pruneDockTree(tree,k=>visible.has(k));
  for(const item of all)if(!item.visible)restore(item);
  const draw=node=>{if(typeof node==='string')return shown.find(item=>item.key===node)?.node;const split=document.createElement('div');split.className='terminal-dock-split';split.dataset.axis=node.axis;split.style.setProperty('--dock-ratio',node.ratio*100+'%');
   const a=draw(node.a),b=draw(node.b),divider=document.createElement('div');divider.className='terminal-dock-divider';divider.tabIndex=0;divider.setAttribute('role','separator');divider.setAttribute('aria-label','Размер соседних блоков');divider.setAttribute('aria-orientation',node.axis==='x'?'vertical':'horizontal');divider.setAttribute('aria-valuemin','15');divider.setAttribute('aria-valuemax','85');divider.setAttribute('aria-valuenow',String(Math.round(node.ratio*100)));
   const update=ratio=>{node.ratio=Math.max(.15,Math.min(.85,ratio));split.style.setProperty('--dock-ratio',node.ratio*100+'%');divider.setAttribute('aria-valuenow',String(Math.round(node.ratio*100)));};
   const persist=()=>{const left=dockLeaves(node.a),right=dockLeaves(node.b);const find=n=>{if(!n||typeof n==='string')return;if(left.every(k=>dockLeaves(n.a).includes(k))&&right.every(k=>dockLeaves(n.b).includes(k))){n.ratio=node.ratio;return;}find(n.a);find(n.b);};find(tree);save();};
   divider.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();resize={pointerId:e.pointerId,split,node,update,persist};panel.setPointerCapture(e.pointerId);});
   divider.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();update(node.ratio+(['ArrowLeft','ArrowUp'].includes(e.key)?-.04:.04));persist();});split.append(a,divider,b);return split;};
  // Reparent before removing old containers, so chart instances stay connected.
  if(projected)grid.append(draw(projected));grid.querySelectorAll('[data-stale=true]').forEach(n=>n.remove());
 }
 function sync(){if(!queued){queued=true;queueMicrotask(render);}}
 function move(source,target,edge){ensureTree(visibleItems());tree=moveDockBlock(tree,source,target,edge);custom=true;for(const item of visibleItems())if(/^(watch|panel:)/.test(item.key))pins.add(item.key);save();onPinsChange();render();live.textContent='Раскладка сохранена. Блок перемещён.';}
 function openMenu(item,button){menuItem=item;menu.replaceChildren();const title=document.createElement('strong');title.textContent='Переместить: '+item.label;menu.append(title);
  for(const target of visibleItems().filter(i=>i.key!==item.key)){const row=document.createElement('div'),label=document.createElement('span');label.textContent=target.label;row.append(label);for(const [edge,label]of [['left','Слева'],['right','Справа'],['top','Сверху'],['bottom','Снизу']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',()=>{move(item.key,target.key,edge);closeMenu();visibleItems().find(i=>i.key===item.key)?.header.querySelector('.terminal-dock-grip')?.focus();});row.append(b);}menu.append(row);}
  menu.hidden=false;const r=button.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(innerWidth-menu.offsetWidth-8,r.left))+'px';menu.style.top=Math.max(8,Math.min(innerHeight-menu.offsetHeight-8,r.bottom+5))+'px';menu.querySelector('button')?.focus();
 }
 function end(cancel=false){if(!drag)return;const d=drag;drag=null;d.ghost?.remove();d.targetBox?.remove();d.item.node.classList.remove('terminal-dock-source');panel.classList.remove('terminal-dragging');if(panel.hasPointerCapture(d.pointerId))panel.releasePointerCapture(d.pointerId);if(!cancel&&d.target)move(d.item.key,d.target.key,d.edge);else if(queued)render();}
 panel.addEventListener('pointerdown',e=>{if(!menu.hidden&&!menu.contains(e.target))closeMenu();if(isExpanded()||e.button!==0||e.target.closest('input,select,textarea,a,summary')||e.target.closest('button')&&!e.target.closest('.terminal-dock-grip'))return;const handle=e.target.closest('[data-dock-handle]'),item=visibleItems().find(i=>i.key===handle?.dataset.dockHandle);if(!item)return;drag={item,pointerId:e.pointerId,x:e.clientX,y:e.clientY,active:false,grip:!!e.target.closest('.terminal-dock-grip')};panel.setPointerCapture(e.pointerId);e.preventDefault();},true);
 panel.addEventListener('pointermove',e=>{
  if(resize){if(e.pointerId!==resize.pointerId)return;const r=resize.split.getBoundingClientRect();resize.update(resize.node.axis==='x'?(e.clientX-r.x)/r.width:(e.clientY-r.y)/r.height);return;}
  if(!drag||e.pointerId!==drag.pointerId)return;
  if(!drag.active){if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<6)return;drag.active=true;const r=drag.item.node.getBoundingClientRect();drag.offset={x:drag.x-r.x,y:drag.y-r.y};const ghost=drag.item.node.cloneNode(true);ghost.classList.add('terminal-dock-ghost');ghost.removeAttribute('hidden');ghost.removeAttribute('id');ghost.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));ghost.setAttribute('aria-hidden','true');ghost.inert=true;ghost.style.width=r.width+'px';ghost.style.height=r.height+'px';const originals=drag.item.node.querySelectorAll('canvas');ghost.querySelectorAll('canvas').forEach((canvas,i)=>{try{canvas.getContext('2d').drawImage(originals[i],0,0);}catch{}});document.body.append(ghost);drag.ghost=ghost;drag.targetBox=document.createElement('div');drag.targetBox.className='terminal-dock-drop';drag.targetBox.setAttribute('aria-hidden','true');document.body.append(drag.targetBox);drag.item.node.classList.add('terminal-dock-source');panel.classList.add('terminal-dragging');}
  e.preventDefault();drag.ghost.style.transform=`translate(${e.clientX-drag.offset.x}px,${e.clientY-drag.offset.y}px)`;
  const target=visibleItems().find(i=>{if(i.key===drag.item.key)return false;const r=i.node.getBoundingClientRect();return e.clientX>=r.x&&e.clientX<=r.right&&e.clientY>=r.y&&e.clientY<=r.bottom;});drag.target=target;drag.targetBox.hidden=!target;if(!target)return;
  const r=target.node.getBoundingClientRect(),x=(e.clientX-r.x)/r.width,y=(e.clientY-r.y)/r.height;
  drag.edge=[['left',x],['right',1-x],['top',y],['bottom',1-y]].sort((a,b)=>a[1]-b[1])[0][0];
  const horizontal=['left','right'].includes(drag.edge);Object.assign(drag.targetBox.style,{left:(r.x+(drag.edge==='right'?r.width*.65:0))+'px',top:(r.y+(drag.edge==='bottom'?r.height*.65:0))+'px',width:(r.width*(horizontal?.35:1))+'px',height:(r.height*(horizontal?1:.35))+'px'});drag.targetBox.textContent=({'left':'Слева','right':'Справа','top':'Сверху','bottom':'Снизу'})[drag.edge]+' · '+drag.item.label;
 },true);
 panel.addEventListener('pointerup',e=>{if(resize){resize.persist();resize=null;if(panel.hasPointerCapture(e.pointerId))panel.releasePointerCapture(e.pointerId);return;}if(drag){const active=drag.active,item=drag.item,grip=drag.grip;end();if(!active&&grip)openMenu(item,item.header.querySelector('.terminal-dock-grip'));}},true);
 panel.addEventListener('pointercancel',()=>{end(true);resize=null;});panel.addEventListener('lostpointercapture',()=>{if(drag)end(true);resize=null;});
 panel.addEventListener('click',e=>{const grip=e.target.closest('.terminal-dock-grip');if(grip&&e.detail===0){const item=visibleItems().find(i=>i.key===grip.closest('[data-dock-handle]').dataset.dockHandle);if(item)openMenu(item,grip);}});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(drag){e.preventDefault();e.stopImmediatePropagation();end(true);}if(!menu.hidden){const item=menuItem;closeMenu();item?.header.querySelector('.terminal-dock-grip').focus();e.stopImmediatePropagation();}}},true);
 const reset=document.createElement('button');reset.type='button';reset.textContent='Сбросить расположение блоков';reset.dataset.resetDocking='';toolbar.querySelector('.terminal-layout-tools').append(reset);reset.addEventListener('click',()=>{end(true);custom=false;tree=null;pins.clear();save();onPinsChange();render();toolbar.querySelector('details').open=false;showToast('Стандартное расположение восстановлено.');});
 load();document.addEventListener('invest:identity',e=>{const v=e.detail||{};scope=String(v.userId||v.id||v.displayName||v.name||'device');load();onPinsChange();sync();});
 return {sync,pins:()=>new Set(pins),unpin(name){pins.delete(name);save();},reset:()=>reset.click()};
}
