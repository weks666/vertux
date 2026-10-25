import {validChartTypes} from './chart-series-model.js';
import {drawingTypes} from './chart-tool-catalog.js';
import {validTerminalPresetLayout} from './terminal-task-presets.js';
import {isWorldInstrument} from './world-market-catalog.js';
export const terminalIntervals=['CANDLE_INTERVAL_1_MIN','CANDLE_INTERVAL_5_MIN','CANDLE_INTERVAL_15_MIN','CANDLE_INTERVAL_HOUR','CANDLE_INTERVAL_4_HOUR','CANDLE_INTERVAL_DAY','CANDLE_INTERVAL_WEEK','CANDLE_INTERVAL_MONTH'];
const safeKey = /^(?:layout|chart-[a-zA-Z0-9_-]{1,64})$/;
const chartKey=value=>typeof value==='string'&&safeKey.test(value)&&value!=='layout';
const isRecord=value=>value&&typeof value==='object'&&!Array.isArray(value);
export function validTerminalDocument(key,value) {
 if(!isRecord(value))return false;
 if(key==='layout')return validTerminalPresetLayout(value)&&Array.isArray(value.tabs)&&value.tabs.length<=12&&value.tabs.every(chartKey)
  &&new Set(value.tabs).size===value.tabs.length&&[1,2,4].includes(value.count)
  &&(value.visibleTabs===undefined||Array.isArray(value.visibleTabs)&&value.visibleTabs.length<=4&&new Set(value.visibleTabs).size===value.visibleTabs.length&&value.visibleTabs.every(id=>value.tabs.includes(id)))
  &&(value.active===''||value.tabs.includes(value.active))&&['stats','book','tape','participants','events','radar'].includes(value.dock)
  &&['watchCollapsed','sideCollapsed','dockCollapsed','linkPeriod','linkCursor'].every(k=>typeof value[k]==='boolean')
  &&(value.side===undefined||['market','plan','alerts'].includes(value.side))
  &&(value.panelsVersion===undefined||value.panelsVersion===2)
  &&(value.auxiliary===undefined||['','watch','book','tape','plan','alerts','trade'].includes(value.auxiliary))
  &&(value.activity===undefined||isRecord(value.activity)&&Object.keys(value.activity).length===2&&[10,20].includes(value.activity.depth)&&Number.isSafeInteger(value.activity.tapeMinimum)&&value.activity.tapeMinimum>=0&&value.activity.tapeMinimum<=1000000000)
  &&isRecord(value.radar)&&['change','volume','distance'].every(k=>Number.isFinite(value.radar[k])&&value.radar[k]>=0)
  &&Array.isArray(value.radarSaved)&&value.radarSaved.length<=10&&value.radarSaved.every(r=>typeof r.name==='string'&&isRecord(r.filter)&&['change','volume','distance'].every(k=>Number.isFinite(r.filter[k])&&r.filter[k]>=0));
 return typeof value.instrumentUid==='string'&&value.instrumentUid.length>0&&value.instrumentUid.length<=128
  &&(!value.instrumentUid.startsWith('tv:')||isWorldInstrument(value))
  &&typeof value.ticker==='string'&&value.ticker.length<=64&&terminalIntervals.includes(value.interval)
  &&(value.chartSource===undefined||['tradingview','native'].includes(value.chartSource))
  &&isRecord(value.view)&&validChartTypes.includes(value.view.type)&&isRecord(value.view.indicators)
  &&Array.isArray(value.view.drawings)&&value.view.drawings.length<=80&&value.view.drawings.every(d=>isRecord(d)&&typeof d.id==='string'&&d.id.length<=80&&drawingTypes.includes(d.type)&&Array.isArray(d.points)&&d.points.length>0&&d.points.length<=500&&d.points.every(p=>Number.isFinite(p.time)&&Number.isFinite(p.price)))
  &&(value.view.studies===undefined||Array.isArray(value.view.studies)&&value.view.studies.length<=24)
  &&(value.comparisons===undefined||Array.isArray(value.comparisons)&&value.comparisons.length<=5&&value.comparisons.every(m=>isRecord(m)&&typeof m.instrumentUid==='string'&&/^[A-Za-z0-9._:@/-]{1,160}$/.test(m.instrumentUid)&&typeof m.ticker==='string'))
  &&(value.historyDate===undefined||value.historyDate===null||typeof value.historyDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value.historyDate))
  &&typeof value.note==='string'&&Array.isArray(value.plans)&&value.plans.length<=12&&(value.plan===null||isRecord(value.plan));
}
// Small JSON documents only. No paths, remote URLs, credentials or executable content.
export function validTerminalData(value, depth = 0) {
 if (depth > 8) return false;
 if (value === null || typeof value === 'boolean') return true;
 if (typeof value === 'number') return Number.isFinite(value) && Math.abs(value) <= 1e18;
 if (typeof value === 'string') return value.length <= 2000 && !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value);
 if (Array.isArray(value)) return value.length <= 600 && value.every(item => validTerminalData(item, depth + 1));
 return value && typeof value === 'object' && Object.keys(value).length <= 40
  && Object.entries(value).every(([key,item]) => /^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(key)
   && !['__proto__','constructor','prototype','token','password','secret','url'].includes(key) && validTerminalData(item,depth + 1));
}
