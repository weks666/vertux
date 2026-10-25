import { decimalNanos } from './number-format.js';
import { comparePortfolioReviews, REVIEW_METRICS } from './portfolio-review-model.js';
import { REVIEW_ARCHIVE_LIMITS, parseReviewArchive, serializeReviewArchive, validateReviewArchiveResponse } from './portfolio-review-archive-model.js';
const PATH = '/api/portfolio-reviews/archive';
const esc = value => String(value ?? '').replace(/[&<>"']/gu, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const time = value => new Date(value).toLocaleString('ru-RU', {timeZone:'Europe/Moscow'}) + ' мск';
const money = (value, currency='RUB') => value === null ? 'Нет данных' : decimalNanos(value, {digits:9}) + ' ' + (currency === 'RUB' ? '₽' : currency);
const kinds = {
  'new-observation':'Сравниваются разные наблюдения из файла.', 'same-observation':'Даты наблюдения и суммы в этих записях совпадают.',
  'same-date-changed':'Суммы различаются при прежней дате наблюдения. Причина неизвестна; исправление источника не подтверждено.',
  'source-time-regressed':'Вторая запись использует более раннее наблюдение. Денежное сравнение недоступно.',
  'different-method':'Методы различаются или не поддерживаются. Денежное сравнение недоступно.',
  'different-unit':'Валюты несопоставимы. Пересчёт валют не выполняется.', 'different-scope':'Области данных или режимы записей различаются. Сравнение недоступно.'
};
const states = {changed:'Изменение суммы', unchanged:'Сумма не изменилась', 'below-threshold':'Изменение меньше 1 ₽', 'availability-changed':'Изменилась доступность суммы', unknown:'Оба значения неизвестны', 'not-comparable':'Не сопоставимо'};

// File observations remain in this page's memory. This controller has no restore/write transport.
export function createReviewArchiveUi({host, request, getAccess, rejectAccess}) {
  if (!host) return {reset(){},update(){}};
  let operation=0, controller=null, busy=false, archive=null, first=0, last=0, generation=null;
  const urls=new Map();
  host.classList.add('portfolio-reviews','portfolio-review-archive');
  host.dataset.reviewArchive='';
  host.innerHTML=`<details data-review-archive-main><summary><span><strong>Архив обзоров</strong><small>Скачать сохранения или посмотреть файл</small></span></summary><div class="portfolio-review-body">
    <p>Скачайте все сохранившиеся обзоры выбранного счёта — до 10 записей. Более ранние удалённые записи в архив не входят.</p>
    <p>Открытый файл хранится в памяти этой страницы. Его происхождение не подтверждено; суммы из файла не записываются в текущие обзоры или брокерские данные.</p>
    <p class="portfolio-review-caption" data-review-archive-access></p>
    <div class="portfolio-review-controls"><button class="button" type="button" data-review-archive-export>Скачать архив обзоров</button>
    <button class="button" type="button" data-review-archive-clear>Закрыть файл / отменить чтение</button></div>
    <label class="portfolio-review-file">Открыть архив JSON, до 1 МиБ<input type="file" accept=".json,application/json" data-review-archive-file></label>
    <p role="status" aria-live="polite" data-review-archive-status></p>
    <section data-review-archive-viewer hidden aria-label="Непроверенные обзоры из файла"></section>
    </div></details>`;
  const $=selector=>host.querySelector(selector), main=$('[data-review-archive-main]'), input=$('[data-review-archive-file]'), download=$('[data-review-archive-export]'), clear=$('[data-review-archive-clear]'), viewer=$('[data-review-archive-viewer]');
  function say(text){$('[data-review-archive-status]').textContent=text;}
  function releaseUrls(){for(const [url,timer] of urls){clearTimeout(timer);URL.revokeObjectURL(url);}urls.clear();}
  function cancel(){operation++;controller?.abort();controller=null;busy=false;}
  function controls(){const access=getAccess();download.disabled=busy||!access.canExport;input.disabled=busy||!access.canOpen;clear.disabled=!busy&&!archive;
    host.setAttribute('aria-busy',String(busy));
    $('[data-review-archive-access]').textContent=access.canExport?'Скачивание относится к выбранному счёту. Периоды внутри сохранений могут различаться.':access.canOpen?'Файл можно посмотреть здесь. Для скачивания откройте сохранённые обзоры одного счёта в локальном приложении.':'Открытие архива доступно после подтверждения профиля и выбора одного счёта.';
  }
  function reset(){cancel();releaseUrls();archive=null;input.value='';viewer.replaceChildren();viewer.hidden=true;say('');controls();}
  function current(id,access){const next=getAccess();return id===operation&&access.key===next.key&&access.generation===next.generation&&next.canOpen;}
  function rowFacts(row){return `<div><dt>Запись ${row.sequence} · ${row.packet.dataMode==='synthetic'?'синтетический пример':'локальное сохранение (по файлу)'}</dt><dd>Сохранена: ${esc(time(row.recordedAt))}. Наблюдение: ${esc(time(row.packet.observedAt))}.</dd><dd>Выбранный период: ${esc(time(row.packet.selectedPeriod.from))} — ${esc(time(row.packet.selectedPeriod.to))}.</dd><dd>Метод: ${esc(row.packet.method)}. Полнота состава частичная; время источника не подтверждено.</dd>${row.clockRegressed?'<dd>Локальные часы пошли назад. Порядок задан последовательностью сохранения.</dd>':''}</div>`;}
  function facts(rows,comparison){return `<details data-review-archive-facts><summary>Все пять показателей, даты и метод</summary><dl class="portfolio-review-records">${rows.map(rowFacts).join('')}</dl><table><caption>Суммы из непроверенного файла; это не вклады в прибыль</caption><thead><tr><th scope="col">Показатель</th>${rows.map(row=>'<th scope="col">Запись '+row.sequence+'</th>').join('')}</tr></thead><tbody>${REVIEW_METRICS.map(([key,label])=>{
    const item=comparison?.items.find(item=>item.key===key);
    return `<tr data-review-archive-metric="${key}"><th scope="row">${esc(label)}</th>${rows.map(row=>{const amount=row.packet.values.find(value=>value.key===key).amountNanos;return `<td data-value="${esc(amount??'unknown')}">${esc(money(amount,row.packet.currency))}</td>`;}).join('')}</tr>${item?`<tr class="portfolio-review-reason"><td colspan="${rows.length+1}">${esc(states[item.state])}${item.deltaNanos===null?'':': '+esc(money(item.deltaNanos))}.</td></tr>`:''}`;
  }).join('')}</tbody></table></details>`;}
  function compare(){const target=$('[data-review-archive-comparison]');if(!target||!archive)return;
    const rows=archive.records;if(rows.length<2){target.innerHTML=rows.length?'<p>В файле одна запись: второй для сравнения пока нет.</p>'+facts(rows,null):'<p>В этом файле нет сохранённых обзоров.</p>';return;}
    if(first>=last){target.innerHTML='<p role="status">Выберите две разные записи: первая должна быть сохранена раньше второй.</p>';return;}
    const pair=[rows[first],rows[last]],comparison=comparePortfolioReviews(pair[0].packet,pair[1].packet);
    target.innerHTML=`<h4>Изменения между записями файла</h4><p>${esc(kinds[comparison.kind])}</p>${comparison.comparable?`<p>Значимых изменений: ${comparison.changedCount}. Показано: ${comparison.cards.length}. Сопоставимых денежных пар: ${comparison.knownPairCount} из 5. Неизвестные значения не равны нулю.</p>`:''}
      ${comparison.cards.length?'<ol class="portfolio-review-changes">'+comparison.cards.map(item=>`<li data-review-archive-change="${item.key}"><strong>${esc(item.label)}</strong><p>Было: ${esc(money(item.before.amountNanos,pair[0].packet.currency))}. Стало: ${esc(money(item.after.amountNanos,pair[1].packet.currency))}.</p><p>${item.deltaNanos===null?'Изменилась доступность суммы; денежная разность неизвестна.':'Изменение: <span data-value="'+esc(item.deltaNanos)+'">'+esc(money(item.deltaNanos))+'</span>'}</p></li>`).join('')+'</ol>':''}${facts(pair,comparison)}`;
  }
  function render(){viewer.hidden=false;const rows=archive.records;first=Math.max(0,rows.length-2);last=Math.max(0,rows.length-1);
    viewer.innerHTML=`<h4>Обзоры из файла · происхождение не подтверждено</h4><p>Записей: ${rows.length} из 10. Файл создан по локальным часам: ${esc(time(archive.exportedAt))}. Более ранняя история не включена.</p><p>Изменение стоимости не означает инвестиционную прибыль. Денежные потоки, причины и рыночная доходность здесь не рассчитаны.</p>
    ${rows.length>1?'<div class="portfolio-review-archive-selectors">'+['Первая запись','Вторая запись'].map((label,index)=>`<label>${label}<select data-review-archive-pair="${index}">${rows.map((row,i)=>`<option value="${i}" ${i===(index?last:first)?'selected':''}>Запись ${row.sequence} · ${esc(time(row.recordedAt))}</option>`).join('')}</select></label>`).join('')+'</div>':''}<div class="portfolio-review-comparison" data-review-archive-comparison></div>`;
    compare();controls();
  }
  viewer.addEventListener('change',event=>{const index=event.target.dataset.reviewArchivePair;if(!['0','1'].includes(index)||!archive)return;const value=Number(event.target.value);if(!Number.isInteger(value)||!archive.records[value])return;if(index==='0')first=value;else last=value;compare();});
  input.addEventListener('change',async()=>{const file=input.files?.[0],access=getAccess();if(!file||!access.canOpen||busy)return;
    cancel();archive=null;viewer.replaceChildren();viewer.hidden=true;const id=operation;busy=true;controls();say('Читаем файл…');
    try{if(file.size>REVIEW_ARCHIVE_LIMITS.bytes)throw Error('Size');const text=await file.text();if(!current(id,access))return;archive=parseReviewArchive(text);render();say('Файл открыт для просмотра. Происхождение данных не подтверждено.');}
    catch{if(current(id,access))say('Не удалось открыть целый архив. Проверьте формат файла, версию и размер до 1 МиБ.');}
    finally{if(id===operation){busy=false;input.value='';controls();}}
  });
  download.addEventListener('click',async()=>{const access=getAccess();if(!access.canExport||busy)return;cancel();const id=operation;controller=new AbortController();busy=true;controls();say('Проверяем все сохранившиеся обзоры…');
    try{const result=await request(PATH+'?'+new URLSearchParams(access.query),{method:'GET',signal:controller.signal});if(!current(id,access)||!getAccess().canExport)return;
      if(!validateReviewArchiveResponse(result,access.query,access.scopeKey))throw Error('Archive response');
      const text=serializeReviewArchive(result.archive),url=URL.createObjectURL(new Blob([text],{type:'application/json'}));releaseUrls();const link=document.createElement('a');link.dataset.reviewArchiveDownload='';link.href=url;link.download='vertux-portfolio-reviews-v1.json';link.hidden=true;host.append(link);link.click();link.remove();urls.set(url,setTimeout(()=>{URL.revokeObjectURL(url);urls.delete(url);},45000));
      say('Архив подготовлен к скачиванию. Записей: '+result.archive.records.length+'.');
    }catch(error){if(current(id,access)){if([401,403].includes(error?.status))rejectAccess();else say('Не удалось подготовить целый архив. Перепроверьте сохранённые обзоры и повторите скачивание.');}}
    finally{if(id===operation){busy=false;controller=null;controls();}}
  });
  clear.addEventListener('click',()=>{reset();say('Файл закрыт, чтение отменено. Текущие данные не изменены.');input.focus();});
  main.addEventListener('toggle',()=>{if(!main.open)reset();});
  host.addEventListener('keydown',event=>{if(event.key==='Escape'&&main.open){event.preventDefault();reset();main.open=false;main.querySelector(':scope>summary').focus();}});
  host.addEventListener('focusin',event=>{const target=event.target;if(!target.matches?.('summary,button,input,select'))return;const top=document.querySelector('.topbar')?.getBoundingClientRect().bottom||0;target.style.scrollMarginTop=Math.ceil(top+12)+'px';const rect=target.getBoundingClientRect();if(rect.top<top+4||rect.bottom>innerHeight-4)target.scrollIntoView({block:'nearest',behavior:'instant'});});
  window.addEventListener('pagehide',reset);
  return {reset,setActive(value){if(value)main.open=true;},update(){const next=getAccess();if(generation!==next.generation){generation=next.generation;if(busy){cancel();say('Данные изменились. Повторите действие.');}}controls();}};
}
