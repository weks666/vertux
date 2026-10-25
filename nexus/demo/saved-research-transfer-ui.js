import {applySavedResearchCommand,savedResearchSemanticKey} from './saved-research-model.js';
import {parseSavedResearchTransfer,serializeSavedResearchTransfer,SAVED_RESEARCH_TRANSFER_BYTES} from './saved-research-transfer.js';
const usable=s=>s?.fresh===true&&['ready','empty'].includes(s.state)&&s.document?.schemaVersion===1;
const message=result=>({
 'file-too-large':'Файл слишком большой. Допустимо до 96 КиБ.',
 'invalid-json':'Не удалось прочитать JSON-файл.',
 'invalid-transfer':'Это не файл сохранённых исследований Vertux.',
 'unsupported-transfer-version':'Версия файла не поддерживается. Исходный файл оставлен без изменений.',
 'unsupported-version':'Версия сохранений в файле не поддерживается.',
 'record-limit':'Для всей копии недостаточно места: допускается до 20 исследований. Ничего не добавлено.',
 'json-byte-limit':'Сохранения превышают допустимый размер. Ничего не добавлено.',
 'revision-conflict':'Список изменился в другом окне. Обновите список и выберите файл заново.',
 'scope-changed':'Рабочее пространство изменилось. Выберите файл заново.',
 'stale-request':'Действие не подтверждено. Обновите список перед повторным предпросмотром.',
 'transport-unavailable':'Ответ хранилища не получен. Обновите список: запись могла сохраниться.',
 'invalid-response':'Ответ хранилища не подтверждён. Обновите список.',
}[result?.error?.code]||'Файл или действие не удалось подтвердить. Текущие сохранения не заменены.');

export function createSavedResearchTransferUi({host,commands,describeEntry=()=>({}),getPersistenceDetail=()=>null}){
 let state=null,epoch=0,serial=0,busy='',proposal=null,notice='',disposed=false;
 const urls=new Map();
 host.className='saved-research-transfer';
 host.innerHTML='<details data-research-transfer><summary>Перенос сохранённых исследований</summary><p>Файл содержит названия, инструменты, вкладки и закрепления. Котировки, операции, планы и история решений в него не входят.</p><button type="button" data-research-export>Скачать JSON</button><label class="saved-research-file">Добавить исследования из файла<input type="file" accept="application/json,.json" data-research-file></label><p data-research-transfer-status role="status" aria-live="polite"></p><div data-research-transfer-preview hidden><p data-research-transfer-summary></p><ol data-research-transfer-rows></ol><div><button type="button" data-research-import>Добавить копии</button><button type="button" data-research-transfer-cancel>Отмена</button></div></div></details>';
 const $=selector=>host.querySelector(selector),details=$('details'),file=$('[data-research-file]'),download=$('[data-research-export]'),confirm=$('[data-research-import]'),cancel=$('[data-research-transfer-cancel]');
 const available=()=>!disposed&&usable(state)&&!state.pending&&!busy;
 const reset=()=>{proposal=null;file.value='';++serial;};
 function describe(entry){try{return describeEntry(entry)||{};}catch{return {};}}
 function paint(){
  download.disabled=!available();file.disabled=!available();
  confirm.disabled=!available()||!proposal?.plan?.ok||proposal.plan.changed!==true;
  cancel.disabled=Boolean(busy);$('[data-research-transfer-preview]').hidden=!proposal;
  $('[data-research-transfer-status]').textContent=busy==='file'?'Проверяем файл…':busy==='export'?'Перечитываем сохранения для файла…':busy==='import'?'Добавляем копии…':notice;
  if(!proposal)return;
  const summary=proposal.plan.importSummary;
  $('[data-research-transfer-summary]').textContent=proposal.plan.ok
   ?`Добавится: ${summary.added}. Повторов пропущено: ${summary.duplicates}. Новых закреплений: ${summary.pinned}. Без закрепления из-за лимита: ${summary.unpinned}. Текущие записи и закрепления сохраняются. Копии получают новые местные даты добавления.`
   :message(proposal.plan);
  const seen=new Set(state.document.entries.map(savedResearchSemanticKey)),rows=$('[data-research-transfer-rows]');rows.replaceChildren();
  for(const entry of proposal.document.entries){const li=document.createElement('li'),title=document.createElement('strong'),note=document.createElement('p'),key=savedResearchSemanticKey(entry),duplicate=seen.has(key),info=describe(entry);seen.add(key);
   title.textContent=entry.title;note.textContent=(!proposal.plan.ok?'Сохранение из файла. ':duplicate?'Совпадающее сохранение будет пропущено. ':'Будет добавлена копия. ')+(info.exact?info.caption+' · '+info.tabLabel:(info.reason||'Точный инструмент пока недоступен. Открытие проверяется отдельно.'));
   li.append(title,note);rows.append(li);
  }
 }
 function render(next){
  const prior=state,ownerChanged=next?.ownerScope!==prior?.ownerScope;
  const securityReset=!next?.document&&['unloaded','forbidden','disposed'].includes(next?.state)&&next?.state!==prior?.state;
  state=next;
  if(ownerChanged||securityReset){++epoch;busy='';reset();notice='';details.open=false;}
  else if(proposal&&(!usable(state)||state.revision!==proposal.revision)){reset();notice='Список изменился. Выберите файл заново для актуального предпросмотра.';}
  paint();
 }
 async function exportFile(){
  if(!available())return;const token=epoch,owner=state.ownerScope;busy='export';notice='';paint();
  let result;try{result=await commands.refresh();}catch{result={ok:false,error:{code:'transport-unavailable'}};}
  if(disposed||token!==epoch||owner!==state?.ownerScope)return;
  busy='';
  if(!result?.ok||!usable(state)){notice=message(result);paint();return;}
  const output=serializeSavedResearchTransfer(state.document,new Date().toISOString());
  if(!output.ok){notice=message(output);paint();return;}
  try{
   const url=URL.createObjectURL(new Blob([output.text],{type:'application/json;charset=utf-8'})),link=document.createElement('a');
   link.href=url;link.download=output.filename;link.dataset.researchDownload='';link.hidden=true;host.append(link);link.click();link.remove();
   urls.set(url,setTimeout(()=>{URL.revokeObjectURL(url);urls.delete(url);},1000));
   notice=`Файл передан для скачивания. Сохранений: ${state.document.entries.length}.`;
  }catch{notice='Не удалось начать скачивание. Сохранения не изменены.';}
  paint();if(document.activeElement===document.body)download.focus();
 }
 async function selectFile(){
  if(!available())return;const selected=file.files?.[0];if(!selected)return;
  const token=epoch,operation=++serial,owner=state.ownerScope,revision=state.revision;proposal=null;notice='';busy='file';paint();
  let parsed;try{parsed=selected.size>SAVED_RESEARCH_TRANSFER_BYTES?{ok:false,error:{code:'file-too-large'}}:parseSavedResearchTransfer(await selected.text());}catch{parsed={ok:false,error:{code:'invalid-json'}};}
  if(disposed||token!==epoch||operation!==serial||owner!==state?.ownerScope)return;
  busy='';
  if(!usable(state)||state.revision!==revision||state.pending){reset();notice='Список изменился во время чтения файла. Выберите файл заново.';paint();return;}
  if(!parsed.ok){reset();notice=message(parsed);paint();return;}
  let ordinal=0;const ids=new Set(state.document.entries.map(entry=>entry.id));
  const plan=applySavedResearchCommand(state.document,{type:'import',document:parsed.document,expectedOwnerScope:owner},{ownerScope:owner,now:new Date().toISOString(),idFactory:()=>{while(ids.has('transfer-preview-'+ordinal))++ordinal;return 'transfer-preview-'+ordinal++;}});
  proposal={document:parsed.document,revision,ownerScope:owner,plan};
  notice=plan.ok?(plan.changed?'Проверьте копии перед добавлением.':'В файле нет новых сохранений. Запись не требуется.'):message(plan);paint();
 }
 async function importFile(){
  if(!available()||!proposal?.plan?.ok||!proposal.plan.changed)return;
  const item=proposal,token=epoch;if(item.ownerScope!==state.ownerScope||item.revision!==state.revision){reset();notice='Список изменился. Выберите файл заново.';paint();return;}
  busy='import';notice='';paint();let result;
  try{result=await commands.mutate({type:'import',document:item.document,expectedOwnerScope:item.ownerScope});}catch{result={ok:false,error:{code:'transport-unavailable'}};}
  if(disposed||token!==epoch||item.ownerScope!==state?.ownerScope)return;
  busy='';reset();
  let detail;try{detail=getPersistenceDetail();}catch{}
  const temporary=state?.persistence==='memory-session'?'до перезагрузки страницы':detail==='transient'?'до перезапуска сервера':detail==='persistent'?'на этом компьютере':'в локальном хранилище';
  notice=result?.ok&&usable(state)?`Добавлено копий: ${item.plan.importSummary.added}. Сохранено ${temporary}.`:message(result);
  paint();details.querySelector('summary').focus();
 }
 function cancelFile(){if(busy)return;reset();notice='Добавление отменено. Сохранения не изменены.';paint();file.focus();}
 function keydown(event){if(event.key==='Escape'&&proposal&&!busy){event.preventDefault();event.stopPropagation();cancelFile();}}
 download.addEventListener('click',exportFile);file.addEventListener('change',selectFile);confirm.addEventListener('click',importFile);cancel.addEventListener('click',cancelFile);host.addEventListener('keydown',keydown);
 return {render,dispose(){disposed=true;++epoch;reset();for(const[url,timer]of urls){clearTimeout(timer);URL.revokeObjectURL(url);}urls.clear();download.removeEventListener('click',exportFile);file.removeEventListener('change',selectFile);confirm.removeEventListener('click',importFile);cancel.removeEventListener('click',cancelFile);host.removeEventListener('keydown',keydown);}};
}
