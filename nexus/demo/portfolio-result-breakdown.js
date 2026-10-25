const amount=value=>typeof value==='string'&&/^-?\d{1,80}$/.test(value)?BigInt(value):null;
export function resultComparison(portfolio) {
 const realized=amount(portfolio?.realizedNanos),fees=amount(portfolio?.feesNanos),result=amount(portfolio?.netPnlNanos);
 return {realizedNanos:realized?.toString()??null,feesNanos:fees?.toString()??null,resultNanos:result?.toString()??null,
  differenceNanos:realized===null||fees===null||result===null?null:(result-realized+fees).toString()};
}
export function renderPortfolioResultBreakdown(host,portfolio,format) {
 if(!host)return;
 const details=portfolio?.resultDetails,comparison=resultComparison(portfolio);
 if(!host.querySelector('summary'))host.innerHTML='<summary>Как получился результат</summary><div class="result-breakdown-body"><dl></dl><p></p></div>';
 if(!host.dataset.dismiss){host.dataset.dismiss='1';document.addEventListener('pointerdown',e=>{if(host.open&&!host.contains(e.target))host.open=false;});host.addEventListener('keydown',e=>{if(e.key==='Escape'&&host.open){host.open=false;host.querySelector('summary').focus();}});}
 const scope=JSON.stringify([details?.scope,details?.period?.requestedFrom]);if(host.dataset.scope!==scope)host.open=false;host.dataset.scope=scope;
 const rows=details?.contractVersion==='portfolio-result-v1'?[
  ['Стоимость в начале',details.opening.valueNanos],['Стоимость в конце',details.closing.valueNanos],['Пополнения минус выводы',details.externalFlows.valueNanos],['Результат по стоимости',comparison.resultNanos],
  ['Реализовано до комиссий',comparison.realizedNanos],['Комиссии периода',comparison.feesNanos],['Разница после вычета комиссий',comparison.differenceNanos]
 ]:[['Реализовано до комиссий',comparison.realizedNanos],['Комиссии периода',comparison.feesNanos],['Результат',comparison.resultNanos]];
 const list=host.querySelector('dl');list.replaceChildren(...rows.flatMap(([label,value])=>{const term=document.createElement('dt'),number=document.createElement('dd');term.textContent=label;number.textContent=value==null?'Нет данных':format(value,portfolio.currency);return [term,number];}));
 host.querySelector('p').textContent='Результат = стоимость в конце − стоимость в начале − пополнения + выводы. Комиссии уже учтены в стоимости. Разница с реализованным результатом пока не разложена по изменению оценки позиций, валютным изменениям и прочим операциям; это не отдельная комиссия.';
}
