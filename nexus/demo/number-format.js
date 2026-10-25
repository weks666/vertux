export const NANO=1_000_000_000n;
export function normalizeCurrency(currency='RUB') {
  const code=String(currency||'RUB').toUpperCase();
  return ({PT:'PTS',PNT:'PTS',POINTS:'PTS',RUR:'RUB','РУБ':'RUB','₽':'RUB','$':'USD'})[code] || code;
}
export function decimalNanos(value,{digits=2,locale='ru',absolute=false,trim=true}={}) {
  if(value==null || !/^-?\d+$/.test(String(value)))return '—';
  let amount=BigInt(value);const negative=amount<0n&&!absolute;if(amount<0n)amount=-amount;
  const divisor=10n**BigInt(9-digits);
  const rounded=(amount+divisor/2n)/divisor;
  const text=rounded.toString().padStart(digits+1,'0');
  const whole=(digits?text.slice(0,-digits):text).replace(/\B(?=(\d{3})+(?!\d))/g,locale==='en'?',':'\u202f');
  let fraction=digits?text.slice(-digits):'';if(trim)fraction=fraction.replace(/0+$/,'');
  return `${negative?'−':''}${whole}${fraction?(locale==='en'?'.':',')+fraction:''}`;
}
export function convertNanos(value,from,to,rates={}) {
  from=normalizeCurrency(from);to=normalizeCurrency(to);
  if(value==null || !/^-?\d+$/.test(String(value)))return null;
  if(from===to || from==='PTS')return String(value);
  const rate=code=>code==='RUB'?NANO:/^\d+$/.test(String(rates[code]?.rateNanos||''))?BigInt(rates[code].rateNanos):null;
  const source=rate(from),target=rate(to);if(!source||!target)return null;
  const numerator=BigInt(value)*source;const sign=numerator<0n?-1n:1n;
  return (sign*((numerator*sign+target/2n)/target)).toString();
}
export function money(value,currency='RUB',{locale='ru',target=currency,rates={}}={}) {
  currency=normalizeCurrency(currency);target=currency==='PTS'?'PTS':normalizeCurrency(target);
  const converted=convertNanos(value,currency,target,rates);
  if(converted==null)return '—';
  const unit=({RUB:'₽',USD:'$',EUR:'€',CNY:'¥',PTS:locale==='en'?'pts':'п.'})[target]||target;
  return `${decimalNanos(converted,{locale})}\u00a0${unit}`;
}
export function positionQuantity(row,{locale='ru'}={}) {
  const value=decimalNanos(row.quantityNanos,{digits:9,locale,absolute:true});
  if(value==='—')return value;
  const unit=row.assetType==='future'?(locale==='en'?'contracts':'контр.'):(locale==='en'?'shares':'шт.');
  return `${value} ${unit}`;
}

// Company facts are decimal text, not nanounits. Keep the stored digits out of Number.
export function financialMetric(metric,{mode='compact',locale='ru'}={}) {
  if(metric?.value==null||metric.status==='missing')return locale==='en'?'No data':'Нет данных';
  const raw=String(metric.value),match=/^(-?)(\d+)(?:\.(\d+))?$/u.exec(raw);
  if(!match)return raw;
  const whole=match[2].replace(/^0+(?=\d)/u,''),fraction=match[3]||'',amount=BigInt(whole+fraction),scale=10n**BigInt(fraction.length);
  const negative=match[1]&&amount!==0n?'−':'',unitKey=metric.unit||'';
  const currencyUnit=unitKey.replace(/\/share$/u,''),currency=({RUB:'₽',RUR:'₽',USD:'$',EUR:'€',CNY:'¥',PTS:locale==='en'?'pts':'п.'})[currencyUnit]||currencyUnit;
  const unit=unitKey.endsWith('/share')?currency+(locale==='en'?'/share':'/акция'):({RUB:'₽',RUR:'₽',USD:'$',EUR:'€',CNY:'¥',PTS:locale==='en'?'pts':'п.',currency:locale==='en'?'currency units':'ден. ед.',percent:'%',ratio:'×',shares:locale==='en'?'shares':'акций',units:locale==='en'?'units':'ед.',years:locale==='en'?'years':'лет',days:locale==='en'?'days':'дн.',provider_value:'',unknown_currency:''})[unitKey]??unitKey;
  const group=value=>value.replace(/\B(?=(\d{3})+(?!\d))/gu,locale==='en'?',':'\u202f');
  const decimal=locale==='en'?'.':',';
  let display;
  if(mode==='exact')display=negative+group(whole)+(fraction?decimal+fraction:'');
  else {
    const compactable=/^[A-Z]{3}(?:\/share)?$/u.test(unitKey)||unitKey==='currency'||unitKey==='shares';
    const magnitudes=compactable?[[1000000000000n,locale==='en'?'T':'трлн'],[1000000000n,locale==='en'?'B':'млрд'],[1000000n,locale==='en'?'M':'млн']]:[];
    // Select by rounded magnitude so 999.999 million does not become 1 000 million.
    const [magnitude,suffix]=magnitudes.find(([m])=>amount*200n>=scale*(m*200n-(m===1000000n?1n:m/1000n)))||[1n,''];
    const divisor=scale*magnitude,rounded=(amount*100n+divisor/2n)/divisor;
    const digits=rounded.toString().padStart(3,'0'),decimals=digits.slice(-2).replace(/0+$/u,'');
    display=amount!==0n&&rounded===0n?(negative?'>−':'<')+'0'+decimal+'01':negative+group(digits.slice(0,-2))+(decimals?decimal+decimals:'');
    if(suffix)display+='\u00a0'+suffix;
  }
  return display+(unit?'\u00a0'+unit:'');
}
