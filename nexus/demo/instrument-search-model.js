const text=value=>String(value??'').trim();
const lower=value=>text(value).toLocaleLowerCase('ru');
export function instrumentExchangeLabel(row={}) {
 const exchange=text(row.exchange),venue=exchange.toUpperCase(),real=text(row.realExchange).toUpperCase();
 const confirmed=({REAL_EXCHANGE_MOEX:'Мосбиржа',REAL_EXCHANGE_RTS:'СПБ Биржа',REAL_EXCHANGE_OTC:'Внебиржевой рынок',REAL_EXCHANGE_DEALER:'Площадка брокера'})[real];
 if(confirmed)return confirmed;
 if(/^MOEX(?:_|$)/u.test(venue))return 'Мосбиржа';
 if(/^SPB(?:_|$)/u.test(venue))return 'СПБ Биржа';
 return ({BYBIT:'Bybit',BINANCE:'Binance',NASDAQ:'NASDAQ',NYSE:'NYSE',HKEX:'HKEX'})[venue]||(/^[A-Z0-9 -]{2,30}$/u.test(venue)&&!/(UNSPECIFIED|UNKNOWN)/u.test(venue)?exchange:'');
}
export function instrumentListingLabel(row={}) {
 return [...new Set([row.chartProvider==='tradingview'?'TradingView':null,row.classCode,instrumentExchangeLabel(row),row.currency&&text(row.currency).toUpperCase()].map(text).filter(Boolean))].join(' · ');
}
// Identity is the catalog UID. Equal tickers can denote different listings.
export function instrumentSearchMatches(rows,query='',limit=Infinity) {
 const normalized=lower(query),terms=normalized.split(/\s+/u).filter(Boolean),seen=new Set();
 return rows.filter(row=>{
  if(!row?.instrumentUid||seen.has(row.instrumentUid))return false;
  seen.add(row.instrumentUid);
  const searchable=[row.ticker,row.name,row.instrumentUid,row.isin,row.classCode,row.exchange,row.currency,row.searchAliases,row.chartProvider,instrumentExchangeLabel(row)].map(lower).join(' ');
  return terms.every(term=>searchable.includes(term));
 }).sort((a,b)=>Number(lower(b.ticker)===normalized)-Number(lower(a.ticker)===normalized)
  ||Number(b.classCode==='TQBR')-Number(a.classCode==='TQBR')
  ||Number(b.inPortfolio===true)-Number(a.inPortfolio===true)
  ||text(a.ticker).localeCompare(text(b.ticker),'ru')
  ||instrumentListingLabel(a).localeCompare(instrumentListingLabel(b),'ru')
  ||text(a.instrumentUid).localeCompare(text(b.instrumentUid),'ru')).slice(0,limit);
}
