// Closed, bounded JSON contracts shared by the native backend and UI.
// They validate structure; authentication and financial calculations stay in the host.
const string = (maxLength = 2000, extra = {}) => ({type:'string', maxLength, ...extra});
const array = (items, maxItems = 20) => ({type:'array', items, maxItems});
const object = (properties, required = Object.keys(properties)) => ({type:'object', properties, required, additionalProperties:false});
const choice = values => ({type:'string', enum:values});
const nullable = schema => ({anyOf:[schema,{type:'null'}]});
const id = string(160,{pattern:'^[A-Za-z0-9._:@/-]{1,160}$'});
const timestamp = string(24,{format:'utc-time'});
const date = string(10,{format:'date'});
const hash = string(64,{pattern:'^[a-f0-9]{64}$'});
const decimal = string(28,{pattern:'^(?:0|[1-9]\\d{0,17})(?:\\.\\d{1,9})?$'});
const text = string();
const source = object({id, title:string(320), url:string(1500,{format:'https-url'}), publishedAt:nullable(timestamp), retrievedAt:timestamp});
const reference = object({id, version:id});

export const PLAN_DETAILS_SCHEMA = object({
  schema:{const:'plan-details-v1'},
  intent:choice(['watch','enter','increase','reduce','close']),
  direction:choice(['long','short']),
  horizonDays:{type:'integer',minimum:1,maximum:36500},
  validUntil:date,
  thesis:text,
  catalysts:array(string(500),10),
  entryCondition:text,
  entryRange:object({min:decimal,max:decimal}),
  invalidation:text,
  exitRules:text,
  exitTargets:array(object({price:decimal,fractionPct:decimal}),10),
  lifecycle:choice(['draft','watching','active','review','closed','cancelled']),
  sources:array(source,10),
},['schema']);
const planFields={portfolioId:id,instrumentUid:id,plannedFor:date,action:choice(['watch','buy','sell']),
 entryPrice:nullable(decimal),stopPrice:nullable(decimal),targetPrice:nullable(decimal),note:text,planDetails:PLAN_DETAILS_SCHEMA};
const suggestion=object({actionType:choice(['plan.create','plan.update']),targetRef:nullable(id),explanation:string(1000),changes:object(planFields,[])});
const comparison=object({preferredPlanId:nullable(id),reason:string(1000),criteria:array(string(200),8),conditions:array(string(500),8)});
const comparisonReport=object({...comparison.properties,rows:array(object({id,version:hash,label:string(160),horizon:string(160),basis:string(160),risk:string(500),conditions:string(2000),gaps:array(string(500),10)}),5)});
const assistantSettings=object({localModel:nullable(object({model:string(120,{pattern:'^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$'}),port:{type:'integer',minimum:1024,maximum:65535}})),
 preferences:object({style:choice(['unspecified','long-term','mixed','short-term']),experience:choice(['unspecified','beginner','experienced']),notes:string(2000)}),
 personalModel:nullable(object({model:string(120,{pattern:'^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$'}),consentRevision:{const:'chatgpt-personal-v1'}}))},['localModel','preferences']);

export const NEXUS_AI_SCHEMAS = {
  SettingsInput:object({expectedRevision:{type:'integer',minimum:0,maximum:Number.MAX_SAFE_INTEGER},value:assistantSettings}),
  Settings:assistantSettings,
  ConversationInput:object({title:string(160),portfolioIds:array(string(32,{pattern:'^portfolio-[1-9][0-9]{0,3}$'}),100)}),
  RunRequest:object({message:string(12000),mode:choice(['local','public-cloud','personal-cloud']),clientRequestId:id,
    planRefs:array(reference,5),instrumentRefs:array(id,5),webSearch:{type:'boolean'},expectedContextDigest:nullable(hash)},
    ['message','mode','clientRequestId','planRefs','instrumentRefs']),
  ModelResponse:object({summary:string(1000),blocks:array(object({kind:choice(['interpretation','hypothesis','gap']),
    text, factIds:array(id), assumptions:array(string(500),10)}),20),suggestions:array(suggestion,3),comparison},['summary','blocks']),
  PlanExtension:PLAN_DETAILS_SCHEMA,
  ContextEnvelope:object({schema:{const:'nexus-ai-context-v1'},contextId:id,digest:hash,createdAt:timestamp,
    scope:object({organizationId:id,productId:id,userId:id}),dataMode:choice(['local','public-cloud','personal-cloud']),
    consentRevision:nullable(id),accountRefs:array(id,100),instrumentRefs:array(id,5),planRevisionRefs:array(reference,5),
    period:nullable(object({from:date,to:date,timezone:string(80,{format:'timezone'})})),
    dataSnapshotRefs:array(reference),sources:array(source),gaps:array(string(500)),
    calculationVersions:array(id),allowedCapabilities:array(choice(['plans.read','instrument.facts','risk.calculate','plan.propose','research.sources','portfolio.summary','performance.explain_data','chart.read','alert.propose','chart.propose','task.propose']))}),
  ResearchReportV2:object({schema:{const:'nexus-ai-report-v2'},id,contextDigest:hash,createdAt:timestamp,
    summary:string(1000),blocks:array(object({id,kind:choice(['fact','calculation','interpretation','hypothesis','gap']),
      text,sourceIds:array(id),factIds:array(id),assumptions:array(string(500),10)}),140),sources:array(source),comparison:comparisonReport},['schema','id','contextDigest','createdAt','summary','blocks','sources']),
  ActionProposal:object({schema:{const:'nexus-ai-proposal-v1'},id,actionType:choice(['plan.create','plan.update']),
    targetRef:nullable(id),expectedVersion:nullable(hash),contextDigest:hash,createdAt:timestamp,expiresAt:timestamp,
    idempotencyKey:id,status:choice(['proposed','accepted','applying','applied','rejected','expired','conflict','failed']),
    explanation:string(1000),sourceRefs:array(id),
    proposedFields:object(planFields,['portfolioId','instrumentUid','plannedFor','action','note'])}),
  RunEvent:object({schema:{const:'nexus-ai-event-v1'},runId:id,eventId:{type:'integer',minimum:1,maximum:Number.MAX_SAFE_INTEGER},
    createdAt:timestamp,status:choice(['queued','collecting','researching','generating','validating','completed','partial','cancelled','failed']),
    message:string(2000),reportId:nullable(id),errorCode:nullable(choice(['ACCESS_REVOKED','CONSENT_REQUIRED','PROVIDER_UNAVAILABLE','BUDGET_EXCEEDED','DATA_INCOMPLETE','STALE_CONTEXT','UNSUPPORTED_INSTRUMENT','INVALID_OUTPUT','VERSION_CONFLICT']))}),
};

function fail(path) { throw Object.assign(new TypeError('Проверьте формат данных Nexus AI.'),{code:'NEXUS_AI_CONTRACT_INVALID',status:422,path}); }
function safeJson(value, path = '$', depth = 0, budget = {nodes:0,chars:0}) {
  if (++budget.nodes > 10000 || depth > 16) fail(path);
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'number') { if (!Number.isFinite(value)) fail(path); return; }
  if (typeof value === 'string') { budget.chars += value.length; if (budget.chars > 100000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\ufffd]/u.test(value)) fail(path); return; }
  if (typeof value !== 'object') fail(path);
  const isArray=Array.isArray(value), proto=Object.getPrototypeOf(value);
  if (isArray ? proto!==Array.prototype : proto!==Object.prototype && proto!==null) fail(path);
  const keys=Reflect.ownKeys(value);
  if (isArray && keys.length!==value.length+1) fail(path);
  for (const key of keys) {
    if (isArray && key==='length') continue;
    if (typeof key!=='string' || ['__proto__','constructor','prototype'].includes(key)) fail(path);
    const descriptor=Object.getOwnPropertyDescriptor(value,key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor,'value')) fail(path);
    safeJson(descriptor.value,`${path}.${key}`,depth+1,budget);
  }
}
function matches(schema,value,path) {
  if(schema.type==='boolean'&&typeof value!=='boolean')fail(path);
  if (schema.anyOf) { for(const variant of schema.anyOf){try{matches(variant,value,path);return;}catch{}} fail(path); }
  if (Object.hasOwn(schema,'const') && value!==schema.const) fail(path);
  if (schema.enum && !schema.enum.includes(value)) fail(path);
  if (schema.type==='null') {if(value!==null)fail(path);}
  if (schema.type==='string') {
    if (typeof value!=='string'||value.length>schema.maxLength||schema.pattern&&!new RegExp(schema.pattern,'u').test(value)) fail(path);
    if(schema.format==='date' && (!/^\d{4}-\d\d-\d\d$/u.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value))fail(path);
    if(schema.format==='utc-time' && (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString()!==value))fail(path);
    if(schema.format==='https-url') {let url;try{url=new URL(value);}catch{fail(path);}if(url.protocol!=='https:'||url.username||url.password)fail(path);}
    if(schema.format==='timezone'){try{new Intl.DateTimeFormat('en',{timeZone:value});}catch{fail(path);}}
  }
  if(schema.type==='integer' && (!Number.isSafeInteger(value)||value<schema.minimum||value>schema.maximum))fail(path);
  if(schema.type==='array') {
    if(!Array.isArray(value)||value.length>schema.maxItems)fail(path);
    value.forEach((item,i)=>matches(schema.items,item,`${path}[${i}]`));
  }
  if(schema.type==='object') {
    if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!Object.hasOwn(schema.properties,k))||schema.required.some(k=>!Object.hasOwn(value,k)))fail(path);
    for(const key of Object.keys(value))matches(schema.properties[key],value[key],`${path}.${key}`);
  }
}
const nanos = s => { const [whole,part='']=s.split('.');return BigInt(whole)*1000000000n+BigInt(part.padEnd(9,'0')); };
function freeze(value) { if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value; }
freeze(NEXUS_AI_SCHEMAS);
export function assertNexusAiContract(name,value) {
  if(!Object.hasOwn(NEXUS_AI_SCHEMAS,name))fail('$schema');
  safeJson(value);matches(NEXUS_AI_SCHEMAS[name],value,'$');
  if(name==='PlanExtension') {
    if(value.entryRange && (nanos(value.entryRange.min)<=0n || nanos(value.entryRange.min)>nanos(value.entryRange.max)))fail('$.entryRange');
    if(value.exitTargets && (value.exitTargets.some(t=>nanos(t.price)<=0n||nanos(t.fractionPct)<=0n)||value.exitTargets.reduce((sum,t)=>sum+nanos(t.fractionPct),0n)>100000000000n))fail('$.exitTargets');
  }
  if(name==='ContextEnvelope') {
    for(const key of ['accountRefs','instrumentRefs','allowedCapabilities','calculationVersions'])if(new Set(value[key]).size!==value[key].length)fail(`$.${key}`);
    if(value.period&&value.period.from>value.period.to)fail('$.period');
    if(value.dataMode==='public-cloud'&&(value.accountRefs.length||value.planRevisionRefs.length))fail('$.dataMode');
    if(value.dataMode==='personal-cloud'&&!value.consentRevision)fail('$.consentRevision');
  }
  if(name==='ResearchReportV2') {
    const sources=new Set(value.sources.map(s=>s.id)),blocks=new Set(value.blocks.map(s=>s.id));
    if(sources.size!==value.sources.length||blocks.size!==value.blocks.length)fail('$.ids');
    for(const b of value.blocks)if(b.sourceIds.some(id=>!sources.has(id))||b.kind==='fact'&&!b.sourceIds.length||b.kind==='calculation'&&!b.factIds.length||b.kind==='hypothesis'&&!b.assumptions.length)fail('$.blocks');
  }
  if(name==='ActionProposal') {
    if(value.createdAt>=value.expiresAt||value.actionType==='plan.create'&&(value.targetRef!==null||value.expectedVersion!==null)||value.actionType==='plan.update'&&(!value.targetRef||!value.expectedVersion))fail('$.actionType');
    if(value.proposedFields.planDetails)assertNexusAiContract('PlanExtension',value.proposedFields.planDetails);
  }
  return freeze(JSON.parse(JSON.stringify(value)));
}
export function validPlanDetails(value) {try{assertNexusAiContract('PlanExtension',value);return true;}catch{return false;}}
export function samePlanDetails(a,b){if(a===undefined||b===undefined)return a===b;try{return stableJson(assertNexusAiContract('PlanExtension',a))===stableJson(assertNexusAiContract('PlanExtension',b));}catch{return false;}}
export function stableJson(value){return JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);}
