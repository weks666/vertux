import { samePlanDetails } from './nexus-ai-contract.js';
import {validatePlanHistory} from './plan-history-ui.js';
import {samePlanRiskScenario} from './plan-risk-scenario.js';
import {samePlanPriceBasis} from './plan-price-basis.js';
export const PLAN_ARCHIVE_LIMITS=Object.freeze({plans:200,history:50,accounts:100,instruments:10200,bytes:96*1024*1024});
export const PLAN_ARCHIVE_COVERAGE=Object.freeze({plans:'retained-accessible',deletedPlans:'not-retained',history:'retained-accessible-versions',historyLimit:50,clock:'local-device-clock',execution:'none',source:'local-sqlite-snapshot',thirdPartyContent:'excluded',otherWorkspaceData:'excluded'});
const fields=['id','portfolioId','instrumentUid','plannedFor','action','entryPrice','stopPrice','targetPrice','note','status','createdAt','updatedAt'];
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const shape=(v,keys)=>object(v)&&Object.keys(v).length===keys.length&&Object.keys(v).every(k=>keys.includes(k));
const iso=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const id=v=>typeof v==='string'&&/^[A-Za-z0-9._:@/-]{1,160}$/u.test(v);
const label=(v,max)=>typeof v==='string'&&v.length>0&&v.length<=max&&v.trim()===v&&!/[\u0000-\u001f\u007f]/u.test(v);
const fail=(code='PLAN_ARCHIVE_INVALID',status=409)=>{throw Object.assign(new Error(code==='PLAN_ARCHIVE_LIMIT'?'Архив превышает поддерживаемый объём. Файл не создан.':code==='PLAN_ARCHIVE_VERSION'?'Версия архива не поддерживается.':'Не удалось проверить архив планов. Данные не изменены.'),{code,status});};
function plain(value){
 let nodes=0;const ancestors=new Set();
 function visit(v,depth){
  if(++nodes>850000||depth>12)fail('PLAN_ARCHIVE_LIMIT',413);
  if(v===null||typeof v==='boolean')return;
  if(typeof v==='number'){if(!Number.isSafeInteger(v))fail();return;}
  if(typeof v==='string'){if(v.length>2000)fail('PLAN_ARCHIVE_LIMIT',413);return;}
  if(typeof v!=='object'||ancestors.has(v))fail();
  const array=Array.isArray(v),prototype=Object.getPrototypeOf(v);if(array?prototype!==Array.prototype:prototype!==Object.prototype&&prototype!==null)fail();
  const keys=Reflect.ownKeys(v);if(keys.some(k=>typeof k!=='string'))fail();
  if(array&&(v.length>PLAN_ARCHIVE_LIMITS.instruments||keys.length!==v.length+1)||!array&&keys.length>20)fail('PLAN_ARCHIVE_LIMIT',413);
  ancestors.add(v);for(const k of keys){if(array&&k==='length')continue;const d=Object.getOwnPropertyDescriptor(v,k);if(!d||!Object.hasOwn(d,'value')||!d.enumerable||array&&!/^(0|[1-9]\d*)$/u.test(k))fail();visit(d.value,depth+1);}ancestors.delete(v);
 }visit(value,0);
 if(new TextEncoder().encode(JSON.stringify(value)).length>PLAN_ARCHIVE_LIMITS.bytes)fail('PLAN_ARCHIVE_LIMIT',413);
}
export function planArchiveValue(item){return Object.fromEntries([...fields,...['priceBasis','riskScenario','planDetails'].filter(key=>Object.hasOwn(item,key))].map(key=>[key,item[key]]));}
function validateCurrent(value,portfolioIds){
 // Reuse the same closed snapshot contract as the real retained plan history.
 validatePlanHistory({schema:Object.hasOwn(value||{},'planDetails')?'trading-plan-history-v4':Object.hasOwn(value||{},'riskScenario')?'trading-plan-history-v3':Object.hasOwn(value||{},'priceBasis')?'trading-plan-history-v2':'trading-plan-history-v1',planId:value?.id,execution:'none',coverage:{origin:'unknown-before-first-observation',retainedLimit:50,earlierVersionsDropped:false,someAccountVersionsUnavailable:false,clock:'local-device-clock',semantics:'accepted-local-writes'},items:[{sequence:1,kind:'legacy-observation',recordedAt:value?.updatedAt,clockRegressed:false,value}]},{planId:value?.id,portfolioIds});
}
export function validatePlanArchive(value){
 plain(value);
 if(!shape(value,['format','version','exportedAt','accounts','instruments','coverage','plans'])||value.format!=='vertux.plan-archive')fail();
 if(![1,2,3,4].includes(value.version))fail('PLAN_ARCHIVE_VERSION');
 if(!iso(value.exportedAt)||!shape(value.coverage,Object.keys(PLAN_ARCHIVE_COVERAGE))||Object.entries(PLAN_ARCHIVE_COVERAGE).some(([k,v])=>value.coverage[k]!==v))fail();
 for(const key of ['accounts','instruments','plans'])if(!Array.isArray(value[key])||value[key].length>PLAN_ARCHIVE_LIMITS[key])fail('PLAN_ARCHIVE_LIMIT',413);
 for(const a of value.accounts)if(!shape(a,['portfolioId','label'])||typeof a.portfolioId!=='string'||!/^portfolio-(?:[1-9]\d?|100)$/u.test(a.portfolioId)||!label(a.label,160))fail();
 const portfolioIds=value.accounts.map(a=>a.portfolioId);if(new Set(portfolioIds).size!==portfolioIds.length)fail();
 const instruments=new Set();for(const i of value.instruments){if(!shape(i,['instrumentUid','label'])||!id(i.instrumentUid)||instruments.has(i.instrumentUid)||i.label!==null&&!label(i.label,320))fail();instruments.add(i.instrumentUid);}
 const plans=new Set(),used=new Set();
 for(const item of value.plans){
  if(!shape(item,['current','history'])||!object(item.current)||plans.has(item.current.id))fail();
  if(value.version<4&&(Object.hasOwn(item.current,'planDetails')||item.history?.schema==='trading-plan-history-v4'))fail();
  if(value.version<3&&(Object.hasOwn(item.current,'riskScenario')||item.history?.schema==='trading-plan-history-v3'))fail();
  if(value.version===1&&(Object.hasOwn(item.current,'priceBasis')||item.history?.schema!=='trading-plan-history-v1'))fail();
  try{validateCurrent(item.current,portfolioIds);validatePlanHistory(item.history,{planId:item.current.id,portfolioIds});}catch{fail();}
  plans.add(item.current.id);used.add(item.current.instrumentUid);
  for(const r of item.history.items)used.add(r.value.instrumentUid);
  const latest=item.history.items.at(-1)?.value;if(latest&&(fields.some(key=>latest[key]!==item.current[key])||!samePlanPriceBasis(latest.priceBasis,item.current.priceBasis)||!samePlanRiskScenario(latest.riskScenario,item.current.riskScenario)||!samePlanDetails(latest.planDetails,item.current.planDetails)))fail();
 }
 if(used.size!==instruments.size||[...used].some(uid=>!instruments.has(uid)))fail();
 return value;
}
export function serializePlanArchive(value){
 validatePlanArchive(value);const text=JSON.stringify(value,null,2)+'\n';if(new TextEncoder().encode(text).length>PLAN_ARCHIVE_LIMITS.bytes)fail('PLAN_ARCHIVE_LIMIT',413);
 return {text,filename:'vertux-plans-'+value.exportedAt.slice(0,10)+'.json'};
}
export function parsePlanArchive(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>PLAN_ARCHIVE_LIMITS.bytes)fail('PLAN_ARCHIVE_LIMIT',413);
 let value;try{value=JSON.parse(text);}catch{fail();}return validatePlanArchive(value);
}
