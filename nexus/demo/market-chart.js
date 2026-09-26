import {normalizeMarketCandles,formatMarketTick} from './charts.js';
import {calculateStudy,indicatorCatalog,normalizeStudy} from './chart-indicators.js';
import {normalizeChartColors} from './chart-preferences.js';
import {createDrawingLayer} from './chart-drawings.js';
const up='#5ed0a0',down='#ef7b76';
export function createMarketChart(host,candles,{onCrosshair,onState,onMode,onRange,onHistory,onDrawingSelect,onReplay,getDrawingDefaults,onDrawingStyle}={}) {
 const api=globalThis.LightweightCharts;let rows=normalizeMarketCandles(candles);
 if(!api||!host||!rows.length)return null;
 const chart=api.createChart(host,{width:host.clientWidth||480,height:host.clientHeight||480,
  layout:{background:{type:'solid',color:'#0d141e'},textColor:'#9daeca',fontFamily:'Rubik,system-ui,sans-serif',fontSize:11,attributionLogo:false,panes:{separatorColor:'#233044',separatorHoverColor:'#7358ae'}},
  grid:{vertLines:{color:'#95accc0b'},horzLines:{color:'#95accc16'}},rightPriceScale:{borderColor:'#95accc20',minimumWidth:62},
  timeScale:{timeVisible:true,secondsVisible:false,tickMarkFormatter:formatMarketTick,fixLeftEdge:false,fixRightEdge:false,rightOffset:6,minBarSpacing:.001,borderColor:'#95accc20'},
  localization:{locale:'ru-RU',timeFormatter:time=>new Date(time*1000).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})},
  crosshair:{mode:api.CrosshairMode.Normal,vertLine:{color:'#b9a9ff80',labelBackgroundColor:'#493678'},horzLine:{color:'#b9a9ff80',labelBackgroundColor:'#493678'}}});
 const prices={candles:chart.addSeries(api.CandlestickSeries,{upColor:up,downColor:down,borderVisible:false,wickUpColor:up,wickDownColor:down}),
  bars:chart.addSeries(api.BarSeries,{upColor:up,downColor:down,visible:false}),
  line:chart.addSeries(api.LineSeries,{color:'#a98bff',lineWidth:2,visible:false}),
  area:chart.addSeries(api.AreaSeries,{lineColor:'#a98bff',topColor:'#8966ff38',bottomColor:'#8966ff02',lineWidth:2,visible:false})};
 const volume=chart.addSeries(api.HistogramSeries,{priceFormat:{type:'volume'},priceScaleId:'volume',priceLineVisible:false,lastValueVisible:false});
 volume.priceScale().applyOptions({scaleMargins:{top:.84,bottom:0},visible:false});
 for(const series of Object.values(prices))series.priceScale().applyOptions({scaleMargins:{top:.08,bottom:.2}});
 const indicators={},enabled={volume:true},comparisons=new Map();let studies=[],type='candles',scaleMode='normal',inverted=false,flash=false,pulseTimer=null,syncing=false,dead=false,applying=false,historyFrame=0;
 let resizeDrawFrame=0;let colors={},sourceRows=rows,replay=null,replayTimer=null,replaySpeed=1;
 const price=()=>prices[type],positive=()=>colors.up||getComputedStyle(host).getPropertyValue('--positive').trim()||up,negative=()=>colors.down||getComputedStyle(host).getPropertyValue('--negative').trim()||down;
 const drawing=createDrawingLayer({host,chart,getSeries:price,getRows:()=>rows,onChange:()=>onState?.(getState()),onMode,onSelect:onDrawingSelect,getDefaults:getDrawingDefaults,onStyle:onDrawingStyle});
 function updateIndicators(incremental=false){for(const study of studies.filter(s=>s.visible)){
  const outputs=calculateStudy(rows,study);let list=indicators[study.id];
  if(!list){const pane=indicatorCatalog.find(d=>d.type===study.type).placement==='pane'?chart.panes().length:0;
   list=indicators[study.id]=outputs.map(output=>chart.addSeries(output.histogram?api.HistogramSeries:api.LineSeries,{color:output.color||study.color,lineWidth:1,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false},pane));
   if(pane){chart.panes()[0]?.setStretchFactor(1);chart.panes()[pane]?.setStretchFactor(.35);chart.panes()[pane]?.priceScale('right').applyOptions({minimumWidth:72});}
  }
  outputs.forEach((output,i)=>{
   if(incremental){const last=output.data.at(-1);list[i].update(last?.time===rows.at(-1).time?last:{time:rows.at(-1).time});}
   else{const values=new Map(output.data.map(r=>[r.time,r]));list[i].setData(rows.map(r=>values.get(r.time)||{time:r.time}));}
  });
 }}
 function rebuildStudies(){for(const list of Object.values(indicators))for(const series of list)chart.removeSeries(series);for(const key of Object.keys(indicators))delete indicators[key];updateIndicators();drawing.refresh();}
 function updateComparisons(){for(const value of comparisons.values()){
  const other=value.closes??=new Map(value.rows.map(r=>[r.time,r.close]));const anchor=rows.find(r=>other.has(r.time)&&r.close>0&&other.get(r.time)>0);
  value.anchor=anchor?{time:anchor.time,close:anchor.close}:null;
  value.series.setData(anchor?value.rows.filter(r=>r.time<=rows.at(-1).time).map(r=>({time:r.time,value:r.close/other.get(anchor.time)*anchor.close})):[]);
 }applyScale();}
 function applyScale(){chart.priceScale('right').applyOptions({mode:comparisons.size?api.PriceScaleMode.Percentage:({normal:0,log:1,percent:2,indexed:3})[scaleMode],invertScale:inverted,autoScale:true});drawing.refresh();}
 function paintVolume(){const rise=positive()+'45',fall=negative()+'45';volume.setData(rows.map(r=>({time:r.time,value:r.volume,color:r.close>=r.open?rise:fall})));}
 function fill(){const bars=rows.map(({time,open,high,low,close})=>({time,open,high,low,close}));prices.candles.setData(bars);prices.bars.setData(bars);
  for(const series of[prices.line,prices.area])series.setData(rows.map(r=>({time:r.time,value:r.close})));
  paintVolume();updateIndicators();updateComparisons();drawing.refresh();}
 function pulse(previous){if(document.documentElement.dataset?.visualEffects==='off'||host.closest?.('.terminal-workbench'))return;if(!flash||previous===undefined||previous===rows.at(-1).close)return;
  const direction=rows.at(-1).close>previous?'up':'down';host.dataset.priceDirection=direction;clearTimeout(pulseTimer);
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches){prices.line.applyOptions({color:direction==='up'?up:down});prices.area.applyOptions({lineColor:direction==='up'?up:down});}
  pulseTimer=setTimeout(()=>{delete host.dataset.priceDirection;prices.line.applyOptions({color:'#a98bff'});prices.area.applyOptions({lineColor:'#a98bff'});},700);
 }
 function setData(value){if(replay)return;const next=normalizeMarketCandles(value);if(!next.length)return;const previous=rows.at(-1)?.close,range=chart.timeScale().getVisibleLogicalRange(),first=rows[0].time,added=next.filter(r=>r.time<first).length;applying=true;try{rows=next;sourceRows=rows;fill();if(range)chart.timeScale().setVisibleLogicalRange({from:range.from+added,to:range.to+added});}finally{applying=false;}pulse(previous);}
 function getState(){return {type,scaleMode,inverted,colors:{...colors},magnet:drawing.isMagnet(),drawingsHidden:drawing.isHidden(),indicators:Object.fromEntries(Object.entries(enabled).filter(([name,visible])=>name==='volume'||visible)),studies:studies.map(s=>({...s})),drawings:drawing.getState(),range:replay?replay.range:chart.timeScale().getVisibleRange(),flash};}
 function toggle(name,visible){if(name==='volume'){enabled.volume=visible;volume.applyOptions({visible});}
  else if(indicatorCatalog.some(d=>d.type===name)){enabled[name]=visible;studies=studies.filter(s=>s.id!==name);if(visible)studies.push(normalizeStudy({type:name}));rebuildStudies();}
  onState?.(getState());}
 const rangeChanged=()=>{drawing.refresh();if(!syncing&&!applying){onRange?.(chart.timeScale().getVisibleRange());onState?.(getState());}cancelAnimationFrame(historyFrame);historyFrame=requestAnimationFrame(()=>{if(dead||syncing||applying||replay)return;const range=chart.timeScale().getVisibleLogicalRange();if(range&&range.from<15)onHistory?.();});};
 const cross=param=>{onCrosshair?.(rows.find(r=>r.time===param.time)||null);drawing.refresh();};
 chart.subscribeCrosshairMove(cross);chart.timeScale().subscribeVisibleLogicalRangeChange(rangeChanged);
 const resize=new ResizeObserver(()=>{if(dead||!host.clientWidth||!host.clientHeight)return;const range=chart.timeScale().getVisibleLogicalRange();applying=true;try{chart.applyOptions({width:host.clientWidth,height:host.clientHeight});if(range)chart.timeScale().setVisibleLogicalRange(range);}finally{applying=false;}drawing.refresh();cancelAnimationFrame(resizeDrawFrame);resizeDrawFrame=requestAnimationFrame(()=>{resizeDrawFrame=0;if(!dead)drawing.refresh();});});resize.observe(host);
 function theme(){const css=getComputedStyle(host),value=(name,fallback)=>css.getPropertyValue(name).trim()||fallback,bg=colors.background||value('--chart-bg','#0d141e'),brightness=colors.background?(parseInt(bg.slice(1,3),16)*.2126+parseInt(bg.slice(3,5),16)*.7152+parseInt(bg.slice(5,7),16)*.0722):null,text=brightness===null?value('--muted','#9daeca'):brightness>155?'#263244':'#adbbcc',accent=colors.line||value('--vertux-soft','#b9a9ff'),grid=colors.grid||value('--chart-line','#233044');
  chart.applyOptions({layout:{background:{type:'solid',color:bg},textColor:text,panes:{separatorColor:grid,separatorHoverColor:accent}},grid:{vertLines:{color:grid},horzLines:{color:grid}},crosshair:{vertLine:{color:accent,labelBackgroundColor:value('--action-fill','#493678')},horzLine:{color:accent,labelBackgroundColor:value('--action-fill','#493678')}}});
  prices.line.applyOptions({color:accent});prices.area.applyOptions({lineColor:accent,topColor:accent+'38',bottomColor:accent+'02'});prices.candles.applyOptions({upColor:positive(),downColor:negative(),wickUpColor:positive(),wickDownColor:negative()});prices.bars.applyOptions({upColor:positive(),downColor:negative()});paintVolume();
 }
 const getReplay=()=>replay?{active:true,index:replay.index,total:sourceRows.length,time:rows.at(-1)?.time,playing:!!replayTimer,speed:replaySpeed}:{active:false};
 function notifyReplay(){onReplay?.(getReplay());}
 function pauseReplay(){clearInterval(replayTimer);replayTimer=null;notifyReplay();}
 function paintReplay(){if(!replay)return;applying=true;try{rows=sourceRows.slice(0,replay.index+1);fill();chart.timeScale().setVisibleLogicalRange({from:Math.max(0,replay.index-80),to:replay.index+5});}finally{applying=false;}notifyReplay();}
 function stepReplay(delta=1){if(!replay)return;replay.index=Math.max(0,Math.min(sourceRows.length-1,replay.index+delta));if(replay.index===sourceRows.length-1)pauseReplay();paintReplay();}
 function playReplay(){if(!replay||replay.index>=sourceRows.length-1)return;clearInterval(replayTimer);replayTimer=setInterval(()=>stepReplay(1),1000/replaySpeed);notifyReplay();}
 function stopReplay(){if(!replay)return;const range=replay.range;pauseReplay();replay=null;applying=true;try{rows=sourceRows;fill();if(range)chart.timeScale().setVisibleRange(range);else chart.timeScale().fitContent();}finally{applying=false;}notifyReplay();}
 function startReplay(time){if(!Number.isFinite(time))return false;const data=replay?sourceRows:rows,index=data.findIndex(r=>r.time>=time);if(index<0||time<data[0].time)return false;const range=replay?.range||chart.timeScale().getVisibleRange();pauseReplay();sourceRows=data;replay={index,range};paintReplay();return true;}
 function setReplaySpeed(value){if(![.5,1,2,5,10].includes(value))return;replaySpeed=value;if(replayTimer)playReplay();else notifyReplay();}

 const themeObserver=new MutationObserver(theme);themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['style','data-workspace-theme']});
 fill();theme();chart.timeScale().fitContent();
 return {chart,drawings:drawing,getState,getRows:()=>rows.slice(),getSeries:price,setData,
  updateCandle(value){if(replay)return rows.slice();const row=normalizeMarketCandles([value])[0];if(!row||row.interval&&rows.at(-1)?.interval&&row.interval!==rows.at(-1).interval||row.time<rows.at(-1).time)return;
   const last=rows.at(-1);
   if(row.instrumentUid&&last.instrumentUid&&row.instrumentUid!==last.instrumentUid)return;
   if(row.time===last.time&&Date.parse(row.capturedAt||'')<Date.parse(last.capturedAt||''))return;
   const previous=last.close;if(row.time===last.time)rows[rows.length-1]=row;else rows.push(row);
   // Keep price/history series incremental. A comparison only needs rebuilding
   // when the first shared candle appears or its anchor price is corrected.
   const bar={time:row.time,open:row.open,high:row.high,low:row.low,close:row.close};
   prices.candles.update(bar);prices.bars.update(bar);
   for(const series of[prices.line,prices.area])series.update({time:row.time,value:row.close});
   volume.update({time:row.time,value:row.volume,color:row.close>=row.open?positive()+'45':negative()+'45'});
   updateIndicators(true);
   if([...comparisons.values()].some(value=>value.anchor?value.anchor.time===row.time&&value.anchor.close!==row.close:row.close>0&&value.closes.get(row.time)>0))updateComparisons();
   drawing.refresh();pulse(previous);return rows.slice();},
  toggle,setStudies(values){studies=(Array.isArray(values)?values:[]).slice(0,24).map(normalizeStudy).filter(Boolean);for(const d of indicatorCatalog)enabled[d.type]=studies.some(s=>s.type===d.type&&s.visible);rebuildStudies();onState?.(getState());},
  setComparison(meta,value){const old=comparisons.get(meta.instrumentUid);if(!value){if(old){chart.removeSeries(old.series);comparisons.delete(meta.instrumentUid);}}else{const series=old?.series||chart.addSeries(api.LineSeries,{color:meta.color||'#e1b264',lineWidth:2,title:meta.ticker,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false});series.applyOptions({visible:meta.visible!==false,color:meta.color||'#e1b264'});comparisons.set(meta.instrumentUid,{series,meta:{...meta},rows:normalizeMarketCandles(value)});}updateComparisons();},
  getComparisons(){return [...comparisons.values()].map(v=>{const last=v.rows.filter(r=>r.time<=rows.at(-1).time).at(-1),base=v.anchor&&v.closes.get(v.anchor.time);return {...v.meta,anchor:v.anchor?.time,change:base&&last?(last.close/base-1)*100:null};});},
  setScale(mode,invert=inverted){if(['normal','log','percent','indexed'].includes(mode))scaleMode=mode;inverted=invert===true;applyScale();onState?.(getState());},
  zoom(factor){const range=chart.timeScale().getVisibleLogicalRange();if(!range)return;const span=Math.max(10,(range.to-range.from)*factor),mid=(range.from+range.to)/2;chart.timeScale().setVisibleLogicalRange({from:mid-span/2,to:mid+span/2});},
  latest(){chart.timeScale().scrollToRealTime();},
  setType(value){if(!prices[value])return;type=value;Object.entries(prices).forEach(([key,s])=>s.applyOptions({visible:key===type}));drawing.refresh();onState?.(getState());},
  setFlash(value){flash=value;onState?.(getState());},
  restore(value){if(!value)return;syncing=true;try{colors=normalizeChartColors(value.colors);theme();if(prices[value.type]){type=value.type;Object.entries(prices).forEach(([key,s])=>s.applyOptions({visible:key===type}));}
    if(Array.isArray(value.studies)){studies=value.studies.slice(0,24).map(normalizeStudy).filter(Boolean);Object.assign(enabled,value.indicators);volume.applyOptions({visible:enabled.volume!==false});rebuildStudies();}else for(const[name,visible]of Object.entries(value.indicators||{}))toggle(name,Boolean(visible));drawing.setState(value.drawings);drawing.setMagnet(value.magnet);drawing.hide(value.drawingsHidden===true);scaleMode=['normal','log','percent','indexed'].includes(value.scaleMode)?value.scaleMode:'normal';inverted=value.inverted===true;applyScale();flash=value.flash===true;
    if(Number.isFinite(value.range?.from)&&Number.isFinite(value.range?.to)&&value.range.to>value.range.from)chart.timeScale().setVisibleRange(value.range);
   }finally{syncing=false;}},
  setRange(range){if(!range||range.to<=range.from)return;syncing=true;try{chart.timeScale().setVisibleRange(range);}finally{syncing=false;}},
  setCrosshair(time){const row=rows.find(r=>r.time===time);if(row)chart.setCrosshairPosition(row.close,row.time,price());else chart.clearCrosshairPosition();},
  getReplay,startReplay,stopReplay,stepReplay,pauseReplay,playReplay,setReplaySpeed,
  setColors(value){colors=normalizeChartColors(value);theme();onState?.(getState());},
  setContext:value=>drawing.setContext(value),beginDrawing:mode=>drawing.setMode(mode),clearDrawings:()=>drawing.clear(),fitContent:()=>chart.timeScale().fitContent(),
  destroy(){cancelAnimationFrame(resizeDrawFrame);clearInterval(replayTimer);replayTimer=null;dead=true;cancelAnimationFrame(historyFrame);clearTimeout(pulseTimer);themeObserver.disconnect();resize.disconnect();drawing.destroy();chart.unsubscribeCrosshairMove(cross);chart.timeScale().unsubscribeVisibleLogicalRangeChange(rangeChanged);chart.remove();}};
}
