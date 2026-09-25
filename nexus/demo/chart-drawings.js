import {drawingTypes,onePointTools,threePointTools,drawingStyle} from './chart-tool-catalog.js';
import {regressionChannel,snapToCandle} from './chart-geometry.js';
const NS='http://www.w3.org/2000/svg';
const clone=value=>JSON.parse(JSON.stringify(value));
function el(tag,attrs={},text=''){const node=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))node.setAttribute(k,String(v));if(text)node.textContent=text;return node;}
export function validDrawings(items) {
 return (Array.isArray(items)?items:[]).slice(0,80).filter(item=>item&&drawingTypes.includes(item.type)
  &&Array.isArray(item.points)&&item.points.length>=(onePointTools.includes(item.type)?1:threePointTools.includes(item.type)?3:2)&&item.points.length<=500&&item.points.every(p=>Number.isFinite(p.time)&&Number.isFinite(p.price)));
}
/** Annotations never become price series: drawing cannot rescale its own coordinates. */
export function createDrawingLayer({host,chart,getSeries,getRows,onChange=()=>{},onMode=()=>{},onSelect=()=>{},getDefaults=type=>drawingStyle({},type),onStyle=()=>{}}) {
 const svg=el('svg',{'class':'chart-drawings','aria-label':'Разметка графика'});host.append(svg);
 let drawings=[],undo=[],redo=[],mode=null,start=null,preview=null,selected=null,drag=null,frame=0,dead=false,alerts=[],events=[],scenario=null,hidden=false;
 let magnet=false;const defaults=type=>drawingStyle(getDefaults(type),type);
 const select=id=>{selected=id;onSelect(drawings.find(d=>d.id===id)||null);schedule();};
 const save=()=>{onChange(clone(drawings));};
 function commit(next){undo.push(clone(drawings));if(undo.length>60)undo.shift();redo=[];drawings=validDrawings(next);save();schedule();}
 function timeX(time){const scale=chart.timeScale(),rows=getRows();if(!rows.length)return null;
  const exact=scale.timeToCoordinate(time);if(exact!==null)return exact;
  let i=rows.findIndex(r=>r.time>=time);if(i<0)i=rows.length-1;
  const a=rows[Math.max(0,i-1)],b=rows[Math.min(rows.length-1,Math.max(1,i))],ax=scale.timeToCoordinate(a.time),bx=scale.timeToCoordinate(b.time);
  return b.time!==a.time&&ax!==null&&bx!==null?ax+(bx-ax)*(time-a.time)/(b.time-a.time):ax;
 }
 function at(event){const rect=host.getBoundingClientRect(),scale=chart.timeScale();
  const x=Math.max(0,Math.min(scale.width(),event.clientX-rect.left)),y=Math.max(0,Math.min(plotHeight(),event.clientY-rect.top));
  const rows=getRows(),price=getSeries().coordinateToPrice(y);if(price===null||!rows.length)return null;
  if(rows.length===1){const point={time:rows[0].time,price};return magnet?snapToCandle(rows,point.time,point.price):point;}
  // Use screen positions from the shared time axis; comparison bars may insert dates.
  let lo=0,hi=rows.length-1;while(lo<hi){const mid=Math.floor((lo+hi)/2);if(timeX(rows[mid].time)<x)lo=mid+1;else hi=mid;}
  const i=Math.max(1,Math.min(rows.length-1,lo)),a=rows[Math.max(0,i-1)],b=rows[i],ax=timeX(a.time),bx=timeX(b.time);
  const point={time:bx!==ax?a.time+(b.time-a.time)*(x-ax)/(bx-ax):a.time,price};
  return magnet?snapToCandle(rows,point.time,point.price):point;
 }
 const xy=p=>({x:timeX(p.time),y:getSeries().priceToCoordinate(p.price)});
 const plotHeight=()=>chart.panes?.()[0]?.getHeight()||host.clientHeight-28;
 function line(group,x1,y1,x2,y2,attrs={}){group.append(el('line',{x1,y1,x2,y2,...attrs}));}
 function shape(item,ghost=false){const points=item.points.map(xy);if(points.some(p=>p.x===null||p.y===null))return;
  const a=points[0],b=points[1]||a,c=points[2]||b,style=drawingStyle(item.style,item.type),width=chart.timeScale().width(),height=plotHeight(),group=el('g',{'data-drawing-id':item.id,'data-drawing-type':item.type,'class':`drawing-object${selected===item.id?' selected':''}${ghost?' preview':''}`,'fill':'none','stroke':style.color,'stroke-width':style.width,opacity:style.opacity,'stroke-dasharray':style.dash==='dash'?'6 4':style.dash==='dot'?'2 3':''});
  const levelColor=i=>style.multicolor?style.levelColors[i%style.levelColors.length]:style.color;
  const label=(x,y,text,color=style.color)=>group.append(el('text',{x:Math.max(4,Math.min(width-100,x)),y:Math.max(12,Math.min(height-4,y)),fill:color,stroke:'none','font-size':11},text));
  const priceText=price=>price.toLocaleString('ru-RU',{maximumFractionDigits:6});
  function infinite(left,right,both=false,attrs={}){const dx=right.x-left.x,dy=right.y-left.y,length=Math.hypot(dx,dy);if(length<.5)return;const reach=Math.hypot(width,height)*4,ux=dx/length,uy=dy/length;line(group,both?left.x-ux*reach:left.x,both?left.y-uy*reach:left.y,right.x+ux*reach,right.y+uy*reach,attrs);}
  if(['horizontal','horizontalRay','cross'].includes(item.type)){line(group,item.type==='horizontalRay'?a.x:0,a.y,width,a.y);if(style.prices)label(width-100,a.y-4,priceText(item.points[0].price));}
  if(['vertical','cross'].includes(item.type))line(group,a.x,0,a.x,height);
  if(['trend','arrow','doubleArrow','trendAngle','ray','extended'].includes(item.type)){
   if(item.type==='ray'||item.type==='extended')infinite(a,b,item.type==='extended');else line(group,a.x,a.y,b.x,b.y);
   if(['arrow','doubleArrow'].includes(item.type)){const angle=Math.atan2(b.y-a.y,b.x-a.x);line(group,b.x,b.y,b.x-11*Math.cos(angle-.45),b.y-11*Math.sin(angle-.45));line(group,b.x,b.y,b.x-11*Math.cos(angle+.45),b.y-11*Math.sin(angle+.45));}
   if(item.type==='doubleArrow'){const angle=Math.atan2(a.y-b.y,a.x-b.x);line(group,a.x,a.y,a.x-11*Math.cos(angle-.45),a.y-11*Math.sin(angle-.45));line(group,a.x,a.y,a.x-11*Math.cos(angle+.45),a.y-11*Math.sin(angle+.45));}
   if(item.type==='trendAngle')label(b.x,b.y-8,(-Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI).toFixed(1)+'°');
  }
  if(['rectangle','priceRange','dateRange','measure'].includes(item.type))group.append(el('rect',{x:Math.min(a.x,b.x),y:item.type==='dateRange'?0:Math.min(a.y,b.y),width:item.type==='priceRange'?60:Math.abs(b.x-a.x),height:item.type==='dateRange'?height:Math.abs(b.y-a.y),fill:style.color,'fill-opacity':style.fill}));
  if(item.type==='ellipse')group.append(el('ellipse',{cx:(a.x+b.x)/2,cy:(a.y+b.y)/2,rx:Math.abs(b.x-a.x)/2,ry:Math.abs(b.y-a.y)/2,fill:style.color,'fill-opacity':style.fill}));
  if(item.type==='circle')group.append(el('circle',{cx:a.x,cy:a.y,r:Math.hypot(b.x-a.x,b.y-a.y),fill:style.color,'fill-opacity':style.fill}));
  if(['rotatedRectangle','parallelogram'].includes(item.type)){const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy||1,n=((c.x-a.x)*(-dy)+(c.y-a.y)*dx)/den,offset=item.type==='rotatedRectangle'?{x:-dy*n,y:dx*n}:{x:c.x-b.x,y:c.y-b.y};group.append(el('polygon',{points:[a,b,{x:b.x+offset.x,y:b.y+offset.y},{x:a.x+offset.x,y:a.y+offset.y}].map(p=>`${p.x},${p.y}`).join(' '),fill:style.color,'fill-opacity':style.fill}));}
  if(item.type==='arc')group.append(el('path',{d:`M ${a.x} ${a.y} Q ${b.x} ${b.y} ${c.x} ${c.y}`}));
  if(item.type==='horizontalChannel'){for(const y of[a.y,(a.y+b.y)/2,b.y])line(group,0,y,width,y);group.append(el('rect',{x:0,y:Math.min(a.y,b.y),width,height:Math.abs(b.y-a.y),fill:style.color,'fill-opacity':style.fill}));}
  if(item.type==='callout'){line(group,a.x,a.y,b.x,b.y);label(b.x,b.y-5,style.text);}
  if(item.type==='priceLabel'){line(group,a.x,a.y,Math.min(width,a.x+80),a.y);label(a.x,a.y-5,priceText(item.points[0].price));}
  if(item.type==='triangle')group.append(el('polygon',{points:points.map(p=>`${p.x},${p.y}`).join(' '),fill:style.color,'fill-opacity':style.fill}));
  if(['measure','priceRange','dateRange'].includes(item.type)){const delta=item.points[1].price-item.points[0].price,days=Math.abs(item.points[1].time-item.points[0].time)/86400;label(b.x,b.y-8,(item.type==='dateRange'?'':priceText(delta)+' ('+(item.points[0].price?100*delta/item.points[0].price:0).toFixed(2)+'%) ')+(item.type==='priceRange'?'':days.toFixed(1)+' д.'));}
  if(item.type==='text')label(a.x,a.y,style.text);
  if(item.type==='channel'||item.type==='fibChannel'){const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1,nx=-dy/length,ny=dx/length,distance=(c.x-a.x)*nx+(c.y-a.y)*ny,levels=item.type==='channel'?[0,.5,1]:style.levels;for(const [i,level]of levels.entries()){const color=item.type==='fibChannel'?levelColor(i):style.color,left={x:a.x+nx*distance*level,y:a.y+ny*distance*level},right={x:b.x+nx*distance*level,y:b.y+ny*distance*level};if(style.extend)infinite(left,right,false,{stroke:color});else line(group,left.x,left.y,right.x,right.y,{stroke:color});if(item.type==='fibChannel')label(right.x,right.y,String(level)+(style.prices?' · '+priceText(getSeries().coordinateToPrice(right.y)):''),color);}}
  if(['freehand','highlighter'].includes(item.type))group.append(el('polyline',{points:points.map(p=>`${p.x},${p.y}`).join(' '),'stroke-linejoin':'round','stroke-linecap':'round'}));
  if(item.type==='fibonacci'||item.type==='fibExtension'){
   const left=Math.min(a.x,b.x),right=style.extend?width:Math.max(a.x,b.x,c.x);let previousY=null;
   style.levels.forEach((ratio,i)=>{const value=item.type==='fibonacci'?item.points[0].price+(item.points[1].price-item.points[0].price)*ratio:(item.points[2]||item.points[1]).price+(item.points[1].price-item.points[0].price)*ratio,y=getSeries().priceToCoordinate(value),color=levelColor(i);
    if(previousY!==null)group.append(el('rect',{x:left,y:Math.min(previousY,y),width:Math.max(0,right-left),height:Math.abs(y-previousY),fill:color,'fill-opacity':style.fill,stroke:'none'}));
    line(group,left,y,right,y,{stroke:color});label(right+4,y-3,String(ratio)+(style.prices?' · '+priceText(value):''),color);previousY=y;
   });
  }
  if(item.type==='fibFan')for(const [i,ratio]of style.levels.entries()){group.setAttribute('stroke',style.color);const end={x:b.x,y:a.y+(b.y-a.y)*ratio};infinite(a,end,false,{stroke:levelColor(i)});label(end.x,end.y,String(ratio)+(style.prices?' · '+priceText(getSeries().coordinateToPrice(end.y)):''),levelColor(i));}
  if(item.type==='fibTime')for(const [i,n]of style.levels.entries()){const x=a.x+(b.x-a.x)*n;line(group,x,0,x,height,{stroke:levelColor(i)});label(x+3,14,String(n),levelColor(i));}
  if(['pitchfork','schiffPitchfork'].includes(item.type)){
   const origin=item.type==='schiffPitchfork'?{x:a.x,y:(a.y+b.y)/2}:a,mid={x:(b.x+c.x)/2,y:(b.y+c.y)/2};
   infinite(origin,mid);for(const p of [b,c])infinite(p,{x:p.x+mid.x-origin.x,y:p.y+mid.y-origin.y});line(group,b.x,b.y,c.x,c.y);
  }
  if(['fibArcs','fibCircles'].includes(item.type)){
   const radius=Math.hypot(b.x-a.x,b.y-a.y);
   for(const [i,ratio]of style.levels.filter(n=>n>0).entries()){const r=radius*ratio;
    if(item.type==='fibCircles')group.append(el('circle',{cx:a.x,cy:a.y,r,stroke:levelColor(i)}));
    else group.append(el('path',{d:`M ${b.x-r} ${b.y} A ${r} ${r} 0 0 ${b.y>a.y?1:0} ${b.x+r} ${b.y}`,stroke:levelColor(i)}));
    label((item.type==='fibCircles'?a.x:b.x)+r,(item.type==='fibCircles'?a.y:b.y)-4,String(ratio),levelColor(i));
   }
  }
  if(item.type==='regression'){
   const fit=regressionChannel(getRows(),item.points[0].time,item.points[1].time);
   if(fit)for(const offset of [-2,0,2]){const start=xy({time:fit.from,price:fit.start+offset*fit.sigma}),end=xy({time:fit.to,price:fit.end+offset*fit.sigma});
    line(group,start.x,start.y,end.x,end.y,offset?{'stroke-dasharray':'4 3'}:{});}
  }
  if(['longPosition','shortPosition'].includes(item.type)){
   const direction=item.type==='longPosition'?1:-1,entry=item.points[0].price;
   const risk=(entry-item.points[1].price)*direction,reward=((item.points[2]?.price??entry)-entry)*direction;
   const x=Math.min(a.x,b.x,c.x),right=Math.max(a.x,b.x,c.x);
   if(risk>0&&reward>0){for(const[p,color]of[[b,'#ef7b76'],[c,'#5ed0a0']])group.append(el('rect',{x,y:Math.min(a.y,p.y),width:Math.max(30,right-x),height:Math.abs(p.y-a.y),fill:color,'fill-opacity':.16,stroke:color}));
    line(group,x,a.y,Math.max(right,x+30),a.y);label(x,a.y-5,'Риск / цель 1 : '+(reward/risk).toFixed(2));
   }else label(a.x,a.y,'Укажите вход, стоп, затем цель');
  }
  if(item.type==='anchoredVwap'){
   let total=0,weighted=0;const values=[];
   for(const row of getRows().filter(r=>r.time>=item.points[0].time)){total+=row.volume;weighted+=(row.high+row.low+row.close)/3*row.volume;if(total>0)values.push(xy({time:row.time,price:weighted/total}));}
   if(values.length)group.append(el('polyline',{points:values.map(p=>`${p.x},${p.y}`).join(' ')}));
  }
  // Broad invisible stroke is only a pointer target, never the visible stroke.
  if(!ghost)for(const node of [...group.children].filter(n=>n.tagName!=='text')){const hit=node.cloneNode(true);hit.setAttribute('class','drawing-hit');hit.setAttribute('stroke','transparent');hit.setAttribute('stroke-width','12');hit.setAttribute('fill','none');group.append(hit);}
  if(selected===item.id&&!ghost&&!['freehand','highlighter'].includes(item.type))points.forEach((p,i)=>group.append(el('circle',{cx:p.x,cy:p.y,r:4,fill:'var(--chart-bg, #0d141e)','data-handle':i})));
  svg.append(group);
 }
 function render(){frame=0;if(dead)return;svg.replaceChildren();const width=chart.timeScale().width(),height=plotHeight();svg.setAttribute('width',width);svg.setAttribute('height',height);svg.style.width=width+'px';svg.style.height=height+'px';
  if(scenario&&[scenario.entry,scenario.stop,scenario.target].every(Number.isFinite)){
   const y=getSeries().priceToCoordinate(scenario.entry),stop=getSeries().priceToCoordinate(scenario.stop),target=getSeries().priceToCoordinate(scenario.target),x=width*.66;
   if([y,stop,target].every(Number.isFinite)){for(const[end,color]of[[stop,'#ef7b76'],[target,'#5ed0a0']])svg.append(el('rect',{x,y:Math.min(y,end),width:width-x,height:Math.abs(y-end),fill:color+'20'}));
    for(const[py,label,color]of[[y,'Вход '+scenario.entry,'#b9a9ff'],[stop,'Стоп '+scenario.stop,'#ef7b76'],[target,'Цель '+scenario.target,'#5ed0a0']]){line(svg,x,py,width,py,{stroke:color,'stroke-width':1,'stroke-dasharray':'5 3'});svg.append(el('text',{x:x+6,y:py-5,fill:color,'font-size':11},label));}}
  }
  if(!hidden){drawings.filter(d=>!d.hidden).forEach(d=>shape(d));if(preview)shape(preview,true);}
  for(const alert of alerts.filter(a=>a.enabled!==false)){const y=getSeries().priceToCoordinate(Number(alert.targetPrice));if(y===null||y<0||y>height)continue;
   const group=el('g',{'class':'chart-alert-mark','role':'button','tabindex':0,'aria-label':`Уведомление ${alert.targetPrice}. ${alert.note||''}`});
   line(group,0,y,width,y,{stroke:'#b9a9ff','stroke-width':1,'stroke-dasharray':'4 4'});
   group.append(el('rect',{x:width-30,y:y-11,width:28,height:22,rx:4,fill:'#31274b',stroke:'#b9a9ff'}));
   group.append(el('path',{d:`M${width-21} ${y+3}h12l-2-3v-3a4 4 0 0 0-8 0v3z M${width-17} ${y+6}h4`,fill:'none',stroke:'#c8bcff','stroke-width':1.5}));
   group.append(el('title',{},`${alert.targetPrice} · ${alert.condition==='below'?'Ниже':'Выше'}\n${alert.note||'Без комментария'}`));svg.append(group);
  }
  for(const event of events){const rows=getRows();if(!rows.length||event.time<rows[0].time||event.time>rows.at(-1).time)continue;const x=timeX(event.time);if(x===null||x<0||x>width)continue;const group=el('g',{'class':'chart-event-mark',tabindex:0,role:'button','aria-label':event.title});
   line(group,x,0,x,height-16,{stroke:'#9a7cff60','stroke-dasharray':'3 5'});group.append(el('circle',{cx:x,cy:height-12,r:8,fill:'#302744',stroke:'#b9a9ff'}));group.append(el('text',{x,y:height-8,'text-anchor':'middle',fill:'#fff','font-size':10},'•'));group.append(el('title',{},event.title));svg.append(group);}
 }
 function schedule(){if(!frame&&!dead)frame=requestAnimationFrame(render);}
 function setMode(value){mode=value;start=null;preview=null;drag=null;svg.classList.toggle('drawing-active',Boolean(mode));chart.applyOptions({handleScroll:!mode,handleScale:!mode});onMode(mode);schedule();}
 function down(event){if(event.button!==0)return;const object=event.target.closest?.('[data-drawing-id]'),point=at(event);if(!point)return;
  if(object&&!mode){select(object.dataset.drawingId);const original=drawings.find(d=>d.id===selected);if(original.locked){schedule();return;}drag={original:clone(original),origin:point,handle:event.target.hasAttribute('data-handle')?Number(event.target.getAttribute('data-handle')):null};chart.applyOptions({handleScroll:false,handleScale:false});svg.setPointerCapture(event.pointerId);event.stopPropagation();schedule();return;}
  if(mode==='erase'){if(object)commit(drawings.filter(d=>d.id!==object.dataset.drawingId));return;}
  if(!mode){select(null);schedule();return;}event.preventDefault();event.stopPropagation();host.focus({preventScroll:true});
  if(drawings.length>=80){setMode(null);return;}
  if(onePointTools.includes(mode)){const item={id:crypto.randomUUID(),type:mode,points:[point],style:clone(defaults(mode))};commit([...drawings,item]);setMode(null);select(item.id);return;}
  if(['freehand','highlighter'].includes(mode)){start=point;preview={id:crypto.randomUUID(),type:mode,points:[point],style:clone(defaults(mode))};svg.setPointerCapture(event.pointerId);return;}
  if(!start){start=point;preview={id:crypto.randomUUID(),type:mode,points:[point,point],style:clone(defaults(mode))};}
  else {preview.points[preview.points.length-1]=point;if(threePointTools.includes(mode)&&preview.points.length===2){preview.points.push(point);schedule();return;}const id=preview.id;commit([...drawings,preview]);setMode(null);select(id);}
 }
 function move(event){const point=at(event);if(!point)return;
  if(drag){const item=drawings.find(d=>d.id===selected);if(drag.handle!==null)item.points[drag.handle]=point;else item.points=drag.original.points.map(p=>({time:p.time+point.time-drag.origin.time,price:p.price+point.price-drag.origin.price}));schedule();return;}
  if(preview){if(['freehand','highlighter'].includes(mode)){if(event.buttons&&preview.points.length<500)preview.points.push(point);}else preview.points[preview.points.length-1]=point;schedule();}
 }
 function up(){if(drag){const original=drag.original;undo.push(drawings.map(d=>d.id===original.id?original:clone(d)));redo=[];drag=null;chart.applyOptions({handleScroll:true,handleScale:true});save();schedule();}
  else if(['freehand','highlighter'].includes(mode)&&preview){if(preview.points.length>1)commit([...drawings,preview]);setMode(null);}}
 function key(event){if(['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName))return;
  if(event.key==='Escape'){setMode(null);select(null);schedule();}
  if(['Delete','Backspace'].includes(event.key)&&selected){event.preventDefault();commit(drawings.filter(d=>d.id!==selected));selected=null;}
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();history(event.shiftKey?'redo':'undo');}
 }
 function history(kind){const source=kind==='undo'?undo:redo,target=kind==='undo'?redo:undo;if(!source.length)return;target.push(clone(drawings));drawings=source.pop();setMode(null);save();schedule();}
 const cancel=()=>{if(drag){drawings=drawings.map(d=>d.id===drag.original.id?drag.original:d);drag=null;}setMode(null);};
 svg.addEventListener('pointerdown',down);svg.addEventListener('pointermove',move);svg.addEventListener('pointerup',up);svg.addEventListener('pointercancel',cancel);host.addEventListener('keydown',key);host.addEventListener('pointermove',schedule);host.addEventListener('wheel',schedule,{passive:true});
 chart.timeScale().subscribeVisibleLogicalRangeChange(schedule);chart.subscribeCrosshairMove(schedule);const resize=new ResizeObserver(schedule);resize.observe(host);schedule();
 return {setMode,undo:()=>history('undo'),redo:()=>history('redo'),clear:()=>{commit([]);setMode(null);},hide(value){hidden=value;save();schedule();},isHidden:()=>hidden,setMagnet(value){magnet=value===true;save();},isMagnet:()=>magnet,
  getState:()=>clone(drawings),getSelected:()=>clone(drawings.find(d=>d.id===selected)||null),select,
  editSelected(patch){const item=drawings.find(d=>d.id===selected);if(!item)return;const next={...item,...patch,style:drawingStyle({...item.style,...patch.style},item.type)};if(patch.style)onStyle(item.type,next.style);commit(drawings.map(d=>d.id===selected?next:d));select(selected);},
  deleteSelected(){if(selected){commit(drawings.filter(d=>d.id!==selected));select(null);}},
  duplicateSelected(){const item=drawings.find(d=>d.id===selected);if(item&&drawings.length<80){const copy={...clone(item),id:crypto.randomUUID()};commit([...drawings,copy]);select(copy.id);}},
  setState(items){drawings=clone(validDrawings(items));undo=[];redo=[];select(null);schedule();},
  setContext(value){alerts=value.alerts||[];events=value.events||[];scenario=value.scenario||null;schedule();},refresh:schedule,
  destroy(){dead=true;cancelAnimationFrame(frame);resize.disconnect();chart.timeScale().unsubscribeVisibleLogicalRangeChange(schedule);chart.unsubscribeCrosshairMove(schedule);host.removeEventListener('keydown',key);host.removeEventListener('pointermove',schedule);host.removeEventListener('wheel',schedule);svg.remove();}};
}
