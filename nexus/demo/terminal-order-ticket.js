import {decimalNanos} from './number-format.js';
import {estimateBondOrder} from './bond-order-estimate.js';
import {estimateFutureOrder,futureCatalogNote} from './future-contract.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=v=>Number.isFinite(v)?v.toLocaleString('ru-RU',{maximumFractionDigits:5}):'—';
const amount=(value,currency)=>decimalNanos(value,{digits:9})+' '+currency;
const stamp=time=>Number.isFinite(time)?new Date(time*1000).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'}):'время неизвестно';
export function createOrderTicket({host,getMeta,getPrice,getContext=()=>({})}){
 let side='buy',kind='limit',identity='',priceKind='chart',priceTime=null;
 host.innerHTML='<div class="order-ticket"><div class="order-side" role="group" aria-label="Направление заявки"><button type="button" data-order-side="buy" aria-pressed="true">Покупка</button><button type="button" data-order-side="sell" aria-pressed="false">Продажа</button></div><div class="order-kind" role="group" aria-label="Тип заявки"><button type="button" data-order-kind="limit" aria-pressed="true">Лимитная</button><button type="button" data-order-kind="market" aria-pressed="false">Рыночная</button></div><div class="order-symbol"></div><label>Цена<input name="limitPrice" type="number" step="any" min="0.000000001" aria-label="Цена заявки"></label><label>Количество лотов<input name="lots" type="number" step="1" min="1" max="1000000" value="1" aria-label="Количество лотов заявки"></label><div class="order-quantity-presets">'+[1,5,10,25].map(n=>'<button type="button" data-order-lots="'+n+'">'+n+'</button>').join('')+'</div><label class="order-protection"><input type="checkbox" name="protection">Рассчитать стоп и цель</label><div class="order-protection-inputs" hidden><label>Стоп<input name="stop" type="number" min="0.000000001" step="any"></label><label>Цель<input name="target" type="number" min="0.000000001" step="any"></label></div><dl class="order-estimate"></dl><p class="order-validation" role="status"></p><p class="order-bond-caption" hidden>По сохранённому каталогу, без комиссий. Дата НКД не указана.</p><details class="order-bond-method" hidden><summary>Как рассчитана сумма</summary><p class="order-bond-inputs"></p><p>Стоимость бумаг = цена в процентах ÷ 100 × номинал × количество. НКД на количество прибавляется отдельно. Округление — до 9 знаков после запятой после умножения на всё количество.</p><p>Номинал и НКД взяты из сохранённого каталога. Дата, на которую указан НКД, не передана. Это оценка по этим условиям, без комиссий и подтверждения суммы расчётов у брокера.</p></details><p class="order-future-caption" hidden></p><details class="order-future-method" hidden><summary>Как рассчитаны размер и ГО</summary><p class="order-future-inputs"></p><p>Размер позиции в деньгах = цена в пунктах ÷ шаг цены × стоимость шага × количество контрактов. ГО = значение для выбранного направления за контракт × количество контрактов. Размер базового актива повторно не умножается.</p><p>Суммы рассчитаны по сохранённым условиям без комиссий. Размер позиции не равен сумме, списываемой при сделке. ГО может измениться; доступность денег, итоговые требования брокера и порог ликвидации здесь не проверяются.</p><p>Риск до стопа — стоимость заданного расстояния цены. Исполнение стопа по этой цене не гарантируется; проскальзывание и комиссии не учтены.</p></details><button type="button" class="order-send" disabled>Отправка заявки не подключена</button><p class="order-boundary">Предварительный расчёт. Текущее подключение работает на чтение; заявка брокеру не отправляется. Цена исполнения, комиссии и доступный лимит требуют проверки перед отправкой.</p></div>';
 const price=host.querySelector('[name=limitPrice]'),lots=host.querySelector('[name=lots]'),method=host.querySelector('.order-bond-method');
 function render(){
  const meta=getMeta()||{},context=getContext()||{},last=getPrice(),bond=meta.assetType==='bond',future=meta.assetType==='future',p=kind==='market'?last:Number(price.value),count=Number(lots.value);
  const lot=Number.isSafeInteger(meta.lot)&&meta.lot>0?meta.lot:null,qty=lot===null?null:count*lot,currency=meta.assetType==='future'?'п.':bond?'% ном.':meta.currency?.toUpperCase()||'';
  const valid=Number.isSafeInteger(count)&&count>0&&count<=1000000&&Number.isFinite(p)&&p>0&&Number.isSafeInteger(qty)&&qty>0;
  price.disabled=kind==='market';price.closest('label').firstChild.textContent=kind==='market'?(bond?'Закрытие свечи, % номинала':future?'Закрытие свечи, пункты':'Ориентир по последней цене'):(bond?'Цена, % номинала':future?'Цена, пункты':'Цена');
  if(kind==='market'){price.value=Number.isFinite(last)&&last>0?String(last):'';priceKind='chart';priceTime=context.time;}
  host.querySelector('.order-symbol').textContent=(meta.ticker||'Инструмент')+' · '+(lot===null?'размер лота неизвестен':'1 лот = '+lot+(meta.assetType==='future'?' контрактов':' шт.'));
  const rows=[['Количество',valid?number(qty)+(meta.assetType==='future'?' контрактов':' шт.'):'—'],[bond?'Цена без НКД':'Ориентир цены',number(p)+' '+currency]];
  let error=valid?'':lot===null?'Источник не передал проверенный размер лота.':'Укажите положительную цену и целое число лотов.';
  method.hidden=!bond;host.querySelector('.order-bond-caption').hidden=!bond;
  const futureMethod=host.querySelector('.order-future-method');futureMethod.hidden=!future;host.querySelector('.order-future-caption').hidden=!future;let futureEstimate=null;
  delete host.querySelector('.order-ticket').dataset.futureEstimate;
  if(bond){
   const estimate=estimateBondOrder({instrument:meta,pricePercent:price.value,lots:lots.value,priceKind,context});
   host.querySelector('.order-ticket').dataset.bondEstimate=estimate.state;
   host.querySelector('.order-estimate').dataset.estimateReason=estimate.code||'';
   error=estimate.reason||'';
   if(estimate.state==='ready'){
    rows[0][1]=BigInt(estimate.quantity).toLocaleString('ru-RU')+' шт.';
    rows[1][1]=decimalNanos(estimate.pricePercentNanos,{digits:9})+' % ном.';
    rows.push(['Стоимость бумаг',amount(estimate.cleanAmountNanos,estimate.currency)],['НКД на количество',amount(estimate.accruedAmountNanos,estimate.currency)],['Сумма с НКД',amount(estimate.totalAmountNanos,estimate.currency)]);
    host.querySelector('.order-bond-inputs').textContent=(priceKind==='chart'?'Цена: закрытие свечи от '+stamp(priceTime)+'.':'Цена: введённое значение.')+' Номинал за штуку: '+amount(estimate.nominalNanos,estimate.currency)+'. НКД за штуку: '+amount(estimate.accruedPerUnitNanos,estimate.currency)+'.';
   }else{rows.push(['Сумма с НКД','—']);host.querySelector('.order-bond-inputs').textContent='Сумма пока не рассчитана.';}
  }else{
   delete host.querySelector('.order-ticket').dataset.bondEstimate;
   delete host.querySelector('.order-estimate').dataset.estimateReason;
   if(!future)rows.push(['Оценка суммы',valid?number(p*qty)+' '+currency:'—']);
   else{
    futureEstimate=estimateFutureOrder({instrument:meta,pricePoints:price.value,lots:lots.value,side,priceKind,context,stopPoints:host.querySelector('[name=stop]').value,targetPoints:host.querySelector('[name=target]').value});
    host.querySelector('.order-ticket').dataset.futureEstimate=futureEstimate.state;
    host.querySelector('.order-estimate').dataset.estimateReason=futureEstimate.code||'';
    error=futureEstimate.reason||'';
    if(futureEstimate.quantity!==null){rows[0][1]=BigInt(futureEstimate.quantity).toLocaleString('ru-RU')+' контрактов';rows[1][1]=decimalNanos(futureEstimate.pricePointsNanos,{digits:9})+' п.';}
    for(const[label,value]of [['Размер позиции в деньгах',futureEstimate.notional],['ГО по каталогу',futureEstimate.margin]])rows.push([label,value.state==='ready'?amount(value.amountNanos,value.currency):'—']);
    if(!error)error=[futureEstimate.notional,futureEstimate.margin].filter(value=>value.state!=='ready').map(value=>value.reason).join(' ');
    host.querySelector('.order-future-caption').textContent=futureCatalogNote(meta);
    host.querySelector('.order-future-inputs').textContent=(priceKind==='chart'?'Цена: закрытие свечи от '+stamp(priceTime)+'.':'Цена: введённое значение.')+(futureEstimate.notional.state==='ready'?' Шаг: '+decimalNanos(futureEstimate.stepNanos,{digits:9})+' п. Стоимость шага: '+amount(futureEstimate.stepAmountNanos,futureEstimate.notional.currency)+'.':'');
   }
  }
  const protection=host.querySelector('[name=protection]').checked;host.querySelector('.order-protection-inputs').hidden=!protection;
  if(protection&&future){
   if(futureEstimate?.stopRisk.state==='ready'){rows.push(['Риск / доходность','1 : '+decimalNanos(futureEstimate.rewardRiskNanos,{digits:5})],['Риск до стопа по условиям',amount(futureEstimate.stopRisk.amountNanos,futureEstimate.stopRisk.currency)]);}
   else if(!error)error=futureEstimate?.stopRisk.reason||'';
  }else if(protection&&valid){
   const stop=Number(host.querySelector('[name=stop]').value),target=Number(host.querySelector('[name=target]').value),risk=(p-stop)*(side==='buy'?1:-1),reward=(target-p)*(side==='buy'?1:-1);
   if(Number.isFinite(stop)&&Number.isFinite(target)&&stop>0&&target>0&&risk>0&&reward>0){rows.push(['Риск / доходность','1 : '+number(reward/risk)]);if(!['future','bond'].includes(meta.assetType))rows.push(['Риск до стопа',number(risk*qty)+' '+currency]);}
   else error=[error,'Для покупки: стоп ниже цены, цель выше. Для продажи — наоборот.'].filter(Boolean).join(' ');
  }
  host.querySelector('.order-estimate').innerHTML=rows.map(([k,v])=>'<div><dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd></div>').join('');host.querySelector('.order-validation').textContent=error;
 }
 host.onclick=e=>{const b=e.target.closest('button');if(b?.dataset.orderSide){side=b.dataset.orderSide;host.querySelectorAll('[data-order-side]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.orderSide===side)));}if(b?.dataset.orderKind){kind=b.dataset.orderKind;host.querySelectorAll('[data-order-kind]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.orderKind===kind)));}if(b?.dataset.orderLots)lots.value=b.dataset.orderLots;render();};
 host.oninput=e=>{if(e.target===price){priceKind='manual';priceTime=null;}render();};host.onchange=render;
 return {update(){
  const meta=getMeta()||{},context=getContext()||{},next=JSON.stringify([context.identity,meta.instrumentOrigin?.provider,meta.instrumentOrigin?.market,meta.instrumentUid]);
  if(identity!==next){identity=next;price.value='';lots.value='1';priceKind='chart';priceTime=null;method.open=false;host.querySelector('.order-future-method').open=false;host.querySelector('[name=stop]').value='';host.querySelector('[name=target]').value='';}
  if(!price.value&&Number.isFinite(getPrice())&&getPrice()>0&&document.activeElement!==price){price.value=String(getPrice());priceKind='chart';priceTime=context.time;}
  render();
 }};
}
