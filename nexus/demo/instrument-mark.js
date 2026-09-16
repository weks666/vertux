const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const colors=['#26344b','#373052','#193c36','#493133','#38401f'];
export function instrumentMark(row,display=row) {
  const ticker=display.ticker||display.name||'·';
  const index=[...ticker].reduce((sum,char)=>sum+char.codePointAt(0),0)%colors.length;
  const image=row.logoName?`<img src="/api/instrument-logos/${encodeURIComponent(row.logoName)}" alt="" loading="lazy" decoding="async">`:'';
  return `<span class="instrument-mark" aria-hidden="true" style="--mark-bg:${colors[index]}">${escape(ticker.slice(0,2))}${image}</span>`;
}
export function watchInstrumentImages(root) {
  for(const image of root.querySelectorAll('.instrument-mark img')) {
    image.addEventListener('error',()=>{image.hidden=true;},{once:true});
    if(image.complete&&!image.naturalWidth)image.hidden=true;
  }
}
