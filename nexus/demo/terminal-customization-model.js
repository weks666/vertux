export function normalizeTerminalCustomization(value={}){
 const d={position:0,width:12,visible:true,locked:false,tickerEdge:'top',palette:'left',controls:'top',fields:['change','high','low','volume']};
 if(!value||typeof value!=='object'||Array.isArray(value))return d;
 const width=Number.isInteger(value.width)&&value.width>=4&&value.width<=12?value.width:d.width;
 const fine=Number.isInteger(value.widthPercent)&&value.widthPercent>=33&&value.widthPercent<=100&&Number.isInteger(value.positionPercent)&&value.positionPercent>=0&&value.positionPercent<=100-value.widthPercent?{widthPercent:value.widthPercent,positionPercent:value.positionPercent}:{};
 return {position:Number.isInteger(value.position)&&value.position>=0&&value.position<=12-width?value.position:d.position,width,...fine,
  visible:typeof value.visible==='boolean'?value.visible:d.visible,locked:typeof value.locked==='boolean'?value.locked:d.locked,
  tickerEdge:['top','bottom'].includes(value.tickerEdge)?value.tickerEdge:d.tickerEdge,palette:['left','right','top','bottom'].includes(value.palette)?value.palette:d.palette,
  controls:['top','bottom'].includes(value.controls)?value.controls:d.controls,fields:Array.isArray(value.fields)?[...new Set(value.fields.filter(k=>d.fields.includes(k)))]:d.fields};
}
