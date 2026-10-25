import {ALERT_ARCHIVE_LIMITS,decodePriceAlertArchiveStream} from './price-alert-archive-model.js';
import {priceRuleTransferFields} from './price-rules-transfer-model.js';
const PAGE=25,groups={rules:'Текущие правила',versions:'Версии условий',events:'Сигналы'};
const state=r=>r.state==='legacy'?(r.enabled?'Старое правило: приём включён':'Старое правило: выключено'):({active:'Приём включён',paused:'На паузе',corrupt:'Условия повреждены',unsupported:'Формат не поддерживается'})[r.state];
const title=r=>r.config?`${r.config.subject.exchange}:${r.config.subject.symbol} · ${r.config.targetPrice}`:'Условия недоступны';
const date=v=>v??'Нет отметки',yes=v=>v?'Да':'Нет';
const delivery={pending:'Ожидало отправки',not_configured:'Отправка не выполнялась',sent:'Отправлено',failed:'Ошибка отправки',unknown:'Результат неизвестен'};
const evaluation={legacy:'Старое событие без версионной оценки',accepted:'Сигнал принят', 'cooldown-suppressed':'Подавлен интервалом ожидания'};

export function createPriceAlertArchiveUi({host,getContext,download}){
  const make=(tag,text)=>{const el=globalThis.document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
  host.classList.add('native-lists-transfer','price-alert-archive');host.dataset.alertArchive='';
  host.innerHTML='<details data-archive-main><summary><strong>Архив версий и сигналов</strong><span>Сохранённая история · JSONL</span></summary><div class="native-lists-body"><p>Текущие правила, все сохранённые версии и сигналы, включая подавленные интервалом ожидания. Архив предназначен для чтения.</p><p class="native-lists-caption">Новые записи во время скачивания не входят; отметки просмотра и доставки указаны на время чтения части.</p><p data-archive-access class="native-lists-caption"></p><div class="native-lists-actions"><button type="button" data-archive-export>Скачать архив</button><button type="button" data-archive-cancel hidden>Отменить чтение</button></div><label class="native-lists-file">Открыть архив JSONL, до 384 МиБ<input type="file" accept=".jsonl,.ndjson,application/x-ndjson" data-archive-file></label><p data-archive-status role="status" aria-live="polite"></p><section data-archive-result hidden><h3 tabindex="-1" data-archive-title>Архив открыт</h3><p>Источник — выбранный файл. Его содержимое проверено на целостность формата и связей; происхождение и достоверность данных не подтверждены.</p><p data-archive-coverage></p><p data-archive-counts></p><div class="price-archive-filters"><label>Раздел<select data-archive-group></select></label><label>Правило<select data-archive-rule></select></label></div><div class="price-archive-pager"><button type="button" data-archive-first>В начало</button><button type="button" data-archive-prev>Назад</button><span data-archive-page role="status"></span><button type="button" data-archive-next>Далее</button><button type="button" data-archive-last>В конец</button></div><div data-archive-rows></div></section></div></details>';
  const $=name=>host.querySelector('[data-archive-'+name+']'),main=$('main'),input=$('file');
  let context=getContext(),epoch=0,busy=false,disposed=false,fileData=null,page=0,group='rules',filter='',filtered=[],names=new Map();const urls=new Map();
  const visible=()=>!disposed&&main.open&&Boolean(host.closest('.view.active'));
  const say=text=>{$('status').textContent=text;};
  function controls(){
    const c=getContext();host.setAttribute('aria-busy',String(busy));
    $('export').disabled=busy||Boolean(c.pending)||!c.canNative;
    input.disabled=busy||Boolean(c.pending)||!c.canOpen;
    $('cancel').hidden=!busy&&!fileData;$('cancel').textContent=busy?'Отменить чтение':'Закрыть файл';
    $('access').textContent=c.canNative?'Можно скачать сохранённую историю. Просмотр архива не отмечает события прочитанными и не отправляет уведомления.':'Доступен просмотр файла. Для скачивания нужен сервис с поддержкой архива и подтверждённый доступ владельца.';
    for(const name of ['group','rule'])$(name).disabled=busy;
    for(const name of ['first','prev'])$(name).disabled=busy||page===0;
    for(const name of ['next','last'])$(name).disabled=busy||(page+1)*PAGE>=filtered.length;
  }
  function revoke(){for(const [url,timer]of urls){clearTimeout(timer);URL.revokeObjectURL(url);}urls.clear();}
  function reset(){epoch++;busy=false;fileData=null;page=0;group='rules';filter='';filtered=[];names.clear();input.value='';$('result').hidden=true;for(const name of ['rows','group','rule'])$(name).replaceChildren();revoke();controls();}
  const current=job=>job.epoch===epoch&&job.key===getContext().key&&visible();
  function begin(){busy=true;controls();return{epoch,key:getContext().key};}
  const pair=(name,value)=>({label:name,value:String(value??'Недоступно')});
  function fields(record){
    const r=record.value;
    if(record.type==='rule')return[...priceRuleTransferFields(r),pair('Приём на начало архива',state(r)),pair('Текущая версия',r.ruleVersion),pair('Создано, UTC',r.createdAt),pair('Изменено, UTC',r.updatedAt)];
    if(record.type==='version'){
      const config=r.config?priceRuleTransferFields({key:r.ruleKey,state:'paused',enabled:false,ruleVersion:r.version,createdAt:r.createdAt,updatedAt:r.createdAt,config:r.config}):[];
      return[pair('Версия',r.version),pair('Содержимое',({available:'Доступно',corrupt:'Повреждено',unsupported:'Формат не поддерживается'})[r.status]),...config,pair('Создано, UTC',r.createdAt),pair('Есть запись восстановления',yes(r.recoveryRecorded)),pair('Содержимое записи восстановления','Не входит в архив')];
    }
    const d=r.details;if(!d)return[pair('Событие','Содержимое или связь с версией недоступны')];
    return[pair('Версия правила',d.ruleVersion===0?'Старое правило без версии':d.ruleVersion),pair('Источник','TradingView'),pair('Инструмент',d.subject.exchange+':'+d.subject.symbol),pair('Целевой уровень',d.targetPrice),pair('Цена события',d.actualPrice),pair('План',({buy:'Покупка',sell:'Продажа',watch:'Наблюдение'})[d.intent]),pair('Время источника, UTC',d.sourceTime),pair('Получено, UTC',d.receivedAt),pair('Результат оценки',evaluation[d.evaluationState]),pair('Следующий допустимый сигнал, UTC',date(d.nextAllowedAt)),pair('Просмотрено, UTC',date(d.readAt)),pair('Доставка в Telegram при чтении',delivery[d.telegramStatus]),pair('Код доставки',d.telegramErrorCode??'Нет кода'),pair('Попыток доставки',d.attempts),pair('Следующая попытка, UTC',date(d.nextAttemptAt))];
  }
  function renderRows(){
    $('rows').replaceChildren();const total=filtered.length,start=page*PAGE;
    $('page').textContent=total?`${start+1}–${Math.min(start+PAGE,total)} из ${total}`:'Записей нет';
    for(const [i,record]of filtered.slice(start,start+PAGE).entries()){
      const r=record.value,ruleKey=record.type==='rule'?r.key:r.ruleKey,node=make('details'),summary=make('summary');node.dataset.archiveEntry='';
      summary.append(make('strong',names.get(ruleKey)??'Связь с правилом недоступна'));
      const description=record.type==='rule'?state(r):record.type==='version'?`Версия ${r.version} · ${r.status==='available'?'условия доступны':r.status==='corrupt'?'содержимое повреждено':'формат не поддерживается'}`:r.details?`${evaluation[r.details.evaluationState]} · ${r.details.sourceTime}`:'Сигнал: содержимое недоступно';
      summary.append(make('span',`${start+i+1}. ${description}`));node.append(summary);
      const dl=make('dl');for(const value of [...fields(record),pair('Эта запись прочитана, UTC',record.observedAt)]){const row=make('div');row.append(make('dt',value.label),make('dd',value.value));dl.append(row);}node.append(dl);$('rows').append(node);
    }
    if(!total)$('rows').append(make('p','В этом разделе для выбранного правила записей нет.'));controls();
  }
  function selectRows(){page=0;filtered=fileData?.[group].filter(record=>filter===''||filter==='unlinked'?filter===''||record.value.ruleKey===null:(record.type==='rule'?record.value.key:record.value.ruleKey)===filter)??[];renderRows();}
  function renderFile(){
    const {header}=fileData;names=new Map(fileData.rules.map((record,i)=>[record.value.key,`Правило ${i+1} · ${title(record.value)}`]));
    $('coverage').textContent=`Состав зафиксирован: ${header.startedAt} (UTC). Новые записи после этого времени не входят. Отметки просмотра и доставки наблюдались при чтении каждой части; время доступно в записи.`;
    $('counts').textContent=`Правил: ${header.counts.rules}. Версий: ${header.counts.versions}. Сигналов: ${header.counts.events}. Весь заявленный набор прочитан.`;
    const option=(select,value,text)=>{const item=make('option',text);item.value=value;select.append(item);};
    for(const [key,label]of Object.entries(groups))option($('group'),key,`${label} (${header.counts[key]})`);
    option($('rule'),'','Все правила');for(const [key,label]of names)option($('rule'),key,label);
    if(fileData.versions.some(r=>r.value.ruleKey===null)||fileData.events.some(r=>r.value.ruleKey===null))option($('rule'),'unlinked','Связь с правилом недоступна');
    $('result').hidden=false;selectRows();$('title').focus();
  }
  $('export').addEventListener('click',async()=>{
    if($('export').disabled||!visible())return;reset();const job=begin();say('Читаем сохранённую историю…');
    try{
      const result=await download({isCurrent:()=>current(job),onProgress:({counts,total})=>{if(current(job))say(`Прочитано правил: ${counts.rules}/${total.rules}, версий: ${counts.versions}/${total.versions}, сигналов: ${counts.events}/${total.events}.`);}});
      if(!current(job))return;if(!result?.ok||!result.authority?.isCurrent())throw Error('unconfirmed');
      const blob=new Blob(result.data.parts,{type:'application/x-ndjson'});if(blob.size!==result.data.byteLength)throw Error('size');
      if(!current(job)||!result.authority.isCurrent())return;
      const url=URL.createObjectURL(blob),link=make('a');link.href=url;link.download='vertux-price-alert-archive.jsonl';link.dataset.archiveDownload='';link.hidden=true;host.append(link);link.click();link.remove();urls.set(url,setTimeout(()=>{URL.revokeObjectURL(url);urls.delete(url);},30000));
      const n=result.data.header.counts;say(`Архив подготовлен: правил ${n.rules}, версий ${n.versions}, сигналов ${n.events}. Скачанный файл можно открыть здесь.`);
    }catch{if(current(job)){reset();say('Архив не завершён, файл не создан. Обновите список уведомлений и начните скачивание заново.');}}
    finally{if(current(job)){busy=false;controls();}}
  });
  input.addEventListener('change',async()=>{
    const file=input.files?.[0];if(!file||input.disabled||!visible())return;reset();const job=begin();say('Читаем и проверяем архив…');
    try{
      if(file.size>ALERT_ARCHIVE_LIMITS.fileBytes)throw Error('limit');
      const result=await decodePriceAlertArchiveStream(file.stream(),{isCurrent:()=>current(job),onProgress:p=>{if(current(job))say(`Проверено записей: ${p.records}. Прочитано ${Math.ceil(p.bytes/1024)} КиБ.`);}});
      if(!current(job))return;fileData=result;renderFile();say('Файл открыт только для просмотра. Данные приложения не изменены.');
    }catch{if(current(job)){reset();say('Не удалось открыть целый архив. Нужен завершённый файл JSONL версии 1 до 384 МиБ с корректными связями и количествами.');}}
    finally{if(current(job)){busy=false;controls();}}
  });
  function cancel(focus=false){if(!busy&&!fileData)return;reset();say('Чтение закрыто. Данные приложения не изменены.');if(focus&&visible())input.focus();}
  $('cancel').addEventListener('click',()=>cancel(true));host.addEventListener('keydown',event=>{if(event.key==='Escape'&&(busy||fileData)){event.preventDefault();event.stopPropagation();cancel(true);}});
  for(const name of ['first','prev','next','last'])$(name).addEventListener('click',()=>{if($(name).disabled)return;page=name==='first'?0:name==='last'?Math.max(0,Math.ceil(filtered.length/PAGE)-1):page+(name==='prev'?-1:1);renderRows();});
  $('group').addEventListener('change',()=>{group=$('group').value;selectRows();});$('rule').addEventListener('change',()=>{filter=$('rule').value;selectRows();});
  main.addEventListener('toggle',()=>{if(!main.open)cancel();});const changedView=()=>{if(!visible())cancel();};globalThis.document.addEventListener('invest:view-changed',changedView);
  function update(){const next=getContext();if(next.key!==context.key||!next.canOpen){const had=busy||fileData;reset();if(had)say('Доступ или профиль изменились. Откройте архив заново.');}context=next;controls();}
  function dispose(){if(disposed)return;disposed=true;reset();globalThis.document.removeEventListener('invest:view-changed',changedView);window.removeEventListener('pagehide',dispose);}
  window.addEventListener('pagehide',dispose,{once:true});controls();return{update,dispose};
}
