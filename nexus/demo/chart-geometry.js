// Pure chart geometry; price calculations use source OHLC, never screen pixels.
export function regressionChannel(rows,from,to) {
 const sample=rows.filter(r=>r.time>=Math.min(from,to)&&r.time<=Math.max(from,to));
 if(sample.length<2)return null;
 const n=sample.length,mx=(n-1)/2,my=sample.reduce((s,r)=>s+r.close,0)/n;
 let numerator=0,denominator=0;
 sample.forEach((r,i)=>{numerator+=(i-mx)*(r.close-my);denominator+=(i-mx)**2;});
 const slope=numerator/denominator,intercept=my-slope*mx;
 const sigma=Math.sqrt(sample.reduce((s,r,i)=>s+(r.close-intercept-slope*i)**2,0)/n);
 return {from:sample[0].time,to:sample.at(-1).time,start:intercept,end:intercept+slope*(n-1),sigma};
}
export function snapToCandle(rows,time,price) {
 if(!rows.length)return {time,price};
 let lo=0,hi=rows.length-1;
 while(lo<hi){const mid=(lo+hi)>>1;if(rows[mid].time<time)lo=mid+1;else hi=mid;}
 const a=rows[Math.max(0,lo-1)],b=rows[lo],row=Math.abs(a.time-time)<Math.abs(b.time-time)?a:b;
 return {time:row.time,price:[row.open,row.high,row.low,row.close].reduce((a,b)=>Math.abs(a-price)<=Math.abs(b-price)?a:b)};
}

// Screen-aligned rectangles persist two diagonal anchors; handles are derived.
export const boxHandleNames=['nw','n','ne','e','se','s','sw','w'];
export function boxHandles(a,b){
 const left=Math.min(a.x,b.x),right=Math.max(a.x,b.x),top=Math.min(a.y,b.y),bottom=Math.max(a.y,b.y),cx=(left+right)/2,cy=(top+bottom)/2;
 return [[left,top],[cx,top],[right,top],[right,cy],[right,bottom],[cx,bottom],[left,bottom],[left,cy]].map(([x,y],i)=>({x,y,name:boxHandleNames[i]}));
}
export function resizeBox(points,handle,point,northIsHigh=true){
 const left=Math.min(points[0].time,points[1].time),right=Math.max(points[0].time,points[1].time),top=(northIsHigh?Math.max:Math.min)(points[0].price,points[1].price),bottom=(northIsHigh?Math.min:Math.max)(points[0].price,points[1].price);
 return [{time:handle.includes('w')?point.time:left,price:handle.includes('n')?point.price:top},{time:handle.includes('e')?point.time:right,price:handle.includes('s')?point.price:bottom}];
}
