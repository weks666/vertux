import {canonicalLocalResultJson as canonical} from './local-context-json.js';
import {isBookedComponentsVersion} from './booked-components-contract.js';

// A bounded copy of an already accepted native P1 response. No persistence,
// transport, source resolver, external clocks or financial return calculation.
const snapshots=new WeakSet();
const ids=['nav-result','known-components','unallocated-result'];
const titles=['Результат между оценками','Известные компоненты','Нераспределённая сумма'];
const amount=value=>value===null||typeof value==='string'&&/^-?(?:0|[1-9]\d{0,4095})$/u.test(value);
const iso=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value);
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const check=value=>{if(!snapshots.has(value))throw new TypeError('Accepted session snapshot required');return value;};

export function captureSessionResult({record,dto,ownerToken,capturedAt}){
 const json=canonical({record,dto});if(new TextEncoder().encode(json).byteLength>8*1024*1024)throw new TypeError('Session snapshot limit');
 const input=JSON.parse(json),r=input.record,d=input.dto,p=r?.report,c=r?.context;
 if(typeof ownerToken!=='string'||!ownerToken||!iso(capturedAt)||!hex(r?.sourceDigest)||!hex(c?.scopeToken)||!hex(c?.sourceRevisionToken)
  ||!isBookedComponentsVersion(d?.contractVersion)||d.currency!=='RUB'||p?.contractVersion!=='local-result-explanation-v1'
  ||p.intent!=='portfolio.result-components'||p.llmUsed!==false||p.scope?.portfolioId!==c.portfolioId
  ||d.scope?.kind!=='single-account'||canonical(d.scope.portfolioIds)!==canonical([c.portfolioId])
  ||d.period?.requestedFrom!==c.requestedFrom||d.period?.requestedTo!==c.requestedTo
  ||!Array.isArray(p.summary)||p.summary.length!==3||!Array.isArray(p.basis)||p.basis.length!==3
  ||!Array.isArray(p.receipts)||p.receipts.length>1000||!Array.isArray(d.components)||p.receipts.length!==d.components.length)throw new TypeError('Accepted P1 result required');
 const values=[d.navResultNanos,d.knownSubtotalNanos,d.unallocatedRemainderNanos];
 if(!values.every(amount)||p.summary.some((row,index)=>row.claimId!==ids[index]||row.valueNanos!==values[index]))throw new TypeError('Mismatched result');
 const basisValues=[d.openingNanos,d.closingNanos,d.netExternalFlowNanos];
 if(!basisValues.every(amount)||p.basis.some((row,index)=>row.valueNanos!==basisValues[index]))throw new TypeError('Mismatched basis');
 const receipts=p.receipts.map((row,index)=>{
  const source=d.components[index];
  for(const key of ['at','currency','signedNanos','operationType','coverage','reasonCode'])if(row[key]!==source[key])throw new TypeError('Mismatched receipt');
  if(!amount(row.signedNanos))throw new TypeError('Invalid receipt');
  // Deliberately no historic handles, evidenceRefs, URLs, arbitrary prose or IDs.
  return {at:row.at,currency:row.currency,signedNanos:row.signedNanos,operationType:row.operationType,coverage:row.coverage,reasonCode:row.reasonCode};
 });
 const dataMode=d.evidence?.dataMode;
 if(!['synthetic','local-saved'].includes(dataMode)||!iso(c.requestedFrom)||!iso(c.requestedTo)
  ||!Object.values(d.period).every(value=>typeof value!=='number'||Number.isFinite(value)))throw new TypeError('Invalid snapshot source');
 const snapshot=freeze({version:'session-result-review-v1',ownerToken,scopeToken:c.scopeToken,portfolioId:c.portfolioId,
  calculationVersion:d.contractVersion,currency:d.currency,dataMode,sourceDigest:r.sourceDigest,sourceRevisionToken:c.sourceRevisionToken,
  capturedAt,period:{requestedFrom:c.requestedFrom,requestedTo:c.requestedTo,observedFrom:d.period.observedFrom,observedTo:d.period.observedTo},
  values,basisValues,receipts,coverage:{knownComponentCount:p.coverage.knownComponentCount,unknownComponentCount:p.coverage.unknownComponentCount,
   candidateCount:p.coverage.candidateCount,candidateScanComplete:p.coverage.candidateScanComplete,confirmedNoCandidates:p.coverage.confirmedNoCandidates,
   externalFlowCount:p.coverage.externalFlowCount},gapCodes:p.gaps.map(row=>row.code)});
 snapshots.add(snapshot);return snapshot;
}

export function sessionResultView(snapshot){
 const s=check(snapshot);
 return structuredClone({capturedAt:s.capturedAt,period:s.period,dataMode:s.dataMode,values:s.values,basisValues:s.basisValues,receipts:s.receipts,coverage:s.coverage,gapCodes:s.gapCodes});
}

export function compareSessionResults(before,current){
 const a=check(before),b=check(current);
 if(['ownerToken','scopeToken','portfolioId','calculationVersion','currency','dataMode'].some(key=>a[key]!==b[key])
  ||['requestedFrom','requestedTo'].some(key=>a.period[key]!==b.period[key]))return null;
 const sameBounds=['observedFrom','observedTo'].every(key=>a.period[key]===b.period[key]&&iso(a.period[key]));
 const unchanged=a.sourceDigest===b.sourceDigest;
 return {classification:!sameBounds?'different-observations':unchanged?'same-calculation':'changed-calculation',comparable:sameBounds,
  beforeAt:a.capturedAt,currentAt:b.capturedAt,beforePeriod:{...a.period},currentPeriod:{...b.period},
  coverageChanged:canonical([a.coverage,a.gapCodes])!==canonical([b.coverage,b.gapCodes]),
  rows:ids.map((id,index)=>{const previous=a.values[index],now=b.values[index],known=previous!==null&&now!==null;
   return {id,title:titles[index],before:previous,current:now,delta:sameBounds&&known?(BigInt(now)-BigInt(previous)).toString():null,
    state:!sameBounds?'incomparable':known?(BigInt(previous)===BigInt(now)?'unchanged':'changed'):previous===null?(now===null?'unknown':'became-known'):'became-unknown'};})};
}
