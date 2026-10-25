import {aggregateCandles,resolution,baseInterval} from './chart-resolutions.js';

// Recalculate only the last displayed bucket. Earlier corrections use the
// authoritative full merge; a tail update must never discard older history.
export function liveDisplayTail(sourceRows,displayRows,value,changedTime) {
 const last=displayRows.at(-1);
 if(!last||changedTime<last.time)return null;
 const r=resolution(value);
 if(!r||!baseInterval(r))return sourceRows.at(-1)||null;
 // The current bucket starts at its first actual source candle (including
 // exchange gaps), exactly as aggregateCandles does for the complete series.
 let low=0,high=sourceRows.length;
 while(low<high){const mid=(low+high)>>>1;if(sourceRows[mid].time<last.time)low=mid+1;else high=mid;}
 const tail=aggregateCandles(sourceRows.slice(low),r);
 // One incoming source candle can only replace the tail or start one bucket.
 // A larger jump is a resnapshot/backfill and must take the complete path.
 if(tail.length>2)return null;
 const row=tail.at(-1);
 if(!row)return null;
 return {...row,capturedAt:sourceRows.at(-1)?.capturedAt};
}
