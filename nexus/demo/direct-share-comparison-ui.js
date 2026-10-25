import { concentrationDecimal, concentrationPriceCurrency } from './direct-share-concentration-contract.js';
import { validateDirectShareComparison } from './direct-share-comparison-contract.js';
const PATH = '/api/analytics/direct-share-comparison';
const esc = value => String(value ?? '').replace(/[&<>"']/gu, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const missing = { absent: 'Нет строки в наблюдении; значение неизвестно', excluded: 'Строка исключена из расчёта', ambiguous: 'Строки неоднозначны' };

export function createDirectShareComparisonUi({ host, request, format, canUseContext = () => true }) {
  let context = null, signature = '', result = null, phase = 'idle', message = '', shown = 5, sequence = 0, controller = null, rejected = false, accessEpoch = 0;
  const control = (key, text) => `<button type="button" class="button" data-share-compare="${key}" ${phase === 'loading' ? 'aria-disabled="true"' : ''}>${text}</button>`;
  const ratioDelta = value => {
    if (!value) return 'Не определено';
    const n = BigInt(value.numerator);
    const valueText = format.ratio({ ...value, numerator: (n < 0n ? -n : n).toString() }).replace(' %', ' п. п.');
    if (valueText.startsWith('<')) return valueText + ' по модулю · ' + (n < 0n ? 'снижение' : 'рост');
    const sign = n < 0n ? '−' : n > 0n ? '+' : '';
    return valueText.startsWith('≈ ') ? '≈ ' + sign + valueText.slice(2) : sign + valueText;
  };
  function focus(key) {
    const el = host.querySelector(`[data-share-compare="${key}"]`) || host.querySelector('[data-share-compare="read"]');
    if (!el) return;
    const bar = document.querySelector('.topbar'); el.style.scrollMarginTop = Math.ceil((bar?.getBoundingClientRect().height || 0) + 12) + 'px';
    el.style.scrollMarginBottom = '12px'; el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }
  function render(focused = null) {
    host.dataset.state = phase; host.setAttribute('aria-busy', String(phase === 'loading'));
    const rows = result?.comparison.rows || [], before = result?.previous, after = result?.current;
    host.innerHTML = `<h4>Изменения сохранённого состава</h4><p>Сравните текущий состав с ближайшим более ранним наблюдением на этом устройстве.</p>
      <p role="status" aria-live="polite">${esc(message || (phase === 'loading' ? 'Читаем два сохранённых наблюдения…' : !context ? 'Сравнение доступно в локальном приложении для одного счёта с подтверждённым составом.' : result?.comparison.state === 'partial' ? 'Два сохранённых наблюдения прочитаны.' : result ? 'Предыдущее наблюдение не подтверждено.' : 'Чтение запускается кнопкой.'))}</p>
      ${context ? control('read', phase === 'loading' ? 'Читаем…' : result || phase === 'error' ? 'Перепроверить сравнение' : 'Сравнить с предыдущим наблюдением') : ''}
      ${result?.comparison.state === 'unavailable' ? '<p>Ближайшее предыдущее наблюдение не подтверждено или отсутствует. Более старый снимок не подставляется; изменения неизвестны.</p>' : ''}
      ${result?.comparison.state === 'partial' ? `<p class="concentration-caption">Было: ${esc(format.time(before.period.observedAt))}. Стало: ${esc(format.time(after.period.observedAt))}. Эти даты могут предшествовать выбранному периоду.</p>
      <p>Сопоставлено инструментов: <strong data-share-compared>${result.comparison.matched}</strong>; без подтверждённой пары: ${result.comparison.unmatched}. Строк без идентификатора в двух наблюдениях: ${result.comparison.unidentified}.</p>
      <dl class="concentration-values"><div><dt>Абсолютная сумма включённых позиций · было</dt><dd data-share-gross="before">${esc(format.money(before.calculation.totals?.gross))}</dd></div><div><dt>Абсолютная сумма включённых позиций · стало</dt><dd data-share-gross="after">${esc(format.money(after.calculation.totals?.gross))}</dd></div></dl>
      <p class="concentration-caption">Было включено ${before.coverage.includedRows} из ${before.coverage.positionsObserved} строк; стало ${after.coverage.includedRows} из ${after.coverage.positionsObserved}. Доля каждого наблюдения использует его собственную абсолютную сумму, включая инструменты без пары. Изменение доли может отражать изменение состава.</p>
      <div data-share-comparison-rows>${rows.slice(0, shown).map((row, index) => renderRow(row, index, before, after)).join('')}</div>
      ${shown < rows.length ? control('more', 'Показать ещё сравнения') : ''}` : ''}
      <p class="concentration-caption">Сравниваются количества, цены и знаковые стоимости одного инструмента; совпадения тикеров недостаточно. Это арифметические изменения наблюдений, не прибыль, доходность или объяснение причин. Покупки, продажи и корпоративные действия по ним не устанавливаются. При валютной цене рублёвая стоимость также зависит от выбранного курса ЦБ; отдельный вклад курса здесь не вычисляется. Разница исходных цен доступна только при совпадении их валют. Отсутствие строки не означает нулевую позицию.</p>`;
    if (focused) focus(focused);
  }
  function renderRow(row, index, before, after) {
    const a = before.rows.find(item => item.key === row.before.key), b = after.rows.find(item => item.key === row.after.key);
    const old = row.before.state === 'included' ? before.calculation.positions.find(item => item.key === row.before.key) : null;
    const next = row.after.state === 'included' ? after.calculation.positions.find(item => item.key === row.after.key) : null;
    const val = (source, item, field) => !source ? 'Неизвестно' : field === 'quantity' ? format.decimal(concentrationDecimal(item.quantityNanos, 9)) + ' шт.'
      : field === 'price' ? format.money(concentrationDecimal(item.priceNanos, 9), concentrationPriceCurrency(item)) : field === 'value' ? format.money(source.value) : format.ratio(source.weight);
    const changes = { quantity: row.quantityDeltaNanos === null ? 'Неизвестно' : format.decimal(concentrationDecimal(row.quantityDeltaNanos, 9)) + ' шт.',
      price: row.priceDeltaNanos === null ? row.state === 'matched' ? 'Разные валюты цены' : 'Неизвестно' : format.money(concentrationDecimal(row.priceDeltaNanos, 9), concentrationPriceCurrency(b)), value: format.money(row.valueDelta), weight: ratioDelta(row.weightDelta) };
    const label = b?.ticker || a?.ticker || row.instrumentUid;
    return `<details data-share-comparison-row><summary data-share-compare="row-${index + 1}"><strong>${esc(label)}</strong><small>${row.state === 'matched' ? 'Изменение знаковой стоимости: ' + esc(format.money(row.valueDelta)) : 'Изменение неизвестно'}</small></summary>
      <p class="concentration-caption">Инструмент: ${esc(row.instrumentUid)}</p>
      ${[a, b].some(item => item?.conversion?.source === 'cbr-saved') ? `<p class="concentration-caption" data-share-fx>Рублёвая оценка · было: ${esc(old ? format.fx(a) : 'неизвестно')}. Стало: ${esc(next ? format.fx(b) : 'неизвестно')}.</p>` : ''}
      ${row.state === 'unknown' ? `<p>Было: ${esc(missing[row.before.state] || 'значение подтверждено')}. Стало: ${esc(missing[row.after.state] || 'значение подтверждено')}.</p>` : ''}
      <table><caption>Два наблюдения · ${esc(label)}</caption><thead><tr><th scope="col">Показатель</th><th scope="col">Было</th><th scope="col">Стало</th></tr></thead><tbody>
      ${[['quantity', 'Количество'], ['price', 'Цена за акцию'], ['value', 'Знаковая стоимость'], ['weight', 'Доля абсолютной суммы']].map(([field, title]) => `<tr data-share-metric="${field}"><th scope="row">${title}</th><td>${esc(val(old, a, field))}</td><td>${esc(val(next, b, field))}<small>Изменение: <span data-share-delta="${field}">${esc(changes[field])}</span></small></td></tr>`).join('')}</tbody></table></details>`;
  }
  function clear({ forbidden = false } = {}) {
    forbidden = forbidden || rejected;
    sequence++; controller?.abort(); controller = null; result = null; shown = 5; phase = forbidden ? 'forbidden' : 'idle';
    message = forbidden ? 'Доступ изменился. Обновите данные портфеля.' : ''; if (forbidden) { rejected = true; context = null; }
    render();
  }
  async function read() {
    if (!context || phase === 'loading' || !canUseContext()) return;
    const selected = context, id = ++sequence, abort = new AbortController(); controller?.abort(); controller = abort;
    result = null; phase = 'loading'; message = ''; shown = 5; render('read');
    try {
      const dto = await request(PATH + '?' + new URLSearchParams(selected.query), { method: 'GET', signal: abort.signal });
      if (id !== sequence || selected !== context) return;
      if (!canUseContext()) { clear(); return; }
      if (!validateDirectShareComparison(dto, selected.current, selected.query.expectedContextKey)) throw Error('invalid-response');
      result = dto; phase = 'ready';
    } catch (error) {
      if (id !== sequence || abort.signal.aborted) return;
      result = null; phase = 'error';
      if ([401, 403].includes(error?.status)) { clear({ forbidden: true }); return; }
      message = error?.code === 'SHARE_COMPARISON_CHANGED' ? 'Данные оценки изменились после открытия. Обновите данные портфеля перед сравнением.'
        : error?.code === 'TRADING_PLAN_CONTEXT_CHANGED' || error?.code === 'SHARE_COMPARISON_SCOPE' ? 'Счёт или доступ изменились. Обновите данные портфеля.' : 'Сравнение не подтверждено. Повторите проверку.';
    }
    if (id !== sequence) return;
    controller = null; render(host.contains(document.activeElement) ? 'read' : null);
  }
  host.addEventListener('click', event => {
    const button = event.target.closest?.('button[data-share-compare]'); if (!button || phase === 'loading') return;
    if (button.dataset.shareCompare === 'read') void read();
    if (button.dataset.shareCompare === 'more') { const next = shown + 1; shown += 8; render('row-' + next); }
  });
  host.addEventListener('focusin', event => {
    const target = event.target;
    if (!target.matches?.('summary,button')) return;
    const top = document.querySelector('.topbar')?.getBoundingClientRect().bottom || 0, rect = target.getBoundingClientRect();
    target.style.scrollMarginTop = Math.ceil(top + 12) + 'px'; target.style.scrollMarginBottom = '12px';
    if (rect.top < top + 4 || rect.bottom > innerHeight - 4) target.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  });
  return { reset: clear, getAccessToken: () => accessEpoch,
    rejectAccess: token => { if (token === accessEpoch) clear({ forbidden: true }); }, dispose: () => { sequence++; controller?.abort(); }, update(data, current) {
    const key = JSON.stringify([data?.identity?.preferenceScope, data?.savedResearch?.ownerScope, data?.priceAlerts?.accessRevision,
      data?.capabilities?.directShareComparison, data?.directShareComparisonContext, data?.preview, data?.clientProduct?.portfolios?.map(row => [row.id, row.preferenceKey]), current]);
    if (key === signature) return;
    signature = key; rejected = false; accessEpoch++;
    const scopes = data?.directShareComparisonContext?.accounts;
    const expectedContextKey = Array.isArray(scopes) ? scopes.find(row => row?.portfolioId === current?.scope?.portfolioIds?.[0])?.contextKey : null;
    const allowed = data?.capabilities?.directShareComparison === true && !data?.preview?.static && !data?.preview?.localReview
      && current?.evidence.sourceVerified && current.scope.kind === 'single-account' && typeof request === 'function'
      && typeof expectedContextKey === 'string' && /^[a-f0-9]{64}$/u.test(expectedContextKey);
    context = allowed && !rejected ? { current, query: { portfolioId: current.scope.portfolioIds[0], from: current.period.requestedFrom,
      to: current.period.requestedTo, expectedCurrentSnapshotId: current.calculationSnapshotId, expectedContextKey } } : null;
    clear();
  } };
}
