import { createSavedResearchController } from './saved-research-controller.js';
import { createSavedResearchMemoryTransport } from './saved-research-memory-transport.js';
const createSavedResearchNativeTransport=()=>{throw new Error('Static preview requires explicit memory session');};
import { createSavedResearchUi } from './saved-research-ui.js';
import { resolveRestoreIntent } from './saved-research-model.js';

const tabs = {price:'Цена',risk:'Риск',performance:'Доходность',financials:'Отчётность',seasonality:'Сезонность',technical:'Технический анализ',profile:'Профиль'};
const classes = {share:'Акция',bond:'Облигация',etf:'Фонд',future:'Фьючерс',currency:'Валюта',crypto:'Криптовалюта'};
const caption = meta => [meta?.ticker,meta?.name,meta?.exchange,meta?.classCode,classes[meta?.assetType],meta?.currency].filter(Boolean).join(' · ');
const reason = state => ({missing:'Инструмент отсутствует в текущем каталоге.',ambiguous:'Идентичность инструмента неоднозначна.', 'unverified-origin':'Источник инструмента не подтверждён.','scoped-legacy':'Источник инструмента не подтверждён.', 'changed-identity':'Идентичность инструмента изменилась.', 'identity-unverified':'Сохранённую идентичность пока нельзя подтвердить.', forbidden:'Исследования недоступны для текущего доступа.'})[state] || 'Точный инструмент пока недоступен.';

// One transport mode for the lifetime of this surface. A native error never
// constructs a browser-only store. Only explicit synthetic static previews do.
export function createSavedResearchWorkspace({host,currentResearch,getBootstrap,getCsrf,staticPreview=false,refreshAccess=async()=>{},fetcher=globalThis.fetch,onChange=()=>{}}) {
  const persistence=staticPreview===true?'memory-session':'local-node';
  let controller,ui,disposed=false,accessToken=0,lastAccess='',accessAllowed=false,denied=false,refreshPromise=null,refreshToken=null;
  const environment=()=>({currentScope:currentResearch.capture().scopeKey,resolve:currentResearch.resolve,canResearch:currentResearch.canResearch,now:()=>new Date().toISOString(),idFactory:()=>globalThis.crypto.randomUUID()});
  const transport=staticPreview===true
    ?createSavedResearchMemoryTransport({staticPreview:true,sessionId:globalThis.crypto.randomUUID(),environment})
    :createSavedResearchNativeTransport({fetcher,getCsrf,getAccessToken:()=>accessToken,onAccessRejected:rejectAccess});
  function rejectAccess({token=accessToken}={}) {
    if(disposed||token!==accessToken)return;
    denied=true;accessAllowed=false;++accessToken;
    controller?.updateAccess({ownerScope:controller.getState().ownerScope,allowed:false,permissionRevision:accessToken});
  }
  function describeCurrent() {
    const current=currentResearch.capture(),resolved=current.instrumentRef?currentResearch.resolve(current.instrumentRef):null;
    const exact=accessAllowed&&!denied&&current.mode==='instrument'&&resolved?.resolution==='exact'&&Boolean(resolved.meta)&&currentResearch.canResearch(resolved)===true;
    return {key:JSON.stringify([current.scopeKey,current.instrumentRef,current.analysisTab,current.mode]),exact,caption:caption(resolved?.meta)||'Инструмент не выбран',tabLabel:tabs[current.analysisTab]||'Вкладка недоступна',defaultTitle:[resolved?.meta?.ticker,tabs[current.analysisTab]].filter(Boolean).join(' · '),reason:current.mode!=='instrument'?'Перейдите к анализу инструмента.':reason(resolved?.resolution)};
  }
  function describeEntry(entry) {
    const result=resolveRestoreIntent(entry,environment()),resolved=currentResearch.resolve(entry.instrumentRef);
    return {key:entry.id,exact:result.ok===true&&accessAllowed&&!denied,caption:caption(resolved?.meta)||'Сохранённый инструмент недоступен',tabLabel:tabs[entry.analysisTab]||'Вкладка недоступна',reason:result.ok?'':reason(result.state)};
  }
  controller=createSavedResearchController({transport,currentResearch,persistence,onChange:snapshot=>{ui?.render(snapshot);onChange();}});
  function refreshList(){refreshToken=accessToken;refreshPromise=controller.refresh();return refreshPromise;}
  const commands={...controller,refresh:async()=>{
    if(!accessAllowed||denied){
      await refreshAccess();
      // A successful bootstrap starts this owner's read. Join it even if it
      // completed during bootstrap rendering; do not manufacture a second race.
      if(accessAllowed&&refreshToken===accessToken&&refreshPromise)return refreshPromise;
    }
    return refreshList();
  }};
  ui=createSavedResearchUi({host,commands,describeCurrent,describeEntry,getPersistenceDetail:()=>staticPreview?'transient':getBootstrap()?.savedResearch?.persistenceDetail});
  function updateBootstrap({deferRead=false}={}) {
    if(disposed)return;
    const bootstrap=getBootstrap(),descriptor=bootstrap?.savedResearch;
    const previewValid=staticPreview&&bootstrap?.environment==='fixture'&&bootstrap?.preview?.static===true;
    const nativeValid=!staticPreview&&bootstrap?.preview?.static!==true&&bootstrap?.capabilities?.savedResearch===true&&descriptor?.persistence==='local-node'&&/^[a-f0-9]{32}$/u.test(descriptor.ownerScope||'');
    const ownerScope=previewValid?transport.ownerScope:nativeValid?descriptor.ownerScope:null,allowed=Boolean(previewValid||nativeValid);
    const signature=JSON.stringify([ownerScope,allowed,descriptor?.persistenceDetail||null]);
    const changed=signature!==lastAccess||denied;
    denied=false;accessAllowed=allowed;
    if(changed){lastAccess=signature;++accessToken;controller.updateAccess({ownerScope,allowed,permissionRevision:accessToken});}
    else ui.render(controller.getState());
    // The app first clears old-owner state, publishes the new instrument scope,
    // then starts this read against that scope. No previous Research token leaks
    // into a new-owner read or the explicit access-recovery promise.
    const currentState=controller.getState();
    if(allowed&&!deferRead&&!currentState.pending&&(changed||currentState.state==='unloaded'))void refreshList();
  }
  function contextChanged(){if(!disposed){ui.render(controller.getState());onChange();}}
  function canResearch(){return !disposed&&accessAllowed&&!denied;}
  function getConfirmedEntries(){
    const snapshot=controller.getState();
    if(!canResearch()||snapshot.state!=='ready'||snapshot.fresh!==true||!snapshot.document)return {state:snapshot.state,entries:[]};
    return {state:'ready',entries:snapshot.document.entries.map(entry=>{const description=describeEntry(entry);return {...entry,restorable:description.exact,reason:description.reason};})};
  }
  function getConfirmedSnapshot(){return canResearch()?controller.getState():{state:'forbidden',ownerScope:null,persistence,document:null,revision:null,fresh:false,pending:null};}
  function restore(id,{isCurrent}={}){if(!canResearch()||typeof isCurrent!=='function'||!isCurrent())return Promise.resolve({ok:false,code:'stale'});return controller.restore(id,{isCurrent});}
  function dispose(){if(disposed)return;disposed=true;++accessToken;controller.dispose();ui.dispose();}
  updateBootstrap();
  return Object.freeze({updateBootstrap,contextChanged,canResearch,rejectAccess,getAccessToken:()=>accessToken,getConfirmedEntries,getConfirmedSnapshot,restore,dispose});
}
