import { scenarioPriceDecimal } from './plan-risk-scenario.js';

/** Read-only disclosure shared by current, retained, captured and file copies. */
export function appendPlanRiskScenario(parent, value, { fromFile = false, draft = false, open = false, inline = false } = {}) {
  if (!value?.riskScenario) return null;
  const scenario = value.riskScenario, input = scenario.input, result = scenario.result;
  const node = (tag, text) => { const element = document.createElement(tag); if (text !== undefined) element.textContent = text; return element; };
  const details = node(inline ? 'section' : 'details'); details.className = 'plan-risk-scenario'; if (!inline) details.open = open;
  details.append(node(inline ? 'h5' : 'summary', draft ? 'Расчёт для этой версии' : 'Сохранённый расчёт позиции'));
  const money = number => scenarioPriceDecimal(number).replace('.', ',') + ' ₽';
  const unit = input.assetType === 'share' ? 'акций' : 'контрактов', priceUnit = input.assetType === 'share' ? '₽ за акцию' : 'пунктов';
  details.append(node('p', `${result.units} ${unit} · ${result.lots} лот. · расчётный риск ${money(result.actualRiskNanos)}`));
  details.append(node('p', fromFile
    ? 'Ручной сценарий из файла. Параметры и даты не подтверждены брокером.'
    : (draft ? 'Ручной сценарий из калькулятора. ' : 'Ручной сценарий этой версии. ') + 'Параметры заданы владельцем; тип инструмента, лот и обеспечение не проверены брокером.'));
  const list = node('dl');
  const rows = [['Тип и направление', `${input.assetType === 'share' ? 'Акция' : 'Фьючерс'} · ${input.direction === 'long' ? 'лонг' : 'шорт'}`],
    ['Капитал для расчёта', money(input.capitalNanos)], ['Допустимый убыток', money(input.riskBudgetNanos)],
    ['Единиц в лоте', input.lotSize], ['Вход', scenarioPriceDecimal(input.entryPriceNanos).replace('.', ',') + ' ' + priceUnit],
    ['Стоп', scenarioPriceDecimal(input.stopPriceNanos).replace('.', ',') + ' ' + priceUnit],
    ['Риск на лот', money(result.lossPerLotNanos)], ['Номинал позиции', money(result.positionAmountNanos)]];
  if (input.targetPriceNanos) rows.push(['Цель', scenarioPriceDecimal(input.targetPriceNanos).replace('.', ',') + ' ' + priceUnit],
    ['Потенциал при достижении цели', money(result.potentialRewardNanos)], ['Риск / прибыль по сценарию', '1 : ' + result.rewardRiskRatio.replace('.', ',')]);
  if (input.assetType === 'future') rows.push(['Шаг цены', scenarioPriceDecimal(input.minPriceIncrementNanos).replace('.', ',') + ' пунктов'],
    ['Стоимость шага одного контракта', money(input.minPriceIncrementAmountNanos)],
    ['Обеспечение на лот', input.guaranteePerLotNanos ? money(input.guaranteePerLotNanos) : 'Не указано; ограничение по обеспечению не рассчитано']);
  for (const [label, text] of rows) { const pair = node('div'); pair.append(node('dt', label), node('dd', text)); list.append(pair); }
  details.append(list);
  if (result.lots === '0') details.append(node('p', 'В заданный лимит не помещается ни один лот.'));
  if (result.capitalLimited) details.append(node('p', 'Количество уменьшено до заданного капитала или обеспечения на лот.'));
  details.append(node('p', 'Комиссии, проскальзывание, свободные деньги и доступность сделки не проверяются. Сохранение не выставляет заявку и не доказывает, что риск был задан до исполнения. Фактический R не рассчитан.'));
  parent.append(details); return details;
}
