// Public display references, never broker instrument IDs or portfolio data.
export const validWorldSymbol=value=>typeof value==='string'&&/^[A-Z0-9_]{1,24}:[A-Z0-9_][A-Z0-9_.!/-]{0,39}$/.test(value);
export const worldSymbol=value=>{
 const uid=typeof value==='string'?value:value?.instrumentUid;
 return typeof uid==='string'&&uid.startsWith('tv:')&&validWorldSymbol(uid.slice(3))?uid.slice(3):null;
};
export const isWorldInstrument=value=>worldSymbol(value)!==null;
export function worldInstrument(symbol,name=symbol,assetType='external',aliases=''){
 if(!validWorldSymbol(symbol))throw new TypeError('Invalid public market symbol');
 return {instrumentUid:'tv:'+symbol,ticker:symbol.split(':')[1],name,exchange:symbol.split(':')[0],assetType,chartProvider:'tradingview',searchAliases:aliases};
}
const references=[
 ['OANDA:XAUUSD','Золото / доллар США','metal','gold золото xau'],
 ['OANDA:XAGUSD','Серебро / доллар США','metal','silver серебро xag'],
 ['OANDA:XPTUSD','Платина / доллар США','metal','platinum платина'],
 ['OANDA:XPDUSD','Палладий / доллар США','metal','palladium палладий'],
 ['FX:EURUSD','Евро / доллар США','currency','eurusd евро доллар'],
 ['FX:GBPUSD','Фунт / доллар США','currency','gbpusd фунт доллар'],
 ['FX:USDJPY','Доллар США / иена','currency','usdjpy доллар йена иена'],
 ['FX:USDCHF','Доллар США / швейцарский франк','currency'],
 ['FX:AUDUSD','Австралийский доллар / доллар США','currency'],
 ['FX:USDCAD','Доллар США / канадский доллар','currency'],
 ['FX:NZDUSD','Новозеландский доллар / доллар США','currency'],
 ['FX:EURGBP','Евро / фунт','currency'],['FX:EURJPY','Евро / иена','currency'],
 ['FX:GBPJPY','Фунт / иена','currency'],['OANDA:USDCNH','Доллар США / офшорный юань','currency'],
 ['OANDA:SPX500USD','S&P 500 · CFD','index','sp500 американский индекс'],
 ['OANDA:NAS100USD','Nasdaq 100 · CFD','index','насдак индекс'],
 ['OANDA:US30USD','Dow Jones 30 · CFD','index','доу джонс индекс'],
 ['OANDA:DE30EUR','Германия 30 · CFD','index','dax дакс индекс'],
 ['OANDA:UK100GBP','Великобритания 100 · CFD','index','ftse индекс'],
 ['OANDA:JP225USD','Япония 225 · CFD','index','nikkei никкей индекс'],
 ['OANDA:BCOUSD','Нефть Brent · CFD','commodity','брент нефть oil'],
 ['OANDA:WTICOUSD','Нефть WTI · CFD','commodity','нефть oil'],
 ['OANDA:NATGASUSD','Природный газ · CFD','commodity','gas газ'],
 ['COMEX:GC1!','Золото · непрерывный фьючерс','future','gold фьючерс золото'],
 ['COMEX:SI1!','Серебро · непрерывный фьючерс','future','silver фьючерс серебро'],
 ['NYMEX:CL1!','Нефть WTI · непрерывный фьючерс','future','oil нефть'],
 ['NASDAQ:AAPL','Apple','share','эппл айфон'],['NASDAQ:NVDA','NVIDIA','share','нвидиа'],
 ['NASDAQ:MSFT','Microsoft','share','майкрософт'],['NASDAQ:GOOGL','Alphabet (Google)','share','гугл'],
 ['NASDAQ:AMZN','Amazon','share','амазон'],['NASDAQ:TSLA','Tesla','share','тесла'],
 ['NASDAQ:META','Meta Platforms','share','мета фейсбук'],['NASDAQ:AMD','Advanced Micro Devices','share'],
 ['NYSE:KO','Coca-Cola','share','кока кола'],['NYSE:BABA','Alibaba','share','алибаба'],
 ['AMEX:SPY','SPDR S&P 500 ETF','etf'],['NASDAQ:QQQ','Invesco QQQ ETF','etf'],
 ['AMEX:GLD','SPDR Gold Shares ETF','etf','золото gold фонд'],
 ['BINANCE:BTCUSDT','Bitcoin / USDT','crypto','биткоин bitcoin btc'],
 ['BINANCE:ETHUSDT','Ethereum / USDT','crypto','эфир эфириум ethereum'],
 ...['SOL','BNB','XRP','ADA','DOGE','AVAX','DOT','LINK','LTC','BCH','TRX','TON','SUI'].map(t=>['BINANCE:'+t+'USDT',t+' / USDT','crypto']),
 ['COINBASE:BTCUSD','Bitcoin / доллар США','crypto','биткоин'],
 ['COINBASE:ETHUSD','Ethereum / доллар США','crypto','эфир'],
 ['XETR:SAP','SAP · Германия','share'],['XETR:SIE','Siemens · Германия','share','сименс'],
 ['EURONEXT:MC','LVMH · Франция','share'],['LSE:AZN','AstraZeneca · Великобритания','share'],
 ['TSE:7203','Toyota · Япония','share','тойота'],['HKEX:700','Tencent · Гонконг','share','тенсент'],
];
export const worldMarketCatalog=Object.freeze(references.map(row=>Object.freeze(worldInstrument(...row))));
export function worldInstrumentForQuery(query=''){
 const symbol=String(query).trim().toUpperCase();
 return validWorldSymbol(symbol)?worldMarketCatalog.find(row=>worldSymbol(row)===symbol)||worldInstrument(symbol):null;
}
export function mergeWorldDirectory(directory){
 const rows=new Map(worldMarketCatalog.map(row=>[row.instrumentUid,row]));
 if(directory?.version!==1||!Array.isArray(directory.items)||directory.items.length>30000)return [...rows.values()];
 for(const row of directory.items){
  if(!Array.isArray(row)||!validWorldSymbol(row[0])||typeof row[1]!=='string'||row[1].length>300||!['share','etf'].includes(row[2]))continue;
  const meta=worldInstrument(row[0],row[1],row[2]);if(!rows.has(meta.instrumentUid))rows.set(meta.instrumentUid,meta);
 }
 return [...rows.values()];
}
