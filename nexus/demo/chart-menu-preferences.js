import {resolution,resolutionGroups,resolutionKey,baseInterval} from './chart-resolutions.js';
import {validChartTypes} from './chart-series-model.js';
export const defaultQuickIntervals=['minutes:1','minutes:5','minutes:15','hours:1','hours:4','days:1','weeks:1','months:1'];
export function normalizeChartMenuPreferences(value={}){
 const defaults={intervals:[...defaultQuickIntervals],types:['candles','line'],custom:[],collapsed:['ticks','seconds']};
 if(!value||typeof value!=='object'||Array.isArray(value))return defaults;
 const validKey=key=>{if(typeof key!=='string')return false;const [unit,count]=key.split(':'),r=resolution({unit,count});return r&&resolutionKey(r)===key&&baseInterval(r);};
 return {intervals:Array.isArray(value.intervals)?[...new Set(value.intervals.filter(validKey))].slice(0,30):defaults.intervals,
  types:Array.isArray(value.types)?[...new Set(value.types.filter(id=>validChartTypes.includes(id)))].slice(0,30):defaults.types,
  custom:Array.isArray(value.custom)?value.custom.map(resolution).filter(r=>r&&baseInterval(r)).slice(0,30):[],
  collapsed:Array.isArray(value.collapsed)?[...new Set(value.collapsed.filter(unit=>resolutionGroups.some(g=>g[0]===unit)))]:defaults.collapsed};
}
