import { financialMetric } from './number-format.js';
import { fundamentalPeriod } from './financial-metric.js';
import { companyComparisonMarkup, createCompanyComparisonUI } from './company-comparison-ui.js';
const endpoint = '/api/ai/company-facts-history';
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const stamp = value => new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value)) + ' МСК';
const day = value => value ? new Intl.DateTimeFormat('ru-RU', { timeZone: 'UTC', dateStyle: 'medium' }).format(new Date(value)) : 'не указан';
const time = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const string = (value, max = 1600) => typeof value === 'string' && value.length <= max;
function valid(data, uid, selection) {
  const meta = row => row && Number.isInteger(row.revision) && row.revision > 0 && row.revision <= 128 && time(row.receivedAt)
    && /^[a-f0-9]{64}$/.test(row.sourceDigest) && row.source?.url === 'https://developer.tbank.ru/invest/api/instruments-service-get-asset-fundamentals'
    && (row.fiscalPeriod?.from === null || time(row.fiscalPeriod?.from)) && (row.fiscalPeriod?.to === null || time(row.fiscalPeriod?.to));
  const value = row => row === null || row && string(row.unit, 32) && string(row.period, 80) && ['available', 'missing', 'not_applicable'].includes(row.status)
    && (row.status === 'available' ? typeof row.value === 'string' && row.value.length <= 100 && /^-?\d+(?:\.\d+)?$/.test(row.value) : row.value === null);
  if (data?.contractVersion !== 'company-fundamental-history-v1' || data.intent !== 'company.facts-history' || data.instrument?.instrumentUid !== uid
    || data.readMode !== 'saved-only' || data.llmUsed !== false || data.publicationTimeKnown !== false || data.growthCalculated !== false
    || !['empty', 'first', 'comparison'].includes(data.state) || !Array.isArray(data.versions) || data.versions.length > 128 || !data.versions.every(meta)
    || new Set(data.versions.map(row => row.revision)).size !== data.versions.length || !Array.isArray(data.fields) || data.fields.length > 31
    || !data.fields.every(row => string(row.key, 80) && string(row.label, 256) && value(row.before) && value(row.after) && typeof row.changed === 'boolean')
    || new Set(data.fields.map(row => row.key)).size !== data.fields.length || typeof data.fiscalBasisChanged !== 'boolean' || typeof data.currencyChanged !== 'boolean') return false;
  if (data.state === 'empty') return !data.versions.length && !data.before && !data.after && !data.fields.length && data.changedCount === null && !selection;
  if (!meta(data.after) || !data.versions.some(row => row.revision === data.after.revision && row.sourceDigest === data.after.sourceDigest)) return false;
  if (data.state === 'first') return data.versions.length === 1 && !data.before && data.changedCount === null && !selection;
  return meta(data.before) && data.before.revision < data.after.revision && data.versions.some(row => row.revision === data.before.revision && row.sourceDigest === data.before.sourceDigest)
    && data.changedCount === data.fields.filter(row => row.changed).length
    && (!selection || data.before.revision === selection.beforeRevision && data.after.revision === selection.afterRevision);
}
const metricValue = row => row === null ? 'В сводке отсутствует' : row.status === 'not_applicable' ? 'Неприменимо' : financialMetric(row, { mode: 'exact' });
const fieldsMarkup = rows => rows.map(row => `<div class="fundamental-history-row" data-fh-metric="${esc(row.key)}"><h5>${esc(row.label)}${row.changed ? '<small>Значение или основание изменилось</small>' : ''}</h5><dl>${[['Раньше', row.before], ['Позже', row.after]].map(([label, value]) => `<div><dt>${label}</dt><dd>${esc(metricValue(value))}</dd>${value ? `<small>${esc(fundamentalPeriod(value.period))}${value.calculationVersion ? ' · расчёт по сводке' : ''}</small>` : ''}</div>`).join('')}</dl></div>`).join('');
const sourceMarkup = (row, label) => row ? `<div><h5>${label} · сводка №${row.revision}</h5><p>Впервые получена эта версия: ${esc(stamp(row.receivedAt))}.</p><p>Валюта сводки: ${esc(row.reportedCurrency || 'не указана')}. Фискальные даты источника: ${esc(day(row.fiscalPeriod.from))} — ${esc(day(row.fiscalPeriod.to))}.</p></div>` : '';

export function createFundamentalHistoryUI({ host, request, onFactsRefreshed = () => {} }) {
  let key = null, uid = null, allowed = false, canRefresh = false, generation = 0, serial = 0, busy = false, data = null, error = '';
  host.hidden = true; host.classList.add('fundamental-history');
  host.innerHTML = '<details><summary>История сводок компании</summary><p class="fundamental-history-note">Здесь сохраняются изменившиеся сводки после обновления источника. Даты получения отделены от дат отчётности; история публикаций эмитента источником не предоставлена.</p><div class="fundamental-history-actions"><button type="button" data-fh="read">Перечитать историю</button><button type="button" data-fh="refresh">Обновить сводку у брокера</button></div><p data-fh="status" role="status" aria-live="polite"></p><div class="fundamental-history-selectors" hidden><label>Раньше<select data-fh="before" aria-label="Более ранняя сводка"></select></label><label>Позже<select data-fh="after" aria-label="Более поздняя сводка"></select></label></div><div data-fh="result"></div></details>' + companyComparisonMarkup;
  const details = host.querySelector('details'), get = name => host.querySelector('[data-fh="' + name + '"]');
  const selectors = host.querySelector('.fundamental-history-selectors');
  const comparison = createCompanyComparisonUI({ host, request, onFactsRefreshed });
  function controls() {
    for (const name of ['read', 'before', 'after']) get(name).disabled = busy;
    get('refresh').disabled = busy || !canRefresh;
    get('status').textContent = error || (busy ? 'Читаем сведения…' : !canRefresh ? 'Обновление источника доступно при подключении локального брокера.' : '');
  }
  function render(selection = null) {
    selectors.hidden = !data || data.versions.length < 2;
    if (data?.versions.length >= 2) {
      const options = data.versions.map(row => `<option value="${row.revision}">Сводка №${row.revision} · ${esc(stamp(row.receivedAt))}</option>`).join('');
      for (const name of ['before', 'after']) { if (get(name).innerHTML !== options) get(name).innerHTML = options; get(name).value = String(selection?.[name + 'Revision'] ?? data[name].revision); }
    }
    const target = get('result');
    if (!data) target.innerHTML = busy ? '<p>Загружаем сохранённую историю…</p>' : '';
    else if (data.state === 'empty') target.innerHTML = '<p>Сохранённых версий пока нет. История начнётся с первого обновления сводки у брокера. Прежний одиночный снимок в историю не переносится.</p>';
    else {
      const changed = data.fields.filter(row => row.changed), featured = (data.state === 'first' ? data.fields.filter(row => row.after?.status === 'available') : changed).slice(0, 4);
      const statement = data.state === 'first' ? 'Сохранена первая версия. Для сравнения нужна следующая изменившаяся сводка.'
        : data.changedCount ? 'Изменилось значений или их оснований: ' + data.changedCount + '.' : 'Значения выбранных сводок совпадают.';
      target.innerHTML = `<p class="fundamental-history-summary">${esc(statement)} Сохранённых версий: ${data.versions.length}.</p><p class="fundamental-history-note">Сравниваются полученные значения. Для оценки роста нужны сопоставимые отчётные периоды каждого показателя.</p>${data.fiscalBasisChanged || data.currencyChanged ? `<p class="fundamental-history-note">${data.fiscalBasisChanged ? 'Фискальные даты в сводках различаются. ' : ''}${data.currencyChanged ? 'Валюта сводок изменилась.' : ''}</p>` : ''}<div class="fundamental-history-sources">${sourceMarkup(data.before, 'Раньше')}${sourceMarkup(data.after, 'Позже')}</div>${fieldsMarkup(featured)}<details class="fundamental-history-all"><summary>Все показатели (${data.fields.length})</summary>${fieldsMarkup(data.fields)}</details><p><a href="${esc(data.after.source.url)}" target="_blank" rel="noopener noreferrer">Т‑Инвестиции · источник сводки</a></p>`;
    }
    controls();
  }
  async function read({ refresh = false, selection = null } = {}) {
    if (!allowed || busy || !details.open || refresh && !canRefresh) return;
    const ticket = ++serial, cycle = generation, instrumentUid = uid;
    const focusTarget = host.contains(document.activeElement) ? document.activeElement : null;
    const current = () => allowed && details.open && ticket === serial && cycle === generation && instrumentUid === uid && host.isConnected;
    busy = true; error = ''; render(selection);
    try {
      if (refresh) {
        const result = await request('/api/ai/company-facts-refresh', { method: 'POST', body: JSON.stringify({ instrumentUid }) });
        if (!current()) return;
        if (result?.instrument?.instrumentUid !== instrumentUid || result.readMode !== 'explicit-refresh' || result.llmUsed !== false) throw Error('Не удалось подтвердить обновлённую сводку. Перечитайте историю.');
        onFactsRefreshed(instrumentUid);
        if (!current()) return;
      }
      const result = await request(endpoint + '?' + new URLSearchParams({ instrumentUid, ...(selection || {}) }));
      if (!current()) return;
      if (!valid(result, instrumentUid, selection)) throw Error('История не соответствует выбранным сводкам. Перечитайте историю.');
      data = result;
    } catch (reason) { if (current()) error = reason?.code === 'FUNDAMENTAL_HISTORY_LIMIT' ? 'История показателей заполнена. Прежние сводки сохранены; новая версия не записана.' : reason?.code === 'FUNDAMENTAL_HISTORY_INVALID' ? 'Сохранённую историю не удалось проверить. Требуется проверка локального хранилища; обновление источника не исправляет историю.' : reason?.code === 'FUNDAMENTAL_HISTORY_MAPPING_REQUIRED' ? 'Сначала обновите сводку у брокера: сведения о компании ещё не загружены.' : refresh ? 'Не удалось обновить сводку. Прежние данные сохранены; повторите обновление.' : 'Не удалось прочитать историю. Повторите чтение.'; }
    finally { if (current()) {
      busy = false; render();
      if (document.activeElement === document.body && focusTarget?.isConnected && !focusTarget.disabled) focusTarget.focus({ preventScroll: true });
    } }
  }
  details.addEventListener('toggle', () => {
    if (details.open && allowed) void read();
    else { serial++; busy = false; controls(); }
  });
  get('read').addEventListener('click', () => void read());
  get('refresh').addEventListener('click', () => void read({ refresh: true }));
  for (const name of ['before', 'after']) get(name).addEventListener('change', () => {
    const beforeRevision = Number(get('before').value), afterRevision = Number(get('after').value);
    if (beforeRevision >= afterRevision) { error = 'Выберите две сводки в порядке их получения.'; controls(); return; }
    void read({ selection: { beforeRevision, afterRevision } });
  });
  host.addEventListener('keydown', event => { if (event.key === 'Escape' && details.open && details.contains(event.target)) { event.preventDefault(); event.stopPropagation(); details.open = false; serial++; busy = false; host.querySelector('summary').focus(); } });
  return { update({ meta, active, accessKey, permitted, refreshPermitted }) {
    const next = JSON.stringify([accessKey, meta.instrumentUid, meta.assetUid, meta.assetType, active, permitted, refreshPermitted]);
    if (key !== next) { generation++; serial++; key = next; busy = false; data = null; error = ''; details.open = false; get('result').replaceChildren(); selectors.hidden = true; }
    uid = meta.instrumentUid; allowed = active && permitted && meta.assetType === 'share'; canRefresh = allowed && refreshPermitted; host.hidden = !allowed; controls(); comparison.update({ key, instrumentUid: uid, permitted: allowed, refreshPermitted });
  } };
}
