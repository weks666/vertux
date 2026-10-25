/** A bounded, immutable view of already accepted data. This is not an access,
 * model-output, arithmetic, or source-truth validator. Native checks still own
 * those decisions; this module has no transport, persistence, or action API. */
export const CONTEXT_EVIDENCE_VERSION = 'context-evidence-v1';
const intents = Object.freeze({
  instrument: ['instrument.saved-facts', 'instrument.company-claims'],
  news: ['news.source-analysis'],
  portfolio: ['portfolio.result-components'],
  trading: ['trading.position-episodes', 'trading.group-review'],
  research: ['research.note-facts', 'research.saved-metric-screen'],
  terminal: ['terminal.indicator-method'],
});
const fail = () => { throw new TypeError('Context evidence unavailable'); };
const text = (value, max = 1200) => typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value);
const stamp = value => value === null || typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T|$)/u.test(value) && Number.isFinite(Date.parse(value));
const list = (value, max) => Array.isArray(value) && value.length <= max;
const shape = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };

function copyJson(value, depth = 0, budget = {nodes: 0}) {
  if (depth > 12 || ++budget.nodes > 16000) fail();
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') { if (!Number.isFinite(value)) fail(); return value; }
  if (typeof value === 'string') { if (value.length > 8000) fail(); return value; }
  if (!value || typeof value !== 'object') fail();
  const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
  if (!array && prototype !== Object.prototype && prototype !== null || array && value.length > 512) fail();
  const keys = Reflect.ownKeys(value);
  if (array && keys.length !== value.length + 1 || !array && keys.length > 64) fail();
  const result = array ? [] : Object.create(null);
  for (const key of keys) {
    if (array && key === 'length') continue;
    if (typeof key !== 'string' || array && !/^(0|[1-9]\d*)$/u.test(key)) fail();
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) fail();
    result[key] = copyJson(descriptor.value, depth + 1, budget);
  }
  return result;
}

export function createContextEvidence(input) {
  const data = copyJson(input);
  if (!shape(data, ['version', 'mode', 'intent', 'state', 'object', 'revision', 'dataMode', 'method', 'timezone', 'periods', 'clocks', 'sources', 'facts', 'limitations', 'freshness', 'evidenceLocation'])
    || !shape(data.object, ['key', 'label']) || !shape(data.method, ['kind', 'label'])
    || data.version !== CONTEXT_EVIDENCE_VERSION || !Object.hasOwn(intents, data.mode) || !intents[data.mode].includes(data.intent)
    || !['supported', 'limited', 'unsupported'].includes(data.state)
    || !text(data.object?.label, 600) || !text(data.object?.key, 600)
    || !(data.revision === null || text(data.revision, 1000))
    || !['synthetic', 'public', 'local', 'unknown'].includes(data.dataMode)
    || !['saved-source', 'validated-public-claims', 'local-calculation', 'user-note'].includes(data.method?.kind)
    || !text(data.method.label) || !text(data.freshness) || !text(data.evidenceLocation)
    || !text(data.timezone, 100) || !list(data.periods, 4) || !list(data.clocks, 8)
    || !list(data.sources, 48) || !list(data.facts, 256) || !list(data.limitations, 80)) fail();
  try { new Intl.DateTimeFormat('ru-RU', {timeZone: data.timezone}).format(); } catch { fail(); }
  for (const row of data.periods) {
    if (!shape(row, ['label', 'convention', 'from', 'to']) || !text(row.label, 180) || !text(row.convention) || !stamp(row.from) || !stamp(row.to)
      || row.from && row.to && Date.parse(row.from) > Date.parse(row.to)) fail();
  }
  for (const row of data.clocks) if (!shape(row, ['label', 'at']) || !text(row.label, 180) || !stamp(row.at)) fail();
  const sourceIds = new Set();
  for (const source of data.sources) {
    if (!shape(source, ['id', 'label', 'asOf', 'receivedAt']) || !text(source.id, 600) || sourceIds.has(source.id) || !text(source.label, 600)
      || !stamp(source.asOf) || !stamp(source.receivedAt)) fail();
    sourceIds.add(source.id);
  }
  const factIds = new Set();
  for (const fact of data.facts) {
    if (!shape(fact, ['id', 'label', 'value', 'unit', 'state', 'sourceRefs', 'period']) || !text(fact.id, 600) || factIds.has(fact.id) || !text(fact.label, 600) || !text(fact.unit, 100)
      || !(fact.period === null || text(fact.period, 200)) || !['known', 'unknown'].includes(fact.state)
      || !list(fact.sourceRefs, 48) || new Set(fact.sourceRefs).size !== fact.sourceRefs.length
      || fact.sourceRefs.some(id => !sourceIds.has(id))) fail();
    if (fact.state === 'unknown' ? fact.value !== null
      : !(typeof fact.value === 'number' && Number.isFinite(fact.value) || text(fact.value, 8000))) fail();
    factIds.add(fact.id);
  }
  if (data.limitations.some(value => !text(value, 4000))) fail();
  const known = data.facts.filter(fact => fact.state === 'known');
  // A projection may narrow support, never promote the source's state.
  if (!known.length) data.state = 'unsupported';
  else if (data.state === 'supported' && (data.limitations.length || known.length !== data.facts.length
    || known.some(fact => !fact.sourceRefs.length))) data.state = 'limited';
  return freeze(data);
}

const esc = value => String(value ?? '').replace(/[&<>"']/gu, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
const states = {supported: 'Достаточно для этого объяснения', limited: 'Есть ограничения', unsupported: 'Недостаточно оснований'};
const modes = {synthetic: 'Учебные данные', public: 'Публичные сведения', local: 'Локально сохранённые данные', unknown: 'Происхождение не подтверждено'};

export function renderContextEvidence(context, {open = false} = {}) {
  let data;
  try { data = createContextEvidence(context); } catch {
    return '<details class="context-evidence" data-context-evidence data-context-mode="unavailable"><summary>Контекст и основания</summary><p>Контекст этого блока не подтверждён. Проверьте исходные данные в текущем экране и откройте объяснение заново.</p></details>';
  }
  const date = value => value === null ? 'Не указано' : new Intl.DateTimeFormat('ru-RU', {
    timeZone: data.timezone, day: '2-digit', month: '2-digit', year: 'numeric',
    ...(!/^\d{4}-\d{2}-\d{2}$/u.test(value) ? {hour: '2-digit', minute: '2-digit', second: '2-digit'} : {}),
  }).format(new Date(value));
  const row = (label, value) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
  const known = data.facts.filter(fact => fact.state === 'known').length;
  const sources = data.sources.length
    ? '<ul class="context-evidence-sources">' + data.sources.map(source => '<li><strong>' + esc(source.label)
      + '</strong><span>Дата данных: ' + esc(date(source.asOf)) + ' · Получено: ' + esc(date(source.receivedAt)) + '</span></li>').join('') + '</ul>'
    : '<p>Источники этого блока не подтверждены.</p>';
  const limitations = data.limitations.length
    ? '<ul class="context-evidence-limits">' + data.limitations.map(value => '<li>' + esc(value) + '</li>').join('') + '</ul>' : '';
  const fields = row('Объект', data.object.label)
    + data.periods.map(period => row(period.label, (period.from || period.to ? date(period.from) + ' — ' + date(period.to) + '. ' : '') + period.convention)).join('')
    + row('Часовой пояс', data.timezone) + row('Данные', modes[data.dataMode]) + row('Как получено объяснение', data.method.label)
    + data.clocks.map(clock => row(clock.label, date(clock.at))).join('') + row('Актуальность', data.freshness);
  return `<details class="context-evidence" data-context-evidence data-context-mode="${data.mode}" data-context-state="${data.state}"${open ? ' open' : ''}>
    <summary>Контекст и основания</summary><div class="context-evidence-body"><p class="context-evidence-state">${states[data.state]}</p>
    <dl>${fields}</dl><p>${esc(data.evidenceLocation)}</p>
    <p class="context-evidence-note">В этом блоке учтено оснований: ${known}; с неизвестным значением: ${data.facts.length - known}. Это не оценка полноты всего источника.</p>
    ${sources}${limitations}</div></details>`;
}
