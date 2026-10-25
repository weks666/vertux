import {renderNexusReport,renderNexusProposal} from './nexus-ai-report-ui.js';
import {mountNexusAiSettings} from './nexus-ai-settings-ui.js';
import {mountNexusHistory} from './nexus-ai-history-ui.js';
import {mountNexusInstruments} from './nexus-ai-instruments-ui.js';
import {controlIcon,anchoredMenu} from './interface-controls.js';
const API='/api/nexus-ai';
const ACTIVE=new Set(['queued','collecting','researching','generating','validating']);
const STAGES={queued:'Запрос принят',collecting:'Собираем выбранные данные',researching:'Проверяем источники',generating:'Готовим ответ. Первый запуск модели может занять несколько минут.',validating:'Проверяем ответ',completed:'Ответ сохранён',partial:'Неполный ответ',cancelled:'Запрос остановлен',failed:'Разбор не завершён'};
const ERRORS={ACCESS_REVOKED:'Доступ изменился. Откройте помощника заново.',STALE_CONTEXT:'План изменился во время разбора. Прикрепите его актуальную версию.',PROVIDER_UNAVAILABLE:'Модель помощника не подключена или недоступна.',INVALID_OUTPUT:'Ответ модели не прошёл проверку. Его нельзя использовать для изменения плана.',BUDGET_EXCEEDED:'Достигнут лимит запросов. Сохранённые ответы доступны.',VERSION_CONFLICT:'Повтор запроса содержит другие данные.'};
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const button=(text,action,cls='button')=>{const e=node('button',text,cls);e.type='button';e.addEventListener('click',action);return e;};
const ICONS={plus:'M12 5v14M5 12h14',send:'M12 19V5M5 12l7-7 7 7',close:'M6 6l12 12M18 6 6 18',expand:'M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5',chat:'M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 3V6a2 2 0 0 1 2-2',trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',plan:'M8 3h8l4 4v14H4V3h4M8 11h8M8 15h5',history:'M4 5v5h5M4 10a8 8 0 1 1 2 8M12 7v5l3 2',tools:'M4 7h16M4 17h16M8 4v6M16 14v6',more:'M4 12h2M11 12h2M18 12h2'};
const icon=name=>{const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS(svg.namespaceURI,'path');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');path.setAttribute('d',ICONS[name]);svg.append(path);return svg;};
const decorate=(control,name,iconOnly=false)=>{const label=control.textContent;control.replaceChildren(icon(name),node('span',label,'nexus-ai-control-label'));if(iconOnly){control.classList.add('nexus-ai-icon-button');control.setAttribute('aria-label',label);control.title=label;}return control;};
const formatDate=value=>Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('ru-RU',{dateStyle:'short',timeStyle:'short'}).format(new Date(value)):'Дата неизвестна';
export function createNexusAiUi({host,request,getBootstrap,getSelectedPortfolio,getCatalog=()=>[],navigate,onPlanApplied=()=>{}}){
 if(!host)return {updateContext(){},attachPlan(){},attachInstrument(){}};
 const nav=document.querySelector('[data-view="nexus-ai"]');
 const root=node('div',undefined,'nexus-ai-workspace');root.dataset.aiWorkspace='';host.append(root);
 const sidebar=node('aside',undefined,'nexus-ai-history'),historyToggle=node('details');historyToggle.open=!matchMedia('(max-width: 800px)').matches;
 const sidebarHead=node('header',undefined,'nexus-ai-sidebar-head'),closeHistory=decorate(button('Закрыть историю',()=>showHistory(false)),'close',true);closeHistory.classList.add('nexus-ai-history-close');sidebarHead.append(node('h2','Чаты'),closeHistory);sidebar.append(sidebarHead);
 historyToggle.append(node('summary','Диалоги'));
 const newChat=decorate(button('Новый диалог',()=>startNew()),'plus',true);newChat.dataset.aiNew='';sidebarHead.insertBefore(newChat,closeHistory);
 newChat.replaceChildren(controlIcon('compose'),node('span','Новый диалог','nexus-ai-control-label'));
 const search=node('input');search.type='search';search.placeholder='Найти диалог';search.setAttribute('aria-label','Найти диалог');historyToggle.append(search);
 const historyList=node('div',undefined,'nexus-ai-conversations');historyList.setAttribute('aria-label','Сохранённые диалоги');historyToggle.append(historyList);
 const more=button('Ещё диалоги',()=>loadList(true));more.hidden=true;historyToggle.append(more);sidebar.append(historyToggle);root.append(sidebar);
 const chat=node('section',undefined,'nexus-ai-chat');chat.setAttribute('aria-label','Разговор с Nexus AI');root.append(chat);
 const heading=node('header',undefined,'nexus-ai-chat-head'),title=node('h3','Новый диалог'),deleteChat=decorate(button('Удалить диалог',()=>removeCurrent()),'trash',true);deleteChat.hidden=true;
 const headingCopy=node('div',undefined,'nexus-ai-heading-copy'),availability=node('p',undefined,'nexus-ai-availability');availability.setAttribute('role','status');headingCopy.append(title,availability);heading.append(headingCopy);chat.append(heading);
 heading.append(deleteChat);
 const historyButton=decorate(button('История диалогов',()=>showHistory(root.dataset.historyOpen!=='true')),'history',true);historyButton.dataset.aiHistoryToggle='';heading.prepend(historyButton);
 const headerNew=decorate(button('Новый диалог',()=>{startNew();showHistory(false);}), 'plus',true);headerNew.dataset.aiNewHeader='';headerNew.replaceChildren(controlIcon('compose'),node('span','Новый диалог','nexus-ai-control-label'));heading.insertBefore(headerNew,deleteChat);
 const configure=button('Подключить модель',()=>settings.open());configure.className='button nexus-ai-connect';configure.hidden=true;headingCopy.append(configure);
 const messages=node('div',undefined,'nexus-ai-messages');messages.setAttribute('aria-label','Сообщения');messages.tabIndex=0;chat.append(messages);
 const composerArea=node('footer',undefined,'nexus-ai-compose-area');chat.append(composerArea);
 const stage=node('p','', 'nexus-ai-stage');stage.setAttribute('role','status');stage.setAttribute('aria-live','polite');composerArea.append(stage);
 const context=node('div',undefined,'nexus-ai-context');context.setAttribute('aria-label','Данные для следующего вопроса');composerArea.append(context);
 const attachments=node('div',undefined,'nexus-ai-attachments');attachments.setAttribute('popover','auto');attachments.setAttribute('aria-label','Прикрепить к сообщению');composerArea.append(attachments);
 const attachmentHome=node('div',undefined,'nexus-ai-attachment-home'),attachmentHead=node('header',undefined,'ui-menu-heading'),attachmentTitle=node('span');
 const attachmentBack=button('Назад',()=>showAttachments('home'),'ui-button ui-icon-button');attachmentBack.replaceChildren(controlIcon('back'));attachmentBack.setAttribute('aria-label','Назад к вложениям');attachmentHead.append(attachmentBack,attachmentTitle);attachmentHead.hidden=true;
 const planEntry=decorate(button('Прикрепить план',()=>showAttachments('plans'),'ui-menu-item'),'plan'),instrumentEntry=button('Прикрепить инструмент',()=>showAttachments('instruments'),'ui-menu-item');instrumentEntry.prepend(controlIcon('search'));attachmentHome.append(planEntry,instrumentEntry);attachments.append(attachmentHome,attachmentHead);
 const picker=node('section',undefined,'nexus-ai-picker');picker.hidden=true;const planChoices=node('div');picker.append(planChoices);attachments.append(picker);
 const instrumentPicker=mountNexusInstruments({parent:attachments,getCatalog,getOwned:()=>getBootstrap()?.companyAnalysisInstruments||[],onSelect:value=>attachInstrument(value)});
 const form=node('form',undefined,'nexus-ai-composer'),label=node('label','Ваш вопрос','nexus-ai-input-label'),input=node('textarea');input.maxLength=12000;input.rows=1;input.id='nexusAiMessage';input.placeholder='Вопрос об инвестициях, сделке или портфеле…';label.htmlFor=input.id;form.append(label,input);
 const toolbar=node('div',undefined,'nexus-ai-toolbar'),add=decorate(button('Прикрепить',()=>togglePopover(attachments,add)),'plus',true);add.dataset.aiAdd='';toolbar.append(add);
 const skills=node('div',undefined,'nexus-ai-skills');skills.setAttribute('popover','auto');skills.setAttribute('aria-label','Возможности помощника');composerArea.append(skills);
 const skillsButton=decorate(button('Возможности',()=>togglePopover(skills,skillsButton)),'tools',true);skillsButton.dataset.aiSkills='';toolbar.append(skillsButton);
 const searchWeb=button('Поиск',()=>{webSearch=!webSearch;contextChips();input.focus();},'nexus-ai-search-control');searchWeb.replaceChildren(controlIcon('globe'),node('span','Поиск'));searchWeb.setAttribute('aria-label','Поиск в интернете');searchWeb.title='Поиск в интернете';searchWeb.setAttribute('aria-pressed','false');toolbar.insertBefore(searchWeb,skillsButton);
 for(const [caption,prompt,needsPlans]of [['Разобрать план','Разбери основания, условия входа и выхода прикреплённого плана.',true],['Сравнить планы','Сравни прикреплённые планы по основаниям, срокам и риску.',true],['Объяснить термин','Объясни простыми словами: ',false]])skills.append(button(caption,()=>{skills.hidePopover();input.value=prompt;resizeInput();if(needsPlans&&!attachedPlans.length){togglePopover(attachments,add);showAttachments('plans');}else input.focus();},'ui-menu-item'));
 const settings=mountNexusAiSettings({parent:toolbar,request:(path,options)=>read(path,options),onChanged:()=>{void ensureLoaded();input.focus();}});
 const actions=node('div',undefined,'nexus-ai-composer-actions'),send=decorate(node('button','Отправить','button primary'),'send',true);send.type='submit';send.dataset.aiSend='';
 const stop=button('Остановить',()=>cancel());stop.hidden=true;stop.dataset.aiStop='';
 const retrySend=button('Проверить отправку',()=>submit(true));retrySend.hidden=true;actions.append(stop,retrySend,send);toolbar.append(actions);form.append(toolbar);composerArea.append(form);
 const contextHelp=node('p','AI видит сообщение, выбранные вложения, ваши предпочтения и до пяти последних пар реплик.','ui-menu-status');skills.append(contextHelp);
 const menuObservers=new Map();
 function togglePopover(menu,control){if(!menuObservers.has(menu))menuObservers.set(menu,anchoredMenu({menu,anchor:control}));menuObservers.get(menu).toggle();}
 function showAttachments(view,{focus=true}={}){attachmentHome.hidden=view!=='home';attachmentHead.hidden=view==='home';attachmentTitle.textContent=view==='plans'?'Планы':'Инструменты';picker.hidden=view!=='plans';instrumentPicker.close();if(view==='plans'){void loadPlans();if(focus&&attachments.matches(':popover-open'))attachmentBack.focus();}if(view==='instruments')instrumentPicker.open();if(view==='home'&&focus&&attachments.matches(':popover-open'))planEntry.focus();}
 const closeAttachments=()=>{showAttachments('home',{focus:false});for(const menu of [attachments,skills])if(menu.matches(':popover-open'))menu.hidePopover();};
 attachments.addEventListener('toggle',event=>{if(event.newState==='closed')showAttachments('home',{focus:false});});
 input.addEventListener('pointerdown',closeAttachments);
 root.addEventListener('keydown',event=>{if(event.key==='Escape'){const attached=attachments.matches(':popover-open'),openedSkills=skills.matches(':popover-open');closeAttachments();showHistory(false);if(attached||openedSkills){event.preventDefault();(attached?add:skillsButton).focus();}}});
 const launcher=decorate(button('Nexus AI',()=>openPanel(),'button nexus-ai-launcher'),'chat');launcher.hidden=true;launcher.setAttribute('aria-label','Открыть панель Nexus AI');document.body.append(launcher);
 const panel=node('aside',undefined,'nexus-ai-panel');panel.hidden=true;panel.setAttribute('aria-label','Панель Nexus AI');document.body.append(panel);
 const panelHead=node('header',undefined,'nexus-ai-panel-head'),drag=node('span','Nexus AI');drag.className='nexus-ai-drag';drag.title='Перетащите панель в другой угол';
 const anchor=node('select');anchor.setAttribute('aria-label','Положение панели');
 for(const [value,text]of [['bottom-right','Справа внизу'],['bottom-left','Слева внизу'],['top-right','Справа вверху'],['top-left','Слева вверху']]){const option=node('option',text);option.value=value;anchor.append(option);}
 const panelHistory=decorate(button('История диалогов',()=>showHistory(root.dataset.historyOpen!=='true')),'history',true),panelNew=decorate(button('Новый диалог',()=>{startNew();showHistory(false);}), 'plus',true);
 const full=decorate(button('Развернуть',()=>navigate('nexus-ai')),'expand',true),collapse=decorate(button('Свернуть',()=>closePanel()),'close',true);
 const panelOptions=node('div',undefined,'nexus-ai-panel-options');panelOptions.setAttribute('popover','auto');panelOptions.setAttribute('aria-label','Положение виджета');panelOptions.append(node('div','Положение виджета','ui-menu-heading'));
 for(const option of anchor.options){const row=button(option.textContent,()=>{setPosition(option.value);panelOptions.hidePopover();optionsButton.focus();},'ui-menu-item nexus-ai-model-option');row.dataset.aiPosition=option.value;row.setAttribute('role','menuitemradio');row.replaceChildren(node('span',option.textContent),controlIcon('check'));panelOptions.append(row);}panel.append(panelOptions);
 const optionsButton=decorate(button('Положение виджета',()=>togglePopover(panelOptions,optionsButton)),'more',true);
 panelHead.append(drag,panelHistory,panelNew,full,collapse);panel.append(panelHead);
 let scope='',epoch=0,allowed=false,denied=false,caps=null,current=null,items=[],nextCursor=null,attachedPlans=[],attachedInstruments=[],activeRun=null,
  eventSource=null,view='overview',lastSubmission=null,loading=false,position='bottom-right',disposed=false,confirmDelete=false,searchTimer=null,webSearch=false;
 const drafts=new Map();
 const historyTools=mountNexusHistory({parent:sidebar,request:(path,options)=>read(path,options),getCurrent:()=>current?.id,isBusy:()=>!!activeRun||loading});
 function showHistory(open,{focus=true}={}){const wasOpen=root.dataset.historyOpen==='true';root.dataset.historyOpen=String(open);panelHistory.setAttribute('aria-expanded',String(open));historyButton.setAttribute('aria-expanded',String(open));if(open){historyToggle.open=true;if(focus)search.focus();}else if(focus&&wasOpen&&root.dataset.mode==='panel'&&!panel.hidden)input.focus();}
 function signature(){const b=getBootstrap()||{};return JSON.stringify([b.identity?.preferenceScope,b.identity?.role,b.savedResearch?.ownerScope,b.environment,
  b.connection?.connected,b.connection?.validatedAt,b.connection?.environment,(b.clientProduct?.portfolios||[]).map(p=>[p.id,p.preferenceKey]),getSelectedPortfolio()]);}
 function portfolios(){const rows=getBootstrap()?.clientProduct?.portfolios||[],chosen=getSelectedPortfolio();return rows.filter(p=>!chosen||chosen===p.id);}
 function valid(version){return !disposed&&allowed&&!denied&&version===epoch&&signature()===scope;}
 const read=async(path,options,version=epoch)=>{const data=await request(API+path,options);if(!valid(version))throw Object.assign(Error('Контекст изменился.'),{code:'ACCESS_REVOKED',stale:true});return data;};
 const post=(path,body,version)=>read(path,{method:'POST',body:JSON.stringify(body)},version);
 function error(value){if(value?.stale)return;stage.textContent=ERRORS[value?.code]||value?.message||'Не удалось выполнить запрос.';if([401,403].includes(value?.status)&&value.code!=='CONSENT_REQUIRED'){denied=true;epoch++;clearVisible();availability.textContent='Доступ изменился. Перезагрузите Workspace.';}controls();}
 function saveDraft(){drafts.set(current?.id||'new',{text:input.value,plans:attachedPlans,instruments:attachedInstruments,webSearch});}
 function stopEvents(){eventSource?.close();eventSource=null;}
 function clearVisible(){stopEvents();settings.reset();configure.hidden=true;instrumentPicker.reset();closeAttachments();current=null;activeRun=null;historyTools.reset();lastSubmission=null;items=[];nextCursor=null;caps=null;webSearch=false;drafts.clear();input.value='';attachedPlans=[];attachedInstruments=[];messages.replaceChildren();historyList.replaceChildren();planChoices.replaceChildren();context.replaceChildren();stage.textContent='';title.textContent='Новый диалог';title.removeAttribute('title');availability.removeAttribute('title');deleteChat.hidden=true;retrySend.hidden=true;}
 function controls(){send.disabled=!allowed||denied||!caps?.configured||!!activeRun||loading;input.disabled=!allowed||denied;newChat.disabled=headerNew.disabled=panelNew.disabled=!!activeRun||loading;stop.hidden=!activeRun;stop.disabled=loading;deleteChat.disabled=!!activeRun||loading;picker.inert=!!activeRun;instrumentPicker.update(!!activeRun||loading);historyTools.update();}
 function empty(){messages.replaceChildren();const blank=node('div',undefined,'nexus-ai-empty');blank.append(node('h3','Чем помочь?'),node('p','В приложении здесь можно задать вопрос и прикрепить торговый план. В демо модель не подключена и сообщения не отправляются.'));messages.append(blank);}
 function contextChips(){context.replaceChildren();
  searchWeb.setAttribute('aria-pressed',String(webSearch));searchWeb.disabled=!!activeRun||!caps?.tools?.includes('research.sources');
  for(const [kind,values]of [['plan',attachedPlans],['instrument',attachedInstruments]])for(const value of values){const chip=node('span',undefined,'nexus-ai-chip');
   chip.append(node('span',kind==='plan'?'План · '+(value.label||value.instrumentUid):'Инструмент · '+value.label));
   const remove=button('',()=>{if(activeRun)return;if(kind==='plan')attachedPlans=attachedPlans.filter(p=>p.id!==value.id);else attachedInstruments=attachedInstruments.filter(p=>p.id!==value.id);contextChips();},'nexus-ai-chip-remove');remove.append(icon('close'));remove.setAttribute('aria-label','Убрать '+(value.label||'объект'));remove.disabled=!!activeRun;chip.append(remove);context.append(chip);}
  context.hidden=!attachedPlans.length&&!attachedInstruments.length;
  resizeInput();
 }
 function renderHistory(){historyList.replaceChildren();for(const item of items){if(!item.portfolioIds.every(id=>portfolios().some(p=>p.id===id)))continue;
  const b=button('',()=>loadConversation(item.id),'nexus-ai-conversation');b.dataset.conversationId=item.id;b.title=item.title;b.setAttribute('aria-current',item.id===current?.id?'true':'false');b.append(node('span',item.title,'nexus-ai-conversation-title'),node('small',formatDate(item.updatedAt)));historyList.append(b);}
  if(!historyList.childElementCount)historyList.append(node('p','Пока нет диалогов','empty-copy'));more.hidden=!nextCursor;
 }
 async function loadList(append=false){const version=epoch;try{const query=new URLSearchParams({q:search.value,limit:'30'});if(append&&nextCursor)query.set('before',nextCursor);
  const data=await read('/conversations?'+query,{},version);items=append?[...items,...data.items]:data.items;nextCursor=data.nextCursor;renderHistory();}catch(e){error(e);}}
 function renderConversation(data){messages.replaceChildren();title.textContent=data.title;title.title=data.title;deleteChat.hidden=false;deleteChat.textContent='Удалить диалог';decorate(deleteChat,'trash',true);confirmDelete=false;
  if(!data.messages.length)empty();
  for(const item of data.messages){const mine=node('article',undefined,'nexus-ai-message nexus-ai-user');mine.append(node('strong','Вы'),node('p',item.message));messages.append(mine);
   const reply=node('article',undefined,'nexus-ai-message');reply.append(node('strong','Nexus AI'));
   if(item.report){renderNexusReport(reply,item);
   }else{reply.append(node('p',ERRORS[item.run.errorCode]||STAGES[item.run.status]));
    if(item.run.usage?.state==='unknown')reply.append(node('small','Модель могла обработать запрос; объём работы не подтверждён. Автоматического повтора не было.'));
    if(['failed','cancelled'].includes(item.run.status)){const retry=button('Повторить анализ',()=>{input.value=item.message;input.focus();stage.textContent='Проверьте вложения и нажмите «Отправить».';});reply.append(retry);}
   }
   for(const proposal of item.proposals||[])renderNexusProposal(reply,proposal,{stale:item.stale,
    labels:{portfolio:id=>portfolios().find(p=>p.id===id)?.label||'Выбранный счёт',instrument:id=>{const row=[...(getBootstrap()?.companyAnalysisInstruments||[]),...(getCatalog()||[])].find(p=>p.instrumentUid===id);return (row?[row.name,row.ticker].filter(Boolean).join(' · '):'Название недоступно')+' · '+id;}},
    onApply:async value=>{const version=epoch;await post('/proposals/'+value.id+'/apply',{confirmed:true,idempotencyKey:value.idempotencyKey,contextDigest:value.contextDigest,expectedVersion:value.expectedVersion},version);onPlanApplied();if(current)await loadConversation(current.id);},
    onReject:async value=>{await post('/proposals/'+value.id+'/reject',{idempotencyKey:value.idempotencyKey});if(current)await loadConversation(current.id);}});
   messages.append(reply);
  }
  const running=data.messages.findLast(item=>ACTIVE.has(item.run.status));activeRun=running?.run.id||null;
  stage.textContent=running?STAGES[running.run.status]:'';controls();contextChips();if(activeRun)watch(activeRun);requestAnimationFrame(()=>{messages.scrollTop=messages.scrollHeight;});
 }
 async function loadConversation(id){if(activeRun&&id!==current?.id){stage.textContent='Сначала дождитесь ответа или остановите запрос.';return;}saveDraft();const version=epoch;
  try{const data=await read('/conversations/'+encodeURIComponent(id),{},version);stopEvents();current=data;
   const draft=drafts.get(id);input.value=draft?.text||'';attachedPlans=draft?.plans||[];attachedInstruments=draft?.instruments||[];webSearch=draft?.webSearch===true&&caps?.tools?.includes('research.sources');renderConversation(data);renderHistory();showHistory(false);if(matchMedia('(max-width: 800px)').matches)historyToggle.open=false;
  }catch(e){error(e);}}
 function startNew(){if(activeRun)return;saveDraft();stopEvents();current=null;attachedPlans=[];attachedInstruments=[];webSearch=false;input.value='';lastSubmission=null;retrySend.hidden=true;title.textContent='Новый диалог';title.removeAttribute('title');deleteChat.hidden=true;stage.textContent='';empty();contextChips();renderHistory();controls();if(matchMedia('(max-width: 800px)').matches)historyToggle.open=false;input.focus();}
 async function loadPlans(){const version=epoch;try{const data=await request('/api/trading-plan');if(!valid(version))return;planChoices.replaceChildren();
  for(const p of data.items.filter(p=>portfolios().some(a=>a.id===p.portfolioId))){const instrument=(getBootstrap()?.companyAnalysisInstruments||[]).find(i=>i.instrumentUid===p.instrumentUid);const labelText=(instrument?.name||instrument?.ticker||'Инструмент плана')+' · '+(p.planDetails?.thesis||p.note||p.plannedFor);
   const b=button(labelText,()=>attachPlan(p),'nexus-ai-plan-option');b.dataset.aiPlanId=p.id;planChoices.append(b);}
  if(!planChoices.childElementCount)planChoices.append(node('p','В выбранном счёте ещё нет планов.'));
 }catch(e){error(e);}}
 function watch(id){stopEvents();const version=epoch;eventSource=new EventSource(API+'/runs/'+encodeURIComponent(id)+'/events');
  eventSource.addEventListener('progress',event=>{if(!valid(version)||activeRun!==id)return;let value;try{value=JSON.parse(event.data);}catch{return;}
   if(value.runId!==id||!Object.hasOwn(STAGES,value.status))return;stage.textContent=STAGES[value.status];
   if(!ACTIVE.has(value.status)){stopEvents();activeRun=null;controls();if(current)void loadConversation(current.id);void loadList();}
  });
  eventSource.onerror=()=>{if(valid(version)&&activeRun===id&&eventSource?.readyState===EventSource.CLOSED)stage.textContent='Связь с запросом прервалась. Откройте этот диалог заново, чтобы проверить результат.';};
 }
 async function submit(resume=false){if(loading||activeRun||!allowed||!caps?.configured)return;const text=input.value.trim();if(!resume&&!text){input.focus();return;}closeAttachments();
  const version=epoch;loading=true;stage.textContent='Принимаем запрос…';controls();
  try{
   if(!current){current=await post('/conversations',{title:text.slice(0,120)||'Новый диалог',portfolioIds:portfolios().map(p=>p.id)},version);title.textContent=current.title;}
   const payload=resume&&lastSubmission?.conversationId===current.id?lastSubmission.input:{message:text,mode:caps.mode||'local',webSearch,clientRequestId:crypto.randomUUID(),planRefs:attachedPlans.map(p=>({id:p.id,version:p.writeVersion})),instrumentRefs:attachedInstruments.map(p=>p.id)};
   lastSubmission={conversationId:current.id,input:payload};
   const run=await post('/conversations/'+current.id+'/runs',payload,version);retrySend.hidden=true;lastSubmission=null;input.value='';drafts.delete(current.id);
   activeRun=ACTIVE.has(run.status)?run.id:null;await loadConversation(current.id);void loadList();
  }catch(e){if(valid(version)){retrySend.hidden=!lastSubmission;error(e);}}finally{if(valid(version)){loading=false;controls();}}
 }
 form.addEventListener('submit',event=>{event.preventDefault();void submit();});
 input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();void submit();}});
 function resizeInput(){requestAnimationFrame(()=>{if(!input.isConnected)return;input.style.height='auto';input.style.height=Math.min(input.scrollHeight,136)+'px';});}
 input.addEventListener('input',resizeInput);
 async function cancel(){if(!activeRun)return;const id=activeRun,version=epoch;loading=true;controls();try{await post('/runs/'+id+'/cancel',{},version);stopEvents();activeRun=null;if(current)await loadConversation(current.id);}catch(e){error(e);}finally{if(valid(version)){loading=false;controls();}}}
 async function removeCurrent(){if(!current||activeRun)return;if(!confirmDelete){confirmDelete=true;deleteChat.textContent='Удалить окончательно';decorate(deleteChat,'trash',true);stage.textContent='Будут удалены сообщения и снимки этого диалога. Принятые правки планов останутся. Нажмите удаление ещё раз для подтверждения.';return;}
  const id=current.id,version=epoch;try{await read('/conversations/'+id,{method:'DELETE',body:'{}'},version);drafts.delete(id);current=null;startNew();await loadList();}catch(e){error(e);}}
 function setPosition(value){if(!['bottom-right','bottom-left','top-right','top-left'].includes(value))return;position=value;panel.dataset.anchor=value;launcher.dataset.anchor=value;anchor.value=value;
  for(const row of panelOptions.querySelectorAll('[data-ai-position]'))row.setAttribute('aria-checked',String(row.dataset.aiPosition===value));
  const key=getBootstrap()?.identity?.preferenceScope;if(key)try{localStorage.setItem('invest.nexus-ai.anchor.'+key,value);}catch{}}
 anchor.addEventListener('change',()=>{setPosition(anchor.value);panelOptions.hidePopover();});
 // The launcher and the panel header move with the pointer and snap to the
 // nearest corner on release. Arrow keys on either do the same without a mouse.
 function snapTo(target,corner){const before=target.getBoundingClientRect();target.style.translate='';setPosition(corner);const after=target.getBoundingClientRect();
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;target.style.translate=(before.left-after.left)+'px '+(before.top-after.top)+'px';target.getBoundingClientRect();
  target.classList.add('nexus-ai-snapping');target.style.translate='';target.addEventListener('transitionend',()=>target.classList.remove('nexus-ai-snapping'),{once:true});}
 function cornerAt(target){const box=target.getBoundingClientRect(),x=box.left+box.width/2,y=box.top+box.height/2;return (y<innerHeight/2?'top':'bottom')+'-'+(x<innerWidth/2?'left':'right');}
 function draggable(handle,target,skip=null,keys=handle){let start=null;
  handle.addEventListener('pointerdown',event=>{if(event.button!==0||skip&&event.target.closest(skip))return;start={x:event.clientX,y:event.clientY,id:event.pointerId,moved:false};handle.setPointerCapture(event.pointerId);});
  handle.addEventListener('pointermove',event=>{if(!start||event.pointerId!==start.id)return;const dx=event.clientX-start.x,dy=event.clientY-start.y;
   if(!start.moved&&Math.hypot(dx,dy)<6)return;if(!start.moved){start.moved=true;target.classList.add('nexus-ai-dragging');}target.style.translate=dx+'px '+dy+'px';});
  const finish=event=>{if(!start||event.pointerId!==start.id)return;const moved=start.moved;start=null;if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);if(!moved)return;
   target.classList.remove('nexus-ai-dragging');snapTo(target,cornerAt(target));
   // A drag ends with a click on the same element; it must not also open or close the panel.
   handle.addEventListener('click',stop=>{stop.preventDefault();stop.stopImmediatePropagation();},{capture:true,once:true});};
  handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',event=>{if(start?.id===event.pointerId){start=null;target.classList.remove('nexus-ai-dragging');target.style.translate='';}});
  keys.addEventListener('keydown',event=>{const move={ArrowLeft:['left',null],ArrowRight:['right',null],ArrowUp:[null,'top'],ArrowDown:[null,'bottom']}[event.key];if(!move||event.target!==keys)return;
   event.preventDefault();const [x,y]=position.split('-');snapTo(target,(move[1]||x)+'-'+(move[0]||y));});}
 drag.tabIndex=0;drag.setAttribute('role','button');drag.setAttribute('aria-label','Переместить панель Nexus AI. Стрелки выбирают угол экрана');drag.title='Перетащите панель в любой угол';
 launcher.title='Nexus AI. Перетащите кнопку в любой угол экрана';
 draggable(panelHead,panel,'button,select,input',drag);draggable(launcher,launcher);
 // Corners sit inside the workspace: below the top bar and right of a docked
 // rail, so a launcher in a top or left corner never covers navigation.
 function measureSafeArea(){const bar=document.querySelector('.topbar'),rail=document.querySelector('.rail');
  const top=bar&&bar.getClientRects().length?Math.max(0,Math.round(bar.getBoundingClientRect().bottom)):0;
  const left=rail&&rail.getClientRects().length&&getComputedStyle(rail).position!=='fixed'?Math.max(0,Math.round(rail.getBoundingClientRect().right)):0;
  document.body.style.setProperty('--nexus-ai-safe-top',top+'px');document.body.style.setProperty('--nexus-ai-safe-left',left+'px');}
 const safeArea=new ResizeObserver(measureSafeArea);for(const element of [document.querySelector('.topbar'),document.querySelector('.rail')])if(element)safeArea.observe(element);
 addEventListener('resize',measureSafeArea);measureSafeArea();
 function closePanel(){settings.close();closeAttachments();if(panelOptions.matches(':popover-open'))panelOptions.hidePopover();panel.hidden=true;launcher.hidden=!allowed||view==='nexus-ai';if(launcher.hidden===false)launcher.focus();}
 function moveView(){settings.close();closeAttachments();showHistory(false,{focus:false});if(view==='nexus-ai'){panel.hidden=true;host.append(root);launcher.hidden=true;root.dataset.mode='full';}
  else{panel.append(root);root.dataset.mode='panel';launcher.hidden=!allowed;}}
 function openPanel(){if(!allowed)return;if(matchMedia('(max-width: 600px)').matches){navigate('nexus-ai');return;}
  if(view==='nexus-ai'){input.focus();return;}panel.hidden=false;launcher.hidden=true;panel.append(root);root.dataset.mode='panel';input.focus();void ensureLoaded();}
 async function ensureLoaded(){if(!allowed||denied)return;const version=epoch;try{caps=await read('/capabilities',{},version);
  availability.textContent=caps.configured?(caps.mode==='personal-cloud'?'GPT-аккаунт · ':'Локальная модель · ')+caps.model:'Предпросмотр Nexus AI. Модель и отправка сообщений доступны в приложении.';availability.title=availability.textContent;availability.hidden=!!caps.configured;configure.hidden=!!caps.configured;settings.setLabel(caps.configured?caps.model:'Выбрать модель');if(!caps.tools?.includes('research.sources'))webSearch=false;contextChips();controls();await loadList();await loadPlans();
 }catch(e){error(e);}}
 function onView(event){view=event.detail;moveView();if(view==='nexus-ai')void ensureLoaded();}
 document.addEventListener('invest:view-changed',onView);
 const compactViewport=matchMedia('(max-width: 600px)');
 const onResize=()=>{if(compactViewport.matches&&allowed&&!panel.hidden)navigate('nexus-ai');};
 compactViewport.addEventListener('change',onResize);
 const historyViewport=matchMedia('(max-width: 800px)'),onHistoryResize=()=>{historyToggle.open=!historyViewport.matches;};historyViewport.addEventListener('change',onHistoryResize);
 search.addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>loadList(),220);});
 function updateContext(){const next=signature(),b=getBootstrap(),wasAllowed=allowed;allowed=b?.preview?.websiteDemo===true;
  if(next!==scope||wasAllowed&&!allowed){scope=next;epoch++;denied=false;loading=false;clearVisible();empty();contextChips();const key=b?.identity?.preferenceScope;let saved;try{saved=key&&localStorage.getItem('invest.nexus-ai.anchor.'+key);}catch{}setPosition(saved||'bottom-right');}
  if(nav){nav.disabled=!allowed;nav.hidden=!allowed;}if(!allowed){panel.hidden=true;launcher.hidden=true;stopEvents();}else if(view!=='nexus-ai'&&panel.hidden)launcher.hidden=false;
  const companyButton=document.querySelector('#discussCompanyAi');if(companyButton){companyButton.hidden=!allowed;companyButton.disabled=!allowed||!document.querySelector('#aiInstrument')?.value;}
  controls();if(view==='nexus-ai'||!panel.hidden)void ensureLoaded();
 }
 function attachPlan(plan){updateContext();if(!allowed)return;if(activeRun){stage.textContent='Сначала дождитесь ответа или остановите запрос.';openPanel();return;}
  if(!portfolios().some(p=>p.id===plan.portfolioId)){stage.textContent='Выберите счёт этого плана перед разбором.';openPanel();return;}
  if(!attachedPlans.some(p=>p.id===plan.id)&&attachedPlans.length>=5||new Set([...attachedPlans.map(p=>p.instrumentUid),...attachedInstruments.map(p=>p.id),plan.instrumentUid]).size>5){stage.textContent='Можно прикрепить до пяти планов и до пяти разных инструментов.';return;}
  attachedPlans=[...attachedPlans.filter(p=>p.id!==plan.id),{id:plan.id,writeVersion:plan.writeVersion,instrumentUid:plan.instrumentUid,label:plan.planDetails?.thesis?.slice(0,70)||plan.note?.slice(0,70)||plan.instrumentUid}];
  contextChips();closeAttachments();openPanel();if(!input.value)input.value=attachedPlans.length>1?'Сравни эти идеи по основаниям, горизонту и риску.':'Разбери основания, условия входа и выхода этого плана.';
 }
 function attachInstrument(value){updateContext();if(!allowed||activeRun)return;if(new Set([...attachedPlans.map(p=>p.instrumentUid),...attachedInstruments.map(p=>p.id),value.id]).size>5){stage.textContent='Можно прикрепить до пяти разных инструментов.';return;}
  attachedInstruments=[...attachedInstruments.filter(p=>p.id!==value.id),value];contextChips();closeAttachments();openPanel();if(!input.value)input.value='Разбери сохранённые факты инструмента, риски и недостающие данные.';
 }
 const onSelection=()=>updateContext();document.querySelector('#statisticsAccount')?.addEventListener('change',onSelection);
 empty();setPosition(position);updateContext();
 return {updateContext,attachPlan,attachInstrument,openPanel,getAccessToken:()=>epoch,rejectAccess(token){if(token!==epoch)return;denied=true;epoch++;clearVisible();availability.textContent='Доступ изменился. Перезагрузите Workspace.';controls();},dispose(){disposed=true;epoch++;settings.dispose();for(const menu of menuObservers.values())menu.dispose();stopEvents();clearTimeout(searchTimer);document.removeEventListener('invest:view-changed',onView);compactViewport.removeEventListener('change',onResize);historyViewport.removeEventListener('change',onHistoryResize);document.querySelector('#statisticsAccount')?.removeEventListener('change',onSelection);panel.remove();launcher.remove();}};
}
