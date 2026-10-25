import {validTerminalDocument,validTerminalData} from './terminal-workspace-document.js';
import {drawingStyle,drawingPointCount} from './chart-tool-catalog.js';
import {normalizeStudy,indicatorCatalog} from './chart-indicators.js';
import {normalizeSeriesOptions} from './chart-series-model.js';
import {resolution,validTimezone} from './chart-resolutions.js';
export const terminalWorkspaceFileLimit=10*1024*1024;
const clone=v=>JSON.parse(JSON.stringify(v)),record=v=>v&&typeof v==='object'&&!Array.isArray(v);
const keys=(v,allowed,required=[])=>record(v)&&Object.keys(v).every(k=>allowed.includes(k))&&required.every(k=>Object.hasOwn(v,k));
const exact=(v,fields)=>keys(v,fields,fields),bytes=v=>new TextEncoder().encode(v).length;
const same=(a,b)=>a===b||(typeof a==='string'&&/^#[a-f\d]{6}$/i.test(a)&&a.toLowerCase()===b?.toLowerCase())||(Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>same(v,b[i])))||(record(a)&&record(b)&&Object.keys(a).every(k=>Object.hasOwn(b,k)&&same(a[k],b[k])));
function guard(value){let nodes=0;const seen=new Set();function visit(v,depth){
 if(++nodes>600000||depth>12)throw Error('Workspace limit');if(v===null||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v))return;if(typeof v==='string'&&v.length<=220000)return;
 if(!v||typeof v!=='object'||seen.has(v)||![Object.prototype,Array.prototype,null].includes(Object.getPrototypeOf(v)))throw Error('Workspace data');seen.add(v);
 for(const [k,d]of Object.entries(Object.getOwnPropertyDescriptors(v))){if(Array.isArray(v)&&k==='length')continue;if(!Object.hasOwn(d,'value')||!d.enumerable||['__proto__','prototype','constructor'].includes(k))throw Error('Workspace property');visit(d.value,depth+1);}seen.delete(v);
 }visit(value,0);}
const color=v=>typeof v==='string'&&/^#[a-f\d]{6}$/i.test(v);
function chart(value){
 const fields=['instrumentUid','ticker','interval','resolution','historyDate','note','plans','plan','view','comparisons','chartSource'];
 if(!keys(value,fields)||!validTerminalData(value)||!validTerminalDocument('chart-file',value)||JSON.stringify(value).length>220000)throw Error('Chart schema');
 const view=value.view;if(!keys(view,['type','seriesOptions','timezone','dividendAdjusted','scaleMode','inverted','colors','magnet','drawingsHidden','indicators','studies','drawings','range','flash']))throw Error('View schema');
 if(value.resolution&&(!exact(value.resolution,['unit','count'])||!same(value.resolution,resolution(value.resolution))))throw Error('Resolution');
 if(value.historyDate!=null&&new Date(value.historyDate).toISOString().slice(0,10)!==value.historyDate)throw Error('History date');
 for(const name of ['dividendAdjusted','inverted','magnet','drawingsHidden','flash'])if(Object.hasOwn(view,name)&&typeof view[name]!=='boolean')throw Error('View flag');
 if(view.timezone!==undefined&&validTimezone(view.timezone)!==view.timezone)throw Error('Timezone');
 if(view.scaleMode!==undefined&&!['normal','log','percent','indexed'].includes(view.scaleMode))throw Error('Scale');
 if(view.colors!==undefined&&(!keys(view.colors,['up','down','line','background','grid'])||!Object.values(view.colors).every(color)))throw Error('Colors');
 if(!Object.entries(view.indicators).every(([key,value])=>(key==='volume'||indicatorCatalog.some(d=>d.type===key))&&typeof value==='boolean'))throw Error('Indicator');
 if(view.seriesOptions!==undefined&&(!keys(view.seriesOptions,['boxSize','reversal'])||!same(view.seriesOptions,normalizeSeriesOptions(view.seriesOptions))))throw Error('Series');
 if(view.range!=null&&(!exact(view.range,['from','to'])||!Number.isFinite(view.range.from)||!Number.isFinite(view.range.to)||view.range.from>view.range.to))throw Error('Range');
 for(const study of view.studies||[])if(!same(study,normalizeStudy(study)))throw Error('Study');
 const ids=new Set();for(const d of view.drawings){if(!keys(d,['id','type','points','style','text','locked','hidden','name'])||ids.has(d.id)||d.points.length<drawingPointCount(d.type)||!d.points.every(p=>exact(p,['time','price'])))throw Error('Drawing');ids.add(d.id);if(d.style&&!same(d.style,drawingStyle(d.style,d.type)))throw Error('Drawing style');for(const key of ['locked','hidden'])if(Object.hasOwn(d,key)&&typeof d[key]!=='boolean')throw Error('Drawing flag');for(const key of ['text','name'])if(Object.hasOwn(d,key)&&typeof d[key]!=='string')throw Error('Drawing text');}
 const planFields=['action','entry','stop','target','quantity','note','name'];for(const plan of [...value.plans,...(value.plan===null?[]:[value.plan])])if(!keys(plan,planFields)||!Object.entries(plan).every(([k,v])=>typeof v==='string'&&(k!=='action'||['buy','sell'].includes(v))))throw Error('Plan');
 const compared=new Set();for(const c of value.comparisons||[]){if(!keys(c,['instrumentUid','ticker','color','visible'],['instrumentUid','ticker'])||compared.has(c.instrumentUid)||c.color!==undefined&&!color(c.color)||c.visible!==undefined&&typeof c.visible!=='boolean')throw Error('Comparison');compared.add(c.instrumentUid);}
 return value;
}
export function validateTerminalWorkspace(workspace){
 guard(workspace);if(!exact(workspace,['layout','charts'])||!Array.isArray(workspace.charts)||workspace.charts.length>12)throw Error('Workspace schema');
 const layout=workspace.layout;
 if(!keys(layout,['tabs','active','visibleTabs','count','panelsVersion','auxiliary','watchCollapsed','sideCollapsed','dockCollapsed','dock','side','linkPeriod','linkCursor','radar','radarSaved','taskPreset','activity'])||!validTerminalData(layout)||!validTerminalDocument('layout',layout))throw Error('Layout');
 if(!exact(layout.radar,['change','volume','distance'])||!layout.radarSaved.every(r=>exact(r,['name','filter'])&&exact(r.filter,['change','volume','distance'])))throw Error('Radar');
 if(workspace.charts.length!==layout.tabs.length||!workspace.charts.every((c,i)=>exact(c,['key','value'])&&c.key===layout.tabs[i]&&chart(c.value)))throw Error('Chart links');
 return clone(workspace);
}
export function portableTerminalWorkspace(workspace){
 const valid=validateTerminalWorkspace(workspace),aliases=new Map(valid.layout.tabs.map((k,i)=>[k,'chart-'+(i+1)]));
 valid.layout.tabs=valid.layout.tabs.map(k=>aliases.get(k));valid.layout.active=valid.layout.active?aliases.get(valid.layout.active):'';if(valid.layout.visibleTabs)valid.layout.visibleTabs=valid.layout.visibleTabs.map(k=>aliases.get(k));valid.charts=valid.charts.map(c=>({key:aliases.get(c.key),value:c.value}));return valid;
}
export function encodeTerminalWorkspace(workspace,exportedAt=new Date().toISOString()){
 const text=JSON.stringify({format:'vertux.terminal-workspace',version:1,exportedAt,workspace:portableTerminalWorkspace(workspace)});decodeTerminalWorkspace(text);return text;
}
export function decodeTerminalWorkspace(text){
 if(typeof text!=='string'||bytes(text)>terminalWorkspaceFileLimit)throw Error('File limit');const doc=JSON.parse(text);
 if(!exact(doc,['format','version','exportedAt','workspace'])||doc.format!=='vertux.terminal-workspace'||doc.version!==1||typeof doc.exportedAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(doc.exportedAt)||new Date(doc.exportedAt).toISOString()!==doc.exportedAt)throw Error('File version');
 const workspace=validateTerminalWorkspace(doc.workspace);if(!workspace.layout.tabs.every((k,i)=>k==='chart-'+(i+1)))throw Error('File aliases');return {...doc,workspace};
}
