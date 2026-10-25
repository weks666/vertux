import { newsSourceUrl } from './news-source-context.js';
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const keys = (value, names) => object(value) && Object.keys(value).length === names.length && Object.keys(value).every(key => names.includes(key));
const iso = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const text = (value, max, nullable = false) => nullable && value === null || typeof value === 'string' && value.length <= max;
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/u.test(value);
function invalid() { throw new Error('История редакций не подтверждена.'); }
export function validateNewsContentHistory(data, newsId) {
  if (!keys(data, ['schema', 'newsId', 'generation', 'readAt', 'coverage', 'items']) || data.schema !== 'news-content-history-v1'
    || data.newsId !== newsId || !iso(data.readAt) || !Array.isArray(data.items) || data.items.length > 5
    || (data.items.length ? !uuid(data.generation) : data.generation !== null)) invalid();
  const c = data.coverage;
  if (!keys(c, ['semantics', 'complete', 'earlierContent', 'retentionDays', 'retainedLimit', 'clock', 'budgetMayEvict']) || c.semantics !== 'locally-saved-copies'
    || c.complete !== false || c.earlierContent !== 'unknown' || c.retentionDays !== 30 || c.retainedLimit !== 5 || c.clock !== 'local-device' || c.budgetMayEvict !== true) invalid();
  const cutoff = Date.parse(data.readAt) - 30 * 86400000; let sequence = 0;
  for (const row of data.items) {
    if (!keys(row, ['sequence', 'kind', 'recordedAt', 'sourceAt', 'clockRegressed', 'content']) || !Number.isSafeInteger(row.sequence) || row.sequence <= sequence
      || !['received', 'legacy-observation', 'unavailable'].includes(row.kind) || !iso(row.recordedAt) || !iso(row.sourceAt)
      || Math.min(Date.parse(row.recordedAt), Date.parse(row.sourceAt)) < cutoff || typeof row.clockRegressed !== 'boolean') invalid();
    sequence = row.sequence; const value = row.content;
    if (row.kind === 'unavailable') { if (value !== null) invalid(); continue; }
    if (!keys(value, ['id', 'title', 'summary', 'source', 'url', 'at', 'priority', 'instruments']) || value.id !== newsId || !value.title
      || !text(value.title, 500) || !text(value.summary, 6000) || !text(value.source, 160) || !text(value.url, 2048, true)
      || value.at !== row.sourceAt || typeof value.priority !== 'boolean' || !Array.isArray(value.instruments) || value.instruments.length > 10000
      || value.instruments.some(item => !keys(item, ['instrumentUid', 'ticker']) || !item.instrumentUid || !text(item.instrumentUid, 128) || !text(item.ticker, 64, true))
      || new TextEncoder().encode(JSON.stringify(value)).length > 32768) invalid();
  }
  return data;
}
const node = (tag, value, className) => { const result = document.createElement(tag); if (value !== undefined) result.textContent = value; if (className) result.className = className; return result; };
const time = value => value.replace('T', ' ').replace('.000Z', ' UTC').replace('Z', ' UTC');
let nextId = 0;
export function createNewsContentHistoryDisclosure({ newsId, request, isCurrent }) {
  const button = node('button', 'Сохранённые редакции', 'button secondary news-history-toggle'); button.type = 'button';
  const region = node('section', undefined, 'news-content-history'); region.id = `news-content-history-${++nextId}`; region.hidden = true;
  region.setAttribute('aria-label', 'Сохранённые редакции выбранной новости'); button.setAttribute('aria-controls', region.id); button.setAttribute('aria-expanded', 'false');
  let generation = 0, disposed = false, loading = false, controller;
  const current = own => !disposed && own === generation && !region.hidden && isCurrent();
  function close() { generation++; controller?.abort(); loading = false; region.replaceChildren(); region.hidden = true; region.setAttribute('aria-busy', 'false'); button.setAttribute('aria-expanded', 'false'); }
  function render(data) {
    region.replaceChildren(node('h4', 'Сохранённое содержание'), node('p', 'До 5 локальных копий за 30 дней. Более раннее содержание может отсутствовать. Получение не подтверждает прочтение новости.', 'news-history-caption'));
    if (!data.items.length) { region.append(node('p', 'Редакции ещё не сохранялись или уже удалены по пределам хранения. Старое содержание неизвестно.')); return; }
    for (const row of [...data.items].reverse()) {
      const detail = node('details', undefined, 'news-content-version'), summary = node('summary', `Копия ${row.sequence} · записана ${time(row.recordedAt)}`);
      detail.append(summary); const body = node('div', undefined, 'news-content-version-body');
      body.append(node('p', `Время сообщения поставщика: ${time(row.sourceAt)}. Это не подтверждённая дата первичной публикации.`, 'news-history-caption'));
      if (row.kind === 'legacy-observation') body.append(node('p', 'Прежний сохранённый текст впервые зафиксирован в истории в этот момент. Время его прежнего получения неизвестно.'));
      if (row.clockRegressed || row.recordedAt > data.readAt) body.append(node('p', 'Локальные часы расходятся. Порядок копий определён сохранением, даты не переписаны.'));
      if (row.kind === 'unavailable') body.append(node('p', 'Эта редакция превышает предел размера; содержание не сохранено.'));
      else {
        body.append(node('h5', row.content.title), node('p', row.content.summary || 'Текст сообщения отсутствует.', 'news-history-text'), node('p', `Указанный источник: ${row.content.source || 'неизвестен'}.`, 'news-history-caption'));
        const href = newsSourceUrl(row.content.url); if (href) { const link = node('a', 'Открыть указанный источник ↗'); link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer'; body.append(link); }
        const labels = row.content.instruments.slice(0, 6).map(item => item.ticker || 'Название метки неизвестно');
        if (labels.length) body.append(node('p', 'Метки в этой копии: ' + labels.join(', ') + (row.content.instruments.length > 6 ? ` · ещё ${row.content.instruments.length - 6}` : ''), 'news-history-caption'));
      }
      detail.append(body); region.append(detail);
    }
    region.append(node('p', 'Копии показаны по порядку сохранения на этом устройстве. Это ограниченная локальная история, а не полный архив публикации.', 'news-history-caption'));
  }
  async function load(retry = null) {
    if (loading || disposed || !isCurrent()) return; loading = true; const own = ++generation; controller?.abort(); controller = new AbortController();
    if (retry) { retry.setAttribute('aria-disabled', 'true'); retry.textContent = 'Читаю…'; } else region.replaceChildren(node('p', 'Читаю сохранённые редакции…'));
    region.setAttribute('aria-busy', 'true');
    try {
      const data = await request('/api/market/news/history?' + new URLSearchParams({ newsId }), { signal: controller.signal }); if (!current(own)) return;
      const restore = retry && document.activeElement === retry; render(validateNewsContentHistory(data, newsId)); if (restore) button.focus();
    } catch {
      if (!current(own)) return; const restore = retry && document.activeElement === retry;
      region.replaceChildren(node('p', 'Не удалось проверить сохранённые редакции. Данные не показаны.'));
      const again = node('button', 'Повторить чтение редакций', 'button secondary'); again.type = 'button'; again.addEventListener('click', () => { void load(again); }); region.append(again); if (restore) again.focus();
    } finally { if (current(own)) { loading = false; region.setAttribute('aria-busy', 'false'); } }
  }
  button.addEventListener('click', () => { if (!region.hidden) close(); else if (!disposed && isCurrent()) { region.hidden = false; button.setAttribute('aria-expanded', 'true'); void load(); } });
  return { button, region, close, dispose() { close(); disposed = true; } };
}
