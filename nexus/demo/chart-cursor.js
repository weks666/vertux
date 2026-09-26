export function createChartCursor(host){
 const controller=new AbortController(),signal=controller.signal;let mode='crosshair',held=false;const dot=document.createElement('span');dot.className='chart-presentation-pointer';dot.hidden=true;host.append(dot);
 function set(value){mode=['crosshair','arrow','dot','presentation'].includes(value)?value:'crosshair';host.dataset.cursor=mode;dot.hidden=true;held=false;}
 host.addEventListener('pointermove',e=>{if(!['dot','presentation'].includes(mode)||e.target.closest('.drawing-toolbar')){dot.hidden=true;return;}const r=host.getBoundingClientRect();dot.hidden=false;dot.style.left=e.clientX-r.left+'px';dot.style.top=e.clientY-r.top+'px';dot.classList.toggle('pressed',held);},{signal});
 host.addEventListener('pointerleave',()=>{dot.hidden=true;},{signal});
 host.addEventListener('pointerdown',e=>{if(mode!=='presentation'||e.target.closest('.drawing-toolbar'))return;held=true;dot.classList.add('pressed');e.preventDefault();e.stopImmediatePropagation();},{capture:true,signal});
 host.addEventListener('pointerup',()=>{held=false;dot.classList.remove('pressed');},{signal});
 return {set,get:()=>mode,destroy(){controller.abort();dot.remove();}};
}
