import {parsePlanArchive,serializePlanArchive,PLAN_ARCHIVE_LIMITS} from './plan-archive.js';
import { appendPlanRiskScenario } from './plan-risk-scenario-ui.js';
import { planPriceUnitLabel } from './plan-price-basis.js';
const actions={watch:'Наблюдение',buy:'Покупка',sell:'Продажа'},statuses={draft:'Черновик',watching:'Наблюдаю',completed:'Завершено пользователем',cancelled:'Отменено'};
const day=value=>value.split('-').reverse().join('.');
const time=value=>new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium',timeStyle:'medium'}).format(new Date(value));
const safeError=error=>error?.code==='PLAN_ARCHIVE_VERSION'?'Эта версия архива не поддерживается. Исходный файл не изменён.':error?.code==='PLAN_ARCHIVE_LIMIT'?'Архив превышает поддерживаемый объём. Часть данных не открывается вместо полного файла.':'Не удалось проверить архив. Повторите чтение или выберите исправный файл.';
export function createPlanArchiveUi({host,request,getAccess}){
 if(!host)return {update(){},dispose(){}};
 const node=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
 const button=(text,key)=>{const n=node('button',text,'button secondary');n.type='button';n.dataset[key]='';return n;};
 host.className='plan-archive';
 const details=node('details'),summary=node('summary','Архив планов'),intro=node('p','Скачайте все доступные сохранённые идеи и их версии. Удалённые идеи, вытесненные версии, котировки, исполнения, новости и обзоры портфеля в этот файл не входят.');
 const download=button('Скачать архив JSON','planArchiveExport'),fileLabel=node('label','Открыть архив с этого устройства'),file=node('input');file.type='file';file.accept='application/json,.json';file.dataset.planArchiveFile='';fileLabel.append(file);
 const status=node('p');status.dataset.planArchiveStatus='';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const viewer=node('section');viewer.dataset.planArchiveViewer='';viewer.hidden=true;
 details.append(summary,intro,download,fileLabel,status,viewer);host.append(details);
 let lastAccess=null,rejectedAccess=null,epoch=0,operation=0,busy='',archive=null,notice='',disposed=false,page=0,query='',controller;
 const urls=new Map();
 function access(){try{return getAccess()||{};}catch{return {};}}
 const available=()=>{const a=access();return !disposed&&!rejectedAccess&&a.allowed===true&&a.ready===true&&typeof a.ownerScope==='string'&&/^[a-f0-9]{32}$/u.test(a.ownerScope);};
 function clear(){archive=null;file.value='';page=0;query='';viewer.replaceChildren();viewer.hidden=true;}
 function invalidate(){++epoch;++operation;controller?.abort();controller=null;busy='';clear();for(const[url,timer]of urls){clearTimeout(timer);URL.revokeObjectURL(url);}urls.clear();}
 const ticket=()=>({epoch,operation:++operation,...access()});
 const valid=t=>{const a=access();return !disposed&&available()&&t.epoch===epoch&&t.operation===operation&&t.signature===a.signature&&t.generation===a.generation&&t.ownerScope===a.ownerScope;};
 function paint(){
  const a=access();download.disabled=file.disabled=!available()||Boolean(busy);host.setAttribute('aria-busy',String(Boolean(busy)));
  status.textContent=busy==='export'?'Читаем сохранённые планы и версии…':busy==='file'?'Проверяем выбранный файл…':notice||(!a.allowed?'Архив доступен в локальном приложении при доступе к журналу идей.':!a.ready?'Дождитесь подтверждённого списка идей.':'');
 }
 function update(){
  const a=access();if(lastAccess&&(a.signature!==lastAccess.signature||a.ownerScope!==lastAccess.ownerScope||a.allowed!==lastAccess.allowed)){invalidate();rejectedAccess=null;notice='';details.open=false;}
  if(rejectedAccess&&a.ready&&a.generation!==rejectedAccess.generation){rejectedAccess=null;notice='';}
  lastAccess=a;paint();
 }
 function instrument(uid){return archive.instruments.find(i=>i.instrumentUid===uid)?.label||'Название инструмента не сохранено';}
 function showValue(parent,value){
  const fields=node('dl');for(const[label,text]of [['Инструмент при экспорте',instrument(value.instrumentUid)],['Счёт в архиве',archive.accounts.find(a=>a.portfolioId===value.portfolioId)?.label||'Название отсутствует'],['Пересмотреть',day(value.plannedFor)],['Намерение',actions[value.action]],['Отметка пользователя',statuses[value.status]]]){const row=node('div');row.append(node('dt',label),node('dd',text));fields.append(row);}parent.append(fields);
  const prices=[['Вход',value.entryPrice],['Стоп',value.stopPrice],['Цель',value.targetPrice]].filter(([,v])=>v!==null);
  if(prices.length){const unit=planPriceUnitLabel(value.priceBasis);parent.append(node('p',unit?'Единицы цен указаны владельцем в файле.':'Единицы уровней в истории не сохранены.'));for(const[label,v]of prices)parent.append(node('p',label+': '+v.replace('.',',')+(unit?' '+unit:'')));}
  appendPlanRiskScenario(parent,value,{fromFile:true});
  parent.append(node('p',value.note||'Заметка отсутствует.','plan-archive-note'));
 }
 function showHistory(parent,history){
  const coverage=history.coverage;
  parent.append(node('p',`Доступных версий в файле: ${history.items.length}. Сохраняется до ${coverage.retainedLimit} последних версий.`));
  if(coverage.earlierVersionsDropped)parent.append(node('p','Более ранние версии вытеснены из локального хранилища и отсутствуют в файле.'));
  if(coverage.someAccountVersionsUnavailable)parent.append(node('p','Часть версий относится к счетам, недоступным при экспорте.'));
  if(coverage.origin!=='from-local-create')parent.append(node('p','История до первой доступной записи неизвестна.'));
  if(!history.items.length)return;
  const rows=[...history.items].reverse(),count=node('p'),list=node('div'),more=button('Показать предыдущие версии из файла','planArchiveMore');let shown=0;parent.append(count,list,more);
  function next(focus=false){let first;for(const row of rows.slice(shown,shown+5)){const d=node('details'),s=node('summary',`Версия ${row.sequence} · дата из файла: ${time(row.recordedAt)}`);d.append(s);first ||= s;
    if(row.clockRegressed)d.append(node('p','В этой записи отмечен перевод часов назад. Порядок задаётся номером версии.'));
    if(row.kind==='legacy-observation')d.append(node('p','Содержание впервые зафиксировано в этот момент; это не доказанная дата создания идеи.'));
    showValue(d,row.value);list.append(d);}
   shown=Math.min(shown+5,rows.length);count.textContent=`Показано версий: ${shown} из ${rows.length}.`;more.hidden=shown===rows.length;if(focus){first?.focus();first?.scrollIntoView({block:'nearest'});}
  }more.addEventListener('click',()=>next(true));next();
 }
 function renderViewer(){
  viewer.replaceChildren();viewer.hidden=!archive;if(!archive)return;
  const heading=node('h4','Архив открыт только для чтения');viewer.append(heading,node('p','Это выбранный файл. Его данные и даты не подтверждены этим устройством. Открытие не добавляет идеи, не меняет журнал и не подтверждает исполнение сделок.'));
  viewer.append(node('p',`Дата экспорта в файле: ${time(archive.exportedAt)}. Идей: ${archive.plans.length}. Версий: ${archive.plans.reduce((n,p)=>n+p.history.items.length,0)}.`),node('p','Названия инструментов сохранены при экспорте. Обозначения счетов относятся только к этому файлу.'));
  const searchLabel=node('label','Найти идею в архиве'),search=node('input');search.type='search';search.maxLength=120;search.value=query;search.dataset.planArchiveSearch='';searchLabel.append(search);viewer.append(searchLabel,node('p','По названию инструмента, текущей заметке или дате пересмотра.'));
  const region=node('div'),counter=node('p'),navigation=node('div',undefined,'plan-archive-actions'),previous=button('Предыдущие идеи','planArchivePrevious'),next=button('Следующие идеи','planArchiveNext'),close=button('Закрыть файл','planArchiveClose');counter.setAttribute('role','status');navigation.append(previous,next,close);viewer.append(counter,region,navigation);
  function renderPage(focus=false){region.replaceChildren();const filtered=archive.plans.filter(p=>[instrument(p.current.instrumentUid),p.current.note,p.current.plannedFor,day(p.current.plannedFor)].join(' ').toLocaleLowerCase('ru-RU').includes(query.toLocaleLowerCase('ru-RU')));
   page=Math.max(0,Math.min(page,Math.ceil(filtered.length/8)-1));const slice=filtered.slice(page*8,page*8+8);let first;
   for(const p of slice){const d=node('details'),s=node('summary',`${instrument(p.current.instrumentUid)} · ${actions[p.current.action]} · ${day(p.current.plannedFor)}`);first ||= s;d.dataset.planArchiveIdea='';d.append(s);showValue(d,p.current);
    const history=button('Показать версии из файла','planArchiveHistory'),historyRegion=node('div');historyRegion.hidden=true;history.setAttribute('aria-expanded','false');let loaded=false;
    history.addEventListener('click',()=>{historyRegion.hidden=!historyRegion.hidden;history.setAttribute('aria-expanded',String(!historyRegion.hidden));if(!loaded){showHistory(historyRegion,p.history);loaded=true;}});d.append(history,historyRegion);region.append(d);
   }
   counter.textContent=filtered.length?`Идеи ${page*8+1}–${page*8+slice.length} из ${filtered.length}.`:archive.plans.length?'По этому запросу идеи не найдены.':'В этом архиве нет сохранённых идей.';previous.disabled=page===0;next.disabled=(page+1)*8>=filtered.length;
   if(focus){first?.focus();first?.scrollIntoView({block:'nearest'});}
  }
  search.addEventListener('input',()=>{query=search.value;page=0;renderPage();});previous.addEventListener('click',()=>{page--;renderPage(true);});next.addEventListener('click',()=>{page++;renderPage(true);});close.addEventListener('click',closeFile);renderPage();
 }
 async function exportFile(){
  if(!available()||busy)return;const t=ticket();busy='export';notice='';controller=new AbortController();paint();if(document.activeElement===document.body||document.activeElement===download)summary.focus({preventScroll:true});
  try{const response=await request('/api/trading-plan/archive',{signal:controller.signal});if(!valid(t))return;
   if(response?.ownerScope!==t.ownerScope)throw {code:'PLAN_ARCHIVE_ACCESS_CHANGED',status:409};const output=serializePlanArchive(response.archive);if(!valid(t))return;
   const url=URL.createObjectURL(new Blob([output.text],{type:'application/json;charset=utf-8'})),link=node('a');link.href=url;link.download=output.filename;link.hidden=true;host.append(link);link.click();link.remove();urls.set(url,setTimeout(()=>{URL.revokeObjectURL(url);urls.delete(url);},1000));notice=`Файл передан для скачивания. Идей: ${response.archive.plans.length}.`;
  }catch(error){if(t.epoch===epoch&&t.operation===operation&&([401,403].includes(error?.status)||/ACCESS|CONTEXT|SESSION|FORBIDDEN|ROLE|CAPABILITY/u.test(error?.code||''))){invalidate();rejectedAccess=access();notice='Доступ или счёт изменился. Архив закрыт; перечитайте журнал.';paint();}else if(valid(t))notice=safeError(error);}
  finally{if(t.epoch===epoch&&t.operation===operation){if(!valid(t))notice='Контекст журнала изменился. Повторите действие.';busy='';controller=null;paint();if(details.open&&(document.activeElement===document.body||document.activeElement===summary))download.focus();}}
 }
 async function openFile(){
  if(!available()||busy)return;const selected=file.files?.[0];if(!selected)return;const t=ticket();busy='file';notice='';archive=null;viewer.replaceChildren();viewer.hidden=true;paint();if(document.activeElement===document.body||document.activeElement===file)summary.focus({preventScroll:true});
  try{if(selected.size>PLAN_ARCHIVE_LIMITS.bytes)throw {code:'PLAN_ARCHIVE_LIMIT'};const text=await selected.text();if(!valid(t))return;const parsed=parsePlanArchive(text);if(!valid(t))return;archive=parsed;page=0;query='';notice='Файл проверен по формату. Его содержимое не является подтверждёнными данными приложения.';renderViewer();}
  catch(error){if(valid(t)){clear();notice=safeError(error);}}
  finally{if(t.epoch===epoch&&t.operation===operation){if(!valid(t)){clear();notice='Контекст журнала изменился. Выберите файл заново.';}busy='';paint();if(details.open&&(document.activeElement===document.body||document.activeElement===summary))file.focus();}}
 }
 function closeFile(){invalidate();notice='Файл закрыт. Журнал идей не изменён.';paint();file.focus();}
 function keydown(event){if(event.key==='Escape'&&(archive||busy)){event.preventDefault();event.stopPropagation();closeFile();}}
 download.addEventListener('click',exportFile);file.addEventListener('change',openFile);host.addEventListener('keydown',keydown);update();
 return {update,dispose(){disposed=true;invalidate();download.removeEventListener('click',exportFile);file.removeEventListener('change',openFile);host.removeEventListener('keydown',keydown);}};
}
