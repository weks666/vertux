import {createStudyLegend} from './chart-study-legend.js';
import {baseChartType,validChartTypes,transformPrices,normalizeSeriesOptions,priceBox} from './chart-series-model.js';
import {chartTime,validTimezone,adjustDividends} from './chart-resolutions.js';
import {normalizeMarketCandles,formatMarketTick} from './charts.js';
import {calculateStudy,indicatorCatalog,normalizeStudy,volumeDependentStudies} from './chart-indicators.js';
import {normalizeChartColors} from './chart-preferences.js';
import {createDrawingLayer} from './chart-drawings.js';
import {isMeasuredVolume} from './chart-indicators-extra.js';
// Broker-sourced charts must read like the embedded TradingView chart next to
// them: same candle colours, font, grey crosshair and dotted last-price line.
const up='#089981',down='#f23645',TV_FONT='-apple-system,BlinkMacSystemFont,"Trebuchet MS",Roboto,Ubuntu,sans-serif';
export function createMarketChart(host,candles,{onCrosshair,onState,onMode,onRange,onHistory,onDrawingSelect,onReplay,getDrawingDefaults,onDrawingStyle,onStudySettings}={}) {
 const api=globalThis.LightweightCharts;let rows=normalizeMarketCandles(candles);
 if(!api||!host||!rows.length)return null;
 const chart=api.createChart(host,{width:host.clientWidth||480,height:host.clientHeight||480,
  layout:{background:{type:'solid',color:'#0d141e'},textColor:'#b2b5be',fontFamily:TV_FONT,fontSize:12,attributionLogo:false,panes:{separatorColor:'#233044',separatorHoverColor:'#7358ae'}},
  grid:{vertLines:{color:'#95accc0b'},horzLines:{color:'#95accc16'}},rightPriceScale:{borderColor:'#95accc20',minimumWidth:62},
  timeScale:{timeVisible:true,secondsVisible:false,tickMarkFormatter:formatMarketTick,fixLeftEdge:false,fixRightEdge:false,rightOffset:6,minBarSpacing:.001,borderColor:'#95accc20'},
  localization:{locale:'ru-RU',timeFormatter:time=>new Date(time*1000).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})},
  crosshair:{mode:api.CrosshairMode.Normal,vertLine:{color:'#9598a1',style:3,width:1,labelBackgroundColor:'#363a45'},horzLine:{color:'#9598a1',style:3,width:1,labelBackgroundColor:'#363a45'}}});
 const prices={candles:chart.addSeries(api.CandlestickSeries,{upColor:up,downColor:down,borderVisible:false,wickUpColor:up,wickDownColor:down,priceLineStyle:1}),
  bars:chart.addSeries(api.BarSeries,{upColor:up,downColor:down,visible:false}),
  line:chart.addSeries(api.LineSeries,{color:'#a98bff',lineWidth:2,visible:false}),
  area:chart.addSeries(api.AreaSeries,{lineColor:'#a98bff',topColor:'#8966ff38',bottomColor:'#8966ff02',lineWidth:2,visible:false})};
 const volume=chart.addSeries(api.HistogramSeries,{priceFormat:{type:'volume'},priceScaleId:'volume',priceLineVisible:false,lastValueVisible:false});
 volume.priceScale().applyOptions({scaleMargins:{top:.84,bottom:0},visible:false});
 for(const series of Object.values(prices))series.priceScale().applyOptions({scaleMargins:{top:.18,bottom:.26}});
 const indicators={},enabled={volume:true},comparisons=new Map();let studies=[],type='candles',scaleMode='normal',inverted=false,flash=false,pulseTimer=null,syncing=false,dead=false,applying=false,historyFrame=0;
 const terminalCard=host.closest?.('.terminal-chart-card');let paneSizeFrame=0,studyLegend=null;
 // Keep usable plotting space when the terminal is split or its dock is open.
 // The containing grid scrolls; chart documents and chosen panes stay intact.
 function sizePanes(){
  if(!terminalCard||dead)return;
  const panes=chart.panes(),minimums=panes.map((_,i)=>i?96:180),minimum=minimums.reduce((a,b)=>a+b,0)+32+Math.max(0,panes.length-1)*2;
  terminalCard.style.setProperty('--chart-min-height',minimum+'px');
  cancelAnimationFrame(paneSizeFrame);paneSizeFrame=requestAnimationFrame(()=>{
   paneSizeFrame=0;if(dead||!host.clientHeight)return;studyLegend?.position();
   const heights=panes.map(p=>p.getHeight());if(!heights.some((h,i)=>h<minimums[i]))return;
   const available=heights.reduce((a,b)=>a+b,0),floor=minimums.reduce((a,b)=>a+b,0);if(available<floor)return;
   const weights=heights.map((h,i)=>Math.max(0,h-minimums[i])),total=weights.reduce((a,b)=>a+b,0);
   panes.forEach((pane,i)=>pane.setStretchFactor(minimums[i]+(available-floor)*(total?weights[i]/total:minimums[i]/floor)));
  });
 }
 let overlay=null,overlayFrame=0,seriesOptions=normalizeSeriesOptions(),timezone='Europe/Moscow',dividendEvents=[],dividendAdjusted=false;let resizeDrawFrame=0;let colors={},sourceRows=rows,paintedRows=rows,replay=null,replayTimer=null,replaySpeed=1;
 const price=()=>prices[baseChartType(type)]||prices.candles,positive=()=>colors.up||up,negative=()=>colors.down||down;
 const drawing=createDrawingLayer({host,chart,getSeries:price,getRows:()=>paintedRows,getCalculationRows:adjustedRows,onChange:()=>onState?.(getState()),onMode,onSelect:onDrawingSelect,getDefaults:getDrawingDefaults,onStyle:onDrawingStyle});
 function ensurePrice(){if(type==='baseline'&&!prices.baseline)prices.baseline=chart.addSeries(api.BaselineSeries,{visible:false,topLineColor:positive(),bottomLineColor:negative()});if(type==='columns'&&!prices.columns)prices.columns=chart.addSeries(api.HistogramSeries,{visible:false,priceLineVisible:false});}
 function adjustedRows(){return dividendAdjusted?adjustDividends(rows,dividendEvents):rows;}
 function visibleRows(){return transformPrices(adjustedRows(),type,seriesOptions);}
 function drawOverlay(){if(dead)return;const custom=['volumeCandles','highLow','pointFigure','kagi','hlc'].includes(type);if(!custom){if(overlay){overlay.setAttribute('hidden','');overlay.replaceChildren();}return;}if(!overlay){overlay=document.createElementNS('http://www.w3.org/2000/svg','svg');overlay.classList.add('chart-series-overlay');overlay.setAttribute('aria-hidden','true');host.append(overlay);}overlay.removeAttribute('hidden');overlay.setAttribute('width',host.clientWidth);overlay.setAttribute('height',host.clientHeight);overlay.style.width=host.clientWidth+'px';overlay.style.height=host.clientHeight+'px';overlay.style.stroke='none';overlay.style.strokeWidth='1';const fragment=document.createDocumentFragment(),data=paintedRows,width=host.clientWidth-62,height=host.clientHeight-28,series=price(),range=chart.timeScale().getVisibleRange(),positiveColor=positive(),negativeColor=negative(),inView=range?data.filter(r=>r.time>=range.from&&r.time<=range.to):data,points=inView.map(r=>({r,x:chart.timeScale().timeToCoordinate(r.time),o:series.priceToCoordinate(r.open),c:series.priceToCoordinate(r.close),h:series.priceToCoordinate(r.high),l:series.priceToCoordinate(r.low)})).filter(p=>p.x!=null&&p.x>=0&&p.x<=width&&p.c!=null);
  const add=(tag,attrs)=>{const el=document.createElementNS(overlay.namespaceURI,tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);fragment.append(el);};const glyphs=new Map();let prev;const spacing=Math.max(1,Math.min(30,points.length>1?Math.abs(points[1].x-points[0].x):8)),maxVolume=Math.max(1,...data.slice(-200).filter(isMeasuredVolume).map(r=>r.volume)),box=priceBox(rows,seriesOptions);
  for(const p of points.slice(-3000)){const color=p.r.close>=p.r.open?positiveColor:negativeColor;if(type==='volumeCandles'){
   if(isMeasuredVolume(p.r)){const w=Math.max(1,spacing*.85*Math.sqrt(Math.min(1,p.r.volume/maxVolume)));add('path',{d:`M${p.x} ${p.h}V${p.l}`,stroke:color});add('rect',{x:p.x-w/2,y:Math.min(p.o,p.c),width:w,height:Math.max(1,Math.abs(p.c-p.o)),fill:color,'data-volume-known':'true','data-time':p.r.time});}
   else add('path',{d:`M${p.x-spacing*.25} ${p.o}H${p.x}M${p.x} ${p.h}V${p.l}M${p.x} ${p.c}H${p.x+spacing*.25}`,stroke:color,fill:'none','data-volume-known':'false','data-time':p.r.time});
  }if(type==='highLow')add('path',{d:`M${p.x-spacing*.25} ${p.h}H${p.x+spacing*.25}M${p.x} ${p.h}V${p.l}M${p.x-spacing*.25} ${p.l}H${p.x+spacing*.25}`,stroke:color,fill:'none'});
   if(type==='pointFigure'){
    const dir=Math.sign(p.r.close-p.r.open)||1,total=Math.round(Math.abs(p.r.close-p.r.open)/box)+1;
    const top=series.coordinateToPrice(0),bottom=series.coordinateToPrice(height),lo=Math.min(top,bottom),hi=Math.max(top,bottom);
    const first=Math.max(0,Math.ceil((dir>0?lo-p.r.open:p.r.open-hi)/box)),last=Math.min(total-1,Math.floor((dir>0?hi-p.r.open:p.r.open-lo)/box));
    // At subpixel density adjacent glyphs share a pixel. Bound drawing work by
    // the actual viewport, while the underlying transformed rows remain whole.
    const pixelBudget=Math.max(1,Math.min(height*2,Math.floor(60000/Math.max(1,Math.min(3000,points.length)))));
    const step=Math.max(1,Math.ceil((last-first+1)/pixelBudget));
    const radius=Math.max(.5,Math.min(spacing*.38,Math.abs(series.priceToCoordinate(p.r.open+box)-p.o)*.4));
    let path=glyphs.get(color)||'';
    for(let i=first;i<=last;i+=step){const y=series.priceToCoordinate(p.r.open+dir*i*box);if(y==null||y<0||y>height)continue;
     path+=dir>0?`M${p.x-radius} ${y-radius}l${radius*2} ${radius*2}M${p.x-radius} ${y+radius}l${radius*2} ${-radius*2}`:`M${p.x-radius} ${y}a${radius} ${radius} 0 1 0 ${radius*2} 0a${radius} ${radius} 0 1 0 ${-radius*2} 0`;
    }glyphs.set(color,path);
   }
   if(type==='kagi'){add('path',{d:(prev?`M${prev.x} ${prev.c}H${p.x}V${p.c}`:`M${p.x} ${p.o}V${p.c}`),stroke:color,'stroke-width':p.r.close>=p.r.open?3:1.5,fill:'none'});prev=p;}}
  for(const [color,d]of glyphs)if(d)add('path',{d,stroke:color,fill:'none'});
  if(type==='hlc'&&points.length>1)add('path',{d:'M'+points.map(p=>`${p.x} ${p.h}`).join('L')+'L'+points.slice().reverse().map(p=>`${p.x} ${p.l}`).join('L')+'Z',fill:positive()+'20',stroke:positiveColor+'70'});
  overlay.replaceChildren(fragment);
 }
 function redrawOverlay(){cancelAnimationFrame(overlayFrame);overlayFrame=requestAnimationFrame(drawOverlay);}
 function applyChartType(){const base=baseChartType(type);Object.entries(prices).forEach(([key,s])=>s.applyOptions({visible:key===base}));prices.candles.applyOptions({upColor:type==='hollow'?'transparent':positive(),downColor:negative(),borderVisible:type==='hollow',borderUpColor:positive(),borderDownColor:negative()});prices.line.applyOptions({color:type==='kagi'?'transparent':colors.line||'#a98bff',lineType:type==='stepLine'?1:0,pointMarkersVisible:type==='lineDots',pointMarkersRadius:3});prices.bars.applyOptions({upColor:['volumeCandles','highLow','pointFigure'].includes(type)?'transparent':positive(),downColor:['volumeCandles','highLow','pointFigure'].includes(type)?'transparent':negative()});redrawOverlay();}
 function setTimezone(value){timezone=validTimezone(value);const formatters=new Map();chart.applyOptions({localization:{timeFormatter:time=>chartTime(time,timezone)},timeScale:{tickMarkFormatter:(time,kind)=>{let formatter=formatters.get(kind);if(!formatter){formatter=new Intl.DateTimeFormat('ru-RU',{timeZone:timezone,...(kind===0?{year:'numeric'}:kind===1?{month:'short'}:kind===2?{day:'numeric',month:'short'}:kind===4?{hour:'2-digit',minute:'2-digit',second:'2-digit'}:{hour:'2-digit',minute:'2-digit'})});formatters.set(kind,formatter);}return formatter.format(new Date(time*1000));}}});if(!syncing)onState?.(getState());}
 function updateIndicators(incremental=false){for(const study of studies.filter(s=>s.visible)){
  const outputs=calculateStudy(adjustedRows(),study);let list=indicators[study.id];
  if(!list){const pane=indicatorCatalog.find(d=>d.type===study.type).placement==='pane'?chart.panes().length:0;
   list=indicators[study.id]=outputs.map(output=>chart.addSeries(output.histogram?api.HistogramSeries:api.LineSeries,{color:output.color||study.color,lineWidth:1,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false},pane));
   if(pane){chart.panes()[0]?.setStretchFactor(1);chart.panes()[pane]?.setStretchFactor(.35);chart.panes()[pane]?.priceScale('right').applyOptions({minimumWidth:72});}
  }
  outputs.forEach((output,i)=>{
   if(volumeDependentStudies.includes(study.type)){
    const values=new Map(output.data.map(r=>[r.time,r])),timeline=rows.map(r=>values.has(r.time)?{...values.get(r.time)}:{time:r.time});
    // A line series bridges whitespace. Hide the outgoing edge of the last
    // measured point before a gap; never insert an invented numeric sample.
    let previous;for(const point of timeline){if(Number.isFinite(point.value))previous=point;else{if(previous)previous.color='transparent';previous=null;}}
    // A tail correction can invalidate or restore that earlier edge too.
    list[i].setData(timeline);
   }
   else if(incremental){const last=output.data.at(-1);list[i].update(last?.time===rows.at(-1).time?last:{time:rows.at(-1).time});}
   else{const values=new Map(output.data.map(r=>[r.time,r]));list[i].setData(rows.map(r=>values.get(r.time)||{time:r.time}));}
  });
 }}
 function rebuildStudies(){for(const list of Object.values(indicators))for(const series of list)chart.removeSeries(series);for(const key of Object.keys(indicators))delete indicators[key];updateIndicators();sizePanes();drawing.refresh();studyLegend?.render();}
 function updateComparisons(){for(const value of comparisons.values()){
  const other=value.closes??=new Map(value.rows.map(r=>[r.time,r.close]));const anchor=adjustedRows().find(r=>other.has(r.time)&&r.close>0&&other.get(r.time)>0);
  value.anchor=anchor?{time:anchor.time,close:anchor.close}:null;
  value.series.setData(anchor?value.rows.filter(r=>r.time<=rows.at(-1).time).map(r=>({time:r.time,value:r.close/other.get(anchor.time)*anchor.close})):[]);
 }}
 function applyScale(){chart.priceScale('right').applyOptions({mode:comparisons.size?api.PriceScaleMode.Percentage:({normal:0,log:1,percent:2,indexed:3})[scaleMode],invertScale:inverted,autoScale:true});drawing.refresh();}
 const volumePoint=row=>isMeasuredVolume(row)?{time:row.time,value:row.volume,color:row.close>=row.open?positive()+'80':negative()+'80'}:{time:row.time};
 function paintVolume(){volume.setData(rows.map(volumePoint));}
 let activePriceBase='candles';
 function fill({priceOnly=false,painted=visibleRows()}={}){
  ensurePrice();paintedRows=painted;const base=baseChartType(type);
  if(activePriceBase!==base){prices[activePriceBase].setData([]);activePriceBase=base;}
  const rising=base==='columns'?positive():null,falling=base==='columns'?negative():null;
  const data=base==='candles'||base==='bars'?painted.map(({time,open,high,low,close})=>({time,open,high,low,close})):
   painted.map(r=>({time:r.time,value:r.close,...(base==='columns'?{color:r.close>=r.open?rising:falling}: {})}));
  price().setData(data);
  if(base==='baseline')prices.baseline.applyOptions({baseValue:{type:'price',price:painted[0]?.close||0}});
  if(!priceOnly){paintVolume();updateIndicators();updateComparisons();}
  drawing.refresh();redrawOverlay();
 }
 function pulse(previous){if(document.documentElement.dataset?.visualEffects==='off'||host.closest?.('.terminal-workbench'))return;if(!flash||previous===undefined||previous===rows.at(-1).close)return;
  const direction=rows.at(-1).close>previous?'up':'down';host.dataset.priceDirection=direction;clearTimeout(pulseTimer);
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches){prices.line.applyOptions({color:direction==='up'?up:down});prices.area.applyOptions({lineColor:direction==='up'?up:down});}
  pulseTimer=setTimeout(()=>{delete host.dataset.priceDirection;prices.line.applyOptions({color:'#a98bff'});prices.area.applyOptions({lineColor:'#a98bff'});},700);
 }
 let followLatest=false;
 function revealLatest(){if(!followLatest||!rows.length)return;followLatest=false;if(rows.at(-1).time>(chart.timeScale().getVisibleRange()?.to??Infinity))chart.timeScale().scrollToRealTime();}
 function setData(value){if(replay)return;const next=normalizeMarketCandles(value);if(!next.length)return;const previous=rows.at(-1)?.close,range=chart.timeScale().getVisibleLogicalRange(),first=rows[0].time,added=next.filter(r=>r.time<first).length;applying=true;try{rows=next;sourceRows=rows;fill();if(range)chart.timeScale().setVisibleLogicalRange({from:range.from+added,to:range.to+added});revealLatest();}finally{applying=false;}pulse(previous);}
 function getState(){return {type,seriesOptions,timezone,dividendAdjusted,scaleMode,inverted,colors:{...colors},magnet:drawing.isMagnet(),drawingsHidden:drawing.isHidden(),indicators:Object.fromEntries(Object.entries(enabled).filter(([name,visible])=>name==='volume'||visible)),studies:studies.map(s=>({...s})),drawings:drawing.getState(),range:replay?replay.range:chart.timeScale().getVisibleRange(),atLatest:!replay&&rows.length>0&&(chart.timeScale().getVisibleRange()?.to??0)>=rows.at(-1).time,flash};}
 function toggle(name,visible){if(name==='volume'){enabled.volume=visible;volume.applyOptions({visible});}
  else if(indicatorCatalog.some(d=>d.type===name)){enabled[name]=visible;const matches=studies.some(s=>s.type===name);studies=studies.map(s=>s.type===name?{...s,visible}:s);if(visible&&!matches)studies.push(normalizeStudy({type:name}));rebuildStudies();}
  studyLegend?.render();onState?.(getState());}
 function setStudies(values){studies=(Array.isArray(values)?values:[]).slice(0,24).map(normalizeStudy).filter(Boolean);for(const d of indicatorCatalog)enabled[d.type]=studies.some(s=>s.type===d.type&&s.visible);rebuildStudies();onState?.(getState());}
 studyLegend=createStudyLegend({host,chart,getStudies:()=>studies,setStudies,getVolume:()=>enabled.volume!==false,setVolume:value=>toggle('volume',value),onSettings:onStudySettings});studyLegend.render();
 const rangeChanged=()=>{drawing.refresh();redrawOverlay();if(!syncing&&!applying){onRange?.(chart.timeScale().getVisibleRange());onState?.(getState());}cancelAnimationFrame(historyFrame);historyFrame=requestAnimationFrame(()=>{if(dead||syncing||applying||replay)return;const range=chart.timeScale().getVisibleLogicalRange();if(range&&range.from<15)onHistory?.();});};
 const cross=param=>{onCrosshair?.(paintedRows.find(r=>r.time===param.time)||null);};
 chart.subscribeCrosshairMove(cross);chart.timeScale().subscribeVisibleLogicalRangeChange(rangeChanged);
 let lastWidth=host.clientWidth,lastHeight=host.clientHeight;
 const resize=new ResizeObserver(()=>{if(resizeDrawFrame||dead)return;resizeDrawFrame=requestAnimationFrame(()=>{resizeDrawFrame=0;if(dead||!host.clientWidth||!host.clientHeight||lastWidth===host.clientWidth&&lastHeight===host.clientHeight)return;lastWidth=host.clientWidth;lastHeight=host.clientHeight;const range=chart.timeScale().getVisibleLogicalRange();applying=true;try{chart.resize(lastWidth,lastHeight,true);if(range)chart.timeScale().setVisibleLogicalRange(range);}finally{applying=false;}sizePanes();drawing.refresh();redrawOverlay();});});resize.observe(host);
 const finishPaneResize=()=>{globalThis.removeEventListener?.('pointerup',finishPaneResize,true);globalThis.removeEventListener?.('pointercancel',finishPaneResize,true);sizePanes();};
 const startPaneResize=()=>{if(!terminalCard)return;globalThis.addEventListener?.('pointerup',finishPaneResize,true);globalThis.addEventListener?.('pointercancel',finishPaneResize,true);};
 host.addEventListener('pointerdown',startPaneResize);sizePanes();
 function theme(){const css=getComputedStyle(host),value=(name,fallback)=>css.getPropertyValue(name).trim()||fallback,bg=colors.background||value('--chart-bg','#0d141e'),brightness=colors.background?(parseInt(bg.slice(1,3),16)*.2126+parseInt(bg.slice(3,5),16)*.7152+parseInt(bg.slice(5,7),16)*.0722):null,light=brightness===null?host.ownerDocument?.documentElement?.dataset?.workspaceTheme==='light':brightness>155,text=light?'#131722':'#b2b5be',accent=colors.line||value('--vertux-soft','#b9a9ff'),grid=colors.grid||value('--chart-line','#233044');
  chart.applyOptions({layout:{background:{type:'solid',color:bg},textColor:text,panes:{separatorColor:grid,separatorHoverColor:accent}},grid:{vertLines:{color:grid},horzLines:{color:grid}},crosshair:{vertLine:{color:'#9598a1',labelBackgroundColor:light?'#131722':'#363a45'},horzLine:{color:'#9598a1',labelBackgroundColor:light?'#131722':'#363a45'}}});
  prices.line.applyOptions({color:accent});prices.area.applyOptions({lineColor:accent,topColor:accent+'38',bottomColor:accent+'02'});prices.candles.applyOptions({upColor:positive(),downColor:negative(),wickUpColor:positive(),wickDownColor:negative()});prices.bars.applyOptions({upColor:positive(),downColor:negative()});paintVolume();applyChartType();
 }
 const getReplay=()=>replay?{active:true,index:replay.index,end:replay.end,total:sourceRows.length,time:rows.at(-1)?.time,playing:!!replayTimer,speed:replaySpeed}:{active:false};
 function notifyReplay(){onReplay?.(getReplay());}
 function pauseReplay(){clearInterval(replayTimer);replayTimer=null;notifyReplay();}
 function paintReplay(initial=false){if(!replay)return;const visible=chart.timeScale().getVisibleLogicalRange(),span=Math.max(10,visible?visible.to-visible.from:120);applying=true;try{rows=sourceRows.slice(0,replay.index+1);fill();if(initial||!visible||replay.index>visible.to-3)chart.timeScale().setVisibleLogicalRange({from:replay.index-span*.85,to:replay.index+span*.15});else chart.timeScale().setVisibleLogicalRange(visible);}finally{applying=false;}notifyReplay();}
 function stepReplay(delta=1){if(!replay)return;replay.index=Math.max(0,Math.min(replay.end,replay.index+delta));if(replay.index===replay.end)pauseReplay();paintReplay();}
 function playReplay(){if(!replay||replay.index>=replay.end)return;clearInterval(replayTimer);replayTimer=setInterval(()=>stepReplay(1),1000/replaySpeed);notifyReplay();}
 function stopReplay(){if(!replay)return;const range=replay.range;pauseReplay();replay=null;applying=true;try{rows=sourceRows;fill();if(range)chart.timeScale().setVisibleRange(range);else chart.timeScale().fitContent();}finally{applying=false;}notifyReplay();}
 function startReplay(time,endTime){if(!Number.isFinite(time))return false;const data=replay?sourceRows:rows,index=data.findIndex(r=>r.time>=time);if(index<0||time<data[0].time)return false;const range=replay?.range||chart.timeScale().getVisibleRange();pauseReplay();sourceRows=data;const foundEnd=Number.isFinite(endTime)?data.findLastIndex(r=>r.time<=endTime):data.length-1;replay={index,range,end:Math.max(index,foundEnd)};paintReplay(true);return true;}
 function setReplaySpeed(value){if(![.1,.25,.5,1,2,3,5,7,10,20].includes(value))return;replaySpeed=value;if(replayTimer)playReplay();else notifyReplay();}

 const themeObserver=new MutationObserver(theme);themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['style','data-workspace-theme']});
 fill();theme();chart.timeScale().fitContent();
 return {chart,drawings:drawing,getState,getRows:()=>adjustedRows().slice(),getDisplayedRows:()=>paintedRows.slice(),sourceAtCoordinate(x){const time=chart.timeScale().coordinateToTime(x);if(time==null)return null;const display=paintedRows.find(r=>r.time===time),target=display?.sourceTime||Number(time);let left=0,right=sourceRows.length;while(left<right){const mid=(left+right)>>>1;if(sourceRows[mid].time<target)left=mid+1;else right=mid;}const a=sourceRows[Math.max(0,left-1)],b=sourceRows[Math.min(left,sourceRows.length-1)];return target-a.time<=b.time-target?a:b;},getSourceRows:()=>sourceRows.slice(),getSeries:price,setData,
  updateCandle(value){if(replay)return rows.slice();const row=normalizeMarketCandles([value])[0];if(!row||row.interval&&rows.at(-1)?.interval&&row.interval!==rows.at(-1).interval||row.time<rows.at(-1).time)return;
   const last=rows.at(-1);
   if(row.instrumentUid&&last.instrumentUid&&row.instrumentUid!==last.instrumentUid)return;
   if(row.time===last.time&&Date.parse(row.capturedAt||'')<Date.parse(last.capturedAt||''))return;
   const previous=last.close;if(row.time===last.time)rows[rows.length-1]=row;else rows.push(row);
   // Keep price/history series incremental. A comparison only needs rebuilding
   // when the first shared candle appears or its anchor price is corrected.
   if(!['candles','bars','line','area'].includes(type)||dividendAdjusted){fill();return rows.slice();}
   const bar={time:row.time,open:row.open,high:row.high,low:row.low,close:row.close};
   price().update(['candles','bars'].includes(type)?bar:{time:row.time,value:row.close});
   volume.update(volumePoint(row));
   updateIndicators(true);
   if([...comparisons.values()].some(value=>value.anchor?value.anchor.time===row.time&&value.anchor.close!==row.close:row.close>0&&value.closes.get(row.time)>0))updateComparisons();
   drawing.refresh();pulse(previous);return rows.slice();},
  toggle,setStudies,
  setComparison(meta,value){const old=comparisons.get(meta.instrumentUid);if(!value){if(old){chart.removeSeries(old.series);comparisons.delete(meta.instrumentUid);}}else{const series=old?.series||chart.addSeries(api.LineSeries,{color:meta.color||'#e1b264',lineWidth:2,title:meta.ticker,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false});series.applyOptions({visible:meta.visible!==false,color:meta.color||'#e1b264'});comparisons.set(meta.instrumentUid,{series,meta:{...meta},rows:normalizeMarketCandles(value)});}updateComparisons();applyScale();},
  getComparisons(){return [...comparisons.values()].map(v=>{const last=v.rows.filter(r=>r.time<=rows.at(-1).time).at(-1),base=v.anchor&&v.closes.get(v.anchor.time);return {...v.meta,anchor:v.anchor?.time,change:base&&last?(last.close/base-1)*100:null};});},
  setScale(mode,invert=inverted){if(['normal','log','percent','indexed'].includes(mode))scaleMode=mode;inverted=invert===true;applyScale();onState?.(getState());},
  zoom(factor){const range=chart.timeScale().getVisibleLogicalRange();if(!range)return;const span=Math.max(10,(range.to-range.from)*factor),mid=(range.from+range.to)/2;chart.timeScale().setVisibleLogicalRange({from:mid-span/2,to:mid+span/2});},
  latest(){chart.timeScale().scrollToRealTime();},
  setType(value){if(!validChartTypes.includes(value)||value===type)return;const painted=transformPrices(adjustedRows(),value,seriesOptions);type=value;fill({priceOnly:true,painted});applyChartType();onState?.(getState());},setSeriesOptions(value){const next=normalizeSeriesOptions(value);const painted=transformPrices(adjustedRows(),type,next);seriesOptions=next;fill({priceOnly:true,painted});onState?.(getState());},setTimezone,setDividends(events,enabled=false){dividendEvents=events||[];dividendAdjusted=enabled===true&&dividendEvents.length>0;fill();onState?.(getState());},
  setFlash(value){flash=value;onState?.(getState());},
  restore(value){if(!value)return;syncing=true;try{colors=normalizeChartColors(value.colors);theme();seriesOptions=normalizeSeriesOptions(value.seriesOptions);setTimezone(value.timezone||timezone);if(validChartTypes.includes(value.type)){type=value.type;fill();applyChartType();}
    if(Array.isArray(value.studies)){studies=value.studies.slice(0,24).map(normalizeStudy).filter(Boolean);Object.assign(enabled,value.indicators);volume.applyOptions({visible:enabled.volume!==false});rebuildStudies();}else for(const[name,visible]of Object.entries(value.indicators||{}))toggle(name,Boolean(visible));drawing.setState(value.drawings);drawing.setMagnet(value.magnet);drawing.hide(value.drawingsHidden===true);scaleMode=['normal','log','percent','indexed'].includes(value.scaleMode)?value.scaleMode:'normal';inverted=value.inverted===true;applyScale();flash=value.flash===true;
    if(Number.isFinite(value.range?.from)&&Number.isFinite(value.range?.to)&&value.range.to>value.range.from){chart.timeScale().setVisibleRange(value.range);
     // A saved view that showed the latest bar keeps following it into new sessions.
     followLatest=value.atLatest!==false;revealLatest();}
   }finally{syncing=false;}},
  setRange(range){if(!range||range.to<=range.from)return;syncing=true;try{chart.timeScale().setVisibleRange(range);}finally{syncing=false;}},
  setCrosshair(time){const row=rows.find(r=>r.time===time);if(row)chart.setCrosshairPosition(row.close,row.time,price());else chart.clearCrosshairPosition();},
  getReplay,startReplay,stopReplay,stepReplay,pauseReplay,playReplay,setReplaySpeed,
  setColors(value){colors=normalizeChartColors(value);theme();onState?.(getState());},
  setContext:value=>drawing.setContext(value),beginDrawing:mode=>drawing.setMode(mode),clearDrawings:()=>drawing.clear(),fitContent:()=>chart.timeScale().fitContent(),
  destroy(){cancelAnimationFrame(overlayFrame);overlay?.remove();cancelAnimationFrame(resizeDrawFrame);cancelAnimationFrame(paneSizeFrame);host.removeEventListener('pointerdown',startPaneResize);globalThis.removeEventListener?.('pointerup',finishPaneResize,true);globalThis.removeEventListener?.('pointercancel',finishPaneResize,true);terminalCard?.style.removeProperty('--chart-min-height');clearInterval(replayTimer);replayTimer=null;dead=true;studyLegend?.destroy();cancelAnimationFrame(historyFrame);clearTimeout(pulseTimer);themeObserver.disconnect();resize.disconnect();drawing.destroy();chart.unsubscribeCrosshairMove(cross);chart.timeScale().unsubscribeVisibleLogicalRangeChange(rangeChanged);chart.remove();}};
}
