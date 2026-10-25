import { decimalNanos } from './number-format.js';
import { reviewIso, REVIEW_METRICS, validatePortfolioReviewsResponse } from './portfolio-review-model.js';
import { createReviewArchiveUi } from './portfolio-review-archive-ui.js';
const PATH = '/api/portfolio-reviews';
const esc = value => String(value ?? '').replace(/[&<>"']/gu, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const time = value => reviewIso(value) ? new Date(value).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }) + ' мск' : 'Нет данных';
const money = (value, currency = 'RUB') => value === null ? 'Нет данных' : decimalNanos(value, { digits: 9 }) + ' ' + (currency === 'RUB' ? '₽' : currency);
const value = (row, currency) => row.state === 'known' ? money(row.amountNanos, currency) : 'Нет данных';
const kinds = {
  'new-observation': 'Сравниваются два разных сохранённых наблюдения.', 'same-observation': 'В обоих обзорах один наблюдаемый снимок и те же суммы.',
  'same-date-changed': 'Суммы изменились при прежней дате снимка. Причина изменения неизвестна; исправление источника не подтверждено.',
  'source-time-regressed': 'Последний обзор использует более раннее наблюдение. Денежное сравнение не выполняется.',
  'different-method': 'Методы расчёта различаются или не поддерживаются. Денежное сравнение не выполняется.',
  'different-unit': 'Денежные единицы не сопоставимы. Пересчёт валют не выполняется.', 'different-scope': 'Области данных различаются. Сравнение не выполняется.',
};
const states = { changed: 'Изменение суммы', unchanged: 'Сумма не изменилась', 'below-threshold': 'Изменение меньше 1 ₽',
  'availability-changed': 'Изменилась доступность суммы', unknown: 'Два значения не подтверждены', 'not-comparable': 'Не сопоставимо' };
const errors = { PORTFOLIO_REVIEW_CONFLICT: 'Обзоры изменились в другой вкладке. Перепроверьте список.',
  PORTFOLIO_REVIEW_SOURCE_CHANGED: 'Источник изменился после открытия. Перепроверьте обзор перед сохранением.',
  PORTFOLIO_REVIEW_SOURCE_UNAVAILABLE: 'Исходный снимок не подтверждён. Обзор не сохранён.',
  PORTFOLIO_REVIEW_CORRUPT: 'Не удалось проверить локальные обзоры. Перепроверьте список.',
  PORTFOLIO_REVIEW_LIMIT: 'Достигнут предел локальных обзоров.', PORTFOLIO_REVIEW_CLOCK: 'Не удалось подтвердить время сохранения.',
  TRADING_PLAN_CONTEXT_CHANGED: 'Доступ или выбранный счёт изменились. Откройте обзоры заново.' };

export function createPortfolioReviewUi({ host, request, canUseContext = () => true }) {
  let context = null, signature = '', phase = 'idle', data = null, open = false, currentOpen = false, factsOpen = false, methodOpen = false;
  let controller = null, sequence = 0, confirmClear = false, message = '';
  let filePreview = false, accessRejected = false, active = false, managementOpen = false;
  let unavailableTitle='Выберите счёт',unavailableCopy='Выберите один счёт в верхней панели, чтобы работать с его обзорами.',canChooseAccount=true;
  const contextAllowed = () => { try { return canUseContext() === true; } catch { return false; } };
  const archiveHost = host ? document.createElement('section') : null;
  if (archiveHost) host.after(archiveHost);
  const archiveUi = createReviewArchiveUi({ host: archiveHost, request, rejectAccess: () => invalidate({ forbidden: true }), getAccess: () => ({
    key: signature, generation: sequence, canOpen: (Boolean(context) && contextAllowed() || filePreview) && !accessRejected && phase !== 'forbidden',
    canExport: !accessRejected && contextAllowed() && Boolean(context) && phase === 'ready' && Boolean(data) && data.state !== 'corrupt', query: context?.query, scopeKey: data?.scopeKey,
  }) });
  const busy = () => ['loading', 'saving', 'clearing'].includes(phase);
  const control = (key, label, unavailable = false) => `<button type="button" class="button" data-review-action="${key}" ${unavailable ? 'aria-disabled="true"' : ''}>${label}</button>`;
  function activeControl() {
    if (!host?.contains(document.activeElement)) return null;
    if (document.activeElement.dataset.reviewAction) return document.activeElement.dataset.reviewAction;
    return ['main', 'current', 'facts', 'method', 'management'].find(key => document.activeElement === host.querySelector(`[data-review-${key}]>summary`)) || 'main';
  }
  function focus(key) {
    const target = (['main', 'current', 'facts', 'method', 'management'].includes(key) ? host.querySelector(`[data-review-${key}]>summary`) : host.querySelector(`[data-review-action="${key}"]`)) || host.querySelector('[data-review-main]>summary') || host.querySelector('[data-review-main]');
    if (!target) return;
    const bar = document.querySelector('.topbar'); if (bar) target.style.scrollMarginTop = Math.ceil(bar.getBoundingClientRect().height + 12) + 'px';
    target.focus({ preventScroll: true }); target.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }
  host?.addEventListener('focusin', event => {
    const target = event.target;
    if (!target.matches?.('summary,button')) return;
    const bar = document.querySelector('.topbar'), rect = target.getBoundingClientRect();
    const top = bar ? bar.getBoundingClientRect().bottom : 0;
    target.style.scrollMarginTop = Math.ceil(top + 12) + 'px';
    if (rect.top < top + 4 || rect.bottom > innerHeight - 4) target.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  });
  host?.addEventListener('click',event=>{if(!event.target.closest('[data-review-select-account]'))return;const select=document.querySelector('#statisticsAccount');if(!select||select.disabled)return;select.focus();try{select.showPicker?.();}catch{}});
  function render(focused = null) {
    if (!host) return;
    const current = data?.current, last = data?.records.at(-1), isSaved = current?.available && last?.snapshotId === current.snapshotId;
    const locked = busy() || !contextAllowed(), canSave = current?.available === true && data.state !== 'corrupt' && !isSaved;
    const label = !context ? 'Выберите один счёт в приложении' : busy() ? 'Проверяем данные…' : data?.state === 'compared' ? 'Два сохранённых обзора' : data?.state === 'baseline' ? 'Первый обзор сохранён' : data?.state === 'corrupt' ? 'Данные не подтверждены' : 'По вашему действию';
    host.dataset.state = phase; host.setAttribute('aria-busy', String(locked));
    host.classList.toggle('portfolio-reviews-standalone', active);
    if (active) {
      const status = message || (context ? phase === 'loading' ? 'Читаем сохранённые обзоры…' : phase === 'saving' ? 'Сохраняем обзор…' : phase === 'clearing' ? 'Удаляем обзоры выбранного счёта…' : '' : '');
      host.innerHTML = `<section data-review-main tabindex="-1" aria-label="Сохранённые обзоры"><header class="portfolio-review-toolbar"><div><h3>Сохранённые обзоры</h3>${context?'<p>'+esc(context.label)+'</p>':''}</div><div class="portfolio-review-controls">${context ? control('read', phase === 'loading' ? 'Обновляем…' : 'Обновить', locked) : ''}${data ? control('save', isSaved ? 'Текущий обзор сохранён' : 'Сохранить обзор', !canSave || locked) : ''}</div></header><p class="portfolio-review-status" role="status" aria-live="polite">${esc(status)}</p>${!context?'<div class="portfolio-review-empty"><h4>'+esc(unavailableTitle)+'</h4><p>'+esc(unavailableCopy)+'</p>'+(canChooseAccount?'<button type="button" class="button secondary" data-review-select-account>Выбрать счёт</button>':'')+'</div>':''}
        ${data?.comparison ? renderComparison(data, true) : data?.state === 'corrupt' ? '<p>Не удалось проверить сохранённые обзоры. Старые суммы скрыты. Обновите список или удалите повреждённые обзоры в управлении сохранениями.</p>' : data?.state === 'baseline' ? '<div class="portfolio-review-empty"><h3>Первый обзор сохранён</h3><p>Сохраните следующий снимок — здесь появится сравнение.</p></div>' : data?.state === 'empty' ? '<div class="portfolio-review-empty"><h3>Сравните два состояния портфеля</h3><p>Сохраните первый обзор. После следующего сохранения здесь будут прежние суммы, новые суммы и разница.</p></div>' : ''}
        <p class="portfolio-review-boundary">Изменение стоимости портфеля не означает инвестиционную прибыль: пополнения, выводы и причины изменения здесь не выделяются.</p>
        ${data ? `<div class="portfolio-review-support"><details data-review-current ${currentOpen ? 'open' : ''}><summary>Текущий снимок для сохранения</summary>${current.available ? '<p>Наблюдение: ' + esc(time(current.packet.observedAt)) + '. Время состояния у брокера не подтверждено.</p><dl class="portfolio-review-values">' + current.packet.values.map((row, index) => '<div><dt>' + esc(REVIEW_METRICS[index][1]) + '</dt><dd>' + esc(value(row, current.packet.currency)) + '</dd></div>').join('') + '</dl><p>Выбранный период: ' + esc(time(current.packet.selectedPeriod.from)) + ' — ' + esc(time(current.packet.selectedPeriod.to)) + '.</p>' : '<p>Текущий исходный снимок не подтверждён. Сохранение недоступно; прежние обзоры не обновляются.</p>'}</details>
        <details data-review-facts ${factsOpen ? 'open' : ''}><summary>Даты и исходные снимки</summary><dl class="portfolio-review-records">${data.records.map((row, index) => '<div><dt>' + (data.records.length === 1 ? 'Сохранённый обзор' : index === 0 ? 'Предыдущий обзор' : 'Последний обзор') + '</dt><dd>Сохранён: ' + esc(time(row.recordedAt)) + '<br>Наблюдение: ' + esc(time(row.packet.observedAt)) + '<br>Выбранный период: ' + esc(time(row.packet.selectedPeriod.from)) + ' — ' + esc(time(row.packet.selectedPeriod.to)) + '</dd>' + (row.clockRegressed ? '<p>Локальные часы пошли назад. Порядок задан последовательностью сохранения.</p>' : '') + '</div>').join('')}</dl></details>
        <details data-review-method ${methodOpen ? 'open' : ''}><summary>Как читать сравнение</summary><p>Пять сохранённых сумм в RUB. Полнота состава не подтверждена; изменения по классам нельзя складывать в результат портфеля. Неизвестные значения не равны нулю.</p><p>Время наблюдения отличается от времени сохранения. При другом методе, валюте, области данных или более ранней дате нового снимка денежная разность недоступна. Совпадение дат не доказывает исправление источника.</p><p>Обзоры хранятся в локальном приложении, не отправляются модели и не обновляют брокерский источник. Это не прогноз, объяснение рыночных причин, расчёт доходности или доказательство того, что пользователь знал в прошлом.</p></details>
        <details data-review-management ${managementOpen ? 'open' : ''}><summary>Управление сохранениями</summary><p>Локальных сохранений: ${data.retainedCount} из 10. Показаны последние ${data.records.length}. Более старые записи заменяются новыми.</p>${data.canClear ? control('clear', 'Удалить обзоры счёта', locked) : ''}${confirmClear ? '<div class="portfolio-review-confirm"><p>Будут удалены все локальные обзоры этого счёта. Исходные портфельные данные останутся.</p>' + control('confirm-clear', 'Удалить сохранённые обзоры', locked) + control('cancel-clear', 'Отмена', locked) + '</div>' : ''}</details></div>` : ''}</section>`;
      archiveUi.update(); if (focused) focus(focused); return;
    }
    host.innerHTML = `<details data-review-main ${open ? 'open' : ''}><summary><span><strong>Сохранённые обзоры</strong><small>Изменения стоимости и сумм классов · один счёт</small></span><span>${esc(label)}</span></summary><div class="portfolio-review-body">
      <p>Сохраните обзор, чтобы при следующем сохранении сравнить пять показателей. Изменение стоимости портфеля не означает инвестиционную прибыль: денежные потоки и причины здесь не выделяются.</p>
      <p class="portfolio-review-status" role="status" aria-live="polite">${esc(message || (!context ? 'Обзоры доступны в локальном приложении после выбора одного счёта.' : phase === 'loading' ? 'Читаем локальные обзоры…' : phase === 'saving' ? 'Сохраняем проверенный снимок…' : phase === 'clearing' ? 'Удаляем обзоры выбранного счёта…' : ''))}</p>
      ${context ? '<p class="portfolio-review-caption">' + esc(context.label) + ' · конец выбранного периода: ' + esc(time(context.query.to)) + '.</p>' : ''}
      ${context && ['idle', 'loading', 'error', 'forbidden'].includes(phase) ? control('read', phase === 'loading' ? 'Читаем…' : phase === 'idle' ? 'Открыть обзоры' : 'Перепроверить обзоры', locked) : ''}
      ${data ? `<div class="portfolio-review-controls">${control('save', isSaved ? 'Этот снимок уже сохранён' : 'Сохранить обзор', !canSave || locked)}${control('read', 'Перепроверить', locked)}${data.canClear ? control('clear', 'Удалить обзоры счёта', locked) : ''}</div>
        ${confirmClear ? '<div class="portfolio-review-confirm"><p>Будут удалены все локальные обзоры этого счёта — до 10 сохранений. Исходные портфельные данные останутся.</p>' + control('confirm-clear', 'Удалить сохранённые обзоры', locked) + control('cancel-clear', 'Отмена', locked) + '</div>' : ''}
        ${data.state === 'corrupt' ? '<p>Сохранённые обзоры повреждены или имеют неподдержанный формат. Старые суммы скрыты. Можно перепроверить данные или явно удалить эти обзоры.</p>' : ''}
        ${current.available ? `<details data-review-current ${currentOpen ? 'open' : ''}><summary>Что попадёт в обзор · ${esc(time(current.packet.observedAt))}</summary>
          <p>Наблюдаемый снимок: ${esc(time(current.packet.observedAt))}. Это локальное наблюдение; время состояния у брокера не подтверждено.</p>
          <dl class="portfolio-review-values">${current.packet.values.map((row, index) => '<div><dt>' + esc(REVIEW_METRICS[index][1]) + '</dt><dd>' + esc(value(row, current.packet.currency)) + '</dd></div>').join('')}</dl>
          <p>Выбранный период: ${esc(time(current.packet.selectedPeriod.from))} — ${esc(time(current.packet.selectedPeriod.to))}. Дата исходного снимка может предшествовать началу периода.</p></details>`
          : '<p>Текущий исходный снимок не подтверждён. Сохранение недоступно; прежние обзоры не обновляются.</p>'}
        ${data.state === 'empty' ? '<p>Сохранённых обзоров пока нет. Первый станет основой для следующего сравнения.</p>' : data.state === 'baseline' ? '<p>Первый обзор сохранён. Для сравнения нужен следующий снимок, сохранённый вашим действием.</p>' : ''}
        ${data.records.length ? '<dl class="portfolio-review-records">' + data.records.map((row, index) => `<div><dt>${data.records.length === 1 ? 'Сохранённый обзор' : index === 0 ? 'Предыдущий обзор' : 'Последний обзор'}</dt><dd>Сохранён: ${esc(time(row.recordedAt))}<br>Наблюдение: ${esc(time(row.packet.observedAt))}</dd>${row.clockRegressed ? '<p>Локальные часы пошли назад. Порядок задан последовательностью сохранения.</p>' : ''}</div>`).join('') + '</dl>' : ''}
        ${data.comparison ? renderComparison(data) : ''}
        ${data.state !== 'corrupt' ? '<p class="portfolio-review-caption">Локальных сохранений: ' + data.retainedCount + ' из 10. Показаны последние ' + data.records.length + '. Более старые записи заменяются новыми.</p>' : ''}` : ''}
      <details data-review-method ${methodOpen ? 'open' : ''}><summary>Метод и ограничения</summary><p>Пять явных сумм в RUB: стоимость портфеля, акции, облигации, фонды и валютные активы по оценке брокера. Полнота состава не подтверждена; эти изменения нельзя складывать между собой.</p>
      <p>На первый план выходят изменения от 1 ₽ по модулю и переходы между известным и неизвестным значением. До трёх пунктов в порядке: стоимость портфеля, акции, облигации, фонды, валютные активы. Все пять показателей и меньшие изменения доступны в таблице.</p>
      <p>Сохраняются точные локальные копии, метод и время наблюдения. При другом методе, валюте, области данных или более ранней дате нового снимка денежная разность недоступна. Совпадение дат не доказывает исправление источника.</p>
      <p>Нет прогноза, объяснения рыночной причины, оценки доходности или доказательства того, что пользователь знал в прошлом. Обзоры хранятся только в локальном приложении, не отправляются модели и не обновляют брокерский источник.</p></details>
      </div></details>`;
    archiveUi.update();
    if (focused) focus(focused);
  }
  function renderComparison(result, flat = false) {
    const comparison = result.comparison, [before, after] = result.records.map(row => row.packet);
    if (flat) {
      const observed = packet => new Date(packet.observedAt).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'short', year: 'numeric' });
      return `<section class="portfolio-review-comparison" aria-label="Сравнение двух сохранённых обзоров"><div class="portfolio-review-table-scroll" tabindex="0" aria-label="Сравнение сумм, доступна горизонтальная прокрутка"><table><caption>Суммы двух сохранённых обзоров; это не вклады в прибыль</caption><thead><tr><th scope="col">Показатель</th><th scope="col">Предыдущий<small>Наблюдение: ${esc(observed(before))}</small></th><th scope="col">Последний<small>Наблюдение: ${esc(observed(after))}</small></th><th scope="col">Изменение</th></tr></thead><tbody>${comparison.items.map(row => `<tr data-review-metric="${esc(row.key)}"><th scope="row">${esc(row.label)}${['unknown','availability-changed','not-comparable'].includes(row.state) ? '<small>' + esc(states[row.state]) + '</small>' : ''}</th><td data-value="${esc(row.before.amountNanos ?? 'unknown')}">${esc(value(row.before, before.currency))}</td><td data-value="${esc(row.after.amountNanos ?? 'unknown')}">${esc(value(row.after, after.currency))}</td><td data-review-delta="${esc(row.deltaNanos ?? 'unknown')}">${row.deltaNanos === null ? 'Нет данных' : (BigInt(row.deltaNanos)>0n?'+':'')+esc(money(row.deltaNanos))}</td></tr>`).join('')}</tbody></table></div><p class="portfolio-review-comparison-state">${esc(kinds[comparison.kind])}${comparison.comparable ? ' Подтверждённых пар: ' + comparison.knownPairCount + ' из 5.' : ''}</p></section>`;
    }
    return `<section class="portfolio-review-comparison" aria-label="Сравнение двух сохранённых обзоров"><h4>Изменения между сохранениями</h4><p>${esc(kinds[comparison.kind])}</p>
      ${comparison.comparable ? `<p>${comparison.changedCount ? 'Значимых изменений: ' + comparison.changedCount + '. Показано: ' + comparison.cards.length + '.' : 'Значимых изменений подтверждённых сумм не найдено.'} Сопоставимых денежных пар: ${comparison.knownPairCount} из 5. Неизвестные значения не равны нулю.</p>` : ''}
      ${comparison.cards.length ? '<ol class="portfolio-review-changes">' + comparison.cards.map(row => `<li data-review-change="${esc(row.key)}"><strong>${esc(row.label)}</strong><p>Было: ${esc(value(row.before, before.currency))}. Стало: ${esc(value(row.after, after.currency))}.</p><p>${row.deltaNanos === null ? 'Изменилась доступность суммы; денежная разность неизвестна.' : 'Изменение: <span data-value="' + esc(row.deltaNanos) + '">' + esc(money(row.deltaNanos)) + '</span>'}</p></li>`).join('') + '</ol>' : ''}
      <details data-review-facts ${factsOpen ? 'open' : ''}><summary>Все пять показателей и исходные даты</summary>
      <p>Предыдущий выбранный период: ${esc(time(before.selectedPeriod.from))} — ${esc(time(before.selectedPeriod.to))}. Последний: ${esc(time(after.selectedPeriod.from))} — ${esc(time(after.selectedPeriod.to))}.</p>
      <table><caption>Суммы двух сохранённых обзоров; это не вклады в прибыль</caption><thead><tr><th scope="col">Показатель</th><th scope="col">Предыдущий</th><th scope="col">Последний</th></tr></thead><tbody>${comparison.items.map(row => `<tr data-review-metric="${esc(row.key)}"><th scope="row">${esc(row.label)}</th><td data-value="${esc(row.before.amountNanos ?? 'unknown')}">${esc(value(row.before, before.currency))}</td><td data-value="${esc(row.after.amountNanos ?? 'unknown')}">${esc(value(row.after, after.currency))}</td></tr><tr class="portfolio-review-reason"><td colspan="3">${esc(states[row.state])}${row.deltaNanos === null ? '' : ': ' + esc(money(row.deltaNanos))}.</td></tr>`).join('')}</tbody></table></details></section>`;
  }
  function invalidate({ forbidden = false } = {}) {
    if (forbidden) accessRejected = true;
    forbidden = forbidden || accessRejected;
    sequence++; controller?.abort(); controller = null; data = null; open = false; currentOpen = false; factsOpen = false; managementOpen = false; confirmClear = false;
    phase = forbidden ? 'forbidden' : 'idle'; message = forbidden ? 'Доступ изменился. Обзоры скрыты; перепроверьте доступ.' : '';
    archiveUi.reset();
    render(host?.contains(document.activeElement) ? 'main' : null);
  }
  async function perform(action) {
    if (!context || busy() || !contextAllowed()) return;
    if (action !== 'read' && !data) return;
    const selected = context, id = ++sequence, requestController = new AbortController(); controller?.abort(); controller = requestController;
    const previous = data;
    phase = action === 'read' ? 'loading' : action === 'save' ? 'saving' : 'clearing'; message = ''; open = true;
    const body = action === 'read' ? null : { ...selected.query, expectedRevision: previous.revision, ...(action === 'save' ? { expectedSnapshotId: previous.current.snapshotId } : {}) };
    if (action === 'read') data = null;
    render(activeControl());
    try {
      const result = await request(action === 'read' ? PATH + '?' + new URLSearchParams(selected.query) : PATH,
        { method: action === 'read' ? 'GET' : action === 'save' ? 'POST' : 'DELETE', signal: requestController.signal, ...(body ? { body: JSON.stringify(body) } : {}) });
      if (id !== sequence || selected !== context) return;
      if (!contextAllowed()) { invalidate(); return; }
      if (!validatePortfolioReviewsResponse(result, selected.query)) throw Object.assign(new Error('Invalid review response'), { code: 'PORTFOLIO_REVIEW_UNAVAILABLE' });
      data = result; phase = 'ready'; accessRejected = false; confirmClear = false;
      message = result.action === 'saved' ? 'Обзор сохранён на этом устройстве.' : result.action === 'already-saved' ? 'Этот снимок уже сохранён; дубликат не создан.' : result.action === 'cleared' ? 'Обзоры этого счёта удалены.' : '';
    } catch (error) {
      if (id !== sequence || requestController.signal.aborted) return;
      data = null; confirmClear = false; phase = [401, 403].includes(error?.status) ? 'forbidden' : 'error';
      if (phase === 'forbidden') accessRejected = true;
      message = phase === 'forbidden' ? 'Доступ изменился. Обзоры скрыты; перепроверьте доступ.' : errors[error?.code] || (action === 'read' ? 'Не удалось прочитать обзоры. Повторите проверку.' : 'Результат изменения не подтверждён. Перепроверьте обзоры перед новым действием.');
    }
    if (id !== sequence) return;
    controller = null; const focused = activeControl(); render(focused ? (action === 'clear' || !data ? 'read' : focused) : null);
  }
  host?.addEventListener('toggle', event => {
    if (event.target === host.querySelector('[data-review-main]')) {
      open = event.target.open;
      if (open && context && phase === 'idle') void perform('read');
      else if (!open && busy()) invalidate();
    }
    if (event.target.matches?.('[data-review-current]')) currentOpen = event.target.open;
    if (event.target.matches?.('[data-review-facts]')) factsOpen = event.target.open;
    if (event.target.matches?.('[data-review-method]')) methodOpen = event.target.open;
    if (event.target.matches?.('[data-review-management]')) managementOpen = event.target.open;
  }, true);
  host?.addEventListener('click', event => {
    const button = event.target.closest?.('[data-review-action]'); if (!button || !host.contains(button) || button.getAttribute('aria-disabled') === 'true' || busy()) return;
    const action = button.dataset.reviewAction;
    if (action === 'clear') { confirmClear = true; render('confirm-clear'); }
    else if (action === 'cancel-clear') { confirmClear = false; render('clear'); }
    else if (action === 'confirm-clear') void perform('clear');
    else if (['read', 'save'].includes(action)) void perform(action);
  });
  return { setActive(value) {
    const changed = active !== Boolean(value); active = Boolean(value);archiveUi.setActive?.(active);
    if (!active) { if (phase === 'loading') invalidate(); else if (changed) render(); return; }
    open = true;
    if (context && phase === 'idle') void perform('read'); else if (changed) render();
  }, contextChanged: () => invalidate(), rejectAccess: () => invalidate({ forbidden: true }), update(next) {
    const portfolios = next?.clientProduct?.portfolios || [], period = next?.selectedPeriod;
    const preview = next?.preview?.localReview === true || next?.preview?.static === true && next?.preview?.brokerNetwork === false && next?.preview?.persistence === 'none';
    const allowed = next?.capabilities?.portfolioReviews === true && portfolios.length === 1 && !preview
      && reviewIso(period?.from) && reviewIso(period?.to);
    canChooseAccount=!preview&&next?.capabilities?.portfolioReviews===true&&portfolios.length!==1;
    unavailableTitle=preview?'Сравнение в приложении':next?.capabilities?.portfolioReviews!==true?'Сохранение обзоров недоступно':portfolios.length!==1?'Выберите счёт':'Период не подтверждён';
    unavailableCopy=preview?'В этом предпросмотре можно открыть файл архива. Сохранение и сравнение снимков счёта доступны в локальном приложении.':next?.capabilities?.portfolioReviews!==true?'Текущий режим не предоставляет сохранение обзоров счёта. Доступность чтения файла показана в архиве справа.':portfolios.length!==1?'Выберите один счёт в верхней панели. Обзоры разных счетов не объединяются.':'Дождитесь загрузки выбранного периода или обновите данные.';
    const key = JSON.stringify([allowed, preview, next?.identity?.preferenceScope, next?.savedResearch?.ownerScope, portfolios.map(row => [row.id, row.preferenceKey]), period, next?.portfolio?.savedAssetClasses]);
    if (key === signature) return; signature = key;
    filePreview = preview;
    context = allowed ? { query: { portfolioId: portfolios[0].id, from: period.from, to: period.to }, label: portfolios[0].label || 'Выбранный счёт' } : null;
    invalidate();
    if (active && context && phase === 'idle') void perform('read');
  } };
}
