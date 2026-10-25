import {normalizeWatchPreferences,watchColumns,watchPreferencesByteLimit} from './terminal-watchlist-model.js';
import {normalizeTerminalSettingsValue} from './terminal-scoped-settings.js';
const fields=['logos','names','flash','columns','scope','sort','direction','lists'];
export const watchScopeLabels={portfolio:'В портфеле',all:'Все инструменты',favorites:'Избранное',share:'Акции',future:'Фьючерсы',currency:'Валюты',crypto:'Криптовалюты',bond:'Облигации',etf:'Фонды'};
export function validateWatchFileValue(input){
 const value=normalizeTerminalSettingsValue(input,normalizeWatchPreferences,watchPreferencesByteLimit);
 if(!input||Array.isArray(input)||Object.keys(input).length!==fields.length||!fields.every(k=>Object.hasOwn(input,k)))throw Error('Complete watch value required');
 const seen=new Set();for(const row of value.lists){
  if(Object.keys(row).sort().join(',')!=='id,ids,name'||!/^[a-z0-9-]{1,50}$/i.test(row.id)||seen.has(row.id)||!row.name.trim()||/[\x00-\x1f]/.test(row.name))throw Error('List identity');seen.add(row.id);
  if(!row.ids.every(id=>/^[A-Za-z0-9._:@/-]{1,128}$/.test(id)))throw Error('Instrument reference');
 }
 if(value.scope.startsWith('custom:')&&!seen.has(value.scope.slice(7)))throw Error('Selected list missing');
 return value;
}
export function watchScopeName(value){return watchScopeLabels[value.scope]||value.lists.find(r=>'custom:'+r.id===value.scope)?.name||'Список не выбран';}
export function watchDisplayChanges(before,after){
 const rows=[['logos','Логотипы',v=>v.logos?'Включены':'Выключены'],['names','Полные названия',v=>v.names?'Включены':'Выключены'],['flash','Окрашивание цены',v=>v.flash?'Включено':'Выключено'],['columns','Столбцы',v=>v.columns.map(k=>watchColumns[k]).join(', ')],['scope','Выбранный список',watchScopeName],['sort','Сортировка',v=>watchColumns[v.sort]],['direction','Порядок',v=>v.direction===1?'По возрастанию':'По убыванию']];
 return rows.filter(([key])=>JSON.stringify(before[key])!==JSON.stringify(after[key])).map(([key,label,format])=>({key,label,before:format(before),after:format(after)}));
}
