// Independent, causal OHLCV formulas. Arrays remain aligned to their input bars.
export const extraIndicatorCatalog=[
 ['alma','ALMA · средняя Арно Легу',9,'overlay'],['kama','KAMA · адаптивная средняя Кауфмана',10,'overlay'],['zlema','ZLEMA · EMA с компенсацией задержки',20,'overlay'],['trima','TRIMA · треугольная средняя',20,'overlay'],['lsma','LSMA · линейная регрессия',25,'overlay'],
 ['supertrend','Supertrend',10,'overlay'],['chandelier','Выход Чандельера',22,'overlay'],['envelopes','Конверты средней, %',20,'overlay'],['tenkan','Ишимоку · Тенкан-сен',9,'overlay'],['kijun','Ишимоку · Киджун-сен',26,'overlay'],
 ['adx','ADX · сила тренда',14,'pane'],['dmi','DMI · ADX и направления DI',14,'pane'],['aroon','Aroon · обновление экстремумов',25,'pane'],['aroonosc','Осциллятор Aroon',25,'pane'],
 ['bbwidth','Ширина полос Боллинджера, %',20,'pane'],['percentb','Положение в полосах Боллинджера, %B',20,'pane'],['trix','TRIX · тройная EMA',18,'pane'],['ppo','PPO · процентный осциллятор цены',26,'pane'],['dpo','DPO · детрендированный осциллятор',20,'pane'],
 ['ao','AO · Awesome Oscillator',34,'pane'],['ac','AC · Accelerator Oscillator',34,'pane'],['ultimate','Ultimate Oscillator · 7/14/28',28,'pane'],['cmo','CMO · осциллятор Чанде',14,'pane'],['tsi','TSI · индекс истинной силы',25,'pane'],['fisher','Преобразование Фишера',10,'pane'],
 ['force','Индекс силы Элдера',13,'pane'],['elder','Сила быков и медведей Элдера',13,'pane'],['eom','Лёгкость движения',14,'pane'],['chaikin','Осциллятор Чайкина',10,'pane'],['volumeosc','Осциллятор объёма, %',14,'pane'],['vpt','VPT · ценовой тренд объёма',1,'pane'],['nvi','NVI · индекс отрицательного объёма',1,'pane'],['pvi','PVI · индекс положительного объёма',1,'pane'],['relativeVolume','Относительный объём',20,'pane'],
 ['hv','Волатильность лог-доходности свечи, %',20,'pane'],['ulcer','Индекс просадки Ulcer',14,'pane'],['efficiency','Коэффициент эффективности Кауфмана',10,'pane'],['zscore','Z-score цены',20,'pane']
];
const blank=n=>Array(n).fill(NaN),finite=Number.isFinite;
function rolling(values,p,fn){const out=blank(values.length);for(let i=p-1;i<values.length;i++){const w=values.slice(i-p+1,i+1);if(w.every(finite))out[i]=fn(w,i);}return out;}
const sum=w=>w.reduce((a,b)=>a+b,0),mean=w=>sum(w)/w.length;
const sma=(values,p)=>rolling(values,p,mean);
function ema(values,p,alpha=2/(p+1)){const out=blank(values.length);let count=0,total=0,prior=NaN;for(let i=0;i<values.length;i++){const v=values[i];if(!finite(v)){count=0;total=0;prior=NaN;continue;}if(count<p){total+=v;count++;if(count===p)prior=total/p;}else prior+=alpha*(v-prior);out[i]=prior;}return out;}
const wilder=(a,p)=>ema(a,p,1/p);
const sd=w=>{const m=mean(w);return Math.sqrt(mean(w.map(v=>(v-m)**2)));};
export function calculateExtraStudy(rows,s){
 if(!extraIndicatorCatalog.some(d=>d[0]===s.type))return null;
 const n=rows.length,p=s.period,t=s.type,c=rows.map(r=>r.close),high=rows.map(r=>r.high),low=rows.map(r=>r.low),volume=rows.map(r=>r.volume),median=rows.map(r=>(r.high+r.low)/2),delta=c.map((v,i)=>i?v-c[i-1]:NaN);
 const tr=rows.map((r,i)=>Math.max(r.high-r.low,i?Math.abs(r.high-c[i-1]):0,i?Math.abs(r.low-c[i-1]):0));
 const output=(values,color,histogram=false)=>({data:values.flatMap((value,i)=>finite(value)?[{time:rows[i].time,value,...(histogram?{color:value>=0?'#399b78':'#d75a62'}:{})}]:[]),...(color?{color}:{}),...(histogram?{histogram:true}:{})});
 const one=values=>[output(values)],combine=(a,b,fn)=>a.map((v,i)=>finite(v)&&finite(b[i])?fn(v,b[i],i):NaN);
 if(t==='alma'){const center=.85*(p-1),sigma=p/6,weights=Array.from({length:p},(_,i)=>Math.exp(-((i-center)**2)/(2*sigma*sigma))),norm=sum(weights);return one(rolling(c,p,w=>sum(w.map((v,i)=>v*weights[i]))/norm));}
 if(['efficiency','kama'].includes(t)){const er=blank(n);for(let i=p;i<n;i++){let noise=0;for(let j=i-p+1;j<=i;j++)noise+=Math.abs(delta[j]);er[i]=noise?Math.abs(c[i]-c[i-p])/noise:0;}if(t==='efficiency')return one(er);const out=blank(n);let value=NaN;for(let i=p;i<n;i++){if(!finite(value))value=mean(c.slice(i-p,i));const k=(er[i]*(2/3-2/31)+2/31)**2;value+=k*(c[i]-value);out[i]=value;}return one(out);}
 if(t==='zlema'){const lag=Math.floor((p-1)/2);return one(ema(c.map((v,i)=>i>=lag?2*v-c[i-lag]:NaN),p));}
 if(t==='trima')return one(sma(sma(c,Math.ceil((p+1)/2)),Math.floor((p+1)/2)));
 if(t==='lsma')return one(rolling(c,p,w=>{if(p===1)return w[0];const x=(p-1)/2,m=mean(w),slope=sum(w.map((v,i)=>(i-x)*(v-m)))/sum(w.map((_,i)=>(i-x)**2));return m+slope*x;}));
 if(['tenkan','kijun'].includes(t)){const hi=rolling(high,p,w=>Math.max(...w)),lo=rolling(low,p,w=>Math.min(...w));return one(combine(hi,lo,(a,b)=>(a+b)/2));}
 if(t==='envelopes'){const m=sma(c,p);return [output(m.map(v=>v*(1+s.deviations/100))),output(m),output(m.map(v=>v*(1-s.deviations/100)))];}
 if(['supertrend','chandelier'].includes(t)){
  const atr=wilder(tr,p),upper=blank(n),lower=blank(n),trend=blank(n);let direction=-1;
  for(let i=p-1;i<n;i++){
   if(t==='chandelier'){upper[i]=Math.max(...high.slice(i-p+1,i+1))-s.deviations*atr[i];lower[i]=Math.min(...low.slice(i-p+1,i+1))+s.deviations*atr[i];continue;}
   const u=median[i]+s.deviations*atr[i],l=median[i]-s.deviations*atr[i];upper[i]=i===p-1||u<upper[i-1]||c[i-1]>upper[i-1]?u:upper[i-1];lower[i]=i===p-1||l>lower[i-1]||c[i-1]<lower[i-1]?l:lower[i-1];
   if(i>p-1){if(direction===1&&c[i]<lower[i])direction=-1;else if(direction===-1&&c[i]>upper[i])direction=1;}trend[i]=direction===1?lower[i]:upper[i];
  }return t==='chandelier'?[output(upper,'#5ed0a0'),output(lower,'#ef7b76')]:one(trend);
 }
 if(['adx','dmi'].includes(t)){
  const plus=blank(n),minus=blank(n),ranges=[NaN,...tr.slice(1)];for(let i=1;i<n;i++){const up=high[i]-high[i-1],down=low[i-1]-low[i];plus[i]=up>down&&up>0?up:0;minus[i]=down>up&&down>0?down:0;}
  const atr=wilder(ranges,p),pos=combine(wilder(plus,p),atr,(a,b)=>b?100*a/b:0),neg=combine(wilder(minus,p),atr,(a,b)=>b?100*a/b:0),dx=combine(pos,neg,(a,b)=>a+b?100*Math.abs(a-b)/(a+b):0),adx=wilder(dx,p);
  return t==='adx'?one(adx):[output(adx),output(pos,'#5ed0a0'),output(neg,'#ef7b76')];
 }
 if(['aroon','aroonosc'].includes(t)){const up=rolling(high,p+1,w=>100*w.lastIndexOf(Math.max(...w))/p),down=rolling(low,p+1,w=>100*w.lastIndexOf(Math.min(...w))/p);return t==='aroonosc'?one(combine(up,down,(a,b)=>a-b)):[output(up,'#5ed0a0'),output(down,'#ef7b76')];}
 if(['bbwidth','percentb','zscore'].includes(t)){const m=sma(c,p),sigma=rolling(c,p,sd);return one(c.map((v,i)=>!finite(m[i])?NaN:t==='bbwidth'?(m[i]?400*sigma[i]/Math.abs(m[i]):NaN):t==='zscore'?(sigma[i]?(v-m[i])/sigma[i]:0):(sigma[i]?(v-m[i]+2*sigma[i])/(4*sigma[i]):.5)));}
 if(t==='trix'){const third=ema(ema(ema(c,p),p),p);return one(third.map((v,i)=>i&&third[i-1]?(v/third[i-1]-1)*100:NaN));}
 if(t==='ppo'){const fast=ema(c,Math.min(s.fast,Math.max(1,p-1))),slow=ema(c,p),value=combine(fast,slow,(a,b)=>b?(a/b-1)*100:NaN),signal=ema(value,s.signal);return [output(value),output(signal,'#d79c39'),output(combine(value,signal,(a,b)=>a-b),null,true)];}
 if(t==='dpo'){const m=sma(c,p),shift=Math.floor(p/2)+1;return one(m.map((v,i)=>i>=shift?c[i-shift]-v:NaN));}
 if(['ao','ac'].includes(t)){const a=combine(sma(median,Math.min(5,p)),sma(median,p),(a,b)=>a-b);return [output(t==='ao'?a:combine(a,sma(a,5),(a,b)=>a-b),null,true)];}
 if(t==='ultimate'){const bp=rows.map((r,i)=>i?r.close-Math.min(r.low,c[i-1]):NaN),range=rows.map((r,i)=>i?Math.max(r.high,c[i-1])-Math.min(r.low,c[i-1]):NaN),avg=period=>combine(rolling(bp,period,sum),rolling(range,period,sum),(a,b)=>b?a/b:0),a=avg(7),b=avg(14),d=avg(28);return one(d.map((v,i)=>100*(4*a[i]+2*b[i]+v)/7));}
 if(t==='cmo')return one(rolling(delta,p,w=>{const gains=sum(w.map(v=>Math.max(v,0))),losses=sum(w.map(v=>Math.max(-v,0)));return gains+losses?100*(gains-losses)/(gains+losses):0;}));
 if(t==='tsi')return one(combine(ema(ema(delta,p),s.signal),ema(ema(delta.map(Math.abs),p),s.signal),(a,b)=>b?100*a/b:0));
 if(t==='fisher'){const hi=rolling(median,p,w=>Math.max(...w)),lo=rolling(median,p,w=>Math.min(...w)),out=blank(n);let smooth=0,f=0;for(let i=p-1;i<n;i++){smooth=.66*(hi[i]===lo[i]?0:(median[i]-lo[i])/(hi[i]-lo[i])-.5)+.67*smooth;smooth=Math.max(-.999,Math.min(.999,smooth));f=.5*Math.log((1+smooth)/(1-smooth))+.5*f;out[i]=f;}return one(out);}
 if(t==='force')return one(ema(delta.map((v,i)=>v*volume[i]),p));
 if(t==='elder'){const m=ema(c,p);return [output(combine(high,m,(a,b)=>a-b),'#5ed0a0'),output(combine(low,m,(a,b)=>a-b),'#ef7b76')];}
 if(t==='eom')return one(sma(median.map((v,i)=>i&&volume[i]>0?(v-median[i-1])*(high[i]-low[i])*100000000/volume[i]:NaN),p));
 if(t==='chaikin'){let total=0;const ad=rows.map(r=>total+=(r.high===r.low?0:(2*r.close-r.high-r.low)/(r.high-r.low))*r.volume);return one(combine(ema(ad,Math.min(3,p)),ema(ad,p),(a,b)=>a-b));}
 if(t==='volumeosc')return one(combine(ema(volume,Math.max(1,Math.floor(p/2))),ema(volume,p),(a,b)=>b?(a/b-1)*100:NaN));
 if(['vpt','nvi','pvi'].includes(t)){let value=t==='vpt'?0:1000;return one(c.map((v,i)=>{if(i&&c[i-1]){const change=v/c[i-1]-1;if(t==='vpt')value+=change*volume[i];if(t==='nvi'&&volume[i]<volume[i-1]||t==='pvi'&&volume[i]>volume[i-1])value*=1+change;}return value;}));}
 if(t==='relativeVolume'){const m=sma(volume,p);return one(volume.map((v,i)=>i&&m[i-1]>0?v/m[i-1]:NaN));}
 if(t==='hv')return one(rolling(c.map((v,i)=>i&&v>0&&c[i-1]>0?Math.log(v/c[i-1]):NaN),p,w=>sd(w)*100));
 if(t==='ulcer'){const peak=rolling(c,p,w=>Math.max(...w)),dd=combine(c,peak,(v,h)=>h?((v/h-1)*100)**2:NaN);return one(rolling(dd,p,w=>Math.sqrt(mean(w))));}
 return [];
}
