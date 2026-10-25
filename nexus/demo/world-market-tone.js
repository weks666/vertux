const rgb=value=>/^#[0-9a-f]{6}$/i.test(value||'')?value.slice(1).match(/../g).map(x=>parseInt(x,16)):null;
const hex=values=>'#'+values.map(value=>Math.min(255,Math.max(0,Math.round(value))).toString(16).padStart(2,'0')).join('');
// Native CSS filters compose across the public widget's cross-origin frame.
// Match its #101010 toolbar to the panel's brightness and preserve white.
export const providerToneChannel=(value,{slope,intercept})=>Math.min(255,Math.max(0,value*slope+intercept*255));
export function worldMarketTonePalette(colors){
 const background=rgb(colors.background),panel=rgb(colors.panel),raised=rgb(colors.raised);
 if(colors.theme==='light'||!background||!panel||!raised||Math.max(...background,...panel,...raised)>=96)return null;
 const toolbar=panel.reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
 const slope=(255-toolbar)/239,offset=toolbar-16*slope,brightness=slope+offset/127.5,contrast=slope/brightness;
 const channels=panel.map(()=>({slope,intercept:offset/255}));
 const invert=value=>{const target=rgb(value);return target?hex(target.map((channel,index)=>(channel-channels[index].intercept*255)/channels[index].slope)):value;};
 return {filter:`contrast(${contrast}) brightness(${brightness})`,channels,toolbar,background:invert(colors.background),grid:invert(colors.grid)};
}
export function createWorldMarketTone(host){
 const target=host.querySelector('.terminal-world-frame');
 return {apply(_frame,colors){const palette=worldMarketTonePalette(colors);if(!palette){target.style.removeProperty('filter');return colors;}
  target.style.filter=palette.filter;return {...colors,background:palette.background,grid:palette.grid};
 },dispose(){target.style.removeProperty('filter');}};
}
