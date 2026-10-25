import {indicatorCatalog} from './chart-indicators.js';
import {drawingGroups,drawingTypes,drawingStyle} from './chart-tool-catalog.js';
const record=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
export const chartColorLabels={up:'Растущие свечи',down:'Падающие свечи',line:'Линия и область',background:'Фон графика',grid:'Сетка'};
export const defaultChartColors={up:'#089981',down:'#f23645',line:'#b9a9ff',background:'#0e141c',grid:'#202a36'};
export function normalizeChartColors(value){return Object.fromEntries(Object.keys(chartColorLabels).filter(k=>/^#[0-9a-f]{6}$/i.test(value?.[k]||'')).map(k=>[k,value[k].toLowerCase()]));}
export function normalizeChartPreferences(value={}){
 value=record(value);const tools=record(value.tools),styles=record(value.styles);
 return {favorites:{tools:[...new Set(Array.isArray(value.favorites?.tools)?value.favorites.tools:[])].filter(t=>drawingTypes.includes(t)).slice(0,80),indicators:[...new Set(Array.isArray(value.favorites?.indicators)?value.favorites.indicators:[])].filter(t=>indicatorCatalog.some(d=>d.type===t)).slice(0,80)},tools:Object.fromEntries(drawingGroups.map(g=>[g.id,g.tools.some(([t])=>t===tools[g.id])?tools[g.id]:g.tools[0][0]])),rememberTool:value.rememberTool!==false,rememberStyle:value.rememberStyle!==false,
  styles:Object.fromEntries(drawingTypes.filter(t=>Object.hasOwn(styles,t)).map(t=>[t,drawingStyle(styles[t],t)])),colors:normalizeChartColors(value.colors),
  instruments:Object.fromEntries(Object.entries(record(value.instruments)).filter(([k])=>k.length<=128&&!['__proto__','constructor','prototype'].includes(k)).slice(-80).map(([k,v])=>[k,normalizeChartColors(v)]))};
}
