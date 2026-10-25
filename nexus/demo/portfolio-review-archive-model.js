import {reviewIso,reviewHash,validatePortfolioReviewPacket} from './portfolio-review-model.js';
export const REVIEW_ARCHIVE_LIMITS=Object.freeze({records:10,bytes:1024*1024,packetBytes:32768});
export const REVIEW_ARCHIVE_SCOPE='0'.repeat(64);
export const REVIEW_ARCHIVE_COVERAGE=Object.freeze({records:'retained-one-account-at-export',retainedLimit:10,earlierHistory:'not-included',clock:'local-device-clock',amounts:'unverified-file-observations',sourceTime:'unverified',brokerData:'not-restored'});
const fields=['sequence','recordedAt','clockRegressed','packet'];
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const clone=v=>JSON.parse(JSON.stringify(v)),bytes=v=>new TextEncoder().encode(JSON.stringify(v)).length;
function plain(value){let nodes=0;const seen=new Set();function visit(v,depth){
 if(++nodes>3000||depth>12)throw Error('Archive limit');if(v===null||typeof v==='boolean'||typeof v==='number'&&Number.isSafeInteger(v))return;if(typeof v==='string'&&v.length<=4097)return;
 if(!v||typeof v!=='object'||seen.has(v)||![Object.prototype,Array.prototype,null].includes(Object.getPrototypeOf(v)))throw Error('Archive data');const array=Array.isArray(v),keys=Reflect.ownKeys(v);if(array&&keys.length!==v.length+1||keys.some(k=>typeof k!=='string'))throw Error('Archive array');seen.add(v);
 for(const k of keys){if(array&&k==='length')continue;const d=Object.getOwnPropertyDescriptor(v,k);if(!Object.hasOwn(d,'value')||!d.enumerable||['__proto__','constructor','prototype'].includes(k)||array&&!/^(0|[1-9]\d*)$/.test(k))throw Error('Archive property');visit(d.value,depth+1);}seen.delete(v);
 }visit(value,0);if(bytes(value)>REVIEW_ARCHIVE_LIMITS.bytes)throw Error('Archive bytes');}
export function validateReviewArchive(value){
 plain(value);if(!exact(value,['format','version','exportedAt','coverage','records'])||value.format!=='vertux.portfolio-review-archive'||value.version!==1||!reviewIso(value.exportedAt)||!exact(value.coverage,Object.keys(REVIEW_ARCHIVE_COVERAGE))||Object.entries(REVIEW_ARCHIVE_COVERAGE).some(([k,v])=>value.coverage[k]!==v)||!Array.isArray(value.records)||value.records.length>REVIEW_ARCHIVE_LIMITS.records)throw Error('Archive version');
 for(const [i,row]of value.records.entries()){const prior=value.records[i-1];if(!exact(row,fields)||!Number.isSafeInteger(row.sequence)||row.sequence<1||prior&&row.sequence!==prior.sequence+1||!reviewIso(row.recordedAt)||typeof row.clockRegressed!=='boolean'||prior&&row.clockRegressed!==(row.recordedAt<prior.recordedAt)||!validatePortfolioReviewPacket(row.packet)||row.packet.scopeKey!==REVIEW_ARCHIVE_SCOPE||bytes(row.packet)>REVIEW_ARCHIVE_LIMITS.packetBytes)throw Error('Archive record');}
 return clone(value);
}
export function makeReviewArchive(records,exportedAt=new Date().toISOString()){
 plain(records);if(!Array.isArray(records)||records.length>REVIEW_ARCHIVE_LIMITS.records)throw Error('Archive records');let sourceScope=null;const copied=records.map(row=>{if(!exact(row,[...fields,'snapshotId'])||!reviewHash(row.snapshotId)||!validatePortfolioReviewPacket(row.packet)||sourceScope&&sourceScope!==row.packet.scopeKey)throw Error('Mixed archive scope');sourceScope=row.packet.scopeKey;return {...Object.fromEntries(fields.map(k=>[k,row[k]])),packet:{...row.packet,scopeKey:REVIEW_ARCHIVE_SCOPE}};});
 return validateReviewArchive({format:'vertux.portfolio-review-archive',version:1,exportedAt,coverage:{...REVIEW_ARCHIVE_COVERAGE},records:copied});
}
export function serializeReviewArchive(value){return JSON.stringify(validateReviewArchive(value));}
export function parseReviewArchive(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>REVIEW_ARCHIVE_LIMITS.bytes)throw Error('Archive size');return validateReviewArchive(JSON.parse(text));}
export function validateReviewArchiveResponse(value,query,scopeKey){
 try{plain(value);if(!exact(value,['schema','scopeKey','revision','query','archive'])||value.schema!=='portfolio-review-archive-response-v1'||!reviewHash(value.scopeKey)||value.scopeKey!==scopeKey||!Number.isSafeInteger(value.revision)||value.revision<0||!exact(value.query,['portfolioId','from','to'])||['portfolioId','from','to'].some(k=>value.query[k]!==query[k]))return false;const archive=validateReviewArchive(value.archive);return archive.records.length?archive.records.at(-1).sequence===value.revision:value.revision>=0;}catch{return false;}
}
