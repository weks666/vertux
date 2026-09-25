import {drawingGroups,drawingTypes,drawingStyle} from './chart-tool-catalog.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const record=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
export const chartColorLabels={up:'Растущие свечи',down:'Падающие свечи',line:'Линия и область',background:'Фон графика',grid:'Сетка'};
export const defaultChartColors={up:'#5ed0a0',down:'#ef7b76',line:'#b9a9ff',background:'#0e141c',grid:'#202a36'};
export function normalizeChartColors(value){return Object.fromEntries(Object.keys(chartColorLabels).filter(k=>/^#[0-9a-f]{6}$/i.test(value?.[k]||'')).map(k=>[k,value[k].toLowerCase()]));}
export function normalizeChartPreferences(value={}){
 value=record(value);const tools=record(value.tools),styles=record(value.styles);
 return {tools:Object.fromEntries(drawingGroups.map(g=>[g.id,g.tools.some(([t])=>t===tools[g.id])?tools[g.id]:g.tools[0][0]])),rememberTool:value.rememberTool!==false,rememberStyle:value.rememberStyle!==false,
  styles:Object.fromEntries(drawingTypes.filter(t=>Object.hasOwn(styles,t)).map(t=>[t,drawingStyle(styles[t],t)])),colors:normalizeChartColors(value.colors),
  instruments:Object.fromEntries(Object.entries(record(value.instruments)).filter(([k])=>k.length<=128&&!['__proto__','constructor','prototype'].includes(k)).slice(-80).map(([k,v])=>[k,normalizeChartColors(v)]))};
}
export function createChartPreferences({onChange=()=>{},storage=globalThis.localStorage}={}){
 let scope='device',state,hosts=[];
 const key=()=>`invest:chart-preferences:${scope}`;
 const read=()=>{try{return normalizeChartPreferences(JSON.parse(storage.getItem(key())||'{}'));}catch{return normalizeChartPreferences();}};
 state=read();
 function sync(){for(const{host}of hosts){if(!host.isConnected)continue;for(const el of host.querySelectorAll('[data-default-tool]'))el.value=state.tools[el.dataset.defaultTool];for(const el of host.querySelectorAll('[data-remember-tool]'))el.checked=state.rememberTool;for(const el of host.querySelectorAll('[data-remember-style]'))el.checked=state.rememberStyle;for(const el of host.querySelectorAll('[data-default-color]'))el.value=state.colors[el.dataset.defaultColor]||defaultChartColors[el.dataset.defaultColor];const type=host.querySelector('[data-style-tool]')?.value;if(type){const style=styleFor(type);for(const el of host.querySelectorAll('[data-style-field]')){if(el.type==='checkbox')el.checked=style[el.dataset.styleField];else el.value=style[el.dataset.styleField];}for(const el of host.querySelectorAll('[data-fib-color]'))el.value=style.levelColors[Number(el.dataset.fibColor)];}}}
 function save(){state=normalizeChartPreferences(state);sync();try{storage.setItem(key(),JSON.stringify(state));onChange(state);return true;}catch{for(const{host}of hosts)if(host.isConnected)host.querySelector('[data-chart-preference-status]').textContent='Не удалось сохранить на устройстве. Проверьте доступ к хранилищу браузера.';onChange(state);return false;}}
 const styleFor=type=>drawingStyle(state.styles[type],type);
 function changed(host,text){if(save())host.querySelector('[data-chart-preference-status]').textContent=text;}
 function fields(colors,kind){return Object.entries(chartColorLabels).map(([key,label])=>`<label>${label}<input type="color" data-${kind}="${key}" value="${colors[key]||defaultChartColors[key]}"></label>`).join('');}
 function mount(host,{currentChart,instrumentUid}={}){
  hosts=hosts.filter(x=>x.host.isConnected&&x.host!==host);hosts.push({host,options:{currentChart,instrumentUid}});
  const current=currentChart?.();
  host.innerHTML=`<div class="chart-preferences-form">${current?`<details open><summary>Цвета этого графика</summary><p>Сохраняются для выбранного инструмента на этом устройстве.</p><div class="chart-color-fields">${fields(current.getState().colors||{},'current-color')}</div><button type="button" data-current-theme>Следовать теме</button></details>`:''}
  <details ${current?'':'open'}><summary>Инструменты под рукой</summary><p>Основная кнопка сразу включает рисование. Стрелка рядом открывает остальные варианты.</p><div class="chart-tool-defaults">${drawingGroups.map(g=>`<label>${g.label}<select data-default-tool="${g.id}" aria-label="По умолчанию: ${g.label}">${g.tools.map(([t,label])=>`<option value="${t}" ${state.tools[g.id]===t?'selected':''}>${label}</option>`).join('')}</select></label>`).join('')}</div><label class="chart-preference-check"><input type="checkbox" data-remember-tool ${state.rememberTool?'checked':''}>Запоминать последний выбор в каждой группе</label></details>
  <details><summary>Оформление рисунков</summary><label>Инструмент<select data-style-tool>${drawingGroups.map(g=>`<optgroup label="${g.label}">${g.tools.map(([t,l])=>`<option value="${t}" ${t==='fibonacci'?'selected':''}>${l}</option>`).join('')}</optgroup>`).join('')}</select></label><div data-style-fields></div><label class="chart-preference-check"><input type="checkbox" data-remember-style ${state.rememberStyle?'checked':''}>Использовать изменённый стиль для следующих рисунков этого типа</label></details>
  <details><summary>Цвета новых графиков</summary><p>Индивидуальные цвета уже открытых инструментов сохраняются.</p><div class="chart-color-fields">${fields(state.colors,'default-color')}</div><button type="button" data-default-theme>Использовать цвета темы</button></details><p class="chart-preference-status" data-chart-preference-status role="status">Изменения сохраняются автоматически.</p></div>`;
  const styleFields=()=>{const type=host.querySelector('[data-style-tool]').value,s=styleFor(type);host.querySelector('[data-style-fields]').innerHTML=`<div class="chart-color-fields"><label>Цвет<input type="color" data-style-field="color" value="${s.color}"></label><label>Толщина<input type="number" min="1" max="12" step=".5" data-style-field="width" value="${s.width}"></label><label>Линия<select data-style-field="dash">${[['solid','Сплошная'],['dash','Штрих'],['dot','Точки']].map(([v,l])=>`<option value="${v}" ${s.dash===v?'selected':''}>${l}</option>`).join('')}</select></label><label>Прозрачность<input type="range" min=".05" max="1" step=".05" data-style-field="opacity" value="${s.opacity}"></label><label>Заливка<input type="range" min="0" max="1" step=".05" data-style-field="fill" value="${s.fill}"></label></div>${type.startsWith('fib')?`<label class="chart-preference-check"><input type="checkbox" data-style-field="multicolor" ${s.multicolor?'checked':''}>Разноцветные уровни Фибоначчи</label><div class="chart-fib-palette">${s.levelColors.map((c,i)=>`<label>Уровень ${i+1}<input type="color" data-fib-color="${i}" value="${c}"></label>`).join('')}</div>`:''}`;};styleFields();
  host.onchange=e=>{const field=e.target,d=field.dataset;
   if(field.hasAttribute('data-style-tool')){styleFields();return;}
   if(d.defaultTool){state.tools[d.defaultTool]=field.value;changed(host,'Инструмент по умолчанию сохранён.');}
   if(field.hasAttribute('data-remember-tool')){state.rememberTool=field.checked;changed(host,'Способ выбора инструмента сохранён.');}
   if(field.hasAttribute('data-remember-style')){state.rememberStyle=field.checked;changed(host,'Сохранение стиля настроено.');}
   if(d.styleField||d.fibColor!==undefined){const type=host.querySelector('[data-style-tool]').value,s=styleFor(type);if(d.fibColor!==undefined)s.levelColors[Number(d.fibColor)]=field.value;else s[d.styleField]=field.type==='checkbox'?field.checked:['width','opacity','fill'].includes(d.styleField)?Number(field.value):field.value;state.styles[type]=drawingStyle(s,type);changed(host,'Стиль новых рисунков сохранён.');}
   if(d.defaultColor){state.colors[d.defaultColor]=field.value;changed(host,'Цвет новых графиков сохранён.');}
   if(d.currentColor&&currentChart?.()){const colors={...currentChart().getState().colors,[d.currentColor]:field.value};currentChart().setColors(colors);state.instruments[instrumentUid()]=colors;changed(host,'Цвет этого инструмента сохранён.');}
  };
  host.onclick=e=>{const b=e.target.closest('button');if(!b)return;
   if(b.hasAttribute('data-default-theme')){state.colors={};changed(host,'Новые графики следуют теме.');mount(host,{currentChart,instrumentUid});}
   if(b.hasAttribute('data-current-theme')&&currentChart?.()){currentChart().setColors({});state.instruments[instrumentUid()]={};changed(host,'График следует теме.');mount(host,{currentChart,instrumentUid});}
  };
 }
 document.addEventListener('invest:identity',e=>{const v=e.detail||{};scope=String(v.userId||v.id||v.displayName||v.name||'device');state=read();onChange(state);for(const{host,options}of [...hosts])if(host.isConnected)mount(host,options);});
 return {get:()=>state,styleFor,mount,colorsFor:uid=>state.instruments[uid]||state.colors,
  chooseTool(type,index){if(state.rememberTool){state.tools[drawingGroups[index].id]=type;save();}},
  rememberStyle(type,style){if(state.rememberStyle){state.styles[type]=drawingStyle(style,type);save();}}};
}
