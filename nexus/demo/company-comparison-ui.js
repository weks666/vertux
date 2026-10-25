import { validCompanyComparison } from './company-comparison-contract.js';
import { financialMetric } from './number-format.js';
import { fundamentalPeriod } from './financial-metric.js';
const endpoint = '/api/ai/company-facts-comparison';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const name = row => [row.ticker, row.name].filter(Boolean).join(' · ') || 'Компания без названия';
const date = value => value ? new Intl.DateTimeFormat('ru-RU', { timeZone: 'UTC', dateStyle: 'medium' }).format(new Date(value)) : 'не указана';
const stamp = value => new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value)) + ' МСК';
const issues = { missing_values: 'Есть отсутствующие или неприменимые значения', unknown_units: 'Масштаб значения не раскрыт', different_units: 'Единицы или валюты различаются',
  unknown_periods: 'Период показателя не раскрыт', different_periods: 'Периоды показателей различаются', different_methods: 'Расчётные версии различаются',
  missing_fiscal_dates: 'Фискальные даты раскрыты не полностью', different_fiscal_dates: 'Фискальные даты сводок различаются' };
export const companyComparisonMarkup = '<details class="company-comparison" data-fc="details"><summary data-fc="summary">Сравнить компании</summary><p class="fundamental-history-note">До четырёх компаний из сохранённых инструментов. Группу для сравнения вы выбираете сами.</p><div class="company-comparison-picker"><label>Добавить компанию<select data-fc="choice"><option value="">Выберите компанию</option></select></label><button type="button" data-fc="add">Добавить</button><button type="button" data-fc="read">Перечитать сводки</button></div><p data-fc="status" role="status" aria-live="polite"></p><div data-fc="selection"></div><div data-fc="result"></div></details>';

export function createCompanyComparisonUI({ host, request, onFactsRefreshed = () => {} }) {
  const get = key => host.querySelector('[data-fc="' + key + '"]'), details = get('details');
  let contextKey = null, uid = null, allowed = false, canRefresh = false, serial = 0, busy = false, peers = [], data = null, candidates = [], error = '';
  const selection = () => [uid, ...peers];
  const available = () => candidates.filter(row => !selection().includes(row.instrumentUid)
    && !(row.assetUid && data?.columns.some(column => column.instrument.assetUid === row.assetUid)));
  function controls() {
    get('read').disabled = !allowed || busy;
    get('choice').disabled = !allowed || busy || peers.length >= 3;
    get('add').disabled = !allowed || busy || peers.length >= 3 || !get('choice').value;
    get('status').textContent = error || (busy ? 'Читаем выбранные сводки…' : data?.candidatesLimited ? 'В списке первые 200 сохранённых инструментов.' : '');
  }
  function render() {
    const chosen = get('choice').value;
    get('choice').innerHTML = '<option value="">Выберите компанию</option>' + available().map(row => `<option value="${esc(row.instrumentUid)}">${esc(name(row))}</option>`).join('');
    get('choice').value = available().some(row => row.instrumentUid === chosen) ? chosen : '';
    get('selection').innerHTML = peers.map(peer => `<button type="button" data-fc-remove="${esc(peer)}"${busy ? ' disabled' : ''}>Убрать: ${esc(name(data?.columns.find(row => row.instrument.instrumentUid === peer)?.instrument || candidates.find(row => row.instrumentUid === peer) || {}))}</button>`).join('');
    if (!data) { get('result').replaceChildren(); controls(); return; }
    const columns = data.columns, count = columns.length;
    const fields = rows => rows.map(row => `<section class="company-comparison-metric" data-fc-metric="${esc(row.key)}"><h5>${esc(row.label)}</h5><p class="fundamental-history-note">${esc(row.basisIssues.length ? row.basisIssues.map(code => issues[code]).join('. ') + '.' : 'Указанные единицы, периоды и фискальные даты сводок совпадают.')}</p><dl style="--comparison-columns:${count}">${row.cells.map((cell, index) => `<div><dt>${esc(name(columns[index].instrument))}</dt><dd>${esc(cell === null ? 'В сводке отсутствует' : cell.status === 'not_applicable' ? 'Неприменимо' : financialMetric(cell, { mode: 'exact' }))}</dd>${cell ? `<small>${esc(fundamentalPeriod(cell.period))}${cell.calculationVersion ? ' · расчёт по сводке' : ''}</small>` : ''}</div>`).join('')}</dl></section>`).join('');
    const featured = data.fields.filter(row => ['revenueTtm', 'netIncomeTtm', 'freeCashFlowTtm', 'totalDebtMrq', 'peRatioTtm', 'computedNetMarginTtm'].includes(row.key));
    get('result').innerHTML = `<p class="fundamental-history-summary">Выбрано компаний: ${count}. ${count === 1 ? 'Добавьте компанию для сравнения.' : 'Показаны последние сохранённые версии.'}</p><p class="fundamental-history-note">Даты отдельных показателей и публикаций не раскрыты. Значения показаны в исходных единицах.</p><div class="company-comparison-sources" style="--comparison-columns:${count}">${columns.map(column => `<section><h5>${esc(name(column.instrument))}</h5>${column.summary ? `<details><summary>Сводка №${column.summary.revision} · основание</summary><p>Впервые сохранена: ${esc(stamp(column.summary.receivedAt))}.</p><p>Валюта отчётности: ${esc(column.summary.reportedCurrency || 'не указана')}. Фискальные даты: ${esc(date(column.summary.fiscalPeriod.from))} — ${esc(date(column.summary.fiscalPeriod.to))}.</p><p><a href="${esc(column.summary.source.url)}" target="_blank" rel="noopener noreferrer">Источник сводки</a></p></details>` : `<p>${column.state === 'mapping-required' ? 'Сведения о компании ещё не загружены.' : 'Сохранённых версий пока нет.'}</p>`}<button type="button" data-fc-refresh="${esc(column.instrument.instrumentUid)}"${busy || !canRefresh ? ' disabled' : ''}>Обновить сводку: ${esc(column.instrument.ticker || column.instrument.name || 'компания')}</button></section>`).join('')}</div><details class="company-comparison-method"><summary>Как читать сравнение</summary><p class="fundamental-history-note">Принадлежность к одной отрасли, сопоставимость бизнеса и отчётности нужно проверить. Совпадение подписей не подтверждает одинаковые даты отдельных показателей или стандарты учёта. Рейтинг, медиана и перевод в общую валюту не рассчитываются. Время первой записи версии не означает время последнего подтверждения источником. Обновление выполняется только по кнопке.</p><p class="fundamental-history-note">Сравнение прочитано: ${esc(stamp(data.readAt))}.</p></details>${fields(featured)}${data.fields.length ? `<details><summary>Все показатели (${data.fields.length})</summary>${fields(data.fields)}</details>` : ''}`;
    controls();
  }
  async function read({ refreshUid = null } = {}) {
    if (!allowed || busy || !details.open || refreshUid && (!canRefresh || !selection().includes(refreshUid))) return;
    const ticket = ++serial, context = contextKey, selected = selection(), focused = host.contains(document.activeElement) ? document.activeElement : null;
    const current = () => allowed && details.open && host.isConnected && ticket === serial && context === contextKey;
    busy = true; error = ''; data = null; render();
    try {
      if (refreshUid) {
        const refreshed = await request('/api/ai/company-facts-refresh', { method: 'POST', body: JSON.stringify({ instrumentUid: refreshUid }) });
        if (!current()) return;
        if (refreshed?.instrument?.instrumentUid !== refreshUid || refreshed.readMode !== 'explicit-refresh' || refreshed.llmUsed !== false) throw Error('invalid');
        onFactsRefreshed(refreshUid);
        if (!current()) return;
      }
      const params = new URLSearchParams({ instrumentUid: selected[0] });
      for (const peer of selected.slice(1)) params.append('peerUid', peer);
      const value = await request(endpoint + '?' + params);
      if (!current()) return;
      if (!validCompanyComparison(value, selected)) throw Error('invalid');
      data = value; candidates = value.candidates;
    } catch (reason) {
      if (current()) error = reason?.code === 'FUNDAMENTAL_HISTORY_INVALID' || reason?.code === 'COMPANY_COMPARISON_INVALID'
        ? 'Сохранённые данные не прошли проверку. Требуется проверка локального хранилища.'
        : refreshUid ? 'Не удалось обновить сводку. Прежние версии сохранены; перечитайте их.' : 'Не удалось прочитать выбранные сводки. Перечитайте их или уберите компанию.';
    } finally {
      if (current()) {
        busy = false; render();
        if (document.activeElement === document.body) {
          if (focused?.isConnected && !focused.disabled) focused.focus({ preventScroll: true });
          else {
            const refreshedControl = refreshUid ? host.querySelector('[data-fc-refresh="' + CSS.escape(refreshUid) + '"]') : null;
            (refreshedControl || get('read')).focus({ preventScroll: true });
          }
        }
      }
    }
  }
  details.addEventListener('toggle', () => { if (details.open && allowed) void read(); else { serial++; busy = false; controls(); } });
  get('choice').addEventListener('change', controls);
  get('add').addEventListener('click', () => {
    const selected = get('choice').value;
    if (!allowed || busy || peers.length >= 3 || !available().some(row => row.instrumentUid === selected)) return;
    peers.push(selected); void read();
  });
  get('read').addEventListener('click', () => void read());
  host.addEventListener('click', event => {
    const remove = event.target.closest('[data-fc-remove]'), refresh = event.target.closest('[data-fc-refresh]');
    if (remove && allowed && !busy && peers.includes(remove.dataset.fcRemove)) { peers = peers.filter(peer => peer !== remove.dataset.fcRemove); void read(); get('read').focus({ preventScroll: true }); }
    if (refresh) void read({ refreshUid: refresh.dataset.fcRefresh });
  });
  host.addEventListener('keydown', event => {
    if (event.key === 'Escape' && details.open && details.contains(event.target)) { event.preventDefault(); event.stopPropagation(); details.open = false; serial++; busy = false; controls(); get('summary').focus(); }
  });
  return { update({ key, instrumentUid, permitted, refreshPermitted }) {
    if (contextKey !== key) { contextKey = key; serial++; peers = []; data = null; candidates = []; error = ''; busy = false; details.open = false; }
    uid = instrumentUid; allowed = permitted; canRefresh = allowed && refreshPermitted; details.hidden = !allowed; render();
  } };
}
