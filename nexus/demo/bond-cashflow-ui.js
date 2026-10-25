import { BOND_CASHFLOW_REASONS as reasons, cashflowDecimal, validBondCashflows } from './bond-cashflow-contract.js';
const esc = value => String(value ?? '').replace(/[&<>"']/gu, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const decimal = (value, scale = 18) => { const parts = (cashflowDecimal(value, scale) ?? 'Нет данных').split('.'); return parts[0].replace(/\B(?=(\d{3})+$)/gu, '\u00a0').replace(/^-/, '−') + (parts[1] ? ',' + parts[1] : ''); };
const amount = (value, currency, scale = 18) => value === null || !currency ? 'Сумма не указана' : decimal(value, scale) + ' ' + currency;
const day = value => value ? value.slice(0, 10).split('-').reverse().join('.') : 'Не указана';
const time = value => value ? new Date(value).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }) + ' мск' : 'Неизвестно';
const month = value => new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(value + '-01T00:00:00Z')).replace(/ г\.$/u, '');
const positionLabel = row => [row.ticker, row.name].filter(Boolean).join(' · ') || 'Облигация без названия';

export function createBondCashflowUi({ host, request, getBootstrap, getPortfolioId = () => '', canUseContext = () => true, onOpenEvents = () => false }) {
  let current = null, dto = null, signature = '', revision = 0, controller = null, busy = false, disposed = false, rejected = false, lastBootstrap = null, attemptedSignature = '', keepReadVisible = false;
  const shown = new Map();
  host.classList.add('bond-cashflow');
  host.innerHTML = '<header class="financial-section-head"><div><h3>Выплаты по облигациям</h3><p>По текущему сохранённому количеству бумаг · до налогов</p></div><button type="button" class="button secondary" data-cashflow-read>Показать график</button></header><p class="bond-cashflow-status" data-cashflow-status role="status" aria-live="polite"></p><div data-cashflow-result></div>';
  const find = name => host.querySelector('[data-cashflow-' + name + ']');
  function context() {
    const root = getBootstrap?.(), value = root?.bondCashflowContext, selection = getPortfolioId() || 'all';
    const valid = value?.version === 'bond-cashflow-context-v1' && /^[a-f0-9]{64}$/u.test(value.key || '') && Array.isArray(value.portfolioIds)
      && (selection === 'all' || value.portfolioIds.includes(selection));
    const available = valid && root?.preview?.static !== true && root?.preview?.localReview !== true && canUseContext() && !rejected;
    const snapshots = (root?.clientProduct?.portfolios || []).map(row => [row.id, row.asOf, row.preferenceKey]);
    return { key: value?.key || '', selection, available, signature: JSON.stringify([value?.key, selection, snapshots, Boolean(available)]) };
  }
  function status(state, text) {
    host.dataset.state = state; find('status').textContent = text; find('read').disabled = !context().available; find('read').setAttribute('aria-disabled', String(busy));
    find('read').textContent = busy ? 'Читаем…' : state === 'error' ? 'Повторить чтение' : 'Перечитать график';find('read').hidden = !dto && state !== 'error' && !(busy && keepReadVisible);
    host.setAttribute('aria-busy', String(busy));
  }
  function clear() { revision++; controller?.abort(); controller = null; busy = false; dto = null; shown.clear(); find('result').replaceChildren(); }
  function accountLabel(id) { return getBootstrap()?.clientProduct?.portfolios?.find(row => row.id === id)?.label || 'Выбранный счёт'; }
  function totalsText(rows) { return rows.length ? rows.map(row => amount(row.totalNumerator, row.currency)).join(' · ') : 'Нет рассчитанных сумм'; }
  function renderResult({ focusMonth = null } = {}) {
    if (!dto) return;
    const open = new Set([...find('result').querySelectorAll('details[open]')].map(node => node.dataset.cashflowMonth || node.dataset.cashflowDisclosure));
    const byPosition = new Map(dto.positions.map(row => [row.key, row])), byRecord = new Map(dto.records.map(row => [row.key, row]));
    const sourceRows = dto.positions.flatMap(row => row.sources), coupons = sourceRows.filter(row => row.kind === 'coupons');
    const sourceTotal = new Map(dto.positions.flatMap(position => position.sources.map(row => [JSON.stringify([position.instrumentUid, row]), row])));
    const missing = [...sourceTotal.values()].filter(row => row.state !== 'ready').length, stale = [...sourceTotal.values()].filter(row => row.stale).length;
    const excluded = dto.positions.filter(row => row.state === 'excluded').length, accountUnknown = dto.accounts.filter(row => row.state !== 'ready').length;
    const scope = dto.selection === 'all' ? 'Все выбранные счета' : accountLabel(dto.selection);
    const recordMarkup = row => {
      const position = byPosition.get(row.positionKey), known = row.state === 'included';
      const facts = [['Количество в сохранённом составе', decimal(position.quantityNanos, 9) + ' шт.'], ['На одну облигацию', amount(row.amountNanos, row.currency, 9)],
        ['Дата события', day(row.eventDate)], ['Дата выплаты', day(row.paymentDate)],
        ...(row.couponType ? [['Тип купона', row.couponType]] : []), ...(row.recordDate ? [['Фиксация владельцев', day(row.recordDate)]] : []),
        ...(row.rateDate ? [['Определение условий', day(row.rateDate)]] : []), ...(row.executionDate ? [['Исполнение по данным источника', day(row.executionDate)]] : []),
        ...(row.defaultDate ? [['Дата дефолта', day(row.defaultDate)]] : []), ...(row.sourceExecution ? [['Признак исполнения источника', row.sourceExecution]] : []),
        ...(row.operationType ? [['Тип операции источника', row.operationType]] : []), ['График получен', time(row.capturedAt) + (row.stale ? ' · требует обновления' : '')]];
      return `<li class="bond-cashflow-record" data-cashflow-record="${esc(row.key)}"><div class="bond-cashflow-record-head"><div><strong>${esc(positionLabel(position))}</strong><span>${esc(row.title)} · ${esc(accountLabel(position.portfolioId))}</span></div><strong>${esc(known ? amount(row.amountNumerator, row.currency) : 'Без расчёта')}</strong></div>
        ${known ? `<p>${esc(decimal(position.quantityNanos, 9) + ' шт. × ' + amount(row.amountNanos, row.currency, 9))}</p>` : `<p>${esc(reasons[row.reasonCode])}</p>`}
        <dl class="bond-cashflow-facts">${facts.map(([name, value]) => `<div><dt>${esc(name)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>
        <button type="button" class="text-button" data-cashflow-event="${esc(row.key)}">Открыть событие в календаре</button></li>`;
    };
    const months = dto.months.map(row => {
      const rows = row.recordKeys.map(key => byRecord.get(key)), limit = shown.get(row.month) || 20;
      const caption = row.excludedRecords ? 'События без расчёта: ' + row.excludedRecords : rows.length ? 'По опубликованным суммам' : 'Нет записей в сохранённых графиках';
      const summary = `<span>${esc(month(row.month))}</span><strong>${esc(totalsText(row.totals))}</strong><small>${esc(caption)}</small>`;
      if (!rows.length) return `<div class="bond-cashflow-empty-month"><div class="bond-cashflow-month-label">${summary}</div></div>`;
      return `<details class="bond-cashflow-month" data-cashflow-month="${row.month}" ${open.has(row.month) ? 'open' : ''}><summary class="bond-cashflow-month-label">${summary}</summary><div class="bond-cashflow-month-body">
        ${row.totals.length ? `<dl class="bond-cashflow-breakdown">${row.totals.map(value => `<div><dt>Купоны · ${value.currency}</dt><dd>${esc(amount(value.couponNumerator, value.currency))}</dd></div><div><dt>Погашения · ${value.currency}</dt><dd>${esc(amount(value.redemptionNumerator, value.currency))}</dd></div>`).join('')}</dl>` : ''}
        <ol class="bond-cashflow-records">${rows.slice(0, limit).map(recordMarkup).join('')}</ol>${rows.length > limit ? `<button type="button" class="button secondary" data-cashflow-more="${row.month}">Показать ещё ${Math.min(20, rows.length - limit)}</button>` : ''}</div></details>`;
    }).join('');
    const coverage = dto.positions.map(row => {
      const years = [...new Set(dto.window.months.map(value => value.slice(0, 4)))];
      return `<li><h4>${esc(positionLabel(row))} · ${esc(accountLabel(row.portfolioId))}</h4><p>${esc(row.quantityNanos === null ? 'Количество не подтверждено.' : decimal(row.quantityNanos, 9) + ' шт.')} Получено ${esc(time(row.observedAt))}.${row.state === 'excluded' ? ' ' + esc(reasons[row.reasonCode]) : ''}</p>
        ${row.sources.length ? '<ul>' + row.sources.map(value => `<li>${value.kind === 'coupons' ? 'Купоны' : 'События выпуска'}, ${value.year}: ${value.state === 'ready' ? value.events + ' опубликованных событий · получено ' + esc(time(value.capturedAt)) + (value.stale ? ' · требует обновления' : '') : value.state === 'invalid' ? 'сохранённые сведения не прошли проверку' : 'ещё не загружено'}.</li>`).join('') + '</ul>' : ''}
        <div class="bond-cashflow-source-actions">${years.map(year => `<button type="button" class="text-button" data-cashflow-source="${esc(row.key)}" data-cashflow-year="${year}">События за ${year}</button>`).join('')}</div></li>`;
    }).join('');
    find('result').innerHTML = `<p class="bond-cashflow-period">${esc(scope)} · ${esc(day(dto.window.from))} — ${esc(day(dto.window.to))}. ${dto.dataMode === 'synthetic' ? 'Учебные данные.' : 'Сохранённые данные.'}</p>
      <p>График будущих выплат использует последние сохранённые позиции. Общий фильтр прошедшего периода к нему не применяется.</p>
      ${dto.state === 'unavailable' ? `<p class="bond-cashflow-boundary">${esc(reasons[dto.reasonCode])}</p>` : !dto.positions.length && !accountUnknown ? '<p>В проверенном сохранённом составе нет ненулевых позиций облигаций.</p>' : `<p class="bond-cashflow-total"><strong>По опубликованным суммам: ${esc(totalsText(dto.totals))}</strong></p><p>Позиции для расчёта: ${dto.positions.length - excluded} из ${dto.positions.length}. Купонные графики: ${coupons.filter(row => row.state === 'ready').length} из ${coupons.length} для этих позиций.${accountUnknown ? ' Не подтверждён состав счетов: ' + accountUnknown + '.' : ''}${missing ? ' Есть незагруженные или повреждённые графики.' : ''}${stale ? ' Часть графиков требует обновления.' : ''}</p>
      <p class="bond-cashflow-boundary">Это условные суммы при неизменном количестве бумаг. Полнота будущего графика и право на выплаты не подтверждены. Оферты, конвертации, дефолт и исполнения источника не прибавляются к ожидаемым поступлениям.</p><div class="bond-cashflow-months">${months}</div>`}
      <details class="bond-cashflow-disclosure" data-cashflow-disclosure="coverage" ${open.has('coverage') ? 'open' : ''}><summary>Позиции и источники графика</summary>
        ${dto.accounts.map(row => `<p>${esc(accountLabel(row.portfolioId))}: ${row.state === 'ready' ? 'состав получен ' + esc(time(row.observedAt)) + (row.stale ? ' · требует обновления' : '') : esc(reasons[row.reasonCode])}.</p>`).join('')}
        <p>Количество относится к каждой указанной дате счёта. Купоны взяты из сохранённых годовых графиков; погашения — из доступных сохранённых событий выпуска. Их полнота не подтверждена. Чтение этого экрана не обновляет брокерские источники. Для обновления откройте события и воспользуйтесь действием календаря.</p>
        <ul class="bond-cashflow-positions">${coverage}</ul></details>
      <details class="bond-cashflow-disclosure" data-cashflow-disclosure="method" ${open.has('method') ? 'open' : ''}><summary>Как рассчитаны суммы</summary><p>Количество бумаг × выплата на одну облигацию из источника. Лот и номинал повторно не применяются; известный ноль отличается от отсутствующей суммы. Каждая валюта считается отдельно, без пересчёта по курсу. Все сохранённые десятичные знаки учтены до сложения.</p><p>НКД, налог, изменения количества после погашений, участие в офертах и право владельца на выплату не моделируются. Плавающий купон может измениться. Фактическое зачисление проверяется по денежным операциям. Пустой месяц не означает отсутствия выплат.</p><p>Даты событий и выплат — по источнику в UTC; время получения показано в МСК. Момент получения не является датой публикации. Обзор прочитан: ${esc(time(dto.generatedAt))}.</p></details>`;
    if (focusMonth) { const target = find('result').querySelector(`[data-cashflow-more="${focusMonth}"]`) || find('result').querySelector(`[data-cashflow-month="${focusMonth}"]>summary`); target?.focus({ preventScroll: true }); }
  }
  function update(data = current) {
    if (disposed) return;
    current = data; const root = getBootstrap?.();
    if (root !== lastBootstrap) { lastBootstrap = root;if(rejected)attemptedSignature=''; rejected = false; }
    const next = context();
    if (signature !== next.signature) { signature = next.signature; clear(); }
    if (!next.available) status('unavailable', 'Сохранённый график доступен владельцу в подключённой локальной рабочей среде.');
    else if (!dto && !busy) {if(host.dataset.state==='error'&&attemptedSignature===next.signature)status('error',find('status').textContent);else {status('idle', 'График будет прочитан из сохранённых данных на этом устройстве.');maybeLoad();}}
    else if (!busy) { renderResult(); status(dto.state === 'available' ? 'ready' : 'unavailable', dto.state === 'available' ? 'Показаны сохранённые графики. Условия и даты получения доступны ниже.' : reasons[dto.reasonCode]); }
  }
  async function load() {
    update(); const selected = context(); if (disposed || !selected.available || busy) return;
    attemptedSignature=selected.signature;
    // Keep a visible retry control mounted while it loads so keyboard focus
    // survives success/error. Initial automatic loading remains unobtrusive.
    keepReadVisible=!find('read').hidden;
    clear(); busy = true; const own = ++revision; controller = new AbortController(); const active = controller;
    status('loading', 'Проверяем сохранённые позиции и графики выплат…');
    try {
      const value = await request('/api/calendar/bond-cashflows?' + new URLSearchParams({ contextKey: selected.key, portfolioId: selected.selection }), { signal: active.signal });
      if (disposed || own !== revision || context().signature !== selected.signature) return;
      if (!validBondCashflows(value, { contextKey: selected.key, selection: selected.selection })) throw Error('Invalid cashflow response');
      dto = value; renderResult();
    } catch (error) {
      if (disposed || own !== revision || context().signature !== selected.signature || error.name === 'AbortError') return;
      if ([401,403].includes(error.status)) rejected = true;
      dto = null; find('result').replaceChildren(); busy = false;
      status('error', [401,403,409].includes(error.status) ? 'Доступ или состав счетов изменился. Обновите рабочую область.' : 'Не удалось прочитать сохранённый график. Повторите чтение.'); return;
    } finally { if (!disposed && own === revision) { busy = false; controller = null; if (context().signature !== selected.signature) update(); } }
    if (!disposed && own === revision) status(dto?.state === 'available' ? 'ready' : 'unavailable', dto?.state === 'available' ? 'Показаны сохранённые графики. Условия и даты получения доступны ниже.' : reasons[dto?.reasonCode] || 'Нет подтверждённого графика.');
  }
  host.addEventListener('click', event => {
    if (event.target.closest('[data-cashflow-read]')) { void load(); return; }
    const more = event.target.closest('[data-cashflow-more]');
    if (more && dto) { shown.set(more.dataset.cashflowMore, (shown.get(more.dataset.cashflowMore) || 20) + 20); renderResult({ focusMonth: more.dataset.cashflowMore }); return; }
    const button = event.target.closest('[data-cashflow-source],[data-cashflow-event]'); if (!button || !dto || !context().available) return;
    const row = button.dataset.cashflowEvent ? dto.records.find(row => row.key === button.dataset.cashflowEvent) : null;
    const position = dto.positions.find(value => value.key === (row?.positionKey || button.dataset.cashflowSource));
    if (!position) return;
    const date = row?.eventDate || button.dataset.cashflowYear + '-01-01';
    if (onOpenEvents(position.instrumentUid, date) !== true) status('ready', 'Не удалось открыть события этого выпуска. Обновите каталог и повторите переход.');
  });
  let loadFrame=0;
  function maybeLoad(){
    const selected=context();
    // Hidden statistical panels must not force synchronous layout on every
    // navigation/refresh. Recheck visibility once after the current DOM batch.
    if(disposed||!selected.available||busy||dto||attemptedSignature===selected.signature||host.closest('[hidden],.view:not(.active)')||loadFrame)return;
    loadFrame=requestAnimationFrame(()=>{
      loadFrame=0;const current=context();
      if(disposed||!current.available||busy||dto||attemptedSignature===current.signature||host.closest('[hidden],.view:not(.active)')||!host.getClientRects().length)return;
      attemptedSignature=current.signature;void load();
    });
  }
  const reveal=()=>maybeLoad();document.addEventListener('invest:portfolio-tool-changed',reveal);document.addEventListener('invest:view-changed',reveal);
  return { update, contextChanged: () => update(), dispose() { disposed = true; cancelAnimationFrame(loadFrame);clear();document.removeEventListener('invest:portfolio-tool-changed',reveal);document.removeEventListener('invest:view-changed',reveal); } };
}
