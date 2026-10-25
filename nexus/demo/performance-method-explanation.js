import { canonicalLocalResultJson as canonical } from './local-context-json.js';
import { PERFORMANCE_METHOD_REASONS as reasons } from './performance-method-reasons.js';

export const METHOD_EXPLANATION_INTENT = 'portfolio.metric-method';
export const METHOD_EXPLANATION_LIMITS = Object.freeze({ bytes: 2 * 1024 * 1024, cashFlows: 20002, amountDigits: 4096 });
const fail = () => { throw new TypeError('Unsupported performance method passport.'); };
const require = value => { if (!value) fail(); };
const shape = (value, keys) => require(value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)));
const iso = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const count = value => Number.isSafeInteger(value) && value >= 0;
const nullable = (value, predicate) => value === null || predicate(value);
const rate = value => typeof value === 'number' && Number.isFinite(value) && value > -1;
const nano = value => typeof value === 'string' && value.length <= METHOD_EXPLANATION_LIMITS.amountDigits + 1 && /^-?(0|[1-9]\d*)$/u.test(value) && value !== '-0';
const fixedReason = code => reasons[code] || reasons.incomplete_inputs;
const policyKeys = ['date', 'valuation', 'currency', 'flows', 'fees', 'capital'];
const methodNames = { twr: 'twr-no-external-flows-v1', xirr: 'xirr-conventional-act365f-moscow-v1' };
const moscowDay = value => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };

/** Validates a public saved-calculation DTO. It neither authenticates it nor recomputes a return. */
export function checkedPerformancePassport(value, selection, { allowMultiple = false } = {}) {
  let serialized; try { serialized = canonical(value); } catch { fail(); }
  require(new TextEncoder().encode(serialized).byteLength <= METHOD_EXPLANATION_LIMITS.bytes);
  const dto = JSON.parse(serialized);
  const manual = dto.contractVersion === 'portfolio-performance-v2';
  shape(dto, ['contractVersion', 'currency', 'scope', 'period', 'evidence', 'methods', 'cashFlows', 'coverage', 'policies', 'reconciliation', ...(manual ? ['funding'] : [])]);
  require(['portfolio-performance-v1', 'portfolio-performance-v2'].includes(dto.contractVersion) && dto.currency === 'RUB');
  shape(dto.scope, ['kind', 'portfolioIds']);
  require(Array.isArray(dto.scope.portfolioIds) && dto.scope.portfolioIds.length > 0 && dto.scope.portfolioIds.length <= 100
    && new Set(dto.scope.portfolioIds).size === dto.scope.portfolioIds.length && dto.scope.portfolioIds.every(id => /^portfolio-[1-9]\d{0,31}$/u.test(id)));
  if (allowMultiple) require(dto.scope.kind === (dto.scope.portfolioIds.length > 1 ? 'all-selected-accounts' : 'single-account')
    && JSON.stringify(dto.scope.portfolioIds) === JSON.stringify(selection?.portfolioIds));
  else require(dto.scope.kind === 'single-account' && dto.scope.portfolioIds.length === 1 && dto.scope.portfolioIds[0] === selection?.portfolioId);
  const p = dto.period;
  shape(p, ['requestedFrom', 'requestedTo', 'observedFrom', 'observedTo', 'endLagMs', 'partialPeriod', 'timeZone', 'dateBasis']);
  require(iso(p.requestedFrom) && iso(p.requestedTo) && p.requestedFrom < p.requestedTo
    && p.requestedFrom === selection.requestedFrom && p.requestedTo === selection.requestedTo
    && nullable(p.observedFrom, iso) && nullable(p.observedTo, iso) && nullable(p.endLagMs, count)
    && typeof p.partialPeriod === 'boolean' && p.timeZone === 'Europe/Moscow' && p.dateBasis === 'ACT/365F-Moscow-calendar');
  if (p.observedFrom !== null) require(p.observedFrom >= p.requestedFrom && p.observedFrom <= p.requestedTo);
  if (p.observedTo !== null) require(p.observedTo >= p.requestedFrom && p.observedTo <= p.requestedTo);
  if (p.observedFrom !== null && p.observedTo !== null) {
    require(p.observedFrom <= p.observedTo);
    // A single saved observation is useful evidence of missing history. It may
    // be explained only as unavailable, never as a calculated zero-length return.
    if (p.observedFrom === p.observedTo) require(dto.coverage?.state === 'unavailable'
      && dto.methods?.twr?.state === 'unavailable' && dto.methods?.xirr?.state === 'unavailable'
      && dto.coverage?.blockers?.some(row => ['missing_valuations', 'invalid_period'].includes(row.code)));
  }
  require(p.endLagMs === (p.observedTo === null ? null : Date.parse(p.requestedTo) - Date.parse(p.observedTo))
    && p.partialPeriod === (p.observedTo !== null && p.observedTo < p.requestedTo));
  shape(dto.evidence, ['dataMode', 'valuationBasis', 'timeBasis', 'label', 'sourceTimeVerified', ...(manual ? ['externalValuationBasis', 'manualValuationCount'] : [])]);
  if (manual) require(dto.evidence.externalValuationBasis === 'owner-entered' && count(dto.evidence.manualValuationCount) && dto.evidence.manualValuationCount > 0);
  require(['synthetic', 'local-saved'].includes(dto.evidence.dataMode)
    && ['saved-observations', 'reconstructed', 'mixed', 'unknown'].includes(dto.evidence.valuationBasis)
    && dto.evidence.timeBasis === 'saved-observation-time' && dto.evidence.sourceTimeVerified === false
    && dto.evidence.label === (dto.evidence.dataMode === 'synthetic' ? 'Учебные данные' : 'Оценка по сохранённым данным'));
  shape(dto.coverage, ['state', 'externalFlowCount', 'blockers']);
  require(['ready', 'unavailable'].includes(dto.coverage.state) && nullable(dto.coverage.externalFlowCount, count)
    && Array.isArray(dto.coverage.blockers) && dto.coverage.blockers.length <= 64);
  for (const blocker of dto.coverage.blockers) {
    shape(blocker, ['code', 'reason']); require(Object.hasOwn(reasons, blocker.code) && blocker.reason === reasons[blocker.code]);
  }
  require((dto.coverage.state === 'ready') === (dto.coverage.blockers.length === 0));
  shape(dto.methods, ['twr', 'xirr']);
  for (const key of ['twr', 'xirr']) {
    const m = dto.methods[key];
    shape(m, ['method', 'version', 'state', 'reasonCode', 'reason', 'periodRate', 'annualRate', 'dayCount', 'calendarFrom', 'calendarTo', 'rateUnit', 'primaryRate', 'numerical']);
    require(m.method === methodNames[key] && m.version === 'performance-numerics-v1' && m.rateUnit === 'fraction'
      && ['estimated', 'calculated', 'unavailable'].includes(m.state) && nullable(m.periodRate, rate) && nullable(m.annualRate, rate)
      && nullable(m.dayCount, value => Number.isSafeInteger(value) && value > 0)
      && nullable(m.calendarFrom, value => typeof value === 'string' && /^\d{4}-\d\d-\d\d$/u.test(value))
      && nullable(m.calendarTo, value => typeof value === 'string' && /^\d{4}-\d\d-\d\d$/u.test(value))
      && m.primaryRate === (key === 'xirr' && m.dayCount >= 365 ? 'annualRate' : 'periodRate'));
    if (m.state === 'unavailable') {
      require(m.periodRate === null && m.annualRate === null && m.numerical === null
        && typeof m.reasonCode === 'string' && /^[a-z_]{1,80}$/u.test(m.reasonCode) && m.reason === fixedReason(m.reasonCode));
    } else {
      require(dto.coverage.state === 'ready' && count(dto.coverage.externalFlowCount) && rate(m.periodRate)
        && m.state === (dto.evidence.dataMode === 'synthetic' ? 'calculated' : 'estimated') && m.reasonCode === null && m.reason === null
        && iso(p.observedFrom) && iso(p.observedTo) && p.observedFrom === p.requestedFrom
        && m.calendarFrom === moscowDay(p.observedFrom) && m.calendarTo === moscowDay(p.observedTo)
        && m.dayCount === (Date.parse(m.calendarTo) - Date.parse(m.calendarFrom)) / 86400000);
      if (key === 'twr') require(dto.coverage.externalFlowCount === 0 && (m.dayCount < 365 ? m.annualRate === null : rate(m.annualRate)));
      else require(rate(m.annualRate));
      const numericKeys = key === 'twr' ? ['periodLogFactor', 'periodFactorRelativeError', 'annualFactorRelativeError']
        : ['annualLogFactor', 'iterations', 'bracketWidth', 'solverRelativeResidual', 'annualRateRelativeResidual', 'periodRateRelativeResidual', 'relativeResidualTolerance', 'uniqueness'];
      shape(m.numerical, numericKeys);
      for (const field of numericKeys) {
        if (field === 'uniqueness') require(m.numerical[field] === 'one-chronological-sign-change-negative-to-positive');
        else require(nullable(m.numerical[field], value => typeof value === 'number' && Number.isFinite(value)));
      }
    }
  }
  require(Array.isArray(dto.cashFlows) && dto.cashFlows.length <= METHOD_EXPLANATION_LIMITS.cashFlows);
  for (const flow of dto.cashFlows) {
    shape(flow, ['kind', 'at', 'amountNanos', 'nativeAmountNanos', 'nativeCurrency', 'fxRateNanos', ...(manual ? ['basis'] : [])]);
    require(['opening', 'deposit', 'withdrawal', 'closing'].includes(flow.kind) && iso(flow.at)
      && nullable(flow.amountNanos, nano) && nullable(flow.nativeAmountNanos, nano) && nullable(flow.fxRateNanos, nano)
      && nullable(flow.nativeCurrency, value => typeof value === 'string' && /^[A-Z]{3}$/u.test(value)));
    if (flow.amountNanos !== null) require(['opening', 'deposit'].includes(flow.kind) ? BigInt(flow.amountNanos) <= 0n : BigInt(flow.amountNanos) >= 0n);
    if (flow.nativeAmountNanos !== null) require(BigInt(flow.nativeAmountNanos) >= 0n);
    if (flow.fxRateNanos !== null) require(BigInt(flow.fxRateNanos) > 0n);
    if (manual) {
      require(['opening', 'closing'].includes(flow.kind) ? flow.basis === 'saved-nav' : ['broker-cash', 'owner-share-valuation'].includes(flow.basis));
      if (flow.basis === 'owner-share-valuation') require(nano(flow.amountNanos) && nano(flow.nativeAmountNanos)
        && flow.nativeCurrency === 'RUB' && flow.fxRateNanos === '1000000000'
        && BigInt(flow.amountNanos) === (flow.kind === 'deposit' ? -BigInt(flow.nativeAmountNanos) : BigInt(flow.nativeAmountNanos)));
    }
    if (flow.kind === 'opening') require(flow.at === p.observedFrom);
    else if (flow.kind === 'closing') require(flow.at === p.observedTo);
    else require(p.observedFrom !== null && p.observedTo !== null && flow.at > p.observedFrom && flow.at <= p.observedTo);
  }
  if (dto.coverage.state === 'ready') require(dto.cashFlows.length === dto.coverage.externalFlowCount + 2
    && dto.cashFlows[0]?.kind === 'opening' && dto.cashFlows.at(-1)?.kind === 'closing'
    && dto.cashFlows.slice(1, -1).every(row => ['deposit', 'withdrawal'].includes(row.kind)));
  if (manual) {
    require(dto.cashFlows.filter(row => row.basis === 'owner-share-valuation').length === dto.evidence.manualValuationCount);
    shape(dto.funding, ['state', 'netContributionsNanos', 'changeAfterFlowsNanos']);
    require(dto.funding.state === (dto.coverage.state === 'ready' ? 'estimated' : 'unavailable'));
    if (dto.funding.state === 'unavailable') require(dto.funding.netContributionsNanos === null && dto.funding.changeAfterFlowsNanos === null);
    else {
      require(dto.cashFlows.every(row => nano(row.amountNanos)) && nano(dto.funding.netContributionsNanos) && nano(dto.funding.changeAfterFlowsNanos));
      const external = dto.cashFlows.slice(1, -1).reduce((sum, row) => sum + BigInt(row.amountNanos), 0n);
      require(BigInt(dto.funding.netContributionsNanos) === -external && BigInt(dto.funding.changeAfterFlowsNanos)
        === BigInt(dto.cashFlows[0].amountNanos) + BigInt(dto.cashFlows.at(-1).amountNanos) + external);
    }
  }
  shape(dto.policies, policyKeys);
  for (const key of policyKeys) require(typeof dto.policies[key] === 'string' && dto.policies[key].length > 0 && dto.policies[key].length <= 2000);
  shape(dto.reconciliation, ['state', 'residualNanos']); require(dto.reconciliation.state === 'not-performed' && dto.reconciliation.residualNanos === null);
  return freeze(dto);
}

export const methodCashFlowRef = index => 'cash-flow-' + String(index + 1).padStart(5, '0');
export function performanceMethodEvidence(dto) {
  return freeze([{ ref: 'method-twr', kind: 'method', methodKey: 'twr', cashFlowIndex: null },
    { ref: 'method-xirr', kind: 'method', methodKey: 'xirr', cashFlowIndex: null },
    { ref: 'cash-flow-schedule', kind: 'cash-flow-schedule', methodKey: null, cashFlowIndex: null },
    ...dto.cashFlows.map((_, index) => ({ ref: methodCashFlowRef(index), kind: 'cash-flow', methodKey: null, cashFlowIndex: index }))]);
}

/** Fixed local claims only. Every number is copied from the verified source passport. */
export function performanceMethodExplanation(dto) {
  return freeze({ contractVersion: 'local-method-explanation-v1', intent: METHOD_EXPLANATION_INTENT,
    title: 'Что показывают методы доходности', modeLabel: 'Локальное объяснение · без AI-модели',
    llmUsed: false, provider: null, model: null, usage: null,
    state: Object.values(dto.methods).some(row => row.state !== 'unavailable') ? 'partial-methods' : 'unavailable',
    scope: { portfolioId: dto.scope.portfolioIds[0] }, period: dto.period, source: dto.evidence,
    methods: ['twr', 'xirr'].map(key => ({ key, title: key === 'twr' ? 'TWR без внешних событий' : 'MWR / XIRR',
      question: key === 'twr' ? 'Как изменился капитал в интервале без пополнений и выводов?' : 'Какой ставке соответствует расписание вложений и возвратов инвестора?',
      ...Object.fromEntries(['state', 'periodRate', 'annualRate', 'primaryRate', 'dayCount', 'rateUnit', 'reasonCode', 'reason'].map(field => [field, dto.methods[key][field]])),
      limitation: key === 'twr' ? 'Этот вариант TWR недоступен при любом внешнем денежном событии, даже если их итог равен нулю.'
        : 'Годовой эквивалент — ставка метода. Эквивалент за фактический период показан отдельно; экстраполяция короткого периода не является полученным годовым результатом.',
      evidenceRefs: ['method-' + key, 'cash-flow-schedule'] })),
    externalFlows: { count: dto.coverage.externalFlowCount, state: dto.coverage.externalFlowCount === null ? 'unknown' : 'known', evidenceRefs: ['cash-flow-schedule'],
      explanation: 'Начальная оценка и пополнения — затраты инвестора; выводы и конечная оценка — поступления. Торговые исполнения не становятся внешними потоками.'
        + (dto.evidence.manualValuationCount ? ' Входы с пометкой «Ручная оценка перевода акций» используют стоимость, указанную владельцем на дату поручения; это предположение, не подтверждённый платёж.' : '') },
    cashFlows: dto.cashFlows.map((row, index) => ({ ...row, evidenceRef: methodCashFlowRef(index) })),
    gaps: dto.coverage.blockers,
    limitations: [...(dto.evidence.manualValuationCount ? ['В расчёте есть ручная стоимость переведённых акций. Она не подтверждает рыночную цену или фактическое время поставки.'] : []),
      'Ставки относятся к фактическому интервалу показанного расчёта.',
      'Время сохранённого наблюдения не подтверждает точное время состояния брокера.',
      'Учтённые расходы уже отражены в стоимости портфеля; повторного вычитания здесь нет. Полнота налогов не подтверждена.',
      'Сверка денежных сумм отдельно не выполнялась. Причины рыночного движения и качество торговых решений из этих ставок не следуют.'],
    financialReconciliation: dto.reconciliation });
}
