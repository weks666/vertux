import {catalogNotice} from './search-product.js';
import {createSearchTransport} from './search-transport.js';
const esc=value=>String(value??'').replace(/[&<>"']/gu,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const labels={research:'Исследование',terminal:'Терминал',catalog:'Каталог',restore:'Открыть сохранение',navigate:'Открыть','open-query':'Открыть результат','reload-queries':'Повторить чтение'};
const groups={instrument:'Инструменты',saved:'Сохранённые исследования',query:'Сохранённые результаты запросов','query-status':'Сохранённые результаты запросов',section:'Разделы',term:'Термины',page:'На экране'};
let instance=0;

export function createSearchContinuation({input,list,toggle,getData,actions,onClose=()=>{},onOpen=()=>{}}){
 const id=++instance,box=input.closest('.topbar-search'),abort=new AbortController(),search=createSearchTransport();
 let renderRevision=0;
 let rows=[],options=[],active=-1,ticket=null,query='',operation=0,interaction=0,disposed=false;
 const eventOptions={signal:abort.signal};
 const status=document.createElement('p');status.className='search-continuation-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');list.before(status);
 input.setAttribute('role','combobox');input.setAttribute('aria-controls',list.id);input.setAttribute('aria-autocomplete','list');
 list.setAttribute('role','listbox');list.classList.add('search-continuation-results');
 function close({returnFocus=false}={}){renderRevision++;list.removeAttribute('aria-busy');list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');toggle?.setAttribute('aria-expanded','false');box?.classList.remove('search-open');active=-1;if(returnFocus)toggle?.focus();onClose();}
 function mark(index){
  const enabled=options.map((option,i)=>option.enabled?i:-1).filter(i=>i>=0);if(!enabled.length)return;
  active=enabled.includes(index)?index:enabled[0];
  for(const button of list.querySelectorAll('[data-search-option]'))button.setAttribute('aria-selected',String(Number(button.dataset.searchOption)===active));
  const selected=list.querySelector(`[data-search-option="${active}"]`);if(selected){input.setAttribute('aria-activedescendant',selected.id);const item=selected.getBoundingClientRect(),bounds=list.getBoundingClientRect();if(item.top<bounds.top)list.scrollTop-=bounds.top-item.top;else if(item.bottom>bounds.bottom)list.scrollTop+=item.bottom-bounds.bottom;}
 }
 function move(delta){const enabled=options.map((option,i)=>option.enabled?i:-1).filter(i=>i>=0);if(!enabled.length)return;const index=enabled.indexOf(active);mark(enabled[index<0?(delta>0?0:enabled.length-1):(index+delta+enabled.length)%enabled.length]);}
 async function render(){
  const serial=++renderRevision,data=getData()||{},captured=actions.capture();query=input.value;ticket=null;options=[];active=-1;input.removeAttribute('aria-activedescendant');list.setAttribute('aria-busy','true');
  for(const button of list.querySelectorAll('[data-search-option]'))button.setAttribute('aria-disabled','true');
  const result=await search.search(query,data);
  if(disposed||serial!==renderRevision||list.hidden)return;
  list.removeAttribute('aria-busy');
  if(!Array.isArray(result)){list.innerHTML='<p role="status">Не удалось выполнить поиск. Измените запрос, чтобы повторить.</p>';return;}
  rows=result;ticket=captured;
  const chunks=[];let previous=null;
  for(const row of rows){
   if(previous!==row.kind){chunks.push(`<div class="search-result-group" role="presentation">${esc(groups[row.kind])}</div>`);previous=row.kind;}
   const buttons=row.actions.map(action=>{const index=options.length,enabled=actions.canExecute(row,action);options.push({row,action,enabled});return `<button type="button" role="option" tabindex="-1" aria-selected="false" aria-disabled="${!enabled}" id="search-${id}-${index}" data-search-option="${index}" aria-label="${esc(row.title+' · '+labels[action]+' · '+row.caption)}"><span>${esc(labels[action])}</span>${!enabled?'<small>Недоступно</small>':''}</button>`;}).join('');
   chunks.push(`<div class="search-result-row" role="presentation" data-search-key="${esc(row.key)}"><strong>${esc(row.title)}</strong><small>${esc(row.caption)}</small>${row.reason?'<p class="search-result-reason">'+esc(row.reason)+'</p>':''}<div class="search-result-actions" role="presentation">${buttons}</div></div>`);
  }
  list.innerHTML=`<p class="search-result-scope">${esc(catalogNotice(data.catalogState))}</p>`+(chunks.join('')||'<p>Совпадений в доступных данных нет. Попробуйте название раздела или другой идентификатор.</p>');
 }
 function open({refresh=true}={}){if(disposed)return;const wasHidden=list.hidden;list.hidden=false;input.setAttribute('aria-expanded','true');toggle?.setAttribute('aria-expanded','true');box?.classList.add('search-open');void render();if(wasHidden&&refresh)onOpen();}
 async function choose(index){
  const option=options[index];if(!option||!option.enabled)return;
  const currentTicket=ticket,serial=++operation,intent=++interaction,chosenQuery=query;status.textContent='';if(option.action!=='reload-queries')close();
  // A saved-view restore publishes its own loading state. That redraw may clear
  // choices, but only user input cancels this intent; access/context guards are
  // owned by the action and archive controllers.
  const result=await actions.execute(option.row,option.action,currentTicket,{isCurrent:()=>!disposed&&intent===interaction&&input.value===chosenQuery});
  if(disposed||serial!==operation||input.value!==chosenQuery)return;
  if(result.ok){status.textContent='';return;}
  status.textContent=result.code==='stale'?'Контекст изменился. Выберите результат из обновлённого списка.':result.code==='query-unavailable'?'Не удалось подтвердить сохранённый результат. Повторите чтение личного архива.':'Не удалось открыть результат. Проверьте доступность инструмента и повторите.';
  if(document.activeElement===input)open({refresh:false});
 }
 input.addEventListener('focus',()=>{status.textContent='';open();},eventOptions);
 input.addEventListener('input',()=>{operation++;interaction++;status.textContent='';open();},eventOptions);
 input.addEventListener('keydown',event=>{
  if(event.key==='Tab'){operation++;interaction++;status.textContent='';close();return;}
  if(event.key==='Escape'){event.preventDefault();operation++;interaction++;status.textContent='';close({returnFocus:true});return;}
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();if(list.hidden)open();move(event.key==='ArrowDown'?1:-1);return;}
  if(event.key==='Enter'&&!list.hidden){event.preventDefault();if(active>=0)void choose(active);else status.textContent='Выберите результат стрелками или нажмите нужное действие.';}
 },eventOptions);
 list.addEventListener('click',event=>{const button=event.target.closest('[data-search-option]');if(button)void choose(Number(button.dataset.searchOption));},eventOptions);
 // Keep input as combobox focus owner for pointer options, but never trap Tab.
 list.addEventListener('mousedown',event=>{if(event.target.closest('[data-search-option]'))event.preventDefault();},eventOptions);
 // An accepted navigation moves focus itself. User departures are captured by
 // Tab/pointerdown; a programmatic focus transfer must not cancel that commit.
 box?.addEventListener('focusout',event=>{if(!box.contains(event.relatedTarget)){operation++;status.textContent='';close();}},eventOptions);
 toggle?.addEventListener('click',()=>{input.focus({preventScroll:true});if(list.hidden)open();},eventOptions);
 document.addEventListener('pointerdown',event=>{if(!box?.contains(event.target)){operation++;interaction++;status.textContent='';close();}},eventOptions);
 window.addEventListener('keydown',event=>{if(event.defaultPrevented||event.composedPath().some(node=>node?.matches?.('input,textarea,select,[contenteditable="true"]')))return;if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();input.focus({preventScroll:true});input.select();}},eventOptions);
 close();
 return Object.freeze({update(){if(disposed)return;operation++;status.textContent='';if(!list.hidden){list.replaceChildren();void render();}else{void search.search('',getData()||{});rows=[];options=[];ticket=null;active=-1;list.replaceChildren();input.removeAttribute('aria-activedescendant');}},dispose(){if(disposed)return;disposed=true;operation++;search.dispose();abort.abort();close();status.remove();}});
}
