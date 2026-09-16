const PAGE_SIZE = 8;
const ACTIONS = { watch: 'Наблюдение', buy: 'План покупки', sell: 'План продажи' };
const FIELDS = ['planAccount', 'planInstrument', 'planDate', 'planAction', 'planEntry', 'planStop', 'planTarget', 'planNote', 'planSave'];
const uuid = /^[a-f\d]{8}-[a-f\d-]{20,}$/iu;
const textLabel = (value) => typeof value === 'string' && value.length > 0 && !uuid.test(value) && !value.includes('\ufffd') ? value : '';
const instrumentLabel = (item) => [textLabel(item?.ticker), textLabel(item?.name)].filter((value, index, values) => value && values.indexOf(value) === index).join(' · ') || 'Название инструмента недоступно';

export function initTradingPlan({ request, showToast = () => {}, getBootstrap }) {
  const element = (id) => document.getElementById(id);
  const form = element('tradingPlanEditor');
  if (!form) return { refresh: async () => {} };
  const list = element('manualPlanList');
  const status = element('planEditorStatus');
  const cancelEdit = document.createElement('button'); cancelEdit.type = 'button'; cancelEdit.className = 'button'; cancelEdit.textContent = 'Отменить редактирование'; cancelEdit.hidden = true; form.append(cancelEdit);
  let items = [], portfolios = [], instruments = [], page = 0, enabled = false, busy = false, editingId = null, revision = 0;
  function node(tag, text, className) {
    const result = document.createElement(tag);
    if (text !== undefined) result.textContent = text;
    if (className) result.className = className;
    return result;
  }
  function report(message) { status.textContent = message; }
  function controls() {
    for (const id of FIELDS) element(id).disabled = !enabled || busy;
    cancelEdit.disabled = busy;
    element('planInstrument').disabled ||= !element('planInstrument').options.length;
    element('planSave').disabled ||= !element('planInstrument').options.length;
    for (const button of list.querySelectorAll('button')) button.disabled = !enabled || busy || button.dataset.planUnavailable === 'true';
    element('manualPlanPrevious').disabled = busy || page === 0;
    element('manualPlanNext').disabled = busy || (page + 1) * PAGE_SIZE >= items.length;
  }
  function choices(select, values, previous) {
    select.replaceChildren(...values.map(({ value, label }) => {
      const option = node('option', label); option.value = value; return option;
    }));
    if (values.some(item => item.value === previous)) select.value = previous;
  }
  function instrumentChoices(preferred = element('planInstrument').value) {
    choices(element('planInstrument'), instruments.filter(item => item.portfolioId === element('planAccount').value)
      .map(item => ({ value: item.instrumentUid, label: instrumentLabel(item) })), preferred);
    controls();
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
  function resetEditor() {
    editingId = null; cancelEdit.hidden = true;
    for (const id of ['planEntry', 'planStop', 'planTarget', 'planNote']) element(id).value = '';
    element('planAction').value = 'watch';
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    element('planDate').value = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    element('planSave').textContent = 'Сохранить черновик';
  }
  function render() {
    page = Math.max(0, Math.min(page, Math.ceil(items.length / PAGE_SIZE) - 1));
    const visible = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    list.replaceChildren();
    if (!visible.length) list.append(node('p', 'Пока нет черновиков. Выберите инструмент и запишите свой план.', 'empty-copy'));
    for (const item of visible) {
      const row = node('article', undefined, 'manual-plan-row');
      const meta = instruments.find(instrument => instrument.portfolioId === item.portfolioId && instrument.instrumentUid === item.instrumentUid);
      const portfolio = portfolios.find(value => value.id === item.portfolioId);
      row.append(node('strong', instrumentLabel(meta)));
      const date = /^\d{4}-\d{2}-\d{2}$/u.test(item.plannedFor) ? item.plannedFor.split('-').reverse().join('.') : 'Дата не указана';
      row.append(node('p', `${date} · ${portfolio?.label || 'Портфель'} · ${ACTIONS[item.action] || 'Черновик'}`));
      const prices = [['Вход', item.entryPrice], ['Стоп', item.stopPrice], ['Цель', item.targetPrice]].filter(([, value]) => value !== null && value !== undefined && value !== '');
      if (prices.length) row.append(node('p', prices.map(([label, value]) => `${label}: ${value}`).join(' · '), 'muted'));
      if (item.note) row.append(node('p', item.note, 'plan-draft-note'));
      const actions = node('div', undefined, 'plan-draft-actions');
      const edit = node('button', 'Изменить', 'button'); edit.type = 'button'; edit.dataset.planUnavailable = String(!meta); edit.disabled = !meta;
      edit.addEventListener('click', () => {
        if (busy || !enabled || !meta) return;
        editingId = item.id; cancelEdit.hidden = false;
        element('planAccount').value = item.portfolioId; instrumentChoices(item.instrumentUid);
        for (const [id, field] of [['planDate', 'plannedFor'], ['planAction', 'action'], ['planEntry', 'entryPrice'], ['planStop', 'stopPrice'], ['planTarget', 'targetPrice'], ['planNote', 'note']]) element(id).value = item[field] ?? '';
        element('planSave').textContent = 'Сохранить изменения';
        report('Редактирование локального черновика. Сделки не исполняются.'); element('planDate').focus();
      });
      const remove = node('button', 'Удалить', 'button'); remove.type = 'button';
      remove.setAttribute('aria-label', `Удалить черновик ${instrumentLabel(meta)} на ${date}`);
      remove.addEventListener('click', () => mutate(`/api/trading-plan/${encodeURIComponent(item.id)}`, { method: 'DELETE' }, 'Черновик удалён.', item.id));
      actions.append(edit, remove); row.append(actions); list.append(row);
    }
    element('manualPlanCount').textContent = items.length ? `${page * PAGE_SIZE + 1}–${page * PAGE_SIZE + visible.length} из ${items.length}` : '0 черновиков';
    controls();
  }
  function accept(data) {
    if (!data || data.persistence !== 'local-drafts' || data.execution !== 'none' || !Array.isArray(data.items) || data.items.length > 200) throw new Error('Ответ хранилища черновиков недоступен.');
    items = data.items.filter(item => portfolios.some(portfolio => portfolio.id === item.portfolioId));
    render();
  }
  async function mutate(path, options, success, deletedId) {
    if (!enabled || busy) return;
    busy = true; revision++; controls(); report('Сохранение черновика…');
    try {
      accept(await request(path, options));
      if (!deletedId || editingId === deletedId) resetEditor();
      report(success); showToast(success);
    } catch (error) { report(error.message || 'Не удалось сохранить черновик. Повторите попытку.'); }
    finally { busy = false; controls(); }
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!enabled || busy || !form.reportValidity()) return;
    const draft = {
      portfolioId: element('planAccount').value, instrumentUid: element('planInstrument').value,
      plannedFor: element('planDate').value, action: element('planAction').value,
      entryPrice: element('planEntry').value.trim().replace(',', '.') || null,
      stopPrice: element('planStop').value.trim().replace(',', '.') || null,
      targetPrice: element('planTarget').value.trim().replace(',', '.') || null,
      note: element('planNote').value,
      ...(editingId ? { id: editingId } : {}),
    };
    if (!instruments.some(item => item.portfolioId === draft.portfolioId && item.instrumentUid === draft.instrumentUid)) { report('Выберите доступный инструмент этого счёта.'); return; }
    void mutate('/api/trading-plan', { method: 'POST', body: JSON.stringify(draft) }, 'Черновик сохранён на этом устройстве.');
  });
  element('planAccount').addEventListener('change', () => instrumentChoices(''));
  element('manualPlanPrevious').addEventListener('click', () => { if (!busy) { page--; render(); } });
  element('manualPlanNext').addEventListener('click', () => { if (!busy) { page++; render(); } });
  async function refresh() {
    syncChoices();
    if (!enabled) { items = []; render(); report('Локальный редактор плана недоступен в этой версии.'); return; }
    if (busy) return;
    const version = ++revision;
    report('План хранится на этом устройстве. Покупки и продажи не исполняются.');
    try { const data = await request('/api/trading-plan'); if (version === revision) accept(data); }
    catch (error) { if (version === revision) report(error.message || 'Не удалось загрузить черновики.'); }
  }
  cancelEdit.addEventListener('click', () => { if (!busy) { resetEditor(); report('Новый локальный черновик.'); } });
  resetEditor(); syncChoices(); render();
  return { refresh };
}
