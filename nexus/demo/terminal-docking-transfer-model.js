import {dockLeaves,pruneDockTree,readDockingSettings} from './terminal-docking-model.js';
import {terminalIntervals} from './terminal-workspace-document.js';
import {resolution} from './chart-resolutions.js';
import {isWorldInstrument} from './world-market-catalog.js';

export const dockingFileLimit=256*1024;
export const dockingBlockNames={ticker:'Сводка инструмента',watch:'Котировки','panel:book':'Стакан','panel:tape':'Лента сделок','panel:plan':'Торговый план','panel:alerts':'Уведомления','panel:trade':'Заявка',context:'Анализ и данные'};
const clone=v=>JSON.parse(JSON.stringify(v)),exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
function guard(value){let count=0;const seen=new Set();function visit(v,depth){
 if(++count>2000||depth>22)throw Error('Docking limit');if(v===null||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v))return;if(typeof v==='string'&&v.length<=256)return;
 if(!v||typeof v!=='object'||seen.has(v)||![Object.prototype,Array.prototype,null].includes(Object.getPrototypeOf(v)))throw Error('Docking data');seen.add(v);
 for(const k of Reflect.ownKeys(v)){if(Array.isArray(v)&&k==='length')continue;const d=Object.getOwnPropertyDescriptor(v,k);if(typeof k!=='string'||['__proto__','prototype','constructor'].includes(k)||!d.enumerable||!Object.hasOwn(d,'value'))throw Error('Docking property');visit(d.value,depth+1);}seen.delete(v);
 }visit(value,0);if(new TextEncoder().encode(JSON.stringify(value)).length>dockingFileLimit)throw Error('Docking bytes');}
const dense=v=>Array.isArray(v)&&Array.from({length:v.length},(_,i)=>Object.hasOwn(v,i)).every(Boolean);
function validReference(v){return typeof v.instrumentUid==='string'&&(v.instrumentUid.startsWith('tv:')?isWorldInstrument(v):/^[A-Za-z0-9._:@/-]{1,128}$/.test(v.instrumentUid))&&typeof v.ticker==='string'&&v.ticker.length<=64&&!/[\x00-\x1f]/.test(v.ticker)&&terminalIntervals.includes(v.interval)&&(v.resolution===null||exact(v.resolution,['unit','count'])&&v.resolution.unit===resolution(v.resolution).unit&&v.resolution.count===resolution(v.resolution).count);}
export function validateDockingReferences(rows){guard(rows);if(!dense(rows)||rows.length>12||rows.some(r=>!exact(r,['id','revision','instrumentUid','ticker','interval','resolution'])||!/^chart-[a-zA-Z0-9_-]{1,64}$/.test(r.id)||!Number.isSafeInteger(r.revision)||r.revision<0||!validReference(r))||new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Docking references');return clone(rows);}
export function validateDockingLayout(value){
 guard(value);if(!exact(value,['tree','pins','charts'])||!dense(value.charts)||value.charts.length>12)throw Error('Docking layout');readDockingSettings(JSON.stringify({version:2,tree:value.tree,pins:value.pins}));
 const leaves=dockLeaves(value.tree).filter(k=>k.startsWith('chart:')).map(k=>k.slice(6));
 if(value.charts.length!==leaves.length||value.charts.some((r,i)=>!exact(r,['key','instrumentUid','ticker','interval','resolution'])||r.key!=='chart-'+(i+1)||leaves[i]!==r.key||!validReference(r)))throw Error('Docking chart links');return clone(value);
}
const remap=(tree,map)=>typeof tree==='string'?(tree.startsWith('chart:')?'chart:'+map.get(tree.slice(6)):tree):tree?{axis:tree.axis,ratio:tree.ratio,a:remap(tree.a,map),b:remap(tree.b,map)}:null;
export function portableDockingLayout(value,references){
 const refs=validateDockingReferences(references),saved=readDockingSettings(JSON.stringify(value));if(saved.version!==2)throw Error('Docking version');const known=new Map(refs.map(r=>[r.id,r]));
 const closed=dockLeaves(saved.tree).filter(k=>k.startsWith('chart:')&&!known.has(k.slice(6))),tree=pruneDockTree(saved.tree,k=>!k.startsWith('chart:')||known.has(k.slice(6))),ids=dockLeaves(tree).filter(k=>k.startsWith('chart:')).map(k=>k.slice(6)),aliases=new Map(ids.map((id,i)=>[id,'chart-'+(i+1)]));
 return {value:validateDockingLayout({tree:remap(tree,aliases),pins:saved.pins,charts:ids.map(id=>{const {instrumentUid,ticker,interval,resolution}=known.get(id);return {key:aliases.get(id),instrumentUid,ticker,interval,resolution};})}),omittedChartPositions:closed.length};
}
export function encodeDockingLayout(value,references,exportedAt=new Date().toISOString()){const portable=portableDockingLayout(value,references),text=JSON.stringify({format:'vertux.terminal-docking',version:1,exportedAt,layout:portable.value});decodeDockingLayout(text);return {text,omittedChartPositions:portable.omittedChartPositions};}
export function decodeDockingLayout(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>dockingFileLimit)throw Error('Docking file limit');const doc=JSON.parse(text);guard(doc);if(!exact(doc,['format','version','exportedAt','layout'])||doc.format!=='vertux.terminal-docking'||doc.version!==1||typeof doc.exportedAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(doc.exportedAt)||new Date(doc.exportedAt).toISOString()!==doc.exportedAt)throw Error('Docking file version');return {...doc,layout:validateDockingLayout(doc.layout)};}
export function mapDockingLayout(value,mapping,references){const valid=validateDockingLayout(value),refs=validateDockingReferences(references);guard(mapping);const keys=valid.charts.map(r=>r.key);if(!exact(mapping,keys)||new Set(Object.values(mapping)).size!==keys.length||Object.values(mapping).some(id=>!refs.some(r=>r.id===id)))throw Error('Choose distinct current charts');return readDockingSettings(JSON.stringify({version:2,tree:remap(valid.tree,new Map(Object.entries(mapping))),pins:valid.pins}));}
export function dockingPositions(tree,path=[]){if(typeof tree==='string')return [{key:tree,path:path.join(' → ')||'Вся область'}];if(!tree)return [];return [...dockingPositions(tree.a,[...path,(tree.axis==='x'?'Слева':'Сверху')+' '+Math.round(tree.ratio*100)+'%']),...dockingPositions(tree.b,[...path,(tree.axis==='x'?'Справа':'Снизу')+' '+Math.round((1-tree.ratio)*100)+'%'])];}
