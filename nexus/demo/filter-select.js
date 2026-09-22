// Compact, keyboard-accessible selectors with a consistently downward popup.
export function enhanceFilterSelect(select, icon) {
 if(!select || select.dataset.enhanced)return;
 select.dataset.enhanced='true';
 const wrap=document.createElement('span');wrap.className='filter-select';select.before(wrap);wrap.append(select);
 const trigger=document.createElement('button');trigger.type='button';trigger.className='filter-select-trigger';
 trigger.setAttribute('role','combobox');trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');
 const label=select.getAttribute('aria-label')||select.labels?.[0]?.querySelector(':scope > span:not(.filter-select)')?.textContent?.trim()||'Фильтр';
 const glyph=icon==='building'?'<path d="M5 21V5h9v16M14 10h5v11M8 8h3M8 12h3M8 16h3M3 21h18"/>':icon==='news'?'<path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/>':'<use href="#i-'+icon+'"/>';
 trigger.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24">'+glyph+'</svg><span></span><svg class="filter-select-arrow" aria-hidden="true"><use href="#i-chevron"/></svg>';
 const menu=document.createElement('span');menu.id=select.id+'-options';menu.className='filter-select-options';menu.setAttribute('role','listbox');menu.setAttribute('aria-label',label);menu.hidden=true;
 trigger.setAttribute('aria-controls',menu.id);wrap.append(trigger,menu);
 select.hidden=true;select.tabIndex=-1;
 function close(focus=false){menu.hidden=true;trigger.setAttribute('aria-expanded','false');if(focus)trigger.focus({preventScroll:true});}
 function update(){
  const focusedValue=menu.contains(document.activeElement)?document.activeElement?.dataset.value:null;
  trigger.querySelector('span').textContent=select.selectedOptions[0]?.textContent||label;
  trigger.setAttribute('aria-label',label+': '+trigger.querySelector('span').textContent);trigger.disabled=select.disabled;
  menu.replaceChildren(...[...select.options].map(option=>{
   const b=document.createElement('button');b.type='button';b.setAttribute('role','option');b.setAttribute('aria-selected',String(option.selected));b.tabIndex=-1;b.dataset.value=option.value;b.disabled=option.disabled;b.textContent=option.textContent;
   b.addEventListener('click',()=>{select.value=option.value;update();close(true);select.dispatchEvent(new Event('change',{bubbles:true}));});return b;
  }));
  if(focusedValue!==null&&!menu.hidden){const choices=[...menu.querySelectorAll('button')];(choices.find(b=>b.dataset.value===focusedValue)||choices.find(b=>b.getAttribute('aria-selected')==='true'))?.focus({preventScroll:true});}
 }
 function open(){menu.hidden=false;trigger.setAttribute('aria-expanded','true');const option=menu.querySelector('[aria-selected=true]')||menu.querySelector('button');option?.focus({preventScroll:true});}
 trigger.addEventListener('click',()=>menu.hidden?open():close());
 trigger.addEventListener('keydown',e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();open();}});
 wrap.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();close(true);return;}
  if(e.key==='Tab'){close();return;}
  if(menu.hidden||!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;
  e.preventDefault();const choices=[...menu.querySelectorAll('button:not(:disabled)')],i=choices.indexOf(document.activeElement);
  const next=e.key==='Home'?0:e.key==='End'?choices.length-1:(i+(e.key==='ArrowDown'?1:-1)+choices.length)%choices.length;choices[next]?.focus();
 });
 document.addEventListener('pointerdown',e=>{if(!wrap.contains(e.target))close();});
 wrap.addEventListener('focusout',e=>{if(!wrap.contains(e.relatedTarget))close();});
 select.addEventListener('change',update);
 new MutationObserver(update).observe(select,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});update();
}
