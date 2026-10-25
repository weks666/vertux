import {canonicalLocalResultJson} from './local-context-json.js';
import {expectedLocalResultExplanation} from './local-result-template.js';
import {checkedPerformancePassport,performanceMethodExplanation,performanceMethodEvidence} from './performance-method-explanation.js';
import {checkedObservedRiskPassport,observedRiskExplanation,observedRiskEvidence} from './observed-risk-explanation.js';
import {captureSessionResult,sessionResultView,compareSessionResults} from './session-result-review.js';
import {isBookedComponentsVersion} from './booked-components-contract.js';

const copy=value=>structuredClone(value);
const hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value);
const instant=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const integer=value=>Number.isSafeInteger(value)&&value>=0;
const alias=value=>typeof value==='string'&&/^portfolio-[1-9]\d{0,31}$/u.test(value);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const equal=(left,right)=>canonicalLocalResultJson(left)===canonicalLocalResultJson(right);
const failure=code=>({ok:false,code});
const stale=()=>failure('stale');
const bytes=value=>new TextEncoder().encode(value).byteLength;
export async function digestLocalResultJson(serialized){const buffer=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(serialized));return [...new Uint8Array(buffer)].map(value=>value.toString(16).padStart(2,'0')).join('');}

function contextValid(context,snapshot){return plain(context)&&Object.keys(context).length===6&&context.portfolioId===snapshot.accountAlias&&context.requestedFrom===snapshot.requestedFrom&&context.requestedTo===snapshot.requestedTo&&hex(context.scopeToken)&&hex(context.sourceRevisionToken)&&Number.isSafeInteger(context.generation)&&context.generation>0;}
async function reportValid(data,snapshot,sourceDigest,digest){
 if(!plain(data)||Object.keys(data).length!==5||typeof data.handle!=='string'||!/^[A-Za-z0-9_-]{20,128}$/u.test(data.handle)||!hex(data.packetId)||data.sourceDigest!==sourceDigest||!contextValid(data.context,snapshot))return false;
 if(!plain(data.report)||bytes(canonicalLocalResultJson(data.report))>8*1024*1024)return false;
 const suffixes=await Promise.all(snapshot.dto.components.map((_,index)=>digest(canonicalLocalResultJson([sourceDigest,index]))));
 if(!suffixes.every(hex))return false;
 const receiptRefs=suffixes.map((suffix,index)=>'receipt-'+String(index+1).padStart(4,'0')+'-'+suffix.slice(0,16));
 return equal(data.report,expectedLocalResultExplanation(snapshot.dto,{packetId:data.packetId,receiptRefs}));
}

function passportReportValid(data,snapshot,digest,explain){
 if(!plain(data)||Object.keys(data).length!==5||typeof data.handle!=='string'||!/^[A-Za-z0-9_-]{20,128}$/u.test(data.handle)||!hex(data.packetId)||data.sourceDigest!==digest||!contextValid(data.context,snapshot))return false;
 const expected={...explain(snapshot.dto),packetId:data.packetId,freshness:{state:'unknown',asOf:snapshot.dto.period.observedTo,validUntil:null}};
 return equal(data.report,expected);
}

/** No financial calculation, persistence, retry, navigation or ambient bootstrap. */
export function createLocalResultExplanationController({transport,getSnapshot,revealEvidence,onChange=()=>{},digest=digestLocalResultJson,intent='portfolio.result-components'}){
 if(!['portfolio.result-components','portfolio.metric-method','portfolio.observed-risk'].includes(intent))throw new TypeError('Unsupported local explanation intent');
 const methodIntent=intent==='portfolio.metric-method',riskIntent=intent==='portfolio.observed-risk',passportIntent=methodIntent||riskIntent;
 if(![transport?.create,transport?.evidence,getSnapshot,revealEvidence,onChange,digest].every(value=>typeof value==='function'))throw new TypeError('Local explanation dependencies required');
 let disposed=false,generation=0,key=null,record=null,requestAbort=null,denied=null,refreshRequired=null;
 let reviewBaseline=null,reviewCurrent=null;
 let state={status:'unavailable',report:null,accountLabel:'',error:null,pendingEvidenceRef:null};
 const getState=()=>copy({...state,revision:generation,...(passportIntent?{}:{review:{saved:reviewBaseline?sessionResultView(reviewBaseline):null,
  comparison:reviewBaseline&&reviewCurrent&&reviewBaseline!==reviewCurrent&&state.status==='ready'?compareSessionResults(reviewBaseline,reviewCurrent):null,
  canRemember:Boolean(reviewCurrent)&&state.status==='ready'}})});
 const emit=()=>{try{onChange(getState());}catch{/* An observer cannot turn a response into a replay. */}};
 function read(){
  try{
   const input=getSnapshot(),dto=input?.[riskIntent?'observedNavRisk':methodIntent?'performance':'resultComponents'];
   if(!input||!integer(input.bootstrapRevision)||!integer(input.surfaceRevision)||typeof input.ownerToken!=='string'||!input.ownerToken||!alias(input.accountAlias)||!instant(input.requestedFrom)||!instant(input.requestedTo)||Date.parse(input.requestedFrom)>=Date.parse(input.requestedTo))return null;
   if(passportIntent)(riskIntent?checkedObservedRiskPassport:checkedPerformancePassport)(dto,{portfolioId:input.accountAlias,requestedFrom:input.requestedFrom,requestedTo:input.requestedTo});
   else if(!isBookedComponentsVersion(dto?.contractVersion)||dto.currency!=='RUB'||dto.scope?.kind!=='single-account'||!equal(dto.scope.portfolioIds,[input.accountAlias])||dto.period?.requestedFrom!==input.requestedFrom||dto.period?.requestedTo!==input.requestedTo||!Array.isArray(dto.components)||dto.components.length>1000)return null;
   const serialized=canonicalLocalResultJson(dto);if(bytes(serialized)>2*1024*1024)return null;
   const snapshot={bootstrapRevision:input.bootstrapRevision,ownerToken:input.ownerToken,surfaceRevision:input.surfaceRevision,allowed:input.allowed===true,active:input.active===true,accountAlias:input.accountAlias,accountLabel:typeof input.accountLabel==='string'?input.accountLabel.slice(0,200):'',requestedFrom:input.requestedFrom,requestedTo:input.requestedTo,serialized,dto:JSON.parse(serialized)};
   snapshot.key=canonicalLocalResultJson([snapshot.bootstrapRevision,snapshot.ownerToken,snapshot.surfaceRevision,snapshot.allowed,snapshot.active,snapshot.accountAlias,snapshot.accountLabel,snapshot.requestedFrom,snapshot.requestedTo,serialized]);return snapshot;
  }catch{return null;}
 }
 const sameAccess=(left,right)=>left&&right&&left.ownerToken===right.ownerToken&&left.bootstrapRevision===right.bootstrapRevision;
 const sameBootstrap=(left,right)=>left&&right&&left.bootstrapRevision===right.bootstrapRevision;
 const permitted=snapshot=>snapshot?.allowed===true&&snapshot.active===true&&!sameBootstrap(denied,snapshot)&&!sameBootstrap(refreshRequired,snapshot);
 function reset(snapshot,error=null){
  reviewCurrent=null;
  if(reviewBaseline&&(!snapshot?.allowed||snapshot.ownerToken!==reviewBaseline.ownerToken||snapshot.accountAlias!==reviewBaseline.portfolioId
   ||snapshot.requestedFrom!==reviewBaseline.period.requestedFrom||snapshot.requestedTo!==reviewBaseline.period.requestedTo))reviewBaseline=null;
  generation++;requestAbort?.abort();requestAbort=null;record=null;key=snapshot?.key??null;
  if(snapshot&&denied&&!sameBootstrap(denied,snapshot))denied=null;
  if(snapshot&&refreshRequired&&!sameBootstrap(refreshRequired,snapshot))refreshRequired=null;
  state={status:disposed?'disposed':sameBootstrap(denied,snapshot)?'forbidden':sameBootstrap(refreshRequired,snapshot)?'refresh-required':permitted(snapshot)?'idle':'unavailable',report:null,accountLabel:snapshot?.accountLabel||'',error,pendingEvidenceRef:null};emit();
 }
 function update(){if(disposed)return getState();const snapshot=read();if((snapshot?.key??null)!==key)reset(snapshot);return getState();}
 function current(ticket){if(disposed||generation!==ticket.generation)return false;const now=read();return permitted(now)&&now.key===ticket.snapshot.key;}
 function settleStale(ticket){if(!disposed&&generation===ticket.generation)reset(read());return stale();}
 function begin(status){
  update();const snapshot=read();if(disposed||!permitted(snapshot)||state.status==='loading'||state.status==='evidence-loading')return null;
  requestAbort=new AbortController();const ticket={generation,snapshot,signal:requestAbort.signal};
  if(status==='loading'){record=null;reviewCurrent=null;}
  state={...state,status,...(status==='loading'?{report:null}:{}),error:null,pendingEvidenceRef:null};emit();if(current(ticket))return ticket;settleStale(ticket);return null;
 }
 function rejectAccess(ticket){
  const now=read();if(disposed||!sameAccess(ticket.snapshot,now))return;
  reviewBaseline=null;denied={ownerToken:now.ownerToken,bootstrapRevision:now.bootstrapRevision};reset(now);
 }
 function finishError(ticket,result){
  if(!current(ticket))return settleStale(ticket);
  if(result?.status===401||result?.status===403){rejectAccess(ticket);return failure('access-denied');}
  if(result?.status===409){refreshRequired={ownerToken:ticket.snapshot.ownerToken,bootstrapRevision:ticket.snapshot.bootstrapRevision};reset(ticket.snapshot,'context-changed');update();return failure('context-changed');}
  record=null;reviewCurrent=null;state={...state,status:'error',report:null,error:['expired','limit','invalid-request','unavailable'].includes(result?.code)?result.code:'unavailable',pendingEvidenceRef:null};requestAbort=null;emit();return current(ticket)?failure(state.error):settleStale(ticket);
 }
 const bodyFor=(snapshot,sourceDigest)=>({portfolioId:snapshot.accountAlias,requestedFrom:snapshot.requestedFrom,requestedTo:snapshot.requestedTo,displayedSourceDigest:sourceDigest});
 async function explain(){
  const ticket=begin('loading');if(!ticket)return failure('unavailable');
  try{
   const sourceDigest=await digest(ticket.snapshot.serialized);if(!current(ticket))return settleStale(ticket);if(!hex(sourceDigest))return finishError(ticket,{code:'unavailable'});
   const response=await transport.create(bodyFor(ticket.snapshot,sourceDigest),{signal:ticket.signal,onAccessRejected:()=>rejectAccess(ticket)});
   if(!current(ticket))return settleStale(ticket);if(response?.ok!==true)return finishError(ticket,response);
   // Capture plain JSON before asynchronous receipt hashing; later transport
   // mutation cannot change a validated explanation.
   const candidate=JSON.parse(canonicalLocalResultJson(response.data));
   const validReport=passportIntent?passportReportValid(candidate,ticket.snapshot,sourceDigest,riskIntent?observedRiskExplanation:performanceMethodExplanation):await reportValid(candidate,ticket.snapshot,sourceDigest,digest);
   if(!current(ticket))return settleStale(ticket);
   if(!validReport)return finishError(ticket,{code:'unavailable'});
   record=candidate;
   if(!passportIntent){
    reviewCurrent=captureSessionResult({record,dto:ticket.snapshot.dto,ownerToken:ticket.snapshot.ownerToken,capturedAt:new Date().toISOString()});
    if(reviewBaseline&&!compareSessionResults(reviewBaseline,reviewCurrent))reviewBaseline=null;
   }
   state={...state,status:'ready',report:copy(record.report),error:null,pendingEvidenceRef:null};requestAbort=null;emit();
   return current(ticket)?{ok:true}:settleStale(ticket);
  }catch{return finishError(ticket,{code:'unavailable'});}
 }
 async function openEvidence(evidenceRef,{returnFocus}={}){
  update();if(!record||state.status!=='ready')return failure('unavailable');
  const allowedRefs=new Set(riskIntent?[...record.report.metrics.flatMap(row=>row.evidenceRefs),...record.report.points.map(row=>row.evidenceRef),...record.report.episodes.flatMap(row=>[row.evidenceRef,...row.pointRefs])]:methodIntent?[...record.report.methods.flatMap(row=>row.evidenceRefs),...record.report.cashFlows.map(row=>row.evidenceRef)]:[...record.report.summary.flatMap(row=>row.evidenceRefs),...record.report.basis.flatMap(row=>row.evidenceRefs),...record.report.receipts.map(row=>row.evidenceRef)]);
  if(typeof evidenceRef!=='string'||!allowedRefs.has(evidenceRef))return failure('invalid-evidence');
  const captured=record,ticket=begin('evidence-loading');if(!ticket)return failure('unavailable');state.pendingEvidenceRef=evidenceRef;emit();if(!current(ticket))return settleStale(ticket);
  try{
   const response=await transport.evidence({...bodyFor(ticket.snapshot,captured.sourceDigest),handle:captured.handle,evidenceRef},{signal:ticket.signal,onAccessRejected:()=>rejectAccess(ticket)});
   if(!current(ticket)||record!==captured)return settleStale(ticket);if(response?.ok!==true)return finishError(ticket,response);
   const data=response.data,target=data?.target,index=passportIntent?-1:captured.report.receipts.findIndex(row=>row.evidenceRef===evidenceRef);
   const methodTarget=methodIntent?performanceMethodEvidence(ticket.snapshot.dto).find(row=>row.ref===evidenceRef):null;
   const riskTarget=riskIntent?observedRiskEvidence(ticket.snapshot.dto).find(row=>row.ref===evidenceRef):null;
   const expectedTarget=riskIntent?{destination:'observed-nav-risk',kind:riskTarget.kind,metricKey:riskTarget.metricKey,pointIndex:riskTarget.pointIndex,episodeIndex:riskTarget.episodeIndex,evidenceRef,packetId:captured.packetId,sourceDigest:captured.sourceDigest}
    :methodIntent?{destination:'performance-methods',kind:methodTarget.kind,methodKey:methodTarget.methodKey,cashFlowIndex:methodTarget.cashFlowIndex,evidenceRef,packetId:captured.packetId,sourceDigest:captured.sourceDigest}
    :{destination:'booked-components',kind:index>=0?'component-receipt':'basis-and-method',receiptIndex:index>=0?index:null,evidenceRef,packetId:captured.packetId,sourceDigest:captured.sourceDigest};
   if(!plain(data)||Object.keys(data).length!==2||!equal(data.context,captured.context)||!equal(target,expectedTarget))return finishError(ticket,{code:'unavailable'});
   const live=()=>current(ticket)&&record===captured;
   // Render the settled controls before the synchronous evidence/focus commit.
   state={...state,status:'ready',pendingEvidenceRef:null};requestAbort=null;emit();if(!live())return settleStale(ticket);
   const returnAction=()=>{
    if(!live()){settleStale(ticket);return false;}if(typeof returnFocus!=='function')return false;
    let returnLease=true;const isCurrent=()=>returnLease&&live();
    try{const result=isCurrent()&&returnFocus({isCurrent});if(result&&typeof result.then==='function'){Promise.resolve(result).catch(()=>{});return false;}if(!live()){settleStale(ticket);return false;}return result===true&&isCurrent();}catch{return false;}finally{returnLease=false;}
   };
   let lease=true,accepted;const guard=()=>lease&&live();
   try{accepted=revealEvidence({kind:target.kind,...(riskIntent?{metricKey:target.metricKey,pointIndex:target.pointIndex,episodeIndex:target.episodeIndex}:methodIntent?{methodKey:target.methodKey,cashFlowIndex:target.cashFlowIndex}:{receiptIndex:target.receiptIndex}),expectedSignature:ticket.snapshot.serialized,returnFocus:returnAction,isCurrent:guard});}finally{lease=false;}
   if(accepted&&typeof accepted.then==='function'){Promise.resolve(accepted).catch(()=>{});return finishError(ticket,{code:'unavailable'});}
   if(!live())return settleStale(ticket);if(accepted!==true)return finishError(ticket,{code:'unavailable'});return {ok:true};
  }catch{return finishError(ticket,{code:'unavailable'});}
 }
 function rememberForReview(){update();if(passportIntent||state.status!=='ready'||!record||!reviewCurrent)return failure('unavailable');reviewBaseline=reviewCurrent;emit();return {ok:true};}
 function forgetReview(){if(disposed)return;reviewBaseline=null;emit();}
 function close(){if(disposed)return;generation++;requestAbort?.abort();requestAbort=null;record=null;reviewCurrent=null;state={...state,status:'closed',report:null,error:null,pendingEvidenceRef:null};emit();}
 function dispose(){if(disposed)return;disposed=true;reset(null);}
 return Object.freeze({update,explain,openEvidence,rememberForReview,forgetReview,close,getState,dispose});
}
