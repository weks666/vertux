import {renderContextEvidence} from './context-evidence.js';
import {buildResearchContextEvidence} from './context-evidence-adapters.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stamp=value=>value?new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value))+' мск':'не указано';
const endpoint='/api/research/notes';
const displayMetric=m=>`${m.label}: ${m.value} ${m.unit}${m.period?' · '+m.period:''}`;
const factsMarkup=snapshot=>`<dl class="research-note-facts">${snapshot.metrics.map(m=>`<div><dt>${esc(m.label)}</dt><dd>${esc(m.value)} <span>${esc(m.unit)}</span></dd><small>${esc(m.period||'Период не указан')}</small></div>`).join('')}</dl>`;
function provenance(snapshot){return `<details class="insight-provenance"><summary>Источники и ограничения среза</summary><p>Отчётная дата: ${esc(stamp(snapshot.dataAsOf))}. Получены показатели: ${esc(stamp(snapshot.receivedAt))}.</p><p>Получены сведения об инструменте: ${esc(stamp(snapshot.metadataReceivedAt))}. Время получения не заменяет отчётную дату.</p><ul>${snapshot.sources.map(s=>`<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a><small>Данные: ${esc(stamp(s.asOf))} · получено ${esc(stamp(s.retrievedAt))}</small></li>`).join('')}</ul>${snapshot.limitations.map(s=>`<p>${esc(s)}</p>`).join('')}</details>`;}
const snapshotLabel=s=>s.cacheState==='synthetic'?'Учебные факты':s.cacheState==='stale'?'Сохранённые факты могут быть устаревшими':'Сохранённые факты';

export function createResearchNotesUI({host,request}){
 let key=null,instrument=null,allowed=false,opened=false,generation=0,operation=0,pending=false,fresh=false,notes=[],draft=null,requestId=null,selected=null;
 host.hidden=true;host.classList.add('research-notes');
 host.innerHTML='<button type="button" data-rn="toggle" aria-expanded="false">Заметки с фактами</button><section class="research-notes-panel" hidden aria-label="Заметки с фактами"><div class="research-note-actions"><button type="button" data-rn="new">Новая заметка</button><button type="button" data-rn="refresh">Обновить список</button><button type="button" data-rn="close">Закрыть</button></div><p class="terminal-caption">Сохраните вопрос, до трёх показателей с источниками и собственное наблюдение. Обновление компании не переписывает сохранённые факты.</p><p class="research-note-status" role="status" aria-live="polite"></p><div class="research-note-list"></div><div class="research-note-editor"></div><div class="research-note-reader"></div></section>';
 const $=s=>host.querySelector(s),panel=$('.research-notes-panel'),list=$('.research-note-list'),editor=$('.research-note-editor'),reader=$('.research-note-reader');
 const status=message=>{$('.research-note-status').textContent=message;};
 const button=name=>$(`[data-rn="${name}"]`);
 function controls(){button('toggle').setAttribute('aria-expanded',String(opened));panel.hidden=!opened;for(const name of ['new','refresh'])button(name).disabled=pending||!allowed||(name==='new'&&!fresh);for(const node of editor.querySelectorAll('input,textarea,select,button'))node.disabled=pending||!fresh;for(const node of reader.querySelectorAll('button'))node.disabled=pending||!fresh;for(const node of list.querySelectorAll('button'))node.disabled=pending||!fresh;}
 function renderList(){list.innerHTML=fresh?(notes.length?'<ul>'+notes.map(note=>`<li><button type="button" data-open-note="${esc(note.id)}">${esc(note.title)}</button><small>${esc(stamp(note.createdAt))} · ${note.snapshot.metrics.length} показателя</small></li>`).join('')+'</ul>':'<p class="empty-copy">Для этого инструмента ещё нет сохранённых заметок.</p>'):'';controls();}
 function clearEditor(){draft=null;requestId=null;editor.replaceChildren();}
 function close(){opened=false;++operation;pending=false;clearEditor();selected=null;reader.replaceChildren();controls();button('toggle').focus();}
 const current=(serial,op)=>generation===serial&&operation===op&&opened&&allowed;
 async function run(action,{mutation=false,success}={}){
  if(pending||!allowed||!opened)return;const serial=generation,op=++operation;pending=true;status(mutation?'Сохраняем изменение…':'Читаем сохранённые данные…');controls();
  try{const result=await action();if(!current(serial,op))return;pending=false;controls();success?.(result);status('');}
  catch(error){if(!current(serial,op))return;fresh=false;list.replaceChildren();if([401,403].includes(error?.status)){clearEditor();reader.replaceChildren();notes=[];selected=null;}status(mutation?'Изменение не подтверждено. Обновите список перед повтором.':error?.code==='RESEARCH_NOTE_SOURCE_CHANGED'?'Факты изменились. Откройте новый черновик.':'Не удалось прочитать данные. Обновите список; отсутствие заметок не подтверждено.');}
  finally{if(current(serial,op)){pending=false;controls();}}
 }
 function refresh(){return run(()=>request(endpoint+'?instrumentUid='+encodeURIComponent(instrument.instrumentUid)),{success:result=>{if(!Array.isArray(result?.notes))throw Error('Invalid note list');notes=result.notes;fresh=true;clearEditor();selected=null;reader.replaceChildren();renderList();}});}
 function draftEditor(){
  const s=draft.snapshot;reader.replaceChildren();selected=null;
  if(!s.metrics.length){editor.innerHTML='<p class="empty-copy">В сохранённом срезе нет доступных финансовых показателей. Новую заметку с фактами пока не из чего сформировать.</p>';return;}
  const options=(index)=>'<option value="">'+(index?'Не добавлять':'Выберите показатель')+'</option>'+s.metrics.map((m,i)=>`<option value="${esc(m.key)}"${i===index?' selected':''}>${esc(displayMetric(m))}</option>`).join('');
  editor.innerHTML=`<form class="research-note-form"><h4 tabindex="-1">Новая заметка · ${esc(s.instrument.ticker||s.instrument.name)}</h4><p class="terminal-caption">${esc(snapshotLabel(s))}. Отчётная дата: ${esc(stamp(s.dataAsOf))}. Сохраняются только выбранные показатели; полнота отчётности не подтверждается.</p><label>Название<input name="title" maxlength="120" required value="${esc('Разбор '+(s.instrument.ticker||s.instrument.name))}"></label><label>Исследовательский вопрос<textarea name="question" maxlength="1000" rows="2" required></textarea></label><fieldset><legend>Показатели с источниками — от одного до трёх</legend>${[0,1,2].map(i=>`<label>Показатель ${i+1}<select name="metric${i}">${options(i)}</select></label>`).join('')}</fieldset><label>Ваше наблюдение<textarea name="observation" maxlength="2000" rows="3"></textarea></label><label>Что проверить дальше<textarea name="nextCheck" maxlength="1000" rows="2"></textarea></label>${provenance(s)}<div class="research-note-actions"><button type="submit">Сохранить заметку</button><button type="button" data-rn="cancel">Отмена</button></div></form>`;
  editor.querySelector('form').insertAdjacentHTML('beforeend',renderContextEvidence(buildResearchContextEvidence(s,{revision:draft.sourceDigest,draft:true})));
  controls();editor.querySelector('textarea').focus();
 }
 function showNote(id){const note=notes.find(n=>n.id===id);if(!note||!fresh)return;clearEditor();selected=id;const s=note.snapshot;
  reader.innerHTML=`<article><h4 tabindex="-1">${esc(note.title)}</h4><p class="terminal-caption">${esc(s.instrument.name)}${s.instrument.ticker?' · '+esc(s.instrument.ticker):''} · сохранено ${esc(stamp(note.createdAt))}. ${esc(snapshotLabel(s))}; это срез на момент сохранения.</p><h5>Исследовательский вопрос</h5><p class="research-note-prose">${esc(note.question)}</p><h5>Выбранные факты</h5>${factsMarkup(s)}${note.observation?'<h5>Ваше наблюдение</h5><p class="research-note-prose">'+esc(note.observation)+'</p>':''}${note.nextCheck?'<h5>Что проверить дальше</h5><p class="research-note-prose">'+esc(note.nextCheck)+'</p>':''}${provenance(s)}<div class="research-note-actions"><button type="button" data-rn="back">К списку</button><button type="button" data-rn="ask-remove">Удалить заметку…</button></div><div class="research-note-confirm" hidden><p>Удалить эту заметку с сохранёнными фактами?</p><button type="button" data-rn="remove">Удалить</button><button type="button" data-rn="cancel-remove">Сохранить</button></div></article>`;reader.insertAdjacentHTML('beforeend',renderContextEvidence(buildResearchContextEvidence(s,{createdAt:note.createdAt,revision:note.id})));controls();reader.querySelector('h4').focus();
 }
 async function save(event){event.preventDefault();if(!draft||!fresh||pending)return;const form=editor.querySelector('form');if(!form.reportValidity())return;
  const data=new FormData(form),metricKeys=[0,1,2].map(i=>data.get('metric'+i)).filter(Boolean);if(!metricKeys.length||new Set(metricKeys).size!==metricKeys.length){status('Выберите от одного до трёх разных показателей.');return;}
  const body={requestId,instrumentUid:instrument.instrumentUid,sourceDigest:draft.sourceDigest,metricKeys,...Object.fromEntries(['title','question','observation','nextCheck'].map(k=>[k,String(data.get(k)||'')]))};
  await run(()=>request(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),{mutation:true,success:result=>{if(!result?.note?.id)throw Error('Invalid note receipt');notes=[result.note,...notes.filter(n=>n.id!==result.note.id)];clearEditor();renderList();showNote(result.note.id);}});
 }
 host.addEventListener('submit',save);
 host.addEventListener('click',event=>{const open=event.target.closest('[data-open-note]');if(open){showNote(open.dataset.openNote);return;}const target=event.target.closest('[data-rn]');if(!target||target.disabled)return;const action=target.dataset.rn;
  if(action==='toggle'){if(opened){close();return;}opened=true;controls();void refresh();}
  if(action==='close'){close();return;}
  if(action==='refresh')void refresh();
  if(action==='new')void run(()=>request(endpoint+'/draft?instrumentUid='+encodeURIComponent(instrument.instrumentUid)),{success:result=>{if(result?.contractVersion!=='research-note-draft-v1'||result.snapshot?.instrument?.instrumentUid!==instrument.instrumentUid)throw Error('Invalid draft');draft=result;requestId=crypto.randomUUID();draftEditor();}});
  if(action==='cancel'){clearEditor();status('');button('new').focus();}
  if(action==='back'){selected=null;reader.replaceChildren();list.querySelector('button')?.focus();}
  if(action==='ask-remove'){reader.querySelector('.research-note-confirm').hidden=false;button('remove').focus();}
  if(action==='cancel-remove'){reader.querySelector('.research-note-confirm').hidden=true;button('ask-remove').focus();}
  if(action==='remove'){const note=notes.find(n=>n.id===selected);if(!note)return;void run(()=>request(endpoint+'/remove',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:note.id,instrumentUid:instrument.instrumentUid,payloadHash:note.payloadHash})}),{mutation:true,success:result=>{if(result?.removed!==true)throw Error('Invalid removal receipt');notes=notes.filter(n=>n.id!==selected);selected=null;reader.replaceChildren();renderList();button('new').focus();}});}
 });
 host.addEventListener('keydown',event=>{if(event.key==='Escape'&&opened){event.preventDefault();event.stopPropagation();close();}});
 return {update({meta,active,accessKey,permitted}){const next=JSON.stringify([accessKey,meta.instrumentUid,meta.assetUid,meta.assetType,meta.currency,permitted,active]);if(next!==key){++generation;++operation;key=next;opened=false;pending=false;fresh=false;notes=[];clearEditor();reader.replaceChildren();list.replaceChildren();selected=null;status('');}instrument=meta;allowed=permitted&&meta.assetType==='share';host.hidden=!active||!allowed;controls();}};
}
