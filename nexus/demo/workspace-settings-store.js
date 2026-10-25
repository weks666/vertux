import {WORKSPACE_SETTINGS_LIMIT,validateWorkspaceSettings,validateWorkspacePresentation,normalizeWorkspaceBindings,decodeWorkspaceSettings} from './workspace-settings-model.js';
const copy=value=>JSON.parse(JSON.stringify(value));
const defaultStorage={getItem:key=>globalThis.localStorage.getItem(key),setItem:(key,value)=>globalThis.localStorage.setItem(key,value),removeItem:key=>globalThis.localStorage.removeItem(key)};
export const WORKSPACE_LEGACY_SHORTCUTS='vertux:workspace-navigation:vertux-invest';
export function createWorkspaceSettingsStore({actions,menuIds,storage=defaultStorage}){
 const contract={actions,menuIds},defaults=()=>validateWorkspaceSettings({presentation:{},shortcuts:{}},contract);let scope=null,preview=false,epoch=0,revision=0,raw=null,value=defaults(),legacy=[],legacyObserved=[],candidate=null,problem='',rejected=false,serial=0;const listeners=new Set(),tickets=new WeakMap();
 const key=()=>scope?'invest:workspace-settings:v1:'+scope:null;
 const emit=reason=>{for(const listener of [...listeners])try{listener(reason);}catch{}};
 function status(){return{ready:!problem&&!rejected&&(preview||Boolean(scope))&&!legacy.length,legacy:!problem&&legacy.length>0,canAdopt:Boolean(candidate),persistence:preview?'memory-session':'profile-browser',message:problem||(rejected?'Доступ к профилю изменился. Обновите страницу перед сохранением.':!preview&&!scope?'Дождитесь подтверждения профиля.':legacy.length?(candidate?'Найдены прежние настройки устройства без подтверждённого владельца. Выберите, использовать ли их для этого профиля.':'Прежние настройки повреждены или имеют неподдерживаемый формат. Исходные записи сохранены; можно начать со стандартного вида для этого профиля.'):preview?'Изменения действуют до перезагрузки этого предпросмотра.':'Оформление, меню и сочетания сохраняются для этого профиля в данном браузере.')};}
 function readLegacy(identity){const previous=String(identity.userId||identity.id||identity.displayName||identity.name||'device');const keys=[...new Set(['invest:presentation:'+previous,'vertux-invest:appearance',WORKSPACE_LEGACY_SHORTCUTS])];legacyObserved=keys.map(key=>({key,text:storage.getItem(key)}));legacy=legacyObserved.filter(row=>row.text!==null);candidate=null;if(!legacy.length)return;
  try{let presentation={},shortcuts={};for(const row of legacy){if(typeof row.text!=='string'||new TextEncoder().encode(row.text).length>WORKSPACE_SETTINGS_LIMIT)throw Error('Legacy size');if(row.key===WORKSPACE_LEGACY_SHORTCUTS)shortcuts=JSON.parse(row.text);else if(row.key==='vertux-invest:appearance'){if(!['invest','graphite','light'].includes(row.text))throw Error('Legacy theme');if(!presentation.theme)presentation.theme=row.text;}else presentation=validateWorkspacePresentation(JSON.parse(row.text),menuIds);}
   candidate=validateWorkspaceSettings({presentation,shortcuts},contract);
  }catch{candidate=null;}
 }
 function load(identity){raw=null;revision=0;value=defaults();legacy=[];legacyObserved=[];candidate=null;problem='';if(preview||!scope)return;try{
  raw=storage.getItem(key());if(raw!==null){const doc=decodeWorkspaceSettings(raw,contract);revision=doc.revision;value=doc.value;return;}
  // The authenticated Local Node supplies this scope only for an explicitly
  // transferred personal workspace. Never enumerate another account's storage.
  const transfer=/^[a-f0-9]{32}$/.test(identity.previousPreferenceScope||'')&&identity.previousPreferenceScope!==scope
    && /^[a-z0-9][a-z0-9._:-]{0,127}$/i.test(identity.previousUserId||'');
  if(transfer){const previousKey='invest:workspace-settings:v1:'+identity.previousPreferenceScope,previous=storage.getItem(previousKey);
   if(previous!==null){candidate=decodeWorkspaceSettings(previous,contract).value;legacyObserved=[{key:previousKey,text:previous}];legacy=[...legacyObserved];write(candidate,{decision:'adopt'});return;}
  }
  readLegacy(transfer?{...identity,userId:identity.previousUserId}:identity);
  if(transfer&&candidate)write(candidate,{decision:'adopt'});
 }catch{problem='Настройки не удалось проверить. Исходная запись сохранена. Проверьте хранилище и обновите страницу.';}}
 function bind(identity={},options={}){const next=/^[a-f0-9]{32}$/.test(identity.preferenceScope||'')?identity.preferenceScope:null,mode=options.preview===true;if(scope===next&&preview===mode&&!rejected)return false;epoch++;serial++;scope=next;preview=mode;rejected=false;load(identity);emit('identity');return true;}
 function rejectAccess(token=epoch){if(token!==epoch)return false;epoch++;serial++;rejected=true;value=defaults();raw=null;revision=0;legacy=[];legacyObserved=[];candidate=null;emit('identity');return true;}
 function checkBytes(){if(preview)return true;if(storage.getItem(key())!==raw)return false;return legacyObserved.every(row=>storage.getItem(row.key)===row.text);}
 function write(next,{decision=null}={}){if(problem||rejected||!preview&&!scope||legacy.length&&!['adopt','defaults'].includes(decision))return false;const generation=epoch,before=raw,storageKey=key();let after=null,attempted=false;
  try{const selected=validateWorkspaceSettings(decision==='adopt'?candidate:next,contract);if(revision===Number.MAX_SAFE_INTEGER)throw Error('Revision overflow');if(!checkBytes()||generation!==epoch)throw Error('Storage changed');const nextRevision=revision+1;after=JSON.stringify({version:1,revision:nextRevision,value:selected});if(new TextEncoder().encode(after).length>WORKSPACE_SETTINGS_LIMIT)throw Error('Storage size');
   if(!preview){attempted=true;storage.setItem(storageKey,after);if(storage.getItem(storageKey)!==after||generation!==epoch)throw Error('Write not confirmed');}
   if(generation!==epoch)throw Error('Identity changed');raw=after;revision=nextRevision;value=selected;legacy=[];legacyObserved=[];candidate=null;serial++;emit('saved');return true;
  }catch{if(attempted)try{if(storage.getItem(storageKey)===after){if(before===null)storage.removeItem(storageKey);else storage.setItem(storageKey,before);if(storage.getItem(storageKey)!==before)throw Error('Rollback not confirmed');}}catch{}if(generation===epoch){problem='Сохранение не подтверждено или настройки изменены в другом окне. Показан прежний подтверждённый вид. Обновите страницу перед следующим изменением.';emit('error');}return false;}
 }
 function isCurrent(ticket){const captured=tickets.get(ticket);if(!captured||captured.epoch!==epoch||captured.serial!==serial||!status().ready)return false;try{if(!checkBytes())throw Error('Storage changed');return captured.epoch===epoch&&captured.serial===serial;}catch{problem='Настройки изменились или хранилище недоступно. Обновите страницу перед следующим изменением.';emit('error');return false;}}
 function snapshot(){if(!status().ready)return null;const ticket={value:copy(value)};tickets.set(ticket,{epoch,serial});return isCurrent(ticket)?ticket:null;}
 const api={bind,rejectAccess,getAccessToken:()=>epoch,get:()=>copy(value),status,key,write,snapshot,isCurrent,restore:(ticket,next)=>isCurrent(ticket)&&write(next),adopt:()=>candidate!==null&&write(candidate,{decision:'adopt'}),keep:()=>legacy.length>0&&write(defaults(),{decision:'defaults'}),subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},storageChanged(changed){if(!preview&&scope&&(changed===null||changed===key()||legacyObserved.some(row=>row.key===changed))){epoch++;serial++;problem='Настройки изменены в другом окне. Обновите страницу перед сохранением.';emit('error');return true;}return false;}};
 api.shortcutStorage={getItem(storageKey){if(storageKey!==WORKSPACE_LEGACY_SHORTCUTS)throw Error('Unexpected shortcut key');return JSON.stringify(value.shortcuts);},setItem(storageKey,text){if(storageKey!==WORKSPACE_LEGACY_SHORTCUTS||!status().ready)throw Error('APP_SETTINGS_WRITE_FAILED');let next;try{next=JSON.parse(text);next=normalizeWorkspaceBindings(next,actions);}catch{throw Error('INVALID_SHORTCUT');}if(!write({...value,shortcuts:next}))throw Error('APP_SETTINGS_WRITE_FAILED');}};
 return api;
}
