// Shared native top-layer menus. No application data or settings are read here.
export const controlNode=(tag,text,className)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;};
const paths={check:'m5 12 4 4L19 6',chevron:'m7 10 5 5 5-5',close:'m6 6 12 12M18 6 6 18',settings:'M4 7h16M4 17h16M8 4v6M16 14v6',refresh:'M20 10a8 8 0 1 0-2 7M20 4v6h-6',globe:'M3 12h18M12 3a17 17 0 0 1 0 18 17 17 0 0 1 0-18M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',compose:'M13 5H5v14h14v-8M12 12l1-4 6-6 3 3-6 6-4 1',arrow:'m9 5 7 7-7 7',back:'m14 5-7 7 7 7',search:'M20 20l-5-5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',computer:'M3 4h18v13H3zM8 21h8M12 17v4'};
export function controlIcon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS(svg.namespaceURI,'path');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.classList.add('ui-icon');path.setAttribute('d',paths[name]||paths.chevron);svg.append(path);return svg;}
export function controlButton(label,action,{icon,iconOnly=false,className='ui-button'}={}){const b=controlNode('button',undefined,className);b.type='button';if(icon)b.append(controlIcon(icon));b.append(controlNode('span',label,iconOnly?'ui-sr-only':''));if(iconOnly){b.classList.add('ui-icon-button');b.setAttribute('aria-label',label);b.title=label;}b.addEventListener('click',action);return b;}
export function anchoredMenu({menu,anchor,placement='above',onOpen=()=>{},onClose=()=>{}}){
 menu.setAttribute('popover','auto');menu.classList.add('ui-menu');menu.id||='menu-'+crypto.randomUUID();anchor.setAttribute('aria-controls',menu.id);anchor.setAttribute('aria-expanded','false');let returnFocus=false;
 const opened=()=>menu.matches(':popover-open');
 function position(){if(!opened())return;const a=anchor.getBoundingClientRect(),b=menu.getBoundingClientRect(),gap=6,pad=12,above=a.top-b.height-gap,below=a.bottom+gap;menu.style.left=Math.max(pad,Math.min(a.left,innerWidth-b.width-pad))+'px';menu.style.top=Math.max(pad,Math.min(placement==='above'&&above>=pad?above:below+b.height<=innerHeight-pad?below:above,innerHeight-b.height-pad))+'px';}
 function close(focus=false){returnFocus=focus;if(opened())menu.hidePopover();}
 function open(){if(opened())return;menu.showPopover();position();anchor.setAttribute('aria-expanded','true');onOpen();}
 menu.addEventListener('toggle',e=>{anchor.setAttribute('aria-expanded',String(e.newState==='open'));if(e.newState==='closed'){if(returnFocus){anchor.focus();returnFocus=false;}onClose();}});
 const options=()=>[...menu.querySelectorAll('button:not(:disabled),input:not(:disabled)')].filter(el=>el.getClientRects().length&&!el.closest('[hidden]'));
 menu.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close(true);return;}if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key)||e.target.matches('input,textarea,select'))return;const rows=options();if(!rows.length)return;e.preventDefault();const i=rows.indexOf(document.activeElement);rows[e.key==='Home'?0:e.key==='End'?rows.length-1:(i+(e.key==='ArrowUp'?-1:1)+rows.length)%rows.length].focus();});
 anchor.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();open();options()[0]?.focus();}});
 const observer=new ResizeObserver(position);observer.observe(menu);window.addEventListener('resize',position);
 return {open,close,toggle(){if(opened())close();else open();},position,dispose(){close();observer.disconnect();window.removeEventListener('resize',position);}};
}
