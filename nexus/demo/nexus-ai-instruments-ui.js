import {planInstrumentMatches} from './plan-instrument-picker.js';
import {planCatalogInstrument} from './plan-catalog.js';
// Uses the catalogue already loaded by Workspace; this picker never refreshes a broker feed.
export function mountNexusInstruments({parent,getCatalog,getOwned,onSelect}){
 const el=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
 const detail=el('section');detail.className='nexus-ai-instrument-picker';detail.hidden=true;detail.setAttribute('aria-label','Прикрепить инструмент');
 const search=el('input');search.type='search';search.placeholder='Название, тикер или ISIN';search.setAttribute('aria-label','Найти инструмент для Nexus AI');
 const list=el('div');list.className='nexus-ai-instrument-options';const status=el('p');status.setAttribute('role','status');const popover=el('div');popover.className='nexus-ai-instrument-popover';popover.append(search,list,status);detail.append(popover);parent.append(detail);
 function refresh(){const catalog=getCatalog()||[],owned=getOwned()||[];
  const candidates=[...catalog,...owned.filter(row=>!catalog.some(item=>item.instrumentUid===row.instrumentUid))];
  const matched=planInstrumentMatches(candidates,search.value).filter(row=>catalog.some(item=>item.instrumentUid===row.instrumentUid)?!!planCatalogInstrument(catalog,row.instrumentUid):true).slice(0,20);
  list.replaceChildren();for(const row of matched){const b=el('button');b.type='button';b.className='nexus-ai-plan-option';b.dataset.aiInstrumentId=row.instrumentUid;
   b.append(el('strong',[row.ticker,row.name].filter(Boolean).join(' · ')),el('small',[row.classCode,row.currency,row.isin].filter(Boolean).join(' · ')));
   b.addEventListener('click',()=>{if(detail.inert)return;onSelect({id:row.instrumentUid,label:row.name||row.ticker||'Выбранный инструмент'});detail.hidden=true;});list.append(b);}
  status.textContent=matched.length===20?'Первые 20 совпадений. Уточните название.':matched.length?'':'Совпадений нет. Уточните название или дождитесь загрузки каталога.';
  status.hidden=!status.textContent;
 }
 search.addEventListener('input',refresh);
 return {open(){detail.hidden=false;refresh();search.focus();},close(){detail.hidden=true;},update(busy){detail.inert=busy;if(!detail.hidden)refresh();},reset(){search.value='';list.replaceChildren();status.textContent='';detail.hidden=true;}};
}
