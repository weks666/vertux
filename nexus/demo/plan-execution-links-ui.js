import { validatePlanHistory } from './plan-history-ui.js';
import { validatePlanExecutionLinks, validatePlanExecutionCandidates, PLAN_EXECUTION_LINK_LIMIT } from './plan-execution-links-contract.js';
import { appendPlanRiskScenario } from './plan-risk-scenario-ui.js';
import { createPlanExecutionSizeDisclosure } from './plan-execution-size-ui.js';
import { planPriceUnitLabel, planPriceComparisonText } from './plan-price-basis.js';

const actions = { watch: 'Наблюдение', buy: 'Покупка', sell: 'Продажа' };
const statuses = { draft: 'Черновик', watching: 'Наблюдаю', completed: 'Завершено пользователем', cancelled: 'Отменено' };
const decimal = value => { const text = BigInt(value).toString().padStart(10, '0'), tail = text.slice(-9).replace(/0+$/u, ''); return text.slice(0, -9) + (tail ? ',' + tail : ''); };
const time = value => new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value)) + ' МСК';
const localTime = value => new Intl.DateTimeFormat('ru-RU', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' }).format(new Date(value));
let counter = 0;

export function createPlanExecutionLinksDisclosure({ planId, getPlanVersion, request, getRevision, isCurrent, getPortfolios, labelInstrument, canOpen, reloadPlan, onWrite = () => {}, review = false, getSelectedVersion = () => undefined, onSelectedVersion = () => {}, onOpenSource, onInvalidateSource = () => {}, onReload = () => {} }) {
  const node = (tag, text, className) => { const element = document.createElement(tag); if (text !== undefined) element.textContent = text; if (className) element.className = className; return element; };
  const action = (text, key, handler) => { const element = node('button', text, 'button'); element.type = 'button'; element.dataset.planLinkAction = key; element.addEventListener('click', handler); return element; };
  const button = action('Связи с исполнениями', 'toggle', () => { if (!region.hidden) close(); else if (!disposed && canOpen()) { region.hidden = false; button.setAttribute('aria-expanded', 'true'); void load(); } });
  button.setAttribute('aria-expanded', 'false');
  const region = node('section', undefined, 'plan-execution-links'); region.id = 'plan-execution-links-' + (++counter); region.hidden = true;
  region.setAttribute('role', 'region'); region.setAttribute('aria-label', 'Связи плана с исполнениями'); button.setAttribute('aria-controls', region.id);
  let generation = 0, parentRevision, controller, disposed = false, busy = false, data, history, choices, selected = '', message, form, version, from, to, note, candidateHost, save, linkDraft = null;
  const options = () => ({ planId, portfolioIds: getPortfolios().map(row => row.id) });
  const valid = own => !disposed && own === generation && !region.hidden && isCurrent(parentRevision) && canOpen();
  function close() { generation++; controller?.abort(); controller = null; busy = false; data = history = choices = null; linkDraft = null; selected = ''; onInvalidateSource(); region.hidden = true; region.replaceChildren(); region.setAttribute('aria-busy', 'false'); button.setAttribute('aria-expanded', 'false'); }
  function focus(target) { target?.focus({ preventScroll: true }); target?.scrollIntoView({ block: 'nearest' }); }
  function controls() {
    region.setAttribute('aria-busy', String(busy));
    for (const control of region.querySelectorAll('button,input,select,textarea')) control.disabled = busy;
    if (save) save.disabled = busy || !choices || !selected || data?.items.length >= PLAN_EXECUTION_LINK_LIMIT;
  }
  async function perform(work, success, mutation = false) {
    if (busy || !canOpen()) return;
    busy = true; const own = ++generation; parentRevision = getRevision(); controller?.abort(); controller = new AbortController(); controls();
    if (mutation) onWrite(true);
    try { const value = await work(controller.signal); if (!valid(own)) return; success(value); }
    catch (error) {
      if (!valid(own)) return;
      if (message) {
        region.dataset.state = 'error'; onInvalidateSource();
        message.textContent = [401, 403].includes(error.status) || error.code === 'TRADING_PLAN_CONTEXT_CHANGED'
          ? 'Доступ или счёт изменились. Обновите журнал.' : error.code === 'PLAN_EXECUTION_LINK_LIMIT'
            ? 'Превышен предел данных: сузьте период или проверьте число сохранённых связей.'
            : /CONFLICT/u.test(error.code || '') ? 'План, связи или исполнение изменились. Обновите список перед сохранением.'
              : mutation ? 'Не удалось получить подтверждение. Связь могла сохраниться, если ответ был прерван. Обновите список перед следующим действием.'
                : 'Не удалось прочитать проверенные данные. Повторите чтение.';
        choices = null; selected = ''; candidateHost?.replaceChildren();
        if ([401, 403].includes(error.status) || error.code === 'TRADING_PLAN_CONTEXT_CHANGED') { data = history = null; region.replaceChildren(message, action('Обновить журнал', 'reload-plan', reloadPlan)); }
        else if (error.code === 'TRADING_PLAN_CONFLICT') region.append(action('Обновить журнал', 'reload-plan', reloadPlan));
        if (review && data && (mutation || /CONFLICT/u.test(error.code || ''))) {
          if (note) linkDraft = { note: note.value, version: version.value, from: from.value, to: to.value };
          data = history = null; region.replaceChildren(message, action('Перечитать связи', 'retry', () => { void load(true); }));
          if (note && linkDraft) { const retained = node('label', 'Ваша несохранённая заметка'); retained.append(note); region.append(retained, node('p', 'После перечитывания заметка вернётся в форму. Исполнение потребуется выбрать заново; сохранение автоматически не повторяется.')); }
        }
        focus(message);
      }
    } finally { if (mutation) onWrite(false); if (valid(own)) { busy = false; controls(); } }
  }
  function planView(plan) {
    const value = plan.value, block = node('div', undefined, 'plan-link-plan');
    block.append(node('p', `Версия ${plan.sequence} · ${labelInstrument(value)} · ${getPortfolios().find(row => row.id === value.portfolioId)?.label || 'Счёт'}`));
    block.append(node('p', `${actions[value.action]} · ${statuses[value.status]} · пересмотр ${value.plannedFor.split('-').reverse().join('.')}`));
    const levels = [['Вход', value.entryPrice], ['Стоп', value.stopPrice], ['Цель', value.targetPrice]].filter(([, price]) => price !== null);
    appendPlanRiskScenario(block, value, { inline: review });
    const unit = planPriceUnitLabel(value.priceBasis);
    block.append(node('p', levels.length ? levels.map(([label, price]) => label + ': ' + price.replace('.', ',') + (unit ? ' ' + unit : '')).join(' · ') : 'Уровни в этой версии не заданы.'));
    if (levels.length) block.append(node('p', unit ? 'Единицы цен указаны владельцем при сохранении.' : 'Единицы цены плана не подтверждены.', 'plan-link-caption'));
    block.append(node('p', value.note || 'В этой версии нет заметки.', 'plan-link-note'));
    block.append(node('p', 'Версия зафиксирована по часам устройства: ' + localTime(plan.recordedAt), 'plan-link-caption'));
    if (plan.kind === 'legacy-observation') block.append(node('p', 'Это первая сохранённая копия прежнего содержания. Более ранняя история неизвестна.'));
    if (plan.clockRegressed) block.append(node('p', 'Часы устройства сдвинулись назад. Ориентируйтесь на номер версии.'));
    return block;
  }
  function executionText(execution) { return `${actions[execution.side]} · ${time(execution.at)} · ${decimal(execution.quantityNanos)} ед. × ${decimal(execution.priceNanos)} ${execution.currency}`; }
  function executionView(execution) {
    const block = node('div'); block.append(node('p', executionText(execution)));
    if (execution.executionQuantity?.state === 'partial') {
      const q = execution.executionQuantity;
      block.append(node('p', `В поручении исполнено ${decimal(q.executedNanos)} из ${decimal(q.reportedNanos)} ед.; остаток ${decimal(q.remainingNanos)} ед. Связь относится к одному указанному исполнению.`));
    }
    return block;
  }
  function invalidateChoices() { choices = null; selected = ''; candidateHost.replaceChildren(); message.textContent = ''; controls(); }
  function renderForm() {
    if (!history.items.length || data.items.length >= PLAN_EXECUTION_LINK_LIMIT) {
      region.append(node('p', !history.items.length ? 'Для связи нужна сохранённая версия плана. Отредактируйте и сохраните идею, чтобы впервые зафиксировать её содержание.' : 'Сохранено 100 связей, включая отозванные. Новые связи для этой идеи недоступны.'));
      return;
    }
    form = node('details', undefined, 'plan-link-add'); form.append(node('summary', 'Связать исполнение'));
    const grid = node('div', undefined, 'plan-link-fields');
    const field = (text, input) => { const label = node('label', text); label.append(input); grid.append(label); return input; };
    version = field('Версия плана', node('select')); version.dataset.planLinkField = 'version';
    for (const row of [...history.items].reverse()) { const option = node('option', `Версия ${row.sequence} · ${actions[row.value.action]} · ${row.value.plannedFor.split('-').reverse().join('.')}`); option.value = String(row.sequence); version.append(option); }
    const preview = node('div', undefined, 'plan-link-preview');
    from = field('Исполнения с', node('input')); from.type = 'date'; from.dataset.planLinkField = 'from';
    to = field('По', node('input')); to.type = 'date'; to.dataset.planLinkField = 'to';
    const syncVersion = () => {
      const chosen = history.items.find(row => row.sequence === Number(version.value)); if (!chosen) return;
      preview.replaceChildren(planView(chosen)); const base = chosen.value.plannedFor;
      from.value = base.slice(0, 8) + '01'; const date = new Date(base + 'T12:00:00.000Z'); date.setUTCMonth(date.getUTCMonth() + 1, 0); to.value = date.toISOString().slice(0, 10);
      invalidateChoices();
    };
    version.addEventListener('change', syncVersion); from.addEventListener('change', invalidateChoices); to.addEventListener('change', invalidateChoices);
    const search = action('Показать исполнения', 'search', () => {
      if (busy) return;
      const period = [from.value, to.value].map((day, index) => new Date(day + (index ? 'T23:59:59.999+03:00' : 'T00:00:00.000+03:00')));
      if (period.some(date => !Number.isFinite(date.getTime())) || period[0] > period[1] || period[1] - period[0] > 366 * 86400000) { message.textContent = 'Выберите период не длиннее года.'; focus(message); return; }
      const query = { sequence: version.value, from: period[0].toISOString(), to: period[1].toISOString() };
      invalidateChoices();
      void perform(signal => request(`/api/trading-plan/${encodeURIComponent(planId)}/execution-candidates?` + new URLSearchParams(query), { signal }), value => {
        const checked = validatePlanExecutionCandidates(value, options());
        if (checked.planVersion !== getPlanVersion() || checked.planVersion !== data.planVersion || checked.linksVersion !== data.linksVersion
          || checked.plan.sequence !== Number(query.sequence) || checked.period.from !== query.from || checked.period.to !== query.to
          || JSON.stringify(checked.plan) !== JSON.stringify(history.items.find(row => row.sequence === Number(query.sequence)))) throw Object.assign(new Error('Changed'), { code: 'PLAN_EXECUTION_LINK_CONFLICT' });
        choices = checked; candidateHost.replaceChildren();
        if (!checked.items.length) { candidateHost.append(node('p', 'Подходящих проверенных исполнений в сохранённых данных не найдено. Это не доказывает отсутствие сделок.')); return; }
        const label = node('label', 'Выберите одно исполнение'), select = node('select'); select.dataset.planLinkField = 'execution';
        const placeholder = node('option', 'Выберите исполнение'); placeholder.value = ''; select.append(placeholder);
        checked.items.forEach((item, index) => { const option = node('option', `${index + 1}. ${executionText(item.execution)}`); option.value = item.ref; select.append(option); });
        const detail = node('div'); select.addEventListener('change', () => { selected = select.value; const choice = choices?.items.find(row => row.ref === selected); detail.replaceChildren(...(choice ? [executionView(choice.execution), node('p', planPriceComparisonText(choices.plan, choice.execution))] : [])); controls(); });
        label.append(select); candidateHost.append(label, detail); focus(select);
      });
    });
    candidateHost = node('div', undefined, 'plan-link-candidates');
    const noteLabel = node('label', 'Заметка к разбору (необязательно)'); note = node('textarea'); note.maxLength = 2000; note.rows = 3; note.dataset.planLinkField = 'note'; noteLabel.append(note);
    save = action('Сохранить связь', 'save', () => {
      if (!choices || !selected || busy) return;
      const body = { expectedVersion: data.planVersion, expectedLinksVersion: data.linksVersion, sequence: choices.plan.sequence,
        from: choices.period.from, to: choices.period.to, candidateRef: selected, note: note.value };
      void perform(signal => request(`/api/trading-plan/${encodeURIComponent(planId)}/execution-links`, { method: 'POST', body: JSON.stringify(body), signal }), value => {
        data = validatePlanExecutionLinks(value, options()); linkDraft = null; render(); message.textContent = 'Связь сохранена. Исполнение отмечено вами; заявка брокеру не отправлялась.'; focus(message);
      }, true);
    });
    form.append(grid, preview, node('p', 'Период и время исполнения указаны по Москве. Доступны проверенные сохранённые исполнения акций выбранного счёта и инструмента.'), search, candidateHost, noteLabel, save); region.append(form); syncVersion();
    if (linkDraft) {
      const draft = linkDraft; linkDraft = null;
      if (history.items.some(row => String(row.sequence) === draft.version)) { version.value = draft.version; syncVersion(); }
      from.value = draft.from; to.value = draft.to; note.value = draft.note; form.open = true;
      message.textContent = 'Заметка восстановлена. Проверьте версию и период, затем заново выберите исполнение. Сохранение не повторялось.';
    }
  }
  function render() {
    if (review) { renderReview(); return; }
    region.replaceChildren(node('h5', 'Связи с исполнениями'));
    region.append(node('p', 'Вы выбираете сохранённую версию плана и исполнение. Связь — ваша отметка для разбора; она не доказывает, что план предшествовал сделке.'));
    const method = node('details', undefined, 'plan-link-method'); method.append(node('summary', 'О сохранении и проверке связей'),
      node('p', 'Содержание выбранной версии и сведения об исполнении сохраняются отдельной копией. Отзыв сохраняет запись в истории. Редактирование плана не переписывает связи.'),
      node('p', 'До 100 связей на идею, включая отозванные. Удаление идеи удаляет все её связи. JSON-архив идей не включает связи; для их переноса нужна полная резервная копия Workspace.'),
      node('p', 'Проверка выполняется по локально сохранённым данным. Она не подтверждает полноту истории брокера, прибыль, причинную связь или наличие плана у вас перед сделкой. Время сохранения — часы устройства.'));
    method.append(node('p', 'Разница цен сравнивает выбранное исполнение с входом выбранной версии, если направление, денежные единицы и валюта совпадают. Единицы плана указаны вами. Прочие исполнения, комиссии и валютный пересчёт не учитываются. Проскальзывание, прибыль и R не рассчитываются.'));
    region.append(method); message = node('p', '', 'plan-link-status'); message.setAttribute('role', 'status'); message.tabIndex = -1; region.append(message);
    region.append(action('Обновить связи', 'refresh', () => { void load(true); }));
    if (data.someAccountsUnavailable) region.append(node('p', 'Часть связей относится к недоступным счетам и не показана.'));
    const list = node('div', undefined, 'plan-link-list'), count = node('p', `Сохранённых связей: ${data.items.length}${data.someAccountsUnavailable ? ' доступных' : ''}.`); region.append(count, list);
    let shown = 0; const rows = [...data.items].reverse(), more = action('Показать предыдущие связи', 'more', () => append(true));
    const size = createPlanExecutionSizeDisclosure(data, options(), { labelInstrument, openLink(id) {
      const index = rows.findIndex(row => row.id === id); if (index === -1) return;
      while (shown <= index) append();
      const detail = [...list.children].find(element => element.dataset.planLinkId === id);
      if (detail) { detail.open = true; focus(detail.querySelector('summary')); }
    } });
    if (size) region.insertBefore(size, count);
    function append(restore = false) {
      let first;
      for (const row of rows.slice(shown, shown + 5)) {
        const detail = node('details', undefined, 'plan-link-record'); detail.dataset.planLinkId = row.id;
        const state = row.withdrawnAt ? 'Отозвана' : row.sourceState === 'unchanged' ? 'Отмечено вами' : 'Источник изменился или недоступен';
        const summary = node('summary', `Связь ${row.sequence} · версия ${row.plan.sequence} · ${state}`); first ||= summary; detail.append(summary);
        detail.append(node('p', 'Связь сохранена по часам устройства: ' + localTime(row.recordedAt)), planView(row.plan), executionView(row.execution));
        detail.append(node('p', planPriceComparisonText(row.plan, row.execution)));
        if (row.sourceState === 'changed-or-unavailable') detail.append(node('p', 'Сохранённое исполнение больше не совпадает с проверяемым источником или источник недоступен. Здесь показана прежняя копия; заново подтвердить актуальные данные можно отдельной связью.'));
        if (!row.planVersionRetained) detail.append(node('p', 'Эта версия уже отсутствует в истории последних 50 версий. Её копия сохранена в связи.'));
        if (row.clockRegressed) detail.append(node('p', 'Часы устройства сдвинулись назад. Временная последовательность не подтверждена.'));
        if (row.note) detail.append(node('p', row.note, 'plan-link-note'));
        if (row.withdrawnAt) detail.append(node('p', 'Отозвана по часам устройства: ' + localTime(row.withdrawnAt)));
        else detail.append(action('Отозвать связь', 'withdraw', () => {
          void perform(signal => request(`/api/trading-plan/${encodeURIComponent(planId)}/execution-links/${row.id}`, { method: 'DELETE',
            body: JSON.stringify({ expectedVersion: data.planVersion, expectedLinksVersion: data.linksVersion }), signal }), value => {
            data = validatePlanExecutionLinks(value, options()); render(); message.textContent = 'Связь отозвана. Её копия осталась в истории.'; focus(message);
          }, true);
        }));
        list.append(detail);
      }
      shown = Math.min(shown + 5, rows.length); more.hidden = shown === rows.length; if (restore) focus(first);
    }
    region.append(more); append(); choices = null; selected = ''; save = null; candidateHost = null; renderForm(); controls();
  }
  function renderReview() {
    onInvalidateSource(); region.replaceChildren(); region.dataset.state = data.items.length ? 'ready' : 'empty';
    message = node('p', '', 'plan-link-status'); message.setAttribute('role', 'status'); message.tabIndex = -1;
    const list = node('div', undefined, 'plan-link-list'), count = node('p', '', 'plan-link-caption');
    let sequence, shown = 0, rows = [];
    const more = action('Показать предыдущие связи', 'more', () => append(true));
    function sourceBody(row) {
      const body = node('div', undefined, 'plan-link-source-body');
      body.append(node('p', 'Связь сохранена по часам устройства: ' + localTime(row.recordedAt)), planView(row.plan), executionView(row.execution));
      body.append(node('p', planPriceComparisonText(row.plan, row.execution)));
      if (row.sourceState === 'changed-or-unavailable') body.append(node('p', 'Источник изменился или недоступен. Показана прежняя копия, а не подтверждённые актуальные данные.'));
      if (row.sourceState === 'not-checked') body.append(node('p', 'Источник отозванной связи повторно не проверялся.'));
      if (!row.planVersionRetained) body.append(node('p', 'Версии уже нет среди последних 50 правок; её копия сохранена в связи.'));
      if (row.clockRegressed) body.append(node('p', 'Часы устройства сдвинулись назад. Временная последовательность не подтверждена.'));
      if (row.note) body.append(node('p', row.note, 'plan-link-note'));
      if (row.withdrawnAt) body.append(node('p', 'Отозвана по часам устройства: ' + localTime(row.withdrawnAt)));
      body.append(node('p', 'Связь — ваша отметка. Она не подтверждает, что план предшествовал исполнению или был его причиной.', 'plan-review-limit'));
      return body;
    }
    function append(restore = false) {
      let first;
      for (const row of rows.slice(shown, shown + 5)) {
        const record = node('article', undefined, 'plan-link-record'); record.dataset.planLinkId = row.id;
        const state = row.withdrawnAt ? 'Отозвана · не входит в сумму' : row.sourceState === 'unchanged' ? 'Совпадает с сохранённым источником' : 'Источник изменился или недоступен · прежняя копия';
        record.append(node('p', `Связь ${row.sequence} · сохранённая версия ${row.plan.sequence}`, 'plan-review-record-title'),
          node('p', executionText(row.execution), 'plan-review-execution'), node('p', state, 'plan-link-caption'));
        if (!row.withdrawnAt && row.execution.side !== row.plan.value.action) record.append(node('p', 'Другое направление: не входит в сумму этой версии.', 'plan-link-caption'));
        const recordActions = node('div', undefined, 'plan-review-record-actions');
        const source = action('Источник и сохранённый план', 'source', () => {
          if (busy || !valid(generation)) return;
          onOpenSource?.({ title: `Связь ${row.sequence} · версия ${row.plan.sequence}`, body: sourceBody(row), opener: source });
        }); source.dataset.planReviewLink = row.id; first ||= source; recordActions.append(source);
        if (!row.withdrawnAt) recordActions.append(action('Отозвать связь', 'withdraw', () => {
          void perform(signal => request(`/api/trading-plan/${encodeURIComponent(planId)}/execution-links/${row.id}`, { method: 'DELETE',
            body: JSON.stringify({ expectedVersion: data.planVersion, expectedLinksVersion: data.linksVersion }), signal }), value => {
            data = validatePlanExecutionLinks(value, options()); render(); message.textContent = 'Связь отозвана. Копия осталась в истории.'; focus(message);
          }, true);
        }));
        record.append(recordActions); list.append(record);
      }
      shown = Math.min(shown + 5, rows.length); more.hidden = shown === rows.length;
      count.textContent = sequence ? `Связи версии ${sequence}: показано ${shown} из ${rows.length}. Размер страницы не меняет охват сравнения.` : 'Нет выбранной доступной версии.';
      if (restore) focus(first);
    }
    const size = createPlanExecutionSizeDisclosure(data, options(), { labelInstrument, review: true, versions: history.items, selectedSequence: getSelectedVersion(), onSelect(value) {
      sequence = value; if (value !== null) onSelectedVersion(value); onInvalidateSource();
      rows = [...data.items].reverse().filter(row => row.plan.sequence === value); shown = 0; list.replaceChildren(); append();
      if (!rows.length) list.append(node('p', 'Для выбранной версии сохранённых связей не показано. Отсутствие записей не доказывает отсутствие исполнений.'));
    } });
    region.append(size, message);
    if (data.someAccountsUnavailable) region.append(node('p', 'Часть связей относится к недоступным счетам и не показана. Полная сумма неизвестна.', 'plan-review-limit'));
    region.append(count, list, more, action('Обновить связи', 'refresh', () => { void load(true); }));
    choices = null; selected = ''; save = null; candidateHost = null; renderForm();
    const method = node('details', undefined, 'plan-link-method'); method.append(node('summary', 'Как хранятся и проверяются связи'),
      node('p', 'Версия плана и исполнение сохраняются отдельными неизменными копиями. Редактирование текущего плана их не переписывает; отзыв оставляет запись.'),
      node('p', 'Проверка читает сохранённые локальные данные без запроса брокеру. Она не подтверждает полноту истории, причинность, прибыль или наличие плана перед сделкой.'),
      node('p', 'До 100 связей на идею, включая отозванные. Удаление идеи удаляет её связи. JSON-архив идей не переносит связи; для них нужна полная резервная копия Workspace.'));
    region.append(method); controls();
  }
  async function load(reload = false) {
    if (busy || !canOpen()) return;
    if (linkDraft && note?.isConnected) linkDraft.note = note.value;
    if (reload) onReload();
    const hadFocus = region.contains(document.activeElement);
    onInvalidateSource(); region.dataset.state = 'loading'; region.replaceChildren(); message = node('p', 'Читаю связи и сохранённые версии…', 'plan-link-status'); message.setAttribute('role', 'status'); message.tabIndex = -1; region.append(message);
    data = history = choices = null; selected = ''; candidateHost = save = null;
    await perform(async signal => {
      const [links, versions] = await Promise.all([request(`/api/trading-plan/${encodeURIComponent(planId)}/execution-links`, { signal }), request(`/api/trading-plan/${encodeURIComponent(planId)}/history`, { signal })]);
      const checked = validatePlanExecutionLinks(links, options());
      if (checked.planVersion !== getPlanVersion()) throw Object.assign(new Error('Changed'), { code: 'TRADING_PLAN_CONFLICT' });
      return { links: checked, history: validatePlanHistory(versions, options()) };
    }, value => { data = value.links; history = value.history; render(); if (hadFocus && (!review || region.getClientRects().length && (document.activeElement === document.body || region.contains(document.activeElement)))) focus(review ? region.querySelector('[data-plan-size-version]') || message : message); });
    if (!data && !region.hidden && canOpen()) region.append(action('Повторить чтение', 'retry', () => { void load(true); }));
  }
  region.addEventListener('keydown', event => { if (!review && event.key === 'Escape') { event.preventDefault(); close(); focus(button); } });
  return { button, region, close, getHistory() { return !busy && data && valid(generation) ? history : null; }, dispose() { close(); disposed = true; } };
}
