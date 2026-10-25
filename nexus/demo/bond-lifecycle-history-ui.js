import { decimalNanos } from './number-format.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const labels = { at: 'Дата события (UTC)', amountNanos: 'Сумма на одну облигацию', currency: 'Валюта суммы', recordDate: 'Фиксация владельцев (UTC)', rateDate: 'Определение условий (UTC)', paymentDate: 'Дата выплаты (UTC)', executionDate: 'Дата исполнения у источника (UTC)', defaultDate: 'Дата дефолта у источника (UTC)', operationType: 'Код операции у источника', sourceExecution: 'Статус у источника', sourceNote: 'Примечание источника', conversionRatioNanos: 'Коэффициент конвертации', conversionInstrumentId: 'Инструмент конвертации (код источника)' };
const lifecycle = { labels, contract: 'bond-lifecycle-history-v1', id: 'bondHistory', path: '/api/calendar/bond-events/history',
  title: 'История условий выпуска', unavailable: 'История условий доступна в подключённой локальной рабочей среде.',
  note: 'Сохраняем изменения после включения истории. Время получения показано по Москве; дата публикации источником неизвестна. Отсутствие события в новой версии не подтверждает его отмену; участие владельца и зачисления на счёт здесь не проверяются.',
  empty: 'Сохранённых версий за этот год пока нет. Нажмите «Загрузить события выпуска», чтобы сохранить первый проверенный набор условий.',
  emptyVersion: 'В этой версии источник не вернул оферт, погашений и конвертаций за выбранный год.', same: 'Условия событий в выбранных версиях совпадают.', pages: 'Страницы условий' };
const coupons = { labels: { at: 'Дата выплаты (UTC)', amountNanos: 'Сумма на одну облигацию', currency: 'Валюта суммы', recordDate: 'Фиксация владельцев (UTC)', couponType: 'Тип купона', couponStartDate: 'Начало купонного периода (UTC)', couponEndDate: 'Конец купонного периода (UTC)' },
  contract: 'bond-coupon-history-v1', id: 'couponHistory', path: '/api/calendar/bond-coupons/history', title: 'История купонного графика',
  unavailable: 'История купонов доступна в подключённой локальной рабочей среде.',
  note: 'Сохраняем изменения графика после включения истории. Время получения показано по Москве; дата публикации источником неизвестна. Сумма относится к одной облигации. Отсутствие купона в новой версии не подтверждает отмену, право на выплату или зачисление денег.',
  empty: 'Сохранённых версий за этот год пока нет. Нажмите «Обновить события», чтобы сохранить первый проверенный купонный график.',
  emptyVersion: 'В этой версии источник не вернул купонов за выбранный год.', same: 'Купонные графики в выбранных версиях совпадают.', pages: 'Страницы купонного графика' };
const kinds = { changed: 'Условия изменились', added: 'Появилось в более поздней версии', absent: 'Нет в более поздней версии', present: 'В сохранённой версии' };
const date = value => value.endsWith('T00:00:00.000Z') ? new Intl.DateTimeFormat('ru-RU', { timeZone: 'UTC', dateStyle: 'long' }).format(new Date(value)) : value.replace('T', ' ').replace('Z', ' UTC');
const received = row => 'Версия ' + row.revision + ' · ' + new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(row.receivedAt)) + ' МСК';
const compactReceived = row => '№' + row.revision + ' · ' + new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(row.receivedAt)) + ' МСК';
const chevron = '<svg class="bond-history-chevron" aria-hidden="true" viewBox="0 0 20 20"><path d="m7 4 6 6-6 6"/></svg>';
function value(field, input, currency) {
  if (input == null || input === '') return 'Источник не указал';
  if (field === 'amountNanos' || field === 'conversionRatioNanos') return decimalNanos(input, { digits: 9 }) + (field === 'amountNanos' && currency ? ' ' + currency : '');
  if (field === 'at' || field.endsWith('Date')) return date(input);
  return input;
}
function valid(data, context, config) {
  return data?.contractVersion === config.contract && data.readMode === 'saved-only' && data.instrumentUid === context.instrumentUid && data.year === Number(context.year)
    && ['empty', 'first', 'comparison'].includes(data.state) && data.publicationTimeKnown === false && data.accountExecutionConfirmed === false
    && Array.isArray(data.versions) && data.versions.length <= 128 && data.versions.every(r => Number.isInteger(r.revision) && r.revision > 0 && Number.isFinite(Date.parse(r.receivedAt)))
    && Number.isInteger(data.page) && Number.isInteger(data.pageCount) && data.page >= 0 && data.page < data.pageCount && data.pageSize === 20
    && Array.isArray(data.rows) && data.rows.length <= 20 && data.rows.every(r => Object.hasOwn(kinds, r.kind) && Array.isArray(r.fields) && r.fields.length <= Object.keys(config.labels).length && r.fields.every(f => Object.hasOwn(config.labels, f.key)));
}
export const createBondLifecycleHistoryUi = options => createBondHistoryUi(options, lifecycle);
export const createBondCouponHistoryUi = options => createBondHistoryUi(options, coupons);
function createBondHistoryUi({ host, request, getContext }, config) {
  if (!host) return { update() {}, refresh() {}, dispose() {} };
  let signature = null, epoch = 0, serial = 0, disposed = false, data = null, busy = false, error = '', context = null, requested = {};
  host.innerHTML = '<details class="bond-history"><summary>' + chevron + esc(config.title) + '</summary><div class="bond-history-body"></div></details>';
  const details = host.querySelector('details'), body = host.querySelector('.bond-history-body');
  function observe() {
    const next = getContext(), key = JSON.stringify([next.key, next.instrumentUid, next.year, next.allowed === true]);
    context = next;
    if (signature !== key) { signature = key; epoch++; serial++; data = null; busy = false; error = ''; requested = {}; details.open = false; render(); }
    return context;
  }
  function render() {
    const focus = body.contains(document.activeElement) ? document.activeElement.id : null;
    if (!context?.allowed) { body.innerHTML = '<p>' + esc(config.unavailable) + '</p>'; return; }
    const note = '<p class="bond-history-note">' + esc(config.note) + '</p>';
    const versions = data?.versions || [];
    const select = (name, title, revision) => '<label><span>' + title + '</span><select id="' + config.id + name + '" name="' + name + '" ' + (busy ? 'disabled' : '') + '>' + versions.map(r => '<option value="' + r.revision + '"' + (r.revision === revision ? ' selected' : '') + '>' + esc(compactReceived(r)) + '</option>').join('') + '</select></label>';
    let markup = note;
    if (data?.instrument) markup += '<p class="bond-history-context"><strong>' + esc(data.instrument.ticker || data.instrument.name) + '</strong> · ' + data.year + ' год</p>';
    if (versions.length > 1) markup += '<form class="bond-history-selection">' + select('Before', 'Ранняя версия', requested.beforeRevision ?? data.before?.revision ?? versions[1].revision) + select('After', 'Поздняя версия', requested.afterRevision ?? data.after?.revision ?? versions[0].revision) + '<button id="' + config.id + 'Compare" type="submit" class="button secondary" ' + (busy ? 'disabled' : '') + '>Сравнить версии</button></form>';
    if (busy) markup += '<p role="status" aria-live="polite">Читаем сохранённые версии…</p>';
    else if (error) markup += '<p role="status" aria-live="polite">' + esc(error) + '</p><button id="' + config.id + 'Retry" class="text-button" type="button">Повторить чтение истории</button>';
    else if (!data || data.state === 'empty') markup += '<p role="status">' + esc(config.empty) + '</p>';
    else {
      if (data.state === 'first') markup += '<p role="status">Одна выбранная версия: ' + esc(received(data.after)) + '. Для сравнения нужна ещё одна отличающаяся публикация.</p>';
      else markup += '<p role="status" class="bond-history-summary">Изменились: ' + data.counts.changed + ' · Появились: ' + data.counts.added + ' · Отсутствуют: ' + data.counts.absent + ' · Без изменений: ' + data.counts.unchanged + '</p>';
      if (data.instrumentChanged) markup += '<p>Название или обозначение выпуска в каталоге изменилось: ' + esc(data.previousInstrument?.name) + ' → ' + esc(data.instrument?.name) + '. Сравнивается тот же выпуск.</p>';
      if (!data.totalRows) markup += '<p>' + (data.state === 'first' ? esc(config.emptyVersion) : esc(config.same)) + '</p>';
      markup += '<div class="bond-history-rows">' + data.rows.map(row => '<details class="bond-history-event" data-bond-history-kind="' + row.kind + '"><summary><span class="bond-history-event-title">' + chevron + esc(row.title) + '</span><small>' + esc(kinds[row.kind]) + '</small></summary><dl>' + row.fields.map(f => '<div><dt>' + esc(config.labels[f.key]) + '</dt><dd>' + (row.kind !== 'present' ? '<span><b>Ранняя:</b> ' + esc(row.kind === 'added' ? 'Нет события в этой версии' : value(f.key, f.before, row.beforeCurrency)) + '</span>' : '') + '<span><b>' + (row.kind === 'present' ? 'Значение:' : 'Поздняя:') + '</b> ' + esc(row.kind === 'absent' ? 'Нет события в этой версии' : value(f.key, f.after, row.afterCurrency)) + '</span></dd></div>').join('') + '</dl></details>').join('') + '</div>';
      if (data.pageCount > 1) markup += '<nav class="bond-history-pages" aria-label="' + esc(config.pages) + '"><button id="' + config.id + 'Previous" type="button" class="button secondary" data-history-page="' + (data.page - 1) + '" ' + (data.page === 0 ? 'disabled' : '') + '>Назад</button><span>Страница ' + (data.page + 1) + ' из ' + data.pageCount + '</span><button id="' + config.id + 'Next" type="button" class="button secondary" data-history-page="' + (data.page + 1) + '" ' + (data.page + 1 === data.pageCount ? 'disabled' : '') + '>Далее</button></nav>';
    }
    body.innerHTML = markup;
    if (focus) body.querySelector('#' + focus)?.focus({ preventScroll: true });
  }
  async function load(selection = {}) {
    const selected = observe(); if (disposed || !selected.allowed || busy) return;
    const ticket = ++serial, generation = epoch, query = { month: selected.year + '-01', instrumentUid: selected.instrumentUid, ...selection };
    const current = () => { observe(); return !disposed && context.allowed && generation === epoch && ticket === serial; };
    busy = true; error = ''; requested = { ...selection }; render();
    try {
      const answer = await request(config.path + '?' + new URLSearchParams(query));
      if (!current()) return;
      if (!valid(answer, selected, config) || selection.afterRevision !== undefined && answer.after?.revision !== selection.afterRevision || selection.beforeRevision !== undefined && answer.before?.revision !== selection.beforeRevision) throw new Error('Сравнение не соответствует выбранной облигации и версиям. Повторите чтение истории.');
      data = answer; requested = {};
    } catch (e) { if (current()) error = e.message || 'Не удалось прочитать историю. Повторите чтение.'; }
    finally { if (current()) { busy = false; render(); } }
  }
  details.addEventListener('toggle', () => { observe(); if (details.open && !data && !busy && !error) void load(); });
  body.addEventListener('submit', event => {
    event.preventDefault(); if (busy || !observe().allowed) return;
    const beforeRevision = Number(body.querySelector('[name=Before]')?.value), afterRevision = Number(body.querySelector('[name=After]')?.value);
    if (!Number.isInteger(beforeRevision) || !Number.isInteger(afterRevision) || beforeRevision >= afterRevision) { const message = document.createElement('p'); message.setAttribute('role', 'status'); message.textContent = 'Ранняя версия должна быть получена раньше поздней. Выберите другой порядок.'; body.querySelector('[data-selection-error]')?.remove(); message.dataset.selectionError = ''; event.target.after(message); return; }
    void load({ beforeRevision, afterRevision });
  });
  body.addEventListener('click', event => {
    if (event.target.closest('#' + config.id + 'Retry')) { error = ''; void load(requested); }
    const button = event.target.closest('[data-history-page]');
    if (button && data && !busy) void load({ ...(data.before ? { beforeRevision: data.before.revision } : {}), afterRevision: data.after.revision, page: Number(button.dataset.historyPage) });
  });
  return { update() { observe(); }, refresh() { observe(); serial++; data = null; busy = false; error = ''; requested = {}; render(); if (details.open) void load(); }, dispose() { disposed = true; serial++; epoch++; data = null; busy = false; details.open = false; body.replaceChildren(); } };
}
