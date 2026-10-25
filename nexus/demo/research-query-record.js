import {validateResearchQuery, validateResearchQueryResponse} from './research-query-contract.js';

export const RESEARCH_QUERY_ARCHIVE_LIMITS = Object.freeze({records:20, bytes:65536, title:140});
export const validResearchQueryId = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const exact = (value,keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key=>Object.hasOwn(value,key));
const title = value => typeof value === 'string' && value.length <= RESEARCH_QUERY_ARCHIVE_LIMITS.title && value.trim().length > 0 && !/[\u0000-\u001f\u007f]/u.test(value);
const stamp = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const requireValue = condition => { if (!condition) throw new TypeError('Invalid saved research query'); };

export function validateResearchQuerySave(value) {
  requireValue(exact(value,['requestId','title','previewId','revision']) && validResearchQueryId(value.requestId) && title(value.title)
    && validResearchQueryId(value.previewId) && digest(value.revision));
  return {...value,title:value.title.trim()};
}
export function validateResearchQueryRecord(value,{wire=false}={}) {
  requireValue(exact(value,['version','id','title','createdAt','packet',...(wire?['payloadHash']:[])])
    && value.version==='research-query-record-v1' && validResearchQueryId(value.id) && title(value.title)
    && value.title===value.title.trim() && stamp(value.createdAt) && (!wire||digest(value.payloadHash))
    && new TextEncoder().encode(JSON.stringify(value)).length <= RESEARCH_QUERY_ARCHIVE_LIMITS.bytes + (wire?100:0));
  validateResearchQueryResponse(value.packet,value.packet?.query,{result:true});
  return value;
}
export function researchQueryRecordSummary(record) {
  validateResearchQueryRecord(record,{wire:true});const p=record.packet;
  return {id:record.id,title:record.title,createdAt:record.createdAt,payloadHash:record.payloadHash,query:p.query,
    eligibleCount:p.eligibleCount,excludedCount:p.excludedCount,matchedCount:p.matchedCount,notMatchedCount:p.notMatchedCount,state:p.state,dataMode:p.dataMode};
}
export function validateResearchQuerySummaries(values) {
  requireValue(Array.isArray(values)&&values.length<=RESEARCH_QUERY_ARCHIVE_LIMITS.records);const ids=new Set();
  for(const row of values){
    requireValue(exact(row,['id','title','createdAt','payloadHash','query','eligibleCount','excludedCount','matchedCount','notMatchedCount','state','dataMode'])
      && validResearchQueryId(row.id)&&!ids.has(row.id)&&title(row.title)&&stamp(row.createdAt)&&digest(row.payloadHash)&&['local','synthetic'].includes(row.dataMode));ids.add(row.id);
    const query=validateResearchQuery(row.query),n=query.instrumentUids.length;
    requireValue(Number.isInteger(row.eligibleCount)&&row.eligibleCount>=0&&row.eligibleCount<=n&&row.excludedCount===n-row.eligibleCount);
    requireValue(row.state===(row.eligibleCount?row.excludedCount?'partial':'ready':'unavailable')
      && (row.eligibleCount?Number.isInteger(row.matchedCount)&&row.matchedCount>=0&&row.matchedCount<=row.eligibleCount&&row.notMatchedCount===row.eligibleCount-row.matchedCount:row.matchedCount===null&&row.notMatchedCount===null));
  }
  return values;
}
