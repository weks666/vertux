export const BOOKED_RESULT_INPUTS_VERSION = 'booked-result-inputs-v3';
export const BOOKED_RESULT_COMPONENTS_VERSION = 'booked-result-components-v3';
// Separate aggregate contract: the single-account explanation/receipt protocol
// does not accept a combined result as an individual account result.
export const COMBINED_BOOKED_COMPONENTS_VERSION = 'combined-booked-result-components-v1';
export const BOOKED_COMPONENT_SCOPE = 'explicit-rub-cash-payments-v2';
export const V2_COMPONENT_SCOPE = 'explicit-rub-cash-payments';
export const LEGACY_COMPONENT_SCOPE = 'explicit-broker-fee-payments-only';
export const bookedComponentScope = version => version === 'booked-result-components-v1' ? LEGACY_COMPONENT_SCOPE
  : version === 'booked-result-components-v2' ? V2_COMPONENT_SCOPE : version === BOOKED_RESULT_COMPONENTS_VERSION ? BOOKED_COMPONENT_SCOPE : null;
export const isBookedComponentsVersion = value => typeof value === 'string'
  && ['booked-result-components-v1', 'booked-result-components-v2', BOOKED_RESULT_COMPONENTS_VERSION].includes(value);
const rule = (kind, sign) => Object.freeze({ kind, sign, method: `signed-explicit-${kind}-payment` });
const withholding = rule('tax', 'debit');
const v2Rules = Object.freeze({
  OPERATION_TYPE_BROKER_FEE: rule('broker-fee', 'debit'),
  OPERATION_TYPE_DIVIDEND: rule('dividend', 'credit'),
  OPERATION_TYPE_COUPON: rule('coupon', 'credit'),
  ...Object.fromEntries(['TAX', 'BOND_TAX', 'DIVIDEND_TAX', 'BENEFIT_TAX', 'TAX_PROGRESSIVE', 'BOND_TAX_PROGRESSIVE',
    'DIVIDEND_TAX_PROGRESSIVE', 'BENEFIT_TAX_PROGRESSIVE', 'TAX_REPO', 'TAX_REPO_PROGRESSIVE', 'TAX_REPO_HOLD', 'TAX_REPO_HOLD_PROGRESSIVE']
    .map(type => ['OPERATION_TYPE_' + type, withholding])),
});
// This allowlist classifies saved payments, not tax liability, settlement or
// permission to charge a fee. Corrections and opposite signs remain unknown.
export const CASH_PAYMENT_RULES = Object.freeze({ ...v2Rules,
  ...Object.fromEntries(['SERVICE_FEE', 'MARGIN_FEE', 'SUCCESS_FEE', 'TRACK_MFEE', 'TRACK_PFEE',
    'CASH_FEE', 'OUT_FEE', 'OUTPUT_PENALTY', 'ADVICE_FEE', 'OVER_COM']
    .map(type => ['OPERATION_TYPE_' + type, rule('cash-fee', 'debit')])),
  OPERATION_TYPE_OUT_STAMP_DUTY: rule('stamp-duty', 'debit'),
  OPERATION_TYPE_TAX_REPO_REFUND: rule('tax-refund', 'credit'),
  OPERATION_TYPE_TAX_REPO_REFUND_PROGRESSIVE: rule('tax-refund', 'credit'),
});
export const cashPaymentRule = (type, version = BOOKED_RESULT_COMPONENTS_VERSION) => {
  if (!isBookedComponentsVersion(version) || typeof type !== 'string') return null;
  if (version === 'booked-result-components-v1' && type !== 'OPERATION_TYPE_BROKER_FEE') return null;
  const rules = version === BOOKED_RESULT_COMPONENTS_VERSION ? CASH_PAYMENT_RULES : v2Rules;
  return Object.hasOwn(rules, type) ? rules[type] : null;
};
export const COMPONENT_TITLES = Object.freeze({ 'broker-fee': 'Брокерская комиссия', dividend: 'Выплата дивидендов', coupon: 'Выплата купона', tax: 'Отдельное налоговое списание',
  'cash-fee': 'Отдельная комиссия', 'stamp-duty': 'Гербовый сбор', 'tax-refund': 'Возврат удержанного налога',
  'other-fee': 'Другой расход', 'embedded-commission': 'Комиссия в описании сделки', 'unknown-fee': 'Кандидат комиссии', 'unknown-cash': 'Неподтверждённая денежная операция' });
const cashFeeTitles = Object.freeze({
  OPERATION_TYPE_SERVICE_FEE: 'Комиссия за обслуживание счёта', OPERATION_TYPE_MARGIN_FEE: 'Комиссия за непокрытую позицию',
  OPERATION_TYPE_SUCCESS_FEE: 'Комиссия SuccessFee', OPERATION_TYPE_TRACK_MFEE: 'Комиссия за управление автоследованием',
  OPERATION_TYPE_TRACK_PFEE: 'Комиссия за результат автоследования', OPERATION_TYPE_CASH_FEE: 'Комиссия за валютный остаток',
  OPERATION_TYPE_OUT_FEE: 'Комиссия за вывод валюты', OPERATION_TYPE_OUTPUT_PENALTY: 'Комиссия за вывод средств',
  OPERATION_TYPE_ADVICE_FEE: 'Оплата сервиса советов', OPERATION_TYPE_OVER_COM: 'Комиссия овернайт',
});
export const bookedComponentTitle = row => row?.kind === 'cash-fee' && Object.hasOwn(cashFeeTitles, row.operationType)
  ? cashFeeTitles[row.operationType] : Object.hasOwn(COMPONENT_TITLES, row?.kind) ? COMPONENT_TITLES[row.kind] : COMPONENT_TITLES['unknown-fee'];
export const isBookedComponentKind = (kind, version) => isBookedComponentsVersion(version)
  && (version === 'booked-result-components-v1' ? ['broker-fee', 'other-fee', 'embedded-commission', 'unknown-fee'].includes(kind)
    : Object.hasOwn(COMPONENT_TITLES, kind) && (version === BOOKED_RESULT_COMPONENTS_VERSION || !['cash-fee', 'stamp-duty', 'tax-refund'].includes(kind)));
export const CASH_COMPONENT_SCOPE_TEXT = 'Отдельные платежи комиссий, дивидендов, купонов, налоговых удержаний, возвратов налога по РЕПО и гербового сбора в RUB после начальной оценки и по конечную включительно. Суммы выплат не пересчитываются до налога. Возврат показан отдельно от удержания. Комиссии в описании операции, налоговые корректировки и обратные знаки не добавляются как подтверждённые компоненты. Дата поручения не подтверждает дату расчётов.';
export const V2_COMPONENT_SCOPE_TEXT = 'Отдельные денежные операции брокерской комиссии, дивидендов, купонов и налоговых списаний в RUB после начальной оценки и по конечную включительно. Суммы выплат не пересчитываются до налога. Комиссии в описании операции, возвраты и корректировки не добавляются как подтверждённые компоненты.';
export const LEGACY_COMPONENT_SCOPE_TEXT = 'Только отдельные денежные операции брокерской комиссии в (начальная оценка, конечная оценка]. Комиссии в описании сделки, возвраты и остальные расходы не добавляются как подтверждённые списания.';
export const bookedComponentScopeText = scope => scope === BOOKED_COMPONENT_SCOPE ? CASH_COMPONENT_SCOPE_TEXT
  : scope === V2_COMPONENT_SCOPE ? V2_COMPONENT_SCOPE_TEXT : scope === LEGACY_COMPONENT_SCOPE ? LEGACY_COMPONENT_SCOPE_TEXT : 'Область денежных компонентов не подтверждена.';
