const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const nanos = value => value != null && /^-?\d+$/.test(String(value)) ? BigInt(value) : null;

// Contributions are shares of the magnitude of the known instrument result in the same currency.
// Missing values and a zero denominator remain unavailable, rather than becoming 0%.
export function instrumentContributions(rows) {
  const totals = new Map();
  for (const row of rows) { const value=nanos(row.pnlNanos), currency=row.currency||'RUB'; if(value!==null)totals.set(currency,(totals.get(currency)||0n)+value); }
  return rows.map(row => { const value=nanos(row.pnlNanos), total=totals.get(row.currency||'RUB'); return {...row, contributionRate:value!==null && total ? Number(value*1_000_000n/(total<0n?-total:total))/1_000_000 : null}; });
}

// Bucket by Moscow calendar date; never add amounts in different currencies.
export function cashFlowGroups(rows) {
  const dayFormat=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'});
  const groups=new Map();
  for(const row of rows){
    const value=nanos(row.amountNanos), date=new Date(row.occurredAt);
    if(!row.occurredAt || value===null || !Number.isFinite(date.valueOf()) || !['deposit','withdrawal'].includes(row.kind))continue;
    const day=Date.parse(dayFormat.format(date)+'T00:00:00Z'), currency=row.currency||'RUB';
    if(!groups.has(currency))groups.set(currency,[]);
    groups.get(currency).push({day,kind:row.kind,amount:value<0n?-value:value});
  }
  return [...groups].map(([currency, entries])=>{
    let first=Infinity,last=-Infinity;for(const entry of entries){first=Math.min(first,entry.day);last=Math.max(last,entry.day);}
    const stepDays=Math.max(1,Math.ceil(((last-first)/86_400_000+1)/62));
    const count=Math.floor((last-first)/(stepDays*86_400_000))+1;
    const bins=Array.from({length:count},(_,index)=>({from:first+index*stepDays*86_400_000,to:Math.min(last,first+((index+1)*stepDays-1)*86_400_000),deposit:0n,withdrawal:0n}));
    let deposit=0n,withdrawal=0n;
    for(const entry of entries){const bin=bins[Math.floor((entry.day-first)/(stepDays*86_400_000))];bin[entry.kind]+=entry.amount;if(entry.kind==='deposit')deposit+=entry.amount;else withdrawal+=entry.amount;}
    return {currency,stepDays,bins,deposit,withdrawal};
  });
}

export function cashFlowChartMarkup(rows, {formatMoney, language='ru'}={}) {
  const groups=cashFlowGroups(rows), dateFormat=new Intl.DateTimeFormat(language==='en'?'en-GB':'ru-RU',{day:'numeric',month:'short',timeZone:'UTC'});
  return groups.map(group=>{
    const {currency,bins,deposit,withdrawal}=group;
    let upper=0n,lower=0n;for(const bin of bins){if(bin.deposit>upper)upper=bin.deposit;if(bin.withdrawal>lower)lower=bin.withdrawal;}
    const scale=upper+lower || 1n, plotHeight=112, zero=20+Number(upper*1_000_000n/scale)/1_000_000*plotHeight;
    const xStart=90,plotWidth=830,step=plotWidth/bins.length,barWidth=Math.min(18,step*.34);
    const money=value=>escape(formatMoney(value.toString(),currency,{native:true}));
    const heights=value=>Number(value*1_000_000n/scale)/1_000_000*plotHeight;
    const bars=bins.map((bin,index)=>{
      const x=xStart+(index+.5)*step, label=dateFormat.format(bin.from)+(bin.to>bin.from?' – '+dateFormat.format(bin.to):'');
      return '<g><title>'+escape(label)+': +'+money(bin.deposit)+' / −'+money(bin.withdrawal)+'</title><rect class="cash-chart-deposit" x="'+(x-barWidth-1)+'" y="'+(zero-heights(bin.deposit))+'" width="'+barWidth+'" height="'+heights(bin.deposit)+'"/><rect class="cash-chart-withdrawal" x="'+(x+1)+'" y="'+zero+'" width="'+barWidth+'" height="'+heights(bin.withdrawal)+'"/></g>';
    }).join('');
    const labels=[...new Set([0,Math.round((bins.length-1)*.25),Math.round((bins.length-1)*.5),Math.round((bins.length-1)*.75),bins.length-1])].map(index=>'<text x="'+(xStart+(index+.5)*step)+'" y="157" text-anchor="middle">'+escape(dateFormat.format(bins[index].from))+'</text>').join('');
    const tick=(value,y)=>'<text x="80" y="'+y+'" text-anchor="end">'+money(value)+'</text>';
    return '<figure class="cash-flow-chart"><figcaption><span><i class="deposit-dot"></i>Пополнения <strong>+'+money(deposit)+'</strong></span><span><i class="withdrawal-dot"></i>Выводы <strong>−'+money(withdrawal)+'</strong></span></figcaption><div class="cash-chart-scroll" tabindex="0" role="region" aria-label="График движений средств, '+escape(currency)+'"><svg viewBox="0 0 960 170" role="img" aria-label="Пополнения и выводы по датам операций"><line class="cash-chart-grid" x1="90" x2="920" y1="20" y2="20"/><line class="cash-chart-grid" x1="90" x2="920" y1="132" y2="132"/><line class="cash-chart-zero" x1="90" x2="920" y1="'+zero+'" y2="'+zero+'"/>'+bars+tick(0n,zero+4)+(upper>0n?tick(upper,16):'')+(lower>0n?tick(-lower,146):'')+labels+'</svg></div>'+(group.stepDays>1?'<small>Столбцы объединяют по '+group.stepDays+' дней. Точные операции — в списке ниже.</small>':'')+'</figure>';
  }).join('');
}
