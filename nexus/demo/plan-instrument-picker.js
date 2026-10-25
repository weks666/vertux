import {instrumentMark, watchInstrumentImages} from './instrument-mark.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function planInstrumentMatches(rows, query='') {
 const terms=query.trim().toLocaleLowerCase('ru').split(/\s+/u).filter(Boolean), seen=new Set();
 return rows.filter(row=>{
  if(!row?.instrumentUid||seen.has(row.instrumentUid))return false;
  seen.add(row.instrumentUid);
  const text=[row.ticker,row.name,row.instrumentUid,row.isin,row.classCode].filter(Boolean).join(' ').toLocaleLowerCase('ru');
  return terms.every(term=>text.includes(term));
 }).sort((a,b)=>Number(String(b.ticker).toLowerCase()===query.toLowerCase())-Number(String(a.ticker).toLowerCase()===query.toLowerCase())
  ||Number(b.inPortfolio===true)-Number(a.inPortfolio===true)||Number(b.classCode==='TQBR')-Number(a.classCode==='TQBR')
  ||String(a.ticker).localeCompare(String(b.ticker),'ru')).slice(0,60);
}

// The native select remains the single submitted value. Catalogue selection is
// revalidated by the existing account/owner checks when the draft is saved.
export function createPlanInstrumentPicker({select,getRows,getSelected,onSelect}) {
 if(!select?.parentElement)return {refresh(){}};
 const host=document.createElement('div');host.className='plan-instrument-picker';
 const button=document.createElement('button');button.type='button';button.className='plan-instrument-choice';
 button.setAttribute('aria-label','Выбрать инструмент');button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','planInstrumentSearchPanel');
 const panel=document.createElement('div');panel.id='planInstrumentSearchPanel';panel.className='plan-instrument-results';panel.hidden=true;
 panel.innerHTML='<input type="search" aria-label="Найти инструмент для плана" placeholder="Тикер, название, ISIN или ID" autocomplete="off"><p class="plan-picker-hint">Каталог брокера, включая инструменты вне портфеля</p><div class="plan-instrument-options" role="listbox" aria-label="Найденные инструменты"></div><p class="plan-picker-status" role="status"></p>';
 host.append(button,panel);select.after(host);select.hidden=true;select.tabIndex=-1;
 const input=panel.querySelector('input'),list=panel.querySelector('[role=listbox]'),status=panel.querySelector('[role=status]');
 let matches=[];
 function close(focus=false){panel.hidden=true;button.setAttribute('aria-expanded','false');if(focus)button.focus();}
 function render(){
  matches=planInstrumentMatches(getRows(),input.value);
  list.innerHTML=matches.map((row,index)=>`<button type="button" role="option" data-plan-choice="${index}" aria-selected="${select.value===row.instrumentUid}">${instrumentMark(row)}<span><strong>${esc(row.ticker||row.name)}</strong><small>${esc(row.name)}</small><small>${esc([row.classCode,row.currency,row.inPortfolio?'В портфеле':''].filter(Boolean).join(' · '))}</small></span></button>`).join('');
  status.textContent=matches.length===60?'Первые 60 совпадений. Уточните поиск.':matches.length?`Найдено: ${matches.length}`:'Совпадений нет. Проверьте запрос и загрузку каталога.';watchInstrumentImages(list);
 }
 function refresh(){
  const selected=getSelected();button.disabled=select.disabled;
  button.innerHTML=(selected?instrumentMark(selected):'')+'<span>'+esc(selected?[selected.ticker,selected.name].filter(Boolean).join(' · '):select.selectedOptions?.[0]?.textContent||'Выберите инструмент')+'</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>';
  watchInstrumentImages(button);if(button.disabled)close();else if(!panel.hidden)render();
 }
 button.addEventListener('click',()=>{if(!panel.hidden){close();return;}panel.hidden=false;button.setAttribute('aria-expanded','true');input.value='';render();input.focus();});
 input.addEventListener('input',render);
 list.addEventListener('click',event=>{const choice=event.target.closest('[data-plan-choice]');if(!choice)return;const row=matches[Number(choice.dataset.planChoice)];if(!row)return;onSelect(row);refresh();close(true);});
 host.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!panel.hidden){event.preventDefault();event.stopPropagation();close(true);}
  if(['ArrowDown','ArrowUp'].includes(event.key)&&!panel.hidden){event.preventDefault();const options=[...list.querySelectorAll('button')],index=options.indexOf(document.activeElement),next=event.key==='ArrowDown'?Math.min(index+1,options.length-1):Math.max(0,index-1);options[next]?.focus();}
 });
 document.addEventListener('pointerdown',event=>{if(!host.contains(event.target))close();});
 // During a pointer focus change activeElement is temporarily body. Closing in
 // that gap removes the option before mouseup/click; relatedTarget is stable.
 host.addEventListener('focusout',event=>{if(!host.contains(event.relatedTarget))close();});
 return {refresh,close};
}
