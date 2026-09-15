/* Standalone marketing demo. All examples and state are local to this page. */
(function () {
  'use strict';
  const demo = document.querySelector('[data-invest-demo]');
  if (!demo) return;
  const copy = {
  "ru": {
    "sample": "Интерактивное демо · учебные данные",
    "tab.portfolio": "Портфель",
    "tab.operations": "Операции",
    "tab.analytics": "Аналитика",
    "tab.plan": "План",
    "account": "Учебный портфель",
    "period.month": "Месяц",
    "period.quarter": "3 месяца",
    "period.year": "Год",
    "overview": "Обзор портфеля",
    "value": "Стоимость портфеля",
    "net": "Результат за период",
    "curve": "Кривая капитала",
    "deposits": "Пополнения",
    "fees": "Комиссии",
    "drawdown": "Макс. просадка",
    "chartNote": "Стоимость показана отдельно от результата: пополнения учтены, комиссии вычтены. Выберите период или дату под графиком.",
    "operationsTitle": "История операций",
    "operationsIntro": "Фрагмент истории за сентябрь. Оставьте только нужные движения.",
    "filter.all": "Все",
    "filter.deposit": "Пополнения",
    "filter.fee": "Комиссии",
    "operationsCaption": "Учебные операции за сентябрь",
    "operation": "Операция",
    "amount": "Сумма",
    "depositOp": "Пополнение счёта",
    "purchaseOp": "Покупка бумаг",
    "feeOp": "Комиссия брокера",
    "incomeOp": "Выплата дивидендов",
    "analyticsTitle": "Из чего сложился результат",
    "analyticsIntro": "Нажмите на показатель, чтобы увидеть его смысл. Период общий с графиком.",
    "metric.realized": "Зафиксированный результат",
    "metric.unrealized": "По открытым позициям",
    "metric.fees": "Комиссии",
    "metric.drawdown": "Макс. просадка",
    "planTitle": "План рядом с портфелем",
    "planIntro": "Отмечайте выполненное. Здесь показан учебный список — изменения останутся только на этой странице.",
    "task1": "Сверить операции и комиссии",
    "task2": "Проверить состав портфеля",
    "task3": "Просмотреть события в календаре",
    "calendarTitle": "События, напоминания, торговый план",
    "calendarBody": "В рабочем пространстве они собраны рядом с инструментами и аналитикой.",
    "demoFooter": "Демо без подключения к брокеру",
    "tryHint": "Выбирайте разделы, периоды и показатели — всё работает прямо здесь.",
    "benefit0": "Понимать результат",
    "benefitBody0": "Стоимость, результат сделок, комиссии и просадка — с одним выбранным периодом.",
    "benefit1": "Держать план в фокусе",
    "benefitBody1": "Инструменты, календарь, напоминания и торговый план рядом с портфелем.",
    "benefit2": "Работать со своими данными",
    "benefitBody2": "Портфель и ключ брокера на вашем Windows-компьютере. Доступ к счёту — для просмотра.",
    "statisticsTitle": "За каждой цифрой.<br><em>Понятная картина.</em>",
    "statisticsIntro": "Invest собирает историю операций и оценок портфеля. Видно, что изменилось, сколько стоили сделки и откуда взялся результат.",
    "s1title": "Стоимость и движение денег",
    "s1body": "Оценка портфеля на выбранную дату, пополнения и выводы. Внесённые деньги учитываются отдельно от результата.",
    "s2title": "Результат сделок",
    "s2body": "Зафиксированный результат и изменение открытых позиций — отдельно. Комиссии учитываются при расчёте чистого результата.",
    "s3title": "Комиссии и просадка",
    "s3body": "Стоимость операций и наибольшее снижение портфеля от предыдущего максимума. Показатели зависят от выбранного периода.",
    "s4title": "Источник и полнота данных",
    "s4body": "Дата обновления и доступная история помогают оценить полноту картины. Если данных для расчёта нет, вместо выдуманного числа показывается причина.",
    "priceTitle": "Один Workspace.<br><em>Три варианта подписки.</em>",
    "priceIntro": "Все возможности Invest в каждом варианте. Выбираете только срок.",
    "price.month": "1 месяц",
    "priceDesc.month": "Начать с одного месяца",
    "priceRate.month": "1 490 ₽ / месяц",
    "priceSave.month": "Без скидки за срок",
    "priceAction.month": "Обсудить месяц",
    "price.quarter": "3 месяца",
    "priceDesc.quarter": "Для регулярной работы",
    "priceRate.quarter": "1 330 ₽ / месяц",
    "priceSave.quarter": "Экономия 480 ₽ за срок",
    "priceAction.quarter": "Обсудить 3 месяца",
    "price.year": "1 год",
    "priceDesc.year": "Для долгого горизонта",
    "priceRate.year": "≈ 1 242 ₽ / месяц",
    "priceSave.year": "Экономия 2 980 ₽ за срок",
    "priceAction.year": "Обсудить год",
    "priceNote": "Готовим к запуску. Продажи ещё не открыты; условия на три месяца и год предварительные. Экономия рассчитана относительно 1 490 ₽ за каждый месяц.",
    "tryDemo": "Попробовать демо",
    "seePlans": "Варианты подписки",
    "definition.realized": "Результат закрытых сделок за выбранный период. Изменение открытых позиций показывается отдельно.",
    "definition.unrealized": "Изменение стоимости открытых позиций относительно их стоимости приобретения. Результат ещё не зафиксирован.",
    "definition.fees": "Учтённые комиссии брокера за период. Они вычитаются при расчёте чистого результата.",
    "definition.drawdown": "Самое сильное снижение стоимости от предыдущего максимума в выбранном периоде. В демо рассчитано по пяти учебным оценкам.",
    "filterSummary.all": "Показаны все 5 операций. Это фрагмент истории, а не расчёт прибыли.",
    "filterSummary.deposit": "1 пополнение · 60 000 ₽ внесены на счёт. Это ваши деньги, а не прибыль.",
    "filterSummary.fee": "2 комиссии · всего 115 ₽. Расходы уменьшают результат.",
    "completed": "Выполнено {done} из 3",
    "periodStatus": "Период: {period}. Результат: {net}.",
    "chartPointLabel": "{date}: {value}. Показать оценку портфеля.",
    "tab.holdings": "Состав",
    "holdingsTitle": "Состав портфеля",
    "holdingsIntro": "Учебная оценка на 15 сентября. Выберите класс активов, чтобы увидеть его долю.",
    "asset.stocks": "Акции",
    "asset.bonds": "Облигации",
    "asset.funds": "Фонды",
    "asset.cash": "Деньги",
    "assetSummary": "{asset}: {share}% от стоимости портфеля.",
    "holdingsNote": "Это пример структуры, а не рекомендация по распределению активов."
  },
  "en": {
    "sample": "Interactive demo · sample data",
    "tab.portfolio": "Portfolio",
    "tab.operations": "Activity",
    "tab.analytics": "Analytics",
    "tab.plan": "Plan",
    "account": "Sample portfolio",
    "period.month": "Month",
    "period.quarter": "3 months",
    "period.year": "Year",
    "overview": "Portfolio overview",
    "value": "Portfolio value",
    "net": "Net result",
    "curve": "Portfolio value over time",
    "deposits": "Deposits",
    "fees": "Fees",
    "drawdown": "Max. drawdown",
    "chartNote": "Portfolio value and net result are separate: deposits are accounted for and fees are deducted. Choose a period or a date below the chart.",
    "operationsTitle": "Activity history",
    "operationsIntro": "A sample of September activity. Filter the movements you need.",
    "filter.all": "All",
    "filter.deposit": "Deposits",
    "filter.fee": "Fees",
    "operationsCaption": "Sample September activity",
    "operation": "Activity",
    "amount": "Amount",
    "depositOp": "Account deposit",
    "purchaseOp": "Securities purchase",
    "feeOp": "Broker fee",
    "incomeOp": "Dividend payment",
    "analyticsTitle": "What makes up the result",
    "analyticsIntro": "Select a metric to understand it. The period matches the chart.",
    "metric.realized": "Realized P&L",
    "metric.unrealized": "Unrealized P&L",
    "metric.fees": "Fees",
    "metric.drawdown": "Max. drawdown",
    "planTitle": "Keep your plan in view",
    "planIntro": "Check off completed tasks. This sample checklist only changes on this page.",
    "task1": "Review activity and fees",
    "task2": "Review portfolio composition",
    "task3": "Review upcoming calendar events",
    "calendarTitle": "Events, reminders, trading plan",
    "calendarBody": "In the workspace, they sit alongside instruments and analytics.",
    "demoFooter": "Demo without a broker connection",
    "tryHint": "Explore sections, periods and metrics — right here on the page.",
    "benefit0": "Understand your result",
    "benefitBody0": "Value, trading results, fees and drawdown for one selected period.",
    "benefit1": "Keep your plan in focus",
    "benefitBody1": "Instruments, calendar, reminders and trading plan alongside your portfolio.",
    "benefit2": "Work with your own data",
    "benefitBody2": "Your portfolio and broker key stay on your Windows PC. Account access is read-only.",
    "statisticsTitle": "Behind every number.<br><em>A clearer picture.</em>",
    "statisticsIntro": "Invest brings activity and portfolio valuations together. See what changed, what trading cost and how the result was formed.",
    "s1title": "Value and cash flows",
    "s1body": "Portfolio valuation on a selected date, deposits and withdrawals. Your contributions are separate from your result.",
    "s2title": "Trading results",
    "s2body": "Realized results and changes in open positions are shown separately. Fees are included in the net result.",
    "s3title": "Fees and drawdown",
    "s3body": "Activity costs and the largest decline from a previous portfolio peak. Metrics depend on the selected period.",
    "s4title": "Data source and coverage",
    "s4body": "The update time and available history show how complete the picture is. When data is missing, the reason appears instead of an invented number.",
    "priceTitle": "One workspace.<br><em>Three subscription options.</em>",
    "priceIntro": "Every Invest feature in every option. Simply choose the duration.",
    "price.month": "1 month",
    "priceDesc.month": "Start with one month",
    "priceRate.month": "RUB 1,490 / month",
    "priceSave.month": "Standard monthly price",
    "priceAction.month": "Discuss one month",
    "price.quarter": "3 months",
    "priceDesc.quarter": "For a regular routine",
    "priceRate.quarter": "RUB 1,330 / month",
    "priceSave.quarter": "Save RUB 480 over the term",
    "priceAction.quarter": "Discuss 3 months",
    "price.year": "1 year",
    "priceDesc.year": "For the longer term",
    "priceRate.year": "≈ RUB 1,242 / month",
    "priceSave.year": "Save RUB 2,980 over the term",
    "priceAction.year": "Discuss one year",
    "priceNote": "Preparing for launch. Sales are not open yet; three-month and annual terms are provisional. Savings are compared with RUB 1,490 for each month.",
    "tryDemo": "Explore the demo",
    "seePlans": "Subscription options",
    "definition.realized": "The result of closed trades in the selected period. Changes in open positions are shown separately.",
    "definition.unrealized": "The change in the value of open positions relative to their purchase cost. This result has not been realized.",
    "definition.fees": "Broker fees recorded in the period. They are deducted when calculating the net result.",
    "definition.drawdown": "The largest drop from a previous portfolio peak in the selected period. This demo uses five sample valuations.",
    "filterSummary.all": "All 5 activities shown. This is a sample of the history, not a profit calculation.",
    "filterSummary.deposit": "1 deposit · RUB 60,000 added to the account. Your contribution is not a profit.",
    "filterSummary.fee": "2 fees · RUB 115 total. These costs reduce the result.",
    "completed": "{done} of 3 completed",
    "periodStatus": "Period: {period}. Net result: {net}.",
    "chartPointLabel": "{date}: {value}. Show portfolio valuation.",
    "tab.holdings": "Holdings",
    "holdingsTitle": "Portfolio composition",
    "holdingsIntro": "Sample valuation as of 15 September. Choose an asset class to see its share.",
    "asset.stocks": "Stocks",
    "asset.bonds": "Bonds",
    "asset.funds": "Funds",
    "asset.cash": "Cash",
    "assetSummary": "{asset}: {share}% of portfolio value.",
    "holdingsNote": "An example of portfolio composition, not an allocation recommendation."
  }
};
  const samples = {
    month: {values:[1187500,1215000,1204000,1238000,1257500], dates:['2026-09-01','2026-09-05','2026-09-09','2026-09-12','2026-09-15'], deposits:60000, realized:5100, fees:115},
    quarter: {values:[1057500,1148000,1110000,1230000,1257500], dates:['2026-06-15','2026-07-01','2026-08-01','2026-09-01','2026-09-15'], deposits:180000, realized:11000, fees:560},
    year: {values:[757500,968000,884000,1079000,1257500], dates:['2025-09-15','2025-12-15','2026-03-15','2026-06-15','2026-09-15'], deposits:430000, realized:48500, fees:2000}
  };
  const state = {tab:'portfolio', period:'month', filter:'all', point:4, metric:'realized', asset:'stocks'};
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const language = () => document.documentElement.lang === 'en' ? 'en' : 'ru';
  const t = key => copy[language()][key] || key;
  const num = (value, digits=0) => new Intl.NumberFormat(language()==='ru'?'ru-RU':'en-GB',{maximumFractionDigits:digits}).format(value);
  const money = value => language()==='ru' ? num(value)+' ₽' : 'RUB '+num(value);
  const signed = value => (value>0?'+':value<0?'−':'')+money(Math.abs(value));
  const write = (selector,value) => { const node=demo.querySelector(selector); if(node) node.textContent=value; };
  function metrics() {
    const sample=samples[state.period];
    const total=sample.values.at(-1);
    const net=total-sample.values[0]-sample.deposits;
    let peak=sample.values[0], drawdown=0;
    sample.values.forEach(value => { peak=Math.max(peak,value); drawdown=Math.max(drawdown,(peak-value)/peak*100); });
    return {...sample,total,net,unrealized:net+sample.fees-sample.realized,drawdown};
  }
  function translate() {
    document.querySelectorAll('[data-demo-copy]').forEach(node => { const value=copy[language()][node.dataset.demoCopy]; if(value!=null) node.textContent=value; });
    document.querySelectorAll('[data-demo-html]').forEach(node => { const value=copy[language()][node.dataset.demoHtml]; if(value!=null) node.innerHTML=value; });
  }
  function renderChart(data, animate) {
    const low=Math.min(...data.values), high=Math.max(...data.values);
    const coords=data.values.map((value,index)=>[12+134*index,158-((value-low)/Math.max(1,high-low))*130]);
    const path=coords.map(([x,y],index)=>(index?'L':'M')+x+' '+y.toFixed(2)).join(' ');
    const line=demo.querySelector('.chart-line');
    line.setAttribute('d',path);
    demo.querySelector('.chart-area').setAttribute('d',path+' V178 H12 Z');
    const cx=coords[state.point][0];
    const cursor=demo.querySelector('.chart-cursor');
    cursor.setAttribute('x1',cx); cursor.setAttribute('x2',cx);
    demo.querySelectorAll('[data-chart-dot]').forEach((dot,index)=>{
      dot.setAttribute('cx',coords[index][0]); dot.setAttribute('cy',coords[index][1]);
      dot.setAttribute('r',index===state.point?'5':'3');
    });
    demo.querySelectorAll('[data-chart-point]').forEach((button,index)=>{
      const date=new Date(data.dates[index]+'T12:00:00Z');
      const label=new Intl.DateTimeFormat(language()==='ru'?'ru-RU':'en-GB',{day:'numeric',month:'short',timeZone:'UTC'}).format(date).replace('.','');
      button.textContent=label;
      button.setAttribute('aria-pressed',String(index===state.point));
      button.setAttribute('aria-label',t('chartPointLabel').replace('{date}',label).replace('{value}',money(data.values[index])));
    });
    write('[data-chart-reading]',money(data.values[state.point]));
    if(animate && !reduced.matches && line.animate) {
      line.getAnimations().forEach(animation=>animation.cancel());
      line.animate([{strokeDasharray:'900',strokeDashoffset:'900'},{strokeDasharray:'900',strokeDashoffset:'0'}],{duration:520,easing:'cubic-bezier(.16,1,.3,1)'});
    }
  }
  function render(animate=false) {
    const data=metrics();
    write('[data-demo-balance]',money(data.total));
    write('[data-demo-net]',signed(data.net));
    write('[data-demo-deposits]',money(data.deposits));
    write('[data-demo-fees]',money(data.fees));
    write('[data-demo-drawdown]',num(data.drawdown,1)+'%');
    ['realized','unrealized','fees','drawdown'].forEach(key => write('[data-metric-value="'+key+'"]',key==='drawdown'?num(data[key],1)+'%':money(data[key])));
    write('[data-metric-title]',t('metric.'+state.metric));
    write('[data-metric-explanation]',t('definition.'+state.metric));
    write('[data-demo-formula]',num(data.realized)+' + '+num(data.unrealized)+' − '+num(data.fees)+' = '+money(data.net));
    write('[data-demo-active]',t('tab.'+state.tab));
    write('[data-filter-summary]',t('filterSummary.'+state.filter));
    write('[data-plan-progress]',t('completed').replace('{done}',demo.querySelectorAll('[data-demo-task]:checked').length));
    demo.querySelectorAll('[data-invest-period]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.investPeriod===state.period)));
    demo.querySelectorAll('[data-demo-metric]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.demoMetric===state.metric)));
    demo.querySelectorAll('[data-invest-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.investFilter===state.filter)));
    demo.querySelectorAll('[data-invest-kind]').forEach(row=>{ row.hidden=state.filter!=='all' && row.dataset.investKind!==state.filter; });
    const shares={stocks:54,bonds:30,funds:10,cash:6};
    demo.querySelectorAll('[data-asset]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.asset===state.asset)));
    demo.querySelectorAll('[data-allocation]').forEach(segment=>segment.classList.toggle('is-muted',segment.dataset.allocation!==state.asset));
    Object.entries(shares).forEach(([key,share])=>write('[data-asset-value="'+key+'"]',money(Math.round(data.total*share/100))));
    write('[data-asset-summary]',t('assetSummary').replace('{asset}',t('asset.'+state.asset)).replace('{share}',shares[state.asset]));
    renderChart(data,animate);
  }
  const tabs=Array.from(demo.querySelectorAll('[data-invest-tab]'));
  function activate(name,focus=false) {
    state.tab=name;
    tabs.forEach(button=>{
      const selected=button.dataset.investTab===name;
      button.setAttribute('aria-selected',String(selected)); button.tabIndex=selected?0:-1;
      if(selected && focus) button.focus();
    });
    demo.querySelectorAll('[data-invest-panel]').forEach(panel=>{
      panel.hidden=panel.dataset.investPanel!==name;
      panel.setAttribute('role','tabpanel');
      panel.setAttribute('aria-labelledby','invest-tab-'+panel.dataset.investPanel);
      panel.tabIndex=0;
    });
    const temporal=name==='portfolio'||name==='analytics';
    demo.querySelector('.invest-periods').hidden=!temporal;
    write('[data-demo-active]',t('tab.'+name));
  }
  tabs.forEach((button,index)=>{
    button.addEventListener('click',()=>activate(button.dataset.investTab));
    button.addEventListener('keydown',event=>{
      let next;
      if(event.key==='ArrowRight'||event.key==='ArrowDown') next=(index+1)%tabs.length;
      else if(event.key==='ArrowLeft'||event.key==='ArrowUp') next=(index+tabs.length-1)%tabs.length;
      else if(event.key==='Home') next=0;
      else if(event.key==='End') next=tabs.length-1;
      else return;
      event.preventDefault(); activate(tabs[next].dataset.investTab,true);
    });
  });
  demo.querySelectorAll('[data-invest-period]').forEach(button=>button.addEventListener('click',()=>{
    state.period=button.dataset.investPeriod; state.point=4; render(true);
    write('[data-demo-status]',t('periodStatus').replace('{period}',t('period.'+state.period)).replace('{net}',signed(metrics().net)));
  }));
  demo.querySelectorAll('[data-chart-point]').forEach(button=>button.addEventListener('click',()=>{
    state.point=Number(button.dataset.chartPoint); render();
  }));
  demo.querySelectorAll('[data-invest-filter]').forEach(button=>button.addEventListener('click',()=>{
    state.filter=button.dataset.investFilter; render();
  }));
  demo.querySelectorAll('[data-demo-metric]').forEach(button=>{
    button.disabled=false;
    button.addEventListener('click',()=>{ state.metric=button.dataset.demoMetric; render(); });
  });
  demo.querySelectorAll('[data-demo-task]').forEach(input=>{
    input.disabled=false; input.addEventListener('change',()=>render());
  });
  demo.querySelectorAll('[data-asset]').forEach(button=>{
    button.disabled=false;
    button.addEventListener('click',()=>{state.asset=button.dataset.asset;render();});
  });
  let pointerFrame=0;
  function resetTilt() {
    cancelAnimationFrame(pointerFrame); pointerFrame=0;
    demo.style.removeProperty('--invest-ry'); demo.style.removeProperty('--invest-rx');
  }
  demo.addEventListener('pointermove',event=>{
    if(reduced.matches || !finePointer.matches || demo.matches(':focus-within')) return;
    const x=event.clientX,y=event.clientY;
    cancelAnimationFrame(pointerFrame);
    pointerFrame=requestAnimationFrame(()=>{
      const rect=demo.getBoundingClientRect();
      demo.style.setProperty('--invest-ry',((x-rect.left)/rect.width-.5)*2+'deg');
      demo.style.setProperty('--invest-rx',((y-rect.top)/rect.height-.5)*-1.2+'deg');
      pointerFrame=0;
    });
  });
  demo.addEventListener('pointerleave',resetTilt);
  demo.addEventListener('focusin',resetTilt);
  reduced.addEventListener('change',resetTilt);
  document.addEventListener('nexus:language-change',()=>{translate();render();});
  document.querySelectorAll('a[href="#invest-tour"]').forEach(link=>link.addEventListener('click',()=>{
    tabs.find(button=>button.dataset.investTab===state.tab).focus({preventScroll:true});
  }));
  translate(); render(); activate('portfolio');
  demo.classList.add('is-ready');
  demo.querySelector('.invest-app-nav').hidden=false;
  demo.querySelector('.demo-filters').hidden=false;
  demo.querySelector('.chart-dates').hidden=false;
})();
