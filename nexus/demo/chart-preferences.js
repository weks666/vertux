import {drawingGroups,drawingTypes,drawingStyle} from './chart-tool-catalog.js';
import {createTerminalScopedSettings,mountTerminalSettingsRecovery} from './terminal-scoped-settings.js';
import {mountTerminalSettingsTransfer} from './terminal-settings-transfer-ui.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
import {chartColorLabels,defaultChartColors,normalizeChartPreferences} from './chart-preferences-model.js';
export {chartColorLabels,defaultChartColors,normalizeChartColors,normalizeChartPreferences} from './chart-preferences-model.js';
export function createChartPreferences({isPreview=()=>false,onChange=()=>{},storage}={}){
 const store=createTerminalScopedSettings({kind:'chart-preferences',normalize:normalizeChartPreferences,legacyKey:'invest:chart-preferences:device',storage});
 let state=store.get(),hosts=[],boundScope=null,identityChanged=false;const transfers=new Map();
 function sync(){for(const{host}of hosts){if(!host.isConnected)continue;for(const el of host.querySelectorAll('[data-default-tool]'))el.value=state.tools[el.dataset.defaultTool];for(const el of host.querySelectorAll('[data-remember-tool]'))el.checked=state.rememberTool;for(const el of host.querySelectorAll('[data-remember-style]'))el.checked=state.rememberStyle;for(const el of host.querySelectorAll('[data-default-color]'))el.value=state.colors[el.dataset.defaultColor]||defaultChartColors[el.dataset.defaultColor];const type=host.querySelector('[data-style-tool]')?.value;if(type){const style=styleFor(type);for(const el of host.querySelectorAll('[data-style-field]')){if(el.type==='checkbox')el.checked=style[el.dataset.styleField];else el.value=style[el.dataset.styleField];}for(const el of host.querySelectorAll('[data-fib-color]'))el.value=style.levelColors[Number(el.dataset.fibColor)];}}}
 function save(){const ok=store.write(normalizeChartPreferences(state));state=store.get();sync();onChange(state);if(!ok)for(const{host,options}of [...hosts])if(host.isConnected)mount(host,options);return ok;}
 const styleFor=type=>drawingStyle(state.styles[type],type);
 function changed(host,text){if(save())host.querySelector('[data-chart-preference-status]').textContent=store.status().persistence==='memory-session'?'Изменение действует до перезагрузки предпросмотра.':text;}
 function fields(colors,kind){return Object.entries(chartColorLabels).map(([key,label])=>`<label>${label}<input type="color" data-${kind}="${key}" value="${colors[key]||defaultChartColors[key]}"></label>`).join('');}
 function mount(host,{currentChart,instrumentUid,compact=false}={}){
  for(const [element,transfer]of transfers)if(element===host||!element.isConnected){transfer.dispose();transfers.delete(element);}
  hosts=hosts.filter(x=>x.host.isConnected&&x.host!==host);hosts.push({host,options:{currentChart,instrumentUid,compact}});
  const current=currentChart?.();
  host.innerHTML=`<div class="chart-preferences-form">${current?`<details open><summary>Цвета этого графика</summary><p>Сохраняются для выбранного инструмента на этом устройстве.</p><div class="chart-color-fields">${fields(current.getState().colors||{},'current-color')}</div><button type="button" data-current-theme>Следовать теме</button></details>`:''}
  <details ${current?'':'open'}><summary>Инструменты под рукой</summary><p>Основная кнопка сразу включает рисование. Стрелка рядом открывает остальные варианты.</p><div class="chart-tool-defaults">${drawingGroups.map(g=>`<label>${g.label}<select data-default-tool="${g.id}" aria-label="По умолчанию: ${g.label}">${g.tools.map(([t,label])=>`<option value="${t}" ${state.tools[g.id]===t?'selected':''}>${label}</option>`).join('')}</select></label>`).join('')}</div><label class="chart-preference-check"><input type="checkbox" data-remember-tool ${state.rememberTool?'checked':''}>Запоминать последний выбор в каждой группе</label></details>
  <details><summary>Оформление рисунков</summary><label>Инструмент<select data-style-tool>${drawingGroups.map(g=>`<optgroup label="${g.label}">${g.tools.map(([t,l])=>`<option value="${t}" ${t==='fibonacci'?'selected':''}>${l}</option>`).join('')}</optgroup>`).join('')}</select></label><div data-style-fields></div><label class="chart-preference-check"><input type="checkbox" data-remember-style ${state.rememberStyle?'checked':''}>Использовать изменённый стиль для следующих рисунков этого типа</label></details>
  <details><summary>Цвета новых графиков</summary><p>Индивидуальные цвета уже открытых инструментов сохраняются.</p><div class="chart-color-fields">${fields(state.colors,'default-color')}</div><button type="button" data-default-theme>Использовать цвета темы</button></details><p class="chart-preference-status" data-chart-preference-status role="status">Изменения сохраняются автоматически.</p></div>`;
  const styleFields=()=>{const type=host.querySelector('[data-style-tool]').value,s=styleFor(type);host.querySelector('[data-style-fields]').innerHTML=`<div class="chart-color-fields"><label>Цвет<input type="color" data-style-field="color" value="${s.color}"></label><label>Толщина<input type="number" min="1" max="12" step=".5" data-style-field="width" value="${s.width}"></label><label>Линия<select data-style-field="dash">${[['solid','Сплошная'],['dash','Штрих'],['dot','Точки']].map(([v,l])=>`<option value="${v}" ${s.dash===v?'selected':''}>${l}</option>`).join('')}</select></label><label>Прозрачность<input type="range" min=".05" max="1" step=".05" data-style-field="opacity" value="${s.opacity}"></label><label>Заливка<input type="range" min="0" max="1" step=".05" data-style-field="fill" value="${s.fill}"></label></div>${type.startsWith('fib')?`<label class="chart-preference-check"><input type="checkbox" data-style-field="multicolor" ${s.multicolor?'checked':''}>Разноцветные уровни Фибоначчи</label><div class="chart-fib-palette">${s.levelColors.map((c,i)=>`<label>Уровень ${i+1}<input type="color" data-fib-color="${i}" value="${c}"></label>`).join('')}</div>`:''}`;};styleFields();
  host.onchange=e=>{const field=e.target,d=field.dataset;
   if(field.hasAttribute('data-style-tool')){styleFields();return;}
   if(!store.status().ready)return;
   if(d.defaultTool){state.tools[d.defaultTool]=field.value;changed(host,'Инструмент по умолчанию сохранён.');}
   if(field.hasAttribute('data-remember-tool')){state.rememberTool=field.checked;changed(host,'Способ выбора инструмента сохранён.');}
   if(field.hasAttribute('data-remember-style')){state.rememberStyle=field.checked;changed(host,'Сохранение стиля настроено.');}
   if(d.styleField||d.fibColor!==undefined){const type=host.querySelector('[data-style-tool]').value,s=styleFor(type);if(d.fibColor!==undefined)s.levelColors[Number(d.fibColor)]=field.value;else s[d.styleField]=field.type==='checkbox'?field.checked:['width','opacity','fill'].includes(d.styleField)?Number(field.value):field.value;state.styles[type]=drawingStyle(s,type);changed(host,'Стиль новых рисунков сохранён.');}
   if(d.defaultColor){state.colors[d.defaultColor]=field.value;changed(host,'Цвет новых графиков сохранён.');}
   if(d.currentColor&&currentChart?.()){const colors={...currentChart().getState().colors,[d.currentColor]:field.value};currentChart().setColors(colors);state.instruments[instrumentUid()]=colors;changed(host,'Цвет этого инструмента сохранён.');}
  };
  host.onclick=e=>{const b=e.target.closest('button');if(!b)return;
   if(!store.status().ready)return;
   if(b.hasAttribute('data-default-theme')){state.colors={};changed(host,'Новые графики следуют теме.');mount(host,{currentChart,instrumentUid,compact});}
   if(b.hasAttribute('data-current-theme')&&currentChart?.()){currentChart().setColors({});state.instruments[instrumentUid()]={};changed(host,'График следует теме.');mount(host,{currentChart,instrumentUid,compact});}
  };
  const writable=store.status().ready;for(const control of host.querySelectorAll('input,select,button'))control.disabled=!writable;
  const feedback=host.querySelector('[data-chart-preference-status]');feedback.textContent=store.status().message;feedback.hidden=store.status().legacy;
  if(current&&store.status().persistence==='memory-session')host.querySelector('details p').textContent='Цвета действуют для выбранного инструмента до перезагрузки предпросмотра.';
  if(store.status().legacy)mountTerminalSettingsRecovery(host,store,()=>{state=store.get();onChange(state);for(const row of [...hosts])if(row.host.isConnected)mount(row.host,row.options);host.querySelector('summary')?.focus();});
  transfers.set(host,mountTerminalSettingsTransfer(host,{kind:'chart-preferences',store,onRestored:({message})=>{reloadUi();transfers.get(host)?.setNotice(message,true);}}));
  host.classList.toggle('chart-preferences-compact',compact);
  if(compact){
   const form=host.querySelector('.chart-preferences-form'),sections=[...form.querySelectorAll(':scope>details')],nav=document.createElement('div');
   nav.className='chart-preference-tabs';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Настройки графика');nav.setAttribute('aria-orientation','vertical');
   const activate=index=>{host.dataset.preferenceTab=String(index);sections.forEach((section,i)=>{section.hidden=i!==index;nav.children[i].setAttribute('aria-selected',String(i===index));nav.children[i].tabIndex=i===index?0:-1;});};
   sections.forEach((section,index)=>{const summary=section.querySelector('summary'),button=document.createElement('button'),id='chart-preference-'+crypto.randomUUID();button.type='button';button.textContent=summary.textContent;button.id=id+'-tab';button.setAttribute('role','tab');button.setAttribute('aria-controls',id);section.id=id;section.setAttribute('role','tabpanel');section.setAttribute('aria-labelledby',button.id);section.open=true;summary.hidden=true;button.onclick=()=>activate(index);nav.append(button);});
   nav.onkeydown=event=>{if(!['ArrowUp','ArrowDown','Home','End'].includes(event.key))return;event.preventDefault();const index=[...nav.children].indexOf(event.target),next=event.key==='Home'?0:event.key==='End'?sections.length-1:(index+(event.key==='ArrowUp'?-1:1)+sections.length)%sections.length;activate(next);nav.children[next].focus();};
   form.prepend(nav);activate(Math.min(sections.length-1,Number(host.dataset.preferenceTab)||0));
  }
 }
 function reloadUi(){state=store.get();onChange(state);for(const{host,options}of [...hosts])if(host.isConnected)mount(host,options);}
 function setIdentity(value={},options={preview:!!isPreview()}){boundScope=value.preferenceScope||null;identityChanged=false;if(store.bind(value,options))reloadUi();}
 document.addEventListener('invest:identity',e=>{if(identityChanged)return;const value=e.detail||{};if(boundScope&&value.preferenceScope!==boundScope){identityChanged=true;store.invalidate();reloadUi();}else setIdentity(value);});
 globalThis.addEventListener?.('storage',e=>{if(store.storageChanged(e.key))reloadUi();});
 return {setIdentity,get:()=>store.get(),isFavorite:(kind,type)=>state.favorites[kind]?.includes(type)===true,toggleFavorite(kind,type){if(!store.status().ready||!['tools','indicators'].includes(kind))return;const list=state.favorites[kind];state.favorites[kind]=list.includes(type)?list.filter(t=>t!==type):[...list,type];save();},styleFor,mount,colorsFor:uid=>state.instruments[uid]||state.colors,
  chooseTool(type,index){if(store.status().ready&&state.rememberTool){state.tools[drawingGroups[index].id]=type;save();}},
  rememberStyle(type,style){if(store.status().ready&&state.rememberStyle){state.styles[type]=drawingStyle(style,type);save();}}};
}
