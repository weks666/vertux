import {createSavedResearchTransferUi} from './saved-research-transfer-ui.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const messages={
 'access-unavailable':'Сохранённые исследования сейчас недоступны. Откройте их после входа в рабочее пространство.',
 'research-forbidden':'Для текущего контекста сохранение исследований недоступно.',
 'refresh-required':'Обновите список перед следующим действием.',
 'request-in-progress':'Дождитесь завершения текущего действия.',
 'stale-request':'Контекст изменился. Действие не подтверждено; обновите список.',
 'transport-unavailable':'Не удалось связаться с локальным хранилищем. Повторите загрузку списка.',
 'invalid-response':'Ответ хранилища не подтверждён. Обновите список.',
 'revision-conflict':'Список изменился в другом окне. Обновите его и повторите действие.',
 'entry-not-found':'Это сохранение уже недоступно. Обновите список.',
 'commit-failed':'Не удалось завершить открытие исследования. Проверьте текущий инструмент и повторите.',
 'record-limit':'Сохранено 20 исследований. Удалите ненужное, чтобы добавить новое. Автоматической замены нет.',
 'pin-limit':'Можно закрепить не больше трёх исследований. Сначала открепите одно из них.',
 'invalid-title':'Введите название от 1 до 120 символов без управляющих знаков.',
 'instrument-unavailable':'Точный инструмент отсутствует в текущем каталоге.',
 'instrument-ambiguous':'Точный инструмент не удалось однозначно определить.',
 'origin-unverified':'Источник инструмента не подтверждён.',
 'reference-mismatch':'Идентичность инструмента изменилась. Выберите его заново.',
 'guard-changed':'Идентичность инструмента изменилась. Сохранённая ссылка не открыта.',
 'guard-unavailable':'Для проверки идентичности инструмента не хватает данных.',
 'scope-changed':'Рабочее пространство или инструмент изменились. Обновите список.',
 'research-not-permitted':'Исследование этого инструмента сейчас недоступно.',
};
const emptyDescription={key:null,exact:false,caption:'Точный инструмент не выбран',tabLabel:'',reason:'Выберите доступный точный инструмент и вкладку анализа.'};
const ready=state=>state?.fresh===true&&['ready','empty'].includes(state.state)&&state.document?.schemaVersion===1&&Array.isArray(state.document.entries);

/** Presentation only. Commands and exact identity checks belong to the controller. */
export function createSavedResearchUi({host,commands,describeCurrent=()=>emptyDescription,describeEntry=()=>emptyDescription,getPersistenceDetail=()=>null}){
 let state=null,owner=null,currentKey=null,query='',editor=null,menuFor=null,recoverConfirm=false,notice='',localError='',busy=false,operation=0;
 if(!host)return {render(){},dispose(){}};
 host.classList.add('saved-research');
 host.innerHTML='<header class="saved-research-toolbar"><div><h3 tabindex="-1" data-sr-focus="list">Сохранённые исследования<span data-sr-count></span></h3><p class="saved-research-storage" data-sr-storage></p></div><button type="button" data-sr-action="show-save" data-sr-focus="show-save" aria-expanded="false">Сохранить текущий</button></header><form class="saved-research-create" data-sr-create hidden><p data-sr-current></p><label>Название исследования<input data-sr-title data-sr-focus="title" name="title" maxlength="120" required autocomplete="off"></label><div><button type="submit" data-sr-focus="save">Сохранить</button><button type="button" data-sr-action="cancel-save" data-sr-focus="cancel-save">Отмена</button></div></form><p class="saved-research-status" data-sr-eligibility hidden></p><p class="saved-research-status" data-sr-status role="status" aria-live="polite"></p><div class="saved-research-pins" data-sr-pins aria-label="Закреплённые исследования"></div><section class="saved-research-list" data-sr-list><div class="saved-research-body"><div class="saved-research-list-tools"><label><span class="sr-only">Поиск сохранений</span><input type="search" data-sr-query data-sr-focus="query" placeholder="Найти по названию или инструменту" autocomplete="off"></label><button type="button" data-sr-action="refresh" data-sr-focus="refresh" title="Обновить список">Обновить</button></div><div data-sr-recovery></div><div data-sr-rows></div><p data-sr-limit></p></div></section>';
 const $=selector=>host.querySelector(selector),create=$('[data-sr-create]'),title=$('[data-sr-title]'),list=$('[data-sr-list]');
 const transferHost=document.createElement('div');$('[data-sr-limit]').after(transferHost);
 const transfer=createSavedResearchTransferUi({host:transferHost,commands,describeEntry,getPersistenceDetail});
 const description=(fn,value)=>{try{return {...emptyDescription,...fn(value)};}catch{return emptyDescription;}};
 const current=()=>description(describeCurrent);
 const persistenceDetail=()=>{try{return getPersistenceDetail();}catch{return null;}};
 const permitted=()=>ready(state)&&!state.pending&&!busy;
 const setDisabled=(element,value)=>{if(element)element.setAttribute('aria-disabled',String(Boolean(value)));};
 const actionButton=(action,label,id,disabled=false,extra='',focusKey=action+':'+(id||''))=>`<button type="button" data-sr-action="${action}" ${id?`data-sr-id="${esc(id)}"`:''} data-sr-focus="${esc(focusKey)}" aria-disabled="${disabled}" ${extra}>${esc(label)}</button>`;
 function focus(key){const target=host.querySelector(`[data-sr-focus="${CSS.escape(key)}"]`);(target||$('[data-sr-focus=list]'))?.focus({preventScroll:true});}
 function renderRows(){
  const active=host.contains(document.activeElement)?document.activeElement:null,key=active?.dataset.srFocus,selection=typeof active?.selectionStart==='number'?[active.selectionStart,active.selectionEnd]:null;
  const entries=Array.isArray(state?.document?.entries)?state.document.entries:[],pins=entries.filter(row=>row.pinOrder!==null).sort((a,b)=>a.pinOrder-b.pinOrder),can=permitted();
  $('[data-sr-pins]').innerHTML=pins.length?'<span>Закреплённые исследования</span>'+pins.map(row=>{const info=description(describeEntry,row);return actionButton('restore',row.title,row.id,!can||!info.exact,`title="${esc(info.exact?info.caption+' · '+info.tabLabel:info.reason)}"`,'pin-restore:'+row.id);}).join(''):'';
  const rows=entries.map(row=>({row,info:description(describeEntry,row)})).filter(({row,info})=>[row.title,info.exact?info.caption:'',info.tabLabel].join(' ').toLocaleLowerCase('ru-RU').includes(query.toLocaleLowerCase('ru-RU')));
  let content='';
  if(!state?.document)content='<p>Список пока не подтверждён. Сохранённые исследования не считаются отсутствующими.</p>';
  else if(!entries.length)content=ready(state)?'<p>Пока нет сохранённых исследований.</p>':'<p>Последний подтверждённый список был пуст. Обновите его перед следующим действием.</p>';
  else if(!rows.length)content='<p>По этому запросу сохранения не найдены. Измените поисковую строку.</p>';
  else content='<ul>'+rows.map(({row,info})=>{
   const pinned=row.pinOrder!==null,edit=editor?.id===row.id;
   return `<li data-sr-row="${esc(row.id)}"><div class="saved-research-row-head"><div><strong>${esc(row.title)}</strong><p>${esc(info.exact?info.caption:info.reason)}${info.tabLabel?' · '+esc(info.tabLabel):''}</p></div>${actionButton('restore','Открыть',row.id,!can||!info.exact,`aria-label="Открыть исследование: ${esc(row.title)}"`)}${actionButton('options','Действия',row.id,!can,`aria-expanded="${menuFor===row.id}" aria-label="Действия с исследованием: ${esc(row.title)}"`,'actions:'+row.id)}</div><div class="saved-research-row-actions" ${menuFor===row.id?'':'hidden'}>${actionButton('pin',pinned?'Открепить':'Закрепить',row.id,!can||!pinned&&pins.length>=3,`aria-pressed="${pinned}"`)}${actionButton('rename','Переименовать',row.id,!can)}${actionButton('remove','Удалить',row.id,!can)}${pinned&&pins.length>1?actionButton('up','Выше',row.id,!can||row.pinOrder===0)+actionButton('down','Ниже',row.id,!can||row.pinOrder===pins.length-1):''}</div>${edit&&editor.type==='rename'?`<form data-sr-rename="${esc(row.id)}"><label>Новое название<input name="title" data-sr-edit-title data-sr-focus="rename-title:${esc(row.id)}" value="${esc(editor.title)}" maxlength="120" required autocomplete="off"></label><div><button type="submit" data-sr-focus="rename-submit:${esc(row.id)}" aria-disabled="${!can}">Сохранить название</button>${actionButton('cancel-edit','Отмена',row.id)}</div></form>`:edit&&editor.type==='remove'?`<div class="saved-research-confirm"><p>Удалить исследование «${esc(row.title)}»? Оно исчезнет из списка и закреплений.</p>${actionButton('confirm-remove','Удалить исследование',row.id,!can)}${actionButton('cancel-edit','Отмена',row.id)}</div>`:''}</li>`;
  }).join('')+'</ul>';
  $('[data-sr-rows]').innerHTML=content;
  const recovery=state&&['corrupt','unsupported-version'].includes(state.state);
  $('[data-sr-recovery]').innerHTML=recovery?`<p>${state.state==='corrupt'?'Текущие сохранения повреждены.':'Формат сохранений не поддерживается этой версией.'} Список не заменён пустым.</p>${state.recovery?.available?recoverConfirm?'<div class="saved-research-confirm"><p>Вернуть последнюю доступную исправную копию? Более поздние изменения могут отсутствовать в ней. Текущая копия будет сохранена отдельно.</p>'+actionButton('confirm-recover','Восстановить исправную копию',null,Boolean(state.pending)||busy)+actionButton('cancel-recover','Отмена')+'</div>':actionButton('recover','Восстановить из исправной копии',null,Boolean(state.pending)||busy):'<p>Исправная копия для восстановления недоступна. Данные оставлены без изменений.</p>'}`:'';
  if(key){focus(key);const restored=document.activeElement;if(selection&&typeof restored?.setSelectionRange==='function')try{restored.setSelectionRange(...selection);}catch{}}
 }
 function render(snapshot){
  const priorOwner=owner,priorState=state,hadFocus=host.contains(document.activeElement);state=snapshot;owner=snapshot?.ownerScope??null;
  const context=current(),changedOwner=priorOwner!==owner,changedCurrent=currentKey!==context.key;currentKey=context.key;
  const securityReset=!state?.document&&['unloaded','forbidden','disposed'].includes(state?.state)&&priorState?.state!==state?.state;
  if(changedOwner||securityReset){++operation;busy=false;query='';editor=null;menuFor=null;recoverConfirm=false;notice='';localError='';create.hidden=true;title.value='';$('[data-sr-query]').value='';}
  else if(changedCurrent){notice='';if(!create.hidden){const inside=create.contains(document.activeElement);create.hidden=true;title.value='';localError='Инструмент или вкладка изменились. Откройте форму сохранения заново.';if(inside)focus('show-save');}}
  host.dataset.state=state?.state||'unavailable';host.setAttribute('aria-busy',String(Boolean(state?.pending)||busy));
  const entries=state?.document?.entries,hasDocument=Array.isArray(entries),can=permitted(),mode=state?.persistence;
  const detail=persistenceDetail();
  $('[data-sr-storage]').textContent=mode==='local-node'?(detail==='transient'?'Учебные сохранения до перезапуска сервера':detail==='persistent'?'Сохранения на этом компьютере':'Локальное хранилище · срок сохранения не подтверждён'):mode==='memory-session'?'Только в памяти этой страницы · исчезнут при перезагрузке':'Хранилище сохранений недоступно';
  $('[data-sr-eligibility]').hidden=!(ready(state)&&!context.exact);
  $('[data-sr-eligibility]').textContent=ready(state)&&!context.exact?context.reason:'';
  $('[data-sr-current]').textContent=context.exact?context.caption+' · '+context.tabLabel:context.reason;
  $('[data-sr-count]').textContent=hasDocument?' · '+entries.length+'/20':'';
  $('[data-sr-limit]').textContent=hasDocument&&entries.length>=20?messages['record-limit']:'До 20 исследований и 3 закреплений. Сохраняются инструмент и вкладка; рыночные данные загружаются заново.';
  const status=state?.pending?({refresh:'Загружаем список…',save:'Сохраняем исследование…',mutate:'Записываем изменение…',restore:'Открываем исследование…',recover:'Восстанавливаем исправную копию…'}[state.pending]||'Выполняем действие…'):localError||state?.error?.code&&(messages[state.error.code]||'Действие не подтверждено. Обновите список и повторите.')||notice||(!can&&!['corrupt','unsupported-version'].includes(state?.state)?'Список не готов к изменениям. Обновите его или проверьте доступ.':'');
  $('[data-sr-status]').textContent=status+(hasDocument&&!state?.fresh?' Показан последний подтверждённый список; изменения и открытие временно недоступны.':'');
  setDisabled($('[data-sr-action=show-save]'),!can||!context.exact||entries.length>=20);setDisabled(create.querySelector('[type=submit]'),!can||!context.exact||entries.length>=20);
  setDisabled($('[data-sr-action=refresh]'),Boolean(state?.pending)||busy||!owner);$('[data-sr-action=show-save]').setAttribute('aria-expanded',String(!create.hidden));
  renderRows();transfer.render(state);if((changedOwner||securityReset)&&hadFocus)focus('list');
 }
 async function run(name,args,success){
  if(busy||state?.pending)return;const capturedOwner=owner,capturedOperation=++operation;busy=true;notice='';localError='';render(state);
  let result;try{result=await commands[name](...args);}catch{result={ok:false,error:{code:'transport-unavailable'}};}
  if(capturedOperation!==operation||capturedOwner!==owner)return;
  busy=false;
  if(result?.ok===true&&ready(state)){notice=typeof success==='function'?success():success;localError='';if(name==='saveCurrent'){const inside=create.contains(document.activeElement);create.hidden=true;title.value='';if(inside)focus('show-save');}if(name==='mutate'){editor=null;}if(name==='recover')recoverConfirm=false;}
  else if(result?.ok!==true)localError=messages[result?.error?.code]||'Действие не подтверждено. Сохранённые данные не заменены.';
  render(state);
  if(name==='restore'&&result?.ok===true&&ready(state))host.ownerDocument?.dispatchEvent?.(new CustomEvent('invest:research-restored'));
 }
 const acknowledgement=()=>state?.persistence==='memory-session'?'Сохранено до перезагрузки':persistenceDetail()==='transient'?'Сохранено до перезапуска сервера':persistenceDetail()==='persistent'?'Сохранено на этом компьютере':'Запись подтверждена; срок сохранения не подтверждён';
 function click(event){
  const button=event.target.closest('[data-sr-action]');if(!button||!host.contains(button)||button.getAttribute('aria-disabled')==='true')return;
  const action=button.dataset.srAction,id=button.dataset.srId,entry=state?.document?.entries?.find(row=>row.id===id);
  if(action==='show-save'){if(!permitted()||!current().exact)return;create.hidden=false;title.value=(current().defaultTitle||current().caption+' · '+current().tabLabel).slice(0,120).trim();localError='';render(state);title.focus();title.select();return;}
  if(action==='cancel-save'){create.hidden=true;render(state);focus('show-save');return;}
  if(action==='refresh'){void run('refresh',[],'Список обновлён.');return;}
  if(action==='recover'||action==='cancel-recover'){recoverConfirm=action==='recover';renderRows();focus(recoverConfirm?'confirm-recover:':'recover:');return;}
  if(action==='confirm-recover'){if(['corrupt','unsupported-version'].includes(state?.state)&&state.recovery?.available)void run('recover',[],'Исправная копия восстановлена.');return;}
  if(action==='cancel-edit'){editor=null;renderRows();focus('actions:'+id);return;}
  if(!permitted()||!entry)return;
  if(action==='options'){menuFor=menuFor===id?null:id;renderRows();focus('actions:'+id);return;}
  if(action==='restore'){if(description(describeEntry,entry).exact)void run('restore',[id],'Исследование открыто.');}
  else if(action==='rename'||action==='remove'){editor={type:action,id,title:entry.title};renderRows();focus(action==='rename'?'rename-title:'+id:'confirm-remove:'+id);}
  else if(action==='confirm-remove')void run('mutate',[{type:'remove',id}],'Исследование удалено.');
  else if(action==='pin')void run('mutate',[{type:'pin',id,enabled:entry.pinOrder===null}],()=>entry.pinOrder===null?'Исследование закреплено.':'Исследование откреплено.');
  else if(action==='up'||action==='down'){const ids=state.document.entries.filter(row=>row.pinOrder!==null).sort((a,b)=>a.pinOrder-b.pinOrder).map(row=>row.id),index=ids.indexOf(id),next=index+(action==='up'?-1:1);if(next<0||next>=ids.length)return;[ids[index],ids[next]]=[ids[next],ids[index]];void run('mutate',[{type:'reorder',ids}],'Порядок закреплений сохранён.');}
 }
 function submit(event){
  const form=event.target;if(form!==create&&!form.matches('[data-sr-rename]'))return;event.preventDefault();if(!permitted())return;
  const value=form.querySelector('input').value.trim();if(!value||value.length>120||/[\u0000-\u001f\u007f]/u.test(value)){localError=messages['invalid-title'];render(state);return;}
  if(form===create){if(current().exact&&state.document.entries.length<20)void run('saveCurrent',[value],acknowledgement);}
  else void run('mutate',[{type:'rename',id:form.dataset.srRename,title:value}],acknowledgement);
 }
 function input(event){if(event.target.matches('[data-sr-query]')){query=event.target.value;renderRows();}if(event.target.matches('[data-sr-edit-title]')&&editor)editor.title=event.target.value;}
 function keydown(event){if(event.key!=='Escape')return;if(!create.hidden&&create.contains(event.target)){create.hidden=true;render(state);focus('show-save');event.preventDefault();}else if(editor&&event.target.closest('[data-sr-row]')){const id=editor.id;editor=null;renderRows();focus('actions:'+id);event.preventDefault();}else if(menuFor){const id=menuFor;menuFor=null;renderRows();focus('actions:'+id);event.preventDefault();}else if(recoverConfirm&&event.target.closest('[data-sr-recovery]')){recoverConfirm=false;renderRows();focus('recover:');event.preventDefault();}}
 host.addEventListener('click',click);host.addEventListener('submit',submit);host.addEventListener('input',input);host.addEventListener('keydown',keydown);
 return {render,dispose(){++operation;transfer.dispose();host.removeEventListener('click',click);host.removeEventListener('submit',submit);host.removeEventListener('input',input);host.removeEventListener('keydown',keydown);}};
}
