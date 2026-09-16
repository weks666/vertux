/** A visual header follows page scroll; the real semantic table remains intact. */
export function followTableHeader(container) {
 const table=container?.querySelector('table'),head=table?.tHead;if(!head)return()=>{};
 const overlay=document.createElement('div');overlay.className='catalog-sticky-header';overlay.hidden=true;overlay.setAttribute('aria-hidden','true');
 const copy=document.createElement('table');copy.append(head.cloneNode(true));overlay.append(copy);document.body.append(overlay);
 let frame=0;
 const update=()=>{
  frame=0;const rect=container.getBoundingClientRect(),header=head.getBoundingClientRect(),topbar=document.querySelector('.topbar');
  const top=topbar&&getComputedStyle(topbar).position==='sticky'?topbar.getBoundingClientRect().bottom:0;
  if(!container.offsetParent||header.top>=top||rect.bottom<=top){overlay.hidden=true;return;}
  overlay.hidden=false;overlay.style.left=rect.left+'px';overlay.style.width=container.clientWidth+'px';
  overlay.style.top=Math.min(top,rect.bottom-header.height)+'px';copy.style.width=table.getBoundingClientRect().width+'px';
  copy.style.transform='translateX(-'+container.scrollLeft+'px)';
  [...copy.querySelectorAll('th')].forEach((cell,i)=>cell.style.width=head.querySelectorAll('th')[i].getBoundingClientRect().width+'px');
 };
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
 window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule,{passive:true});container.addEventListener('scroll',schedule,{passive:true});
 const observer=new ResizeObserver(schedule);observer.observe(container);
 return()=>{cancelAnimationFrame(frame);observer.disconnect();overlay.remove();window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);container.removeEventListener('scroll',schedule);};
}
