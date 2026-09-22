const plain = value => String(value ?? '').replace(/&(?:amp|lt|gt|quot|apos|#39|#(\d{1,6})|#x([a-fA-F0-9]{1,6}));/g, (match,decimal,hex) => {
  if(decimal||hex){const code=parseInt(decimal||hex,hex?16:10);return code>0&&code<=0x10ffff?String.fromCodePoint(code):match;}
  return {'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&#39;':"'"}[match]||match;
});
/** Deduplicate exact instruments only; different trading venues retain their identity. */
export function marketWatchlist(catalog, holdings, favorites = new Set()) {
  const known = new Map();
  for(const row of catalog || []) if(row.instrumentUid) known.set(row.instrumentUid,{...row,name:plain(row.name)});
  for(const row of holdings || []) if(row.instrumentUid) known.set(row.instrumentUid,{...row,...known.get(row.instrumentUid),inPortfolio:true});
  return [...known.values()].map(row=>({...row,name:plain(row.name)})).sort((a,b)=>
    Number(favorites.has(b.instrumentUid))-Number(favorites.has(a.instrumentUid)) || Number(!!b.inPortfolio)-Number(!!a.inPortfolio)
    || plain(a.ticker||a.name).localeCompare(plain(b.ticker||b.name),'ru'));
}
