export function mountNexusHistory({parent,request,getCurrent,isBusy}){
 const el=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
 const detail=el('details');detail.className='nexus-ai-storage';const summary=el('summary');summary.setAttribute('aria-label','Хранение и экспорт');summary.title='Хранение и экспорт';const dots=document.createElementNS('http://www.w3.org/2000/svg','svg');dots.setAttribute('viewBox','0 0 24 24');dots.setAttribute('aria-hidden','true');for(const x of [5,12,19]){const dot=document.createElementNS(dots.namespaceURI,'circle');dot.setAttribute('cx',String(x));dot.setAttribute('cy','12');dot.setAttribute('r','1');dots.append(dot);}summary.append(dots,el('span','Хранение и экспорт'));detail.append(summary);
 const body=el('div');body.className='nexus-ai-storage-body';detail.append(body);
 body.append(el('p','История остаётся на устройстве до удаления. Лимит содержимого — 64 МиБ. Счётчик запросов хранится до 90 дней и не очищается вместе с диалогом.'));
 const status=el('p');status.setAttribute('role','status');body.append(status);
 const actions=el('div');actions.className='nexus-ai-composer-actions';
 const download=el('button','Экспортировать этот диалог'),clear=el('button','Удалить прежнюю историю');download.type=clear.type='button';download.className=clear.className='button';download.dataset.aiExport='';clear.dataset.aiClearPrevious='';actions.append(download,clear);body.append(actions);
 body.append(el('small','Экспорт содержит сообщения, выбранные снимки данных и предложения. Удаление прежней истории касается только ваших диалогов от других подключений или наборов счетов; сохранённые планы остаются.'));
 parent.append(detail);let state=null,confirmed=false,pending=false,generation=0;
 function update(){download.disabled=pending||isBusy()||!getCurrent();clear.disabled=pending||isBusy()||!state?.previousConversations;}
 async function load(){const version=++generation;confirmed=false;pending=false;clear.textContent='Удалить прежнюю историю';try{const data=await request('/storage');if(version!==generation)return;state=data;
  status.textContent=`Содержимое: ${(data.contentBytes/1048576).toFixed(2)} из 64 МиБ. Диалогов текущего подключения: ${data.currentConversations}; прежних: ${data.previousConversations}.`;update();
 }catch(e){if(version===generation)status.textContent=e.message;}}
 detail.addEventListener('toggle',()=>{if(detail.open)void load();});
 download.addEventListener('click',async()=>{const id=getCurrent();if(!id||pending||isBusy())return;pending=true;update();const version=generation;
  try{const data=await request('/conversations/'+encodeURIComponent(id)+'/export');if(version!==generation)return;
   const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),link=el('a');link.href=url;link.download='nexus-ai-'+data.exportedAt.slice(0,10)+'.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='Экспорт подготовлен для сохранения на устройстве.';
  }catch(e){if(version===generation)status.textContent=e.message;}finally{if(version===generation){pending=false;update();}}
 });
 clear.addEventListener('click',async()=>{if(pending||isBusy()||!state?.previousConversations)return;if(!confirmed){confirmed=true;clear.textContent='Удалить '+state.previousConversations+' диалогов окончательно';status.textContent='Сообщения и снимки прежних подключений будут удалены. Это действие нельзя отменить.';return;}
  pending=true;update();const version=generation;try{await request('/storage/previous',{method:'DELETE',body:JSON.stringify({confirmed:true,expectedDigest:state.previousDigest})});if(version!==generation)return;pending=false;await load();
  }catch(e){if(version===generation)status.textContent=e.message;}finally{if(version===generation){pending=false;update();}}
 });
 return {update,reset(){generation++;state=null;confirmed=false;pending=false;detail.open=false;status.textContent='';clear.textContent='Удалить прежнюю историю';update();}};
}
