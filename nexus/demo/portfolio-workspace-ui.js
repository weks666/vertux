const AREAS = [['performance', 'Доходность'], ['risk', 'Риски и структура'], ['checks', 'Проверка данных']];
const PERFORMANCE = [['bookedComponents', 'Результат в деньгах'], ['portfolioPercentageMethods', 'Доходность в %'], ['portfolioAccountsAndFlows', 'Счета и пополнения'], ['bondCashflows', 'Выплаты по облигациям'], ['referencePrice', 'Ценовой ориентир']];
const RISK = [['observedNavRisk', 'Риск портфеля'], ['savedAssetClasses', 'Структура активов'], ['allocationPlan', 'План структуры'], ['futureExposure', 'Размер фьючерсов'], ['directShareConcentration', 'Концентрация акций'], ['directShareShock', 'Сценарии стоимости']];
const CHECKS = [['positionReconciliation', 'Количество акций'], ['cashComparison', 'Денежные остатки'], ['brokerReports', 'Брокерский отчёт'], ['internalTransfers', 'Переводы между счетами'], ['shareTransferValuations', 'Стоимость перевода акций']];

/** Presentation only. Existing nodes, source guards and financial handlers retain ownership. */
export function createPortfolioWorkspace({ host, chart = null, onAreaChange = () => {} }) {
  const root = document.createElement('div'); root.className = 'portfolio-workspace';
  const toolbar = document.createElement('div'); toolbar.className = 'portfolio-workspace-toolbar';
  const areas = document.createElement('nav');areas.className='portfolio-area-tabs';areas.setAttribute('aria-label','Область расчётов');
  for(const [id,title] of AREAS){const button=document.createElement('button');button.type='button';button.dataset.portfolioArea=id;button.textContent=title;button.setAttribute('aria-pressed',String(id==='performance'));button.addEventListener('click',()=>select(id));areas.append(button);}root.append(areas);
  const quick = document.createElement('nav'); quick.className = 'portfolio-quick-tools'; quick.setAttribute('aria-label', 'Основные задачи аналитики');
  const label = document.createElement('label'); label.className = 'portfolio-tool-picker';
  const caption = document.createElement('span'); caption.textContent = 'Показать';
  const picker = document.createElement('select'); picker.setAttribute('aria-label', 'Инструмент аналитики'); picker.dataset.portfolioPicker = '';
  label.append(caption, picker); toolbar.append(quick, label); root.append(toolbar);
  const panels = new Map(), tools = new Map(), selectedByArea = new Map(), shortcuts = new Map();
  let area = 'performance', lastArea = area, selected = 'bookedComponents', mode = 'instrument';
  const chartHome = chart ? document.createComment('Portfolio chart return position') : null;
  if (chart) { chart.before(chartHome); chart.dataset.persistUi = ''; }
  for (const [id, title] of [...AREAS, ['reviews', 'Сравнение обзоров']]) {
    const pane = document.createElement('section'); pane.className = 'portfolio-workspace-panel';
    pane.dataset.portfolioPanel = id; pane.id = 'portfolio-workspace-' + id; pane.hidden = true;
    pane.setAttribute('aria-label', title); panels.set(id, pane); root.append(pane);
  }
  const move = (selector, target) => { const node = host.querySelector(selector) || root.querySelector(selector); if (node) target.append(node); return node; };
  const performance = panels.get('performance');
  const methods = move('#performanceMethods', performance);
  if (methods) methods.dataset.workbenchPrimary = 'true';
  move('#bookedComponents', performance);
  const ledger = document.createElement('div'); ledger.className = 'statistics-ledger analytics-results-ledger portfolio-performance-ledger';
  for (const node of host.querySelectorAll('.analytics-results-ledger > article:not(.ranking-surface)')) ledger.append(node);
  const accountDetails = document.createElement('section'); accountDetails.id = 'portfolioAccountsAndFlows';
  accountDetails.className = 'portfolio-accounts-and-flows'; accountDetails.append(ledger); performance.append(accountDetails);
  move('.position-analysis-details', accountDetails);
  const percentages = document.createElement('section'); percentages.id = 'portfolioPercentageMethods';
  if (methods) percentages.append(methods);
  const secondary = host.querySelector('.secondary-metrics');
  if(secondary){const metrics=secondary.querySelector('.analytics-grid');if(metrics){metrics.classList.add('percentage-headline-metrics');percentages.prepend(metrics);}secondary.remove();}
  performance.append(percentages); move('#referencePrice', performance);

  for (const [kind, rows] of [['performance', PERFORMANCE], ['risk', RISK], ['checks', CHECKS]]) {
    const group = document.createElement('optgroup'); group.label = AREAS.find(([id]) => id === kind)[1];
    for (const [id, title] of rows) {
      const node = move('#' + id, panels.get(kind)); if (!node) continue;
      const option = document.createElement('option'); option.value = id; option.textContent = title; group.append(option);
      tools.set(id, { node, kind }); if (!selectedByArea.has(kind)) selectedByArea.set(kind, id);
      // Retain legacy disclosure state, without requiring an extra click to see the chosen tool.
      const expand = () => { if (!node.hidden) { const outer = node.querySelector(':scope > details'); if (outer && node.id !== 'portfolioAccountsAndFlows') outer.open = true; } };
      new MutationObserver(expand).observe(node, { childList: true });
    }
    picker.append(group);
  }
  for (const [id, title] of [...PERFORMANCE, ...RISK, ...CHECKS]) {
    if(!tools.has(id))continue;
    const button = document.createElement('button'); button.type = 'button'; button.textContent = title;
    button.dataset.portfolioTool = id; button.setAttribute('aria-controls', id); button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => choose(id)); quick.append(button); shortcuts.set(id, button);
  }
  picker.addEventListener('change', () => choose(picker.value));
  move('#portfolioReviews', panels.get('reviews')); move('.portfolio-review-archive', panels.get('reviews'));
  const exportControl = move('.analytics-export', toolbar); host.append(root);

  function placeChart() {
    if (!chart) return;
    const currentView = document.body.dataset.currentView;
    const inResult = !root.hidden && area === 'performance' && selected === 'bookedComponents' && currentView === 'analytics';
    const anchor = inResult ? root.querySelector('#bookedComponents .booked-components-metrics') : null;
    if (anchor) {
      chart.setAttribute('data-panel-borrowed', '');
      if (chart.previousElementSibling !== anchor) anchor.after(chart);
    }
    else {
      chart.removeAttribute('data-panel-borrowed');
      // A saved panel layout owns placement within the chart's home surface.
      if (chartHome?.parentNode && !chartHome.parentNode.contains(chart)) chartHome.after(chart);
    }
  }
  // Rendering a new DTO replaces only its result DOM. The same chart instance is reattached.
  const booked = tools.get('bookedComponents')?.node;
  if (booked) new MutationObserver(placeChart).observe(booked, { childList: true, subtree: true });
  document.addEventListener('invest:view-changed', placeChart);

  function choose(id, { focus = false } = {}) {
    const tool = tools.get(id); if (!tool) return false;
    selected = id; area = lastArea = tool.kind; selectedByArea.set(area, id);
    root.dataset.area = area; root.dataset.performanceTool = id; picker.value = id;
    for (const [key, pane] of panels) pane.hidden = key !== area;
    for (const [key, item] of tools) {
      item.node.hidden = key !== id;
      if (key === id) { const outer = item.node.querySelector(':scope > details'); if (outer && item.node.id !== 'portfolioAccountsAndFlows') outer.open = true; }
    }
    for (const [key, button] of shortcuts) {button.setAttribute('aria-pressed', String(key === id));button.hidden=tools.get(key).kind!==area;}
    areas.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.portfolioArea===area)));
    if (exportControl) exportControl.hidden = area !== 'performance';
    placeChart(); onAreaChange();
    if (focus) picker.focus({ preventScroll: true });
    root.dispatchEvent(new CustomEvent('invest:portfolio-tool-changed',{bubbles:true,detail:id}));
    return true;
  }
  function select(next, options = {}) {
    if (next !== 'reviews') return choose(selectedByArea.get(next), options);
    area = next; root.dataset.area = next;
    for (const [id, pane] of panels) pane.hidden = id !== next;
    if (exportControl) exportControl.hidden = true; placeChart(); onAreaChange(); return true;
  }
  function setMode(next) {
    mode = next; root.hidden = !['capital', 'portfolio', 'reviews'].includes(mode); toolbar.hidden = mode === 'reviews';areas.hidden=mode==='reviews';
    select(mode === 'reviews' ? 'reviews' : lastArea);
  }
  function revealTarget(target) {
    for (const [id, { node }] of tools) if (node === target || node.contains(target)) return choose(id);
    return false;
  }
  setMode(mode);
  return { setMode, select, revealTarget, getArea: () => area, isVisible: id => !root.hidden && !panels.get(id)?.hidden };
}
