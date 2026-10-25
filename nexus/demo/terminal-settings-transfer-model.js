import {validateWatchFileValue} from './terminal-watch-transfer-model.js';
import {watchPreferencesByteLimit} from './terminal-watchlist-model.js';
import {normalizeChartPreferences} from './chart-preferences-model.js';
import {normalizeTerminalCustomization} from './terminal-customization-model.js';
import {normalizeTerminalSettingsValue} from './terminal-scoped-settings.js';

export const terminalSettingsFileLimit=512*1024;
export const terminalSettingsKinds={customization:'сводки и панелей','chart-preferences':'инструментов рисования','watch-preferences':'списков наблюдения'};
const normalizers={customization:normalizeTerminalCustomization,'chart-preferences':normalizeChartPreferences};
export const terminalSettingsFileLimitFor=kind=>kind==='watch-preferences'?4*1024*1024:terminalSettingsFileLimit;
const bytes=text=>new TextEncoder().encode(text).length;
const labels={logos:'Логотипы',names:'Полные названия',flash:'Окрашивание цены',columns:'Столбцы таблицы',scope:'Выбранный список',sort:'Сортировка',direction:'Порядок',lists:'Личные списки',widthPercent:'Ширина сводки, %',positionPercent:'Отступ сводки, %',position:'Положение сводки',width:'Ширина сводки',visible:'Видимость сводки',locked:'Закрепление блоков',tickerEdge:'Край сводки',palette:'Панель рисования',controls:'Панель интервалов',fields:'Поля сводки',favorites:'Избранные инструменты',tools:'Инструменты по умолчанию',rememberTool:'Запоминание инструмента',rememberStyle:'Запоминание стиля',styles:'Стили новых рисунков',colors:'Цвета новых графиков',instruments:'Цвета отдельных инструментов'};
function valueFor(kind,input){
 if(kind!=='watch-preferences'&&!Object.hasOwn(normalizers,kind))throw Error('Unsupported settings kind');
 const value=kind==='watch-preferences'?validateWatchFileValue(input):normalizeTerminalSettingsValue(input,normalizers[kind]);
 if(bytes(JSON.stringify({version:1,kind,value}))>(kind==='watch-preferences'?watchPreferencesByteLimit:256*1024))throw Error('Settings limit');
 return value;
}
export function encodeTerminalSettings(kind,input,exportedAt=new Date().toISOString()){
 const text=JSON.stringify({format:'vertux.terminal-settings',version:1,kind,exportedAt,value:valueFor(kind,input)});
 decodeTerminalSettings(text,kind);return text;
}
export function decodeTerminalSettings(text,expectedKind){
 if(typeof text!=='string'||bytes(text)>terminalSettingsFileLimitFor(expectedKind))throw Error('File limit');
 const doc=JSON.parse(text);
 if(!doc||Array.isArray(doc)||Object.keys(doc).sort().join(',')!=='exportedAt,format,kind,value,version'||doc.format!=='vertux.terminal-settings'||doc.version!==1||doc.kind!==expectedKind)throw Error('Unsupported settings file');
 if(typeof doc.exportedAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(doc.exportedAt)||!Number.isFinite(Date.parse(doc.exportedAt))||new Date(doc.exportedAt).toISOString()!==doc.exportedAt)throw Error('Invalid date');
 return {...doc,value:valueFor(doc.kind,doc.value)};
}
const canonical=value=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export function terminalSettingsChanges(kind,before,after){
 before=valueFor(kind,before);after=valueFor(kind,after);
 return Object.keys(after).filter(key=>canonical(before[key])!==canonical(after[key])).map(key=>({key,label:labels[key],before:before[key],after:after[key]}));
}
