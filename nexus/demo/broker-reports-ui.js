import { decimalNanos } from './number-format.js';
import { REPORT_PAYMENT_REASONS, validReportPayment } from './broker-report-payment-contract.js';
import { REPORT_COMMISSION_REASONS, validReportCommission } from './broker-report-commission-contract.js';
import { validReportTiming } from './broker-report-timing-contract.js';
import { reportTimingHtml } from './broker-report-timing-ui.js';

const PATH = '/api/analytics/broker-reports';
const esc = value => String(value ?? '').replace(/[&<>"']/gu, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const ref = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const day = value => typeof value === 'string' && /^\d{4}-\d\d-\d\d$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const timestamp = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/.test(value) && Number.isFinite(Date.parse(value));
const money = value => value === null || value && typeof value.nanos === 'string' && /^-?\d{1,30}$/.test(value.nanos) && /^[A-Z]{3}$/.test(value.currency);
const amount = value => value ? decimalNanos(value.nanos, { digits: 9 }) + ' ' + value.currency : 'Не указана';
const date = value => value ? value.slice(0, 10).split('-').reverse().join('.') : 'Не указана';
const instant = value => value ? value.replace('T', ' ').replace('Z', ' UTC') : 'Не указано';
const labels = { 'fields-agree': 'Поля совпадают: номер, инструмент, сторона, время, количество и цена', different: 'Поля исполнения отличаются',
  ambiguous: 'Несколько возможных связей', missing: 'Связанное исполнение не найдено', unsupported: 'Сравнение этих полей не поддержано',
  'source-unavailable': 'Не удалось проверить исходную операцию' };
function paymentComparison(value) {
  if (!value) return '';
  if (value.state === 'unavailable') return `<p class="broker-reports-note" data-payment-state="unavailable">${REPORT_PAYMENT_REASONS[value.reason]}</p>`;
  const show = key => esc(amount({ nanos: value[key], currency: value.currency }));
  const partial = value.execution?.state === 'partial';
  const quantity = key => esc(decimalNanos(value.execution[key], { digits: 9 }));
  return `<div class="broker-reports-payment" data-payment-state="${value.state}"><p class="broker-reports-note">${partial ? 'Платёж исполненной части операции' : 'Платёж всей операции'} · сопоставленных строк: ${value.reportRowCount}. ${value.state === 'observed' ? 'Суммы совпадают.' : 'Суммы различаются.'}</p>
    ${partial ? '<p class="broker-reports-note" data-payment-execution="partial">Количество в операции: ' + quantity('reportedNanos') + '; исполнено: ' + quantity('executedNanos') + '; остаток: ' + quantity('remainingNanos') + '. Неисполненный остаток в денежное сравнение не входит.</p>' : ''}
    <dl><div><dt>В истории операций</dt><dd>${show('operationPaymentNanos')}</dd></div><div><dt>По отчёту, без НКД</dt><dd>${show('reportAmountNanos')}</dd></div><div><dt>Отчёт минус история</dt><dd>${show('signedDifferenceNanos')}</dd></div></dl>
    <p class="broker-reports-note">Сумма отчёта взята со знаком покупки (−) или продажи (+). Комиссии не добавляются. Разница не подтверждает ошибку брокера или дату движения денег.</p></div>`;
}
const errors = { BROKER_REPORT_INPUT: 'Выберите период до 31 дня включительно (UTC).', BROKER_REPORT_CONTEXT_CHANGED: 'Счёт или доступ изменились. Откройте раздел заново.',
  BROKER_REPORT_BUSY: 'Другой запрос ещё выполняется. Повторите позже.', BROKER_REPORT_INVALID_SOURCE: 'Ответ брокера противоречив или неполон. Сохранённый отчёт не изменён.',
  BROKER_REPORT_INCOMPLETE: 'Не удалось получить все страницы. Сохранённый отчёт не изменён.', BROKER_REPORT_CORRUPT: 'Не удалось проверить сохранённый отчёт.',
  BROKER_REPORT_LIMIT: 'Достигнут предел локального хранения отчётов.' };

function commissionComparison(value, index, open) {
  if (!value) return '';
  const labels = { observed: 'Суммы совпадают', different: 'Есть разница', incomplete: 'Есть неизвестные суммы', unavailable: 'Недостаточно данных' };
  const show = (nanos, currency) => nanos === null || nanos === undefined ? 'Неизвестно' : esc(amount({ nanos, currency }));
  const cost = value => value === undefined ? undefined : String(BigInt(value) < 0n ? -BigInt(value) : BigInt(value));
  const caption = value.state === 'unavailable' ? REPORT_COMMISSION_REASONS[value.reason] :
    `Сопоставленных строк: ${value.reportRowCount}. Суммы относятся ко всей операции и повторяются в её строках; складывать их повторно не нужно.${value.execution.state === 'partial' ? ' Сохранено частичное исполнение; комиссия не распределяется на неисполненный остаток.' : ''}`;
  let body = '';
  if (value.state !== 'unavailable') {
    const { report, description, postings } = value;
    const notes = [report, description, postings].filter(source => source.state === 'unavailable').map(source => REPORT_COMMISSION_REASONS[source.reason]);
    if (description.state === 'known') notes.push('В описании операции: ' + amount(description.amount) + '; дата операции: ' + instant(description.at) + '.');
    if (postings.state === 'known') notes.push('Связанных списаний: ' + postings.count + '; платежи: ' + postings.totals.map(amount).join('; ')
      + '; даты операций: ' + instant(postings.firstAt) + (postings.lastAt !== postings.firstAt ? ' — ' + instant(postings.lastAt) : '') + '.');
    if (report.state === 'known') notes.push('Состав комиссий отчёта: ' + report.components.map(component =>
      ({ broker: 'брокер', exchange: 'биржа', clearing: 'клиринг' }[component.kind]) + ' — ' + component.amounts.map(amount).join('; ')).join('. ') + '.');
    body = value.differences.map(row => {
      const unit = row.currency;
      const reportAmount = report.state === 'known' ? report.totals.find(value => value.currency === unit)?.nanos : undefined;
      const described = description.state === 'known' && description.amount.currency === unit ? cost(description.amount.nanos) : undefined;
      const posted = postings.state === 'known' ? cost(postings.totals.find(value => value.currency === unit)?.nanos) : undefined;
      return `<div class="broker-reports-fee-currency" data-fee-currency="${unit}"><h5>${unit}</h5><dl>
        <div><dt>По отчёту</dt><dd>${show(reportAmount, unit)}</dd></div><div><dt>В описании, модуль</dt><dd>${show(described, unit)}</dd></div><div><dt>Списания, модуль</dt><dd>${show(posted, unit)}</dd></div>
        <div><dt>Отчёт − описание</dt><dd>${show(row.reportMinusDescriptionNanos, unit)}</dd></div><div><dt>Отчёт − списания</dt><dd>${show(row.reportMinusPostingsNanos, unit)}</dd></div><div><dt>Описание − списания</dt><dd>${show(row.descriptionMinusPostingsNanos, unit)}</dd></div></dl></div>`;
    }).join('') + notes.map(note => `<p class="broker-reports-note">${esc(note)}</p>`).join('');
  }
  return `<details class="broker-reports-fees" data-report-commission="${index}" data-commission-state="${value.state}" ${open ? 'open' : ''}>
    <summary data-report-control="commission-${index}">Комиссии всей операции · ${labels[value.state]}</summary><p class="broker-reports-note">${esc(caption)}</p>${body}
    <p class="broker-reports-note">Сравниваются величины расходов без пересчёта валют. Состав комиссий в источниках может различаться. Даты отдельных списаний взяты из их операций, а не из даты расчётов сделки. Совпадение сумм не подтверждает полноту истории или завершение расчётов.</p></details>`;
}

export function createBrokerReportsUi({ host, request }) {
  let scopeKey = '', accounts = [], today = '', portfolioId = '', from = '', to = '', reportId = '', page = 0;
  let available = false, denied = false, opened = false, disposed = false, dto = null, loading = false, posting = false;
  let generation = 0, accessToken = 0, needsLoad = true, pending = false, retryAt = 0, timer = null, error = '', notice = '';
  const validPeriod = () => day(from) && day(to) && from >= '1990-01-01' && from <= to && to <= today && Date.parse(to) - Date.parse(from) < 31 * 86400000;
  const active = () => available && !denied && !disposed;
  const selection = () => JSON.stringify([scopeKey, portfolioId, from, to]);
  const cancelTimer = () => { clearTimeout(timer); timer = null; };
  const invalidate = () => { ++generation; loading = false; posting = false; dto = null; needsLoad = true; error = ''; notice = ''; pending = false; retryAt = 0; cancelTimer(); };
  function checked(value) {
    return value?.schema === 'broker-report-source-v1' && value.scopeKey === scopeKey && value.portfolioId === portfolioId
      && value.period?.from === from && value.period?.to === to && value.authority === 'saved-source-fields' && value.financialReconciliation === 'not-performed'
      && ['empty', 'saved'].includes(value.state) && Array.isArray(value.rows) && value.rows.length <= 20
      && Array.isArray(value.history) && value.history.length <= 128 && value.history.every(row => uuid(row?.reportId) && day(row.from) && day(row.to) && timestamp(row.capturedAt) && Number.isInteger(row.revision) && row.revision >= 1 && row.revision <= 128)
      && Number.isInteger(value.pagination?.page) && value.pagination.page === page && Number.isInteger(value.pagination.pages) && value.pagination.pages >= 0 && value.pagination.pages <= 500
      && Number.isInteger(value.pagination.total) && value.pagination.total >= 0 && value.pagination.total <= 10000
      && (value.state === 'empty' ? value.report === null && value.rows.length === 0 : uuid(value.report?.reportId) && timestamp(value.report.capturedAt)
        && (!reportId || value.report.reportId === reportId) && Number.isInteger(value.report.revision) && value.report.revision >= 1 && value.report.revision <= 128
        && Number.isInteger(value.report.sourcePages) && value.report.sourcePages >= 1 && value.report.sourcePages <= 20
        && Number.isInteger(value.report.fieldsAgree) && value.report.fieldsAgree >= 0 && value.report.fieldsAgree <= value.pagination.total
        && (value.report.timing === undefined || validReportTiming(value.report.timing, value.period, value.pagination.total)))
      && value.rows.every(row => Number.isInteger(row.index) && ['ticker', 'name', 'direction', 'executionSign'].every(key => row[key] === null || typeof row[key] === 'string' && row[key].length <= 240)
        && ['tradeAt', 'settlementAt', 'deliveryAt'].every(key => row[key] === null || timestamp(row[key]))
        && (row.quantity === null || typeof row.quantity === 'string' && /^-?\d{1,19}$/.test(row.quantity))
        && ['price', 'orderAmount', 'total', 'brokerCommission', 'exchangeCommission', 'clearingCommission'].every(key => money(row[key]))
        && Object.hasOwn(labels, row.comparison?.state)
        && (row.comparison.paymentComparison === undefined || row.comparison.state === 'fields-agree' && validReportPayment(row.comparison.paymentComparison))
        && (row.comparison.commissionComparison === undefined || row.comparison.state === 'fields-agree' && validReportCommission(row.comparison.commissionComparison)));
  }
  function render() {
    if (!host || disposed) return;
    const focus = host.contains(document.activeElement) ? document.activeElement?.dataset?.reportControl : null;
    const openedCommissions = new Set([...host.querySelectorAll('[data-report-commission][open]')].map(node => node.dataset.reportCommission));
    const timingOpen = Boolean(host.querySelector('[data-report-timing][open]'));
    const busy = loading || posting, waiting = Date.now() < retryAt, valid = validPeriod();
    host.dataset.state = !active() ? 'unavailable' : posting ? 'loading-source' : loading ? 'loading-saved' : pending ? 'pending' : dto?.state ?? 'idle';
    const rows = dto?.rows ?? [];
    host.innerHTML = `<details class="broker-reports-disclosure" ${opened ? 'open' : ''}><summary data-report-control="summary"><span><strong>Брокерский отчёт</strong><small>Даты расчётов и поставки из сохранённого источника</small></span><span>${!active() ? 'Недоступно' : dto?.report ? 'Версия ' + dto.report.revision : 'По запросу'}</span></summary><div class="broker-reports-body">
      <p>Запросите отчёт за период и сравните его сделки с сохранёнными операциями. Даты расчётов и поставки показаны по UTC; точный момент списания денег этим сравнением не подтверждается.</p>
      ${!active() ? `<p role="status">${denied ? 'Доступ изменился. Откройте рабочую среду заново.' : 'Загрузка доступна владельцу в подключённой локальной рабочей среде T‑Invest.'}</p>` : `
      <div class="broker-reports-inputs"><label>Счёт<select data-report-control="account" ${busy ? 'disabled' : ''}>${accounts.map(row => `<option value="${esc(row.portfolioId)}" ${row.portfolioId === portfolioId ? 'selected' : ''}>${esc(row.label)}</option>`).join('')}</select></label>
      <label>С даты (UTC)<input type="date" min="1990-01-01" max="${esc(today)}" value="${esc(from)}" data-report-control="from" ${busy ? 'disabled' : ''}></label>
      <label>По дату (UTC)<input type="date" min="1990-01-01" max="${esc(today)}" value="${esc(to)}" data-report-control="to" ${busy ? 'disabled' : ''}></label></div>
      <p class="broker-reports-note">Обе даты включены, максимум 31 день. Отчёт сохраняется на этом компьютере. Повторная проверка готовности запускается кнопкой.</p>
      <div class="broker-reports-toolbar"><button type="button" data-report-control="request" ${busy || !valid || waiting ? 'disabled' : ''}>${posting ? 'Загружаем отчёт…' : pending ? 'Проверить готовность' : 'Запросить отчёт у брокера'}</button>
      <button type="button" data-report-control="refresh" ${busy || !valid ? 'disabled' : ''}>Обновить сохранённое</button></div>
      <p role="status" aria-live="polite">${esc(loading ? 'Открываем локальный отчёт…' : pending ? waiting ? 'Брокер готовит отчёт. Проверка станет доступна через несколько секунд.' : 'Отчёт ещё готовится. Нажмите «Проверить готовность».' : notice)}</p>
      ${!valid ? '<p role="status">Выберите корректный период до 31 дня, не позднее текущей даты UTC.</p>' : ''}
      ${error ? `<p role="alert">${esc(error)}</p>` : ''}
      ${dto?.history.length ? `<label class="broker-reports-history">Сохранённые версии<select data-report-control="history" ${busy ? 'disabled' : ''}><option value="">Последняя за выбранный период</option>${dto.history.map(row => `<option value="${row.reportId}" ${reportId === row.reportId ? 'selected' : ''}>${date(row.from)} — ${date(row.to)} · версия ${row.revision} · получено ${date(row.capturedAt)}</option>`).join('')}</select></label>` : ''}
      ${dto?.report ? `<p class="broker-reports-note">Получено: ${esc(instant(dto.report.capturedAt))}. Строк: ${dto.pagination.total}; страниц источника: ${dto.report.sourcePages}. Совпали поля исполнений: ${dto.report.fieldsAgree}. Финансовая сверка не выполнена.</p>
      ${reportTimingHtml(dto.report.timing, timingOpen)}
      ${rows.length ? `<ol class="broker-reports-rows" start="${page * 20 + 1}">${rows.map(row => `<li data-report-row="${row.index}"><h4>${esc(row.ticker || row.name || 'Инструмент не указан')} · ${esc(row.direction || 'Вид сделки не указан')}</h4>
      <p class="broker-reports-comparison" data-comparison="${row.comparison.state}">${labels[row.comparison.state]}</p>
      <dl><div><dt>Сделка</dt><dd>${esc(instant(row.tradeAt))}</dd></div><div><dt>Расчёты (UTC)</dt><dd>${date(row.settlementAt)}</dd></div><div><dt>Поставка (UTC)</dt><dd>${date(row.deliveryAt)}</dd></div>
      <div><dt>Количество по отчёту</dt><dd>${esc(row.quantity ?? 'Не указано')}</dd></div><div><dt>Цена за единицу</dt><dd>${esc(amount(row.price))}</dd></div><div><dt>Сумма сделки</dt><dd>${esc(amount(row.total))}</dd></div>
      <div><dt>Комиссия брокера</dt><dd>${esc(amount(row.brokerCommission))}</dd></div><div><dt>Комиссия биржи</dt><dd>${esc(amount(row.exchangeCommission))}</dd></div><div><dt>Комиссия клиринга</dt><dd>${esc(amount(row.clearingCommission))}</dd></div></dl>${paymentComparison(row.comparison.paymentComparison)}${commissionComparison(row.comparison.commissionComparison, row.index, openedCommissions.has(String(row.index)))}</li>`).join('')}</ol>` : '<p>В этом ответе брокера нет строк сделок. Это не подтверждает отсутствие операций или полную историю счёта.</p>'}
      ${dto.pagination.pages > 1 ? `<nav class="broker-reports-toolbar" aria-label="Страницы отчёта"><button type="button" data-report-control="previous" ${busy || page === 0 ? 'disabled' : ''}>Назад</button><span>${page + 1} из ${dto.pagination.pages}</span><button type="button" data-report-control="next" ${busy || page + 1 >= dto.pagination.pages ? 'disabled' : ''}>Далее</button></nav>` : ''}` : dto ? '<p>За выбранный период ещё нет сохранённого отчёта.</p>' : ''}
      `}</div></details>`;
    if (focus) host.querySelector(`[data-report-control="${focus}"]`)?.focus({ preventScroll: true });
  }
  async function load() {
    if (!active() || !validPeriod() || loading || posting) return;
    const epoch = ++generation, key = selection(); loading = true; needsLoad = false; error = ''; render();
    try {
      const value = await request(PATH + '?' + new URLSearchParams({ portfolioId, from, to, expectedScopeKey: scopeKey, page: String(page), reportId }));
      if (disposed || epoch !== generation || key !== selection()) return;
      if (!checked(value)) throw Error('Invalid saved report');
      dto = value; page = value.pagination.page;
    } catch (err) {
      if (disposed || epoch !== generation || key !== selection()) return;
      dto = null; if ([401, 403].includes(err.status)) { rejectAccess(); return; }
      error = errors[err.code] || 'Не удалось открыть сохранённый отчёт. Повторите чтение.';
    } finally { if (!disposed && epoch === generation) { loading = false; render(); } }
  }
  async function requestReport() {
    if (!active() || !validPeriod() || loading || posting || Date.now() < retryAt) return;
    const epoch = ++generation, key = selection(); posting = true; error = ''; notice = ''; render();
    try {
      const value = await request(PATH, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ portfolioId, from, to, expectedScopeKey: scopeKey }) });
      if (disposed || epoch !== generation || key !== selection()) return;
      if (value?.schema !== 'broker-report-action-v1' || value.scopeKey !== scopeKey || !['pending', 'saved', 'already-retained'].includes(value.action)) throw Error('Invalid report action');
      if (value.action === 'pending') {
        if (!Number.isFinite(value.retryAfterMs) || value.retryAfterMs < 0 || value.retryAfterMs > 60000) throw Error('Invalid wait interval');
        pending = true; retryAt = Date.now() + value.retryAfterMs; cancelTimer();
        timer = setTimeout(() => { if (!disposed && key === selection()) render(); }, value.retryAfterMs + 20);
      } else {
        pending = false; retryAt = 0; cancelTimer(); reportId = ''; page = 0;
        notice = value.action === 'saved' ? 'Отчёт сохранён на этом компьютере.' : 'Полученные сведения совпадают с сохранённой версией.';
        posting = false; await load();
      }
    } catch (err) {
      if (disposed || epoch !== generation || key !== selection()) return;
      pending = false; retryAt = 0; cancelTimer(); if ([401, 403].includes(err.status)) { rejectAccess(); return; }
      error = errors[err.code] || 'Не удалось загрузить отчёт. Сохранённые сведения не изменены; повторите запрос позже.';
    } finally { if (!disposed && epoch === generation) { posting = false; render(); } }
  }
  function click(event) {
    const button = event.target.closest('[data-report-control]'); if (!button || button.disabled || !active()) return;
    const action = button.dataset.reportControl;
    if (action === 'request') void requestReport();
    else if (action === 'refresh') void load();
    else if (!loading && !posting && dto && ['next', 'previous'].includes(action)) { page += action === 'next' ? 1 : -1; void load(); }
  }
  function change(event) {
    if (!active() || loading || posting) return;
    const action = event.target.dataset.reportControl, value = event.target.value;
    if (action === 'history') {
      const selected = dto?.history.find(row => row.reportId === value); if (value && !selected) return;
      reportId = value; if (selected) { from = selected.from; to = selected.to; }
    } else if (action === 'account' && accounts.some(row => row.portfolioId === value)) { portfolioId = value; reportId = ''; }
    else if (['from', 'to'].includes(action)) { if (action === 'from') from = value; else to = value; reportId = ''; }
    else return;
    page = 0; invalidate(); render(); if (validPeriod()) void load();
  }
  function toggle(event) {
    if (!event.target.classList?.contains('broker-reports-disclosure')) return;
    opened = event.target.open; if (opened && needsLoad) void load();
  }
  function update(data) {
    const context = data?.brokerReportContext;
    const nextScope = ref(context?.scopeKey) ? context.scopeKey : '';
    const list = Array.isArray(context?.accounts) && context.accounts.length <= 100 && context.accounts.every(row => /^portfolio-[1-9]\d*$/.test(row?.portfolioId) && typeof row.label === 'string' && row.label.length <= 100) ? context.accounts : [];
    const nextAvailable = Boolean(nextScope && context?.available === true && data?.capabilities?.brokerReports === true && list.length && day(context.today)
      && data?.preview?.static !== true && data?.preview?.localReview !== true && data?.preview?.readOnly !== true);
    if (nextScope !== scopeKey || nextAvailable !== available) {
      invalidate(); ++accessToken; opened = false; denied = false; portfolioId = list[0]?.portfolioId ?? ''; reportId = ''; page = 0;
      today = day(context?.today) ? context.today : '';
      to = today ? new Date(Date.parse(today) - 86400000).toISOString().slice(0, 10) : '';
      from = to ? new Date(Date.parse(to) - 29 * 86400000).toISOString().slice(0, 10) : '';
    }
    scopeKey = nextScope; accounts = list; available = nextAvailable; today = day(context?.today) ? context.today : ''; render();
  }
  function contextChanged() { invalidate(); ++accessToken; opened = false; render(); }
  function rejectAccess(token = accessToken) { if (token !== accessToken) return; contextChanged(); denied = true; render(); }
  host?.addEventListener('click', click); host?.addEventListener('change', change); host?.addEventListener('toggle', toggle, true);
  return { update, contextChanged, rejectAccess, getAccessToken: () => accessToken, dispose() { disposed = true; ++generation; cancelTimer();
    host?.removeEventListener('click', click); host?.removeEventListener('change', change); host?.removeEventListener('toggle', toggle, true); host?.replaceChildren(); } };
}
