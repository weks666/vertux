import {encodeTerminalSettings,decodeTerminalSettings,terminalSettingsChanges,terminalSettingsKinds,terminalSettingsFileLimitFor} from './terminal-settings-transfer-model.js';

export function mountTerminalSettingsTransfer(host,{kind,store,onRestored=()=>{},description:customDescription,boundary:customBoundary,applyLabel,renderPreview}){
 const root=document.createElement('details');root.className='terminal-settings-transfer';root.dataset.settingsTransfer=kind;
 const make=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 const summary=make('summary','Перенос настроек '+terminalSettingsKinds[kind]);
 const description=make('p',customDescription||(kind==='customization'?'Файл содержит расположение сводки и панелей.':'Файл содержит избранные инструменты, стили новых рисунков и цвета. Индивидуальные цвета сохраняют ссылки на инструменты.'));
 const boundary=make('p',customBoundary||'Графики, рисунки и заметки в этот файл не входят.');
 const download=make('button','Скачать настройки');download.type='button';download.dataset.settingsExport='';
 const label=make('label','Открыть файл настроек'),input=make('input');input.type='file';input.accept='.json,application/json';input.dataset.settingsFile='';label.append(input);
 const notice=make('p');notice.setAttribute('role','status');notice.tabIndex=-1;notice.dataset.settingsNotice='';
 const preview=make('section');preview.dataset.settingsPreview='';preview.hidden=true;
 const heading=make('h4','Изменения из файла');heading.tabIndex=-1;
 const list=make('ul'),context=make('p');
 const apply=make('button',applyLabel||'Заменить эти настройки');apply.type='button';apply.dataset.settingsApply='';
 const cancel=make('button','Отменить');cancel.type='button';cancel.dataset.settingsCancel='';cancel.hidden=true;
 preview.append(heading,context,list,apply);root.append(summary,description,boundary,download,label,notice,preview,cancel);host.append(root);
 let disposed=false,operation=0,staged=null,reading=false,applying=false;const urls=new Set(),timers=new Set();
 const visible=()=>!disposed&&root.isConnected&&!root.closest('[hidden]')&&root.open&&root.getClientRects().length>0;
 const setNotice=(text,focus=false)=>{if(disposed)return;notice.textContent=text;if(focus){root.open=true;notice.focus();}};
 function reset(focus=false){++operation;staged=null;reading=false;input.value='';preview.hidden=true;list.replaceChildren();cancel.hidden=true;if(focus&&visible())input.focus();}
 function refresh(){const status=store.status();download.disabled=input.disabled=!status.ready;if(!status.ready)setNotice(status.message);}
 const unsubscribe=store.subscribe(reason=>{if(applying&&reason==='saved')return;const pending=reading||staged;reset();refresh();if(pending&&store.status().ready)setNotice('Настройки изменились. Выберите файл снова для нового сравнения.');});
 function cancelQuietly(){const pending=reading||staged;reset();if(pending)setNotice('Перенос отменён. Настройки не изменены.');}
 root.addEventListener('toggle',()=>{if(!root.open)cancelQuietly();});
 input.addEventListener('change',async e=>{
  e.stopPropagation();const file=input.files?.[0];reset();if(!file)return;
  const ticket=store.snapshot(),id=operation;if(!ticket){refresh();return;}
  if(file.size>terminalSettingsFileLimitFor(kind)){setNotice('Файл слишком большой. Выберите JSON настроек размером до '+(kind==='watch-preferences'?'4 МБ.':'512 КБ.'));return;}
  reading=true;cancel.hidden=false;setNotice('Чтение файла настроек…');
  try{
   const text=await file.text();if(id!==operation)return;if(!visible()){reset();return;}
   if(!store.isCurrent(ticket)){reset();setNotice('Настройки или профиль изменились. Перезагрузите кабинет и выберите файл снова.');refresh();return;}
   const doc=decodeTerminalSettings(text,kind),changes=terminalSettingsChanges(kind,ticket.value,doc.value);
   staged={ticket,value:doc.value};reading=false;preview.hidden=false;
   context.textContent='Дата в файле: '+new Date(doc.exportedAt).toLocaleString('ru-RU')+'. '+(store.status().persistence==='memory-session'?'Замена действует до перезагрузки предпросмотра.':'Замена будет сохранена для текущего профиля в этом браузере.');
   if(renderPreview)renderPreview({host:list,before:ticket.value,after:doc.value,changes,doc});else for(const row of changes){const item=make('li'),detail=make('details'),title=make('summary',row.label);detail.append(title);for(const [label,value]of [['Сейчас',row.before],['Из файла',row.after]])detail.append(make('p',label),make('pre',JSON.stringify(value,null,2)));item.append(detail);list.append(item);}
   apply.disabled=!changes.length;setNotice(changes.length?'Изменяемых групп: '+changes.length+'. Проверьте значения перед заменой.':'Настройки совпадают. Замена не требуется.');heading.focus();
  }catch{if(id===operation&&visible()){reset();setNotice('Файл не подходит. Выберите JSON настроек '+terminalSettingsKinds[kind]+' версии 1, созданный в Invest. Настройки не изменены.');}}
 });
 apply.addEventListener('click',()=>{
  if(!staged||!visible()||apply.disabled)return;
  const candidate=staged;applying=true;const ok=store.restore(candidate.ticket,candidate.value);applying=false;reset();refresh();
  const message=ok?(store.status().persistence==='memory-session'?'Настройки заменены до перезагрузки предпросмотра.':'Настройки заменены и сохранены для текущего профиля.'):'Замена не подтверждена. Перезагрузите кабинет и проверьте настройки перед повторным выбором файла.';
  setNotice(message,true);onRestored({ok,message});
 });
 cancel.addEventListener('click',()=>{reset(true);setNotice('Перенос отменён. Настройки не изменены.');});
 function cancelPending(){if(!reading&&!staged)return false;reset(true);setNotice('Перенос отменён. Настройки не изменены.');return true;}
 root.addEventListener('keydown',e=>{if(e.key==='Escape'&&cancelPending()){e.preventDefault();e.stopPropagation();}});
 download.addEventListener('click',()=>{
  const ticket=store.snapshot();if(!ticket){refresh();return;}
  try{const text=encodeTerminalSettings(kind,ticket.value);if(!store.isCurrent(ticket))throw Error('Stale export');const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));urls.add(url);const a=make('a');a.dataset.settingsDownload='';a.hidden=true;a.href=url;a.download='vertux-'+kind+'-v1.json';root.append(a);a.click();a.remove();const timer=setTimeout(()=>{URL.revokeObjectURL(url);urls.delete(url);timers.delete(timer);},45000);timers.add(timer);setNotice('Файл настроек подготовлен к скачиванию.');}
  catch{refresh();setNotice('Не удалось подготовить файл. Перезагрузите кабинет и повторите скачивание.');}
 });
 refresh();return {setNotice,cancelPending,cancel:cancelQuietly,dispose(){reset();disposed=true;unsubscribe();for(const timer of timers)clearTimeout(timer);for(const url of urls)URL.revokeObjectURL(url);urls.clear();timers.clear();}};
}
