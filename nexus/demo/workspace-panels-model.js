// Presentation-only keys. No account, instrument, request or source data is stored.
export const PANEL_DEFINITIONS = [
 ['value','Стоимость портфеля','.headline-copy','summary'],
 ['result','Результат периода','.headline-pnl','summary'],
 ['realized','Реализованная П/У','#realizedPnl','metrics','parent'],
 ['fees','Комиссии','#feesValue','metrics','parent'],
 ['drawdown','Максимальная просадка','#drawdownValue','metrics','parent'],
 ['volatility','Волатильность','#volatilityValue','metrics','parent'],
 ['winrate','Доля прибыльных сделок','#winRateValue','metrics','parent'],
 ['profitfactor','Коэффициент прибыльности','#profitFactorValue','metrics','parent'],
 ['overview-chart','График портфеля','.overview-grid .analytics-chart-surface','overview'],
 ['accounts','Мои счета','.portfolio-breakdown','overview'],
 ['positions','Открытые позиции','.positions-surface','overview-sections'],
 ['today','Сегодня','#todayOverview','overview-sections'],
 ['operations-totals','Итоги операций','.ledger-summary','operations'],
 ['operations-table','Операции','#operationsPanel','operations'],
 ['closed-table','Закрытые позиции','#closedPanel','operations'],
 ['research-chart','График инструмента','.deep-instrument-chart','research'],
 ['research-analysis','Анализ инструмента','.deep-instrument-insights','research'],
 ['money-result','Результат в деньгах','#bookedComponents','performance'],
 ['return-methods','Доходность в процентах','#portfolioPercentageMethods','performance'],
 ['accounts-and-flows','Счета и пополнения','#portfolioAccountsAndFlows','performance'],
 ['bond-payments','Выплаты по облигациям','#bondCashflows','performance'],
 ['reference-price','Ценовой ориентир','#referencePrice','performance'],
 ['saved-risk','Риск портфеля','#observedNavRisk','risk'],
 ['asset-structure','Структура активов','#savedAssetClasses','risk'],
 ['structure-plan','План структуры','#allocationPlan','risk'],
 ['futures-size','Размер фьючерсов','#futureExposure','risk'],
 ['share-concentration','Концентрация акций','#directShareConcentration','risk'],
 ['share-scenario','Сценарии стоимости','#directShareShock','risk'],
 ['share-quantity','Количество акций','#positionReconciliation','checks'],
 ['cash-check','Денежные остатки','#cashComparison','checks'],
 ['broker-reports','Брокерский отчёт','#brokerReports','checks'],
 ['transfers','Переводы между счетами','#internalTransfers','checks'],
 ['transfer-values','Стоимость перевода акций','#shareTransferValuations','checks'],
 ['reviews','Сохранённые обзоры','#portfolioReviews','reviews'],
 ['review-archive','Архив обзоров','.portfolio-review-archive','reviews'],
 ['risk-summary','Краткая оценка обеспечения','.risk-account-overview','risk-plan'],
 ['journal','Журнал планов','#myTradingPlan','journal'],
 ['calculator','Калькулятор позиции','#tradeRiskCalculator','calculator'],
 ['margin','Обеспечение счёта','#accountRiskState','margin'],
 ['company','Разбор компании','#aiReport','company'],
 ['company-request','Выбор компании','.ai-request','company'],
 ['calendar','Календарь','#calendarSurface','events'],
 ['news','Новости рынка','#marketNewsSurface','events'],
 ['alert-rules','Ценовые уведомления','.alert-rules-surface','alerts'],
 ['connection','Подключение счёта','#connectionSurface','sync'],
 ['sync-history','История синхронизации','.sync-history','sync'],
];
export const PANEL_IDS = PANEL_DEFINITIONS.map(([id])=>id);
export const PANEL_SECTION_IDS=[...new Set(['overview','operations','analytics','risk-plan','terminal','ai','events','alerts','sync'])];
export function validatePanelAppearance(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['theme','background','conditional','positive','negative'].includes(key)))throw Error('WORKSPACE_PANEL_APPEARANCE');
 if('theme'in value&&!['inherit','invest','graphite','light'].includes(value.theme)||'conditional'in value&&typeof value.conditional!=='boolean')throw Error('WORKSPACE_PANEL_APPEARANCE');
 for(const key of ['background','positive','negative'])if(key in value&&!(typeof value[key]==='string'&&/^#[a-f0-9]{6}$/i.test(value[key])))throw Error('WORKSPACE_PANEL_APPEARANCE');
 return structuredClone(value);
}
export function validateSectionAppearances(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!PANEL_SECTION_IDS.includes(key)))throw Error('WORKSPACE_SECTION_APPEARANCE');
 for(const item of Object.values(value))validatePanelAppearance(item);return structuredClone(value);
}
export function validatePanelDockTree(value,depth=0,seen=new Set()) {
 if(depth>12)throw Error('WORKSPACE_PANEL_DOCK_DEPTH');
 if(typeof value==='string'){
  if(!PANEL_IDS.includes(value)||seen.has(value))throw Error('WORKSPACE_PANEL_DOCK_LEAF');
  seen.add(value);return value;
 }
 if(!value||Array.isArray(value)||Object.keys(value).sort().join(',')!=='a,axis,b,ratio'||!['x','y'].includes(value.axis)||!Number.isInteger(value.ratio)||value.ratio<15||value.ratio>85)throw Error('WORKSPACE_PANEL_DOCK_SHAPE');
 return {axis:value.axis,ratio:value.ratio,a:validatePanelDockTree(value.a,depth+1,seen),b:validatePanelDockTree(value.b,depth+1,seen)};
}
export function validatePanelLayout(value) {
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!PANEL_IDS.includes(key)))throw Error('WORKSPACE_PANEL_SHAPE');
 for(const [id,item] of Object.entries(value)) {
  if(!item||typeof item!=='object'||Array.isArray(item)||Object.keys(item).some(key=>!['order','width','height','hidden','zone','dockTree','appearance'].includes(key)))throw Error('WORKSPACE_PANEL_SHAPE');
  if('appearance'in item)validatePanelAppearance(item.appearance);
  if('dockTree'in item)validatePanelDockTree(item.dockTree);
  for(const key of ['order','width','height'])if(key in item&&(!Number.isInteger(item[key])||item[key]<0||item[key]>({order:100,width:100,height:900})[key]))throw Error('WORKSPACE_PANEL_VALUE');
  if('width'in item&&item.width!==0&&item.width<15||'height'in item&&item.height!==0&&item.height<80||'hidden'in item&&typeof item.hidden!=='boolean')throw Error('WORKSPACE_PANEL_VALUE');
  if('zone'in item&&(!['top','bottom'].includes(item.zone)||!['realized','fees','drawdown','volatility','winrate','profitfactor'].includes(id)))throw Error('WORKSPACE_PANEL_ZONE');
 }
 return structuredClone(value);
}
