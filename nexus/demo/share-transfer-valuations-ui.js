import { decimalNanos } from './number-format.js';
import { checkedShareValuationView, parseShareValuationAmount, shareValuationInputValue,
  shareValuationRef as ref, shareValuationInstant as instant } from './share-transfer-valuation-contract.js';

const PATH = '/api/analytics/share-transfer-valuations';
const esc = value => String(value ?? '').replace(/[&<>"']/gu, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const date = value => new Date(value).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' мск';
const describe = row => `${row.accountLabel} · ${row.kind === 'deposit' ? 'Зачисление' : 'Списание'} · ${date(row.at)} · ${row.instrumentLabel} · ${decimalNanos(row.quantityNanos, { digits: 9 })} шт.`;
const states = { current: 'Действует при достаточных данных расчёта', 'source-changed': 'Отключена: изменился источник', superseded: 'Заменена новой оценкой', removed: 'Снята с расчёта' };
const errors = { SHARE_VALUATION_SOURCE_CHANGED: 'Исходная операция изменилась. Обновите список и проверьте её заново.',
  SHARE_VALUATION_CONFLICT: 'Оценка уже изменена. Обновите список перед сохранением.', SHARE_VALUATION_SOURCE_UNAVAILABLE: 'Сохранённые операции сейчас недоступны.',
  SHARE_VALUATION_LIMIT: 'Достигнут предел локальной истории оценок.', SHARE_VALUATION_INPUT: 'Введите неотрицательную стоимость в рублях, до девяти знаков после запятой.' };

export function createShareTransferValuationsUi({ host, request, onChanged = async () => {}, canUseContext = () => true }) {
  let scopeKey = '', key = '', stamp = '', period, portfolioIds = [], eligible = false, denied = false, opened = false, disposed = false;
  let generation = 0, accessToken = 0, dto = null, loading = false, pending = null, needsLoad = true;
  let operationRef = '', entered = '', confirmed = false, error = '', notice = '', page = 0;
  const reset = () => { operationRef = ''; entered = ''; confirmed = false; page = 0; };
  const candidates = () => (dto?.candidates || []).filter(row => portfolioIds.includes(row.portfolioId));
  const selected = () => candidates().find(row => row.operationRef === operationRef);
  const permitted = () => eligible && !denied && canUseContext() === true;
  function render() {
    if (!host || disposed) return;
    const focus = host.contains(document.activeElement) ? document.activeElement?.dataset?.valuationControl : null;
    const selection = focus === 'amount' ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
    const active = permitted(), busy = loading || Boolean(pending), candidate = selected();
    const allowed = active && !busy && candidate && confirmed && parseShareValuationAmount(entered) !== null;
    const rows = (dto?.history || []).filter(row => portfolioIds.includes(row.movement.portfolioId));
    page = Math.max(0, Math.min(page, Math.max(0, Math.ceil(rows.length / 20) - 1)));
    host.dataset.state = !active ? 'unavailable' : busy ? 'busy' : dto ? 'ready' : 'idle';
    host.innerHTML = `<details class="internal-transfers-disclosure" ${opened ? 'open' : ''}><summary data-valuation-control="summary"><span><strong>Ручная стоимость перевода акций</strong><small>Оценка внешнего финансирования</small></span><span>${!active ? 'Недоступно' : 'По вашему подтверждению'}</span></summary><div class="internal-transfers-body">
      <p>Укажите предполагаемую справедливую стоимость всего исполненного количества акций на дату поручения. Она участвует в оценке внешнего финансирования и MWR/XIRR, когда сохранённых данных достаточно.</p>
      <p class="internal-transfers-note">Стоимость вводится вручную в рублях. Цена и фактический момент поставки брокером не подтверждаются. Для перевода между своими выбранными счетами свяжите операции в разделе выше: общий расчёт исключает обе стороны независимо от этих оценок.</p>
      ${!active ? `<p role="status">${denied ? 'Доступ изменился. Откройте рабочую среду заново.' : 'Оценки доступны владельцу подключённой локальной рабочей среды при выбранном периоде.'}</p>` : `
      <div class="internal-transfers-toolbar"><button type="button" data-valuation-control="refresh" ${busy ? 'disabled' : ''}>Обновить список</button><span role="status" aria-live="polite">${esc(loading ? 'Загружаем сохранённые операции…' : pending ? 'Сохраняем оценку…' : notice)}</span></div>
      ${error ? `<p role="alert">${esc(error)}</p>` : ''}
      ${dto ? `${dto.candidatesTruncated ? '<p class="internal-transfers-note">Показано до 200 операций. Сузьте период для остальных.</p>' : ''}
      <div class="internal-transfers-selects"><label>Перевод акций<select data-valuation-control="operation" ${busy || !candidates().length ? 'disabled' : ''}><option value="">Выберите операцию</option>${candidates().map(row => `<option value="${row.operationRef}" ${row.operationRef === operationRef ? 'selected' : ''}>${esc(describe(row))}</option>`).join('')}</select></label>
      <label>Стоимость всего перевода, ₽<input type="text" inputmode="decimal" maxlength="90" data-valuation-control="amount" value="${esc(entered)}" placeholder="Например, 30,00" aria-describedby="shareValuationAmountHelp" ${busy || !candidate ? 'disabled' : ''}></label></div>
      <p id="shareValuationAmountHelp" class="internal-transfers-note">Неотрицательная сумма, до девяти знаков после запятой. Комиссия отдельно не вычитается.</p>
      ${candidate ? `<p class="internal-transfers-selection">${esc(describe(candidate))}${candidate.remainingQuantityNanos !== '0' ? ` Исполнено ${esc(decimalNanos(candidate.quantityNanos, { digits: 9 }))} из ${esc(decimalNanos(candidate.reportedQuantityNanos, { digits: 9 }))} шт.; остаток ${esc(decimalNanos(candidate.remainingQuantityNanos, { digits: 9 }))} шт. в стоимость не входит.` : ''}</p>` : `<p class="internal-transfers-note">${candidates().length ? 'Выберите сохранённый перевод с подтверждённым исполненным количеством.' : 'В выбранных счетах и периоде нет переводов акций с подтверждённым исполненным количеством.'}</p>`}
      <label class="internal-transfers-confirm"><input type="checkbox" data-valuation-control="confirmed" ${confirmed ? 'checked' : ''} ${busy || !candidate ? 'disabled' : ''}>Подтверждаю: это моя оценка справедливой стоимости всего исполненного количества на показанную дату поручения.</label>
      <button type="button" data-valuation-control="save" ${allowed ? '' : 'disabled'}>${candidate?.currentValuation ? 'Сохранить новую оценку' : 'Сохранить оценку'}</button>
      <h4>История ручных оценок</h4>${dto.historyTruncated ? '<p class="internal-transfers-note">Показаны последние 200 записей за период. Более ранние записи сохранены локально.</p>' : ''}
      ${rows.length ? `<ul class="internal-transfers-pairs">${rows.slice(page * 20, (page + 1) * 20).map(row => `<li data-valuation-state="${row.state}"><p>${esc(describe(row.movement))}</p><p><strong>${esc(decimalNanos(row.amountNanos, { digits: 9 }))} ₽ · ручная оценка</strong><br>${states[row.state]}. Сохранена ${esc(date(row.createdAt))}.${row.removedAt ? ' Снята ' + esc(date(row.removedAt)) + '.' : ''}</p>${row.revision === 1 ? `<button type="button" data-valuation-control="remove-${row.id}" data-valuation-remove="${row.id}" ${busy ? 'disabled' : ''}>Снять оценку</button>` : ''}</li>`).join('')}</ul>` : '<p class="internal-transfers-note">В выбранных счетах и периоде оценок пока нет.</p>'}
      ${rows.length > 20 ? `<nav class="internal-transfers-toolbar" aria-label="Страницы истории оценок"><button type="button" data-valuation-control="previous" ${busy || page === 0 ? 'disabled' : ''}>Назад</button><span>${page * 20 + 1}–${Math.min(rows.length, (page + 1) * 20)} из ${rows.length}</span><button type="button" data-valuation-control="next" ${busy || (page + 1) * 20 >= rows.length ? 'disabled' : ''}>Дальше</button></nav>` : ''}` : ''}`}</div></details>`;
    const control = focus ? host.querySelector(`[data-valuation-control="${focus}"]`) : null;
    control?.focus({ preventScroll: true });
    if (selection && control?.setSelectionRange) control.setSelectionRange(...selection);
  }
  async function load() {
    if (!permitted() || pending || disposed) return;
    const token = ++generation, captured = key; needsLoad = false; loading = true; dto = null; error = ''; reset(); render();
    try {
      const value = await request(PATH + '?' + new URLSearchParams({ from: period.from, to: period.to }));
      if (token !== generation || captured !== key || disposed) return;
      dto = checkedShareValuationView(value, { scopeKey, period });
    } catch (failure) {
      if (token !== generation || captured !== key || disposed) return;
      error = errors[failure?.code] || 'Не удалось загрузить оценки. Повторите загрузку списка.';
      if ([401, 403].includes(failure?.status)) denied = true;
    } finally { if (token === generation && captured === key && !disposed) { loading = false; render(); } }
  }
  async function mutate(method, body) {
    if (!permitted() || pending || loading || disposed) return;
    const task = { scopeKey }; pending = task; ++generation; notice = ''; error = ''; render();
    let succeeded = false, failureMessage = '';
    try { await request(PATH, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); succeeded = true; }
    catch (failure) {
      if (task.scopeKey === scopeKey && !disposed) {
        failureMessage = errors[failure?.code] || 'Сохранение не подтверждено. Проверьте обновлённый список перед повтором.';
        if ([401, 403].includes(failure?.status)) denied = true;
      }
    } finally {
      if (task.scopeKey === scopeKey && !disposed && !denied) {
        try { await onChanged(); } catch { error = 'Не удалось обновить расчёт. Загрузите рабочую среду заново.'; }
      }
      if (pending === task) pending = null;
      if (task.scopeKey === scopeKey && !disposed) {
        dto = null; reset(); needsLoad = true;
        if (succeeded) notice = method === 'POST' ? 'Ручная оценка сохранена. Расчёт обновлён.' : 'Оценка снята. Расчёт обновлён.';
      }
      if (!disposed) {
        render(); if (opened && needsLoad && eligible && !denied) await load();
        if (task.scopeKey === scopeKey && failureMessage) { error = failureMessage; render(); }
      }
    }
  }
  function click(event) {
    const target = event.target.closest('[data-valuation-control]'); if (!target || !host.contains(target) || target.disabled) return;
    const action = target.dataset.valuationControl;
    if (action === 'refresh') void load();
    else if (action === 'previous' || action === 'next') { page += action === 'next' ? 1 : -1; render(); }
    else if (target.dataset.valuationRemove) {
      const row = dto?.history.find(row => row.id === target.dataset.valuationRemove && row.revision === 1);
      if (row) void mutate('DELETE', { id: row.id, expectedRevision: 1, expectedScopeKey: scopeKey });
    } else if (action === 'save' && confirmed && selected()) {
      const amountNanos = parseShareValuationAmount(entered);
      if (amountNanos !== null) void mutate('POST', { operationRef, amountNanos, currency: 'RUB', confirmed: true,
        expectedCurrentId: selected().currentValuation?.id ?? null, expectedScopeKey: scopeKey });
    }
  }
  function change(event) {
    if (loading || pending || !permitted()) return;
    const action = event.target.dataset.valuationControl;
    if (action === 'operation') { operationRef = event.target.value; entered = shareValuationInputValue(selected()?.currentValuation?.amountNanos); confirmed = false; }
    else if (action === 'confirmed') confirmed = event.target.checked;
    else return;
    render();
  }
  function input(event) {
    if (event.target.dataset.valuationControl !== 'amount' || loading || pending || !permitted()) return;
    entered = event.target.value; confirmed = false; render();
  }
  function toggle(event) {
    if (event.target.parentElement !== host || !event.target.classList?.contains('internal-transfers-disclosure')) return;
    opened = event.target.open;
    if (opened && needsLoad && eligible && !denied && !pending && !loading) void load();
  }
  function update(data) {
    const nextScope = ref(data?.shareValuationContext?.scopeKey) ? data.shareValuationContext.scopeKey : '';
    const ids = (data?.clientProduct?.portfolios || []).map(row => row.id), nextPeriod = data?.selectedPeriod;
    const available = Boolean(nextScope && data?.shareValuationContext?.available === true && data?.capabilities?.shareTransferValuations === true
      && data?.preview?.static !== true && data?.preview?.localReview !== true && data?.preview?.readOnly !== true);
    const next = JSON.stringify([nextScope, nextPeriod?.from, nextPeriod?.to, ids, available]), nextStamp = JSON.stringify(data?.portfolio?.performance || null);
    if (next !== key || nextStamp !== stamp) {
      ++generation; ++accessToken; loading = false; dto = null; needsLoad = true; reset(); error = ''; notice = ''; denied = false;
      if (next !== key) opened = false;
    }
    scopeKey = nextScope; key = next; stamp = nextStamp; period = nextPeriod; portfolioIds = ids;
    eligible = available && ids.length > 0 && instant(period?.from) && instant(period?.to) && period.from < period.to;
    render(); if (opened && needsLoad && eligible && !denied && !pending && !loading) void load();
  }
  function contextChanged() { ++generation; ++accessToken; loading = false; dto = null; needsLoad = true; opened = false; reset(); render(); }
  function rejectAccess(token = accessToken) { if (token !== accessToken) return; contextChanged(); denied = true; render(); }
  host?.addEventListener('click', click); host?.addEventListener('change', change); host?.addEventListener('input', input); host?.addEventListener('toggle', toggle, true);
  return { update, contextChanged, rejectAccess, getAccessToken: () => accessToken, dispose() { disposed = true; ++generation;
    host?.removeEventListener('click', click); host?.removeEventListener('change', change); host?.removeEventListener('input', input);
    host?.removeEventListener('toggle', toggle, true); host?.replaceChildren(); } };
}
