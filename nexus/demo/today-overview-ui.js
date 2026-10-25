const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const states={ready:'Доступно',empty:'Нет записей',partial:'Частично',loading:'Загрузка',unavailable:'Недоступно',forbidden:'Нет доступа','not-connected':'Не подключено',stale:'Данные устарели',error:'Ошибка обновления'};
const tabs={price:'Цена',risk:'Риск и просадки',performance:'Динамика',financials:'Финансы',seasonality:'Сезонность',technical:'Теханализ',profile:'Профиль'};
const relations={'held-in-selected-account':'Инструмент выбранного счёта','held-in-allowed-accounts':'Инструмент одного из разрешённых счетов','personal-reminder':'Личная дата · относится к владельцу','pinned-research':'Закреплённый разбор','saved-research':'Сохранённый разбор'};
const serviceCodes={ready:'Сведения об источнике доступны',loading:'Сведения об источнике загружаются','sync-unavailable':'Синхронизация недоступна','source-stale':'Сохранённые сведения устарели','not-connected':'Источник не подключён','permission-required':'Требуется доступ к источнику','source-partial':'Сведения об источнике неполные'};
const stamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const day=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'));
const date=value=>day(value)?new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'long'}).format(new Date(value+'T12:00:00Z')):'Дата неизвестна';
const time=value=>stamp(value)?new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(value))+' мск':'Неизвестно';
const status=value=>states[value]||states.unavailable;
const mode=value=>value==='synthetic'?'Учебные данные':value==='local-saved'?'Сохранённые данные':'Источник не подтверждён';
function persistence(scope){
 if(scope?.persistence==='memory-session')return 'Сохранения до перезагрузки страницы';
 if(scope?.persistence==='local-node'&&scope.persistenceDetail==='persistent')return 'Сохранения на этом компьютере';
 if(scope?.persistence==='local-node'&&scope.persistenceDetail==='transient')return (scope.dataMode==='synthetic'?'Учебные сохранения':'Сохранения')+' до перезапуска сервера';
 return 'Срок хранения сохранений не подтверждён';
}
const frozen=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(frozen);Object.freeze(value);}return value;};
const serviceInfo=value=>value?.state==='ready'&&value.code==='ready'?serviceCodes.ready:status(value?.state)+(!['ready','loading'].includes(value?.code)&&serviceCodes[value?.code]?' · '+serviceCodes[value.code]:'');
const fallback=()=>({contractVersion:'today-overview-v1',scope:null,asOf:null,range:null,state:'unavailable',agenda:{state:'unavailable',items:[]},continue:{state:'unavailable',items:[]},service:{state:'unavailable'},coverage:{}});
function normalized(value){
 const valid=value?.contractVersion==='today-overview-v1'&&value.scope&&typeof value.scope.key==='string'
  &&['selected-account','all-accounts'].includes(value.scope.kind)&&stamp(value.asOf)
  &&['agenda','continue'].every(key=>Array.isArray(value[key]?.items)&&value[key].items.length<=3);
 return valid?structuredClone(value):fallback();
}
function emptyCopy(section,kind){
 if(kind==='agenda'&&section.state==='empty'&&section.emptyConfirmed===true)return 'В загруженном календаре на ближайшие семь дней нет дат и личных напоминаний.';
 if(kind==='continue'&&section.state==='empty')return 'Сохраните разбор инструмента, чтобы вернуться к нему отсюда.';
 const copies={loading:'Дождитесь подтверждения данных.',forbidden:'Для этого раздела нет доступа. Проверьте доступ в соответствующем разделе.',
  'not-connected':'Источник не подключён. Откройте синхронизацию для проверки.',stale:'Свежесть данных не подтверждена. Последние подтверждённые записи показаны, если они доступны.',
  error:kind==='agenda'?'Не удалось обновить календарь. Откройте его для проверки.':'Не удалось обновить разборы. Откройте сохранения для проверки.',partial:kind==='agenda'?'Показана доступная часть календаря.':'Показана доступная часть сохранённых разборов.'};
 return copies[section.state]||(kind==='agenda'?'Полнота ближайших дат не подтверждена. Откройте календарь для проверки.':'Список сохранённых разборов пока не подтверждён. Откройте сохранения для проверки.');
}

/** Staging UI only. The injected binder must revalidate before every side effect. */
export function createTodayOverviewUi({host,onNavigate,isCurrent}={}){
 let dto=fallback(),signature='',scopeKey=null,revision=0,disposed=false,pending=false,message='',actions=[],lastCanNavigate=false,lastStandalone=false;
 const current=ticket=>!disposed&&ticket.revision===revision&&ticket.scopeKey===scopeKey&&typeof isCurrent==='function'&&(()=>{try{return isCurrent(ticket)===true;}catch{return false;}})();
 function render(){
  if(!host||disposed)return;
  const previous=document.activeElement,active=host.contains(previous)?previous:null;
  const scrollLeft=active?.hasAttribute('data-today-scroll')?active.scrollLeft:0;
  const focused=active?.tagName==='SUMMARY'?{summary:active.parentElement.dataset.todayDetails}:active?.dataset.todayAction!==undefined?{action:JSON.stringify(actions[Number(active.dataset.todayAction)]?.intent)}:null;
  const opened=new Set([...host.querySelectorAll('details[open]')].map(node=>node.dataset.todayDetails));
  const standalone=host.dataset.taskOpen==='true';lastStandalone=standalone;
  if(standalone)opened.add('main');
  actions=[];const ticket=Object.freeze({scopeKey,asOf:dto.asOf,revision});
  const canNavigate=typeof onNavigate==='function'&&current(ticket);
  lastCanNavigate=canNavigate;
  const commandMessage=message||(!canNavigate&&dto.scope?'Переходы недоступны. Дождитесь подтверждения текущего контекста.':'');
  function button(label,intent,kind='link'){
   if(!intent)return '';
   const index=actions.push({intent:frozen(structuredClone(intent)),ticket})-1;
   return `<button type="button" class="today-${kind}" data-today-action="${index}" ${!canNavigate?'disabled':''} ${pending?'aria-disabled="true"':''}>${label}</button>`;
  }
  function items(section,kind){return section.items.map((item,index)=>{
   const temporal=kind==='agenda'?item.kind==='reminder'?time(item.eventAt):date(item.eventDate)+' · время не опубликовано':'Изменено '+time(item.savedAt);
   const evidence=item.evidence||{};
   const retained=['stale','error'].includes(evidence.state)?'Последние подтверждённые данные · '+status(evidence.state):mode(evidence.dataMode);
   const heading=esc((kind==='agenda'&&item.instrumentLabel?item.instrumentLabel+' · ':'')+(item.title||'Запись без названия'));
   const calendarDate=kind==='agenda'&&day(item.eventDate)?'<span class="today-date-tile" aria-hidden="true"><b>'+Number(item.eventDate.slice(8))+'</b><small>'+new Intl.DateTimeFormat('ru-RU',{month:'short',timeZone:'Europe/Moscow'}).format(new Date(item.eventDate+'T12:00:00Z'))+'</small></span>':'<span class="today-item-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z"/></svg></span>';
   const body=`${calendarDate}<span class="today-item-copy"><strong>${heading}</strong><span class="today-row-meta">${esc(temporal)}${kind==='continue'?' · '+esc(tabs[item.analysisTab]||'Вкладка недоступна'):''}</span>${['stale','error'].includes(evidence.state)?'<span class="today-row-warning">'+esc(retained)+'</span>':''}</span>`;
   const sourceKey='source-'+kind+'-'+encodeURIComponent(item.id??JSON.stringify(item.navigation??index));
   return `<li>${button(body,item.navigation,'row')||'<div class="today-row">'+body+'</div>'}<details class="today-item-source" data-today-details="${esc(sourceKey)}" ${opened.has(sourceKey)?'open':''}><summary aria-label="Источник записи" title="Источник записи"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 11v6m0-10v1M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20"/></svg></summary><p class="today-row-relation">${esc(relations[item.relationReason]||'Связь не подтверждена')}</p><p class="today-row-evidence">${esc(mode(evidence.dataMode))}</p>${kind==='agenda'?'<p class="today-row-time">Наблюдалось: '+esc(time(evidence.observedAt))+' · Время источника: '+esc(time(evidence.sourceAt))+'</p>':''}</details></li>`;
  }).join('');}
  function column(kind,label){const section=dto[kind];
   return `<section class="today-column" data-today-section="${kind}" aria-label="${label}"><header><h3>${label}</h3>${section.state!=='ready'?'<span data-today-state="'+kind+'">'+esc(status(section.state))+'</span>':''}</header>${section.items.length?'<ol>'+items(section,kind)+'</ol>':''}${!section.items.length?'<p class="today-empty-title">'+(kind==='continue'&&section.state==='empty'?'Здесь будут ваши разборы':kind==='agenda'&&section.state==='empty'?'Ближайших дат нет':kind==='agenda'?'Календарь пока недоступен':'Сохранения пока недоступны')+'</p>':''}${section.state!=='ready'||!section.items.length?'<p class="today-empty">'+esc(emptyCopy(section,kind))+'</p>':''}${button(kind==='agenda'?'Открыть календарь':'Сохранённые разборы',section.more)}</section>`;
  }
  const coverage=dto.coverage||{};
  const coverageRows=[['holdings','Позиции'],['calendar','Календарь'],['reminders','Личные даты']].map(([key,label])=>{
   const item=coverage[key]||{};const state=key==='calendar'?(item.state==='complete'?'Загруженное окно подтверждено':item.state==='partial'?'Неполное окно':'Окно не подтверждено'):item.confirmed!==true?'Снимок не подтверждён':status(item.state);
   return `<tr><th scope="row">${label}</th><td>${esc(state)}</td><td>${esc(time(item.observedAt))}</td><td>${esc(time(item.sourceAt))}</td></tr>`;
  }).join('');
  const scopeLabel=dto.scope?.kind==='all-accounts'?'Все разрешённые счета':dto.scope?.label||'Область не подтверждена';
  const summary=`Даты: ${status(dto.agenda.state).toLocaleLowerCase('ru')} · Продолжить: ${status(dto.continue.state).toLocaleLowerCase('ru')}`;
  host.dataset.state=dto.state||'unavailable';
  const mainStart=standalone?'<section class="today-standalone" data-today-details="main">':`<details class="today-disclosure" data-today-details="main" ${opened.has('main')?'open':''}><summary><strong>Сегодня</strong><span>${esc(summary)}</span></summary>`;
  const mainFocus=()=>host.querySelector(standalone?'.today-heading h2':'[data-today-details="main"]>summary');
  host.innerHTML=`${mainStart}<div class="today-body"><header class="today-heading"><h2 tabindex="-1">Сегодня</h2><p>${dto.range?esc(date(dto.range.from))+' — '+esc(date(dto.range.to))+' · ближайшие семь дней':'Ближайшие даты и продолжение работы'}</p></header><p class="today-context" hidden>${esc(scopeLabel)} · ${esc(mode(dto.scope?.dataMode))}</p><div class="today-columns">${column('agenda','Ближайшие события')}${column('continue','Продолжить работу')}</div><p class="today-command-status" role="status" aria-live="polite">${esc(commandMessage)}</p><div class="today-source-bar"><details class="today-coverage" data-today-details="coverage" ${opened.has('coverage')?'open':''}><summary>Источники и ограничения</summary><p>Обзор собран: ${esc(time(dto.asOf))}. Это время сборки, а не подтверждение свежести источников.</p><p>До трёх дат на ближайшие семь дней. Наличие бумаги не подтверждает право на дивиденд. Отсутствие дат в загруженном окне не означает отсутствие всех событий на рынке.</p><p>${esc(persistence(dto.scope))}. Закреплённые разборы показаны первыми; это сохранения, не история посещений.</p>${coverage.calendar?.state==='partial'?'<p>Полнота семи дней не подтверждена; загруженный месяц и фильтр календаря могут ограничивать выборку.</p>':''}<p>Время источника неизвестно, если оно не передано отдельно. Личные даты относятся к владельцу, независимо от выбранного счёта.</p><div class="today-table-scroll" tabindex="0" data-today-scroll aria-label="Время источников, доступна горизонтальная прокрутка"><table><thead><tr><th scope="col">Раздел</th><th scope="col">Покрытие</th><th scope="col">Наблюдалось</th><th scope="col">Время источника</th></tr></thead><tbody>${coverageRows}</tbody></table></div><p>Служебные сведения наблюдались: ${esc(time(dto.service.observedAt))}. Время их источника: ${esc(time(dto.service.sourceAt))}.</p></details><div class="today-service" data-today-service><span>${esc(serviceInfo(dto.service))}</span>${button('Проверить источники',dto.service.navigation)}</div></div></div>${standalone?'</section>':'</details>'}`;
  if(active){
   let target=mainFocus();
   if(focused?.summary&&opened.has('main'))target=[...host.querySelectorAll('[data-today-details]>summary')].find(n=>n.parentElement.dataset.todayDetails===focused.summary)||target;
   if(focused?.action&&opened.has('main')){const index=actions.findIndex(action=>JSON.stringify(action.intent)===focused.action);target=host.querySelector(`[data-today-action="${index}"]`)||target;}
   if(active.hasAttribute('data-today-scroll')&&opened.has('coverage')){target=host.querySelector('[data-today-scroll]');target.scrollLeft=scrollLeft;}
   // A lost permission or removed row returns focus to the visible section heading.
   if(target?.disabled)target=mainFocus();
   target?.focus({preventScroll:true});
   if(target===mainFocus()&&active.tagName!=='SUMMARY')target.scrollIntoView({block:'nearest',behavior:'instant'});
  }
 }
 function update(value){
  if(disposed||!host)return;
  const next=normalized(value),nextSignature=JSON.stringify(next);
  if(nextSignature===signature){
   const allowed=typeof onNavigate==='function'&&current({scopeKey,asOf:dto.asOf,revision});
   if(allowed!==lastCanNavigate){revision++;pending=false;message='';render();}
   return;
  }
  const changed=(next.scope?.key||null)!==scopeKey,active=host.contains(document.activeElement);
  if(changed)host.querySelectorAll('details[open]').forEach(node=>node.open=false);
  dto=next;signature=nextSignature;scopeKey=next.scope?.key||null;revision++;pending=false;message='';render();
  if(changed&&active){const main=host.querySelector(host.dataset.taskOpen==='true'?'.today-heading h2':'[data-today-details="main"]>summary');main?.focus({preventScroll:true});main?.scrollIntoView({block:'nearest',behavior:'instant'});}
 }
 async function click(event){
  const control=event.target.closest('[data-today-action]');if(!control||!host.contains(control)||control.disabled||pending)return;
  const action=actions[Number(control.dataset.todayAction)];if(!action||!current(action.ticket)){
   message='Контекст изменился. Дождитесь обновления обзора.';render();return;
  }
  pending=true;message='Открываем…';render();
  let lease=true;
  const guard=()=>lease&&current(action.ticket);
  const settleStale=()=>{if(!disposed&&action.ticket.revision===revision&&action.ticket.scopeKey===scopeKey){pending=false;message='Контекст изменился. Дождитесь обновления обзора.';render();}};
  if(!guard()){lease=false;settleStale();return;}
  let result;try{result=await onNavigate(action.intent,Object.freeze({...action.ticket,isCurrent:guard}));}catch{result={ok:false};}
  const accepted=guard();lease=false;
  if(!accepted){settleStale();return;}
  pending=false;message=result?.ok===true?'':'Не удалось открыть запись. Проверьте доступность в соответствующем разделе.';render();
 }
 const routeChanged=()=>{if(host&&!disposed&&lastStandalone!==(host.dataset.taskOpen==='true'))render();};
 document.addEventListener('invest:task-route-changed',routeChanged);
 host?.addEventListener('click',click);
 render();
 return {update,dispose(){disposed=true;revision++;actions=[];host?.removeEventListener('click',click);document.removeEventListener('invest:task-route-changed',routeChanged);}};
}
