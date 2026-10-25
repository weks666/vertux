import { ALERT_TRANSFER_LIMITS, decodePriceRulesFile, encodePriceRulesFile, priceRulesRestorePlan, priceRuleTransferFields } from './price-rules-transfer-model.js';
const PAGE = 25;
const stateText = r => r.state === 'legacy' ? r.enabled ? 'Старое правило · приём включён' : 'Старое правило · выключено'
  : ({ active:'Приём включён', paused:'На паузе', corrupt:'Повреждено', unsupported:'Формат не поддерживается' })[r.state];
const title = r => r.config ? `${r.config.subject.exchange}:${r.config.subject.symbol} · ${r.config.targetPrice}` : 'Условие недоступно';
const fields = r => [...priceRuleTransferFields(Object.fromEntries(['key','state','enabled','ruleVersion','createdAt','updatedAt','config'].map(k=>[k,r[k]]))),
  {key:'state',label:'Приём',value:stateText(r)}, {key:'ruleVersion',label:'Версия',value:String(r.ruleVersion??'Неизвестна')},
  {key:'createdAt',label:'Создано',value:r.createdAt},{key:'updatedAt',label:'Изменено',value:r.updatedAt}];

export function createPriceRulesTransferUi({ host, getContext, read, compare, apply }) {
  const make=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
  host.classList.add('native-lists-transfer','price-rules-transfer');host.dataset.rulesTransfer='';
  host.innerHTML='<details data-rules-main><summary><strong>Перенос ценовых правил</strong><span>Текущие условия · JSON</span></summary><div class="native-lists-body"><p>Скачайте текущие условия или откройте файл для выборочного восстановления. История версий, срабатываний и доставки в этот файл не входит.</p><p data-rules-access class="native-lists-caption"></p><div class="native-lists-actions"><button type="button" data-rules-read>Перечитать правила</button><button type="button" data-rules-export>Скачать текущие правила</button></div><label class="native-lists-file">Открыть файл ценовых правил JSON, до 6 МиБ<input type="file" accept=".json,application/json" data-rules-file></label><p data-rules-status role="status" aria-live="polite" tabindex="-1"></p><section data-rules-selection hidden><h3 tabindex="-1" data-rules-file-title>Правила из файла</h3><p>Даты и происхождение файла не подтверждены. Выберите создание копии или конкретное правило для замены; совпадение тикера ничего не выбирает автоматически.</p><p data-rules-date></p><p data-rules-page></p><div data-rules-rows></div><div class="native-lists-actions"><button type="button" data-rules-prev>Предыдущие из файла</button><button type="button" data-rules-next>Следующие из файла</button></div><button type="button" data-rules-preview>Сравнить выбранные правила</button></section><section data-rules-comparison hidden><h3 tabindex="-1" data-rules-comparison-title>Проверка восстановления</h3><p data-rules-counts></p><p>Выбранные правила сохранятся на паузе, с выключенной доставкой в Telegram. Исходные даты показаны для сверки; даты сохранённых изменений установит сервис. Уже выполненная отправка не отменяется. Включение приёма и настройка TradingView — отдельные действия.</p><div data-rules-comparison-rows></div><p data-rules-comparison-page></p><div class="native-lists-actions"><button type="button" data-rules-comparison-prev>Предыдущие изменения</button><button type="button" data-rules-comparison-next>Следующие изменения</button></div><label class="native-lists-confirm"><input type="checkbox" data-rules-confirm>Я проверил назначения и значения. Сохранить выбранные правила на паузе.</label><button type="button" data-rules-apply>Сохранить выбранные на паузе</button></section><button type="button" data-rules-cancel hidden>Отменить перенос</button></div></details>';
  const $=name=>host.querySelector(`[data-rules-${name}]`),main=$('main'),input=$('file');
  let epoch=0,busy=false,writing=false,disposed=false,snapshot=null,file=null,choices=[],preview=null,page=0,comparisonPage=0;
  let context=getContext(),denied=false;const urls=new Map();
  const visible=()=>!disposed&&main.open&&host.getClientRects().length>0;
  const native=()=>getContext().canNative&&!getContext().dirty&&!getContext().pending&&!denied;
  const say=(text,focus=false)=>{$('status').textContent=text;if(focus&&visible())$('status').focus();};
  const label=(n,p)=>n?`${p*PAGE+1}–${Math.min(n,(p+1)*PAGE)} из ${n}`:'Записей нет';
  function controls(){
    const c=getContext(),ready=native();host.setAttribute('aria-busy',String(busy));
    $('read').disabled=busy||!ready;$('export').disabled=busy||!ready;
    input.disabled=busy||denied||!c.canOpen||c.dirty||Boolean(c.pending);
    $('preview').hidden=!c.canNative;$('preview').disabled=busy||!ready||!snapshot||!choices.some(v=>v.destination!==null);
    $('confirm').disabled=busy||!ready||!preview||preview.counts.add+preview.counts.replace+preview.counts.pause===0;
    $('apply').disabled=$('confirm').disabled||!$('confirm').checked;$('cancel').hidden=!busy&&!file;
    host.querySelectorAll('[data-rules-choice]').forEach(el=>el.disabled=busy||!ready||!el.dataset.restorable);
    $('access').textContent=c.dirty?'Завершите или отмените редактирование правила перед переносом.':c.canNative&&!denied?'Доступ к текущим правилам подтверждён. Выбор файла сам по себе ничего не меняет.':'Доступен просмотр файла. Для скачивания и восстановления нужен сервис с поддержкой переноса и подтверждённый доступ владельца.';
    for(const [prefix,n,p] of [['',file?.rules.length??0,page],['comparison-',preview?.plan.changes.filter(c=>c.effect!=='skip').length??0,comparisonPage]]){
      $(prefix+'prev').disabled=busy||p===0;$(prefix+'next').disabled=busy||(p+1)*PAGE>=n;
    }
  }
  function reset({ clearSnapshot=false }={}){
    epoch++;busy=false;writing=false;file=null;choices=[];preview=null;page=0;comparisonPage=0;input.value='';
    if(clearSnapshot)snapshot=null;$('confirm').checked=false;$('selection').hidden=true;$('comparison').hidden=true;
    $('rows').replaceChildren();$('comparison-rows').replaceChildren();controls();
  }
  const current=job=>job.epoch===epoch&&job.key===getContext().key&&job.editor===getContext().editor&&visible();
  function begin(){busy=true;controls();return{epoch,key:getContext().key,editor:getContext().editor};}
  function finish(job){if(current(job)){busy=false;writing=false;context=getContext();controls();}}
  function accept(result){if(!result?.ok||!result.authority?.isCurrent())throw Object.assign(new Error('not confirmed'),{code:result?.code});return result.data;}
  async function readSnapshot(job){const result=await read();return current(job)?accept(result):null;}
  function failed(job,text){if(!current(job))return;reset({clearSnapshot:true});say(text,true);}
  function card(row){const details=make('details'),summary=make('summary');summary.append(make('strong',title(row)),make('span',`${stateText(row)} · версия ${row.ruleVersion??'неизвестна'}`));details.append(summary);return details;}
  function values(row){const dl=make('dl');dl.className='price-rules-values';for(const value of fields(row)){const pair=make('div');pair.append(make('dt',value.label),make('dd',value.value));dl.append(pair);}return dl;}
  function renderFile(){
    $('selection').hidden=!file;$('rows').replaceChildren();if(!file)return;
    $('page').textContent=label(file.rules.length,page);$('date').textContent=`Дата из файла: ${file.exportedAt}. Всего правил: ${file.rules.length}.`;
    for(const row of file.rules.slice(page*PAGE,(page+1)*PAGE)){
      const node=card(row);node.dataset.rulesEntry=row.key;node.append(values(row));
      if(snapshot){const choice=make('label','Назначение для '+title(row)),select=make('select');select.dataset.rulesChoice=row.key;if(row.config)select.dataset.restorable='true';
        const option=(value,text)=>{const o=make('option',text);o.value=value;select.append(o);};option('','Пропустить');
        if(row.config){option('new','Создать новое правило на паузе');for(const [index,destination] of snapshot.rows.entries())if(['active','paused'].includes(destination.state))option(destination.id,`Правило ${index+1} · ${title(destination)} · v${destination.ruleVersion} · ${stateText(destination)}${destination.config.note?' · '+destination.config.note.slice(0,60):''}`);}
        select.value=choices.find(c=>c.key===row.key).destination??'';select.addEventListener('change',()=>{choices.find(c=>c.key===row.key).destination=select.value||null;preview=null;$('comparison').hidden=true;$('confirm').checked=false;controls();});choice.append(select);node.append(choice);
      }$('rows').append(node);
    }controls();
  }
  function renderComparison(){
    $('comparison').hidden=!preview;$('comparison-rows').replaceChildren();if(!preview)return;
    const p=preview.counts;$('counts').textContent=`Новых: ${p.add}. Замена: ${p.replace}. Только пауза: ${p.pause}. Без изменений: ${p.unchanged}. Пропуск: ${p.skip}.`;
    const selected=preview.plan.changes.filter(c=>c.effect!=='skip');$('comparison-page').textContent=label(selected.length,comparisonPage);
    for(const change of selected.slice(comparisonPage*PAGE,(comparisonPage+1)*PAGE)){
      const node=card(change.source);node.dataset.rulesCompared=change.source.key;
      node.append(make('p',change.before?`Назначение: ${title(change.before)} · v${change.before.ruleVersion}. Идентификатор и история сохраняются.`:'Назначение: новое независимое правило.'));
      const after={...change.source,state:'paused',enabled:false,config:change.after,ruleVersion:change.effect==='add'?1:change.before.ruleVersion+Number(change.effect==='replace')};
      const before=change.before?new Map(fields(change.before).map(f=>[f.key,f.value])):new Map(),next=new Map(fields(after).map(f=>[f.key,f.value]));
      const dl=make('dl');dl.className='price-rules-comparison';
      for(const value of fields(change.source)){
        const pair=make('div');pair.append(make('dt',value.label));
        const final=value.key==='createdAt'?(change.before?.createdAt??'Дата создания нового правила'):value.key==='updatedAt'?(change.effect==='unchanged'?change.before.updatedAt:'Дата сохранения изменения'):next.get(value.key);
        for(const [heading,text] of [['Файл',value.value],['Сейчас',before.get(value.key)??'Нет назначения'],['После',final]]){const dd=make('dd');dd.append(make('span',heading),make('strong',text));pair.append(dd);}dl.append(pair);
      }node.append(dl);$('comparison-rows').append(node);
    }controls();
  }
  async function reread(download=false){
    if(!native()||busy||!visible())return;reset({clearSnapshot:true});const job=begin();say('Читаем текущие правила…');
    try{const value=await readSnapshot(job);if(!value)return;snapshot=value;say(`Текущие правила прочитаны: ${value.rows.length}.`);
      if(download){const url=URL.createObjectURL(new Blob([encodePriceRulesFile(value)],{type:'application/json'})),link=make('a');link.href=url;link.download='vertux-price-rules.json';link.dataset.rulesDownload='';link.hidden=true;host.append(link);link.click();link.remove();const timer=setTimeout(()=>{URL.revokeObjectURL(url);urls.delete(url);},30000);urls.set(url,timer);}
    }catch{failed(job,'Текущие правила не подтверждены. Перечитайте список уведомлений и повторите чтение.');}finally{finish(job);}
  }
  $('read').addEventListener('click',()=>void reread());$('export').addEventListener('click',()=>void reread(true));
  input.addEventListener('change',async()=>{
    const selected=input.files?.[0];if(!selected||input.disabled||!visible())return;reset({clearSnapshot:true});const job=begin();say('Читаем файл ценовых правил…');
    try{if(selected.size>ALERT_TRANSFER_LIMITS.fileBytes)throw Error('limit');const text=await selected.text();if(!current(job))return;
      const parsed=decodePriceRulesFile(text);let currentRules=null;if(getContext().canNative){currentRules=await readSnapshot(job);if(!currentRules)return;}
      file=parsed;snapshot=currentRules;choices=file.rules.map(r=>({key:r.key,destination:null}));renderFile();say(currentRules?'Выберите назначения. По умолчанию все записи пропущены.':'Файл открыт только для просмотра. Данные не изменены.');$('file-title').focus();
    }catch{failed(job,'Не удалось открыть целый файл. Нужен файл текущих ценовых правил версии 1 до 6 МиБ.');}finally{finish(job);}
  });
  $('preview').addEventListener('click',async()=>{
    if($('preview').disabled)return;preview=null;$('confirm').checked=false;$('comparison').hidden=true;const job=begin();
    try{priceRulesRestorePlan(snapshot,file,choices);const result=await compare(snapshot,file,choices);if(!current(job))return;preview=accept(result);comparisonPage=0;renderComparison();say('Сравнение готово. Проверьте назначения и все значения.');$('comparison-title').focus();}
    catch(error){failed(job,error?.code==='ALERT_TRANSFER_INPUT'?'Назначение повторяется или выбор некорректен. Откройте файл снова и выберите каждое текущее правило не более одного раза.':'Сравнение не подтверждено. Перечитайте правила и откройте файл снова.');}finally{finish(job);}
  });
  $('confirm').addEventListener('change',controls);
  $('apply').addEventListener('click',async()=>{
    if($('apply').disabled)return;const before=snapshot,document=file,selected=choices.map(c=>({...c})),previewProof=preview.previewToken,job=begin();writing=true;say('Сохраняем выбранные условия на паузе…');
    try{const result=await apply(before,document,selected,previewProof);if(!current(job))return;const data=accept(result);reset();snapshot=data.snapshot;say('Выбранные правила сохранены на паузе. Доставка в Telegram выключена.',true);}
    catch{failed(job,'Ответ о сохранении не подтверждён. Запрос мог быть применён: перечитайте правила перед новым действием.');}finally{finish(job);}
  });
  function cancel(focus=false){if(!busy&&!file)return;const unknown=writing;reset({clearSnapshot:true});say(unknown?'Чтение ответа отменено. Изменения могли сохраниться; перечитайте правила.':'Перенос отменён.');if(focus&&visible()&&!input.disabled)input.focus();}
  $('cancel').addEventListener('click',()=>cancel(true));host.addEventListener('keydown',e=>{if(e.key==='Escape'&&(busy||file)){e.preventDefault();e.stopPropagation();cancel(true);}});
  for(const [prefix,move] of [['',step=>{page+=step;renderFile();}],['comparison-',step=>{comparisonPage+=step;renderComparison();}]])for(const [name,step] of [['prev',-1],['next',1]])$(prefix+name).addEventListener('click',()=>{if(!$(prefix+name).disabled)move(step);});
  main.addEventListener('toggle',()=>{if(!main.open)cancel();else if(!snapshot&&native())void reread();});
  const changedView=()=>{if(!visible())cancel();};document.addEventListener('invest:view-changed',changedView);
  function update(){
    const next=getContext(),authorityChanged=next.key!==context.key,editorChanged=next.editor!==context.editor,sourceChanged=next.rules!==context.rules;
    if(authorityChanged||editorChanged||sourceChanged&&!busy){const pending=busy||file,unknown=writing;reset({clearSnapshot:true});denied=!next.canOpen;if(pending)say(unknown?'Контекст изменился. Изменения могли сохраниться; перечитайте правила.':'Профиль, правило или редактор изменились. Откройте файл снова.');}
    context=next;controls();
  }
  function dispose(){if(disposed)return;disposed=true;reset({clearSnapshot:true});document.removeEventListener('invest:view-changed',changedView);for(const [url,timer]of urls){clearTimeout(timer);URL.revokeObjectURL(url);}urls.clear();}
  window.addEventListener('pagehide',dispose,{once:true});controls();return{update,dispose};
}
