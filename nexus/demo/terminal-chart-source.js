import {worldSymbol,validWorldSymbol} from './world-market-catalog.js';

// A public listing reference only. Never send broker IDs or account state to TV.
// A ticker without a proven venue is not enough to select another exchange.
export function tradingViewSymbol(meta={}) {
 const external=worldSymbol(meta);if(external)return external;
 if(meta.simulated===true||meta.fixture===true||String(meta.instrumentUid||'').startsWith('fixture-'))return null;
 const ticker=String(meta.ticker||'').toUpperCase();if(!/^[A-Z0-9_][A-Z0-9_.!-]{0,39}$/.test(ticker))return null;
 const exchange=String(meta.exchange||'').toUpperCase(),real=String(meta.realExchange||'').toUpperCase(),board=String(meta.classCode||'').toUpperCase();
 const moex=real==='REAL_EXCHANGE_MOEX'||/^MOEX(?:_|$)/.test(exchange)||['TQBR','TQTF','TQIF','TQOB','TQCB','CETS','SPBFUT'].includes(board);
 if(moex){
  if(meta.assetType==='future'||board==='SPBFUT'){
   const contract=ticker.match(/^([A-Z0-9]+)([FGHJKMNQUVXZ])(\d{1,4})$/);
   const expiry=String(meta.expirationDate||meta.lastTradeDate||'').match(/^(\d{4})-(\d{2})-/);
   if(!contract||!expiry||!expiry[1].endsWith(contract[3])||'FGHJKMNQUVXZ'[Number(expiry[2])-1]!==contract[2])return null;
   return 'MOEX:'+contract[1]+contract[2]+expiry[1];
  }
  if(['share','etf','fund','bond','currency'].includes(meta.assetType))return 'MOEX:'+ticker;
 }
 if(['NASDAQ','NYSE','AMEX'].includes(exchange)&&['share','etf','fund'].includes(meta.assetType))return exchange+':'+ticker;
 return null;
}

export function terminalChartSymbol(doc,meta) {
 if(doc?.chartSource==='native'&&!worldSymbol(doc))return null;
 const symbol=tradingViewSymbol(meta);return symbol&&validWorldSymbol(symbol)?symbol:null;
}
