import {normalizeMarketCandles} from './charts.js';
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const number=value=>Number.isFinite(value)?value.toLocaleString('ru-RU',{maximumFractionDigits:5}):'—';
export function terminalStatistics(candles){
 const rows=normalizeMarketCandles(candles);if(!rows.length)return null;
 const first=rows[0],last=rows.at(-1);
 return {count:rows.length,from:first.time,to:last.time,high:Math.max(...rows.map(row=>row.high)),low:Math.min(...rows.map(row=>row.low)),
  volume:rows.reduce((sum,row)=>sum+row.volume,0),change:first.open>0?(last.close/first.open-1)*100:null};
}
export {initTerminal} from './terminal-workbench.js';
