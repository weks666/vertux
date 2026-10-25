// Tabs retain their chart state. Slots describe which tab is visible in each
// position; activating a hidden tab replaces the chosen slot, never a neighbour.
export function chartSlots(layout,excluded=new Set()){
 const tabs=layout.tabs.filter(id=>!excluded.has(id));
 const slots=[...new Set((layout.visibleTabs||[]).filter(id=>tabs.includes(id)))].slice(0,layout.count);
 for(const id of tabs)if(slots.length<layout.count&&!slots.includes(id))slots.push(id);
 if(tabs.includes(layout.active)&&!slots.includes(layout.active))slots[Math.max(0,slots.length-1)]=layout.active;
 return slots;
}
export function selectChartSlot(layout,id,{targetId=layout.active,excluded=new Set()}={}){
 const slots=chartSlots(layout,excluded);
 if(!slots.includes(id)){
  const target=slots.indexOf(targetId);
  if(target>=0)slots[target]=id;else if(slots.length<layout.count)slots.push(id);else slots[Math.max(0,slots.length-1)]=id;
 }
 return {...layout,active:id,visibleTabs:slots};
}
