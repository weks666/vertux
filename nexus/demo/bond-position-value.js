import { decimalNanos } from './number-format.js';
export const BOND_POSITION_VALUE_VERSION='bond-position-value-v1';
export const bondPositionValueReasons=Object.freeze({
 source_unavailable:'Сохранённый источник оценки не удалось проверить. Повторите синхронизацию.',
 snapshot_mismatch:'Цена, НКД и количество не подтверждены в одном снимке портфеля.',
 source_scan_limit:'Сохранённый состав превышает предел проверки: 500 позиций.',
 ambiguous_position:'Источник содержит неоднозначные сведения об этой позиции.',
 projection_mismatch:'Сохранённая позиция расходится с исходными сведениями.',
 unknown_bond_price_basis:'В старом снимке единицы цены облигации не подтверждены. Обновите состав портфеля.',
 unknown_quantity:'Количество облигаций не прошло проверку.',
 unknown_price:'Денежная цена облигации отсутствует или не прошла проверку.',
 missing_accrued_interest:'Источник не передал НКД. Обновите состав портфеля; отсутствие НКД не означает ноль.',
 invalid_accrued_interest:'НКД не прошёл проверку. Отрицательный НКД пока не поддерживается.',
 accrued_interest_currency_mismatch:'Цена и НКД переданы в разных валютах. Без подтверждённой конвертации сумма неизвестна.',
 unverified:'Состав стоимости позиции не прошёл проверку.'
});
const NANO=1000000000n;
const nullable=['observedAt','timeBasis','currency','quantityNanos','cleanPriceNanos','accruedPerUnitNanos','dirtyPriceNanos','cleanValueNumerator','accruedValueNumerator','magnitudeValueNanos','signedValueNanos','discardedNanosNumerator'];
const keys=['contractVersion','state','reasonCode',...nullable];
const integer=(v,d=60)=>typeof v==='string'&&new RegExp('^-?(?:0|[1-9]\\d{0,'+(d-1)+'})$','u').test(v)&&v!=='-0';
const iso=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
export function unknownBondPositionValue(code='source_unavailable'){
 return {contractVersion:BOND_POSITION_VALUE_VERSION,state:'unavailable',reasonCode:Object.hasOwn(bondPositionValueReasons,code)?code:'source_unavailable',...Object.fromEntries(nullable.map(k=>[k,null]))};
}
/** This closed DTO contains no provider identity or raw payload. Recheck arithmetic before rendering. */
export function validBondPositionValue(v,row){
 try{
  if(!v||Array.isArray(v)||Object.keys(v).sort().join('|')!==[...keys].sort().join('|')||v.contractVersion!==BOND_POSITION_VALUE_VERSION)return false;
  if(v.state==='unavailable')return Object.hasOwn(bondPositionValueReasons,v.reasonCode)&&nullable.every(k=>v[k]===null)
   &&(!row||row.assetType==='bond'&&row.positionValueNanos===null&&row.positionValueCurrency===null);
  if(v.state!=='ready'||v.reasonCode!==null||!iso(v.observedAt)||v.timeBasis!=='client-observed'||!/^[A-Z]{3}$/u.test(v.currency||''))return false;
  if(!nullable.slice(3).every(k=>integer(v[k])))return false;
  const q=BigInt(v.quantityNanos),a=q<0n?-q:q,p=BigInt(v.cleanPriceNanos),n=BigInt(v.accruedPerUnitNanos),total=a*(p+n);
  if(p<=0n||n<0n||v.dirtyPriceNanos!==(p+n).toString()||v.cleanValueNumerator!==(a*p).toString()||v.accruedValueNumerator!==(a*n).toString()
   ||v.magnitudeValueNanos!==(total/NANO).toString()||v.signedValueNanos!==(q*(p+n)/NANO).toString()||v.discardedNanosNumerator!==(total%NANO).toString())return false;
  return !row||row.assetType==='bond'&&row.quantityNanos===v.quantityNanos&&row.currentPriceNanos===v.cleanPriceNanos
   &&row.asOf===v.observedAt&&row.positionValueNanos===v.magnitudeValueNanos&&row.positionValueCurrency===v.currency;
 }catch{return false;}
}
const esc=v=>String(v??'').replace(/[&<>"']/gu,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Quantity and money each have nine decimal places; products retain all eighteen.
export function exactBondPositionAmount(value,{locale='ru'}={}){
 if(!integer(value))return '—';let n=BigInt(value),sign=n<0n?'−':'';if(n<0n)n=-n;
 const digits=n.toString().padStart(19,'0'),whole=digits.slice(0,-18).replace(/\B(?=(\d{3})+(?!\d))/gu,locale==='en'?',':'\u202f'),fraction=digits.slice(-18).replace(/0+$/u,'');
 return sign+whole+(fraction?(locale==='en'?'.':',')+fraction:'');
}
export function renderBondPositionValue(row,{locale='ru',amountText='—'}={}){
 const value=row?.bondPositionValue,valid=validBondPositionValue(value,row),ready=valid&&value.state==='ready';
 if(!ready){const reason=valid?bondPositionValueReasons[value.reasonCode]:bondPositionValueReasons.unverified;
  return '<span class="bond-position-value" data-bond-value="unavailable"><span>—</span><small>Сумма с НКД неизвестна</small><details><summary>Причина</summary><p>'+esc(reason)+'</p></details></span>';}
 const amount=v=>decimalNanos(v,{digits:9,locale})+' '+value.currency,product=v=>exactBondPositionAmount(v,{locale})+' '+value.currency;
 const cells=[['Количество',decimalNanos(value.quantityNanos,{digits:9,locale})+' шт.'],['Цена без НКД / шт.',amount(value.cleanPriceNanos)],['НКД / шт.',amount(value.accruedPerUnitNanos)],['Цена с НКД / шт.',amount(value.dirtyPriceNanos)],['Стоимость бумаг',product(value.cleanValueNumerator)],['НКД позиции',product(value.accruedValueNumerator)],['Величина позиции с НКД',product((BigInt(value.cleanValueNumerator)+BigInt(value.accruedValueNumerator)).toString())]];
 const time=new Intl.DateTimeFormat(locale==='en'?'en-GB':'ru-RU',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Moscow'}).format(new Date(value.observedAt));
 const signed=BigInt(value.quantityNanos)<0n?'<p>Короткая позиция: стоимость со знаком −'+esc(product((BigInt(value.cleanValueNumerator)+BigInt(value.accruedValueNumerator)).toString()))+'. В таблице показана её величина.</p>':'';
 return '<span class="bond-position-value" data-bond-value="ready" data-value-nanos="'+esc(value.magnitudeValueNanos)+'"><span>'+esc(amountText)+'</span><small>С НКД</small><details><summary>Цена и НКД</summary><dl>'+cells.map(([k,v])=>'<div><dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd></div>').join('')+'</dl>'+signed+'<p class="bond-position-stamp">Сохранённая оценка без комиссий. Получено '+esc(time)+' МСК.</p><details class="bond-position-method"><summary>Источник и расчёт</summary><p>Т‑Инвест · сохранённый портфель. Отдельное время цены и НКД не передано.</p><p>Количество в штуках × (денежная цена + НКД). Лот и номинал повторно не умножаются. Разбивка показана в исходной валюте; итог таблицы следует выбранной валюте отображения.</p><p>Это сохранённая оценка без комиссий, не сумма исполнения или начисленный купон. При передаче итога в таблицу доли меньше 0,000000001 денежной единицы отбрасываются.</p></details></details></span>';
}
