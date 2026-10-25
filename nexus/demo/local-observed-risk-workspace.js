import {canonicalLocalResultJson} from './local-context-json.js';
const createLocalResultNativeTransport=()=>{throw new Error('Static preview has no local risk transport');};
import {createLocalResultExplanationController} from './local-result-controller.js';
import {createLocalObservedRiskExplanationUi} from './local-observed-risk-ui.js';
export function createLocalObservedRiskWorkspace({host,riskUi,getBootstrap,getBootstrapRevision,getAccessToken=()=>0,canResearch=()=>true,getIsActive,getCsrf,fetcher=globalThis.fetch,onAccessRejected=()=>{},staticPreview=false}){
 let data=null,ui=null,disposed=false;
 const access=()=>{const bootstrap=getBootstrap(),owner=bootstrap?.savedResearch?.ownerScope,revision=getBootstrapRevision(),token=getAccessToken();return typeof owner==='string'&&/^[a-f0-9]{32}$/u.test(owner)&&Number.isSafeInteger(revision)&&revision>=0&&(typeof token==='string'&&token.length<=512||Number.isSafeInteger(token))?{owner,revision,token,key:JSON.stringify([owner,revision,token])}:null;};
 function snapshot(){
  if(disposed||!data)return null;
  const bootstrap=getBootstrap(),scope=access(),descriptor=bootstrap?.localObservedRiskExplanation,dto=data.portfolio?.observedNavRisk,accounts=data.clientProduct?.portfolios;
  if(!scope||!Array.isArray(accounts)||accounts.length!==1||accounts[0]?.id!==dto?.scope?.portfolioIds?.[0])return null;
  const surface=riskUi.getEvidenceState();let signature;try{signature=canonicalLocalResultJson(dto);}catch{return null;}
  if(!surface.eligible||surface.signature!==signature||data.selectedPeriod?.from!==dto.period.requestedFrom||data.selectedPeriod?.to!==dto.period.requestedTo)return null;
  const allowed=!staticPreview&&bootstrap.preview?.static!==true&&bootstrap.capabilities?.localObservedRiskExplanation===true&&descriptor?.mode==='local-saved-template'&&descriptor.llmUsed===false&&descriptor.persistence==='ephemeral'&&canResearch()===true;
  return {bootstrapRevision:scope.revision,ownerToken:JSON.stringify([scope.owner,scope.token]),surfaceRevision:surface.surfaceRevision,allowed,active:getIsActive()===true&&surface.open,accountAlias:accounts[0].id,accountLabel:accounts[0].label||'',requestedFrom:dto.period.requestedFrom,requestedTo:dto.period.requestedTo,observedNavRisk:dto};
 }
 const unavailable=()=>Promise.resolve({ok:false,status:503,code:'unavailable'});
 const native=staticPreview?Object.freeze({create:unavailable,evidence:unavailable}):createLocalResultNativeTransport({fetcher,getCsrf,intent:'portfolio.observed-risk'});
 const transport=Object.fromEntries(['create','evidence'].map(method=>[method,(body,options={})=>{
  const origin=access();return native[method](body,{...options,onAccessRejected:detail=>{
   options.onAccessRejected?.(detail);if(!disposed&&origin&&access()?.key===origin.key)return onAccessRejected({...detail,token:origin.token});
  }});
 }]));
 const controller=createLocalResultExplanationController({intent:'portfolio.observed-risk',transport,getSnapshot:snapshot,revealEvidence:target=>riskUi.revealEvidence(target),onChange:state=>ui?.render(state)});
 ui=createLocalObservedRiskExplanationUi({host,controller,onInvalidateEvidence:()=>riskUi.clearEvidenceReturn()});
 return Object.freeze({update(next){if(disposed)return;data=next;controller.update();},contextChanged(){if(!disposed)controller.update();},getState:controller.getState,dispose(){if(disposed)return;disposed=true;controller.dispose();ui.dispose();}});
}
