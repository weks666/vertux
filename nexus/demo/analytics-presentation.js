const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const nanos = value => value != null && /^-?\d+$/.test(String(value)) ? BigInt(value) : null;

const EXECUTION_TYPES = new Set(['OPERATION_TYPE_BUY', 'OPERATION_TYPE_SELL', 'OPERATION_TYPE_BUY_CARD',
  'OPERATION_TYPE_BUY_MARGIN', 'OPERATION_TYPE_SELL_CARD', 'OPERATION_TYPE_SELL_MARGIN']);
const executionQuantity = value => typeof value === 'string' && /^\d{1,136}$/.test(value) ? BigInt(value) : null;

export function variationMarginPresentation(summary, { formatQuantity } = {}) {
  const unavailable = { value: '—', note: 'Сохранённые операции вариационной маржи не удалось проверить.' };
  if (summary?.version !== 'variation-margin-summary-v1' || summary.complete !== false
      || !['ready', 'empty', 'missing-fx', 'incomplete-currency'].includes(summary.state)
      || !Array.isArray(summary.byCurrency) || summary.byCurrency.length > 256
      || !summary.byCurrency.every(row => /^[A-Z]{3}$/.test(row.currency) && ['accruedNanos', 'writtenOffNanos', 'netNanos'].every(key => nanos(row[key]) !== null)
        && nanos(row.accruedNanos) >= 0n && nanos(row.writtenOffNanos) >= 0n
        && nanos(row.accruedNanos) - nanos(row.writtenOffNanos) === nanos(row.netNanos))) return unavailable;
  const amount = (value, currency) => formatQuantity(value) + ' ' + currency;
  if (summary.state === 'empty') return { value: '—', note: 'В выбранном периоде нет сохранённых операций вариационной маржи.' };
  if (summary.state === 'incomplete-currency') return { value: '—', note: 'Валюта части платежей неизвестна. Общий результат не рассчитан.' };
  if (!summary.byCurrency.length || new Set(summary.byCurrency.map(row => row.currency)).size !== summary.byCurrency.length) return unavailable;
  const value = summary.byCurrency.map(row => amount(row.netNanos, row.currency)).join(' · ');
  if (summary.state === 'missing-fx') return { value, note: 'Суммы в исходных валютах. Для рублёвого итога не хватает исторических курсов.' };
  if (nanos(summary.rubNanos) === null) return unavailable;
  return { value, note: summary.byCurrency.some(row => row.currency !== 'RUB')
    ? 'В рублях: ' + amount(summary.rubNanos, 'RUB') + ' по сохранённым курсам ЦБ на даты операций.'
    : 'Сумма сохранённых операций за выбранный период; отдельно от закрытых сделок с акциями.' };
}

export function operationChildPaymentsMarkup(detail, { formatQuantity, formatDate = value => value } = {}) {
  if (detail?.version !== 'operation-child-payments-v1' || detail.complete !== false || detail.correctionAuthority !== false) return '';
  const wrap = body => `<details class="operation-execution-reports operation-child-payments" data-state="${escape(detail.state)}"><summary>Состав платежа</summary>${body}</details>`;
  const unavailable = '<p>Не удалось проверить сохранённый состав платежа.</p>';
  if (detail.state === 'unavailable') return wrap(unavailable);
  const states = ['present', 'absent', 'invalid'], integer = value => typeof value === 'string' && /^-?(?:0|[1-9]\d{0,32})$/.test(value);
  const currency = value => typeof value === 'string' && /^[A-Z]{3}$/.test(value);
  if (!['matched', 'different', 'unknown', 'conflicting'].includes(detail.state) || !Array.isArray(detail.observations)
    || !detail.observations.length || detail.observations.length > 32 || !detail.observations.every(report => states.includes(report.listState)
      && Array.isArray(report.children) && report.children.length <= 1000 && report.children.every(child => states.includes(child.instrumentState)
        && states.includes(child.paymentState) && (child.paymentState !== 'present' || integer(child.paymentNanos) && currency(child.currency))))) return wrap(unavailable);
  const amount = (value, unit) => integer(value) && currency(unit) ? escape(formatQuantity(value)) + ' ' + escape(unit) : 'Нет данных';
  const valid = integer(detail.parentPaymentNanos) && integer(detail.componentSumNanos) && integer(detail.observedDifferenceNanos)
    && currency(detail.currency) && BigInt(detail.parentPaymentNanos) - BigInt(detail.componentSumNanos) === BigInt(detail.observedDifferenceNanos)
    && (detail.state === 'matched' && detail.observedDifferenceNanos === '0' || detail.state === 'different' && BigInt(detail.observedDifferenceNanos) !== 0n);
  const reasons = { conflicting_reports: 'Сохранённые составы платежа различаются. Общая сумма не выбрана.',
    execution_unconfirmed: 'Исполнение исходной операции не подтверждено.', missing_parent_payment: 'Сумма или валюта исходного платежа не передана.',
    incomplete_components: 'В сообщении нет полного пригодного списка сумм по инструментам.', mixed_currencies: 'Суммы в разных валютах не складываются.' };
  const numbers = '<dl class="operation-child-totals"><div><dt>Исходный платёж</dt><dd>' + amount(detail.parentPaymentNanos, detail.currency) + '</dd></div>'
    + '<div><dt>Сумма частей</dt><dd data-child-payment-sum>' + (valid ? amount(detail.componentSumNanos, detail.currency) : 'Нет данных') + '</dd></div>'
    + '<div><dt>Платёж − сумма частей</dt><dd data-child-payment-difference>' + (valid ? amount(detail.observedDifferenceNanos, detail.currency) : 'Нет данных') + '</dd></div></dl>';
  return wrap(numbers + (valid ? detail.state === 'different' ? '<p>Сумма частей отличается от исходного платежа.</p>' : ''
    : '<p>' + escape(reasons[detail.reason] || 'Недостаточно данных для сравнения сумм.') + '</p>')
    + '<p>Части показаны в валюте источника. Они не добавляются к платежу повторно. Совпадение сумм не подтверждает полную сверку счёта.</p>'
    + '<ol class="operation-execution-messages" tabindex="0" aria-label="Сохранённый состав платежа">' + detail.observations.map(report => '<li><p>Получено приложением: '
      + escape(typeof report.savedAt === 'string' ? formatDate(report.savedAt) : 'Нет данных') + '</p>'
      + (report.listState !== 'present' ? '<p>' + (report.listState === 'absent' ? 'Список не передан.' : 'Формат списка не подтверждён.') + '</p>'
        : !report.children.length ? '<p>Передан пустой список.</p>' : '<ol class="operation-child-items">' + report.children.map(child => '<li><span>'
          + escape(child.name || 'Инструмент без названия') + (child.ticker ? ' · ' + escape(child.ticker) : '')
          + (child.instrumentState !== 'present' ? ' · Инструмент не подтверждён' : '') + '</span><strong>'
          + (child.paymentState === 'present' ? amount(child.paymentNanos, child.currency) : child.paymentState === 'absent' ? 'Сумма не передана' : 'Формат суммы не подтверждён')
          + '</strong></li>').join('') + '</ol>') + '</li>').join('') + '</ol>');
}

export function operationExecutionReportsMarkup(report, { formatQuantity, formatDate = value => value } = {}) {
  if (report?.version !== 'operation-execution-reports-v1' || report.complete !== false || report.correctionAuthority !== false) return '';
  const unavailable = '<p>Сохранённые сведения об исполнении недоступны.</p>';
  const wrap = body => `<details class="operation-execution-reports"><summary>Сведения об исполнении</summary>${body}</details>`;
  if (report.state === 'unavailable') return wrap(unavailable);
  if (!['observed', 'conflicting'].includes(report.state) || !Array.isArray(report.observations) || report.observations.length < 1 || report.observations.length > 32) return wrap(unavailable);
  const names = ['quantity', 'quantityDone', 'quantityRest', 'cancelDateTime', 'cancelReason'];
  if (!report.observations.every(row => names.every(name => ['present', 'absent', 'invalid'].includes(row?.fields?.[name]?.state)))) return wrap(unavailable);
  if (!report.observations.some(row => names.slice(1).some(name => row.fields[name].state !== 'absent'))) return '';
  const labels = ['Количество в сообщении', 'Сообщено выполнено', 'Сообщено осталось', 'Время снятия заявки', 'Причина снятия'];
  const value = (name, field) => {
    if (field.state === 'absent') return 'Не передано';
    if (field.state !== 'present') return 'Формат не подтверждён';
    if (name.startsWith('quantity')) return typeof field.valueNanos === 'string' && /^-?\d{1,29}$/.test(field.valueNanos) ? escape(formatQuantity(field.valueNanos)) : 'Формат не подтверждён';
    return typeof field.value === 'string' && field.value.length <= 2048 ? escape(field.value || 'Пустое значение') : 'Формат не подтверждён';
  };
  return wrap(`<p>Отдельные сохранённые сообщения. Время получения приложением не подтверждает порядок исправлений.</p>`
    + (report.state === 'conflicting' ? '<p>В сведениях есть расхождение. Последнее полученное сообщение не выбрано как верное.</p>' : '')
    + `<ol class="operation-execution-messages" tabindex="0" aria-label="Сохранённые сведения об исполнении">${report.observations.map(row => `<li>`
      + `<p>Получено приложением: ${escape(typeof row.savedAt === 'string' ? formatDate(row.savedAt) : 'Нет данных')}</p>`
      + `<dl>${names.map((name, index) => `<div><dt>${labels[index]}</dt><dd>${value(name, row.fields[name])}</dd></div>`).join('')}</dl>`
      + (row.quantityBalance === 'different' ? '<p>Выполненное количество и остаток не согласованы с общим количеством.</p>' : '')
      + (row.fillComparison === 'different' ? '<p>Сообщённое выполненное количество расходится со списком сохранённых исполнений.</p>' : '')
      + (row.fields.cancelDateTime.state === 'present' ? '<p>Снятие заявки само по себе не отменяет уже сохранённые исполнения.</p>' : '')
      + '</li>').join('')}</ol>`);
}

export function operationExecutionPresentation(row, { formatQuantity, formatDate } = {}) {
  const format = value => escape(value === null ? 'Нет данных' : formatQuantity(value));
  if (!EXECUTION_TYPES.has(row.type)) return { quantityMarkup: escape(formatQuantity(row.quantityNanos)),
    statusLabel: row.stateLabel || 'Не подтверждено', warning: Boolean(row.sourceState), note: row.sourceReason || '' };
  const detail = row.executionDetail;
  const contract = detail?.version === 'operation-execution-detail-v1' && detail.complete === false && !row.sourceState;
  const reported = contract ? executionQuantity(detail.reportedQuantityNanos) : null;
  const observed = contract ? executionQuantity(detail.observedQuantityNanos) : null;
  const valid = reported !== null && observed > 0n && row.state === 'OPERATION_STATE_EXECUTED'
    && Number.isInteger(detail.observedFillCount) && detail.observedFillCount > 0 && detail.observedFillCount <= 1000
    && (detail.state === 'matched' && reported === observed || detail.state === 'different' && reported !== observed);
  const hasReported = contract && (valid || detail.state === 'unavailable' && detail.observedQuantityNanos === null);
  const reportsConflict = row.executionReports?.version === 'operation-execution-reports-v1' && row.executionReports.state === 'conflicting';
  const statusLabel = row.sourceState ? row.stateLabel || 'Не подтверждено' : reportsConflict ? 'Сведения различаются'
    : valid ? detail.state === 'different' ? 'Количество различается' : row.stateLabel || 'Исполнено' : 'Исполнения не подтверждены';
  const note = row.sourceReason || (valid ? `Сохранённых исполнений: ${detail.observedFillCount}.`
    : detail?.reason === 'missing_fills' ? 'В сохранённом сообщении нет списка исполнений.' : 'Сохранённые исполнения не удалось подтвердить.');
  return { quantityMarkup: `<span>В операции: ${format(hasReported ? reported?.toString() ?? null : null)}</span>`
      + `<small class="cell-note">В исполнениях: ${format(valid ? observed.toString() : null)}</small>`,
    statusLabel, warning: Boolean(row.sourceState) || reportsConflict || !valid || detail.state !== 'matched', note,
    reportsMarkup: operationExecutionReportsMarkup(row.executionReports, { formatQuantity, formatDate }) };
}

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
    if(row.status === 'unknown' || typeof row.currency !== 'string' || !/^[A-Z]{3}$/.test(row.currency.trim().toUpperCase()) || !row.occurredAt || value===null || !Number.isFinite(date.valueOf()) || !['deposit','withdrawal'].includes(row.kind))continue;
    const day=Date.parse(dayFormat.format(date)+'T00:00:00Z'), currency=row.currency.trim().toUpperCase();
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
    const scale=upper+lower || 1n, plotHeight=202, zero=20+Number(upper*1_000_000n/scale)/1_000_000*plotHeight;
    const xStart=90,plotWidth=590,step=plotWidth/bins.length,barWidth=Math.min(18,step*.34);
    const money=value=>escape(formatMoney(value.toString(),currency,{native:true}));
    const heights=value=>Number(value*1_000_000n/scale)/1_000_000*plotHeight;
    const bars=bins.map((bin,index)=>{
      const x=xStart+(index+.5)*step, label=dateFormat.format(bin.from)+(bin.to>bin.from?' – '+dateFormat.format(bin.to):'');
      return '<g><title>'+escape(label)+': +'+money(bin.deposit)+' / −'+money(bin.withdrawal)+'</title><rect class="cash-chart-deposit" x="'+(x-barWidth-1)+'" y="'+(zero-heights(bin.deposit))+'" width="'+barWidth+'" height="'+heights(bin.deposit)+'"/><rect class="cash-chart-withdrawal" x="'+(x+1)+'" y="'+zero+'" width="'+barWidth+'" height="'+heights(bin.withdrawal)+'"/></g>';
    }).join('');
    const labels=[...new Set([0,Math.round((bins.length-1)*.25),Math.round((bins.length-1)*.5),Math.round((bins.length-1)*.75),bins.length-1])].map(index=>'<text x="'+(xStart+(index+.5)*step)+'" y="247" text-anchor="middle">'+escape(dateFormat.format(bins[index].from))+'</text>').join('');
    const tick=(value,y)=>'<text x="80" y="'+y+'" text-anchor="end">'+money(value)+'</text>';
    return '<figure class="cash-flow-chart"><figcaption><span><i class="deposit-dot"></i>Пополнения <strong>+'+money(deposit)+'</strong></span><span><i class="withdrawal-dot"></i>Выводы <strong>−'+money(withdrawal)+'</strong></span></figcaption><div class="cash-chart-scroll" tabindex="0" role="region" aria-label="График движений средств, '+escape(currency)+'"><svg viewBox="0 0 720 260" role="img" aria-label="Пополнения и выводы по датам операций"><line class="cash-chart-grid" x1="90" x2="680" y1="20" y2="20"/><line class="cash-chart-grid" x1="90" x2="680" y1="222" y2="222"/><line class="cash-chart-zero" x1="90" x2="680" y1="'+zero+'" y2="'+zero+'"/>'+bars+tick(0n,zero+4)+(upper>0n?tick(upper,16):'')+(lower>0n?tick(-lower,236):'')+labels+'</svg></div>'+(group.stepDays>1?'<small>Столбцы объединяют по '+group.stepDays+' дней. Точные операции — в списке ниже.</small>':'')+'</figure>';
  }).join('');
}
