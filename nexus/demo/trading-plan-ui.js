import { validPlanDetails } from './nexus-ai-contract.js';
import { createPlanDetailsEditor, appendPlanDetails } from './plan-details-ui.js';
import {createPlanInstrumentPicker} from './plan-instrument-picker.js';
import { createPlanRiskScenario, validPlanRiskScenario, scenarioPlanFields } from './plan-risk-scenario.js';
import { appendPlanRiskScenario } from './plan-risk-scenario-ui.js';
import { instrumentLogo, issuerName } from './instrument-mark.js';
import { createPlanHistoryDisclosure } from './plan-history-ui.js';
import { createExecutionObservationsDisclosure } from './execution-observations-ui.js';
import { createDecisionTimelineDisclosure } from './decision-timeline-ui.js';
import { createPlanArchiveUi } from './plan-archive-ui.js';
import { createPlanExecutionLinksDisclosure } from './plan-execution-links-ui.js';
import { createPlanReviewWorkspace } from './plan-review-ui.js';
import { declaredPlanPriceBasis, validPlanPriceBasis, planPriceUnitLabel } from './plan-price-basis.js';
const PAGE_SIZE = 8;
const ACTIONS = { watch: 'Наблюдение', buy: 'Покупка', sell: 'Продажа' };
const STATUSES = { draft:'Черновик', watching:'Наблюдаю', completed:'Реализовано', cancelled:'Отменено' };
const FIELDS = ['planAccount', 'planInstrument', 'planDate', 'planAction', 'planEntry', 'planStop', 'planTarget', 'planPriceUnit', 'planPriceCurrency', 'planNote', 'planSave'];
const uuid = /^[a-f\d]{8}-[a-f\d-]{20,}$/iu;
const writeVersion = value => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const textLabel = (value) => typeof value === 'string' && value.length > 0 && !uuid.test(value) && !value.includes('\ufffd') ? value : '';
const instrumentLabel = (item) => [textLabel(item?.ticker), textLabel(item?.name)].filter((value, index, values) => value && values.indexOf(value) === index).join(' · ') || 'Название инструмента недоступно';

// Copy owner-entered quote levels, never a monetary risk or a historical attribution.
export function terminalPlanDraft(input) {
  const invalid = () => { throw new TypeError('Проверьте направление, вход, стоп, цель и целое количество лотов. Цены могут содержать до 9 знаков после точки.'); };
  if (!input || !['buy', 'sell'].includes(input.action)) invalid();
  const price = value => {
    if (typeof value !== 'string' || !/^(?:0|[1-9]\d{0,17})(?:\.\d{1,9})?$/u.test(value)) invalid();
    const [whole, part = ''] = value.split('.'), nanos = BigInt(whole) * 1_000_000_000n + BigInt(part.padEnd(9, '0'));
    if (nanos <= 0n) invalid();
    return nanos;
  };
  const entry = price(input.entry), stop = price(input.stop), target = price(input.target), direction = input.action === 'buy' ? 1n : -1n;
  if ((entry - stop) * direction <= 0n || (target - entry) * direction <= 0n || typeof input.quantity !== 'string' || !/^[1-9]\d{0,17}$/u.test(input.quantity)) invalid();
  if (typeof input.note !== 'string' || input.note.length > 1000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(input.note)) invalid();
  return { action: input.action, entryPrice: input.entry, stopPrice: input.stop, targetPrice: input.target,
    note: `Объём сценария, лотов: ${input.quantity}${input.note ? '\n\n' + input.note : ''}` };
}

export function initTradingPlan({ request, showToast = () => {}, getBootstrap, getSelectedPortfolio = () => '', getCatalogInstrument = () => null, getCatalog = () => [], openJournal = () => {}, onOpenChart, onDiscussPlan, chartAvailability = () => ({available:false,reason:'Инструмент отсутствует в доступном каталоге.'}) }) {
  const element = (id) => document.getElementById(id);
  const form = element('tradingPlanEditor');
  if (!form) return { refresh: async () => {} };
  const detailsEditor = createPlanDetailsEditor(form, element('planSave'));
  const list = element('manualPlanList');
  const status = element('planEditorStatus');
  const recovery = element('planConflictRecovery');
  const add = element('planAdd');
  const summary = element('planJournalSummary');
  const ledgerHead = element('myTradingPlan')?.querySelector('.plan-ledger-head');
  const cancelEdit = document.createElement('button'); cancelEdit.type = 'button'; cancelEdit.className = 'button'; cancelEdit.textContent = 'Отменить редактирование'; cancelEdit.hidden = true; form.append(cancelEdit);
  let items = [], portfolios = [], instruments = [], page = 0, enabled = false, busy = false, editingId = null, revision = 0, loadState = 'initial';
  let editingVersion = null, conflict = null, riskScenario, riskScenarioTouched = false, preparedCatalogUid = null;
  let identityUpdates = [], pendingRead = null, instrumentPicker;
  instrumentPicker=createPlanInstrumentPicker({select:element('planInstrument'),
    getRows:()=>[...instruments.filter(row=>row.portfolioId===element('planAccount').value),...getCatalog().filter(row=>row.instrumentOrigin?.provider==='tinvest'&&row.instrumentOrigin?.market==='broker'&&['share','future','bond','etf','currency'].includes(row.assetType))],
    getSelected:()=>getCatalogInstrument(element('planInstrument').value)||instruments.find(row=>row.instrumentUid===element('planInstrument').value),
    onSelect:row=>{preparedCatalogUid=row.instrumentUid;instrumentChoices(row.instrumentUid);element('planInstrument').dispatchEvent(new Event('change',{bubbles:true}));}});
  const selectedPortfolio = () => { const value = getSelectedPortfolio(); return typeof value === 'string' ? value : ''; };
  let selection = selectedPortfolio(), selectionRevision = 0;
  const selectedItems = () => { const id = selectedPortfolio(); return id ? items.filter(item => item.portfolioId === id) : items; };
  function syncSelection() {
    const next = selectedPortfolio();
    if (next === selection) return false;
    selection = next; selectionRevision++; page = 0; return true;
  }
  function refreshSelection() {
    // Account filtering is independent of access and request generations: pending saves still complete.
    if (syncSelection()) render();
  }
  const accountKey = id => portfolios.find(row => row.id === id)?.preferenceKey;
  const stableAccount = id => typeof accountKey(id) === 'string' && /^[a-f0-9]{32}$/u.test(accountKey(id));
  const localInstrument = (portfolioId, instrumentUid) => instruments.find(row => row.portfolioId === portfolioId && row.instrumentUid === instrumentUid);
  const metadata = item => localInstrument(item.portfolioId, item.instrumentUid) || getCatalogInstrument(item.instrumentUid);
  const riskHost = document.createElement('div'); riskHost.id = 'planRiskScenario'; riskHost.hidden = true;
  if (typeof form.insertBefore === 'function') form.insertBefore(riskHost, element('planSave')); else form.append(riskHost);
  let removeRiskButton;
  let histories=[];
  const reviewVersions = new Map();
  const closeHistories=()=>histories.forEach(value=>value.close());
  function scopeSignature(){
    const data=getBootstrap()||{},identity=data.identity||data.session?.identity||{},connection=data.connection||{};
    return JSON.stringify([data.environment,data.preview?.static===true,data.preview?.localReview===true,
      identity.preferenceScope||identity.userId||identity.subject||null,data.savedResearch?.ownerScope,
      connection.connected,connection.environment,connection.validatedAt,
      (data.clientProduct?.portfolios||[]).map(row=>[row.id,row.preferenceKey||null])]);
  }
  let scope=scopeSignature();
  const accessCurrent=()=>enabled&&scope===scopeSignature()&&getBootstrap()?.capabilities?.tradingPlan===true;
  const current=version=>version===revision&&accessCurrent();
  const editable = () => accessCurrent() && loadState === 'ready';
  const archiveHost=element('myTradingPlan')?document.createElement('section'):null;
  if(archiveHost){archiveHost.id='planArchive';element('myTradingPlan').append(archiveHost);}
  const archiveView=createPlanArchiveUi({host:archiveHost,request,getAccess:()=>({signature:scopeSignature(),generation:revision,allowed:accessCurrent(),ready:editable()&&!busy,
    ownerScope:getBootstrap()?.identity?.preferenceScope||getBootstrap()?.savedResearch?.ownerScope})});
  function node(tag, text, className) {
    const result = document.createElement(tag);
    if (text !== undefined) result.textContent = text;
    if (className) result.className = className;
    return result;
  }
  function report(message) { status.textContent = message; }
  function focusControl(target) {
    if (!target) return;
    if(target===element('planInstrument'))target=form.querySelector?.('.plan-instrument-choice')||target;
    const bar = document.querySelector?.('.topbar');
    if (bar && target.style) target.style.scrollMarginTop = Math.ceil(bar.getBoundingClientRect().height + 12) + 'px';
    if (target.style) target.style.scrollMarginBottom = '12px';
    target.focus({ preventScroll: true }); target.scrollIntoView?.({ block: 'nearest', behavior: 'instant' });
  }
  function openEditor(item) {
    preparedCatalogUid = null; editingId = item.id; editingVersion = item.writeVersion; showEditor(true);
    element('planAccount').value = item.portfolioId; instrumentChoices(item.instrumentUid);
    for (const [id, field] of [['planDate', 'plannedFor'], ['planAction', 'action'], ['planEntry', 'entryPrice'], ['planStop', 'stopPrice'], ['planTarget', 'targetPrice'], ['planNote', 'note']]) element(id).value = item[field] ?? '';
    detailsEditor.set(item.planDetails); setPriceBasis(item.priceBasis); riskScenario = item.riskScenario; riskScenarioTouched = Boolean(riskScenario); renderRiskScenario();
    element('planSave').textContent = 'Сохранить изменения';
    report('Редактирование локального черновика. Сделки не исполняются.'); focusControl(element('planDate'));
  }
  function renderRecovery(restoreFocus = false) {
    if (!recovery) return;
    recovery.replaceChildren(); recovery.hidden = !conflict;
    if (!conflict) return;
    const button = node('button', conflict.needsReload ? 'Перечитать журнал' : 'Открыть текущую версию вместо моих полей', 'button');
    button.type = 'button'; button.dataset.planConflictAction = conflict.needsReload ? 'read' : 'open';
    button.addEventListener('click', () => {
      if (busy || !accessCurrent() || loadState === 'loading') return;
      if (conflict.needsReload) { void refresh(); return; }
      const latest = items.find(item => item.id === editingId);
      conflict = null;
      if (latest) openEditor(latest);
      else { editingId = null; editingVersion = null; element('planSave').textContent = 'Сохранить идею'; report('Новая идея подготовлена из ваших полей. Для сохранения нажмите «Сохранить идею».'); focusControl(element('planNote')); }
      renderRecovery(); controls();
    });
    if (!conflict.needsReload) {
      const latest = items.find(item => item.id === editingId);
      recovery.append(node('p', latest ? 'Ваши поля сохранены в редакторе. Открытие текущей версии заменит их. Текущая заметка: ' + (latest.note || 'Без заметки')
        : 'Эта идея больше недоступна в журнале. Ваши поля остались в редакторе; можно явно подготовить отдельную новую идею.'));
      if (!latest) { button.textContent = 'Подготовить новую идею из моих полей'; button.dataset.planConflictAction = 'new'; }
    }
    recovery.append(button); if (restoreFocus) focusControl(button);
  }
  function changed(error, id) {
    if (!['TRADING_PLAN_CONFLICT', 'TRADING_PLAN_NOT_FOUND'].includes(error?.code)) return false;
    conflict = { id, needsReload: true };
    report('План изменён или удалён после открытия. Ваши поля остались в редакторе. Перечитайте журнал перед следующим изменением.');
    renderRecovery();
    if (document.activeElement === document.body || form.contains?.(document.activeElement) || list.contains?.(document.activeElement)) focusControl(recovery?.querySelector?.('button'));
    return true;
  }
  function showEditor(visible) {
    form.hidden = !visible;
    add?.setAttribute('aria-expanded', String(visible));
    if (add) add.textContent = visible ? 'Закрыть редактор' : 'Новая идея';
    cancelEdit.hidden = !visible;
  }
  function controls() {
    archiveView.update(); detailsEditor.disable(!editable() || busy);
    if (removeRiskButton) removeRiskButton.disabled = !editable() || busy;
    for (const id of FIELDS) if (element(id)) element(id).disabled = !editable() || busy;
    priceBasisControls();
    cancelEdit.disabled = busy;
    if (add) add.disabled = !editable() || busy;
    element('planInstrument').disabled ||= !element('planAccount').value;
    element('planSave').disabled ||= !element('planInstrument').value;
    element('planSave').disabled ||= Boolean(conflict);
    if (add) add.disabled ||= Boolean(conflict);
    for (const button of list.querySelectorAll('button,select')) button.disabled = busy || (button.dataset.planRecovery !== 'true' && (!editable() || button.dataset.planUnavailable === 'true'));
    for (const button of list.querySelectorAll('[data-plan-mutation]')) button.disabled ||= Boolean(conflict);
    for (const button of recovery?.querySelectorAll('button') || []) button.setAttribute('aria-disabled', String(busy || loadState === 'loading' || !accessCurrent()));
    element('manualPlanPrevious').disabled = !editable() || busy || page === 0;
    element('manualPlanNext').disabled = !editable() || busy || (page + 1) * PAGE_SIZE >= selectedItems().length;
    refreshChartActions();
    instrumentPicker?.refresh();
  }
  function refreshChartActions(){
    for(const button of list.querySelectorAll('[data-plan-chart]')){
      const item=items.find(value=>value.id===button.dataset.planChart),availability=chartAvailability(item?.instrumentUid);
      button.disabled=!item||!editable()||busy||Boolean(conflict)||!availability.available;
      button.title=availability.available?'График инструмента в терминале':availability.reason;
    }
  }
  function openPlanChart(item,button){
    const version=revision,originPage=page,originSelection=selectedPortfolio(),originSelectionRevision=selectionRevision;
    const isCurrent=()=>current(version)&&selectionRevision===originSelectionRevision&&selectedPortfolio()===originSelection&&page===originPage&&editable()&&!busy&&!conflict&&items.some(value=>value.id===item.id&&value.writeVersion===item.writeVersion&&value.instrumentUid===item.instrumentUid&&value.portfolioId===item.portfolioId);
    if(!isCurrent()||!chartAvailability(item.instrumentUid).available)return;
    onOpenChart?.(item.instrumentUid,{route:'journal',label:'К идее',fallbackLabel:'К журналу',isCurrent,restoreFocus:()=>{
      const target=button.isConnected?button:[...list.querySelectorAll('[data-plan-chart]')].find(value=>value.dataset.planChart===item.id);
      if(!isCurrent()||!target||target.disabled||!target.getClientRects().length)return false;
      focusControl(target);return true;
    }});
  }
  function choices(select, values, previous) {
    select.replaceChildren(...values.map(({ value, label }) => {
      const option = node('option', label); option.value = value; return option;
    }));
    if (values.some(item => item.value === previous)) select.value = previous;
  }
  function instrumentChoices(preferred = element('planInstrument').value) {
    const portfolioId = element('planAccount').value, rows = instruments.filter(item => item.portfolioId === portfolioId);
    const values = rows.map(item => ({ value: item.instrumentUid, label: instrumentLabel(item) }));
    // Only the exact prepared/saved choice is added; the whole catalogue is never copied into every account selector.
    const saved = items.find(item => item.id === editingId), extra = preparedCatalogUid || saved?.instrumentUid;
    for (const uid of new Set([extra, ...(editingId || preparedCatalogUid ? [preferred] : [])].filter(Boolean))) {
      if (values.some(item => item.value === uid)) continue;
      const meta = getCatalogInstrument(uid);
      values.push({ value: uid, label: meta ? instrumentLabel(meta) : saved?.instrumentUid === uid
        ? 'Ранее выбранный инструмент — название недоступно' : 'Выбранный инструмент сейчас недоступен' });
    }
    choices(element('planInstrument'), values, preferred);
    controls();
  }
  function refreshCatalog() {
    if (!accessCurrent()) return;
    instrumentChoices();
    for (const update of identityUpdates) update();
    refreshChartActions();
  }
  function syncChoices() {
    const data = getBootstrap() || {};
    enabled = data.capabilities?.tradingPlan === true;
    portfolios = data.clientProduct?.portfolios || [];
    const seen = new Set();
    instruments = [...(data.instruments || []), ...(data.positions || [])].filter(item => {
      const key = `${item.portfolioId}:${item.instrumentUid}`;
      if (!item.instrumentUid || !portfolios.some(portfolio => portfolio.id === item.portfolioId) || seen.has(key)) return false;
      seen.add(key); return true;
    });
    choices(element('planAccount'), portfolios.map(item => ({ value: item.id, label: item.label || 'Портфель' })), element('planAccount').value);
    instrumentChoices();
  }
  function priceBasisControls() {
    const currency = element('planPriceCurrency'), label = element('planPriceCurrencyField');
    const money = element('planPriceUnit')?.value === 'money-per-unit';
    if (label) label.hidden = !money;
    if (currency) { currency.required = money; currency.disabled = !money || !editable() || busy; }
  }
  function setPriceBasis(basis) {
    if (element('planPriceUnit')) element('planPriceUnit').value = basis?.unit || '';
    if (element('planPriceCurrency')) element('planPriceCurrency').value = basis?.currency || '';
    priceBasisControls();
  }
  function renderRiskScenario() {
    riskHost.replaceChildren(); riskHost.hidden = !riskScenario; removeRiskButton = null;
    if (!riskScenario) return;
    appendPlanRiskScenario(riskHost, { riskScenario }, { draft: true });
    riskHost.append(node('p', 'Расчёт сохранится с этой версией. Для других уровней перенесите новый расчёт или уберите этот.'));
    removeRiskButton = node('button', 'Убрать расчёт из этой версии', 'button'); removeRiskButton.type = 'button';
    removeRiskButton.disabled = !editable() || busy;
    removeRiskButton.addEventListener('click', () => {
      if (!editable() || busy || conflict) return;
      riskScenario = undefined; riskScenarioTouched = true; renderRiskScenario();
      report('Расчёт убран из редактора. Цены и прежние сохранённые версии не изменены. Сохраните идею, чтобы принять изменение.'); focusControl(element('planEntry'));
    });
    riskHost.append(removeRiskButton);
  }
  function prepareRiskScenario(input) {
    if (!editable() || busy || conflict) return { prepared: false, message: 'Журнал пока недоступен для новой идеи. Дождитесь загрузки или откройте журнал и устраните ошибку.' };
    if (!form.hidden) { openJournal(); report('Сначала сохраните или закройте открытый редактор. Его поля сохранены.'); focusControl(element('planNote')); return { prepared: false, message: '' }; }
    let captured; try { captured = createPlanRiskScenario(input); } catch { return { prepared: false, message: 'Не удалось перенести расчёт. Проверьте параметры калькулятора.' }; }
    if (!captured) return { prepared: false, message: 'Сначала выполните расчёт позиции.' };
    const fields = scenarioPlanFields(captured.input);
    resetEditor(); riskScenario = captured; riskScenarioTouched = true;
    for (const [id, field] of [['planAction', 'action'], ['planEntry', 'entryPrice'], ['planStop', 'stopPrice'], ['planTarget', 'targetPrice']]) element(id).value = fields[field] ?? '';
    setPriceBasis(fields.priceBasis); element('planInstrument').value = ''; renderRiskScenario(); showEditor(true); controls();
    openJournal(); report('Расчёт перенесён в новую идею. Выберите счёт и инструмент, проверьте дату и сохраните. Параметры инструмента заданы вами.'); focusControl(element('planInstrument'));
    return { prepared: true, message: 'Новая идея подготовлена. Сохраните её в журнале.' };
  }
  function prepareTerminalPlan(input, { instrumentUid, portfolioId, isCurrent } = {}) {
    if (!editable() || busy || conflict) return { prepared: false, message: 'Журнал пока недоступен для новой идеи. Дождитесь загрузки или откройте журнал и устраните ошибку.' };
    if (typeof isCurrent !== 'function' || isCurrent() !== true) return { prepared: false, message: 'Контекст изменился. Выберите инструмент заново и повторите перенос.' };
    if (!form.hidden) { openJournal(); report('Сначала сохраните или закройте открытый редактор. Его поля сохранены.'); focusControl(element('planNote')); return { prepared: false, message: '' }; }
    const catalog = getCatalogInstrument(instrumentUid);
    const accounts = portfolios.filter(item => localInstrument(item.id, instrumentUid) || catalog && stableAccount(item.id)).map(item => item.id);
    if (!accounts.length || portfolioId && !accounts.includes(portfolioId)) return { prepared: false, message: 'Не удалось подтвердить инструмент или выбранный счёт. Обновите данные и повторите перенос.' };
    if (!portfolioId && accounts.length !== 1) return { prepared: false, message: 'Инструмент доступен на нескольких счетах. Выберите один счёт сверху и повторите перенос.' };
    let fields; try { fields = terminalPlanDraft(input); } catch (error) { return { prepared: false, message: error.message }; }
    if (!isCurrent()) return { prepared: false, message: 'Контекст изменился. Повторите перенос.' };
    resetEditor(); preparedCatalogUid = catalog ? instrumentUid : null; element('planAccount').value = portfolioId || accounts[0]; instrumentChoices(instrumentUid);
    for (const [id, field] of [['planAction', 'action'], ['planEntry', 'entryPrice'], ['planStop', 'stopPrice'], ['planTarget', 'targetPrice'], ['planNote', 'note']]) element(id).value = fields[field];
    showEditor(true); controls(); openJournal();
    report('Уровни и условие перенесены; количество лотов — в заметке. Выберите единицы цен, проверьте счёт и дату, затем сохраните идею.'); focusControl(element('planPriceUnit'));
    return { prepared: true, message: 'Новая идея подготовлена. Сохраните её в журнале.' };
  }
  function resetEditor() {
    detailsEditor.set();
    riskScenario = undefined; riskScenarioTouched = false; renderRiskScenario();
    editingId = null; editingVersion = null; preparedCatalogUid = null; cancelEdit.hidden = true;
    for (const id of ['planEntry', 'planStop', 'planTarget', 'planNote']) element(id).value = '';
    element('planAction').value = 'watch';
    setPriceBasis();
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    element('planDate').value = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    element('planSave').textContent = 'Сохранить идею';
    const selected = selectedPortfolio();
    if (selected) element('planAccount').value = portfolios.some(item => item.id === selected) ? selected : '';
    instrumentChoices();
  }
  function render() {
    for(const history of histories)history.dispose();histories=[];identityUpdates=[];
    syncSelection();
    const filtered = selectedItems();
    page = Math.max(0, Math.min(page, Math.ceil(filtered.length / PAGE_SIZE) - 1));
    const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    list.replaceChildren();
    list.dataset.state = loadState;
    list.setAttribute('aria-busy', String(loadState === 'loading'));
    if (summary) summary.hidden = loadState !== 'ready';
    if (ledgerHead) ledgerHead.hidden = loadState !== 'ready' || filtered.length === 0;
    if (loadState !== 'ready') {
      summary?.replaceChildren();
      element('manualPlanCount').textContent = '';
      element('manualPlanCount').closest?.('nav')?.toggleAttribute('hidden', true);
      if (loadState === 'error') {
        const retry = node('button', 'Повторить загрузку', 'button');
        retry.type = 'button'; retry.dataset.planRecovery = 'true';
        retry.addEventListener('click', () => void refresh().then(() => {
          (loadState === 'ready' ? add : list.querySelectorAll('button')[0])?.focus();
        })); const recovery = node('div', undefined, 'empty-copy'); recovery.append(retry); list.append(recovery);
      } else if (loadState === 'unavailable' && element('riskCalculatorTab')) {
        const calculator = node('button', 'Открыть калькулятор', 'button');
        calculator.type = 'button'; calculator.dataset.planRecovery = 'true';
        calculator.addEventListener('click', () => { element('riskCalculatorTab').click(); element('riskCalculatorTab').focus(); });
        const recovery = node('div', undefined, 'empty-copy'); recovery.append(calculator); list.append(recovery);
      }
      controls(); return;
    }
    if (summary) {
      summary.replaceChildren(...[['Всего идей', filtered.length], ['Наблюдение', filtered.filter(item => item.action === 'watch').length], ['Покупка', filtered.filter(item => item.action === 'buy').length], ['Продажа', filtered.filter(item => item.action === 'sell').length]].map(([label, count]) => {
        const item = node('span'); item.append(node('strong', String(count)), node('span', label)); return item;
      }));
    }
    if (!visible.length) list.append(node('p', selectedPortfolio() ? 'На этом счёте ещё нет идей. Добавьте инструмент, условия и дату пересмотра.' : 'Добавьте первую идею: инструмент, условия и дату пересмотра.', 'empty-copy'));
    for (const item of visible) {
      const row = node('article', undefined, 'manual-plan-row');
      const meta = metadata(item);
      const portfolio = portfolios.find(value => value.id === item.portfolioId);
      const identity = node('div', undefined, 'plan-draft-identity');
      const mark=node('span',undefined,'instrument-mark'), ticker=node('strong'), name=node('small');
      const title=node('span',undefined,'instrument-cell');title.append(ticker,name);
      let chart;
      if(onOpenChart){
        chart=node('button',undefined,'position-chart-link plan-chart-link');chart.type='button';
        const icon=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS('http://www.w3.org/2000/svg','path');
        icon.setAttribute('aria-hidden','true');icon.setAttribute('viewBox','0 0 24 24');path.setAttribute('d','M4 3v18h17M7 15l4-5 4 3 5-7');icon.append(path);chart.append(icon);
        chart.dataset.planChart=item.id;chart.addEventListener('click',()=>openPlanChart(item,chart));title.append(chart);
      }
      identity.append(mark,title);row.append(identity);
      const date = /^\d{4}-\d{2}-\d{2}$/u.test(item.plannedFor) ? item.plannedFor.split('-').reverse().join('.') : 'Дата не указана';
      const plan=node('div',undefined,'plan-draft-plan');plan.dataset.action=item.action||'draft';plan.append(node('strong',ACTIONS[item.action]||'Черновик'));
      const prices = [['от', item.entryPrice], ['Стоп', item.stopPrice], ['Цель', item.targetPrice]].filter(([, value]) => value !== null && value !== undefined && value !== '');
      const unit=planPriceUnitLabel(item.priceBasis);
      if (prices.length) {
        const priceList = node('dl', undefined, 'plan-draft-prices');
        for (const [label, value] of prices) { const part = node('div'); part.append(node('dt', label), node('dd', String(value).replace('.', ','))); priceList.append(part); }
        plan.append(priceList);plan.append(node('small',unit?'Уровни в единицах «'+unit+'» · указаны вами':'Единицы уровней не сохранены'));
      } else plan.append(node('small','Уровни не заданы'));
      if(item.planDetails)appendPlanDetails(plan,item.planDetails);
      row.append(plan);
      const review=node('div',undefined,'plan-draft-review');review.append(node('strong',date),node('small',portfolio?.label||'Портфель'));row.append(review);
      // An active idea past its review date says so; closed ideas stay quiet.
      const today=new Date(Date.now()+3*3600000).toISOString().slice(0,10);
      if(/^\d{4}-\d{2}-\d{2}$/u.test(item.plannedFor)&&item.plannedFor<today&&!['completed','cancelled'].includes(item.status)){review.dataset.overdue='true';review.append(node('small','Пора пересмотреть','plan-draft-overdue'));}
      const state=node('div',undefined,'plan-draft-state');
      const statusSelect=node('select',undefined,'plan-status-select');
      statusSelect.dataset.planMutation = 'true';
      statusSelect.dataset.planId = item.id;
      statusSelect.setAttribute('aria-label',`Статус идеи ${instrumentLabel(meta)}`);
      for(const [value,label] of Object.entries(STATUSES)){const option=node('option',label);option.value=value;statusSelect.append(option);}
      statusSelect.value=Object.hasOwn(STATUSES,item.status)?item.status:'draft';
      statusSelect.dataset.status=statusSelect.value;
      statusSelect.addEventListener('change',async()=>{
        const previous=item.status||'draft', next=statusSelect.value;
        if(busy||!editable()||conflict){statusSelect.value=previous;return;}
        const hadFocus = document.activeElement === statusSelect;
        closeHistories();busy=true;const version=++revision;controls();
        try{
          const data=await request(`/api/trading-plan/${encodeURIComponent(item.id)}/status`,{method:'POST',body:JSON.stringify({status:next,expectedVersion:item.writeVersion})});
          if(!current(version))return;
          const restoreFocus = hadFocus && (document.activeElement === document.body || document.activeElement === statusSelect);
          accept(data);report('Статус идеи сохранён.');
          if (restoreFocus) { busy=false;controls();focusControl([...list.querySelectorAll('select')].find(row=>row.dataset.planId===item.id)); }
        }
        catch(error){if(current(version)){statusSelect.value=previous;if(!changed(error,item.id))report(error.message||'Не удалось изменить статус.');}}
        finally{if(current(version)){busy=false;controls();}}
      });
      state.append(statusSelect);row.append(state);
      row.append(node('p', item.note||'Добавьте заметку к идее', 'plan-draft-note'));
      const more=node('button','Разобрать план','button plan-draft-more');more.type='button';more.setAttribute('aria-label',`Разобрать план: ${instrumentLabel(meta)}`);more.setAttribute('aria-expanded','false');
      const detail=node('section',undefined,'plan-draft-detail');detail.hidden=true;
      let workspace;
      const sources = owner => ({ onOpenSource: value => workspace?.showSource({ ...value, owner }), onInvalidateSource: () => workspace?.hideSource(false, owner) });
      const history=createPlanHistoryDisclosure({planId:item.id,request,getRevision:()=>revision,isCurrent:current,getPortfolios:()=>portfolios,
        labelInstrument:value=>instrumentLabel(metadata(value)),canOpen:()=>editable()&&!busy,review:true,...sources('history'),getCachedHistory:()=>links?.getHistory()});
      const observations=getBootstrap()?.capabilities?.executionObservations===true?createExecutionObservationsDisclosure({portfolioId:item.portfolioId,instrumentUid:item.instrumentUid,
        request,getRevision:()=>revision,isCurrent:version=>current(version)&&getBootstrap()?.capabilities?.executionObservations===true,
        canOpen:()=>editable()&&!busy&&getBootstrap()?.capabilities?.executionObservations===true}):null;
      const timeline=getBootstrap()?.capabilities?.decisionTimeline===true?createDecisionTimelineDisclosure({planId:item.id,portfolioId:item.portfolioId,instrumentUid:item.instrumentUid,
        request,getRevision:()=>revision,isCurrent:version=>current(version)&&getBootstrap()?.capabilities?.decisionTimeline===true,
        canOpen:()=>editable()&&!busy&&getBootstrap()?.capabilities?.decisionTimeline===true,getPortfolioIds:()=>portfolios.map(value=>value.id),review:true,...sources('timeline'),onReload:()=>{links?.close();history.close();}}):null;
      const links=getBootstrap()?.capabilities?.planExecutionLinks===true?createPlanExecutionLinksDisclosure({planId:item.id,getPlanVersion:()=>item.writeVersion,
        request,getRevision:()=>revision,isCurrent:version=>current(version)&&getBootstrap()?.capabilities?.planExecutionLinks===true,
        getPortfolios:()=>portfolios,labelInstrument:value=>instrumentLabel(metadata(value)),
        canOpen:()=>editable()&&!busy&&!conflict&&getBootstrap()?.capabilities?.planExecutionLinks===true,reloadPlan:()=>refresh(),onWrite:pending=>{workspace?.setWriting(pending);timeline?.close();history.close();workspace?.hideSource(false,'compare');},onReload:()=>{timeline?.close();history.close();},
        review:true,getSelectedVersion:()=>reviewVersions.get(item.id),onSelectedVersion:value=>reviewVersions.set(item.id,value),...sources('compare')}):null;
      row.append(more);
      const edit = node('button', 'Изменить', 'button'); edit.type = 'button';
      edit.dataset.planMutation = 'true';
      edit.addEventListener('click', () => {
        if (busy || !editable() || conflict) return;
        openEditor(item);
      });
      const remove = node('button', 'Удалить', 'button'); remove.type = 'button';
      remove.dataset.planMutation = 'true';
      remove.setAttribute('aria-label', `Удалить черновик ${instrumentLabel(meta)} на ${date}`);
      remove.addEventListener('click', () => mutate(`/api/trading-plan/${encodeURIComponent(item.id)}`, { method: 'DELETE', body: JSON.stringify({ expectedVersion: item.writeVersion }) }, 'Черновик удалён.', item.id));
      const updateIdentity = () => {
        const currentMeta = metadata(item), label = instrumentLabel(currentMeta), logo = instrumentLogo(currentMeta || {});
        mark.replaceChildren();
        if (logo) { const img=node('img');img.src=logo;img.alt='';img.loading='lazy';img.addEventListener('error',()=>{img.hidden=true;});mark.append(img); } else mark.textContent='◇';
        ticker.textContent = textLabel(currentMeta?.ticker) || 'Инструмент'; name.textContent = issuerName(textLabel(currentMeta?.ticker), textLabel(currentMeta?.name)) || 'Название недоступно';
        chart?.setAttribute('aria-label', 'Открыть график: ' + label);
        statusSelect.setAttribute('aria-label', 'Статус идеи ' + label); more.setAttribute('aria-label', 'Разобрать план: ' + label);
        remove.setAttribute('aria-label', 'Удалить черновик ' + label + ' на ' + date);
      };
      identityUpdates.push(updateIdentity); updateIdentity();
      const discuss=node('button','Разобрать с Nexus AI','button');discuss.type='button';
      discuss.hidden=typeof onDiscussPlan!=='function'||getBootstrap()?.capabilities?.nexusAi!==true;
      discuss.addEventListener('click',()=>{if(editable()&&!busy)onDiscussPlan?.(item);});
      workspace=createPlanReviewWorkspace({region:detail,opener:more,title:'Разбор плана · '+instrumentLabel(meta),context:`${portfolio?.label||'Портфель'} · пересмотр ${date}`,
        widgets:[...(links?[{key:'compare',label:'План и исполнения',widget:links}]:[]),...(timeline?[{key:'timeline',label:'Лента событий',widget:timeline}]:[]),
          {key:'history',label:'Версии плана',widget:history},...(observations?[{key:'observations',label:'Наблюдения исполнений',widget:observations}]:[])],
        actions:[discuss,edit,remove],canOpen:()=>editable()&&!busy,closeOthers:closeHistories});
      if(!links)detail.append(node('p','Сравнение со связанными исполнениями недоступно в текущем контексте. Можно прочитать доступные версии плана.','plan-review-limit'));
      histories.push(workspace);row.append(detail);list.append(row);
    }
    element('manualPlanCount').textContent = filtered.length ? `${page * PAGE_SIZE + 1}–${page * PAGE_SIZE + visible.length} из ${filtered.length}` : '';
    element('manualPlanCount').closest?.('nav')?.toggleAttribute('hidden', filtered.length <= PAGE_SIZE);
    controls();
  }
  function accept(data) {
    if (!data || data.persistence !== 'local-drafts' || data.execution !== 'none' || !Array.isArray(data.items) || data.items.length > 200
      || data.items.some(item => !item || !writeVersion(item.writeVersion) || Object.hasOwn(item, 'priceBasis') && !validPlanPriceBasis(item.priceBasis)
        || Object.hasOwn(item || {}, 'planDetails') && !validPlanDetails(item.planDetails)
        || Object.hasOwn(item || {}, 'riskScenario') && !validPlanRiskScenario(item.riskScenario, item))) throw Object.assign(new Error('Не удалось проверить ответ журнала идей.'), { code: 'TRADING_PLAN_RESPONSE_INVALID' });
    items = data.items.filter(item => portfolios.some(portfolio => portfolio.id === item.portfolioId));
    loadState = 'ready';
    render();
  }
  async function mutate(path, options, success, deletedId) {
    if (!editable() || busy || conflict) return;
    const priorFocus = document.activeElement, hadFocus = form.contains?.(priorFocus) || list.contains?.(priorFocus);
    closeHistories();busy = true; const version = ++revision; controls(); report('Сохранение черновика…');
    try {
      const data = await request(path, options);
      if (!current(version)) return;
      const restoreFocus = hadFocus && (document.activeElement === document.body || document.activeElement === priorFocus);
      accept(data);
      if (!deletedId || editingId === deletedId) { resetEditor(); if (add) showEditor(false); }
      const message = typeof success === 'function' ? success() : success;
      report(message); showToast(message);
      if (restoreFocus) { busy=false;controls();focusControl(add); }
    } catch (error) { if (current(version) && !changed(error, deletedId || editingId)) report(error.message || 'Не удалось сохранить черновик. Повторите попытку.'); }
    finally { if(current(version)){busy = false; controls();} }
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!editable() || busy || conflict || !form.reportValidity()) return;
    const draft = {
      portfolioId: element('planAccount').value, instrumentUid: element('planInstrument').value,
      plannedFor: element('planDate').value, action: element('planAction').value,
      entryPrice: element('planEntry').value.trim().replace(',', '.') || null,
      stopPrice: element('planStop').value.trim().replace(',', '.') || null,
      targetPrice: element('planTarget').value.trim().replace(',', '.') || null,
      note: element('planNote').value,
      ...(editingId ? { id: editingId, expectedVersion: editingVersion } : {}),
    };
    try { const details=detailsEditor.read(); if(details || editingId && items.find(row=>row.id===editingId)?.planDetails) draft.planDetails=details; }
    catch(error){report(error.message);detailsEditor.focus();return;}
    if (element('planPriceUnit')) {
      const unit = element('planPriceUnit').value;
      const basis = unit ? { unit, currency: unit === 'money-per-unit' ? element('planPriceCurrency').value : null } : null;
      try { const checked = declaredPlanPriceBasis(basis); draft.priceBasis = checked ? { unit: checked.unit, currency: checked.currency } : null; }
      catch { report('Укажите единицы цен и трёхбуквенный код валюты, например RUB.'); focusControl(element('planPriceCurrency')); return; }
    }
    try { if (riskScenario) createPlanRiskScenario(riskScenario.input, draft); if (riskScenarioTouched) draft.riskScenario = riskScenario?.input ?? null; }
    catch (error) { report(error.message); focusControl(removeRiskButton); return; }
    const saved = items.find(item => item.id === editingId);
    const retained = saved?.portfolioId === draft.portfolioId && saved?.instrumentUid === draft.instrumentUid;
    if (!retained && !localInstrument(draft.portfolioId, draft.instrumentUid) && !(stableAccount(draft.portfolioId) && getCatalogInstrument(draft.instrumentUid))) {
      report('Не удалось подтвердить инструмент или выбранный счёт. Поля сохранены. Обновите данные и проверьте выбор.'); focusControl(element('planInstrument')); return;
    }
    if (stableAccount(draft.portfolioId)) draft.expectedAccountKey = accountKey(draft.portfolioId);
    void mutate('/api/trading-plan', { method: 'POST', body: JSON.stringify(draft) }, () => {
      const selected = selectedPortfolio();
      return selected && selected !== draft.portfolioId
        ? 'Черновик сохранён на этом устройстве, на счёте «' + (portfolios.find(item => item.id === draft.portfolioId)?.label || 'Портфель') + '». Чтобы увидеть запись, выберите этот счёт.'
        : 'Черновик сохранён на этом устройстве.';
    });
  });
  element('planAccount').addEventListener('change', () => { if (!riskScenario) setPriceBasis(); instrumentChoices(preparedCatalogUid || (editingId ? element('planInstrument').value : '')); });
  element('planInstrument').addEventListener('change', () => { if (!riskScenario) setPriceBasis(); });
  element('planPriceUnit')?.addEventListener('change', () => { if (element('planPriceUnit').value !== 'money-per-unit') element('planPriceCurrency').value = ''; priceBasisControls(); });
  element('manualPlanPrevious').addEventListener('click', () => { if (!busy) { page--; render(); } });
  element('manualPlanNext').addEventListener('click', () => { if (!busy) { page++; render(); } });
  async function refresh() {
    syncChoices();
    const nextScope=scopeSignature();
    if(nextScope!==scope){
      revision++;scope=nextScope;busy=false;pendingRead=null;loadState='initial';items=[];page=0;conflict=null;reviewVersions.clear();resetEditor();showEditor(false);renderRecovery();
    }
    if (!enabled) {
      // Access changes must invalidate pending reads and writes even while busy.
      revision++;busy=false;pendingRead=null;conflict=null;renderRecovery();
      riskHost.replaceChildren(); riskHost.hidden = true; removeRiskButton = null;
      items = []; loadState = 'unavailable'; render();
      report(getBootstrap()?.preview?.static === true
        ? 'Журнал идей недоступен в этом демо. Свои идеи можно сохранять в приложении.'
        : 'Журнал идей недоступен в этой версии приложения.');
      return;
    }
    if (riskScenario && riskHost.hidden) renderRiskScenario();
    if (busy) return;
    if (pendingRead?.version === revision) return pendingRead.promise;
    const version = ++revision;
    const alreadyLoaded = loadState === 'ready';
    if (!alreadyLoaded) { loadState = 'loading'; render(); report('Загружаем журнал идей…'); }
    // A bootstrap refresh must not disable an already loaded journal or keep
    // superseding its own slow read. Writes still invalidate this read by revision.
    const read = { version, promise: null }; pendingRead = read;
    read.promise = (async () => {
    try { const data = await request('/api/trading-plan'); if (current(version)) {
      accept(data);
      const restoreFocus = recovery?.contains?.(document.activeElement) === true;
      if (conflict) {
        if (editingId === conflict.id && !form.hidden) { conflict.needsReload = false; report('Журнал перечитан. Ваши поля не заменены и ещё не сохранены.'); }
        else { conflict = null; report('Журнал перечитан. Проверьте актуальную запись перед следующим действием.'); }
        renderRecovery(restoreFocus); controls(); if (restoreFocus && !conflict) focusControl(add);
      } else report('');
    } }
    catch (error) {
      if (!current(version)) return;
      if (alreadyLoaded && !conflict && error?.code !== 'TRADING_PLAN_RESPONSE_INVALID' && !(error?.status >= 400 && error.status < 500)) {
        report('Не удалось обновить журнал. Показаны ранее загруженные идеи; ваши поля сохранены.');
        controls(); return;
      }
      loadState = 'error'; render();
      if (conflict) { conflict.needsReload = true; renderRecovery(); }
      report(error?.code === 'TRADING_PLAN_RESPONSE_INVALID'
        ? 'Не удалось проверить ответ журнала идей. Количество записей пока неизвестно. Повторите загрузку.'
        : 'Не удалось открыть журнал идей. Количество записей пока неизвестно. Повторите загрузку.');
    }
    finally { if (pendingRead === read) pendingRead = null; }
    })();
    return read.promise;
  }
  cancelEdit.textContent = 'Отмена';
  cancelEdit.addEventListener('click', () => { if (!busy) { resetEditor(); if (add) showEditor(false); if (conflict && !conflict.needsReload) conflict=null; renderRecovery();controls();if (loadState === 'ready') report('План хранится на этом устройстве.'); } });
  add?.addEventListener('click', () => {
    if (!editable() || busy) return;
    const opening = form.hidden;
    if (opening) resetEditor();
    showEditor(opening);
    if (opening) focusControl(element('planInstrument'));
  });
  resetEditor(); syncChoices(); render();
  return { refresh, refreshSelection, prepareRiskScenario, prepareTerminalPlan, refreshChartActions, refreshCatalog };
}
