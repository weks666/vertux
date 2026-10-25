import {indicatorCatalog} from './chart-indicators.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const studyIcon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${({gear:'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2zM9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0',eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0',close:'m6 6 12 12M6 18 18 6'})[name]}"/></svg>`;
export const studyTitle=s=>`${s.type.toUpperCase()}${['obv','vpt','nvi','pvi','ultimate'].includes(s.type)?'':' '+s.period}`;

export function createStudyLegend({host,chart,getStudies,setStudies,getVolume,setVolume,onSettings}) {
 const layer=document.createElement('div');layer.className='chart-study-legends';host.append(layer);
 const button=(name,label,action)=>`<button type="button" data-study-action="${action}" aria-label="${esc(label)}" title="${esc(label)}">${studyIcon(name)}</button>`;
 function position(){
  const panes=chart.panes(),tops=[25];let top=0;
  panes.forEach((pane,i)=>{if(i)tops[i]=top+6;top+=pane.getHeight()+2;});
  for(const group of layer.children)group.style.top=(tops[Number(group.dataset.pane)]??6)+'px';
 }
 function render(){
  const active=document.activeElement,focus=layer.contains(active)?{id:active.closest('[data-legend-study]')?.dataset.legendStudy,action:active.dataset.studyAction}:null;
  const groups=new Map([[0,[]]]);let pane=0;
  for(const study of getStudies()){
   const definition=indicatorCatalog.find(row=>row.type===study.type),index=study.visible&&definition?.placement==='pane'?++pane:0;
   if(!groups.has(index))groups.set(index,[]);
   const title=studyTitle(study),name=definition?.label||title;
   groups.get(index).push(`<div class="chart-study-legend${study.visible?'':' is-hidden'}" data-legend-study="${esc(study.id)}"><span class="study-color" style="background:${esc(study.color)}"></span><span class="study-title" title="${esc(name)}">${esc(title)}</span>${button('eye',(study.visible?'Скрыть ':'Показать ')+title,'toggle')}${onSettings?button('gear','Настройки '+title,'settings'):''}${button('close','Удалить '+title,'remove')}</div>`);
  }
  if(getVolume())groups.get(0).push(`<div class="chart-study-legend" data-legend-study="__volume"><span class="study-title">Объём</span>${button('close','Удалить объём','remove')}</div>`);
  layer.innerHTML=[...groups].map(([index,rows])=>`<div class="chart-study-legend-group" data-pane="${index}">${rows.join('')}</div>`).join('');position();
  if(focus){const row=[...layer.querySelectorAll('[data-legend-study]')].find(row=>row.dataset.legendStudy===focus.id);(row?.querySelector(`[data-study-action="${focus.action}"]`)||layer.querySelector('button'))?.focus({preventScroll:true});}
 }
 layer.addEventListener('pointerdown',event=>event.stopPropagation());
 layer.addEventListener('dblclick',event=>event.stopPropagation());
 layer.addEventListener('click',event=>{
  const action=event.target.closest('[data-study-action]');if(!action)return;
  event.stopPropagation();const id=action.closest('[data-legend-study]').dataset.legendStudy;
  if(id==='__volume'){setVolume(false);return;}
  const studies=getStudies(),study=studies.find(row=>row.id===id);if(!study)return;
  if(action.dataset.studyAction==='settings')onSettings?.(id,action);
  else if(action.dataset.studyAction==='remove')setStudies(studies.filter(row=>row.id!==id));
  else setStudies(studies.map(row=>row.id===id?{...row,visible:!row.visible}:row));
 });
 return {render,position,destroy(){layer.remove();}};
}
