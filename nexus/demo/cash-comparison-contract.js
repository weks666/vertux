export const CASH_COMPARISON_VERSION = 'saved-native-cash-comparison-v4';
export const CASH_COMPARISON_PREVIOUS_VERSION = 'saved-native-cash-comparison-v3';
export const CASH_COMPARISON_LEGACY_VERSION = 'saved-native-cash-comparison-v1';
export const CASH_COMPARISON_VERSIONS = Object.freeze([CASH_COMPARISON_VERSION, CASH_COMPARISON_PREVIOUS_VERSION,
  'saved-native-cash-comparison-v2', CASH_COMPARISON_LEGACY_VERSION]);

// Link counts concern only nonzero descriptive commissions of trades inside
// the observed interval. Standalone fee payments remain independent cash.
export function validCashCommissionLinks(value) {
  const keys = ['state', 'tradeCount', 'postingCount', 'inIntervalCount', 'outsideIntervalCount'];
  if (!value || Array.isArray(value) || Object.keys(value).length !== keys.length || !keys.every(key => Object.hasOwn(value, key))) return false;
  const counts = keys.slice(1).map(key => value[key]);
  if (value.state === 'unavailable') return counts.every(count => count === null);
  if (value.state === 'none') return counts.every(count => count === 0);
  return value.state === 'observed' && counts.every(count => Number.isInteger(count) && count >= 0 && count <= 10000)
    && value.tradeCount > 0 && value.postingCount >= value.tradeCount
    && value.inIntervalCount + value.outsideIntervalCount === value.postingCount;
}
export const CASH_COMPARISON_REASONS = Object.freeze({
  invalid_scope: 'Не подтверждён выбранный счёт.',
  invalid_period: 'Не подтверждены границы выбранного периода.',
  select_single_account: 'Выберите один счёт: денежные наблюдения разных счетов не объединяются.',
  source_unavailable: 'Сохранённые исходные данные недоступны.',
  source_scan_limit: 'Объём исходных записей превышает предел проверки; неполный срез не используется для расчёта.',
  invalid_observation: 'Целостность, счёт или время исходного денежного наблюдения не подтверждены.',
  conflicting_observation: 'На один момент сохранены разные денежные наблюдения.',
  missing_observation_pair: 'В выбранном периоде нужны два независимых сохранённых денежных наблюдения.',
  unknown_observation_contract: 'Для старого наблюдения не сохранены полнота списка валют и состояние загрузки лимитов.',
  loading_limits: 'В момент наблюдения лимиты ещё загружались или их состояние неизвестно.',
  unknown_request_time: 'Не подтверждён интервал запроса денежного наблюдения.',
  invalid_money_list: 'Список валют повреждён или содержит повторную валюту.',
  unknown_absent_currency: 'Отсутствие валюты в неполном списке не подтверждает нулевой остаток.',
  incomplete_operations: 'Полная загрузка операций между наблюдениями не подтверждена.',
  operation_source_conflict: 'Исходные операции и их сохранённые версии не согласованы.',
  unknown_operation_state: 'Исполнение одной из операций не подтверждено.',
  unsupported_cash_event: 'Есть операция с неподдержанной денежной семантикой: перевод активов, корректировка или иной вид события.',
  missing_currency_unit: 'Не сохранены исходные сведения о валюте обмена. Они загружаются при синхронизации операций.',
  invalid_currency_unit: 'Целостность или область исходных сведений о валюте не подтверждены.',
  conflicting_currency_unit: 'Сохранены противоречивые сведения об единице валютного инструмента.',
  unsupported_currency_unit: 'Не подтверждены валюта, номинал или единица валютного инструмента.',
  currency_payment_mismatch: 'Платёж обмена не согласован со стороной сделки или валютой расчётов инструмента.',
  unknown_currency_execution: 'Полное исполненное количество валюты не подтверждено: сделки отсутствуют, повторяются или расходятся с количеством операции.',
  currency_execution_state_conflict: 'У отменённой или незавершённой валютной операции сохранены признаки исполнения. Денежное движение нельзя считать нулевым.',
  unknown_payment: 'Сумма, знак или валюта исходного платежа не подтверждены.',
  unknown_commission: 'Не подтверждена комиссия сделки или её отдельное денежное списание.',
  boundary_timing: 'Операция попала внутрь запроса одного из наблюдений; её положение относительно остатка неизвестно.',
  no_currencies: 'Нет подтверждённых валют для сравнения.',
});
export const CASH_COMPARISON_LIMITATIONS = Object.freeze([
  'Время отражает получение ответа приложением. Точное время денежного состояния у брокера неизвестно.',
  'Даты операций — даты поручений в источнике. Даты движения денег и расчётов могут отличаться.',
  'Сравниваются исходные остатки, платежи и количество купленной или проданной валюты. Пересчёта по курсам нет; разница не является инвестиционным результатом.',
  'Количество валюты отнесено к дате операции. Справочник валют наблюдается при загрузке; его историческая неизменность и даты денежных расчётов не подтверждены.',
  'Нулевая разница не подтверждает полную финансовую сверку. Полнота корпоративных действий и сроки расчётов отдельно не подтверждены.',
  'Заблокированные суммы показаны отдельно, как сообщил брокер. Они не прибавляются к остатку и не определяют сумму, доступную для вывода.',
]);
