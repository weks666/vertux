import {RESEARCH_QUERY_VERSION, RESEARCH_QUERY_CATALOG, QUERY_UNITS, validateResearchQuery, validateResearchQueryResponse} from './research-query-contract.js';
import {createContextEvidence, renderContextEvidence, CONTEXT_EVIDENCE_VERSION} from './context-evidence.js';
import {validateResearchQueryRecord,validateResearchQuerySummaries,validateResearchQuerySave} from './research-query-record.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('ru-RU', {timeZone: 'Europe/Moscow'}) + ' мск' : 'Не указана';
const reasons = {'missing-value':'Нет доступного сохранённого значения.', 'different-period-basis':'Основа периода отличается от выбранного показателя.', 'different-unit':'Единица или валюта отличается от условия; пересчёт не выполняется.', 'value-precision-limit':'Значение превышает предел точности этого фильтра.'};
const resultLabel = {matched:'Соответствует условию', 'not-matched':'Не соответствует условию', excluded:'Исключено из проверки'};
function contextFor(packet, record = null) {
  const sources = packet.rows.flatMap(row => row.sources.map(source => ({id: row.id + ':' + source.id, label: row.instrument.name + ' · ' + source.title,
    asOf: source.asOf ?? null, receivedAt: source.retrievedAt ?? null})));
  return createContextEvidence({version: CONTEXT_EVIDENCE_VERSION, mode: 'research', intent: 'research.saved-metric-screen',
    state: packet.eligibleCount ? 'limited' : 'unsupported', object: {key: packet.revision, label: `Выбранные акции: ${packet.rows.length}`},
    revision: packet.revision, dataMode: packet.dataMode, method: {kind: 'local-calculation', label: 'Точный десятичный фильтр сохранённых значений; модель не используется.'},
    timezone: 'Europe/Moscow', periods: [{label:'Область времени', from:null, to:null, convention:'Последний локальный срез каждой выбранной акции. Период показателя и собственная дата источника указаны у каждой строки; единой исторической даты нет.'}],
    clocks: [...(record?[{label:'Результат сохранён',at:record.createdAt}]:[]),{label:record?'Предварительный просмотр действовал до':'Предварительный просмотр действителен до', at:packet.expiresAt}], sources,
    facts: packet.rows.map(row => ({id:row.id,label:row.instrument.name + ' · ' + (row.fact?.label || 'Показатель'),value:row.fact?.value ?? null,
      unit:row.fact?.unit || packet.query.unit, period:row.fact?.period ?? null, state:row.fact?'known':'unknown',sourceRefs:(row.fact?.sourceIds || []).map(id=>row.id+':'+id)})),
    limitations: [...packet.limitations], freshness:'Актуальность рынка и доступность данных в прошлом не подтверждены. Даты сохранённых источников различаются.',
    evidenceLocation:'«Значение и источник» у акции раскрывает точную цифру, единицу, основу периода, даты и ограничения. Исключённые записи остаются в результате.'});
}

export function createResearchQueryUI({host, request, standalone = false,onArchiveChanged=()=>{}}) {
  let key = '', generation = 0, operation = 0, opened = false, allowed = false, pending = false, selectedInstrument = null, universe = [], preview = null, query = null;
  let archiveOpened=false, archiveRows=[], activeRecord=null, saveAttempt=null, confirmRemove=false;
  host.classList.add('research-queries'); host.hidden = true;
  host.innerHTML = '<button type="button" data-rq="toggle" aria-expanded="false">Фильтр сохранённых показателей</button><section class="research-query-panel" hidden aria-label="Фильтр сохранённых показателей"><header><h3>Запрос по выбранным акциям</h3><button type="button" data-rq="close">Закрыть фильтр</button></header><p>Выберите акции и условие. Предварительный просмотр покажет область данных и исключения. Запрос читает сохранённые факты на этом устройстве.</p><button type="button" data-rq="archive" aria-expanded="false">Сохранённые результаты</button><section class="research-query-archive" aria-label="Сохранённые результаты" hidden></section><div class="research-query-editor"></div><p class="research-query-status" role="status" aria-live="polite"></p><div class="research-query-answer"></div></section>';
  const $ = selector => host.querySelector(selector), panel = $('.research-query-panel'), editor = $('.research-query-editor'), answer = $('.research-query-answer');
  const archive=$('.research-query-archive');
  const button = name => $(`[data-rq="${name}"]`), status = text => { $('.research-query-status').textContent = text; };
  if(standalone)button('toggle').textContent='Запросы и сохранённые результаты';
  function controls() {
    panel.hidden = !opened; button('toggle').setAttribute('aria-expanded', String(opened));
    for (const node of panel.querySelectorAll('.research-query-editor input,.research-query-editor select,.research-query-editor button,.research-query-answer input,.research-query-answer button,.research-query-archive button')) node.disabled = pending;
    button('archive').disabled=pending;button('archive').setAttribute('aria-expanded',String(archiveOpened));archive.hidden=!archiveOpened;
    if(answer.querySelector('[name=queryTitle]'))answer.querySelector('[name=queryTitle]').disabled=pending||saveAttempt!==null;
    button('run')?.toggleAttribute('disabled', pending || !preview);
    panel.setAttribute('aria-busy', String(pending));
    const boxes = [...editor.querySelectorAll('[name=instrument]')], count = boxes.filter(node => node.checked).length;
    button('preview')?.toggleAttribute('disabled', pending || count===0);
    for (const node of boxes) node.disabled = pending || count >= 6 && !node.checked;
  }
  function clearAnswer() { preview = null; query = null; activeRecord=null;saveAttempt=null;confirmRemove=false;answer.replaceChildren(); status(''); }
  function clearArchive(){archiveOpened=false;archiveRows=[];archive.replaceChildren();}
  function close() { opened = false; ++operation; pending = false; clearAnswer();clearArchive(); editor.replaceChildren(); controls(); button('toggle').focus(); }
  const current = (serial, op) => generation === serial && operation === op && opened && allowed;
  function focusContent(node){
    if(!node)return;const topbar=host.ownerDocument.querySelector('.topbar');
    if(topbar)node.style.scrollMarginTop=Math.ceil(topbar.getBoundingClientRect().height+12)+'px';
    node.focus({preventScroll:true});node.scrollIntoView({block:'start',behavior:'instant'});
  }
  function editorMarkup(seed=null,savedRows=[]) {
    const choices=new Map(universe.map(row=>[row.instrumentUid,row]));
    for(const row of savedRows)if(!choices.has(row.instrument.instrumentUid))choices.set(row.instrument.instrumentUid,{...row.instrument,savedSelection:true});
    const selected=new Set(seed?.instrumentUids||(selectedInstrument?.assetType==='share'?[selectedInstrument.instrumentUid]:[]));
    editor.innerHTML = `<form><fieldset><legend>Акции из текущего рабочего пространства — от одной до шести</legend><label class="research-query-search">Найти в списке<input type="search" name="search" autocomplete="off"></label><div class="research-query-universe">${[...choices.values()].map(row => `<label><input type="checkbox" name="instrument" value="${esc(row.instrumentUid)}" ${selected.has(row.instrumentUid) ? 'checked' : ''}><span>${esc([row.ticker,row.name].filter(Boolean).join(' · '))}${row.savedSelection?' · сохранённый выбор, текущий доступ нужно проверить':''}</span></label>`).join('')}</div></fieldset>
      <div class="research-query-fields"><label>Показатель<select name="metric">${RESEARCH_QUERY_CATALOG.map(row => `<option value="${row.key}" ${row.key==='peRatioTtm'?'selected':''}>${row.label} · ${row.period}</option>`).join('')}</select></label><label>Условие<select name="operator"><option value="lte">Не больше</option><option value="gte">Не меньше</option></select></label><label>Порог<input name="threshold" type="text" inputmode="decimal" maxlength="80" required value="10"></label><label data-rq-unit>Единица<select name="unit"><option value="ratio">Коэффициент · раз</option>${QUERY_UNITS.filter(unit=>unit!=='ratio').map(unit=>`<option value="${unit}">${unit}</option>`).join('')}</select></label></div>
      <p class="research-query-caption">Порог относится к указанной единице показателя. Валюта торгов не подставляется вместо валюты отчётности.</p><button type="submit" data-rq="preview">Проверить запрос</button></form>`;
    if(seed){editor.querySelector('[name=metric]').value=seed.metricKey;editor.querySelector('[name=operator]').value=seed.operator;editor.querySelector('[name=threshold]').value=seed.threshold;}
    if(!choices.size){const message=document.createElement('p');message.className='research-query-caption';message.textContent='Нет доступных акций в текущем рабочем пространстве. Сохранённые результаты можно открыть выше.';editor.querySelector('.research-query-universe').append(message);}
    unitOptions();if(seed)editor.querySelector('[name=unit]').value=seed.unit;controls();
  }
  function unitOptions() {
    const metric = RESEARCH_QUERY_CATALOG.find(row => row.key === editor.querySelector('[name=metric]').value), unit = editor.querySelector('[name=unit]');
    for (const option of unit.options) option.hidden = (metric.unitKind === 'ratio') !== (option.value === 'ratio');
    if (metric.unitKind === 'ratio') unit.value = 'ratio'; else if (unit.value === 'ratio') unit.value = 'RUB';
  }
  function command() {
    const form = new FormData(editor.querySelector('form'));
    return validateResearchQuery({version:RESEARCH_QUERY_VERSION,queryId:'saved-metric-filter',instrumentUids:form.getAll('instrument'),metricKey:form.get('metric'),
      operator:form.get('operator'),threshold:String(form.get('threshold')).trim().replace(',', '.'),unit:form.get('unit')});
  }
  function factMarkup(row, historical = false) {
    const value = row.fact;
    return `<details class="research-query-source"><summary>Значение и источник · ${esc(row.instrument.ticker || row.instrument.name)}</summary><dl>
      <div><dt>Сохранённое значение</dt><dd>${value?esc(value.value)+' '+esc(value.unit):'Нет данных'}</dd></div><div><dt>Основа периода показателя</dt><dd>${esc(value?.period || 'Не указана')}</dd></div>
      <div><dt>Отчётная дата источника</dt><dd>${esc(date(row.dataAsOf))}</dd></div><div><dt>Получены показатели</dt><dd>${esc(date(row.receivedAt))}</dd></div><div><dt>${historical?'Состояние сводки при сохранении':'Состояние сохранённой сводки'}</dt><dd>${(historical?{fresh:'На момент сохранения — в пределах срока локального кеша',stale:'На момент сохранения сводка была устаревшей',missing:'При сохранении сводки не было',synthetic:'Учебные данные сохранённого среза'}:{fresh:'В пределах срока локального кеша; текущий рынок не проверен',stale:'Сохранённая сводка устарела',missing:'Сводки нет',synthetic:'Учебные данные'})[row.cacheState]}</dd></div></dl>
      ${row.sources.length?'<ul>'+row.sources.map(source=>`<li><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)}</a> · дата источника: ${esc(date(source.asOf))}; получен: ${esc(date(source.retrievedAt))}</li>`).join('')+'</ul>':'<p>Для отсутствующего значения источник не указан.</p>'}
      <ul>${row.limitations.map(text=>'<li>'+esc(text)+'</li>').join('')}</ul></details>`;
  }
  function renderPacket(packet, result, record = null) {
    answer.innerHTML = `<h4 tabindex="-1">${record?'Сохранённый результат':result?'Результат фильтра':'Предварительный просмотр'}</h4>${record?`<p class="research-query-record-title"><strong>${esc(record.title)}</strong></p><p>Сохранён ${esc(date(record.createdAt))}. Это неизменяемый срез; текущие данные при открытии не проверялись.</p>`:''}<p class="research-query-condition">${esc(packet.condition)}</p>
      <p>${packet.dataMode==='synthetic'?'Учебные синтетические данные. ':'Локально сохранённые данные. '}Выбрано акций: ${packet.rows.length}; доступно для проверки: ${packet.eligibleCount}; исключено: ${packet.excludedCount}.</p>
      ${result?`<p class="research-query-outcome">${packet.state==='unavailable'?'Фильтр недоступен: нет значений для проверки условия.':`Соответствуют условию: ${packet.matchedCount}; не соответствуют: ${packet.notMatchedCount}. Это результат только по проверенным строкам.`}</p>`:'<p>Даты и фискальные периоды могут различаться. Результат проверяет условие у каждой акции; сопоставимость компаний и единая историческая дата не устанавливаются.</p><button type="button" data-rq="run">Показать результат</button>'}
      ${record?'<div class="research-query-record-actions"><button type="button" data-rq="repeat">Вернуть параметры в форму</button><button type="button" data-rq="ask-remove">Удалить сохранённый результат</button></div><div class="research-query-remove" hidden><p>Удалить эту запись с устройства? Текущие сохранённые факты компаний останутся доступными.</p><button type="button" data-rq="confirm-remove">Подтвердить удаление</button><button type="button" data-rq="cancel-remove">Оставить запись</button></div>':result?`<form class="research-query-save"><label>Название сохранённого результата<input name="queryTitle" maxlength="140" required value="${esc(packet.condition.slice(0,140))}"></label><button type="submit" data-rq="save">Сохранить результат</button><p>Запрос и проверенный срез останутся на этом устройстве. Перед записью приложение ещё раз проверит источник.</p></form>`:''}
      <ol class="research-query-rows">${packet.rows.map(row=>`<li data-query-row="${esc(row.id)}"><h5>${esc([row.instrument.ticker,row.instrument.name].filter(Boolean).join(' · '))}</h5><p>${result?resultLabel[row.result]:row.state==='eligible'?'Значение доступно для проверки':'Исключено из проверки'}${row.reason?' — '+esc(reasons[row.reason]):''}</p>${factMarkup(row,Boolean(record))}</li>`).join('')}</ol>
      <details class="research-query-limits"><summary>Границы запроса</summary><ul>${packet.limitations.map(text=>'<li>'+esc(text)+'</li>').join('')}</ul></details>`;
    answer.insertAdjacentHTML('beforeend', renderContextEvidence(contextFor(packet,record)));
    focusContent(answer.querySelector('h4'));
  }
  const archiveError=()=>'<h4 tabindex="-1">Список не подтверждён</h4><p>Не удалось прочитать сохранённые результаты. Их количество неизвестно.</p><button type="button" data-rq="archive-refresh">Обновить список</button>';
  async function loadArchive(){
    if(!opened||!allowed||pending)return;const serial=generation,op=++operation;
    archiveOpened=true;pending=true;archive.innerHTML='<p>Загружаем сохранённые результаты…</p>';controls();
    try{
      const value=await request('/api/research/query/archive');if(!current(serial,op))return;
      archiveRows=validateResearchQuerySummaries(value?.records);
      archive.innerHTML=`<h4 tabindex="-1">Сохранённые результаты · ${archiveRows.length}</h4><p>Личные записи на этом устройстве. Открытие показывает исходный срез; новый расчёт запускается отдельно.</p><button type="button" data-rq="archive-refresh">Обновить список</button>${archiveRows.length?'<ul>'+archiveRows.map(row=>`<li><button type="button" data-rq="archive-open" data-query-record="${esc(row.id)}">${esc(row.title)}</button><p>${esc(date(row.createdAt))} · акций: ${row.query.instrumentUids.length}${row.state==='unavailable'?' · условие не удалось проверить':''}</p></li>`).join('')+'</ul>':'<p>Сохранённых результатов пока нет.</p>'}`;
      focusContent(archive.querySelector('h4'));
    }catch{if(current(serial,op)){archiveRows=[];archive.innerHTML=archiveError();focusContent(archive.querySelector('h4'));}}
    finally{if(current(serial,op)){pending=false;controls();}}
  }
  function showRecord(record){
    clearAnswer();activeRecord=record;query=record.packet.query;renderPacket(record.packet,true,record);
  }
  async function openRecord(id){
    const summary=archiveRows.find(row=>row.id===id);if(!summary||!opened||!allowed||pending)return;
    const serial=generation,op=++operation;clearAnswer();pending=true;status('Открываем сохранённый срез…');controls();
    try{
      const value=await request('/api/research/query/archive?id='+encodeURIComponent(id));if(!current(serial,op))return;
      const record=validateResearchQueryRecord(value?.record,{wire:true});
      if(record.id!==summary.id||record.payloadHash!==summary.payloadHash||record.title!==summary.title||record.createdAt!==summary.createdAt)throw Error('Archive selection changed');
      validateResearchQueryResponse(record.packet,summary.query,{result:true});showRecord(record);
    }catch{if(current(serial,op)){clearAnswer();status('Не удалось подтвердить выбранную запись. Обновите список сохранённых результатов.');}}
    finally{if(current(serial,op)){pending=false;controls();}}
  }
  async function saveResult(){
    if(!opened||!allowed||pending||activeRecord||preview?.version!=='research-query-result-v1')return;
    let body;try{body=saveAttempt||validateResearchQuerySave({requestId:crypto.randomUUID(),title:answer.querySelector('[name=queryTitle]').value,previewId:preview.previewId,revision:preview.revision});}
    catch{status('Введите название сохранённого результата — до 140 символов в одной строке.');return;}
    const serial=generation,op=++operation,captured=preview;saveAttempt=body;pending=true;status('Перепроверяем источник и сохраняем результат…');controls();
    try{
      const value=await request('/api/research/query/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!current(serial,op))return;
      const record=validateResearchQueryRecord(value?.record,{wire:true});
      if(record.id!==body.requestId||record.title!==body.title||typeof value.reused!=='boolean')throw Error('Save acknowledgement mismatch');
      validateResearchQueryResponse(record.packet,captured.query,{result:true,previewId:body.previewId,revision:body.revision});
      showRecord(record);onArchiveChanged();status(value.reused?'Сохранение подтверждено: повторная запись не создана.':'Результат сохранён на этом устройстве.');
      if(archiveOpened){archiveRows=[];archive.innerHTML='<p>Список изменился.</p><button type="button" data-rq="archive-refresh">Обновить список</button>';}
    }catch(error){if(current(serial,op)){
      if(['RESEARCH_QUERY_CHANGED','RESEARCH_QUERY_GONE'].includes(error?.code)){clearAnswer();status('Источник изменился или просмотр истёк. Проверьте запрос заново перед сохранением.');}
      else{status(error?.code==='RESEARCH_QUERY_ARCHIVE_LIMIT'?'Сохранено 20 результатов. Откройте список и удалите ненужный.':'Сохранение не подтверждено. Обновите список; повторная проверка использует тот же запрос и не создаёт дубликат.');if(button('save'))button('save').textContent='Проверить сохранение';}
    }}finally{if(current(serial,op)){pending=false;controls();}}
  }
  function repeatRecord(){
    if(!activeRecord||pending)return;const record=activeRecord;++operation;clearAnswer();editorMarkup(record.packet.query,record.packet.rows);
    status('Параметры восстановлены. Проверьте запрос, чтобы прочитать текущие сохранённые данные.');focusContent(editor.querySelector('[name=metric]'));
  }
  async function removeRecord(){
    if(!activeRecord||!confirmRemove||pending||!opened||!allowed)return;
    const serial=generation,op=++operation,record=activeRecord;pending=true;status('Удаляем выбранную запись…');controls();
    try{
      const value=await request('/api/research/query/remove',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:record.id,payloadHash:record.payloadHash})});if(!current(serial,op))return;
      if(value?.removed!==true)throw Error('Deletion not acknowledged');pending=false;clearAnswer();onArchiveChanged();await loadArchive();
    }catch{if(current(serial,op))status('Удаление не подтверждено. Обновите список перед повтором.');}
    finally{if(current(serial,op)){pending=false;controls();}}
  }
  async function run(result) {
    if (!allowed || !opened || pending || result && !preview) return;
    let next; try { next = result ? query : command(); } catch { status('Выберите от одной до шести разных акций, показатель и десятичный порог в указанной единице.'); return; }
    const serial = generation, op = ++operation, captured = preview;
    pending = true; status(result?'Перепроверяем сохранённые источники…':'Читаем выбранные сохранённые факты…'); controls();
    try {
      const value = await request('/api/research/query/' + (result?'run':'preview'), {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(result?{previewId:captured.previewId,revision:captured.revision}:next)});
      if (!current(serial,op)) return;
      const packet = validateResearchQueryResponse(value,next,{result,previewId:result?captured.previewId:null,revision:result?captured.revision:null});
      preview = packet; query = next; activeRecord=null;saveAttempt=null;confirmRemove=false;pending = false; status(''); renderPacket(packet,result);
    } catch (error) {
      if (!current(serial,op)) return; clearAnswer();
      status(['RESEARCH_QUERY_CHANGED','RESEARCH_QUERY_GONE'].includes(error?.code)?'Предварительный просмотр изменился или истёк. Проверьте запрос заново.':'Не удалось подтвердить запрос. Сохранённые факты не считаются отсутствующими; повторите проверку.');
    } finally { if (current(serial,op)) { pending = false; controls(); } }
  }
  host.addEventListener('click', event => {
    const action = event.target.closest('[data-rq]')?.dataset.rq;
    if (action === 'toggle' && allowed) { if (opened) close(); else { opened = true; clearAnswer(); editorMarkup(); controls(); editor.querySelector('[name=search]').focus(); } }
    if (action === 'close') close();
    if (action === 'run') void run(true);
    if (action === 'archive') {if(archiveOpened){archiveOpened=false;controls();}else void loadArchive();}
    if (action === 'archive-refresh') void loadArchive();
    if (action === 'archive-open') void openRecord(event.target.closest('[data-query-record]')?.dataset.queryRecord);
    if (action === 'repeat') repeatRecord();
    if (action === 'ask-remove'&&activeRecord&&!pending) {confirmRemove=true;$('.research-query-remove').hidden=false;button('confirm-remove').focus();}
    if (action === 'cancel-remove') {confirmRemove=false;$('.research-query-remove').hidden=true;button('ask-remove').focus();}
    if (action === 'confirm-remove') void removeRecord();
  });
  answer.addEventListener('submit',event=>{if(event.target.matches('.research-query-save')){event.preventDefault();void saveResult();}});
  editor.addEventListener('submit', event => { event.preventDefault(); void run(false); });
  editor.addEventListener('input', event => {
    if (event.target.name === 'search') {
      const text = event.target.value.toLocaleLowerCase('ru-RU');
      for (const label of editor.querySelectorAll('.research-query-universe>label')) label.hidden = !label.textContent.toLocaleLowerCase('ru-RU').includes(text);
      return;
    }
    ++operation; pending = false; clearAnswer(); if (event.target.name === 'metric') unitOptions(); controls();
  });
  host.addEventListener('keydown', event => { if (event.key === 'Escape' && opened) { event.preventDefault(); event.stopPropagation(); close(); } });
  return {openSavedRecord(value,{isCurrent}={}) {
    if(!allowed||host.hidden||typeof isCurrent!=='function'||!isCurrent())return false;
    let record;try{record=structuredClone(validateResearchQueryRecord(value,{wire:true}));}catch{return false;}
    if(!isCurrent())return false;++operation;pending=false;opened=true;clearArchive();editorMarkup();showRecord(record);controls();return true;
  },update({meta, active, accessKey, permitted, instruments = []}) {
    const byId = new Map(); for (const row of [meta, ...instruments]) if (row?.assetType === 'share' && row.instrumentUid && !byId.has(row.instrumentUid)) byId.set(row.instrumentUid, row);
    const next = JSON.stringify([accessKey,meta?.instrumentUid,permitted,active,[...byId].map(([id,row])=>[id,row.ticker,row.name])]);
    if (next !== key) { key=next; ++generation; ++operation; pending=false; opened=false; clearAnswer();clearArchive(); editor.replaceChildren(); }
    universe=[...byId.values()]; selectedInstrument=meta; allowed=permitted===true&&(standalone||meta?.assetType==='share'); host.hidden=!active||!allowed; controls();
  }};
}
