export function initRailSelection(){
 const rail=document.querySelector('.rail');if(!rail)return;
 const indicator=document.createElement('span');indicator.className='rail-active-indicator';indicator.setAttribute('aria-hidden','true');let frame=0,previous=null;
 const update=()=>{
  frame=0;
  const active=[...rail.querySelectorAll('.nav-item.active,.task-nav-item.active')].find(n=>n.getClientRects().length);
  const host=active?.closest('.navigation,.task-navigation,.rail-footer');
  if(indicator.hidden!==!host)indicator.hidden=!host;
  if(!host){previous=null;return;}
  // Use the scroll container's content coordinates. Native scrolling moves and
  // clips the marker together with its selected row, without a second animation.
  const sameHost=indicator.parentNode===host;
  if(!sameHost)host.append(indicator);
  const row=active.getBoundingClientRect(),bounds=host.getBoundingClientRect();
  const transform=`translateY(${row.top-bounds.top+host.scrollTop-host.clientTop+(row.height-24)/2}px)`;
  const from=indicator.style.transform;
  indicator.getAnimations().forEach(animation=>animation.cancel());
  indicator.style.transform=transform;
  if(sameHost&&previous&&previous!==active&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&document.documentElement.dataset.visualEffects!=='off'){
   indicator.animate([{transform:from},{transform}],{duration:180,easing:'ease-out'});
  }
  previous=active;
 };
 const queue=()=>{if(!frame)frame=requestAnimationFrame(update);};
 // The marker is inside the observed rail. Its own `hidden` changes must not
 // schedule another frame indefinitely while the app is otherwise idle.
 new MutationObserver(records=>{if(records.some(record=>record.target!==indicator))queue();}).observe(rail,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','aria-current']});new ResizeObserver(queue).observe(rail);window.addEventListener('resize',queue);document.addEventListener('invest:identity',queue);queue();
}
