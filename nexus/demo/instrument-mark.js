const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Public issuer assets, bundled for offline use. No requests to TradingView.
const issuers = {
  SBER:{image:'sber',name:'Сбербанк'}, SBERP:{image:'sber',name:'Сбербанк, прив.'},
  AAPL:{image:'apple',name:'Apple Inc.'}, LKOH:{image:'lukoil',name:'ЛУКОЙЛ'},
  GAZP:{image:'gazprom',name:'Газпром'}, YDEX:{image:'yandex',name:'Яндекс'}, YNDX:{image:'yandex',name:'Яндекс'},
};
const categories = {
  metal:'<path d="m5 9 3-4h8l3 4 3 10H2L5 9Zm0 0h14M8 5l2 4-2 10M16 5l-2 4 2 10"/>',
  currency:'<path d="M12 2v20M17 6H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H6"/>',
  share:'<path d="M4 21V8l8-5 8 5v13M8 9h1m6 0h1M8 13h1m6 0h1M8 17h1m6 0h1M2 21h20"/>',
  future:'<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
};
export function issuerName(ticker, name) {
  const symbol=String(ticker||'').toUpperCase();
  return (!name || String(name).toUpperCase()===symbol) ? issuers[symbol]?.name || name || ticker : name;
}
export function instrumentLogo(row={}, display=row) {
  const bundled=issuers[String(display.ticker||row.ticker||'').toUpperCase()]?.image;
  const logoName=display.logoName||row.logoName;
  return bundled?`./assets/issuers/${bundled}.png`:typeof logoName==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}\.png$/.test(logoName)?`/api/instrument-logos/${encodeURIComponent(logoName)}`:null;
}
export function instrumentMark(row,display=row) {
  const ticker=String(display.ticker||row.ticker||'').toUpperCase();
  const bundled=issuers[ticker]?.image;
  const logoName=display.logoName||row.logoName;
  const safeLogo=typeof logoName==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}\.png$/.test(logoName)?logoName:null;
  const imageSource=bundled?`./assets/issuers/${bundled}.png`:safeLogo?`/api/instrument-logos/${encodeURIComponent(safeLogo)}`:null;
  const category=/^(GOLD|SILV|XAU|XAG|GLD)/.test(ticker)?'metal':/^(SI[-H-Z]|USD|EUR|CNY)/.test(ticker)?'currency':row.assetType==='future'?'future':'share';
  const image=imageSource?`<img src="${escape(imageSource)}" alt="" loading="lazy" decoding="async">`:'';
  return `<span class="instrument-mark mark-${category}${bundled?' mark-'+bundled:''}" aria-hidden="true"><svg viewBox="0 0 24 24">${categories[category]}</svg>${image}</span>`;
}
export function watchInstrumentImages(root) {
  for(const image of root.querySelectorAll('.instrument-mark img')) {
    image.addEventListener('error',()=>{image.hidden=true;},{once:true});
    if(image.complete&&!image.naturalWidth)image.hidden=true;
  }
}
