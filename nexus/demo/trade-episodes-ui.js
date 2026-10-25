import {decimalNanos} from './number-format.js';
import {renderContextEvidence} from './context-evidence.js';
import {buildTradingContextEvidence} from './context-evidence-adapters.js';
import {readTradeGroupReview,resolveTradeGroupRows} from './trade-group-review.js';
import {validExecutionQuantity} from './execution-quantity-contract.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const known=value=>typeof value==='string'&&/^-?\d+$/.test(value);
const count=value=>Number.isSafeInteger(value)&&value>=0?String(value):'Нет данных';
const decimal=value=>known(value)?decimalNanos(value,{digits:9}):'Нет данных';
const money=(value,currency)=>known(value)&&typeof currency==='string'&&/^[A-Z]{3}$/.test(currency)?decimal(value)+' '+(currency==='RUB'?'₽':currency):'Нет данных';
const meanMoney=(value,currency,row)=>row?.meanPrecision==='below-nano'?(row.meanSign==='positive'?'> 0, < 0,000000001 ₽':row.meanSign==='negative'?'> −0,000000001 ₽, < 0':'Нет данных'):row?.meanPrecision==='rounded-to-nano'?'≈ '+money(value,currency):money(value,currency);
const date=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'})+' мск':'Нет данных';
const reasons=rows=>Array.isArray(rows)&&rows.length?'<ul class="episodes-reasons">'+[...new Set(rows.map(row=>row?.message).filter(value=>typeof value==='string'&&value))].map(value=>'<li>'+esc(value)+'</li>').join('')+'</ul>':'';
const fact=(label,value,key='')=>`<div${key?` data-episode-metric="${key}"`:''}><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
const range=dto=>date(dto.requestedPeriod?.from)+' — '+date(dto.requestedPeriod?.to);
const displayRatio=(value,digits,suffix)=>{if(!Number.isFinite(value)||value<0)return 'Нет данных';const minimum=10**-digits;if(value>0&&value<minimum)return '<'+minimum.toLocaleString('ru-RU',{maximumFractionDigits:digits})+suffix;const rounded=Math.round(value*10**digits)/10**digits;return (rounded!==value?'≈ ':'')+value.toLocaleString('ru-RU',{maximumFractionDigits:digits})+suffix;};
const holding=value=>Number.isSafeInteger(value)&&value>=0?value>0&&value<60000?displayRatio(value/1000,3,' с'):displayRatio(value/86400000,3,' д'):'Нет данных';
const dimensions={instrument:'По инструменту',holding:'По сроку удержания','scale-out':'По частичным выходам'};
const buckets={'under-24h':'Менее 24 часов','24h-to-48h':'От 24 до 48 часов включительно','over-48h':'Более 48 часов','partial-exits':'С частичными выходами','single-exit':'Один окончательный выход'};
const kinds={closed:'Закрытые эпизоды',open:'Открытые на конец периода',incomplete:'Участки с неполными данными',observations:'Наблюдения состава',costs:'Нераспределённые расходы'};
const PAGE_SIZE=20;
const periodRole=row=>row?.periodRole==='before-period-basis'?'До выбранного периода · контекст исходной позиции':row?.periodRole==='requested-period'?'В выбранном периоде':'Принадлежность периоду не подтверждена';

/** Public DTO presentation only: no reconstruction, monetary arithmetic, or rates. */
export function createTradeEpisodesUi({host,onOpenChart,chartAvailability=()=>({available:false,reason:'Инструмент отсутствует в доступном каталоге.'})}){
 let current,signature='',scope='',view='home',kind='closed',group=null,selected=-1,dimension='instrument',reviewSelection='group',pages={},openKeys=new Set();
 const focusSelector=key=>`[data-episode-focus="${CSS.escape(key)}"]`;
 const label=uid=>{const matches=(current?.instruments||[]).filter(row=>row.instrumentUid===uid);return matches.length===1?[matches[0].ticker,matches[0].name].filter(Boolean).join(' · ')||'Инструмент без названия':'Инструмент не найден в текущем каталоге';};
 const button=(text,action,value='',focus=action+':'+value)=>`<button type="button" data-episode-action="${action}" data-episode-value="${esc(value)}" data-episode-focus="${esc(focus)}">${esc(text)}</button>`;
 const disclosure=(key,title,body)=>`<details data-episode-open="${esc(key)}" ${openKeys.has(key)?'open':''}><summary data-episode-focus="summary:${esc(key)}">${esc(title)}</summary>${body}</details>`;
 function pageRows(key,rows,render){
  const page=pages[key]=Math.max(0,Math.min(pages[key]||0,Math.max(0,Math.ceil(rows.length/PAGE_SIZE)-1))),start=page*PAGE_SIZE;
  return render(rows.slice(start,start+PAGE_SIZE),start)+(rows.length>PAGE_SIZE?`<nav class="episodes-pagination" aria-label="Страницы: ${esc(key==='rows'?kinds[kind]:key==='groups'?'группы':key==='executions'?'исполнения':key==='realizations'?'выходы':key==='path'?'изменения количества':'сопоставления FIFO')}"><span role="status">${start+1}–${Math.min(start+PAGE_SIZE,rows.length)} из ${rows.length}</span>${[-1,1].map(step=>`<button type="button" data-episode-action="page" data-episode-value="${esc(key)}:${step}" data-episode-focus="page:${esc(key)}:${step}" ${step<0?page===0?'disabled':'':start+PAGE_SIZE>=rows.length?'disabled':''}>${step<0?'Назад':'Дальше'}</button>`).join('')}</nav>`:'');
 }
 function source(row){
  const base=(row.sourceState==='verified'?'Поля сверены с сохранённым исполнением.':row.sourceState==='unverified'?'Поля исполнения не подтверждены.':'Сохранённая запись.')+(Number.isSafeInteger(row.sourceRef?.revision)?' Ревизия '+row.sourceRef.revision+'.':'')+(row.sourceState==='verified'&&row.costState==='known'&&known(row.signedCommissionNanos)&&BigInt(row.signedCommissionNanos)<=0n&&row.commissionBasis==='matched-saved-postings'?' Комиссия сверена со связанными списаниями и учтена один раз.':'');
  if(row.executionQuantity===undefined)return base;
  const quantity=row.executionQuantity;
  if(row.sourceState!=='verified'||!validExecutionQuantity(quantity)||!known(row.quantityNanos)||BigInt(row.quantityNanos)<=0n||BigInt(row.quantityNanos)>BigInt(quantity.executedNanos))return base+' Сведения об объёме поручения не подтверждены.';
  return base+(quantity.state==='partial'?' Поручение исполнено частично: '+decimal(quantity.executedNanos)+' из '+decimal(quantity.reportedNanos)+' ед.; не исполнено '+decimal(quantity.remainingNanos)+' ед. Сведения относятся ко всему поручению, количество в строке — к отдельному исполнению.':'');
 }
 function table(headers,body,title){return `<p class="episodes-scroll-note">Таблицу можно прокручивать по горизонтали.</p><div class="episodes-table-scroll" tabindex="0" aria-label="${esc(title)}; доступна горизонтальная прокрутка"><table><thead><tr>${headers.map(text=>'<th>'+esc(text)+'</th>').join('')}</tr></thead><tbody>${body}</tbody></table></div>`;}
 function rowsFor(dto){
  if(kind==='open')return dto.openEpisodes||[];if(kind==='incomplete')return dto.incomplete||[];if(kind==='observations')return dto.observations||[];if(kind==='costs')return dto.unallocatedCosts||[];
  if(group&&reviewSelection!=='group')return resolveTradeGroupRows(dto,group,reviewSelection)||[];
  return group?(dto.episodes||[]).filter(row=>row.eligible===true&&group.episodeKeys?.includes(row.episodeKey)):dto.episodes||[];
 }
 function method(dto){return disclosure('method','Метод, источник и ограничения',`<p>Эпизод позиции начинается с подтверждённого нулевого количества и заканчивается возвратом в ноль. Пополнения позиции и частичные выходы входят в один эпизод. Поддержаны длинные позиции в обычных акциях, рубли.</p><p>Отбор закрытых эпизодов — по окончательному закрытию в выбранном периоде. Результат включает весь срок эпизода, в том числе исполнения до начала периода; он не равен денежному результату портфеля или сумме выходов за месяц.</p><p>Результат после учтённых комиссий исполнений = результат изменения цен по FIFO + комиссии со знаком. Подтверждённое списание отрицательно. Неизвестная комиссия не равна нулю.</p><p>Отдельные брокерские списания распределяются по стоимости фактических исполнений, когда их связь с поручением, сумма и валюта подтверждены и совпадают с описанием комиссии. Расход учитывается один раз. Проверяются все сохранённые сведения о поручении, в том числе списания за пределами выбранного периода; это не состояние на историческую дату. В денежной истории списания сохраняют собственные даты.</p><p>Налоги, финансирование, дивиденды и расходы счёта не входят в этот результат. Результат до налогов не является результатом после всех расходов. Нераспределённые расходы показаны отдельно.</p><p>Доля прибыльных = прибыльные / все включённые закрытые эпизоды, включая нулевые. Profit Factor = сумма положительных результатов / модуль суммы отрицательных. Без убыточных эпизодов конечного отношения нет.</p><p>Среднее округляется до 0,000000001 ₽; знак ≈ показывает округление. Ненулевое среднее меньше этой точности показано интервалом, без замены нулём. Группы описывают эту выборку. Размеры позиций и рыночные условия различаются; ни сумма, ни среднее не доказывают преимущество инструмента или метода выхода. Число дат закрытия — календарные даты Москвы, не число независимых наблюдений.</p><p>История исполнений: ${dto.coverage?.history==='complete-saved-range'?'покрыт сохранённый диапазон':'полнота не подтверждена'}. Полнота изменений количества: ${dto.coverage?.quantityEvents==='complete'?'подтверждена для расчёта':'не подтверждена'}.</p><p>Независимая денежная сверка не выполнена.</p>${reasons(dto.reasons)}${reasons(dto.costReasons)}`);}
 function sourceHistory(dto){return `<p class="episodes-history">История исходных записей: ${esc(date(dto.sourceHistory?.from))} — ${esc(date(dto.sourceHistory?.to))}. Исполнений в выбранном периоде: ${count(dto.coverage?.executionsInRequestedPeriod)}; до начала периода: ${count(dto.coverage?.executionsBeforeRequestedPeriod)}; с неизвестным временем: ${count(dto.coverage?.executionsUnknownTime)}. Более ранние записи показаны как контекст исходной позиции.</p>`;}
 function summary(dto){
  const stats=dto.statistics,valid=stats?.state==='ready'&&stats.calculationSnapshotId===dto.calculationSnapshotId;
  const rate=valid?displayRatio(stats.winRate===null?null:stats.winRate*100,2,'%'):'Нет данных';
  const pf=valid&&stats.profitFactorState==='infinite'?'Нет убыточных эпизодов':valid&&stats.profitFactorState==='finite'?displayRatio(stats.profitFactor,4,' ×'):'Нет данных';
  return `<dl class="episodes-counts">${[['Включено закрытых',dto.coverage?.closedEligible],['Всего наблюдаемых закрытых',dto.coverage?.closedObserved],['Открыто на конец периода',dto.coverage?.openAtCutoff],['Неполных участков',dto.coverage?.incomplete],['Исключено из статистики',dto.coverage?.excluded],['Наблюдаемых исполнений до конца периода',dto.coverage?.executionsObserved]].map(([text,value])=>fact(text,count(value))).join('')}</dl><dl class="episodes-statistics">${fact('Результат после учтённых комиссий',money(valid?stats.sumNetNanos:null,'RUB'),'sum')}${fact('Средний результат эпизода',meanMoney(valid?stats.meanNetNanos:null,'RUB',valid?stats:null),'mean')}${fact('Доля прибыльных эпизодов',rate,'win-rate')}${fact('Profit Factor',pf,'profit-factor')}</dl><p class="episodes-note">${valid?`Выборка: ${count(stats.n)} эпизодов; прибыльных ${count(stats.wins)}, убыточных ${count(stats.losses)}, с нулевым результатом ${count(stats.breakeven)}.`:'Для статистики пока нет закрытых эпизодов с достаточными данными.'} Только включённые закрытые эпизоды. До налогов.</p>${stats?.profitFactorReason?reasons([stats.profitFactorReason]):''}${sourceHistory(dto)}`;
 }
 function home(dto){
  const groups=(dto.cohorts||[]).filter(row=>row.dimension===dimension&&row.state==='descriptive'&&row.calculationSnapshotId===dto.calculationSnapshotId);
  return `<h4 tabindex="-1" data-episode-focus="content">Группы закрытых эпизодов</h4><label class="episodes-dimension"><span>Описательный разрез</span><select data-episode-dimension data-episode-focus="dimension">${Object.entries(dimensions).map(([value,title])=>`<option value="${value}" ${value===dimension?'selected':''}>${title}</option>`).join('')}</select></label><p class="episodes-note">Фиксированные группы без рейтинга. Период по окончательному закрытию: ${esc(range(dto))}.</p>${groups.length?pageRows('groups',groups,(slice,start)=>'<ul class="episodes-groups">'+slice.map((row,index)=>`<li>${button(row.dimension==='instrument'?label(row.bucket):buckets[row.bucket]||'Группа', 'group',start+index)}<dl>${fact('Эпизодов',count(row.n))}${fact('Сумма после учтённых комиссий',money(row.sumNanos,row.currency))}${fact('Средний результат',meanMoney(row.meanNanos,row.currency,row))}${fact('Различных инструментов',count(row.distinctInstrumentCount))}${fact('Дат закрытия · мск',count(row.distinctCloseCalendarDays))}</dl></li>`).join('')+'</ul>'):'<p class="episodes-empty">Группы недоступны: нет включённых закрытых эпизодов. Наблюдаемые исполнения и причины доступны ниже.</p>'+reasons(dto.cohortReasons)}<nav class="episodes-observed" aria-label="Проверить исходную историю">${Object.keys(kinds).map(key=>button(kinds[key],'list',key)).join('')}</nav>`;
 }
 const reviewLabels={group:'Выбранная группа',baseline:'Остальные включённые эпизоды',retained:'Группа без одного эпизода',removed:'Исключённый для проверки эпизод'};
 const reviewMean=value=>value?meanMoney(value.roundedNanos,'RUB',{meanPrecision:value.precision,meanSign:value.sign}):'Нет данных';
 function review(dto){
  const packet=readTradeGroupReview(dto,group,current.accounts?.length===1?current.accounts[0].id:null);
  if(!packet)return `<p class="episodes-note" data-group-review-unavailable>Разбор группы недоступен: основания не подтверждены для текущего расчёта. Обновите данные и откройте группу заново. Состав и сохранённые исполнения доступны ниже.</p>`;
  const samples=[['group',packet.group],['baseline',packet.baseline],['retained',packet.sensitivity.retained]];
  return disclosure('group-review','Разбор группы',`<div class="episodes-review" data-group-review>
   <p>В группе ${count(packet.group.n)} эпизодов: прибыльных ${count(packet.group.wins)}, убыточных ${count(packet.group.losses)}, с нулевым результатом ${count(packet.group.breakeven)}. Результат изменения цен ${esc(money(packet.group.grossNanos,'RUB'))} и комиссии исполнений ${esc(money(packet.group.costsNanos,'RUB'))} дают ${esc(money(packet.group.netNanos,'RUB'))} до налогов.</p>
   <p>Сравнение использует остальные включённые закрытые эпизоды того же счёта и периода, без выбранной группы. Размеры позиций, сроки и рыночные условия не выровнены; это сравнение денежных сумм, а не доходности или торгового преимущества.</p>
   ${samples.map(([key,value])=>`<section class="episodes-review-sample" data-review-sample="${key}"><h5>${reviewLabels[key]}</h5><dl>${fact('Эпизодов',count(value.n))}${fact('Результат после учтённых комиссий',money(value.netNanos,'RUB'))}${fact('Средний результат эпизода',reviewMean(value.mean))}</dl>${value.n?button('Открыть эпизоды: '+reviewLabels[key].toLowerCase(),'review-rows',key):'<p>Нет эпизодов для этой проверки. Денежный результат не определён.</p>'}</section>`).join('')}
   <p data-review-difference>Среднее группы минус среднее остальных: ${esc(reviewMean(packet.meanDifference))}.${packet.baseline.n?'':' Сравнение недоступно: других включённых эпизодов нет.'}</p>
   <p>Из группы временно исключён один эпизод с наибольшим результатом по модулю: ${esc(money(packet.sensitivity.removedNetNanos,'RUB'))}. Это проверка зависимости суммы от одной записи, а не обнаружение статистического выброса.${packet.sensitivity.tiedLargestCount>1?` Одинаковый модуль у ${count(packet.sensitivity.tiedLargestCount)} эпизодов; выбран самый ранний по закрытию, при равном времени — по постоянному ключу записи.`:''}</p>
   ${button('Открыть исключённый для проверки эпизод','review-rows','removed')}
   <p>Устойчивость не установлена. Независимость наблюдений не подтверждена; контрольная выборка и проверка по рыночным режимам не выполнены. Частичные выходы не становятся отдельными эпизодами. Налоги, финансирование, дивиденды и нераспределённые расходы не включены.</p>
  </div>`);
 }
 function listing(dto){
  const rows=rowsFor(dto),title=group?(group.dimension==='instrument'?label(group.bucket):buckets[group.bucket]||'Группа'):kinds[kind];
  return `${button('К группам','home')}<h4 tabindex="-1" data-episode-focus="content">${esc(title)}</h4><p class="episodes-note">${kind==='closed'?'Отбор по окончательному закрытию: ':kind==='open'?'Состояние на конец выбранного периода: ':'Сохранённые наблюдения до конца выбранного периода: '}${esc(kind==='closed'?range(dto):date(dto.cutoff))}. Записей: ${rows.length}.</p>${group?'<dl class="episodes-group-summary">'+fact('Эпизодов в группе',count(group.n))+fact('Сумма группы после учтённых комиссий',money(group.sumNanos,group.currency))+fact('Средний результат группы',meanMoney(group.meanNanos,group.currency,group))+fact('Различных инструментов',count(group.distinctInstrumentCount))+fact('Дат закрытия · мск',count(group.distinctCloseCalendarDays))+'</dl>'+review(dto)+`<p class="episodes-review-selection" role="status" tabindex="-1" data-episode-focus="review-list">Проверяемая выборка: ${reviewLabels[reviewSelection]}. Записей: ${rows.length}.</p>`:''}${rows.length?pageRows('rows',rows,(slice,start)=>'<ol class="episodes-rows">'+slice.map((row,index)=>`<li>${button(kind==='costs'?'Расход счёта':label(row.instrumentUid),'detail',start+index)}<span>${esc(kind==='closed'?'Закрытие: '+date(row.closedAt):kind==='open'?'Открытие: '+date(row.openedAt):kind==='incomplete'?'Начало и результат не подтверждены':date(row.at))}</span><strong>${esc(kind==='closed'?money(row.executionNetPnlNanos,row.currency):kind==='open'?'Остаток: '+decimal(row.remainingQuantityNanos):kind==='costs'?money(row.signedNanos,row.currency):kind==='observations'?'Наблюдаемое количество: '+decimal(row.quantityNanos):(dto.coverage?.executionsObserved===null?'Проверенных строк: ':'Исполнений: ')+count(row.executions?.length))}</strong>${kind==='closed'&&!row.eligible?'<small>Не включён в статистику</small>':''}</li>`).join('')+'</ol>'):'<p class="episodes-empty">В этом разделе нет доступных записей. Это не подтверждает отсутствие всей истории.</p>'}`;
 }
 function detail(dto){
  const row=rowsFor(dto)[selected];if(!row){view='list';return listing(dto);}
  const title=kind==='costs'?'Расход счёта':label(row.instrumentUid),ccy=row.currency||dto.scope?.currency;
  const chart=row.instrumentUid&&onOpenChart?button('График инструмента','chart','','chart'):'';
  let body=`<div class="episodes-detail-actions">${button('К списку','back')}${chart}</div><h4 tabindex="-1" data-episode-focus="content">${esc(title)}</h4>`;
  if(kind==='observations')return body+`<dl class="episodes-facts">${fact('Время наблюдения',date(row.at))}${fact('Наблюдаемое количество',decimal(row.quantityNanos))}</dl><p>${esc(periodRole(row))}.</p><p>Сохранённое наблюдение состава. Время наблюдения клиентом не подтверждает точное время состояния у брокера. Этот остаток не доказывает нулевую границу эпизода.</p>${reasons(row.reasons)}`;
  if(kind==='costs')return body+`<dl class="episodes-facts">${fact('Дата',date(row.at))}${fact('Сумма со знаком',money(row.signedNanos,row.currency))}</dl><p>${esc(periodRole(row))}.</p><p>Не включён в результат эпизодов; распределение не подтверждено.</p>${reasons(row.reasons)}`;
  body+=`<p class="episodes-note">${kind==='incomplete'?'Неполный участок истории. Он не входит в группы закрытых эпизодов.':kind==='open'?'Открыт на конец выбранного периода. Итог закрытого эпизода и исход прибыль/убыток ещё не определены.':row.eligible?'Закрытый эпизод включён в описательную статистику.':'Закрытый эпизод исключён из описательной статистики.'}</p><dl class="episodes-facts">${fact('Первое открытие',date(row.openedAt))}${fact('Окончательное закрытие',date(row.closedAt))}${fact('Срок закрытого эпизода',holding(row.holdingMs))}${fact('Результат изменения цен',money(row.grossPnlNanos,ccy),'gross')}${fact('Комиссии исполнений со знаком',money(row.signedExecutionCostsNanos,ccy),'costs')}${fact('Результат после учтённых комиссий',money(row.executionNetPnlNanos,ccy),'net')}${kind==='open'?fact('Остаток на конец периода',decimal(row.remainingQuantityNanos),'remaining')+fact('Уже реализовано после учтённых комиссий',money(row.realizedNetPnlNanos,ccy),'realized')+fact('Оставшиеся комиссии входа',money(row.remainingEntryCostsNanos,ccy),'remaining-costs'):''}</dl>${reasons(row.reasons)}`;
  const executions=Array.isArray(row.executions)?row.executions:[];
  const traceLink=(source,context)=>{const index=executions.findIndex(fill=>fill.sourceRef?.ref&&fill.sourceRef.ref===source?.ref);return index>=0?button('Исполнение '+(index+1),'execution',index,'trace:'+context+':'+index):'Сопоставленное исполнение не передано';};
  body+=disclosure('executions',(dto.coverage?.executionsObserved===null?'Проверенные строки исполнения · ':'Исполнения · ')+executions.length,pageRows('executions',executions,(slice,start)=>table(['Исполнение','Время · мск','Количество','Цена','Комиссия со знаком','Источник'],slice.map((fill,index)=>`<tr><td><span tabindex="-1" data-episode-focus="execution:${start+index}">${start+index+1}.</span> ${fill.side==='buy'?'Покупка':fill.side==='sell'?'Продажа':'Сторона неизвестна'}${fill.split?'<small>Часть исполнения при пересечении нуля</small>':''}</td><td>${esc(date(fill.at))}<small>${esc(periodRole(fill))}</small></td><td>${esc(decimal(fill.quantityNanos))}<small>${fill.quantityUnit==='instrument-units'?'Единицы инструмента':'Единица источника не подтверждена'}</small></td><td>${esc(fill.priceUnit==='currency'?money(fill.priceNanos,fill.currency):'Нет данных')}</td><td>${esc(fill.costState==='known'?money(fill.signedCommissionNanos,fill.currency):'Нет данных')}</td><td class="episodes-execution-source">${esc(source(fill))}${reasons(fill.reasons)}</td></tr>`).join(''),'Исполнения')));
  const realizations=Array.isArray(row.realizations)?row.realizations:[];
  body+=disclosure('realizations','Выходы и FIFO · '+realizations.length,pageRows('realizations',realizations,(slice,start)=>slice.map((sale,index)=>`<article class="episodes-realization"><h5>Выход ${start+index+1} · ${esc(date(sale.at))}</h5><p class="episodes-note">${esc(periodRole(sale))}</p>${traceLink(sale.sourceRef,'sale:'+(start+index))}<dl class="episodes-facts">${fact('Количество выхода',decimal(sale.quantityNanos))}${Object.hasOwn(sale,'proceedsNanos')?fact('Известная выручка продажи',money(sale.proceedsNanos,sale.currency),'proceeds'):''}${fact('Результат изменения цен',money(sale.grossPnlNanos,ccy))}${fact('Результат выхода после комиссий',money(sale.executionNetPnlNanos,ccy))}${fact('Учтённые комиссии входа и выхода',money(sale.signedExecutionCostsNanos,ccy))}</dl>${kind==='incomplete'?'<p>Выручка продажи не является прибылью: стоимость входа неизвестна.</p>':''}${reasons(sale.reasons)}${Array.isArray(sale.matches)&&sale.matches.length?disclosure('matches-'+(start+index),'Сопоставления FIFO · '+sale.matches.length,pageRows('matches-'+(start+index),sale.matches,matches=>table(['Вход','Количество','Стоимость входа','Комиссия входа'],matches.map((match,matchIndex)=>`<tr><td>${esc(date(match.openedAt))}${traceLink(match.sourceRef,'match:'+(start+index)+':'+matchIndex)}</td><td>${esc(decimal(match.quantityNanos))}</td><td>${esc(money(match.acquisitionAmountNanos,ccy))}</td><td>${esc(money(match.signedEntryCostsNanos,ccy))}</td></tr>`).join(''),'Сопоставления FIFO'))):'<p>Подтверждённых сопоставлений стоимости входа нет.</p>'}</article>`).join('')));
  if(Array.isArray(row.quantityPath)&&row.quantityPath.length)body+=disclosure('path','Изменения количества',pageRows('path',row.quantityPath,slice=>table(['Время исполнения','Количество после исполнения'],slice.map(point=>`<tr><td>${esc(date(point.at))}</td><td>${esc(decimal(point.quantityNanos))}</td></tr>`).join(''),'Изменения количества')));
  return body;
 }
 function render({focusKey,scopeChanged=false,resetDetails=false,reveal=null}={}){
  const {dto,accounts=[]}=current||{},valid=dto?.version==='trade-episodes-v1',account=valid&&accounts.length===1&&accounts[0]?.id===dto.scope?.portfolioId?accounts[0]:null;
  const eligible=Boolean(account)&&dto.scope?.currency==='RUB',active=host.contains(document.activeElement)?document.activeElement:null,oldFocus=active?.dataset.episodeFocus;
  if(!scopeChanged)openKeys=new Set([...host.querySelectorAll('details[open][data-episode-open]')].map(el=>el.dataset.episodeOpen));
  if(resetDetails)openKeys=new Set(['executions']);if(reveal)openKeys.add(reveal);
  host.classList.add('trade-episodes');host.dataset.state=eligible?dto.state:'unavailable';
  host.innerHTML=`<header class="episodes-heading"><h3 tabindex="-1" data-episode-focus="heading">Эпизоды позиций</h3><p>${eligible?esc(account.label||'Выбранный счёт')+' · '+esc(range(dto)):'Выберите один счёт для анализа эпизодов.'}</p></header>${!eligible?'<p class="episodes-empty">'+(accounts.length>1?'Компоненты разных счетов не объединяются. Выберите один счёт в поле «Счёт портфеля».':valid?'Данные эпизодов не соответствуют выбранному счёту или валюте.':'Для выбранного счёта и периода данные эпизодов пока недоступны.')+'</p>':`<p class="episodes-evidence">${dto.evidence?.dataMode==='synthetic'?'Учебный пример на синтетических данных.':'Расчёт по локально сохранённым данным.'} ${dto.state==='partial'?'История имеет ограничения; известные исполнения доступны для проверки.':dto.state==='unavailable'?'Исходных данных недостаточно.':dto.state==='empty'?'В сохранённой выборке нет эпизодов.':''}</p>${view==='home'?summary(dto):disclosure('overview','Сводка выбранной выборки',summary(dto))}<section class="episodes-content">${view==='home'?home(dto):view==='list'?listing(dto):detail(dto)}</section>${method(dto)}`}`;
  if(eligible)host.insertAdjacentHTML('beforeend',renderContextEvidence(buildTradingContextEvidence(dto,account,group&&view!=='home'?readTradeGroupReview(dto,group,account.id):null)));
  refreshChartActions();
  const key=scopeChanged?'heading':focusKey||oldFocus;
  if(key&&(active||focusKey)){
   let target=host.querySelector(focusSelector(key)+':not(:disabled)');
   if(!target&&key.startsWith('page:'))target=host.querySelector(`[data-episode-focus^="${CSS.escape(key.slice(0,key.lastIndexOf(':')+1))}"]:not(:disabled)`);
   target||=host.querySelector(focusSelector(scopeChanged?'heading':'content'))||host.querySelector(focusSelector('heading'));
   // The account/date bar wraps on narrow viewports; its visible height is
   // larger than the component's standalone 90px scroll margin.
   const topbar=host.ownerDocument.querySelector('.topbar');
   if(target&&topbar)target.style.scrollMarginTop=Math.ceil(topbar.getBoundingClientRect().height+12)+'px';
   target?.focus({preventScroll:true});if(focusKey||scopeChanged)target?.scrollIntoView({block:key==='review-list'?'start':'nearest',behavior:'instant'});
  }
 }
 function refreshChartActions(){
  const target=host?.querySelector('[data-episode-action="chart"]');if(!target)return;
  const row=view==='detail'?rowsFor(current.dto)[selected]:null,availability=chartAvailability(row?.instrumentUid);
  target.disabled=!row||!availability.available;target.title=availability.available?'График инструмента в терминале':availability.reason;
 }
 host?.addEventListener('change',event=>{if(!event.target.matches('[data-episode-dimension]'))return;dimension=event.target.value;pages.groups=0;render({focusKey:'dimension'});});
 host?.addEventListener('click',event=>{
  const target=event.target.closest('[data-episode-action]');if(!target||target.disabled)return;
  const action=target.dataset.episodeAction,value=target.dataset.episodeValue;let focusKey='content';
  if(action==='chart'){
   const row=rowsFor(current.dto)[selected],originScope=scope,originKind=kind,originSelected=selected,rowKey=JSON.stringify(row);
   const isCurrent=()=>scope===originScope&&view==='detail'&&kind===originKind&&selected===originSelected&&JSON.stringify(rowsFor(current.dto)[selected])===rowKey;
   if(row&&isCurrent()&&chartAvailability(row.instrumentUid).available)onOpenChart?.(row.instrumentUid,{route:'trading',label:'К эпизоду',fallbackLabel:'К сделкам',isCurrent,restoreFocus:()=>{
    const button=host.querySelector('[data-episode-action="chart"]');if(!isCurrent()||!button||button.disabled||!button.getClientRects().length)return false;
    button.scrollIntoView({block:'center',behavior:'instant'});button.focus({preventScroll:true});return true;
   }});
   return;
  }
  if(action==='group'){group=(current.dto.cohorts||[]).filter(row=>row.dimension===dimension&&row.state==='descriptive'&&row.calculationSnapshotId===current.dto.calculationSnapshotId)[Number(value)];kind='closed';view='list';reviewSelection='group';pages.rows=0;}
  if(action==='review-rows'&&group&&resolveTradeGroupRows(current.dto,group,value)){reviewSelection=value;view='list';selected=-1;pages.rows=0;focusKey='review-list';}
  if(action==='list'){kind=value;group=null;view='list';pages.rows=0;}
  if(action==='detail'){selected=Number(value);view='detail';for(const key of Object.keys(pages))if(key!=='rows'&&key!=='groups')delete pages[key];openKeys.clear();}
  if(action==='execution'){pages.executions=Math.floor(Number(value)/PAGE_SIZE);openKeys.add('executions');focusKey='execution:'+value;}
  if(action==='back'){view='list';focusKey='detail:'+selected;}
  if(action==='home'){view='home';focusKey=group?'group:'+((current.dto.cohorts||[]).filter(row=>row.dimension===dimension&&row.state==='descriptive'&&row.calculationSnapshotId===current.dto.calculationSnapshotId).findIndex(row=>row.dimension===group.dimension&&row.bucket===group.bucket)):'list:'+kind;}
  if(action==='page'){const split=value.lastIndexOf(':'),key=value.slice(0,split),step=Number(value.slice(split+1));pages[key]=(pages[key]||0)+step;focusKey='page:'+value;}
  render({focusKey,resetDetails:action==='detail',reveal:action==='execution'?'executions':null});
 });
 function update(data){
  if(!host)return;const nextSignature=JSON.stringify(data);if(signature===nextSignature){refreshChartActions();return;}
  const nextScope=JSON.stringify([data?.dto?.calculationSnapshotId,data?.dto?.scope?.portfolioId,data?.dto?.requestedPeriod,data?.accounts?.map(row=>row.id)]),scopeChanged=scope!==nextScope;
  if(scopeChanged){view='home';group=null;selected=-1;dimension='instrument';reviewSelection='group';pages={};openKeys.clear();}
  else if(group){group=data?.dto?.cohorts?.find(row=>row.dimension===group.dimension&&row.bucket===group.bucket)||null;if(!group){view='home';reviewSelection='group';selected=-1;}}
  signature=nextSignature;scope=nextScope;current=data;render({scopeChanged});
 }
 return {update};
}
