import {createMarketCapitalizationUi} from './market-cap-map-ui.js';
const element = (doc, tag, text, className) => {
  const node = doc.createElement(tag); if (text) node.textContent = text;
  if (className) node.className = className; return node;
};

// Presentation keeps the original controller-owned nodes and requests.
export function initVisualWorkspace(doc = document, {request,getMarketAccess}={}) {
  doc.body.dataset.visualWorkspace = '3';
  doc.body.dataset.workspaceLayout = 'classic';
  const overview = doc.querySelector('.portfolio-ledger');
  const today = overview?.querySelector('#todayOverview');
  if (today) overview.append(today);
  const positionSources = overview?.querySelector('#currentPositionResult');
  if (positionSources) overview.querySelector('.positions-heading')?.append(positionSources);
  for (const [id, label] of [['instrument','Анализ инструмента'],['capital','Доходность и риск'],['trading','Результаты сделок'],['reviews','Сравнение обзоров'],['market','Карта рынка']]) {
    const button = doc.querySelector(`[data-deep-view="${id}"]`);
    if (button) { button.textContent = label; button.parentNode.append(button); }
  }
  const research = doc.querySelector('.deep-instrument');
  let researchView = () => {};
  const market = doc.querySelector('[data-market-view]');
  const marketMap = market ? createMarketCapitalizationUi({host:market,request,getAccess:getMarketAccess}) : null;
  const openMarket = () => marketMap?.open();
  const closeMarket = () => marketMap?.suspend();
  doc.addEventListener('invest:market-map-open', openMarket);
  doc.addEventListener('invest:market-map-close', closeMarket);
  if (research) {
    const saved = research.querySelector('#savedResearch'), queries = research.querySelector('[data-research-query-fallback]');
    const nav = element(doc, 'nav', null, 'visual-view-switch'); nav.setAttribute('aria-label', 'Рабочая область исследования');
    const reading = element(doc, 'div', null, 'visual-research-reading');
    for (const selector of ['.deep-instrument-period', '.deep-load-status', '.deep-instrument-insights']) {
      const node = research.querySelector(selector); if (node) reading.append(node);
    }
    const records = element(doc, 'div'), requests = element(doc, 'div');
    if (saved) records.append(saved); if (queries) requests.append(queries);
    const panes = [['analysis', reading], ['saved', records], ['queries', requests]];
    const tools = [['price','Цена и объём'],['risk','Риск и просадки'],['performance','Динамика'],['financials','Финансы / условия'],['seasonality','Сезонность'],['technical','Теханализ'],['profile','Профиль инструмента'],['saved','Сохранения'],['queries','Запросы']];
    const label = element(doc, 'label', null, 'visual-tool-picker'), picker = element(doc, 'select');
    picker.setAttribute('aria-label', 'Задача исследования'); picker.dataset.visualResearchTool = '';
    for (const [id,text] of tools) { const option = element(doc, 'option', text); option.value = id; picker.append(option); }
    label.append(picker);
    researchView = (id, activate = true) => {
      if (id === 'market') { doc.querySelector('[data-deep-view="market"]')?.click(); return; }
      const paneId = ['saved','queries'].includes(id) ? id : 'analysis';
      research.dataset.visualTool=id;
      for (const [key, pane] of panes) pane.hidden = key !== paneId;
      nav.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.researchView === id)));
      picker.value = id;
      if (paneId === 'analysis' && activate) research.querySelector('[data-insight-tab="'+id+'"]')?.click();
      if (id === 'saved') { const list = saved?.querySelector('[data-sr-list]'); if (list) list.open = true; }
      if (id === 'queries' && !queries?.hidden) queries?.querySelector('[data-rq="toggle"][aria-expanded="false"]')?.click();
    };
    for (const [id, pane] of panes) { pane.dataset.researchPane = id; pane.hidden = id !== 'analysis'; }
    for (const [id, text] of tools.filter(([id])=>['price','risk','saved','queries'].includes(id))) {
      const button = element(doc, 'button', text); button.type = 'button'; button.dataset.researchView = id;
      button.setAttribute('aria-pressed', String(id === 'price'));
      button.addEventListener('click', () => researchView(id)); nav.append(button);
    }
    picker.addEventListener('change', () => researchView(picker.value)); nav.append(label);
    research.querySelector('.ux-research-saved')?.remove();
    research.append(nav, reading, records, requests);
  }
  const restored = () => {
    researchView(research?.querySelector('[data-insight-tab][aria-pressed="true"]')?.dataset.insightTab || 'price', false);
    research?.querySelector('[data-visual-research-tool]')?.focus({preventScroll:true});
  };
  doc.addEventListener('invest:research-restored', restored);
  const toolChanged = event => researchView(event.detail?.tool || 'price', false);
  doc.addEventListener('invest:research-tool', toolChanged);
  const portfolio = doc.querySelector('.deep-portfolio');
  if (portfolio) {
    const episodes = portfolio.querySelector('.deep-trade-statistics'), ranking = portfolio.querySelector('.ranking-surface');
    if (episodes && ranking) {
      const head=element(doc,'header',null,'surface-head'); const copy=element(doc,'div');
      for(const node of [...ranking.children])if(node.matches('h3,p'))copy.append(node);head.append(copy);ranking.prepend(head);
      const workspace = element(doc, 'section', null, 'visual-trading-workspace');
      const nav = element(doc, 'nav', null, 'visual-view-switch'); nav.setAttribute('aria-label', 'Представление результатов сделок');
      const instrumentsPane = element(doc, 'div'), episodesPane = element(doc, 'div');
      instrumentsPane.append(ranking); episodesPane.append(episodes);
      // The episode controller already owns the trading statistics. Account and
      // cash-flow statistics retain their place in the portfolio workspace.
      for (const [id, label, pane] of [['instruments', 'По инструментам', instrumentsPane], ['episodes', 'Эпизоды и статистика', episodesPane]]) {
        pane.dataset.tradingPane = id; pane.hidden = id !== 'instruments';
        const button = element(doc, 'button', label); button.type = 'button'; button.dataset.tradingView = id;
        button.setAttribute('aria-pressed', String(id === 'instruments'));
        button.addEventListener('click', () => {
          workspace.querySelectorAll('[data-trading-pane]').forEach(item => item.hidden = item.dataset.tradingPane !== id);
          nav.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
        });
        nav.append(button); workspace.append(pane);
      }
      workspace.prepend(nav); portfolio.prepend(workspace);
    }
  }

  const reveal = event => {
    const target = event.detail?.target; if (!target?.closest) return;
    const tradingPane = target.closest('[data-trading-pane]');
    if (tradingPane) portfolio?.querySelector('[data-trading-view="'+tradingPane.dataset.tradingPane+'"]')?.click();
    const researchPane = target.closest('[data-research-pane]');
    if (researchPane) researchView(researchPane.dataset.researchPane === 'analysis' ? research?.querySelector('[data-insight-tab][aria-pressed="true"]')?.dataset.insightTab || 'price' : researchPane.dataset.researchPane, false);
  };
  doc.addEventListener('invest:reveal-workspace-target', reveal);

  const themeField = doc.querySelector('[data-presentation=theme]');
  const themes = element(doc, 'div', null, 'visual-theme-options'); themes.setAttribute('aria-label', 'Темы оформления');
  const palettes = [['invest','Тёмная','#080e16','#1d2838','#f3f6fd','#a891ff'],['graphite','Графит','#101114','#303136','#f3f6fd','#a891ff'],['light','Светлая','#f6f5f1','#d9dee9','#172334','#3155ca']];
  if (themeField) {
    for (const [id,label,bg,panel,fg,accent] of palettes) {
      const button = element(doc,'button',null,'visual-theme-option'); button.type='button'; button.dataset.visualTheme=id;
      const sample=element(doc,'div',null,'visual-theme-sample'); sample.setAttribute('aria-hidden','true');
      for(const [key,value]of [['bg',bg],['panel',panel],['text',fg],['accent',accent]]) sample.style.setProperty('--sample-'+key,value);
      sample.innerHTML='<i></i><div><b></b><svg viewBox="0 0 140 60" preserveAspectRatio="none"><path d="M0 51 L18 45 L32 48 L46 30 L66 35 L85 18 L100 25 L122 9 L140 13"/></svg></div>';
      button.append(sample,element(doc,'span',label));
      button.addEventListener('click',()=>{ if(themeField.disabled)return; themeField.value=id; themeField.dispatchEvent(new Event('change',{bubbles:true})); }); themes.append(button);
    }
    themeField.closest('.workspace-palette').before(themes);
  }
  const syncThemes=()=>themes.querySelectorAll('button').forEach(button=>{ button.disabled=themeField?.disabled===true; button.setAttribute('aria-pressed',String(button.dataset.visualTheme===doc.documentElement.dataset.workspaceTheme)); });
  const themeObserver=new MutationObserver(syncThemes); themeObserver.observe(doc.documentElement,{attributes:true,attributeFilter:['data-workspace-theme']});
  if(themeField)themeObserver.observe(themeField,{attributes:true,attributeFilter:['disabled']}); syncThemes();

  // Read-only sources use one nonmodal pane. Each details stays in its original
  // owner: scope checks, revisions, source links and pagination remain intact.
  const sourceSelector = ['.booked-components-receipts', '[data-saved-classes-details="method"]', '[data-nav-risk-details="method"]', '[data-concentration-method]', '[data-concentration-exclusions]', '.insight-provenance', '#aiReport details', '.financial-metric-disclosure', '.position-valuation-details', '.current-position-result details', '.security-position-details', '.bond-position-metrics>details', '.future-position-metrics>details', '.instrument-context-details', '.market-cap-method', '.insight-metric-source', '.context-evidence details', '.calculator-help', '.today-coverage', '.today-item-source'].join(',');
  const actionPanels = '.plan-archive>details,.saved-research-transfer>details';
  const iconPaths = {
    pin:'M16 3 21 8l-4 2-3 6-2-2-7 7 3-9-2-2 6-3z',
    chart:'M4 19V5m0 14h16M7 14l4-5 4 3 5-8',
    company:'M5 21V3h14v18M3 21h18M9 7h1m4 0h1M9 11h1m4 0h1M9 15h1m4 0h1',
    file:'M14 3H6v18h12V7l-4-4v5h4M9 12h6M9 16h6',
    save:'M5 3h12l3 3v15H4V3h1M8 3v6h8V3M8 21v-7h8v7',
    refresh:'M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5M4 16a8 8 0 0 0 14 3l3-3m0 5v-5h-5',
    add:'M12 5v14M5 12h14',
    down:'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4',
    back:'m14 6-6 6 6 6M8 12h12',
    search:'M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16m6-2 6 6',
  };
  function decorate(node, name) {
    if (!node || node.querySelector(':scope>.workspace-action-icon')) return;
    const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.classList.add('workspace-action-icon');
    const path=doc.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',iconPaths[name]||iconPaths.file);svg.append(path);node.prepend(svg);
  }
  const within=(root,selector)=>[...(root.matches?.(selector)?[root]:[]),...root.querySelectorAll(selector)];
  function placeControls(){
    const archive=doc.querySelector('.plan-archive'), journalHead=doc.querySelector('#myTradingPlan>.surface-head');
    if(archive&&journalHead&&archive.parentElement!==journalHead)journalHead.append(archive);
    const transfer=doc.querySelector('.saved-research-transfer'), savedTools=doc.querySelector('.saved-research-list-tools');
    if(transfer&&savedTools&&transfer.parentElement!==savedTools)savedTools.append(transfer);
    const help=doc.querySelector('.calculator-help'), calculatorHead=doc.querySelector('#tradeRiskCalculator>.surface-head');
    if(help&&calculatorHead&&help.parentElement!==calculatorHead)calculatorHead.append(help);
  }
  function controls(root=doc) {
    for(const plot of within(root,'.insight-underwater svg')) if(plot.getAttribute('preserveAspectRatio')!=='none') plot.setAttribute('preserveAspectRatio','none');
    for (const [selector, icon] of [
      ['[data-context-pin]','pin'],['[data-context-chart],[data-position-chart]','chart'],['[data-context-company]','company'],['[data-context-research]','search'],
      ['[data-sr-action="show-save"]','save'],['[data-sr-action="refresh"],[data-market-map-load]','refresh'],
      ['[data-research-export],[data-plan-archive-export]','down'],['#planAdd','add'],
      ['.plan-archive>details>summary,.saved-research-transfer>details>summary','file'],
    ]) for (const node of within(root,selector)) decorate(node, icon);
    for (const detail of within(root,sourceSelector+','+actionPanels)) {
      if(detail.parentElement?.closest('[data-visual-reader]')) continue;
      detail.classList.add('workspace-detail-action');const summary=detail.querySelector(':scope>summary');decorate(summary,'file');
      if(summary&&!summary.title)summary.title=summary.textContent.trim();
    }
    for(const input of within(root,'[data-preference-select="personalCurrency"]')) {
      const choice=input.closest('label');if(choice.querySelector('.workspace-currency-symbol'))continue;
      const symbol=element(doc,'span',input.value==='USD'?'$':'₽','workspace-currency-symbol');symbol.setAttribute('aria-hidden','true');choice.querySelector('span')?.prepend(symbol);
    }
  }
  const flattenTools=()=>{
    for(const details of doc.querySelectorAll('.portfolio-workspace .nav-risk-disclosure,.portfolio-workspace [data-concentration-main]')){
      if(!details.closest('[hidden]')&&!details.open)details.open=true;
      const summary=details.querySelector(':scope>summary');if(!summary||summary.dataset.visualHeading)continue;
      summary.dataset.visualHeading='';summary.setAttribute('role','heading');summary.setAttribute('aria-level','3');summary.tabIndex=-1;
      summary.addEventListener('click',event=>{if(!event.target.closest('button,a'))event.preventDefault();});
    }
    const risk=doc.querySelector('.portfolio-workspace .nav-risk-body'),metrics=risk?.querySelector('.nav-risk-metrics'),plot=risk?.querySelector('.nav-risk-chart');
    if(metrics&&plot&&metrics.nextElementSibling!==plot)metrics.after(plot);
  };
  flattenTools();placeControls();controls();
  let active = null, origin = null;
  function close(restore = true) {
    if (!active) return;
    const old = active, previous = origin; active = null; origin = null;
    old.removeAttribute('data-visual-reader'); old.querySelector('[data-visual-reader-close]')?.remove(); old.open = false;
    if (restore && previous?.summary.isConnected && previous.summary.getClientRects().length) {
      previous.summary.focus({ preventScroll: true });
    }
  }
  const click = event => {
    if (event.target.closest('[data-visual-reader-close]')) { event.preventDefault(); event.stopPropagation(); close(); return; }
    const summary = event.target.closest('summary'), details = summary?.parentElement;
    // Company metrics and their provenance stay beside the values on the page.
    if(details?.closest('#aiReport'))return;
    if(summary?.hasAttribute('data-visual-heading')){event.preventDefault();return;}
    if (!details?.matches(sourceSelector+','+actionPanels)) return;
    const formPanel=details.matches(actionPanels), valuation=details.matches('.bond-position-metrics>details,.future-position-metrics>details');
    if (!formPanel && details.querySelector('form,input,select,textarea')) return;
    if (!formPanel && !valuation && details.querySelector('details')) return;
    if (event.target !== summary && event.target.closest('a,button')) return;
    event.preventDefault(); if (details === active) { close(); return; }
    close(false); active = details; origin = { summary, x: window.scrollX, y: window.scrollY };
    if (valuation) for(const inner of details.querySelectorAll('details')) { inner.open=true;const heading=inner.querySelector('summary');heading.dataset.visualHeading='';heading.setAttribute('role','heading');heading.setAttribute('aria-level','4');heading.tabIndex=-1; }
    const back = element(doc, 'button', 'Закрыть', 'button visual-reader-close'); back.type = 'button'; back.dataset.visualReaderClose = '';decorate(back,'back');
    summary.prepend(back); details.dataset.visualReader = ''; details.open = true; back.focus({ preventScroll: true });
  };
  const keydown = event => { if (event.key === 'Escape' && active && !doc.querySelector('dialog[open]')) { event.preventDefault(); event.stopImmediatePropagation(); close(); } };
  const routeChanged = () => { close(false); if(market?.closest('.view.active')&&!market.hidden)openMarket();else closeMarket(); };
  const identityChanged = () => marketMap?.updateAccess();
  doc.addEventListener('invest:identity',identityChanged);
  const focusOutside = event => { if (active && !active.contains(event.target)) close(false); };
  let decorationFrame=0;
  const decorationRoots=new Set();
  function decorateChanges(){
    decorationFrame=0;flattenTools();placeControls();
    const roots=[...decorationRoots].filter(root=>root.isConnected);decorationRoots.clear();
    // Updating a quote/table cell does not require rescanning every control in
    // the workspace. Ancestors subsume nested mutations from the same batch.
    for(const root of roots)if(!roots.some(other=>other!==root&&other.contains(root)))controls(root);
  }
  const removed = new MutationObserver(mutations => {
    const relevant=mutations.filter(m=>!m.target.closest?.('.terminal-chart-plot,.terminal-chart-identity,.terminal-chart-quote,.terminal-ticker-row,.terminal-chart-statusbar'));
    if(!relevant.length)return;
    for(const mutation of relevant)if(mutation.type==='childList'&&[...mutation.addedNodes].some(node=>!node.matches?.('.workspace-action-icon'))){
      const root=mutation.target.nodeType===1?mutation.target:mutation.target.parentElement;
      if(root)decorationRoots.add(root);
    }
    if(!decorationFrame)decorationFrame=requestAnimationFrame(decorateChanges);
    if (active && (!active.isConnected || !active.open || active.closest('[hidden]') || !active.closest('.view.active'))) close(false);
  });
  removed.observe(doc.querySelector('main') || doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'open'] });
  doc.addEventListener('click', click); doc.addEventListener('keydown', keydown, true);
  doc.addEventListener('focusin', focusOutside);
  doc.addEventListener('invest:task-route-changed', routeChanged); doc.addEventListener('invest:view-changed', routeChanged);
  return { dispose() { close(false);cancelAnimationFrame(decorationFrame);decorationRoots.clear(); marketMap?.dispose(); doc.removeEventListener('invest:market-map-open',openMarket); doc.removeEventListener('invest:market-map-close',closeMarket); doc.removeEventListener('invest:identity',identityChanged); removed.disconnect(); themeObserver.disconnect(); doc.removeEventListener('focusin',focusOutside); doc.removeEventListener('invest:research-tool',toolChanged); doc.removeEventListener('invest:reveal-workspace-target',reveal); doc.removeEventListener('click', click); doc.removeEventListener('keydown', keydown, true); doc.removeEventListener('invest:task-route-changed', routeChanged); doc.removeEventListener('invest:view-changed', routeChanged); doc.removeEventListener('invest:research-restored', restored); } };
}
