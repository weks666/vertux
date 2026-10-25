import { validFutureExposure, FUTURE_EXPOSURE_REASONS as reasons } from './future-exposure-contract.js';
const esc=v=>String(v??'').replace(/[&<>"']/gu,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const abs=v=>v<0n?-v:v;
function decimal(value,scale=18,digits=9){
 const n=BigInt(value),power=10n**BigInt(Math.max(0,scale-digits)),cut=n/power,approx=n%power!==0n,places=Math.min(scale,digits),text=abs(cut).toString().padStart(places+1,'0');
 const whole=places?text.slice(0,-places):text,part=places?text.slice(-places).replace(/0+$/u,''):'';
 return (approx?'≈ ':'')+(n<0n?'−':'')+whole.replace(/\B(?=(\d{3})+$)/gu,'\u00a0')+(part?','+part:'');
}
const money=(v,currency,scale=18)=>decimal(v,scale)+' '+currency;
const time=value=>new Date(value).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})+' мск';
const ratio=value=>{if(!value)return '—';const numerator=BigInt(value.numerator)*1000n,denominator=BigInt(value.denominator);return (numerator%denominator?'≈ ':'')+decimal(numerator/denominator,3,3)+' ×';};
const positionName=row=>row.ticker&&row.name&&row.ticker!==row.name?row.ticker+' · '+row.name:row.ticker||row.name||row.instrumentUid;
function accountMarkup(value,label){
 if(!validFutureExposure(value)||value.state!=='verified')return '<section class="future-exposure-account" data-exposure-account="'+esc(value?.portfolioId||'unknown')+'"><h4>'+esc(label)+'</h4><p class="future-exposure-status">Состав фьючерсов не подтверждён</p><p>'+esc(reasons[validFutureExposure(value)?value.reasonCode:'unverified'])+'</p></section>';
 const summary=value.summary,coverage=summary.coverage,stale=Date.now()-Date.parse(value.observedAt)>300000;
 const group=g=>'<tr><th scope="row">'+esc(g.currency)+'</th>'+[['Общий размер',g.grossNumerator],['Длинные',g.longNumerator],['Короткие',g.shortNumerator]].map(([label,n])=>'<td><span class="future-exposure-mobile-label">'+label+'</span>'+esc(decimal(n))+'</td>').join('')+'</tr>';
 const rowMarkup=row=>{
  if(row.state!=='included')return '<li data-exposure-row="'+esc(row.key)+'"><strong>'+esc(positionName(row))+'</strong><p>'+esc(reasons[row.reasonCode])+'</p></li>';
  const signed=BigInt(row.quantityNanos)*BigInt(row.priceNanos),direction=BigInt(row.quantityNanos)<0n?'Короткая':BigInt(row.quantityNanos)>0n?'Длинная':'Нулевое количество';
  return '<li data-exposure-row="'+esc(row.key)+'"><strong>'+esc(positionName(row))+'</strong><p>'+direction+' · '+esc(decimal(row.quantityNanos,9))+' шт. × '+esc(money(row.priceNanos,row.currency,9))+' / контракт</p>'
   +'<p>Размер: '+esc(money(abs(signed),row.currency))+'; со знаком: '+esc(money(signed,row.currency))+'.</p>'
   +(row.conversion?'<p>'+(row.conversion.source==='identity'?'Цена уже в RUB.':esc('Сохранённый курс: 1 '+row.currency+' = '+decimal(row.conversion.rateNanos,9)+' RUB; действует с '+row.conversion.date.slice(0,10).split('-').reverse().join('.')+'.'))+' Размер в RUB: '+esc(money(abs(signed)*BigInt(row.conversion.rateNanos),'RUB',27))+'.</p>':'<p>'+esc(reasons.fx_unavailable)+' Валютная сумма выше сохранена.</p>')+'</li>';
 };
 const nativeGroups=summary.currencyGroups.length?'<table data-exposure-currencies><caption>Валюта цены одного контракта</caption><thead><tr><th scope="col">Валюта</th><th scope="col">Общий размер</th><th scope="col">Длинные</th><th scope="col">Короткие</th></tr></thead><tbody>'+summary.currencyGroups.map(group).join('')+'</tbody></table>':'';
 return '<section class="future-exposure-account" data-exposure-account="'+esc(value.portfolioId)+'" data-exposure-complete="'+coverage.complete+'"><h4>'+esc(label)+'</h4>'
  +'<p class="future-exposure-date">Получено '+esc(time(value.observedAt))+(stale?' · требует обновления':'')+'. Это дата получения снимка.</p>'
  +'<p data-exposure-coverage>'+esc(coverage.futureRows===0?'В обычном составе снимка нет фьючерсов.':'Фьючерсов: '+coverage.futureRows+'. Денежная цена подтверждена для '+coverage.pricedRows+', пересчёт в RUB — для '+coverage.convertedRows+'.')+'</p>'
  +'<dl class="future-exposure-totals"><div><dt>'+(coverage.complete?'Общий размер в RUB':'Известный подытог в RUB')+'</dt><dd data-exposure-rub>'+esc(summary.rub?money(summary.rub.grossNumerator,'RUB',27):'—')+'</dd></div>'
  +'<div><dt>Стоимость счёта в том же снимке</dt><dd data-exposure-nav>'+esc(value.nav.state==='known'?money(value.nav.amountNanos,'RUB',9):'—')+'</dd></div>'
  +'<div><dt>Размер фьючерсов / стоимость счёта</dt><dd data-exposure-ratio>'+esc(ratio(summary.ratio))+'</dd></div></dl>'
  +(summary.ratioReason?'<p class="future-exposure-status" data-exposure-reason>'+esc(reasons[summary.ratioReason])+'</p>':'')
  +nativeGroups+'<details data-exposure-disclosure="'+esc(value.portfolioId)+'-positions"><summary>Позиции и источники ('+coverage.futureRows+')</summary><ul class="future-exposure-positions">'+value.rows.map(rowMarkup).join('')+'</ul></details>'
  +'<details data-exposure-disclosure="'+esc(value.portfolioId)+'-method"><summary>Как получен размер и отношение к капиталу</summary><div class="future-exposure-method">'
  +'<p>Для каждой позиции: абсолютная величина количества × денежной цены одного контракта. Общий размер — сумма этих величин. Лот, размер базового актива и шаг цены повторно не умножаются. Длинные и короткие позиции определяются знаком количества; при отрицательной цене сумма со знаком может иметь другое направление.</p>'
  +'<p>Пересчёт в RUB использует проверенную сохранённую копию официального курса, действовавшего на дату получения портфеля по Москве, с пределом поиска 40 календарных дней. Это не биржевой курс и не доказательство, что эта версия курса была известна в прошлом. Обновление display-валюты расчёт не меняет.</p>'
  +'<p>Расчёт сохраняет точные произведения без промежуточного округления. На экране до девяти знаков после запятой; ≈ означает отсечение менее последнего показанного знака. Кратность показана до трёх знаков.</p>'
  +'<p>Отношение доступно только при подтверждённом полном обычном составе фьючерсов, отсутствии виртуальных позиций, известных денежных ценах и курсах, положительной стоимости счёта из того же снимка.</p>'
  +'<p>Размер контрактов — не гарантийное обеспечение и не стоимость имущества. Эта кратность не определяет доступные деньги, допустимый размер заявки или запас до ликвидации. Опционы, дельта и другие классы активов в неё не входят; она не измеряет риск всего портфеля.</p>'
  +(summary.rub?'<p>Сумма произведений со знаком в RUB: '+esc(money(summary.rub.netNumerator,'RUB',27))+'. Это арифметическая сумма, не взаимозачёт рыночных рисков разных контрактов.</p>':'')+'</div></details></section>';
}
export function createFutureExposureUi({host}){
 host.classList.add('future-exposure');let signature='';
 return {update(data){
  const accounts=data?.clientProduct?.portfolios||[],values=data?.clientProduct?.futureExposureAccounts||[],preview=data?.preview?.static===true;
  const next=JSON.stringify([accounts.map(a=>[a.id,a.label]),values,preview,values.map(v=>Date.now()-Date.parse(v.observedAt)>300000)]);if(next===signature)return;signature=next;
  const oldOpen=new Set([...host.querySelectorAll('details[open]')].map(n=>n.dataset.exposureDisclosure));
  host.innerHTML='<header class="financial-section-head"><div><h3>Размер фьючерсных позиций</h3><p>Текущий сохранённый состав · каждый счёт отдельно</p></div></header>'
   +'<p class="future-exposure-scope">Выбранный аналитический период не меняет этот текущий срез. Дата оценки каждого счёта показана ниже.</p>'
   +(preview?'<p data-exposure-preview>В этом учебном демо исходный снимок для расчёта не подтверждён.</p>':!accounts.length?'<p>Нет сохранённого состава выбранных счетов.</p>':accounts.map(account=>{const matching=values.filter(v=>v?.portfolioId===account.id);return accountMarkup(matching.length===1?matching[0]:null,account.label||'Счёт');}).join(''));
  for(const node of host.querySelectorAll('details'))if(oldOpen.has(node.dataset.exposureDisclosure))node.open=true;
 }};
}
