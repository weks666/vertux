const clone=value=>JSON.parse(JSON.stringify(value));
const maxBytes=256*1024;
function safeData(value,byteLimit=maxBytes){
 let nodes=0;const seen=new Set();
 function visit(v,depth){
  if(++nodes>20000||depth>12)throw Error('Settings limit');
  if(v===null||typeof v==='boolean')return;
  if(typeof v==='number'&&Number.isFinite(v))return;
  if(typeof v==='string'&&v.length<=2000)return;
  if(!v||typeof v!=='object'||seen.has(v))throw Error('Settings shape');
  if(![Object.prototype,Array.prototype,null].includes(Object.getPrototypeOf(v)))throw Error('Settings prototype');
  seen.add(v);const descriptors=Object.getOwnPropertyDescriptors(v);
  if(Reflect.ownKeys(descriptors).some(k=>typeof k!=='string')||Object.keys(descriptors).length>601)throw Error('Settings keys');
  for(const [key,d]of Object.entries(descriptors)){if(Array.isArray(v)&&key==='length')continue;if(!Object.hasOwn(d,'value')||!d.enumerable||['__proto__','prototype','constructor'].includes(key))throw Error('Settings property');visit(d.value,depth+1);}seen.delete(v);
 }visit(value,0);if(new TextEncoder().encode(JSON.stringify(value)).length>byteLimit)throw Error('Settings bytes');
}
function preserved(input,output){
 if(typeof input==='string'&&/^#[a-f\d]{6}$/i.test(input))return input===output||input.toLowerCase()===output;
 if(input===null||typeof input!=='object')return input===output;
 if(!output||typeof output!=='object'||Array.isArray(input)!==Array.isArray(output))return false;
 if(Array.isArray(input))return input.length===output.length&&input.every((v,i)=>preserved(v,output[i]));
 return Object.keys(input).every(k=>Object.hasOwn(output,k)&&preserved(input[k],output[k]));
}
export function createTerminalScopedSettings({kind,normalize,legacyKey,storage,byteLimit=maxBytes}){
 if(!/^[a-z-]{1,32}$/.test(kind))throw Error('Settings kind');
 storage??={getItem:key=>globalThis.localStorage.getItem(key),setItem:(key,value)=>globalThis.localStorage.setItem(key,value),removeItem:key=>globalThis.localStorage.removeItem(key)};
 let scope=null,accountScope='',preview=false,value=normalize({}),raw=null,legacy=null,legacyProblem=false,issue='',epoch=0,serial=0;
 const tickets=new WeakMap(),listeners=new Set();
 const emit=reason=>{for(const listener of [...listeners])try{listener(reason);}catch{}};
 const key=()=>scope?'invest:terminal-settings:v1:'+scope+(accountScope?':account:'+accountScope:'')+':'+kind:null;
 const normalized=input=>normalizeTerminalSettingsValue(input,normalize,byteLimit);
 function parse(text,envelope){if(typeof text!=='string'||new TextEncoder().encode(text).length>byteLimit)throw Error('Settings bytes');const doc=JSON.parse(text);safeData(doc,byteLimit);
  if(!envelope)return normalized(doc);
  if(!doc||Object.keys(doc).length!==3||doc.version!==1||doc.kind!==kind||!Object.hasOwn(doc,'value'))throw Error('Settings version');return normalized(doc.value);
 }
 function reload(){value=normalize({});raw=null;legacy=null;legacyProblem=false;issue='';if(preview||!scope)return;
  try{raw=storage.getItem(key());if(raw!==null)value=parse(raw,true);else if(!accountScope){legacy=storage.getItem(legacyKey);if(legacy!==null)try{parse(legacy,false);}catch{legacyProblem=true;}}}
  catch{issue='Настройки не удалось проверить. Исходная запись сохранена; перезагрузите кабинет после проверки хранилища.';}
 }
 function bind(identity={},options={}){const next=/^[a-f0-9]{32}$/.test(identity.preferenceScope||'')?identity.preferenceScope:null,nextPreview=options.preview===true;
  const nextAccount=Object.hasOwn(options,'accountScope')?options.accountScope:next===scope?accountScope:'';
  if(nextAccount!==''&&!/^[a-f0-9]{32}$/.test(nextAccount))throw Error('Invalid account preferences scope');
  if(next===scope&&nextPreview===preview&&nextAccount===accountScope)return false;++epoch;scope=next;accountScope=nextAccount;preview=nextPreview;reload();emit('identity');return true;
 }
 function status(){return {ready:!issue&&(preview||!!scope&&legacy===null),legacy:!issue&&legacy!==null,canAdopt:!legacyProblem,persistence:preview?'memory-session':'profile-browser',message:issue||(!preview&&!scope?'Профиль ещё не подтверждён. Дождитесь загрузки кабинета.':legacy!==null?(legacyProblem?'Формат прежних настроек не поддерживается. Исходная запись сохранена. Можно оставить стандартные настройки для этого профиля.':'Найдены прежние настройки устройства без подтверждённого владельца. Выберите, использовать ли их для этого профиля.'):preview?'Изменения действуют до перезагрузки этого предпросмотра.':'Настройки этого профиля сохраняются в данном браузере.')};}
 function isCurrent(ticket){
  const captured=tickets.get(ticket);if(!captured||captured.epoch!==epoch||captured.serial!==serial||!status().ready)return false;
  try{const bytes=preview?raw:storage.getItem(captured.key);if(captured.epoch!==epoch||captured.serial!==serial)return false;if(bytes!==captured.raw)throw Error('Settings changed');return true;}
  catch{if(captured.epoch===epoch){issue='Настройки изменились или хранилище недоступно. Перезагрузите кабинет и выберите файл снова.';emit('error');}return false;}
 }
 function snapshot(){if(!status().ready)return null;const ticket={value:clone(value)};tickets.set(ticket,{epoch,serial,key:key(),raw});return isCurrent(ticket)?ticket:null;}
 function write(input,{adopt=false,keep=false}={}){
  if(issue||!preview&&!scope||legacy!==null&&!adopt&&!keep)return false;
  const generation=epoch,storageKey=key(),before=raw,old=legacy;let after,attempted=false;
  try{
   const next=normalized(adopt?parse(old,false):input);if(preview){value=next;++serial;emit('saved');return true;}
   after=JSON.stringify({version:1,kind,value:next});if(new TextEncoder().encode(after).length>byteLimit)throw Error('Settings bytes');
   if(storage.getItem(storageKey)!==before||old!==null&&storage.getItem(legacyKey)!==old||epoch!==generation)throw Error('Settings changed');
   attempted=true;storage.setItem(storageKey,after);if(storage.getItem(storageKey)!==after||epoch!==generation)throw Error('Settings write unconfirmed');
   raw=after;legacy=null;value=next;++serial;emit('saved');return true;
  }catch{
   if(attempted)try{if(storage.getItem(storageKey)===after){if(before===null)storage.removeItem(storageKey);else storage.setItem(storageKey,before);}}catch{}
   if(epoch===generation){issue='Сохранение не подтверждено или настройки изменены в другом окне. Перезагрузите кабинет; прежняя запись не переносится повторно.';emit('error');}return false;
  }
 }
 return {bind,get:()=>clone(value),status,write,snapshot,isCurrent,
  restore(ticket,input){return isCurrent(ticket)&&write(input);},subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},
  adopt:()=>legacy!==null&&!legacyProblem&&write(value,{adopt:true}),keep:()=>legacy!==null&&write(value,{keep:true}),key,
  invalidate(){++epoch;scope=null;preview=false;reload();issue='Профиль изменился. Перезагрузите кабинет перед изменением настроек.';emit('identity');},storageChanged(changedKey){if(!preview&&scope&&(changedKey===null||changedKey===key())){issue='Настройки изменены в другом окне. Перезагрузите кабинет перед сохранением.';emit('error');return true;}return false;}};
}
export function normalizeTerminalSettingsValue(input,normalize,byteLimit=maxBytes){safeData(input,byteLimit);const next=normalize(input);safeData(next,byteLimit);if(!preserved(input,next))throw Error('Settings normalization would lose data');return next;}
export function mountTerminalSettingsRecovery(host,store,onChange=()=>{}){
 const status=store.status(),section=document.createElement('section');section.className='terminal-settings-recovery';section.dataset.terminalSettingsRecovery='';
 const message=document.createElement('p');message.setAttribute('role','status');message.textContent=status.message;section.append(message);
 if(status.legacy)for(const [action,label]of [['adopt','Использовать прежние настройки'],['keep','Оставить текущие настройки']]){const button=document.createElement('button');button.type='button';button.textContent=label;button.disabled=action==='adopt'&&!status.canAdopt;button.dataset.terminalSettingsAction=action;button.addEventListener('click',()=>{const ok=store[action]();onChange(ok,action);});section.append(button);}
 host.append(section);return section;
}
