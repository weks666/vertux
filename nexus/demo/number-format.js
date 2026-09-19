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
