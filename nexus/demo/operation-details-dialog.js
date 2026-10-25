import {operationExecutionPresentation,operationChildPaymentsMarkup} from './analytics-presentation.js';
export function createOperationDetailsDialog({formatQuantity,formatDate,formatMoney}){
 const dialog=document.createElement('dialog');dialog.className='operation-details-dialog';dialog.setAttribute('aria-labelledby','operationDetailsTitle');
 dialog.innerHTML='<header><h3 id="operationDetailsTitle">Детали операции</h3><button type="button" aria-label="Закрыть детали операции">×</button></header><p data-operation-caption></p><dl class="operation-detail-totals"></dl><div class="operation-details-content"></div>';document.body.append(dialog);
 const close=()=>dialog.close();dialog.querySelector('button').onclick=close;dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();}});
 for(const event of ['invest:view-changed','invest:identity'])document.addEventListener(event,close);
 function open(row,display){
  dialog.querySelector('h3').textContent='Детали операции · '+(display.ticker||display.name||'Событие счёта');
  dialog.querySelector('[data-operation-caption]').textContent=[row.label||row.type,formatDate(row.occurredAt)].filter(Boolean).join(' · ');
  const totals=dialog.querySelector('dl');totals.replaceChildren();
  for(const [label,value]of [['Платёж',formatMoney(row.paymentNanos,row.currency)],['Комиссия',formatMoney(row.commissionNanos,Object.hasOwn(row,'commissionCurrency')?row.commissionCurrency:row.currency)]]){const item=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;item.append(dt,dd);totals.append(item);}
  const execution=operationExecutionPresentation(row,{formatQuantity,formatDate}),markup=operationChildPaymentsMarkup(row.childPayments,{formatQuantity,formatDate})+(execution.reportsMarkup||'');
  const host=dialog.querySelector('.operation-details-content');host.innerHTML=markup;
  for(const detail of [...host.querySelectorAll(':scope>details')]){const section=document.createElement('section'),heading=document.createElement('h4'),summary=detail.querySelector(':scope>summary');heading.textContent=summary?.textContent||'Сведения';summary?.remove();section.append(heading,...detail.childNodes);detail.replaceWith(section);}
  if(!host.childNodes.length){const text=document.createElement('p');text.textContent=execution.note||'Дополнительные сведения о платеже не переданы источником.';host.append(text);}
  if(!dialog.open)dialog.showModal();
 }
 return {open,close};
}
