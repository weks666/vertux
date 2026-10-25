import {readDockingSettings,pruneDockTree,stabilizeDockTree} from './terminal-docking-model.js';
const clone=v=>JSON.parse(JSON.stringify(v)),legacyKey='invest:terminal-docking:device';
const empty=()=>({version:2,tree:null,pins:[]});
export function createTerminalDockingState({getChartIds=()=>null,storage}={}){
 storage??={getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v),removeItem:k=>localStorage.removeItem(k)};
 let scope=null,preview=false,epoch=0,serial=0,raw=null,value=empty(),legacy=null,legacyProblem=false,issue='';
 const tickets=new WeakMap(),listeners=new Set(),emit=reason=>{for(const listener of [...listeners])try{listener(reason);}catch{}};
 const key=()=>scope?'invest:terminal-docking:'+scope:null;
 const failure=reason=>({ok:false,reason});
 function resolved(){const tabs=getChartIds();return value.version===1&&Array.isArray(tabs)?{version:2,tree:stabilizeDockTree(value.tree,tabs),pins:[...value.pins]}:clone(value);}
 function status(){return {ready:!issue&&legacy===null&&(preview||!!scope),legacy:legacy!==null&&!issue,canAdopt:!legacyProblem,persistence:preview?'memory-session':'profile-browser',message:issue||(!preview&&!scope?'Профиль ещё не подтверждён. Дождитесь загрузки кабинета.':legacy!==null?(legacyProblem?'Прежняя раскладка не поддерживается. Исходная запись сохранена; можно оставить текущее расположение.':'Найдена прежняя раскладка устройства без подтверждённого владельца. Выберите, переносить ли её в текущий профиль.'):preview?'Расположение действует до перезагрузки предпросмотра.':'Расположение сохранено для этого профиля.')};}
 function load(){raw=null;value=empty();legacy=null;legacyProblem=false;issue='';if(preview||!scope)return;
  try{raw=storage.getItem(key());value=readDockingSettings(raw);if(raw===null){legacy=storage.getItem(legacyKey);if(legacy!==null)try{readDockingSettings(legacy);}catch{legacyProblem=true;}}}catch{issue='Не удалось проверить прежнее расположение. Восстановите доступ к настройкам и перезагрузите кабинет.';}
 }
 function bind(identity={},options={}){const next=/^[a-f0-9]{32}$/.test(identity.preferenceScope||'')?identity.preferenceScope:null,nextPreview=options.preview===true;if(next===scope&&nextPreview===preview)return false;++epoch;scope=next;preview=nextPreview;load();emit('identity');return true;}
 function commit(next,{recover=false}={}){
  if(issue||!preview&&!scope||legacy!==null&&!recover)return failure(status().message);
  const generation=epoch,storageKey=key(),before=raw,old=legacy;let after,attempted=false;
  try{after=JSON.stringify(next);const checked=readDockingSettings(after);if(preview){value=checked;++serial;emit('saved');return {ok:true};}
   if(storage.getItem(storageKey)!==before||recover&&storage.getItem(legacyKey)!==old||epoch!==generation)throw Error('Changed');
   if(after!==before){attempted=true;storage.setItem(storageKey,after);if(storage.getItem(storageKey)!==after||epoch!==generation)throw Error('Unconfirmed');}
   value=checked;raw=after;legacy=null;++serial;emit('saved');return {ok:true};
  }catch{
   if(attempted)try{if(storage.getItem(storageKey)===after){if(before===null)storage.removeItem(storageKey);else storage.setItem(storageKey,before);}}catch{}
   const reason='Не удалось подтвердить сохранение расположения: хранилище недоступно или изменено в другом окне. Перезагрузите кабинет.';if(epoch===generation){issue=reason;emit('error');}return failure(reason);
  }
 }
 function prepare({persist=true}={}){
  if(legacy!==null&&!issue)return failure('Сначала выберите в этом меню, переносить ли прежнюю раскладку устройства в текущий профиль.');
  if(!status().ready)return failure(status().message);const next=resolved();if(next.version!==2)return failure('Дождитесь загрузки открытых графиков.');
  if(preview||!persist)return {ok:true};if(value.version===1)return commit(next);
  const generation=epoch;try{if(storage.getItem(key())!==raw||epoch!==generation)throw Error('Changed');return {ok:true};}catch{if(generation===epoch)issue='Расположение изменено в другом окне. Перезагрузите кабинет перед выбором пресета.';return failure(status().message);}
 }
 function adopt(){if(legacy===null||legacyProblem||issue||!scope)return failure(status().message);const tabs=getChartIds();if(!Array.isArray(tabs))return failure('Дождитесь загрузки открытых графиков.');const old=readDockingSettings(legacy),tree=pruneDockTree(stabilizeDockTree(old.tree,tabs),k=>!k.startsWith('chart:')||tabs.includes(k.slice(6)));return commit({version:2,tree,pins:old.pins},{recover:true});}
 function isCurrent(ticket){const captured=tickets.get(ticket);if(!captured||captured.epoch!==epoch||captured.serial!==serial||!status().ready)return false;try{const current=preview?raw:storage.getItem(captured.key);if(captured.epoch!==epoch||captured.serial!==serial)return false;if(current!==captured.raw)throw Error('Changed');return true;}catch{if(captured.epoch===epoch){issue='Расположение изменено или хранилище недоступно. Перезагрузите кабинет и выберите файл снова.';emit('error');}return false;}}
 function snapshot(){if(!status().ready||resolved().version!==2)return null;const ticket={value:resolved()};tickets.set(ticket,{epoch,serial,key:key(),raw});return isCurrent(ticket)?ticket:null;}
 return {bind,key,status,get:resolved,prepare,write:next=>status().ready?commit(next):failure(status().message),adopt,keep:()=>legacy!==null?commit(empty(),{recover:true}):failure(status().message),snapshot,isCurrent,restore:(ticket,next)=>isCurrent(ticket)?commit(next):failure(status().message),subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},
  invalidate(){++epoch;scope=null;preview=false;raw=null;value=empty();legacy=null;issue='Профиль изменился. Перезагрузите кабинет перед изменением расположения.';emit('identity');},
  storageChanged(changed){if(!preview&&scope&&(changed===null||changed===key())){issue='Расположение изменено в другом окне. Перезагрузите кабинет перед сохранением.';emit('error');return true;}return false;}};
}
