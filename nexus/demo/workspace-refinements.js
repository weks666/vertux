import {mountWorkspacePanels} from './workspace-panels.js';
import {mountWorkspaceHistory} from './workspace-navigation-history.js';
import {WORKSPACE_BACKGROUND_LIMIT,resetWorkspaceSettings} from './workspace-settings-model.js';
export function mountWorkspaceRefinements({doc=document,store}) {
 const appearance=doc.querySelector('.workspace-customization'),legacy=appearance.querySelector('[data-visual-effects]')?.closest('label');if(legacy)legacy.hidden=true;
 const lights=doc.createElement('section');lights.className='workspace-card-lighting';
 lights.innerHTML='<h4>Подсветка карточек</h4><div class="workspace-light-options" role="group" aria-label="Стиль подсветки">'+[['diffuse','Рассеянный свет'],['full','Вся карточка'],['corner','Только угол'],['off','Без подсветки']].map(([id,label])=>'<button type="button" data-card-light="'+id+'" aria-pressed="false"><span class="workspace-light-sample" data-light-sample="'+id+'" aria-hidden="true"></span><span>'+label+'</span></button>').join('')+'</div><div class="workspace-light-controls"><label>Цвет света<input type="color" data-card-light-color aria-label="Цвет подсветки карточек"></label><label>Интенсивность <output data-card-light-output></output><input type="range" min="0" max="100" step="5" data-card-light-intensity aria-label="Интенсивность подсветки карточек"></label><button type="button" data-card-light-reset>Исходный свет</button></div>';
 if(legacy)legacy.after(lights);else appearance.append(lights);
 const background=doc.createElement('section');background.className='workspace-background-settings';
 background.innerHTML='<h4>Свой фон</h4><p>Изображение остаётся в настройках этого профиля. PNG, JPEG или WebP, до 8 МБ.</p><div class="workspace-background-controls"><label class="workspace-background-file">Выбрать изображение<input type="file" accept="image/png,image/jpeg,image/webp" data-workspace-background aria-label="Выбрать фоновое изображение"></label><label>Затемнение <input type="range" min="20" max="90" step="5" data-background-shade aria-label="Затемнение фонового изображения"><output data-background-output></output></label><button type="button" data-background-remove>Убрать фон</button></div><p role="status" data-background-status></p>';
 lights.after(background);
 const reset=doc.createElement('section');reset.className='workspace-reset-settings';
 reset.innerHTML='<h4>Вернуть настройки по умолчанию</h4><div class="workspace-reset-controls"><label>Что сбросить<select data-workspace-reset-section aria-label="Раздел настроек для сброса"><option value="appearance">Оформление</option><option value="panels">Расположение панелей</option><option value="menu">Боковое меню</option><option value="shortcuts">Горячие клавиши</option><option value="all">Все настройки этого блока</option></select></label><button type="button" data-workspace-reset>Сбросить оформление</button><button type="button" data-workspace-reset-undo hidden>Отменить сброс</button></div><p role="status" data-workspace-reset-status></p>';
 background.after(reset);let undo=null,readingBackground=false;
 const resetLabels={appearance:'оформление',panels:'расположение панелей',menu:'боковое меню',shortcuts:'горячие клавиши',all:'настройки этого блока'};
 reset.addEventListener('change',()=>{reset.querySelector('[data-workspace-reset]').textContent='Сбросить '+resetLabels[reset.querySelector('select').value];});
 reset.addEventListener('click',e=>{if(e.target.closest('[data-workspace-reset]')&&store.status().ready){const before=store.get(),part=reset.querySelector('select').value;if(store.write(resetWorkspaceSettings(before,part))){undo={before,ticket:store.snapshot()};reset.querySelector('[data-workspace-reset-undo]').hidden=false;reset.querySelector('[role=status]').textContent='Восстановлены стандартные настройки: '+resetLabels[part]+'.';}else reset.querySelector('[role=status]').textContent=store.status().message;}
  if(e.target.closest('[data-workspace-reset-undo]')&&undo){const restored=store.restore(undo.ticket,undo.before);undo=null;reset.querySelector('[data-workspace-reset-undo]').hidden=true;reset.querySelector('[role=status]').textContent=restored?'Предыдущие настройки восстановлены.':'Настройки уже изменились. Отмена сброса недоступна.';}});
 async function encodeBackground(file){
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024)throw Error('Выберите PNG, JPEG или WebP размером до 8 МБ.');
  const bitmap=await createImageBitmap(file);
  try{for(const bound of [1440,1200,960,720,480]){const scale=Math.min(1,bound/Math.max(bitmap.width,bitmap.height)),canvas=doc.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#101114';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);for(const quality of [.8,.65,.5,.35]){const data=canvas.toDataURL('image/jpeg',quality);if(data.length<=WORKSPACE_BACKGROUND_LIMIT)return data;}}throw Error('Не удалось подготовить изображение. Выберите файл с меньшим количеством деталей.');}finally{bitmap.close();}
 }
 background.addEventListener('change',async e=>{if(e.target.hasAttribute('data-background-shade')){const value=store.get();if(value.presentation.backgroundImage&&store.status().ready)store.write({...value,presentation:{...value.presentation,backgroundImage:{...value.presentation.backgroundImage,shade:Number(e.target.value)}}});return;}
  if(!e.target.hasAttribute('data-workspace-background'))return;const file=e.target.files?.[0],ticket=store.snapshot();e.target.value='';if(!file||!ticket)return;readingBackground=true;applyLight();background.querySelector('[role=status]').textContent='Подготавливаем фон…';
  try{const data=await encodeBackground(file),value=ticket.value;const ok=store.restore(ticket,{...value,presentation:{...value.presentation,backgroundImage:{data,shade:65}}});background.querySelector('[role=status]').textContent=ok?(store.status().persistence==='memory-session'?'Фон применён до перезагрузки предпросмотра.':'Фон применён.'):'Настройки или профиль изменились. Выберите изображение ещё раз.';}catch(error){background.querySelector('[role=status]').textContent=error.message.startsWith('Выберите')||error.message.startsWith('Не удалось подготовить')?error.message:'Не удалось прочитать изображение.';}finally{readingBackground=false;applyLight();}
 });
 background.addEventListener('click',e=>{if(e.target.closest('[data-background-remove]')&&store.status().ready){const value=store.get();delete value.presentation.backgroundImage;store.write(value);background.querySelector('[role=status]').textContent='Фон удалён.';}});
 function applyLight(){const p=store.get().presentation,s=p.cardLight||{};const style=p.effects===false?'off':s.style||'full';doc.documentElement.dataset.cardLighting=style;doc.documentElement.style.setProperty('--card-light-color',s.color||'var(--vertux)');doc.documentElement.style.setProperty('--card-light-strength',(s.intensity??30)+'%');
  lights.querySelectorAll('[data-card-light]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.cardLight===style)));lights.querySelector('[data-card-light-color]').value=s.color||p.accent||'#865dff';lights.querySelector('[data-card-light-intensity]').value=s.intensity??30;lights.querySelector('[data-card-light-output]').value=(s.intensity??30)+'%';for(const c of lights.querySelectorAll('button,input'))c.disabled=!store.status().ready;
  doc.documentElement.dataset.workspaceBackground=String(Boolean(p.backgroundImage));doc.documentElement.style.setProperty('--workspace-background-image',p.backgroundImage?'url("'+p.backgroundImage.data+'")':'none');doc.documentElement.style.setProperty('--workspace-background-shade',(p.backgroundImage?.shade??65)+'%');
  background.querySelector('[data-background-shade]').value=p.backgroundImage?.shade??65;background.querySelector('output').value=(p.backgroundImage?.shade??65)+'%';for(const c of background.querySelectorAll('input,button'))c.disabled=!store.status().ready||readingBackground||!c.hasAttribute('data-workspace-background')&&!p.backgroundImage;
  for(const c of reset.querySelectorAll('button,select'))c.disabled=!store.status().ready;
  if(undo&&!store.isCurrent(undo.ticket)){undo=null;reset.querySelector('[data-workspace-reset-undo]').hidden=true;}
 }
 function saveLight(patch){if(!store.status().ready)return;const p=store.get().presentation;store.write({...store.get(),presentation:{...p,effects:patch.style?patch.style!=='off':p.effects!==false,cardLight:{...p.cardLight,...patch}}});}
 lights.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.cardLight)saveLight({style:b.dataset.cardLight});if(b.hasAttribute('data-card-light-reset')){const p={...store.get().presentation,effects:true};delete p.cardLight;store.write({...store.get(),presentation:p});}});
 lights.addEventListener('input',e=>{if(e.target.hasAttribute('data-card-light-intensity')){doc.documentElement.style.setProperty('--card-light-strength',e.target.value+'%');lights.querySelector('output').value=e.target.value+'%';}});
 lights.addEventListener('change',e=>{if(e.target.hasAttribute('data-card-light-color'))saveLight({color:e.target.value});if(e.target.hasAttribute('data-card-light-intensity'))saveLight({intensity:Number(e.target.value)});});
 const unsubscribe=store.subscribe(applyLight);applyLight();
 const support=doc.querySelector('.ux-portfolio-support'),positions=doc.querySelector('.positions-surface');if(support&&positions)positions.before(support);
 const environment=doc.querySelector('#environmentBanner'),environmentHome=doc.createComment('environment banner');if(environment)environment.before(environmentHome);
 function placeEnvironment(){if(!environment)return;if(doc.body.dataset.currentView==='terminal'){doc.querySelector('.topbar-actions').before(environment);}else if(environmentHome.parentNode&&environment.previousSibling!==environmentHome)environmentHome.after(environment);}
 doc.addEventListener('invest:view-changed',placeEnvironment);placeEnvironment();
 const panels=mountWorkspacePanels({doc,store}),history=mountWorkspaceHistory({doc,store});
 const navs=new Map();let queued=false,disposed=false;
 const navSelector='.deep-analysis-tabs,.workspace-section-tabs,.visual-view-switch,.portfolio-area-tabs,.portfolio-quick-tools,.terminal-dock [role=tablist]';
 function drawTabs(){queued=false;if(disposed)return;
  const current=[...doc.querySelectorAll(navSelector)];
  for(const nav of current)if(!navs.has(nav)){const marker=doc.createElement('span');marker.className='workspace-tab-indicator';marker.setAttribute('aria-hidden','true');nav.append(marker);navs.set(nav,marker);nav.classList.add('workspace-line-tabs');resize.observe(nav);}
  for(const [nav,marker]of navs)if(!nav.isConnected){resize.unobserve(nav);navs.delete(nav);marker.remove();}
  // Measure every active tab before writing any indicator styles. Alternating
  // writes and getClientRects forced a full layout for each hidden/visible group.
  const measurements=current.map(nav=>{
   const marker=navs.get(nav),selected=nav.querySelector('button[aria-pressed=true],button[aria-selected=true],button[aria-current=page]');
   if(!selected||selected.closest('[hidden],.view:not(.active)')||!selected.getClientRects().length)return {marker,hidden:true};
   const r=selected.getBoundingClientRect(),p=nav.getBoundingClientRect();
   return {marker,hidden:false,width:r.width+'px',transform:'translate('+(r.left-p.left+nav.scrollLeft)+'px,'+(r.bottom-p.top+nav.scrollTop-2)+'px)'};
  });
  for(const {marker,hidden,width,transform}of measurements){if(marker.hidden!==hidden)marker.hidden=hidden;if(!hidden){if(marker.style.width!==width)marker.style.width=width;if(marker.style.transform!==transform)marker.style.transform=transform;}}
 }
 function schedule(){if(!queued){queued=true;requestAnimationFrame(drawTabs);}}
 const resize=new ResizeObserver(schedule),observer=new MutationObserver(mutations=>{if(mutations.some(m=>!m.target.matches?.('.workspace-tab-indicator')&&(m.type==='attributes'||[...m.addedNodes].some(n=>n.nodeType===1&&!n.matches('.workspace-tab-indicator')))))schedule();});
 observer.observe(doc.querySelector('#mainContent'),{subtree:true,childList:true,attributes:true,attributeFilter:['aria-pressed','aria-selected','hidden']});doc.addEventListener('invest:view-changed',schedule);drawTabs();
 return{dispose(){disposed=true;unsubscribe();panels.dispose();history.dispose();resize.disconnect();observer.disconnect();doc.removeEventListener('invest:view-changed',schedule);doc.removeEventListener('invest:view-changed',placeEnvironment);if(environmentHome.parentNode&&environment)environmentHome.after(environment);environmentHome.remove();}};
}
