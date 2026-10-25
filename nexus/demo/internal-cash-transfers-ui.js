import { decimalNanos } from './number-format.js';

const PATH = '/api/analytics/internal-cash-transfers';
const esc = value => String(value ?? '').replace(/[&<>"']/gu, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const ref = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const instant = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const date = value => new Date(value).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' мск';
const asset = value => value?.assetKind === 'share' ? 'share' : value?.assetKind === undefined || value.assetKind === 'cash' ? 'cash' : null;
const positiveUnits = value => typeof value === 'string' && /^[1-9]\d{0,4105}$/u.test(value) && BigInt(value) % 1000000000n === 0n;
const shareLeg = value => ref(value.instrumentRef) && typeof value.instrumentLabel === 'string' && value.instrumentLabel.length > 0 && value.instrumentLabel.length <= 240
  && positiveUnits(value.quantityNanos) && positiveUnits(value.reportedQuantityNanos) && value.quantityBasis === 'native-done-rest'
  && typeof value.remainingQuantityNanos === 'string' && /^(0|[1-9]\d{0,4105})$/u.test(value.remainingQuantityNanos)
  && BigInt(value.remainingQuantityNanos) % 1000000000n === 0n
  && BigInt(value.quantityNanos) + BigInt(value.remainingQuantityNanos) === BigInt(value.reportedQuantityNanos)
  && !Object.hasOwn(value, 'amountNanos') && !Object.hasOwn(value, 'currency');
const leg = value => value && ref(value.operationRef) && typeof value.accountLabel === 'string' && value.accountLabel.length <= 100
  && (value.portfolioId === null || /^portfolio-\d+$/.test(value.portfolioId)) && instant(value.at)
  && ['withdrawal', 'deposit'].includes(value.kind) && (asset(value) === 'share' ? shareLeg(value)
    : asset(value) === 'cash' && typeof value.amountNanos === 'string' && /^[1-9]\d{0,4105}$/.test(value.amountNanos) && /^[A-Z]{3}$/.test(value.currency));
const describe = value => `${value.accountLabel} · ${date(value.at)} · ` + (asset(value) === 'share'
  ? `${value.instrumentLabel} · ${decimalNanos(value.quantityNanos, { digits: 9 })} шт.`
    + (value.remainingQuantityNanos !== '0' ? ` (из ${decimalNanos(value.reportedQuantityNanos, { digits: 9 })} шт.; остаток ${decimalNanos(value.remainingQuantityNanos, { digits: 9 })} шт.)` : '')
  : `${decimalNanos(value.amountNanos, { digits: 9 })} ${value.currency}`);
const compatible = (outgoing, incoming) => outgoing && incoming && outgoing.portfolioId !== incoming.portfolioId
  && outgoing.kind === 'withdrawal' && incoming.kind === 'deposit' && outgoing.at <= incoming.at && asset(outgoing) === asset(incoming)
  && (asset(outgoing) === 'share' ? outgoing.instrumentRef === incoming.instrumentRef && outgoing.quantityNanos === incoming.quantityNanos
    : asset(outgoing) === 'cash' && outgoing.currency === incoming.currency && outgoing.amountNanos === incoming.amountNanos);
const errors = { INTERNAL_CASH_TRANSFER_SOURCE_CHANGED: 'Исходные операции изменились. Обновите список и выберите их заново.',
  INTERNAL_CASH_TRANSFER_CONFLICT: 'Операция уже связана с другой отметкой. Обновите список.',
  INTERNAL_CASH_TRANSFER_INCOMPATIBLE: 'Нужны разные счета и одинаковая сумма с валютой либо одинаковое количество одного выпуска акций.',
  INTERNAL_CASH_TRANSFER_SOURCE_UNAVAILABLE: 'Сохранённые операции сейчас недоступны.',
  INTERNAL_CASH_TRANSFER_LIMIT: 'Достигнут предел локальных отметок переводов.' };

/** Owner confirmation UI. All source checks and return calculations remain native. */
export function createInternalCashTransfersUi({ host, request, onChanged = async () => {} }) {
  let scopeKey = '', key = '', stamp = '', period, eligible = false, reason = '', opened = false, disposed = false;
  let generation = 0, accessToken = 0, dto = null, loading = false, pending = null, needsLoad = true, denied = false;
  let outgoingRef = '', incomingRef = '', confirmed = false, error = '', notice = '', page = 0, assetKind = 'cash';
  const resetSelection = () => { outgoingRef = ''; incomingRef = ''; confirmed = false; page = 0; };
  const checked = value => ['internal-cash-transfers-v1', 'internal-transfers-v2'].includes(value?.schema) && value.authority === 'owner-annotation'
    && value.scopeKey === scopeKey && value.period?.from === period?.from && value.period?.to === period?.to
    && Array.isArray(value.candidates?.withdrawals) && value.candidates.withdrawals.length <= 200 && value.candidates.withdrawals.every(row => leg(row) && row.kind === 'withdrawal')
    && Array.isArray(value.candidates?.deposits) && value.candidates.deposits.length <= 200 && value.candidates.deposits.every(row => leg(row) && row.kind === 'deposit')
    && typeof value.candidates.truncated === 'boolean' && Array.isArray(value.pairs) && value.pairs.length <= 2000
    && value.pairs.every(row => /^[0-9a-f-]{36}$/.test(row?.id) && row.revision === 1 && ['current', 'source-changed'].includes(row.state) && leg(row.outgoing) && leg(row.incoming))
    && (value.schema === 'internal-transfers-v2' || [...value.candidates.withdrawals, ...value.candidates.deposits,
      ...value.pairs.flatMap(row => [row.outgoing, row.incoming])].every(row => asset(row) === 'cash'));

  function render() {
    if (!host || disposed) return;
    const focus = host.contains(document.activeElement) ? document.activeElement?.dataset?.transferControl : null;
    const active = eligible && !denied, busy = loading || Boolean(pending), outgoing = dto?.candidates.withdrawals.find(row => row.operationRef === outgoingRef);
    const incoming = dto?.candidates.deposits.find(row => row.operationRef === incomingRef), allowed = active && !busy && confirmed && compatible(outgoing, incoming);
    const shares = assetKind === 'share', withdrawals = dto?.candidates.withdrawals.filter(row => asset(row) === assetKind) || [];
    const deposits = dto?.candidates.deposits.filter(row => asset(row) === assetKind) || [];
    const options = (rows, selected) => '<option value="">Выберите операцию</option>' + rows.map(row => `<option value="${row.operationRef}" ${row.operationRef === selected ? 'selected' : ''}>${esc(describe(row))}</option>`).join('');
    const rows = dto?.pairs || []; page = Math.max(0, Math.min(page, Math.max(0, Math.ceil(rows.length / 20) - 1)));
    host.dataset.state = !active ? 'unavailable' : busy ? 'busy' : dto ? 'ready' : 'idle';
    host.innerHTML = `<details class="internal-transfers-disclosure" ${opened ? 'open' : ''}><summary data-transfer-control="summary"><span><strong>Переводы между своими счетами</strong><small>Ваши локальные отметки для общей доходности</small></span><span>${!active ? 'Недоступно' : rows.length ? 'Отметок: ' + rows.length : 'По подтверждению'}</span></summary><div class="internal-transfers-body">
      <p>${shares ? 'Свяжите списание акций с одного счёта и последующее зачисление на другой, только если это один перевод ваших бумаг. Совпадение количества само по себе не подтверждает связь.' : 'Свяжите вывод с одного счёта и пополнение другого, только если это один перевод ваших денег. Совпадение суммы само по себе не подтверждает связь.'}</p>
      <p class="internal-transfers-note">${shares ? 'Отметка классифицирует пару внутри общих TWR и MWR/XIRR при согласованном количестве и сохранённых оценках обоих счетов. Стоимость самого перевода не вычисляется.' : 'Отметка исключает обе операции из внешних потоков только в общих TWR и MWR/XIRR.'} Расчёты отдельных счетов, денежные остатки и исходные платежи сохраняются. Прочие показатели результата не пересчитываются этой отметкой. Это ваше подтверждение связи, не подтверждение брокера.</p>
      ${!active ? `<p role="status">${esc(denied ? 'Доступ изменился. Откройте рабочую среду заново.' : reason)}</p>` : `
      <p class="internal-transfers-note">Период выбора: ${esc(date(period.from))} — ${esc(date(period.to))}. ${shares ? 'Показаны даты поручений; момент поставки отдельно не подтверждён.' : 'Даты операций могут отличаться от дат фактического зачисления.'} Если перевод пересекает границу интервала оценок, общий TWR/XIRR будет недоступен.</p>
      <div class="internal-transfers-toolbar"><button type="button" data-transfer-control="refresh" ${busy ? 'disabled' : ''}>Обновить список</button><span role="status" aria-live="polite">${esc(loading ? 'Загружаем сохранённые операции…' : pending ? 'Сохраняем отметку…' : notice)}</span></div>
      ${error ? `<p role="alert">${esc(error)}</p>` : ''}
      ${dto ? `${dto.candidates.truncated ? '<p class="internal-transfers-note">Показано до 200 исходящих и 200 входящих операций денег и акций. Сузьте период, чтобы найти остальные операции.</p>' : ''}
      <div class="internal-transfers-asset"><label>Что переводили<select data-transfer-control="asset-kind" ${busy ? 'disabled' : ''}><option value="cash" ${shares ? '' : 'selected'}>Деньги</option><option value="share" ${shares ? 'selected' : ''}>Акции</option></select></label></div>
      <div class="internal-transfers-selects"><label>${shares ? 'Списание акций со счёта' : 'Вывод со счёта'}<select data-transfer-control="outgoing" ${busy ? 'disabled' : ''}>${options(withdrawals, outgoingRef)}</select></label>
      <label>${shares ? 'Зачисление акций на другой счёт' : 'Пополнение другого счёта'}<select data-transfer-control="incoming" ${busy ? 'disabled' : ''}>${options(deposits.filter(row => !outgoing || compatible(outgoing, row)), incomingRef)}</select></label></div>
      ${!withdrawals.length || !deposits.length ? `<p class="internal-transfers-note">${shares ? 'В этом периоде нет свободной пары подтверждённых списания и зачисления акций.' : 'В этом периоде нет свободной пары вывода и пополнения.'} Уже отмеченные операции находятся ниже.</p>` : ''}
      ${outgoing && incoming ? `<p class="internal-transfers-selection">${esc(describe(outgoing))}<br>→ ${esc(describe(incoming))}</p>` : ''}
      <label class="internal-transfers-confirm"><input type="checkbox" data-transfer-control="confirmed" ${confirmed ? 'checked' : ''} ${busy || !compatible(outgoing, incoming) ? 'disabled' : ''}><span>Подтверждаю: это один перевод между моими счетами.</span></label>
      <button type="button" data-transfer-control="link" ${allowed ? '' : 'disabled'}>Сохранить отметку перевода</button>
      <p class="internal-transfers-note">Это действие сохраняет отметку в приложении. ${shares ? 'Перевод бумаг не выполняется.' : 'Перевод денег не выполняется.'}</p>
      <h4>Сохранённые отметки${rows.length ? ' · ' + rows.length : ''}</h4>
      ${rows.length ? `<ul class="internal-transfers-pairs">${rows.slice(page * 20, (page + 1) * 20).map(row => `<li data-transfer-pair="${row.id}" data-state="${row.state}"><p>${esc(describe(row.outgoing))}<br>→ ${esc(describe(row.incoming))}</p><p class="internal-transfers-note">${row.state === 'current' ? 'Связь отмечена вами. Учтётся в общем расчёте при выполнении остальных условий.' : 'Исходные операции изменились. Отметка недействительна; общий расчёт недоступен. Снимите отметку и проверьте операции заново.'}</p><button type="button" data-transfer-control="unlink-${row.id}" data-transfer-unlink="${row.id}" ${busy ? 'disabled' : ''}>Снять отметку</button></li>`).join('')}</ul>` : '<p class="internal-transfers-note">В этом периоде отметок пока нет.</p>'}
      ${rows.length > 20 ? `<nav class="internal-transfers-toolbar" aria-label="Страницы отметок переводов"><button type="button" data-transfer-control="previous" ${busy || page === 0 ? 'disabled' : ''}>Назад</button><span>${page * 20 + 1}–${Math.min(rows.length, (page + 1) * 20)} из ${rows.length}</span><button type="button" data-transfer-control="next" ${busy || (page + 1) * 20 >= rows.length ? 'disabled' : ''}>Дальше</button></nav>` : ''}` : ''}`}</div></details>`;
    if (focus) host.querySelector(`[data-transfer-control="${focus}"]`)?.focus({ preventScroll: true });
  }

  async function load() {
    if (!eligible || denied || pending || disposed) return;
    const token = ++generation, selected = key; needsLoad = false; loading = true; dto = null; error = ''; resetSelection(); render();
    try {
      const value = await request(PATH + '?' + new URLSearchParams({ from: period.from, to: period.to }));
      if (token !== generation || selected !== key || disposed) return;
      if (!checked(value)) throw Error('Invalid transfer selection');
      dto = value;
    } catch (failure) {
      if (token !== generation || selected !== key || disposed) return;
      error = errors[failure?.code] || 'Не удалось загрузить отметки. Повторите загрузку списка.';
      if ([401, 403].includes(failure?.status)) denied = true;
    } finally { if (token === generation && selected === key && !disposed) { loading = false; render(); } }
  }
  async function mutate(method, body) {
    if (!eligible || denied || pending || loading || disposed) return;
    const task = { scopeKey, key }; pending = task; ++generation; notice = ''; error = ''; render();
    let succeeded = false, failureMessage = '';
    try { await request(PATH, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); succeeded = true; }
    catch (failure) { if (task.scopeKey === scopeKey && !disposed) failureMessage = errors[failure?.code] || 'Не удалось подтвердить сохранение. Проверьте обновлённый список перед повторной попыткой.'; }
    finally {
      if (task.scopeKey === scopeKey && !disposed) {
        // A period change does not cancel a completed mutation. Refresh the
        // current bootstrap, never the period captured by the old selection.
        try { await onChanged(); } catch { error = 'Не удалось обновить расчёт. Загрузите рабочую среду заново.'; }
      }
      if (pending === task) pending = null;
      if (task.scopeKey === scopeKey && !disposed) {
        dto = null; resetSelection(); needsLoad = true;
        if (succeeded) notice = method === 'POST' ? 'Отметка сохранена. Общий расчёт обновлён.' : 'Отметка снята. Общий расчёт обновлён.';
      }
      if (!disposed) {
        render(); if (opened && needsLoad && eligible && !denied) await load();
        if (task.scopeKey === scopeKey && failureMessage) { error = failureMessage; render(); }
      }
    }
  }
  function click(event) {
    const target = event.target.closest('[data-transfer-control]'); if (!target || !host.contains(target) || target.disabled) return;
    const action = target.dataset.transferControl;
    if (action === 'refresh') void load();
    else if (action === 'previous' || action === 'next') { page += action === 'next' ? 1 : -1; render(); }
    else if (target.dataset.transferUnlink) {
      const row = dto?.pairs.find(row => row.id === target.dataset.transferUnlink);
      if (row) void mutate('DELETE', { id: row.id, expectedRevision: row.revision, expectedScopeKey: scopeKey });
    } else if (action === 'link' && confirmed && compatible(dto?.candidates.withdrawals.find(row => row.operationRef === outgoingRef), dto?.candidates.deposits.find(row => row.operationRef === incomingRef)))
      void mutate('POST', { outgoingRef, incomingRef, confirmed: true, expectedScopeKey: scopeKey });
  }
  function change(event) {
    if (loading || pending || !eligible || denied) return;
    const action = event.target.dataset.transferControl;
    if (action === 'asset-kind' && ['cash', 'share'].includes(event.target.value)) { assetKind = event.target.value; resetSelection(); }
    else if (action === 'outgoing') { outgoingRef = event.target.value; incomingRef = ''; confirmed = false; }
    else if (action === 'incoming') { incomingRef = event.target.value; confirmed = false; }
    else if (action === 'confirmed') confirmed = event.target.checked;
    else return;
    render();
  }
  function toggle(event) {
    if (!event.target.classList?.contains('internal-transfers-disclosure')) return;
    opened = event.target.open;
    if (opened && needsLoad && eligible && !denied && !pending && !loading) void load();
  }
  function update(data) {
    const nextScope = ref(data?.internalTransferContext?.scopeKey) ? data.internalTransferContext.scopeKey : '';
    const ids = (data?.clientProduct?.portfolios || []).map(row => row.id), nextPeriod = data?.selectedPeriod;
    const available = Boolean(nextScope && data?.internalTransferContext?.available === true && data?.capabilities?.internalCashTransfers === true
      && data?.preview?.static !== true && data?.preview?.localReview !== true && data?.preview?.readOnly !== true);
    const next = JSON.stringify([nextScope, nextPeriod?.from, nextPeriod?.to, ids, available]);
    const nextStamp = JSON.stringify(data?.portfolio?.performance || null);
    if (next !== key || nextStamp !== stamp) {
      ++generation; ++accessToken; loading = false; dto = null; needsLoad = true; resetSelection(); error = ''; notice = '';
      if (next !== key) opened = false;
      denied = false;
    }
    scopeKey = nextScope; key = next; stamp = nextStamp; period = nextPeriod;
    eligible = available && ids.length > 1 && instant(period?.from) && instant(period?.to) && period.from < period.to;
    reason = !available ? 'Отметки доступны владельцу в подключённой локальной рабочей среде.' : ids.length < 2 ? 'Выберите «Все счета» для отметки перевода между подключёнными счетами.' : 'Выберите период с корректными датами.';
    render(); if (opened && needsLoad && eligible && !denied && !pending && !loading) void load();
  }
  function contextChanged() { ++generation; ++accessToken; loading = false; dto = null; needsLoad = true; opened = false; resetSelection(); render(); }
  function rejectAccess(token = accessToken) { if (token !== accessToken) return; contextChanged(); denied = true; render(); }
  host?.addEventListener('click', click); host?.addEventListener('change', change); host?.addEventListener('toggle', toggle, true);
  return { update, contextChanged, rejectAccess, getAccessToken: () => accessToken, dispose() { disposed = true; ++generation;
    host?.removeEventListener('click', click); host?.removeEventListener('change', change); host?.removeEventListener('toggle', toggle, true); host?.replaceChildren(); } };
}
