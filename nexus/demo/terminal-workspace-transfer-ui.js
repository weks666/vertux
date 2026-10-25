import {encodeTerminalWorkspace,decodeTerminalWorkspace,terminalWorkspaceFileLimit} from './terminal-workspace-transfer-model.js';

export function createTerminalWorkspaceTransfer({panel,toolbar,request,isPreview,prepare,release,getContext,getIdentityContext,getOwnerScope,blockPersistence,report}){
 const node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 const opener=node('button','Перенос терминала');opener.type='button';opener.dataset.workspaceTransferOpen='';toolbar.querySelector('.terminal-layout-tools').append(opener);
 const dialog=node('dialog');dialog.className='terminal-workspace-transfer';dialog.setAttribute('aria-label','Перенос терминала');dialog.dataset.workspaceTransfer='';
 const heading=node('h3','Перенос терминала'),close=node('button','Закрыть');close.type='button';close.dataset.workspaceClose='';
 const boundary=node('p','Файл сохраняет открытые графики, заметки, рисунки, сценарии и расположение панелей. История закрытых вкладок, котировки и настройки оформления из других файлов в него не входят.');
 const download=node('button','Скачать текущий терминал');download.type='button';download.dataset.workspaceExport='';
 const label=node('label','Открыть файл терминала'),input=node('input');input.type='file';input.accept='.json,application/json';input.dataset.workspaceFile='';label.append(input);
 const notice=node('p');notice.setAttribute('role','status');notice.tabIndex=-1;notice.dataset.workspaceNotice='';
 const preview=node('section');preview.hidden=true;preview.dataset.workspacePreview='';const previewHeading=node('h4','Терминал из файла');previewHeading.tabIndex=-1;
 const summary=node('p'),current=node('details'),currentTitle=node('summary','Текущие графики'),currentList=node('div'),incoming=node('div');current.append(currentTitle,currentList);incoming.dataset.workspaceIncoming='';current.dataset.workspaceCurrent='';
 const warning=node('p','Замена удалит текущие графики терминала вместе с их заметками и рисунками. Сначала скачайте текущий терминал, если хотите сохранить его отдельно. Ссылки на инструменты переносятся без проверки доступности котировок.');
 const confirmLabel=node('label'),confirmed=node('input');confirmed.type='checkbox';confirmed.dataset.workspaceConfirm='';confirmLabel.append(confirmed,document.createTextNode('Заменить текущие графики данными файла'));
 const apply=node('button','Заменить терминал');apply.type='button';apply.dataset.workspaceApply='';
 const cancel=node('button','Отменить перенос');cancel.type='button';cancel.hidden=true;cancel.dataset.workspaceCancel='';
 const reload=node('button','Перезагрузить терминал');reload.type='button';reload.hidden=true;reload.dataset.workspaceReload='';
 preview.append(previewHeading,summary,current,incoming,warning,confirmLabel,apply);dialog.append(heading,close,boundary,download,label,notice,preview,cancel,reload);panel.append(dialog);
 let epoch=0,busy=false,submitting=false,staged=null,held=false,blocked=false,identity=getIdentityContext();const urls=new Set();
 const say=(text,focus=false)=>{notice.textContent=text;if(focus&&dialog.open)notice.focus();};
 const controls=()=>{download.disabled=busy||submitting||blocked||isPreview();input.disabled=busy||submitting||blocked;confirmed.disabled=submitting||blocked||isPreview();apply.disabled=busy||submitting||!staged||!confirmed.checked||!staged.doc.workspace.charts.length||isPreview()||blocked;close.disabled=submitting;cancel.disabled=submitting;};
 function unlock(){if(held){held=false;release();}}
 function reset(){++epoch;staged=null;busy=false;input.value='';confirmed.checked=false;preview.hidden=true;incoming.replaceChildren();currentList.replaceChildren();current.open=false;cancel.hidden=true;unlock();controls();}
 function shut(){if(submitting)return;reset();dialog.close();opener.focus();}
 function freeze(text,error=true){blocked=true;blockPersistence();report(text,error);reload.hidden=false;say(text,true);controls();}
 function renderCharts(host,workspace){host.replaceChildren();for(const [i,row]of workspace.charts.entries()){const d=node('details'),title=node('summary',(i+1)+'. '+row.value.ticker+(row.key===workspace.layout.active?' · выбранный график':''));d.append(title,node('p','Рисунков: '+row.value.view.drawings.length+' · сохранённых сценариев: '+row.value.plans.length),node('p',row.value.note||'Заметки нет.'));host.append(d);}}
 async function snapshot(id){held=true;await prepare();if(id!==epoch||!dialog.open)throw Error('Cancelled');const context=getContext(),value=await request('/api/market/terminal/workspace');if(id!==epoch||context!==getContext()||value?.ownerScope!==getOwnerScope()||!/^[a-f0-9]{64}$/.test(value?.snapshotToken||'')||!Number.isSafeInteger(value.layoutRevision))throw Error('Context changed');return {value,context};}
 async function load(){const file=input.files?.[0];reset();if(!file)return;const id=epoch;busy=true;cancel.hidden=false;controls();say('Чтение файла терминала…');
  try{
   if(file.size>terminalWorkspaceFileLimit)throw Error('File limit');const text=await file.text();if(id!==epoch||!dialog.open)return;const doc=decodeTerminalWorkspace(text);
   const target=isPreview()?null:await snapshot(id);if(id!==epoch||!dialog.open)return;
   staged={doc,text,target};busy=false;preview.hidden=false;renderCharts(incoming,doc.workspace);current.hidden=!target;if(target)renderCharts(currentList,target.value.workspace);
   summary.textContent='В файле: '+doc.workspace.charts.length+' графиков. Дата в файле: '+new Date(doc.exportedAt).toLocaleString('ru-RU')+'.'+(target?' Сейчас открыто: '+target.value.workspace.charts.length+'.':'');
   warning.hidden=confirmLabel.hidden=isPreview();say(isPreview()?'Просмотр локального файла. Восстановление доступно в приложении.':'Проверьте содержимое файла и подтвердите замену.');controls();previewHeading.focus();
  }catch(error){if(id===epoch){reset();say(error?.code==='TERMINAL_WORKSPACE_INVALID'?error.message:'Файл или текущий терминал не удалось проверить. Ничего не заменено. Перезагрузите терминал и выберите поддерживаемый файл версии 1 до 10 МБ.',true);}}
 }
 download.addEventListener('click',async()=>{if(busy||submitting||blocked||isPreview())return;reset();const id=epoch;busy=true;controls();say('Проверяем сохранение текущего терминала…');try{const target=await snapshot(id);if(id!==epoch)return;const text=encodeTerminalWorkspace(target.value.workspace,target.value.capturedAt);if(target.context!==getContext())throw Error('Changed');const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));urls.add(url);const a=node('a');a.hidden=true;a.href=url;a.download='vertux-terminal-workspace-v1.json';dialog.append(a);a.click();a.remove();say('Файл текущего терминала подготовлен к скачиванию.');}catch{if(id===epoch)say('Не удалось подготовить целый архив. Перезагрузите терминал и повторите скачивание.',true);}finally{if(id===epoch){busy=false;unlock();controls();}}});
 input.addEventListener('change',()=>void load());confirmed.addEventListener('change',controls);
 apply.addEventListener('click',async()=>{if(apply.disabled||!staged)return;const selected=staged,id=epoch;if(selected.target.context!==getContext()){reset();say('Терминал изменился. Выберите файл снова для нового сравнения.',true);return;}submitting=true;controls();say('Заменяем терминал…');
  try{const target=selected.target.value,result=await request('/api/market/terminal/workspace',{method:'POST',body:JSON.stringify({expectedOwnerScope:target.ownerScope,snapshotToken:target.snapshotToken,file:selected.text})});
   if(id!==epoch)return;if(selected.target.context!==getContext()||result?.restored!==true||result.ownerScope!==target.ownerScope||result.layoutRevision!==target.layoutRevision+1||result.charts!==selected.doc.workspace.charts.length||!/^[a-f0-9]{64}$/.test(result.snapshotToken||''))throw Error('Unconfirmed');
   submitting=false;reset();freeze('Терминал восстановлен и сохранён. Перезагрузите его, чтобы открыть графики из файла.',false);
  }catch(error){if(id===epoch){submitting=false;reset();freeze(error?.status===409?'Терминал изменён в другом окне. Замена отклонена; перезагрузите терминал.':error?.status===400?'Файл отклонён. Терминал не заменён; перезагрузите его перед новой попыткой.':'Ответ о сохранении не подтверждён. Перезагрузите терминал и проверьте результат; повторной отправки автоматически не будет.');}}
  finally{if(id===epoch){submitting=false;controls();}}
 });
 opener.addEventListener('click',()=>{dialog.showModal();say(blocked?'Перезагрузите терминал перед следующими изменениями.':isPreview()?'Здесь можно посмотреть файл. Скачивание и восстановление доступны в приложении.':'Можно сохранить текущий терминал или открыть ранее сохранённый файл.');controls();(download.disabled?input:download).focus();});
 close.addEventListener('click',shut);reload.addEventListener('click',()=>location.reload());cancel.addEventListener('click',()=>{if(submitting)return;reset();say('Перенос отменён. Терминал не заменён.');input.focus();});
 dialog.addEventListener('cancel',e=>{e.preventDefault();if(submitting)return;if(staged||busy){reset();say('Перенос отменён. Терминал не заменён.');input.focus();}else shut();});
 dialog.addEventListener('keydown',e=>{if(e.key==='Escape')e.stopPropagation();});
 dialog.addEventListener('close',()=>{for(const url of urls)URL.revokeObjectURL(url);urls.clear();});
 document.addEventListener('invest:identity',()=>{if(identity===getIdentityContext())return;identity=getIdentityContext();const writing=submitting;submitting=false;reset();if(writing)freeze('Профиль изменился. Перезагрузите кабинет, чтобы проверить результат сохранения.');else{blocked=true;controls();}if(dialog.open)dialog.close();});
 return {invalidate(){reset();blocked=true;controls();}};
}
