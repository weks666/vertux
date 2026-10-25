import {WORKSPACE_SETTINGS_LIMIT,workspaceSettingsData,validateWorkspaceSettings} from './workspace-settings-model.js';
import {TASK_SECTIONS,TASK_ROUTES,readTaskNavigation} from './task-navigation-model.js';
import {PANEL_DEFINITIONS} from './workspace-panels-model.js';
export const workspaceSettingsFileLimit=WORKSPACE_SETTINGS_LIMIT;
const bytes=text=>new TextEncoder().encode(text).length;
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const canonical=value=>JSON.stringify(value,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export function validateWorkspaceFileValue(value,contract){
 workspaceSettingsData(value);const normalized=validateWorkspaceSettings(value,contract);
 // Files must carry every binding. Legacy default filling is not a file migration.
 if(canonical(normalized)!==canonical(value))throw Error('WORKSPACE_FILE_INCOMPLETE');
 return normalized;
}
export function decodeWorkspaceSettingsFile(text,contract){
 if(typeof text!=='string'||bytes(text)>workspaceSettingsFileLimit)throw Error('WORKSPACE_FILE_LIMIT');
 const doc=JSON.parse(text);workspaceSettingsData(doc);
 if(!exact(doc,['format','version','exportedAt','value'])||doc.format!=='vertux.workspace-settings'||doc.version!==1)throw Error('WORKSPACE_FILE_VERSION');
 if(typeof doc.exportedAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(doc.exportedAt)||!Number.isFinite(Date.parse(doc.exportedAt))||new Date(doc.exportedAt).toISOString()!==doc.exportedAt)throw Error('WORKSPACE_FILE_DATE');
 return {...doc,value:validateWorkspaceFileValue(doc.value,contract)};
}
export function encodeWorkspaceSettingsFile(value,contract,exportedAt=new Date().toISOString()){
 const text=JSON.stringify({format:'vertux.workspace-settings',version:1,exportedAt,value:validateWorkspaceFileValue(value,contract)});
 decodeWorkspaceSettingsFile(text,contract);return text;
}
export function workspaceSettingsComparison(before,after,contract){
 before=validateWorkspaceFileValue(before,contract);after=validateWorkspaceFileValue(after,contract);
 const menuLabels=Object.fromEntries(contract.menu.map(m=>[m.id,m.label])),tasks=Object.fromEntries(TASK_SECTIONS.map(t=>[t.id,t.title]));
 const list=(value,labels,fallback='Нет')=>value?.length?value.map(id=>labels[id]).join(' → '):fallback;
 const specified=(p,key,text)=>Object.hasOwn(p,key)?text:'По умолчанию · '+text;
 const appearance=p=>({refreshStatus:p.refreshStatus===false?'Скрыт':'Показан',theme:specified(p,'theme',({invest:'Тёмная · Invest',graphite:'Графит',light:'Светлая'})[p.theme||'invest']),accent:specified(p,'accent',p.accent||'#865dff'),background:p.background||'Цвет выбранной темы',effects:specified(p,'effects',p.effects===false?'Выключены':'Включены'),compact:p.compact===undefined?'Автоматически':p.compact?'Компактное':'Развёрнутое'});
 const classic=p=>({order:specified(p,'order',list(p.order,menuLabels,'Стандартный порядок')),pinned:specified(p,'pinned',list(p.pinned,menuLabels)),hidden:specified(p,'hidden',list(p.hidden,menuLabels))});
 const task=p=>{const v=readTaskNavigation(p).state;return{source:p.taskNavigation?'Сохранённая настройка':'На основе прежнего меню',mode:v.mode==='tasks'?'По задачам · пять разделов':'Прежний список разделов',order:list(v.order,tasks),pinned:list(v.pinned,tasks),hidden:list(v.hidden,tasks),lastRoute:v.lastRoute?TASK_ROUTES[v.lastRoute].label:'Не выбран'};};
 const groups=[];
 function group(id,title,fields,left,right,rawLeft,rawRight){const rows=fields.map(([key,label])=>({label,before:left[key],after:right[key],changed:canonical(rawLeft?.[key])!==canonical(rawRight?.[key])||left[key]!==right[key]}));groups.push({id,title,changed:canonical(rawLeft)!==canonical(rawRight)||rows.some(r=>r.changed),rows});}
 const a=before.presentation,b=after.presentation,pick=(v,keys)=>Object.fromEntries(keys.filter(k=>Object.hasOwn(v,k)).map(k=>[k,v[k]]));
 group('appearance','Оформление',[['theme','Тема'],['accent','Акцент'],['background','Фон'],['effects','Подсветки и эффекты'],['refreshStatus','Статус обновления'],['compact','Размер бокового меню']],appearance(a),appearance(b),pick(a,['theme','accent','background','effects','refreshStatus','compact']),pick(b,['theme','accent','background','effects','refreshStatus','compact']));
 if(a.backgroundImage!==undefined||b.backgroundImage!==undefined){const image=p=>({image:p.backgroundImage?'Своё изображение':'Без изображения',shade:p.backgroundImage?p.backgroundImage.shade+'%':'По умолчанию'});group('background-image','Фоновое изображение',[['image','Изображение'],['shade','Затемнение']],image(a),image(b),a.backgroundImage,b.backgroundImage);}
 const light=p=>({style:({diffuse:'Рассеянный свет',full:'Вся карточка',corner:'Только угол',off:'Без подсветки'})[p.effects===false?'off':p.cardLight?.style||'full'],color:p.cardLight?.color||'Цвет акцента',intensity:(p.cardLight?.intensity??30)+'%'});
 if(a.cardLight!==undefined||b.cardLight!==undefined)group('card-light','Подсветка карточек',[['style','Стиль'],['color','Цвет'],['intensity','Интенсивность']],light(a),light(b),a.cardLight,b.cardLight);
 const panelNames=Object.fromEntries(PANEL_DEFINITIONS.map(([id,label])=>[id,label]));
 const placement=tree=>typeof tree==='string'?panelNames[tree]:tree?(tree.axis==='x'?'Слева':'Сверху')+' '+tree.ratio+'%: '+placement(tree.a)+'; '+(tree.axis==='x'?'справа':'снизу')+' '+(100-tree.ratio)+'%: '+placement(tree.b):'';
 const panels=p=>Object.fromEntries(PANEL_DEFINITIONS.map(([id])=>{const s=p.panelLayout?.[id];return[id,s?[(s.hidden?'Скрыт':'Показан'),s.width?'Ширина '+s.width+'%':'Ширина авто',s.height?'Высота от '+s.height+' px':'Высота авто',s.zone==='top'?'Над графиком':s.zone==='bottom'?'Под графиком':'',s.order===undefined?'':'Порядок '+(s.order+1),placement(s.dockTree)].filter(Boolean).join(' · '):'Исходное расположение'];}));
 if(a.panelLayout!==undefined||b.panelLayout!==undefined)group('panels','Расположение блоков',PANEL_DEFINITIONS.map(([id,label])=>[id,label]),panels(a),panels(b),a.panelLayout,b.panelLayout);
 group('classic','Прежнее меню',[['order','Заданный порядок разделов'],['pinned','Закреплены'],['hidden','Скрыты']],classic(a),classic(b),pick(a,['order','pinned','hidden']),pick(b,['order','pinned','hidden']));
 group('tasks','Навигация по задачам',[['source','Основа навигации'],['mode','Вид меню'],['order','Порядок групп'],['pinned','Закреплены'],['hidden','Скрыты'],['lastRoute','Последняя задача']],task(a),task(b),a.taskNavigation,b.taskNavigation);
 group('shortcuts','Горячие клавиши',contract.actions.map(row=>[row.id,row.label]),before.shortcuts,after.shortcuts,before.shortcuts,after.shortcuts);
 return{same:canonical(before)===canonical(after),groups};
}
