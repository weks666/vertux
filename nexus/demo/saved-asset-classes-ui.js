import {decimalNanos} from './number-format.js';

const esc=value=>String(value??'').replace(/[&<>"']/gu,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const keys=['shares','bonds','etf','currencies'];
const labels={shares:'Акции',bonds:'Облигации',etf:'Фонды',currencies:'Валютные активы по оценке брокера'};
const shortLabels={...labels,currencies:'Валютные активы'};
const excludedLabels={futures:'Фьючерсы',options:'Опционы',sp:'Структурные продукты',dfa:'Цифровые финансовые активы'};
const known=value=>typeof value==='string'&&/^-?\d{1,4097}$/u.test(value);
const amount=value=>known(value)?decimalNanos(value,{digits:9})+' ₽':'Нет данных';
const date=value=>{const at=typeof value==='string'?Date.parse(value):NaN;return Number.isFinite(at)?new Date(at).toLocaleString('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'})+' мск':'Нет данных';};
const ratio=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1;
const percent=value=>!ratio(value)?'Нет данных':value>0&&value<.0001?'<0,01 %':new Intl.NumberFormat('ru-RU',{style:'percent',maximumFractionDigits:2}).format(value);
const age=value=>!Number.isSafeInteger(value)||value<0?'Не подтверждён':value===0?'На конец периода':value<864000?'<0,01 дн. до конца периода':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(value/86400000)+' дн. до конца периода';
const facts=rows=>'<dl class="saved-classes-facts">'+rows.map(([label,value])=>'<div><dt>'+esc(label)+'</dt><dd>'+esc(value)+'</dd></div>').join('')+'</dl>';
const reason=value=>typeof value==='string'&&value.trim()?value:'Исходные данные не подтверждены.';

// Geometry consumes ready NAV shares. Never normalize known classes to 100%
// or turn the unallocated arithmetic remainder into an asset tile.
function mapTiles(rows){
 const eligible=rows.filter(row=>row.hasAmount&&BigInt(row.amountNanos)>0n&&ratio(row.share)&&row.share>0);
 if(eligible.reduce((sum,row)=>sum+row.share,0)>1+Number.EPSILON*8)return [];
 const result=[];let x=0,y=0,width=1,height=1,remaining=1;
 for(const row of [...eligible].sort((a,b)=>b.share-a.share)){
  if(remaining<=0)break;
  const part=Math.min(1,row.share/remaining),vertical=width>=height;
  const box={x,y,width:vertical?width*part:width,height:vertical?height:height*part};
  // Keep sub-pixel observations exact in the adjacent accessible list.
  if(box.width>=.002&&box.height>=.002)result.push({...row,...box});
  if(vertical){x+=box.width;width-=box.width;}else{y+=box.height;height-=box.height;}
  remaining=Math.max(0,remaining-row.share);
 }
 return result;
}

/** Public snapshot presentation only. The DTO owns class sums, NAV ratios and
 * remainders; selection changes only the adjacent description. */
export function createSavedAssetClassesUi({host}){
 let signature='',scope='',selected=null,currentRows=[],disposed=false;
 function selection(){
  if(!host)return;
  const row=currentRows.find(item=>item.key===selected);
  for(const control of host.querySelectorAll('[data-saved-class-select]')){
   const active=control.dataset.savedClassSelect===selected;
   control.setAttribute('aria-pressed',String(active));
   control.closest('[data-saved-class]')?.setAttribute('data-selected',String(active));
  }
  const detail=host.querySelector('[data-saved-class-detail]');if(!detail||!row)return;
  const positive=row.hasAmount&&BigInt(row.amountNanos)>0n,zero=row.hasAmount&&BigInt(row.amountNanos)===0n,negative=row.hasAmount&&BigInt(row.amountNanos)<0n;
  const mapped=host.querySelector(`[data-saved-class-tile="${row.key}"]`);
  const areaNote=negative?'Отрицательная сумма сохранена со знаком. Площадь и доля от стоимости портфеля недоступны.'
   :zero?'В источнике сохранён явный ноль. Плитка не рисуется.'
    :!row.hasAmount?'Сумма не подтверждена. Она не заменяется нулём и не занимает площадь.'
     :row.share===null?'Сумма известна, но доля от стоимости портфеля не подтверждена. Плитка не рисуется.'
      :positive&&!mapped?'Сумма меньше масштаба карты. Точное ненулевое значение сохранено в списке.'
       :'Площадь соответствует доле от стоимости всего портфеля.';
  detail.innerHTML=`<h4 id="savedClassDetailTitle">${esc(labels[row.key])}</h4><p class="saved-classes-detail-amount" data-saved-selected-amount>${esc(row.hasAmount?amount(row.amountNanos):'Нет данных')}</p><p class="saved-classes-detail-share">${row.share===null?'Доля не подтверждена':esc(percent(row.share))+' от стоимости портфеля'}</p><p class="saved-classes-detail-note">${esc(areaNote)}</p>${row.reason?'<p class="saved-classes-detail-reason">'+esc(row.reason)+'</p>':''}${row.key==='currencies'?'<p class="saved-classes-detail-note">Это оценка валютных активов брокером, а не подтверждённые свободные деньги.</p>':''}`;
 }
 function click(event){
  const control=event.target.closest('[data-saved-class-select]');
  if(!control||!host.contains(control)||!currentRows.some(row=>row.key===control.dataset.savedClassSelect))return;
  selected=control.dataset.savedClassSelect;selection();
 }
 function keydown(event){
  const control=event.target.closest('[data-saved-class-row-select]');
  if(!control||!host.contains(control)||!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
  const controls=[...host.querySelectorAll('[data-saved-class-row-select]')],index=controls.indexOf(control);
  const target=event.key==='Home'?0:event.key==='End'?controls.length-1:(index+(event.key==='ArrowDown'?1:-1)+controls.length)%controls.length;
  event.preventDefault();selected=controls[target].dataset.savedClassSelect;selection();controls[target].focus({preventScroll:true});
 }
 // The map mirrors the accessible row controls. A pointer selection should
 // not move focus onto its aria-hidden visual duplicate.
 const pointerdown=event=>{if(event.target.closest('[data-saved-class-tile]'))event.preventDefault();};
 host?.addEventListener('click',click);host?.addEventListener('keydown',keydown);host?.addEventListener('pointerdown',pointerdown);
 function update(data){
  if(!host||disposed)return;
  const dto=data?.portfolio?.savedAssetClasses,accounts=Array.isArray(data?.clientProduct?.portfolios)?data.clientProduct.portfolios:[];
  const period=data?.selectedPeriod,ids=Array.isArray(dto?.scope?.portfolioIds)?dto.scope.portfolioIds:[];
  const valid=dto?.contractVersion==='saved-asset-classes-v1'&&['partial','unavailable'].includes(dto.state)&&dto.coverage?.state==='partial';
  const account=accounts.length===1&&ids.length===1&&accounts[0].id===ids[0]?accounts[0]:null;
  const matchingPeriod=typeof period?.from==='string'&&typeof period?.to==='string'&&dto?.period?.requestedFrom===period.from&&dto?.period?.requestedTo===period.to;
  const rows=Array.isArray(dto?.classes)?dto.classes:[];
  const fixedRows=rows.length===4&&keys.every(key=>rows.filter(row=>row?.key===key).length===1);
  const eligible=valid&&dto.scope?.kind==='single-account'&&account&&matchingPeriod&&dto.currency==='RUB'&&fixedRows;
  const multi=accounts.length>1||dto?.scope?.kind==='multi-account';
  const nextScope=JSON.stringify([data?.identity?.preferenceScope??null,data?.environment??null,accounts.map(row=>row.id),period?.from,period?.to]),changed=nextScope!==scope;
  const next=JSON.stringify([dto,accounts.map(row=>[row.id,row.label]),nextScope]);if(next===signature)return;
  const active=host.contains(document.activeElement)?document.activeElement:null;
  const focusedClass=active?.dataset.savedClassSelect,focusedMethod=active?.tagName==='SUMMARY'&&active.parentElement.dataset.savedClassesDetails==='method';
  const methodOpen=!changed&&host.querySelector('[data-saved-classes-details="method"]')?.open;
  signature=next;scope=nextScope;
  const available=eligible&&dto.state==='partial';host.dataset.state=available?'partial':'unavailable';
  const blocked=multi?'Выберите один счёт в поле «Счёт портфеля». Снимки разных счетов не объединяются.'
   :!valid?'Сохранённые суммы для выбранного счёта и периода пока недоступны.'
    :!account||dto.scope?.kind!=='single-account'?'Данные не соответствуют выбранному счёту. Дождитесь обновления.'
     :!matchingPeriod?'Данные относятся к другому периоду. Дождитесь обновления.'
      :!eligible?'Сохранённые суммы этого профиля не подтверждены.':null;
  currentRows=blocked?[]:keys.map(key=>{
   const row=rows.find(item=>item.key===key),hasAmount=available&&row.state==='known'&&known(row.amountNanos);
   const share=hasAmount&&dto.arithmeticState==='known'&&ratio(row.navShare)?row.navShare:null;
   return {...row,hasAmount,share,reason:!hasAmount||share===null?reason(row.reason):null};
  });
  if(changed||!currentRows.some(row=>row.key===selected))selected=currentRows.find(row=>row.hasAmount&&BigInt(row.amountNanos)>0n)?.key||currentRows[0]?.key||null;
  const tiles=available&&dto.arithmeticState==='known'?mapTiles(currentRows):[];
  const mapEmpty=!available?'Для карты нет подтверждённых данных.'
   :dto.arithmeticState!=='known'?'Площади недоступны: доли от стоимости портфеля не подтверждены.'
    :currentRows.some(row=>row.hasAmount&&BigInt(row.amountNanos)>0n)?'Подтверждённые суммы меньше масштаба карты. Точные значения — в списке.'
     :'В подтверждённых классах нет положительных сумм для карты.';
  const tileMarkup=tiles.map(row=>{
   const visibleText=row.width>.22&&row.height>.18,compact=row.height<=.3;
   return `<button type="button" class="saved-classes-tile" data-saved-class-tile="${row.key}" data-saved-class-select="${row.key}" data-class="${row.key}" data-labelled="${visibleText}" data-compact="${compact}" style="left:${row.x*100}%;top:${row.y*100}%;width:${row.width*100}%;height:${row.height*100}%" tabindex="-1" aria-hidden="true" title="${esc(labels[row.key]+': '+amount(row.amountNanos)+' · '+percent(row.share))}">${visibleText?'<span>'+esc(shortLabels[row.key])+'</span><strong>'+esc(amount(row.amountNanos))+'</strong>'+(compact?'':'<small>'+esc(percent(row.share))+'</small>'):''}</button>`;
  }).join('');
  const body=blocked?'<p class="saved-classes-empty" role="status">'+esc(blocked)+'</p>':`
   <div class="saved-classes-caption"><p>${esc(account.label||'Выбранный счёт')} · ${esc(date(dto.period.observedAt))}</p><p>${dto.evidence?.dataMode==='synthetic'?'Учебный пример на синтетических данных.':'По локально сохранённому снимку.'} Время состояния у брокера не подтверждено.</p></div>
   ${dto.period.observedBeforeRequestedStart===true?'<p class="saved-classes-note">Снимок сохранён до начала выбранного периода. Это структура на указанную дату, а не её история за период.</p>':''}
   <dl class="saved-classes-nav"><div><dt>Стоимость портфеля · знаменатель долей</dt><dd data-saved-classes-nav title="${esc(available&&dto.nav?.state==='known'?amount(dto.nav.amountNanos):'Нет данных')}">${esc(available&&dto.nav?.state==='known'?amount(dto.nav.amountNanos):'Нет данных')}</dd>${dto.nav?.reason?'<p>'+esc(dto.nav.reason)+'</p>':''}</div></dl>
   <div class="saved-classes-visual"><figure class="saved-classes-figure"><div class="saved-classes-map" data-saved-classes-map aria-label="Площади подтверждённых классов относительно стоимости портфеля">${tileMarkup}${!tiles.length?'<p class="saved-classes-map-empty">'+esc(mapEmpty)+'</p>':''}</div><figcaption>Площадь — доля от стоимости всего портфеля. Пустая часть не определяет состав активов.</figcaption></figure><aside class="saved-classes-detail" data-saved-class-detail aria-labelledby="savedClassDetailTitle" aria-live="polite" aria-atomic="true"></aside></div>
   <table class="saved-classes-table"><caption>Выберите класс на карте или в списке</caption><thead><tr><th scope="col">Класс</th><th scope="col">Сохранённая сумма</th><th scope="col">Доля от NAV</th></tr></thead><tbody>${currentRows.map(row=>`<tr data-saved-class="${row.key}"><th scope="row"><button type="button" data-saved-class-select="${row.key}" data-saved-class-row-select aria-controls="savedClassDetailTitle"><i class="saved-class-swatch" data-class="${row.key}" aria-hidden="true"></i><span>${esc(labels[row.key])}</span></button></th><td data-saved-class-amount title="${esc(row.hasAmount?amount(row.amountNanos):'Нет данных')}">${esc(row.hasAmount?amount(row.amountNanos):'Нет данных')}${!row.hasAmount?'<small>'+esc(row.state==='unsupported'?'Не поддерживается':'Сумма не подтверждена')+'</small>':''}</td><td data-saved-class-share title="${row.share===null?'Нет данных':esc(String(row.share*100)+' %')}">${esc(percent(row.share))}</td></tr>`).join('')}</tbody></table>
   <dl class="saved-classes-totals"><div data-saved-total="known"><dt>Сумма подтверждённых классов</dt><dd title="${esc(available?amount(dto.knownSubtotalNanos):'Нет данных')}">${esc(available?amount(dto.knownSubtotalNanos):'Нет данных')}</dd></div><div data-saved-total="unallocated"><dt>Не распределено по показанным суммам</dt><dd title="${esc(available&&dto.arithmeticState==='known'?amount(dto.unallocatedNAVNanos):'Нет данных')}">${esc(available&&dto.arithmeticState==='known'?amount(dto.unallocatedNAVNanos):'Нет данных')}</dd></div></dl>
   <p class="saved-classes-boundary">Это арифметический остаток NAV за вычетом показанных сумм. Он не означает деньги на счёте, стоимость исключённых классов или остаток финансовой сверки. Ноль не подтверждает полноту распределения риска.</p>
   ${dto.arithmeticReason?'<p class="saved-classes-note">'+esc(dto.arithmeticReason)+'</p>':''}
   <details class="saved-classes-method" data-saved-classes-details="method" ${methodOpen?'open':''}><summary>Источник и метод</summary>
   ${facts([['Выбранный период',date(dto.period.requestedFrom)+' — '+date(dto.period.requestedTo)],['Сохранённый снимок',date(dto.period.observedAt)],['Возраст к концу периода',age(dto.period.ageAtRequestedEndMs)]])}
   <p>Классы прочитаны из того же сохранённого снимка, что и NAV. Пропуски не заполнены суммой позиций или пересчётом валют. Известные классы не растягиваются на всю карту. Очень маленькие ненулевые суммы доступны в списке без увеличения площади.</p>
   ${Array.isArray(dto.coverage.blockers)&&dto.coverage.blockers.length?'<ul class="saved-classes-blockers">'+dto.coverage.blockers.map(row=>'<li>'+esc(reason(row.reason))+'</li>').join(''):''}
   <h4>Классы вне расчёта</h4><ul>${Object.entries(excludedLabels).map(([key,label])=>{
    const row=Array.isArray(dto.excludedClasses)?dto.excludedClasses.find(item=>item.key===key):null;
    const presence=!available?'Исходные сведения не подтверждены':row?.presence==='present'&&row.nonzero===true?'Сохранена ненулевая сумма; исключена из расчёта':row?.presence==='present'&&row.nonzero===false?'Сохранён явный ноль; класс исключён из расчёта':row?.presence==='missing'?'Исходная сумма отсутствует':'Исходная сумма не подтверждена';
    return '<li><strong>'+esc(label)+':</strong> '+esc(presence)+'.</li>';
   }).join('')}</ul><ul>${Array.isArray(dto.coverage.limitations)?dto.coverage.limitations.map(row=>'<li>'+esc(reason(row.reason))+'</li>').join(''):''}</ul></details>`;
  host.innerHTML=`<section class="saved-classes-disclosure" data-saved-classes-details="main" aria-labelledby="savedAssetClassesTitle"><header class="saved-classes-heading"><div><h3 id="savedAssetClassesTitle" tabindex="-1">Где находятся деньги</h3><p>Сохранённая стоимость по классам активов</p></div><span role="status">${available?'Частичный состав':'Данные недоступны'}</span></header><div class="saved-classes-body">${body}</div></section>`;
  selection();
  if(active){
   const target=!changed&&focusedClass?host.querySelector(`[data-saved-class-row-select][data-saved-class-select="${focusedClass}"]`)
    :!changed&&focusedMethod?host.querySelector('[data-saved-classes-details="method"]>summary'):null;
   (target||host.querySelector('#savedAssetClassesTitle'))?.focus({preventScroll:true});
  }
 }
 return {update,dispose(){disposed=true;host?.removeEventListener('click',click);host?.removeEventListener('keydown',keydown);host?.removeEventListener('pointerdown',pointerdown);currentRows=[];}};
}
