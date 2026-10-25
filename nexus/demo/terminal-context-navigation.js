const paths={
 watch:'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
 book:'m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5',
 tape:'M4 5h16M7 12h10M10 19h4',
 stats:'M3 3v18h18M6 14l4-4 4 3 6-8',
 events:'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2ZM8 14h.01M12 14h.01M16 14h.01',
 radar:'M7 3H3v4M17 3h4v4M3 17v4h4M21 17v4h-4M7 12h10',
 plan:'M5 3h10M5 3v18h14v-8M8 7h4M8 11h3m2 3 7-7 2 2-7 7-3 1 1-3Z',
 more:'M5 12h.01M12 12h.01M19 12h.01',
 alerts:'M3 5h5M3 12h5M3 19h5M12 3v18M16 5h5M16 12h5M16 19h5',
 participants:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM18 8a3 3 0 0 1 0 6M22 21v-2a4 4 0 0 0-3-3.87',
 trade:'M14 2H6a2 2 0 0 0-2 2v16h16V8l-6-6ZM14 2v6h6M8 13h8M8 17h5',
 pin:'m16 3 5 5-4 1-3 5v4l-3-3-5-3h4l5-3 1-4ZM2 22l6-6',
 close:'M15 3v18M3 3h18v18H3V3Zm3 6 3 3-3 3',
 chevron:'m9 6 6 6-6 6',
};
export const contextIcon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]||paths.more}"/></svg>`;
const choices=[['watch','Котировки'],['book','Стакан'],['tape','Лента'],['stats','Обзор'],['events','События'],['radar','Радар'],['plan','План'],['alerts','Уровни'],['participants','Позиции участников'],['trade','Заявка']];
const dockKeys=new Set(['stats','events','radar','participants']);
export function createTerminalContextNavigation({rail,headers,open,getCurrent}){
 const doc=rail.ownerDocument;
 // Every context module has its own rail button; nothing hides behind a More menu.
 rail.innerHTML=choices.map(([key,label])=>`<button type="button" ${dockKeys.has(key)?'data-terminal-tab':'data-panel'}="${key}" aria-label="${label}" title="${label}" aria-pressed="false" aria-expanded="false">${contextIcon(key)}<span>${label}</span></button>`).join('');
 const menu=doc.createElement('div');menu.className='terminal-context-menu';menu.hidden=true;menu.setAttribute('role','menu');menu.setAttribute('aria-label','Контекст инструмента');doc.body.append(menu);
 let anchor=null;
 function close(restore=false){menu.hidden=true;anchor?.setAttribute('aria-expanded','false');if(restore)anchor?.focus();anchor=null;}
 function show(button){
  if(anchor===button&&!menu.hidden){close(true);return;}close();anchor=button;button.setAttribute('aria-expanded','true');
  menu.replaceChildren();for(const [key,label]of choices){
   const item=doc.createElement('button');item.type='button';item.setAttribute('role','menuitem');item.dataset.contextChoice=key;
   item.innerHTML=contextIcon(key);const text=doc.createElement('span');text.textContent=label;item.append(text);
   item.setAttribute('aria-current',String(getCurrent()===key));item.addEventListener('click',()=>{close();open(key,dockKeys.has(key));});menu.append(item);
  }
  menu.hidden=false;const r=button.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(innerWidth-menu.offsetWidth-8,r.left))+'px';menu.style.top=Math.max(8,Math.min(innerHeight-menu.offsetHeight-8,r.bottom+5))+'px';menu.querySelector('button')?.focus();
 }
 const titles=[];
 for(const {header,title,pinAttribute}of headers){
  const label=header.querySelector(title);if(!label)continue;
  const button=doc.createElement('button');button.type='button';button.className='terminal-context-title';button.setAttribute('aria-label','Выбрать раздел панели');button.setAttribute('aria-haspopup','menu');button.setAttribute('aria-expanded','false');
  label.replaceWith(button);button.append(label);button.insertAdjacentHTML('beforeend',contextIcon('chevron'));button.addEventListener('click',event=>{event.stopPropagation();show(button);});titles.push(button);
  let pin=header.querySelector('['+pinAttribute+']');if(!pin){pin=doc.createElement('button');pin.type='button';pin.setAttribute(pinAttribute,'');header.append(pin);}
  pin.classList.add('terminal-icon');pin.setAttribute('aria-label','Закрепить панель');pin.title='Закрепить панель';pin.innerHTML=contextIcon('pin');
  const hide=header.querySelector('[data-close-panel],[data-collapse="dock"]');if(hide){hide.innerHTML=contextIcon('close');hide.title='Скрыть панель';header.append(hide);}
 }
 doc.addEventListener('pointerdown',event=>{if(!menu.hidden&&!menu.contains(event.target)&&!anchor?.contains(event.target))close();});
 doc.addEventListener('keydown',event=>{if(menu.hidden)return;if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close(true);}
  else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();const rows=[...menu.querySelectorAll('button')],at=rows.indexOf(doc.activeElement);rows[event.key==='Home'?0:event.key==='End'?rows.length-1:(at+(event.key==='ArrowDown'?1:-1)+rows.length)%rows.length]?.focus();}
  else if(event.key==='Tab')close();
 },true);
 return {update(){
  for(const {header,pinAttribute,isPinned}of headers){const pin=header.querySelector('['+pinAttribute+']'),active=!!isPinned?.();pin?.setAttribute('aria-pressed',String(active));pin?.setAttribute('aria-label',active?'Открепить панель':'Закрепить панель');if(pin)pin.title=active?'Открепить панель':'Закрепить панель';}},close};
}
