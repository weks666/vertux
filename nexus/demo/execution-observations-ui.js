const object = value => value && typeof value === 'object' && !Array.isArray(value);
const keys = (value, names) => object(value) && Object.keys(value).length === names.length && Object.keys(value).every(key => names.includes(key));
const iso = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const nano = value => typeof value === 'string' && /^(?:0|[1-9]\d{0,119})$/u.test(value);
function invalid() { throw new Error('Не удалось проверить сохранённые сведения об исполнениях.'); }
export const observationTimeKey = value => value.replace(/(?:\.(\d{1,9}))?Z$/u, (_match, fraction) => '.' + (fraction || '').padEnd(9, '0') + 'Z');
export function operationObservationDates(row) {
  return [row.operationAt, ...row.fills.map(fill => fill.occurredAt),
    ...(row.details?.cancelDateTime.state === 'present' ? [row.details.cancelDateTime.value] : [])];
}
const sourceTimestamp = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 19) === value.slice(0, 19);
function validateStatusFields(fields) {
  const names = ['quantity', 'quantityDone', 'quantityRest', 'cancelDateTime', 'cancelReason'];
  if (!keys(fields, names)) invalid();
  for (const name of names) {
    const field = fields[name];
    if (keys(field, ['state']) && ['absent', 'invalid'].includes(field.state)) continue;
    if (!keys(field, ['state', 'value']) || field.state !== 'present') invalid();
    if (name.startsWith('quantity')) {
      if (typeof field.value !== 'string' || !/^-?(?:0|[1-9]\d{0,18})$/u.test(field.value)
        || BigInt(field.value) < -9223372036854775808n || BigInt(field.value) > 9223372036854775807n) invalid();
    } else if (name === 'cancelDateTime') { if (!sourceTimestamp(field.value)) invalid(); }
    else if (typeof field.value !== 'string' || field.value.length > 2048 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(field.value)) invalid();
  }
}
export function validateExecutionObservations(data, query) {
  const statusHistory = data?.schema === 'execution-observations-v2';
  if (!keys(data, ['schema', 'portfolioId', 'instrumentUid', 'period', 'coverage', 'items']) || !['execution-observations-v1', 'execution-observations-v2'].includes(data.schema)
    || data.portfolioId !== query.portfolioId || data.instrumentUid !== query.instrumentUid || !keys(data.period, ['from', 'to'])
    || !iso(data.period.from) || !iso(data.period.to) || data.period.from !== query.from || data.period.to !== query.to
    || !Array.isArray(data.items) || data.items.length > 100) invalid();
  const c = data.coverage;
  if (!keys(c, ['kind', 'complete', 'correctionLineage', 'cancellationCoverage', 'knowledgeAt', 'order', 'replays'])
    || c.kind !== 'retained-local-observations' || c.complete !== false || c.correctionLineage !== 'unavailable'
    || c.cancellationCoverage !== (statusHistory ? 'retained-status-messages' : 'unavailable') || c.knowledgeAt !== 'unavailable' || c.order !== 'local-insertion' || c.replays !== 'coalesced') invalid();
  let count = 0, sourceRows = 0;
  data.items.forEach((row, index) => {
    const sourceStatus = statusHistory && row.recordKind === 'source-status';
    if (!keys(row, ['position', 'operationAt', 'firstReceivedAt', 'normalizedAt', 'clockRegressed', 'clockInconsistent', 'direction', 'reportedState', 'conflictingLocalFamily', 'fills', ...(statusHistory ? ['recordKind', 'details'] : [])])
      || row.position !== index + 1 || ![row.operationAt, row.firstReceivedAt].every(iso)
      || (sourceStatus ? row.normalizedAt !== null : !iso(row.normalizedAt))
      || !['clockRegressed', 'clockInconsistent', 'conflictingLocalFamily'].every(key => typeof row[key] === 'boolean')
      || !['buy', 'sell'].includes(row.direction) || !['executed', 'canceled', 'pending', 'unknown'].includes(row.reportedState)
      || !Array.isArray(row.fills) || (count += row.fills.length) > 1000) invalid();
    if (statusHistory) {
      if (!['source-status', 'financial-import'].includes(row.recordKind)) invalid();
      if (sourceStatus) { sourceRows++; if (row.reportedState === 'executed') invalid(); validateStatusFields(row.details); }
      else if (row.details !== null) invalid();
    }
    for (const fill of row.fills) {
      if (!keys(fill, ['occurredAt', 'quantityNanos', 'priceNanos', 'priceUnit', 'priceCurrency']) || !iso(fill.occurredAt)
        || !nano(fill.quantityNanos) || fill.quantityNanos === '0' || !nano(fill.priceNanos)
        || !['money', 'points', 'unknown'].includes(fill.priceUnit)
        || (fill.priceUnit === 'money' ? typeof fill.priceCurrency !== 'string' || !/^[A-Z]{3}$/u.test(fill.priceCurrency) : fill.priceCurrency !== null)) invalid();
    }
    const dates = operationObservationDates(row);
    if (row.clockInconsistent !== (row.normalizedAt !== null && row.normalizedAt < row.firstReceivedAt
      || dates.some(at => observationTimeKey(at) > observationTimeKey(row.firstReceivedAt)))) invalid();
    if (!dates.some(at => observationTimeKey(at) >= observationTimeKey(query.from) && observationTimeKey(at) <= observationTimeKey(query.to))) invalid();
  });
  if (statusHistory && !sourceRows) invalid();
  return data;
}

const node = (tag, text, className) => {
  const result = document.createElement(tag); if (text !== undefined) result.textContent = text;
  if (className) result.className = className; return result;
};
const displayTime = value => value.replace('T', ' ').replace('.000Z', ' UTC').replace('Z', ' UTC');
const decimal = value => { const padded = value.padStart(10, '0'), tail = padded.slice(-9).replace(/0+$/u, ''); return padded.slice(0, -9) + (tail ? ',' + tail : ''); };
const stateLabels = { executed: 'Исполнено полностью или частично', canceled: 'Отменено', pending: 'В обработке', unknown: 'Неизвестен' };
export function appendOperationStatusDetails(body, row) {
  if (!row.details) return;
  body.append(node('p', 'Это сообщение о статусе. Оно не отменяет другие исполнения. Неоднозначные сведения не позволяют подтвердить связанные расчёты.'));
  const list = node('dl'); list.dataset.operationStatusDetails = 'true';
  for (const [name, label] of [['quantity', 'Количество в сообщении'], ['quantityDone', 'Сообщено исполненным'],
    ['quantityRest', 'Остаток в сообщении'], ['cancelDateTime', 'Время отмены у источника'], ['cancelReason', 'Причина отмены у источника']]) {
    const field = row.details[name], pair = node('div');
    const value = field.state === 'absent' ? 'Не указано' : field.state === 'invalid' ? 'Непроверенное значение'
      : name === 'cancelDateTime' ? displayTime(field.value) : field.value === '' ? 'Пустая строка в сообщении' : field.value + (name.startsWith('quantity') ? ' ед.' : '');
    pair.append(node('dt', label), node('dd', value)); list.append(pair);
  }
  body.append(list);
  const quantities = ['quantity', 'quantityDone', 'quantityRest'].map(name => row.details[name].state === 'present' ? BigInt(row.details[name].value) : null);
  if (quantities.every(value => value !== null) && (quantities.some(value => value < 0n) || quantities[0] !== quantities[1] + quantities[2])) {
    body.append(node('p', 'Сообщённые количества расходятся: общее количество не равно исполненному плюс остатку.', 'observation-caption'));
  }
}
let nextId = 0;
export function createExecutionObservationsDisclosure({ portfolioId, instrumentUid, request, getRevision, isCurrent, canOpen, now = () => new Date() }) {
  const button = node('button', 'Сведения об исполнениях', 'button'); button.type = 'button';
  const region = node('section', undefined, 'execution-observations'); region.hidden = true;
  region.id = `execution-observations-${++nextId}`; button.setAttribute('aria-controls', region.id); button.setAttribute('aria-expanded', 'false');
  region.setAttribute('aria-label', 'Сохранённые сведения об исполнениях инструмента');
  let generation = 0, disposed = false, loading = false, controller = null, query = null, parentRevision;
  const valid = own => !disposed && own === generation && !region.hidden && isCurrent(parentRevision);
  function close() { generation++; loading = false; controller?.abort(); controller = null; region.hidden = true; region.replaceChildren(); region.setAttribute('aria-busy', 'false'); button.setAttribute('aria-expanded', 'false'); }
  function render(data) {
    region.replaceChildren();
    const method = node('details', undefined, 'observation-record observation-method');
    method.append(node('summary', 'Как читать записи и даты'),
      node('p', 'Совпадение инструмента и счёта не подтверждает выполнение этой идеи. Полнота периода и связи исправлений или отмен неизвестны.'),
      node('p', 'Новые синхронизации запрашивают все статусы. Прежние периоды могут содержать только исполненные операции. Одинаковые сохранённые сообщения объединяются; изменившийся идентификатор не доказывает новую сделку. Время получения не означает, что вы уже прочитали запись.', 'observation-caption'),
      node('p', 'Дата операции указана источником отдельно от дат исполнений и отмены. Получение и имеющаяся отметка обработки относятся к часам этого устройства. Числа из разных записей не суммируются.', 'observation-caption'));
    region.append(node('h4', 'Сведения по инструменту за 30 дней'),
      node('p', `${displayTime(query.from)} — ${displayTime(query.to)}. Отбор по дате операции, указанного исполнения или отмены.`, 'observation-caption'),
      node('p', 'Полнота истории и связь исправлений неизвестны. Записи не подтверждают выполнение идеи.'));
    if (!data.items.length) { region.append(node('p', 'В сохранённых данных за этот период записей не найдено. Это не доказывает, что сделок не было.'), method); return; }
    region.append(node('p', `Сохранённых записей: ${data.items.length} · новые сверху по порядку сохранения.`, 'observation-caption'));
    const list = node('div', undefined, 'observation-list'), ordered = [...data.items].reverse(); let shown = 0;
    const more = node('button', 'Показать предыдущие записи', 'button'); more.type = 'button';
    function append(focus = false) {
      let first;
      for (const row of ordered.slice(shown, shown + 5)) {
        const detail = node('details', undefined, 'observation-record');
        const summary = node('summary', `${row.direction === 'buy' ? 'Покупка' : 'Продажа'}${row.recordKind === 'source-status' ? ' · ' + stateLabels[row.reportedState] : ''} · получено ${displayTime(row.firstReceivedAt)}`);
        first ||= summary; detail.append(summary);
        const body = node('div', undefined, 'observation-body');
        body.append(node('p', `Статус в записи: ${stateLabels[row.reportedState]}`));
        const clocks = node('dl');
        for (const [label, at] of [['Дата операции у источника', row.operationAt], ['Эта запись получена локально', row.firstReceivedAt], ['Обработано локально', row.normalizedAt]]) {
          if (at !== null) { const pair = node('div'); pair.append(node('dt', label), node('dd', displayTime(at))); clocks.append(pair); }
        }
        body.append(clocks);
        appendOperationStatusDetails(body, row);
        if (row.clockRegressed || row.clockInconsistent) body.append(node('p', 'Локальные отметки времени расходятся. Порядок сохранения не заменён сортировкой по часам.', 'observation-warning'));
        if (row.conflictingLocalFamily) body.append(node('p', 'Есть различающиеся сведения с одинаковыми признаками. Их связь и актуальная версия не установлены.', 'observation-warning'));
        if (row.reportedState === 'canceled' && !row.details) body.append(node('p', 'Эта отметка не позволяет аннулировать исполнения из других записей.'));
        body.append(node('h5', 'Исполнения, указанные в этой записи'));
        if (!row.fills.length) body.append(node('p', 'Подробности исполнений отсутствуют.'));
        for (const fill of row.fills) {
          const unit = fill.priceUnit === 'points' ? 'п.' : fill.priceUnit === 'money' ? fill.priceCurrency : 'единицы цены неизвестны';
          body.append(node('p', `${displayTime(fill.occurredAt)} · ${decimal(fill.quantityNanos)} ед. × ${decimal(fill.priceNanos)} ${unit}`, 'observation-fill'));
        }
        detail.append(body); list.append(detail);
      }
      shown = Math.min(shown + 5, ordered.length); more.hidden = shown === ordered.length;
      if (focus && first) first.focus();
    }
    more.addEventListener('click', () => { if (valid(generation)) append(true); });
    region.append(list, more, method); append();
  }
  async function load(retry = null) {
    if (loading) return;
    if (!canOpen()) { close(); return; }
    loading = true;
    const own = ++generation; controller?.abort(); controller = new AbortController(); parentRevision = getRevision();
    if (!retry) region.replaceChildren(node('p', 'Читаю сохранённые сведения…'));
    // Native disabled drops keyboard focus in Chromium. Keep this control
    // connected/focusable; the loading guard prevents duplicate reads.
    else { retry.setAttribute('aria-disabled', 'true'); retry.textContent = 'Читаю…'; }
    region.setAttribute('aria-busy', 'true');
    try {
      const data = await request('/api/execution-observations?' + new URLSearchParams(query), { signal: controller.signal });
      if (!valid(own)) return;
      const restoreFocus = retry && document.activeElement === retry;
      render(validateExecutionObservations(data, query)); if (restoreFocus) button.focus();
    } catch (error) {
      if (!valid(own)) return;
      const restoreFocus = retry && document.activeElement === retry;
      region.replaceChildren(node('p', error.code === 'EXECUTION_OBSERVATIONS_LIMIT'
        ? 'Объём сохранённых данных превышает предел просмотра.' : 'Не удалось проверить сведения об исполнениях. Данные не показаны.'));
      const again = node('button', 'Повторить чтение', 'button'); again.type = 'button';
      again.addEventListener('click', () => { void load(again); }); region.append(again); if (restoreFocus) again.focus();
    } finally { if (valid(own)) { loading = false; region.setAttribute('aria-busy', 'false'); } }
  }
  button.addEventListener('click', () => {
    if (!region.hidden) { close(); return; } if (disposed || !canOpen()) return;
    const to = now(); query = { portfolioId, instrumentUid, from: new Date(to.getTime() - 30 * 86400000).toISOString(), to: to.toISOString() };
    region.hidden = false; button.setAttribute('aria-expanded', 'true'); void load();
  });
  return { button, region, close, dispose() { close(); disposed = true; } };
}
