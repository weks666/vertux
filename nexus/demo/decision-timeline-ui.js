import { appendOperationStatusDetails } from './execution-observations-ui.js';
import { validateDecisionTimeline, projectDecisionTimeline } from './decision-timeline-model.js';
import { appendPlanRiskScenario } from './plan-risk-scenario-ui.js';
import { planPriceUnitLabel, planPriceComparisonText } from './plan-price-basis.js';
const node = (tag, text, className) => { const result = document.createElement(tag); if (text !== undefined) result.textContent = text; if (className) result.className = className; return result; };
const time = value => value.replace('T', ' ').replace('.000Z', ' UTC').replace('Z', ' UTC');
const decimal = value => { const padded = value.padStart(10, '0'), tail = padded.slice(-9).replace(/0+$/u, ''); return padded.slice(0, -9) + (tail ? ',' + tail : ''); };
const kinds = { plan: 'План', execution: 'Сообщение об исполнении', news: 'Копия новости', 'plan-link': 'Связь и разбор' };
const changes = { created: 'Идея сохранена', edited: 'Содержание изменено', status: 'Статус изменён', 'legacy-observation': 'Прежнее содержание впервые зафиксировано' };
const statuses = { draft: 'Черновик', watching: 'Наблюдаю', completed: 'Завершено пользователем', cancelled: 'Отменено' };
const actions = { watch: 'Наблюдение', buy: 'Покупка', sell: 'Продажа' };
function linkedRecord(body, row, inline = false) {
  const plan = row.plan, value = plan.value, execution = row.execution;
  body.append(node('p', row.withdrawnAt ? 'Связь отозвана. Отзыв отметки не меняет данные брокера.' : 'Связь отмечена вами.'),
    node('p', 'Связь не доказывает, что план предшествовал сделке или был её причиной.', 'observation-caption'),
    node('p', `Связь сохранена локально: ${time(row.recordedAt)}`));
  if (row.withdrawnAt) body.append(node('p', `Отозвана локально: ${time(row.withdrawnAt)}`));
  if (row.sourceState === 'changed-or-unavailable') body.append(node('p', 'Источник исполнения изменился или недоступен. Здесь показана прежняя сохранённая копия.', 'observation-warning'));
  if (row.sourceState === 'not-checked') body.append(node('p', 'Источник отозванной связи повторно не проверялся.', 'observation-caption'));
  body.append(node('h5', `Сохранённая версия плана ${plan.sequence}`), node('p', `${actions[value.action]} · ${statuses[value.status]} · пересмотр ${value.plannedFor}.`),
    node('p', `Версия зафиксирована локально: ${time(plan.recordedAt)}`), node('p', value.note || 'Заметка плана отсутствует.', 'timeline-review-note'));
  if (plan.kind === 'legacy-observation') body.append(node('p', 'Это первое наблюдение прежнего плана. Более ранняя история неизвестна.', 'observation-warning'));
  if (!row.planVersionRetained) body.append(node('p', 'Версия уже отсутствует в истории последних 50 правок. Её копия сохранена в этой связи.', 'observation-caption'));
  const levels = [['Вход', value.entryPrice], ['Стоп', value.stopPrice], ['Цель', value.targetPrice]].filter(([, price]) => price !== null);
  if (levels.length) {
    appendPlanRiskScenario(body, value, { inline });
    const unit = planPriceUnitLabel(value.priceBasis);
    body.append(node('p', unit ? 'Единицы цен указаны владельцем при сохранении.' : 'Единицы уровней в истории не сохранены.', 'observation-caption'));
    for (const [label, price] of levels) body.append(node('p', `${label}: ${price.replace('.', ',')}${unit ? ' ' + unit : ''}`));
  }
  body.append(node('h5', 'Выбранное исполнение'),
    node('p', `${actions[execution.side]} · ${time(execution.at)} · ${decimal(execution.quantityNanos)} ед. × ${decimal(execution.priceNanos)} ${execution.currency}`));
  if (execution.executionQuantity?.state === 'partial') {
    const q = execution.executionQuantity;
    body.append(node('p', `В поручении исполнено ${decimal(q.executedNanos)} из ${decimal(q.reportedNanos)} ед.; остаток ${decimal(q.remainingNanos)} ед. Связь относится только к выбранному исполнению.`));
  }
  body.append(node('p', planPriceComparisonText(plan, execution)), node('h5', 'Заметка разбора'), node('p', row.note || 'Заметка разбора отсутствует.', 'timeline-review-note'));
}
let nextId = 0;
export function createDecisionTimelineDisclosure({ planId, portfolioId, instrumentUid, request, getRevision, isCurrent, canOpen, getPortfolioIds, now = () => new Date(), review = false, onOpenSource, onInvalidateSource = () => {}, onReload = () => {} }) {
  const button = node('button', 'Лента записей', 'button'); button.type = 'button';
  const region = node('section', undefined, 'execution-observations decision-timeline'); region.hidden = true; region.id = `decision-timeline-${++nextId}`;
  region.setAttribute('aria-label', 'Сохранённая лента идеи и инструмента'); button.setAttribute('aria-controls', region.id); button.setAttribute('aria-expanded', 'false');
  let generation = 0, disposed = false, loading = false, controller = null, query = null, parentRevision, data = null;
  const current = own => !disposed && own === generation && !region.hidden && isCurrent(parentRevision);
  function close() { generation++; loading = false; controller?.abort(); controller = null; data = null; onInvalidateSource(); region.hidden = true; region.replaceChildren(); region.setAttribute('aria-busy', 'false'); button.setAttribute('aria-expanded', 'false'); }
  function render() {
    region.replaceChildren(); region.dataset.state = 'ready';
    region.append(node('h4', data.planExecutionLinks ? 'План, исполнения, новости и разбор' : 'План, исполнения и новости'), node('p', `${time(query.from)} — ${time(query.to)}.`, 'observation-caption'),
      node('p', 'Совпадение дат и инструмента не доказывает связь с идеей или прочтение новости. Полнота истории неизвестна.'));
    const method = node('details', undefined, 'observation-record');
    method.append(node('summary', 'Какие записи и даты показаны'),
      node('p', 'За 30 дней: изменения этой идеи на выбранном счёте и инструменте по времени сохранения; сообщения операций по дате операции, указанного исполнения или отмены; новости по времени сообщения поставщика.'),
      node('p', 'Для сообщения со статусом «Отменено» на оси событий используется указанная дата отмены, если она входит в период. Это статус источника, а не подтверждение отмены других исполнений.'),
      node('p', '«На устройстве»: план и копия новости — локальная запись, исполнение — первое сохранённое получение сообщения. Эти даты могут выходить за выбранный период. Локальные часы могут расходиться; одинаковые даты не устанавливают порядок.'),
      node('p', 'Новости связаны с инструментом только метками сохранённой копии. Дата поставщика не подтверждает первичную публикацию. Срок хранения — 30 дней, до 5 копий новости; более ранние или немаркированные копии могут отсутствовать.'),
      node('p', 'История плана ограничена 50 версиями и удаляется вместе с идеей. Статус идеи задан пользователем. Исполнения — отдельные сообщения, которые могут описывать одну операцию; суммы не складываются, связь исправлений и отмен неизвестна.'),
      node('p', `Локальная база прочитана: ${time(data.readAt)}. Это не подтверждение того, что было известно пользователю.`, 'observation-caption'));
    if (data.planExecutionLinks) method.append(
      node('p', 'Связь и разбор — ваша сохранённая отметка. Она попадает в ленту, если дата выбранного исполнения, сохранения связи или её отзыва входит в период. На оси событий используется дата исполнения; на устройстве — дата отзыва, если он был, иначе дата сохранения связи.'),
      node('p', 'В связи хранится копия выбранной версии плана. Текущие правки её не заменяют. Отзыв сохраняет запись. Состояние источника проверено при чтении ленты; обновление читает сохранённую базу без запроса брокеру.'),
      node('p', 'Разница цен — сохранённое исполнение минус плановый вход при совпадении направления, денежных единиц и валюты. Единицы плана указаны владельцем. Комиссии и валютный пересчёт не учитываются; проскальзывание, прибыль и R не рассчитываются.'));
    const controls = node('div', undefined, 'plan-draft-actions'), count = node('p', undefined, 'observation-caption'), list = node('div', undefined, 'observation-list');
    controls.setAttribute('role', 'group'); controls.setAttribute('aria-label', 'Порядок ленты'); count.setAttribute('role', 'status');
    const more = node('button', 'Показать ещё записи', 'button'); more.type = 'button';
    let axis = 'event', shown = 0, projection;
    const buttons = new Map();
    function append(focus = false) {
      let first;
      for (const entry of projection.entries.slice(shown, shown + 5)) {
        const details = node(review ? 'article' : 'details', undefined, 'observation-record'); details.dataset.kind = entry.kind;
        const linkLabel = entry.kind === 'plan-link' ? ` · версия ${entry.row.plan.sequence} · ${entry.row.withdrawnAt ? 'отозвана' : entry.row.sourceState === 'unchanged' ? 'ваша отметка' : 'источник изменился или недоступен'}` : '';
        const summary = node(review ? 'h6' : 'summary', `${entry.row.recordKind === 'source-status' ? 'Сообщение об операции' : kinds[entry.kind]} · ${time(entry.sortAt)}${linkLabel}`); first ||= summary; details.append(summary);
        const row = entry.row, body = node('div', undefined, 'observation-body');
        if (entry.tiedTime) body.append(node('p', 'Есть записи с той же отметкой времени. Порядок между ними неизвестен.', 'observation-caption'));
        if (entry.clockWarning) body.append(node('p', 'Отметки часов расходятся. Сортировка по ним не подтверждает порядок событий.', 'observation-warning'));
        if (entry.localAt > query.to) body.append(node('p', 'Локально получено или сохранено после выбранного периода.', 'observation-warning'));
        if (entry.kind === 'plan-link') {
          if (entry.eventAt < query.from || entry.eventAt > query.to) body.append(node('p', 'Исполнение вне выбранного периода. Связь попала в ленту по дате сохранения или отзыва вашей отметки.', 'observation-caption'));
          linkedRecord(body, row, review);
        } else if (entry.kind === 'plan') {
          body.append(node('p', `${changes[row.kind]} · версия ${row.sequence}`), node('p', `Сохранено локально: ${time(row.recordedAt)}`),
            node('p', `Статус: ${statuses[row.value.status]}. Пересмотреть: ${row.value.plannedFor}.`), node('p', row.value.note || 'Заметка отсутствует.'));
          const levels = [['Вход', 'entryPrice'], ['Стоп', 'stopPrice'], ['Цель', 'targetPrice']].filter(([, key]) => row.value[key] !== null);
          if (levels.length) { const unit = planPriceUnitLabel(row.value.priceBasis); body.append(node('p', unit ? 'Единицы цен указаны владельцем при сохранении.' : 'Единицы уровней в истории не сохранены.', 'observation-caption')); for (const [label, key] of levels) body.append(node('p', `${label}: ${row.value[key].replace('.', ',')}${unit ? ' ' + unit : ''}`)); }
          appendPlanRiskScenario(body, row.value, { inline: review });
        } else if (entry.kind === 'news') {
          body.append(node('h5', row.content.title), node('p', row.content.summary || 'Текст отсутствует.'),
            node('p', `Источник в копии: ${row.content.source || 'неизвестен'}.`), node('p', `Время сообщения поставщика: ${time(row.sourceAt)}`),
            node('p', `Копия сохранена локально: ${time(row.recordedAt)} · версия ${row.sequence}`));
          if (row.kind === 'legacy-observation') body.append(node('p', 'Прежний текст впервые зафиксирован в эту локальную дату. Более раннее получение неизвестно.'));
        } else {
          const state = { executed: 'Исполнено полностью или частично', canceled: 'Отменено', pending: 'В обработке', unknown: 'Неизвестен' }[row.reportedState];
          body.append(node('p', `${row.direction === 'buy' ? 'Покупка' : 'Продажа'} · статус в сообщении: ${state}`),
            node('p', `Дата операции у источника: ${time(row.operationAt)}`), node('p', `Сообщение получено локально: ${time(row.firstReceivedAt)}`));
          if (row.normalizedAt !== null) body.append(node('p', `Обработано локально: ${time(row.normalizedAt)}`));
          appendOperationStatusDetails(body, row);
          if (row.conflictingLocalFamily) body.append(node('p', 'Сохранены различающиеся сведения с одинаковыми признаками. Актуальная версия не установлена.', 'observation-warning'));
          if (!row.fills.length) body.append(node('p', 'Подробности исполнений отсутствуют.'));
          for (const fill of row.fills) body.append(node('p', `${time(fill.occurredAt)} · ${decimal(fill.quantityNanos)} ед. × ${decimal(fill.priceNanos)} ${fill.priceUnit === 'money' ? fill.priceCurrency : fill.priceUnit === 'points' ? 'п.' : '(единицы цены неизвестны)'}`));
        }
        if (review) {
          let brief;
          if (entry.kind === 'plan-link') brief = `Сохранённая версия ${row.plan.sequence} · ${actions[row.execution.side]} · ${decimal(row.execution.quantityNanos)} ед. × ${decimal(row.execution.priceNanos)} ${row.execution.currency}. ${row.note || 'Заметки нет.'}`;
          else if (entry.kind === 'plan') brief = `${changes[row.kind]} · версия ${row.sequence} · ${actions[row.value.action]} · ${statuses[row.value.status]}. ${row.value.note || 'Заметки нет.'}`;
          else if (entry.kind === 'news') brief = `Версия копии ${row.sequence} · ${row.content.title}`;
          else brief = `${row.direction === 'buy' ? 'Покупка' : 'Продажа'} · ${row.reportedState === 'canceled' ? 'сообщение об отмене' : row.reportedState === 'pending' ? 'в обработке' : row.reportedState === 'executed' ? 'сообщение об исполнении' : 'состояние неизвестно'} · ${row.fills.length ? row.fills.map(fill => decimal(fill.quantityNanos) + ' ед.').join(' + ') : 'подробности исполнений отсутствуют'}.`;
          details.append(node('p', brief, 'plan-review-record-summary'), node('p', `На устройстве: ${time(entry.localAt)}. Дата события: ${time(entry.eventAt)}.`, 'observation-caption'));
          if (entry.tiedTime || entry.clockWarning) details.append(node('p', 'Временной порядок не подтверждён: проверьте отметки источника.', 'observation-warning'));
          if (entry.kind === 'plan-link' && row.sourceState !== 'unchanged') details.append(node('p', row.sourceState === 'not-checked' ? 'Источник отозванной связи повторно не проверялся.' : 'Источник изменился или недоступен; прежняя копия.', 'observation-warning'));
          const source = node('button', 'Источник записи', 'button'); source.type = 'button'; source.dataset.planReviewRecord = entry.kind;
          source.addEventListener('click', () => { if (!loading && current(generation) && canOpen()) onOpenSource?.({ title: summary.textContent, body, opener: source }); });
          details.append(source); if (first === summary) first = source;
        } else details.append(body);
        list.append(details);
      }
      shown = Math.min(shown + 5, projection.entries.length); more.hidden = shown === projection.entries.length;
      count.textContent = `Показано записей: ${shown} из ${projection.entries.length}. Это не количество сделок.`;
      if (focus) first?.focus();
    }
    function order(value) {
      onInvalidateSource();
      axis = value; shown = 0; list.replaceChildren(); projection = projectDecisionTimeline(data, axis);
      for (const [key, control] of buttons) control.setAttribute('aria-pressed', String(key === axis));
      if (!projection.entries.length) { region.dataset.state = 'empty'; list.append(node('p', 'В сохранённых данных за выбранный период записей не найдено. Это не доказывает отсутствие решений, сделок или новостей.')); }
      if (projection.otherPlanContext) list.append(node('p', 'Версии идеи с другим счётом или инструментом в эту ленту не включены.', 'observation-caption'));
      if (data.coverage.otherPlanExecutionContexts) list.append(node('p', 'Связи с другим счётом или инструментом в эту ленту не включены.', 'observation-caption'));
      if (data.planExecutionLinks?.someAccountsUnavailable) list.append(node('p', 'Часть связей относится к недоступным счетам и не показана.', 'observation-caption'));
      append();
    }
    for (const [key, label] of [['event', 'Даты событий'], ['local', 'На устройстве']]) {
      const control = node('button', label, 'button'); control.type = 'button'; buttons.set(key, control);
      control.addEventListener('click', () => { if (!loading && current(generation)) order(key); }); controls.append(control);
    }
    const refresh = node('button', 'Обновить ленту', 'button'); refresh.type = 'button'; refresh.dataset.timelineRefresh = 'true';
    refresh.addEventListener('click', () => {
      if (loading || !current(generation)) return;
      list.replaceChildren(); count.textContent = 'Читаю сохранённую ленту…'; more.hidden = true;
      for (const control of buttons.values()) control.disabled = true;
      void load(refresh);
    }); controls.append(refresh);
    more.addEventListener('click', () => { if (!loading && current(generation)) append(true); });
    region.append(controls, count, list, more, method); order(axis);
  }
  async function load(retry = null) {
    if (loading) return; if (!canOpen()) { close(); return; }
    if (retry) onReload();
    onInvalidateSource();
    loading = true; const own = ++generation; controller?.abort(); controller = new AbortController(); parentRevision = getRevision(); data = null;
    if (!retry) region.replaceChildren(node('p', 'Читаю сохранённую ленту…')); else { retry.setAttribute('aria-disabled', 'true'); retry.textContent = 'Читаю…'; }
    region.dataset.state = 'loading'; region.setAttribute('aria-busy', 'true');
    try {
      const received = await request('/api/decision-timeline?' + new URLSearchParams(query), { signal: controller.signal });
      if (!current(own)) return;
      const restore = retry && document.activeElement === retry;
      data = validateDecisionTimeline(received, query, getPortfolioIds()); render(); if (restore) button.focus();
    } catch (error) {
      if (!current(own)) return;
      const restore = retry && document.activeElement === retry;
      region.dataset.state = 'error'; region.replaceChildren(node('p', error.code === 'DECISION_TIMELINE_LIMIT' ? 'Объём сохранённых данных превышает предел ленты.' : 'Не удалось проверить сохранённую ленту. Записи не показаны.'));
      const again = node('button', 'Повторить чтение', 'button'); again.type = 'button'; again.addEventListener('click', () => { void load(again); }); region.append(again); if (restore) again.focus();
    } finally { if (current(own)) { loading = false; region.setAttribute('aria-busy', 'false'); } }
  }
  button.addEventListener('click', () => {
    if (!region.hidden) { close(); return; } if (disposed || !canOpen()) return;
    const to = now(); query = { planId, portfolioId, instrumentUid, from: new Date(to.getTime() - 30 * 86400000).toISOString(), to: to.toISOString() };
    region.hidden = false; button.setAttribute('aria-expanded', 'true'); void load();
  });
  return { button, region, close, dispose() { close(); disposed = true; } };
}
