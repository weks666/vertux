import {extraIndicatorCatalog,calculateExtraStudy} from './chart-indicators-extra.js';
// Pure calculations over ordered OHLCV. Warm-up observations are omitted.
export function average(rows, period=20, exponential=false, field='close') {
 const out=[];let value=null,sum=0;
 rows.forEach((row,i)=>{const n=row[field];sum+=n;if(i>=period)sum-=rows[i-period][field];
  value=exponential?(value===null?n:value+(n-value)*2/(period+1)):sum/period;
  if(i>=period-1)out.push({time:row.time,value});});return out;
}
export function bollinger(rows,period=20,deviations=2) {
 const mean=average(rows,period);return mean.map((point,i)=>{const window=rows.slice(i,i+period);
  const sigma=Math.sqrt(window.reduce((sum,row)=>sum+(row.close-point.value)**2,0)/period)*deviations;
  return {...point,upper:point.value+sigma,lower:point.value-sigma};});
}
export function rsi(rows,period=14) {
 const out=[];let gain=0,loss=0;
 for(let i=1;i<rows.length;i++){const d=rows[i].close-rows[i-1].close;
  if(i<=period){gain+=Math.max(0,d)/period;loss+=Math.max(0,-d)/period;}
  else{gain=(gain*(period-1)+Math.max(0,d))/period;loss=(loss*(period-1)+Math.max(0,-d))/period;}
  if(i>=period)out.push({time:rows[i].time,value:loss===0?(gain===0?50:100):100-100/(1+gain/loss)});
 }return out;
}
export function macd(rows,fastPeriod=12,slowPeriod=26,signalPeriod=9) {
 const fast=new Map(average(rows,fastPeriod,true).map(r=>[r.time,r.value]));
 const line=average(rows,slowPeriod,true).filter(r=>fast.has(r.time)).map(r=>({time:r.time,close:fast.get(r.time)-r.value}));
 const signal=new Map(average(line,signalPeriod,true).map(r=>[r.time,r.value]));
 return line.filter(r=>signal.has(r.time)).map(r=>({time:r.time,value:r.close,signal:signal.get(r.time),histogram:r.close-signal.get(r.time)}));
}

export const indicatorCatalog = [
 ['sma','SMA · простая средняя',20,'overlay'],['ema','EMA · экспоненциальная средняя',20,'overlay'],
 ['wma','WMA · взвешенная средняя',20,'overlay'],['rma','RMA · средняя Уайлдера',14,'overlay'],
 ['dema','DEMA · двойная EMA',20,'overlay'],['tema','TEMA · тройная EMA',20,'overlay'],
 ['hma','HMA · средняя Халла',20,'overlay'],['vwma','VWMA · средняя по объёму',20,'overlay'],
 ['bb','Полосы Боллинджера',20,'overlay'],['donchian','Канал Дончиана',20,'overlay'],
 ['keltner','Канал Кельтнера',20,'overlay'],['vwap','VWAP · средняя цена сессии',1,'overlay'],
 ['rsi','RSI · относительная сила',14,'pane'],['macd','MACD',26,'pane'],
 ['stochastic','Стохастик',14,'pane'],['stochrsi','Stochastic RSI',14,'pane'],
 ['atr','ATR · средний истинный диапазон',14,'pane'],['cci','CCI · индекс товарного канала',20,'pane'],
 ['roc','ROC · скорость изменения',12,'pane'],['momentum','Моментум',10,'pane'],
 ['williams','Williams %R',14,'pane'],['obv','OBV · балансовый объём',1,'pane'],
 ['mfi','MFI · денежный поток',14,'pane'],['cmf','CMF · поток Чайкина',20,'pane'],
 ['ad','Накопление / распределение',1,'pane'],['stddev','Стандартное отклонение',20,'pane'],
...extraIndicatorCatalog,
].map(([type,label,period,placement])=>({type,label,period,placement}));

export function normalizeStudy(input) {
 const definition=indicatorCatalog.find(d=>d.type===input?.type);if(!definition)return null;
 const period=Math.max(input.type==='macd'?2:1,Math.min(500,Math.round(Number(input.period)||definition.period)));
 return {id:String(input.id||input.type).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,64),type:definition.type,period,
  color:/^#[0-9a-f]{6}$/i.test(input.color)?input.color:'#b9a9ff',visible:input.visible!==false,
  deviations:Math.max(.1,Math.min(10,Number(input.deviations)||2)),
  fast:Math.max(1,Math.min(input.type==='macd'?period-1:499,Math.round(Number(input.fast)||12))),
  signal:Math.max(1,Math.min(100,Math.round(Number(input.signal)||9)))};
}
const wma=(rows,p,field='close')=>rows.slice(p-1).map((r,i)=>({time:r.time,value:rows.slice(i,i+p).reduce((s,r,j)=>s+r[field]*(j+1),0)/(p*(p+1)/2)}));
function smoothed(rows,p,field='close') {
 const out=[];let sum=0,value;rows.forEach((r,i)=>{sum+=r[field];if(i===p-1)value=sum/p;else if(i>=p)value=(value*(p-1)+r[field])/p;if(i>=p-1)out.push({time:r.time,value});});return out;
}
const tr=rows=>rows.map((r,i)=>({...r,close:Math.max(r.high-r.low,Math.abs(r.high-(rows[i-1]?.close??r.close)),Math.abs(r.low-(rows[i-1]?.close??r.close)))}));
const line=data=>data.filter(r=>Number.isFinite(r.value));
export function calculateStudy(rows,input) {
 const s=normalizeStudy(input);if(!s)return [];const p=s.period,type=s.type;const extra=calculateExtraStudy(rows,s);if(extra!==null)return extra;
 const one=data=>[{data:line(data)}];
 if(type==='sma'||type==='ema')return one(average(rows,p,type==='ema'));
 if(type==='wma')return one(wma(rows,p));if(type==='rma')return one(smoothed(rows,p));
 if(type==='dema'||type==='tema'){
  const a=average(rows,p,true),b=average(a,p,true,'value'),c=average(b,p,true,'value'),am=new Map(a.map(r=>[r.time,r.value])),bm=new Map(b.map(r=>[r.time,r.value]));
  return one((type==='dema'?b:c).map(r=>({time:r.time,value:type==='dema'?2*am.get(r.time)-r.value:3*am.get(r.time)-3*bm.get(r.time)+r.value})));
 }
 if(type==='hma'){const fast=new Map(wma(rows,Math.max(1,Math.floor(p/2))).map(r=>[r.time,r.value]));return one(wma(wma(rows,p).map(r=>({time:r.time,close:2*fast.get(r.time)-r.value})),Math.max(1,Math.round(Math.sqrt(p)))));}
 if(type==='vwap')return one(vwap(rows));if(type==='rsi')return one(rsi(rows,p));
 if(type==='macd'){const data=macd(rows,Math.min(s.fast,p-1)||1,Math.max(2,p),s.signal);return [{data:data.map(r=>({time:r.time,value:r.value}))},{data:data.map(r=>({time:r.time,value:r.signal})),color:'#d79c39'},{data:data.map(r=>({time:r.time,value:r.histogram,color:r.histogram>=0?'#399b78':'#d75a62'})),histogram:true}];}
 if(type==='atr')return one(smoothed(tr(rows),p));
 if(type==='bb'){const data=bollinger(rows,p,s.deviations);return ['upper','value','lower'].map(key=>({data:data.map(r=>({time:r.time,value:r[key]}))}));}
 if(type==='keltner'){const atr=new Map(smoothed(tr(rows),p).map(r=>[r.time,r.value])),mid=average(rows,p,true);return [1,0,-1].map(sign=>({data:mid.map(r=>({time:r.time,value:r.value+sign*s.deviations*atr.get(r.time)}))}));}
 if(type==='roc'||type==='momentum')return one(rows.slice(p).map((r,i)=>({time:r.time,value:type==='roc'?(rows[i].close===0?NaN:(r.close/rows[i].close-1)*100):r.close-rows[i].close})));
 if(type==='obv'||type==='ad'){let value=0;return one(rows.map((r,i)=>({time:r.time,value:value+=type==='obv'?(i?Math.sign(r.close-rows[i-1].close)*r.volume:0):(r.high===r.low?0:(2*r.close-r.high-r.low)/(r.high-r.low)*r.volume)})));}
 if(type==='stochrsi'){const values=rsi(rows,p).map(r=>({...r,close:r.value}));return one(values.slice(p-1).map((r,i)=>{const window=values.slice(i,i+p).map(x=>x.value),lo=Math.min(...window),hi=Math.max(...window);return {time:r.time,value:hi===lo?50:100*(r.value-lo)/(hi-lo)};}));}
 const values=rows.slice(p-1).map((r,i)=>{const window=rows.slice(i,i+p),high=Math.max(...window.map(x=>x.high)),low=Math.min(...window.map(x=>x.low)),volume=window.reduce((s,x)=>s+x.volume,0),mean=window.reduce((s,x)=>s+x.close,0)/p;
  let value;
  if(type==='vwma')value=volume?window.reduce((s,x)=>s+x.close*x.volume,0)/volume:NaN;
  if(type==='stochastic')value=high===low?50:100*(r.close-low)/(high-low);
  if(type==='williams')value=high===low?-50:-100*(high-r.close)/(high-low);
  if(type==='stddev')value=Math.sqrt(window.reduce((s,x)=>s+(x.close-mean)**2,0)/p);
  if(type==='cci'){const tp=window.map(x=>(x.high+x.low+x.close)/3),m=tp.reduce((s,x)=>s+x,0)/p,dev=tp.reduce((s,x)=>s+Math.abs(x-m),0)/p;value=dev?(tp.at(-1)-m)/(.015*dev):0;}
  if(type==='cmf')value=volume?window.reduce((s,x)=>s+(x.high===x.low?0:(2*x.close-x.high-x.low)/(x.high-x.low)*x.volume),0)/volume:NaN;
  if(type==='mfi'){let pos=0,neg=0;window.forEach((x,j)=>{const prev=rows[i+j-1];if(!prev)return;const tp=(x.high+x.low+x.close)/3,old=(prev.high+prev.low+prev.close)/3;if(tp>old)pos+=tp*x.volume;else if(tp<old)neg+=tp*x.volume;});value=!pos&&!neg?50:!neg?100:100-100/(1+pos/neg);}
  return {time:r.time,value,high,low};});
 if(type==='donchian')return ['high','middle','low'].map(key=>({data:values.map(r=>({time:r.time,value:key==='middle'?(r.high+r.low)/2:r[key]}))}));
 if(type==='stochastic'){const k=average(values,3,false,'value');return [{data:k},{data:average(k,3,false,'value'),color:'#d79c39'}];}
 return one(type==='mfi'?values.slice(1):values);
}
export function vwap(rows) {
 let day='',sum=0,volume=0;const out=[];
 for(const row of rows){const key=new Date((row.time+10800)*1000).toISOString().slice(0,10);
  if(key!==day){day=key;sum=0;volume=0;}sum+=(row.high+row.low+row.close)/3*row.volume;volume+=row.volume;
  if(volume>0)out.push({time:row.time,value:sum/volume});}return out;
}
export function radarMeasure(rows,levels=[]) {
 if(!rows?.length)return null;const last=rows.at(-1),prior=rows.at(-2);
 const history=rows.slice(-21,-1),mean=history.length?history.reduce((s,r)=>s+r.volume,0)/history.length:0;
 const nearest=levels.filter(n=>Number.isFinite(n)&&n>0).sort((a,b)=>Math.abs(a-last.close)-Math.abs(b-last.close))[0];
 return {price:last.close,change:prior?.close>0?(last.close/prior.close-1)*100:null,
  volumeRatio:mean>0?last.volume/mean:null,volumeSamples:history.length,
  distance:nearest&&last.close>0?Math.abs(nearest-last.close)/last.close*100:null,level:nearest,time:last.time};
}
