import {encodeWorkspaceSettingsFile,decodeWorkspaceSettingsFile,workspaceSettingsComparison,workspaceSettingsFileLimit} from './workspace-settings-transfer-model.js';

export function mountWorkspaceSettingsTransfer(host,{store,contract}){
 const make=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node;};
 const root=make('details');root.className='workspace-settings-transfer';root.dataset.workspaceSettingsTransfer='';
 const summary=make('summary','Перенос общих настроек'),description=make('p','Скачайте оформление, оба вида меню и горячие клавиши одним файлом. При восстановлении эти настройки будут заменены целиком.'),boundary=make('p','Графики, списки инструментов, размер текста, напоминания и оповещения в этот файл не входят.');
 const download=make('button','Скачать общие настройки');download.type='button';download.dataset.workspaceSettingsExport='';
 const label=make('label','Открыть файл общих настроек'),input=make('input');input.type='file';input.accept='.json,application/json';input.dataset.workspaceSettingsFile='';label.append(input);
 const notice=make('p');notice.dataset.workspaceSettingsTransferStatus='';notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');notice.tabIndex=-1;
 const preview=make('section');preview.dataset.workspaceSettingsTransferPreview='';preview.hidden=true;
 const heading=make('h4','Сравнение настроек');heading.tabIndex=-1;heading.dataset.workspaceSettingsTransferTitle='';
 const origin=make('p','Происхождение файла не подтверждено.'),context=make('p'),changes=make('p'),groups=make('div');groups.className='workspace-transfer-groups';
 const confirmation=make('label');confirmation.className='workspace-transfer-confirm';const confirm=make('input');confirm.type='checkbox';confirm.dataset.workspaceSettingsConfirm='';confirmation.append(confirm,make('span','Я проверил изменения и хочу заменить общие настройки.'));
 const apply=make('button','Заменить общие настройки');apply.type='button';apply.dataset.workspaceSettingsApply='';apply.disabled=true;
 const cancel=make('button','Отменить перенос');cancel.type='button';cancel.dataset.workspaceSettingsCancel='';cancel.hidden=true;
 preview.append(heading,origin,context,changes,groups,confirmation,apply);root.append(summary,description,boundary,download,label,notice,preview,cancel);host.append(root);
 let disposed=false,operation=0,reading=false,applying=false,staged=null;const urls=new Map();
 const visible=()=>!disposed&&root.isConnected&&root.open&&root.getClientRects().length>0;
 const say=(text,focus=false)=>{if(disposed)return;notice.textContent=text;if(focus&&visible())notice.focus();};
 function reset(focus=false){operation++;reading=false;staged=null;input.value='';confirm.checked=false;confirm.disabled=true;apply.disabled=true;preview.hidden=true;groups.replaceChildren();cancel.hidden=true;root.setAttribute('aria-busy','false');if(focus&&visible())input.focus();}
 function refresh(){const state=store.status();download.disabled=input.disabled=!state.ready||reading;if(!state.ready)say(state.message);else if(!staged&&!reading)say(state.persistence==='memory-session'?'В предпросмотре замена действует до перезагрузки страницы.':'Замена сохраняется для текущего профиля в этом браузере.');}
 const unsubscribe=store.subscribe(reason=>{if(applying&&reason==='saved')return;const pending=reading||staged;reset();refresh();if(pending&&store.status().ready)say('Настройки или профиль изменились. Откройте файл снова для нового сравнения.');});
 function cancelPending(focus=false){if(!reading&&!staged)return false;reset();refresh();if(focus&&visible()&&!input.disabled)input.focus();say('Перенос отменён. Настройки не изменены.');return true;}
 root.addEventListener('toggle',()=>{if(!root.open)cancelPending();});
 const viewChanged=()=>{if(!visible())cancelPending();};document.addEventListener('invest:view-changed',viewChanged);
 function renderGroups(comparison){for(const group of comparison.groups){const details=make('details'),title=make('summary',group.title+(group.changed?' · есть изменения':' · без изменений'));details.dataset.workspaceSettingsTransferGroup=group.id;details.append(title);const list=make('dl');for(const row of group.rows){const item=make('div');item.className='workspace-transfer-row';item.dataset.changed=String(row.changed);item.append(make('dt',row.label));for(const [caption,value]of [['Сейчас',row.before],['Из файла',row.after]]){const side=make('dd');side.append(make('span',caption),make('strong',value));item.append(side);}list.append(item);}details.append(list);groups.append(details);}}
 input.addEventListener('change',async event=>{
  event.stopPropagation();const file=input.files?.[0];reset();if(!file){refresh();return;}const ticket=store.snapshot(),id=operation;if(!ticket){refresh();return;}
  if(file.size>workspaceSettingsFileLimit){say('Файл слишком большой. Выберите JSON общих настроек до 64 КиБ.');return;}
  reading=true;root.setAttribute('aria-busy','true');cancel.hidden=false;refresh();say('Читаем файл и сравниваем настройки…');
  try{const text=await file.text();if(id!==operation)return;if(!visible()){reset();refresh();return;}if(!store.isCurrent(ticket)){if(id===operation){reset();refresh();say('Текущие настройки не удалось подтвердить. Обновите страницу и откройте файл снова.');}return;}
   const doc=decodeWorkspaceSettingsFile(text,contract),comparison=workspaceSettingsComparison(ticket.value,doc.value,contract);staged={ticket,value:doc.value,same:comparison.same};reading=false;root.setAttribute('aria-busy','false');preview.hidden=false;confirm.disabled=comparison.same;renderGroups(comparison);
   context.textContent='Дата из файла: '+new Date(doc.exportedAt).toLocaleString('ru-RU')+'. '+(store.status().persistence==='memory-session'?'Изменения действуют до перезагрузки предпросмотра.':'Будут заменены общие настройки текущего профиля в этом браузере.');
   changes.textContent=comparison.same?'Все настройки совпадают. Замена не требуется.':'Изменяемых групп: '+comparison.groups.filter(g=>g.changed).length+'. Раскройте группы и проверьте значения.';
   say('Файл открыт для сравнения. Текущие настройки не изменены.');refresh();heading.focus();
  }catch{if(id===operation){reset();refresh();say('Не удалось открыть целый файл. Нужен JSON общих настроек Workspace версии 1 до 64 КиБ, со всеми сочетаниями клавиш. Настройки не изменены.');}}
 });
 confirm.addEventListener('change',event=>{event.stopPropagation();apply.disabled=!staged||staged.same||!confirm.checked||!store.status().ready;});
 apply.addEventListener('click',()=>{
  if(!staged||staged.same||!confirm.checked||apply.disabled||!visible())return;const candidate=staged,id=operation;applying=true;const ok=store.restore(candidate.ticket,candidate.value);applying=false;
  if(id!==operation){refresh();return;}reset();refresh();say(ok?(store.status().persistence==='memory-session'?'Общие настройки заменены до перезагрузки предпросмотра.':'Общие настройки заменены и сохранены для текущего профиля.'):'Замена не подтверждена. Обновите страницу и проверьте настройки перед повторным выбором файла.',true);
 });
 cancel.addEventListener('click',()=>cancelPending(true));root.addEventListener('keydown',event=>{if(event.key==='Escape'&&cancelPending(true)){event.preventDefault();event.stopPropagation();}});
 download.addEventListener('click',()=>{
  const ticket=store.snapshot();if(!ticket){refresh();return;}try{const text=encodeWorkspaceSettingsFile(ticket.value,contract);if(!store.isCurrent(ticket))return;const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),timer=setTimeout(()=>{URL.revokeObjectURL(url);urls.delete(url);},45000);urls.set(url,timer);const anchor=make('a');anchor.dataset.workspaceSettingsDownload='';anchor.href=url;anchor.download='vertux-workspace-settings-v1.json';anchor.hidden=true;root.append(anchor);anchor.click();anchor.remove();say('Файл всех общих настроек подготовлен к скачиванию.');}catch{refresh();say('Не удалось подготовить целый файл. Обновите страницу и проверьте настройки перед повторным скачиванием.');}
 });
 function dispose(){if(disposed)return;reset();disposed=true;unsubscribe();document.removeEventListener('invest:view-changed',viewChanged);for(const [url,timer]of urls){clearTimeout(timer);URL.revokeObjectURL(url);}urls.clear();}
 window.addEventListener('pagehide',dispose,{once:true});refresh();return{root,cancel:()=>cancelPending(),dispose};
}
