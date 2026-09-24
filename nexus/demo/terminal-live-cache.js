import {normalizeMarketCandles} from './charts.js';
function insert(rows,row) {
  const result=rows.slice();let low=0,high=result.length;
  while(low<high){const mid=(low+high)>>>1;if(result[mid].time<row.time)low=mid+1;else high=mid;}
  if(result[low]?.time===row.time)result[low]=row;else result.splice(low,0,row);
  return result;
}
export function applyLiveCache(prior,row,interval) {
  if(!prior || row.interval!==interval)return null;
  const normalized=normalizeMarketCandles([row],interval)[0];if(!normalized)return null;
  const rows=insert(prior.rows||[],normalized);
  const older=normalized.time<(prior.latestRows?.[0]?.time??-Infinity);
  return {...prior,rows,latestRows:older?prior.latestRows:insert(prior.latestRows||[],normalized),
    olderRows:older?insert(prior.olderRows||[],normalized):prior.olderRows,
    latestEmpty:older?prior.latestEmpty:false,at:Date.now(),stale:false,capturedAt:row.capturedAt};
}
export function applySnapshotCache(prior,message,interval) {
  const latestRows=normalizeMarketCandles(message.data||[],interval);
  const lower=Date.parse(message.history?.requestedFrom||message.coverage?.from||message.history?.nextBefore||'');
  const olderRows=Number.isFinite(lower)?(prior?.rows||[]).filter(row=>row.time*1000<lower):(prior?.olderRows||[]);
  return {...prior,rows:normalizeMarketCandles([...olderRows,...latestRows],interval),latestRows,olderRows,
    history:prior?.olderLoaded?prior.history:message.history,coverage:message.coverage,
    at:Date.now(),stale:message.stale===true,fixture:message.fixture===true||message.simulated===true,
    latestEmpty:!latestRows.length,capturedAt:message.capturedAt||message.receivedAt};
}
