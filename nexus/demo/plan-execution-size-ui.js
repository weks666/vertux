import { comparePlanExecutionSizes } from './plan-execution-size.js';
import { decimalNanos } from './number-format.js';

const reasons = {
  'unsupported-scenario': 'Сохранённый расчёт относится к фьючерсу. В связях сейчас проверяются только исполнения обычных акций; их количества несопоставимы.',
  'incomplete-account-scope': 'Часть счетов недоступна. Сумма по неполному списку связей не рассчитана.',
  'changed-source': 'Источник хотя бы одной активной связи изменился или недоступен. Обновите связи и проверьте их перед сравнением.',
  'no-active-links': 'Все связи этой версии отозваны. Для сравнения нужна хотя бы одна активная связь нужного направления.',
  'no-matching-direction': 'Активные связи имеют другое направление. Для сравнения нужна хотя бы одна связь направления этой версии.'
};
const quantity = (value, signed = false) => value === null ? 'Недоступно'
  : (signed && BigInt(value) > 0n ? '+' : '') + decimalNanos(value, { digits: 9 }) + ' ед.';

/** A read-only view of the already fetched links, with direct evidence jumps. */
export function createPlanExecutionSizeDisclosure(data, options, { openLink, labelInstrument, review = false, versions = [], selectedSequence, onSelect = () => {} }) {
  if (review) return createPlanExecutionSizeReview(data, options, { labelInstrument, versions, selectedSequence, onSelect });
  const groups = comparePlanExecutionSizes(data, options);
  if (!groups.length) return null;
  const node = (tag, text, className) => { const element = document.createElement(tag); if (text !== undefined) element.textContent = text; if (className) element.className = className; return element; };
  const root = node('details', undefined, 'plan-link-size'); root.append(node('summary', 'Сравнить количество с расчётом'));
  root.append(node('p', 'Только выбранные вами связи. Полнота сделки и исполнение плана не подтверждены.'));
  const label = node('label', 'Версия с сохранённым расчётом'), select = node('select'); select.dataset.planSizeVersion = '';
  for (const group of groups) { const option = node('option', `Версия ${group.sequence} · ${group.plan.value.action === 'buy' ? 'Покупка' : 'Продажа'}`); option.value = String(group.sequence); select.append(option); }
  select.value = String(groups[0].sequence); label.append(select);
  const view = node('div'); view.dataset.planSizeResult = ''; view.setAttribute('aria-live', 'polite'); root.append(label, view);
  function render() {
    const group = groups.find(row => row.sequence === Number(select.value)); view.replaceChildren(); if (!group) return;
    view.dataset.state = group.state;
    view.append(node('p', `Версия ${group.sequence} · ${labelInstrument(group.plan.value)}`));
    const list = node('dl', undefined, 'plan-link-size-metrics');
    for (const [key, title, value] of [
      ['planned', 'В сохранённом расчёте', quantity(group.plannedQuantityNanos)],
      ['linked', group.plan.value.action === 'buy' ? 'В связанных покупках' : 'В связанных продажах', quantity(group.linkedQuantityNanos)],
      ['difference', 'Разница количества', quantity(group.differenceQuantityNanos, true)]
    ]) { const pair = node('div'), result = node('dd', value); result.dataset.planSizeMetric = key; pair.append(node('dt', title), result); list.append(pair); }
    view.append(list);
    if (group.state === 'compared') view.append(node('p', `Учтено связей: ${group.matchingLinks}.`));
    else for (const reason of group.reasons) view.append(node('p', reasons[reason]));
    if (group.withdrawnLinks || group.oppositeDirectionLinks) view.append(node('p', `Отозванных связей: ${group.withdrawnLinks}; активных другого направления: ${group.oppositeDirectionLinks}. Они не входят в сумму.`));
    if (!group.retained) view.append(node('p', 'Версия уже отсутствует в последних 50 правках. Сравнение использует её неизменную копию в связях.'));
    if (group.evidence.length) {
      const evidence = node('details', undefined, 'plan-link-size-evidence'); evidence.append(node('summary', 'Какие исполнения учтены'));
      for (const row of group.evidence) {
        const button = node('button', `Открыть связь ${row.sequence} · ${quantity(row.execution.quantityNanos)}`, 'button'); button.type = 'button';
        button.dataset.planSizeLink = row.id; button.addEventListener('click', () => openLink(row.id)); evidence.append(button);
      }
      view.append(evidence);
    }
    const method = node('details', undefined, 'plan-link-size-method'); method.append(node('summary', 'Как считается сравнение'),
      node('p', 'Количество рассчитано по вашим параметрам. Тип инструмента и лот этого сценария не подтверждены брокером.'),
      node('p', 'Разница = количество в связанных исполнениях − количество в расчёте. Ноль означает равенство только этих двух количеств.'),
      node('p', 'Учтены активные связи этой версии с тем же направлением и неизменным источником. Количество всего поручения и его остаток не прибавляются к отдельным исполнениям. Покупки и продажи не сворачиваются в текущую позицию.'),
      node('p', 'Денежный результат, комиссии, фактический риск, проскальзывание и R не рассчитываются. Дата сохранения не доказывает, что план был задан заранее.'));
    view.append(method);
  }
  select.addEventListener('change', render); render(); return root;
}

function createPlanExecutionSizeReview(data, options, { labelInstrument, versions, selectedSequence, onSelect }) {
  const groups = comparePlanExecutionSizes(data, options);
  const retained = new Map(versions.map(row => [row.sequence, row]));
  const available = new Map(retained);
  // A linked copy remains the basis even when the current plan was edited.
  for (const row of data.items) available.set(row.plan.sequence, row.plan);
  const ordered = [...available.values()].sort((a, b) => b.sequence - a.sequence);
  const node = (tag, text, className) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (className) e.className = className; return e; };
  const root = node('section', undefined, 'plan-link-size plan-link-size-review');
  root.append(node('h5', 'План и связанные исполнения'));
  const label = node('label', 'Версия для разбора'), select = node('select'); select.dataset.planSizeVersion = '';
  for (const row of ordered) {
    const option = node('option', `Версия ${row.sequence} · ${row.value.action === 'buy' ? 'Покупка' : row.value.action === 'sell' ? 'Продажа' : 'Наблюдение'}`);
    option.value = String(row.sequence); select.append(option);
  }
  const initial = selectedSequence ?? groups[0]?.sequence ?? ordered[0]?.sequence;
  if (!available.has(initial)) {
    const missing = node('option', initial ? `Версия ${initial} сейчас недоступна` : 'Нет доступной сохранённой версии');
    missing.value = String(initial ?? ''); select.append(missing);
  }
  select.value = String(initial ?? ''); label.append(select);
  const view = node('div'); view.dataset.planSizeResult = ''; view.setAttribute('aria-live', 'polite'); root.append(label, view);
  function render() {
    const sequence = Number(select.value), plan = available.get(sequence), group = groups.find(row => row.sequence === sequence);
    view.replaceChildren(); view.dataset.state = group?.state ?? 'unavailable';
    if (plan) {
      view.append(node('p', `Разбирается версия ${sequence} · ${labelInstrument(plan.value)}`, 'plan-review-version'));
      const latest = versions.at(-1);
      if (latest) view.append(node('p', `Последняя доступная версия в истории: ${latest.sequence}. ${sequence !== latest.sequence ? 'Её правки не заменяют выбранную сохранённую копию.' : 'Выбрана эта версия.'}`, 'plan-link-caption'));
      view.append(node('p', `Версия сохранена: ${new Date(plan.recordedAt).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })} МСК · пересмотреть ${plan.value.plannedFor.split('-').reverse().join('.')}`, 'plan-link-caption'));
    }
    const scenario = plan?.value.riskScenario;
    const planned = group ? quantity(group.plannedQuantityNanos) : scenario?.input.assetType === 'share' ? scenario.result.units + ' ед.' : 'Недоступно';
    const list = node('dl', undefined, 'plan-link-size-metrics');
    for (const [key, title, value] of [
      ['planned', 'В плане', planned], ['linked', 'В связанных исполнениях', quantity(group?.linkedQuantityNanos ?? null)],
      ['difference', 'Разница количества', quantity(group?.differenceQuantityNanos ?? null, true)]
    ]) { const pair = node('div'), valueNode = node('dd', value); valueNode.dataset.planSizeMetric = key; pair.append(node('dt', title), valueNode); list.append(pair); }
    view.append(list);
    if (!plan) view.append(node('p', 'Выбранная версия отсутствует среди доступных копий. Выберите другую явно; прежние значения не показаны.'));
    else if (!group) view.append(node('p', scenario ? 'Для этой версии нет связанных исполнений с сопоставимым сохранённым расчётом. Сумма и разница неизвестны.' : 'В этой версии нет сохранённого расчёта количества. Сравнение недоступно; строки связей можно прочитать ниже.'));
    else if (group.state === 'compared') view.append(node('p', `Учтено ${group.matchingLinks} связей выбранной версии и направления. Разница = связанные исполнения − план. Ноль означает равенство только этих количеств.`));
    else for (const reason of group.reasons) view.append(node('p', reasons[reason]));
    if (group?.withdrawnLinks || group?.oppositeDirectionLinks) view.append(node('p', `Не входят в сумму: отозванных ${group.withdrawnLinks}, другого направления ${group.oppositeDirectionLinks}.`));
    if (group && !group.retained) view.append(node('p', 'Версии уже нет в последних 50 правках. Используется её неизменная копия в связях.'));
    view.append(node('p', 'Только отмеченные вами связи. Полнота сделки и исполнение плана не подтверждены; прибыль, заранее заданный риск и фактический R здесь не рассчитываются.', 'plan-review-limit'));
    onSelect(Number.isSafeInteger(sequence) && sequence > 0 ? sequence : null);
  }
  const method = node('details', undefined, 'plan-link-size-method'); method.append(node('summary', 'Как считается сравнение'),
    node('p', 'Количество в плане взято из сохранённого ручного расчёта. Тип инструмента и лот не подтверждены брокером.'),
    node('p', 'Учтены только активные связи той же версии и направления с неизменным источником. Неизвестное количество не становится нулём. Недоступный счёт или изменённый источник блокируют сумму.'),
    node('p', 'Количество поручения и его остаток не прибавляются к отдельным исполнениям. Покупки и продажи не сворачиваются в текущую позицию. Комиссии, проскальзывание, денежный результат и валютный пересчёт не учитываются.'),
    node('p', 'Дата сохранения и сама отметка не доказывают, что план был задан до исполнения или был его причиной.'));
  root.append(method); select.addEventListener('change', render); render(); return root;
}
