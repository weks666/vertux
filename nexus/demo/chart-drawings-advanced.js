import {patternLabels} from './chart-tool-catalog.js';
/** User-anchored studies: no automatic pattern recognition or trade signals. */
export function renderAdvancedDrawing({item,points,style,width,height,group,el,line,label,infinite,priceText}){
 const a=points[0],b=points[1]||a,c=points[2]||b,d=points[3]||c,type=item.type;
 const poly=(ps,attrs={})=>group.append(el('polyline',{points:ps.map(p=>`${p.x},${p.y}`).join(' '),...attrs}));
 const color=i=>style.multicolor?style.levelColors[i%style.levelColors.length]:style.color;
 const fill={'fill':style.fillColor,'fill-opacity':style.fill};
 if(patternLabels[type]){
  poly(points);const labels=patternLabels[type];
  points.forEach((p,i)=>label(p.x+5,p.y+(i%2?-9:17),labels[i]));
  if(['xabcd','cypher','abcd','threeDrives'].includes(type)){
   if(points.length>=3)group.append(el('polygon',{points:points.slice(0,3).map(p=>`${p.x},${p.y}`).join(' '),...fill,'stroke-dasharray':'3 3'}));
   if(points.length>=5)group.append(el('polygon',{points:points.slice(2,5).map(p=>`${p.x},${p.y}`).join(' '),...fill,'stroke-dasharray':'3 3'}));
   for(let i=2;i<points.length;i++){const previous=Math.abs(item.points[i-1].price-item.points[i-2].price),leg=Math.abs(item.points[i].price-item.points[i-1].price);if(previous>0)label((points[i].x+points[i-1].x)/2,(points[i].y+points[i-1].y)/2,(leg/previous).toFixed(3));}
  }
  if(type==='headShoulders'&&points.length>=5)infinite(points[2],points[4],true,{'stroke-dasharray':'4 3'});
  if(['trianglePattern','elliottTriangle'].includes(type)&&points.length>=5){infinite(points[0],points[2]);infinite(points[1],points[3]);}
 }
 if(type==='infoLine'){line(group,a.x,a.y,b.x,b.y);const delta=(item.points[1]?.price||0)-item.points[0].price;label(b.x,b.y-8,`${priceText(delta)} · ${Math.abs((item.points[1]?.time||0)-item.points[0].time)/86400|0} д.`);}
 if(['flatTopChannel','flatBottomChannel','disjointChannel'].includes(type)){
  line(group,a.x,a.y,b.x,b.y);const end=type==='disjointChannel'?{x:b.x,y:c.y+(b.y-a.y)*-1}:{x:b.x,y:c.y};
  line(group,a.x,c.y,end.x,end.y);line(group,a.x,(a.y+c.y)/2,b.x,(b.y+end.y)/2,{'stroke-dasharray':'4 3'});
  if(type==='flatTopChannel'||type==='flatBottomChannel'){const y=type==='flatTopChannel'?Math.min(a.y,b.y,c.y):Math.max(a.y,b.y,c.y);line(group,a.x,y,b.x,y);}
 }
 if(['modifiedSchiff','insidePitchfork','pitchfan'].includes(type)){
  const origin=type==='modifiedSchiff'?{x:(a.x+b.x)/2,y:(a.y+b.y)/2}:type==='insidePitchfork'?{x:a.x+(b.x-a.x)/2,y:a.y}:a,mid={x:(b.x+c.x)/2,y:(b.y+c.y)/2};
  if(type==='pitchfan'){for(const r of [0,.25,.5,.75,1])infinite(origin,{x:b.x+(c.x-b.x)*r,y:b.y+(c.y-b.y)*r});}
  else{infinite(origin,mid);for(const p of[b,c])infinite(p,{x:p.x+mid.x-origin.x,y:p.y+mid.y-origin.y});}line(group,b.x,b.y,c.x,c.y);
 }
 if(type==='curve')group.append(el('path',{d:`M ${a.x} ${a.y} Q ${b.x} ${b.y} ${c.x} ${c.y}`}));
 if(type==='doubleCurve')group.append(el('path',{d:`M ${a.x} ${a.y} C ${b.x} ${b.y} ${c.x} ${c.y} ${d.x} ${d.y}`}));
 if(['gannBox','gannSquare'].includes(type)){
  group.append(el('rect',{x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:Math.abs(b.x-a.x),height:Math.abs(b.y-a.y),...fill}));
  for(const r of [.25,.5,.75]){line(group,a.x+(b.x-a.x)*r,a.y,a.x+(b.x-a.x)*r,b.y,{'stroke-dasharray':'3 3'});line(group,a.x,a.y+(b.y-a.y)*r,b.x,a.y+(b.y-a.y)*r,{'stroke-dasharray':'3 3'});}
  line(group,a.x,a.y,b.x,b.y);line(group,a.x,b.y,b.x,a.y);
  if(type==='gannSquare')for(const r of [.25,.5,.75]){line(group,a.x,a.y,b.x,a.y+(b.y-a.y)*r);line(group,a.x,a.y,a.x+(b.x-a.x)*r,b.y);line(group,b.x,b.y,a.x,b.y+(a.y-b.y)*r);line(group,b.x,b.y,b.x+(a.x-b.x)*r,a.y);}
  label(a.x+4,a.y-6,'1 × 1');
 }
 if(type==='gannFan')for(const [i,r]of[.125,.25,.333333,.5,1,2,3,4,8].entries()){const target={x:b.x,y:a.y+(b.y-a.y)*r};infinite(a,target,false,{stroke:color(i)});label(target.x,target.y,r<1?`1:${Math.round(1/r)}`:`${r}:1`,color(i));}
 if(type==='trendFibTime')for(const [i,r]of style.levels.entries()){const x=c.x+(b.x-a.x)*r;line(group,x,0,x,height,{stroke:color(i)});label(x+3,14,String(r),color(i));}
 if(type==='fibSpiral'){
  const radius=Math.hypot(b.x-a.x,b.y-a.y),angle=Math.atan2(b.y-a.y,b.x-a.x),ps=[];
  for(let i=0;i<=240;i++){const theta=i/240*Math.PI*4,r=radius*Math.pow(1.61803398875,(theta-Math.PI*4)/(Math.PI/2));ps.push({x:a.x+Math.cos(angle+theta)*r,y:a.y+Math.sin(angle+theta)*r});}poly(ps);
 }
 if(type==='fibWedge'){
  const radius=Math.hypot(b.x-a.x,b.y-a.y),start=Math.atan2(b.y-a.y,b.x-a.x),end=Math.atan2(c.y-a.y,c.x-a.x);line(group,a.x,a.y,b.x,b.y);line(group,a.x,a.y,c.x,c.y);
  for(const[i,r]of style.levels.filter(v=>v>0).entries()){const ps=[];for(let n=0;n<=60;n++){const theta=start+(end-start)*n/60;ps.push({x:a.x+Math.cos(theta)*radius*r,y:a.y+Math.sin(theta)*radius*r});}poly(ps,{stroke:color(i)});label(ps.at(-1).x,ps.at(-1).y,String(r),color(i));}
 }
 if(['cyclicLines','timeCycles','sinewave'].includes(type)){
  const period=Math.max(12,Math.abs(b.x-a.x)),first=a.x-Math.ceil(a.x/period)*period,count=Math.min(250,Math.ceil(width/period)+2);
  if(type==='cyclicLines')for(let i=0;i<count;i++){const x=first+i*period;line(group,x,0,x,height,{'stroke-dasharray':'4 3'});}
  if(type==='timeCycles')for(let i=0;i<count;i++){const x=first+i*period;group.append(el('path',{d:`M ${x} ${a.y} Q ${x+period/2} ${a.y-Math.max(12,Math.abs(b.y-a.y))*2} ${x+period} ${a.y}`}));}
  if(type==='sinewave'){const ps=[];for(let x=0;x<=width;x+=2)ps.push({x,y:a.y+Math.sin((x-a.x)/period*2*Math.PI)*(b.y-a.y)});poly(ps);}
 }
 if(type==='forecast'){poly(points,{'stroke-dasharray':'5 3'});const last=item.points.at(-1);label(c.x,c.y-10,`Прогноз ${priceText(last.price)} · ${item.points[0].price?((last.price/item.points[0].price-1)*100).toFixed(2):'—'}%`);}
 if(['plus','minus'].includes(type)){line(group,a.x-9,a.y,a.x+9,a.y);if(type==='plus')line(group,a.x,a.y-9,a.x,a.y+9);}
 if(type.startsWith('arrow')&&['arrowUp','arrowDown','arrowLeft','arrowRight'].includes(type)){
  const direction={arrowUp:[0,-1],arrowDown:[0,1],arrowLeft:[-1,0],arrowRight:[1,0]}[type],dx=direction[0],dy=direction[1];line(group,a.x-dx*20,a.y-dy*20,a.x,a.y);line(group,a.x,a.y,a.x-dx*8-dy*7,a.y-dy*8+dx*7);line(group,a.x,a.y,a.x-dx*8+dy*7,a.y-dy*8-dx*7);
 }
 if(type==='flag'){line(group,a.x,a.y,a.x,a.y-28);group.append(el('polygon',{points:`${a.x},${a.y-28} ${a.x+22},${a.y-28} ${a.x+16},${a.y-20} ${a.x+22},${a.y-12} ${a.x},${a.y-12}`,...fill}));}
 if(type==='emoji')group.append(el('text',{x:a.x,y:a.y,'font-size':style.fontSize,fill:style.color,stroke:'none','text-anchor':'middle'},style.emoji));
 if(['note','signpost'].includes(type)){const text=style.text==='Текст'?'Заметка':style.text,w=Math.min(260,Math.max(70,text.length*7));group.append(el('rect',{x:a.x,y:a.y-24,width:w,height:30,rx:type==='note'?3:10,...fill}));if(type==='signpost')line(group,a.x+w/2,a.y+6,a.x+w/2,a.y+34);label(a.x+6,a.y-5,text);}
}
