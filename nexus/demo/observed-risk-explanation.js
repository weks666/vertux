import { canonicalLocalResultJson } from './local-context-json.js';
import { OBSERVED_RISK_REASONS } from './observed-risk-reasons.js';

export const OBSERVED_RISK_EXPLANATION_INTENT = 'portfolio.observed-risk';
export const OBSERVED_RISK_EXPLANATION_LIMITS = Object.freeze({ bytes: 2 * 1024 * 1024, points: 10000, amountDigits: 4096 });
const keys = (value, expected) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join('|') === expected.slice().sort().join('|');
const assert = condition => { if (!condition) throw new TypeError('Invalid observed-risk passport'); };
const instant = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const integer = value => Number.isSafeInteger(value) && value >= 0;
const finite = value => typeof value === 'number' && Number.isFinite(value);
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const metricKeys = ['maxDrawdown', 'currentDrawdown', 'volatility'];
const reason = row => typeof row.code === 'string' && Object.hasOwn(OBSERVED_RISK_REASONS, row.code) && row.reason === OBSERVED_RISK_REASONS[row.code];
export function checkedObservedRiskPassport(value, selection) {
  const serialized = canonicalLocalResultJson(value); assert(new TextEncoder().encode(serialized).byteLength <= OBSERVED_RISK_EXPLANATION_LIMITS.bytes);
  const dto = JSON.parse(serialized);
  assert(keys(dto, ['contractVersion', 'state', 'currency', 'scope', 'period', 'evidence', 'coverage', 'metrics', 'points', 'episodes', 'policies']));
  assert(dto.contractVersion === 'observed-nav-risk-v1' && ['estimated', 'unavailable'].includes(dto.state) && dto.currency === 'RUB');
  assert(keys(dto.scope, ['kind', 'portfolioIds']) && dto.scope.kind === 'single-account' && Array.isArray(dto.scope.portfolioIds)
    && dto.scope.portfolioIds.length === 1 && dto.scope.portfolioIds[0] === selection.portfolioId && /^portfolio-[1-9]\d{0,31}$/u.test(selection.portfolioId));
  const p = dto.period;
  assert(keys(p, ['requestedFrom', 'requestedTo', 'observedFrom', 'observedTo', 'startGapMs', 'endLagMs', 'partialPeriod'])
    && instant(p.requestedFrom) && instant(p.requestedTo) && p.requestedFrom < p.requestedTo
    && p.requestedFrom === selection.requestedFrom && p.requestedTo === selection.requestedTo);
  for (const at of [p.observedFrom, p.observedTo]) assert(at === null || instant(at) && at >= p.requestedFrom && at <= p.requestedTo);
  const validPeriod = p.observedFrom !== null && p.observedTo !== null && p.observedFrom < p.observedTo;
  assert(validPeriod ? p.startGapMs === Date.parse(p.observedFrom) - Date.parse(p.requestedFrom)
    && p.endLagMs === Date.parse(p.requestedTo) - Date.parse(p.observedTo)
    && p.partialPeriod === (p.startGapMs > 0 || p.endLagMs > 0) : p.startGapMs === null && p.endLagMs === null && p.partialPeriod === null);
  assert(keys(dto.evidence, ['dataMode', 'valuationBasis', 'timeBasis', 'sourceTimeVerified']) && ['local-saved', 'synthetic'].includes(dto.evidence.dataMode)
    && dto.evidence.valuationBasis === 'saved-observations' && dto.evidence.timeBasis === 'saved-observation-time' && dto.evidence.sourceTimeVerified === false);
  const c = dto.coverage, available = dto.state === 'estimated';
  assert(keys(c, ['state', 'requestedState', 'observationCount', 'intervalCount', 'externalFlowCount', 'blockers'])
    && integer(c.observationCount) && c.intervalCount === Math.max(0, c.observationCount - 1)
    && (c.externalFlowCount === null || integer(c.externalFlowCount)) && Array.isArray(c.blockers) && c.blockers.length <= 64
    && c.blockers.every(row => keys(row, ['code', 'reason']) && reason(row)));
  assert(available ? validPeriod && c.state === 'complete-observed' && c.requestedState === (p.partialPeriod ? 'partial' : 'complete')
    && c.blockers.length === 0 && c.externalFlowCount === 0 : c.state === 'unavailable' && c.requestedState === 'unavailable' && c.blockers.length > 0);
  assert(keys(dto.metrics, metricKeys));
  for (const key of metricKeys) {
    const m = dto.metrics[key], sigma = key === 'volatility';
    assert(keys(m, ['state', 'value', 'method', 'reasonCode', 'reason', ...(sigma ? ['n', 'intervalMs', 'annualized'] : [])])
      && m.method === (sigma ? 'observed-nav-sample-sd-v1' : 'observed-nav-no-flow-drawdown-v1'));
    if (m.value === null) assert(m.state === 'unavailable' && reason({ code: m.reasonCode, reason: m.reason }));
    else assert(available && m.state === 'estimated' && finite(m.value) && Number.isFinite(m.value * 100)
      && (sigma ? m.value >= 0 : m.value <= 0 && m.value > -1) && m.reasonCode === null && m.reason === null);
    if (sigma) assert(m.n === c.intervalCount && m.annualized === false && (m.intervalMs === null || integer(m.intervalMs) && m.intervalMs >= 60000)
      && (m.value === null || m.n >= 2 && m.intervalMs !== null));
    else assert((m.value !== null) === available);
    if (!available) assert(m.value === null);
  }
  assert(Array.isArray(dto.points) && dto.points.length <= OBSERVED_RISK_EXPLANATION_LIMITS.points
    && (available ? dto.points.length === c.observationCount && dto.points.length >= 2 : dto.points.length === 0));
  const pointTimes = new Set();
  for (let i = 0; i < dto.points.length; i++) {
    const row = dto.points[i]; assert(keys(row, ['at', 'navNanos', 'index', 'drawdown']) && instant(row.at)
      && row.at >= p.observedFrom && row.at <= p.observedTo && (!i || row.at > dto.points[i - 1].at)
      && typeof row.navNanos === 'string' && /^[1-9]\d{0,4095}$/u.test(row.navNanos)
      && finite(row.index) && row.index > 0 && finite(row.drawdown) && row.drawdown <= 0 && row.drawdown > -1);
    pointTimes.add(row.at);
  }
  if (available) assert(dto.points[0].at === p.observedFrom && dto.points.at(-1).at === p.observedTo
    && dto.points[0].index === 1 && dto.points[0].drawdown === 0
    && dto.metrics.currentDrawdown.value === dto.points.at(-1).drawdown);
  assert(Array.isArray(dto.episodes) && dto.episodes.length <= Math.max(0, dto.points.length - 1) && (available || dto.episodes.length === 0));
  for (const row of dto.episodes) {
    assert(keys(row, ['peakAt', 'troughAt', 'recoveryAt', 'depth', 'durationMs', 'unrecovered'])
      && pointTimes.has(row.peakAt) && pointTimes.has(row.troughAt) && row.peakAt < row.troughAt
      && finite(row.depth) && row.depth < 0 && row.depth > -1 && typeof row.unrecovered === 'boolean'
      && (row.unrecovered ? row.recoveryAt === null : pointTimes.has(row.recoveryAt) && row.recoveryAt > row.troughAt)
      && row.durationMs === Date.parse(row.recoveryAt ?? p.observedTo) - Date.parse(row.peakAt));
  }
  if (available) assert(dto.metrics.maxDrawdown.value === 0 ? dto.episodes.length === 0 : dto.episodes.some(row => row.depth === dto.metrics.maxDrawdown.value));
  assert(keys(dto.policies, ['observation', 'period', 'flows', 'costs', 'volatility', 'cadence', 'recovery'])
    && Object.values(dto.policies).every(row => typeof row === 'string' && row.length <= 4000));
  // The packet binds these source strings but never repeats them as generated claims.
  return freeze(dto);
}

export const riskPointRef = index => 'risk-point-' + String(index + 1).padStart(5, '0');
export const riskEpisodeRef = index => 'risk-episode-' + String(index + 1).padStart(5, '0');
export function observedRiskEvidence(dto) {
  return freeze([...metricKeys.map(metricKey => ({ ref: 'risk-metric-' + metricKey, kind: 'risk-metric', metricKey, pointIndex: null, episodeIndex: null })),
    { ref: 'risk-method', kind: 'risk-method', metricKey: null, pointIndex: null, episodeIndex: null },
    ...dto.points.map((_, pointIndex) => ({ ref: riskPointRef(pointIndex), kind: 'risk-point', metricKey: null, pointIndex, episodeIndex: null })),
    ...dto.episodes.map((_, episodeIndex) => ({ ref: riskEpisodeRef(episodeIndex), kind: 'risk-episode', metricKey: null, pointIndex: null, episodeIndex }))]);
}
export function observedRiskExplanation(dto) {
  const pointIndex = new Map(dto.points.map((row, index) => [row.at, index]));
  const titles = { maxDrawdown: 'Максимальная наблюдаемая просадка', currentDrawdown: 'Просадка на последнем наблюдении', volatility: 'Разброс за сопоставимый интервал' };
  const questions = { maxDrawdown: 'Какое самое глубокое падение от прежнего пика видно на сохранённых оценках?',
    currentDrawdown: 'Насколько последняя сохранённая стоимость ниже прежнего пика?', volatility: 'Насколько различались изменения стоимости между соседними сопоставимыми наблюдениями?' };
  const deepestIndex = dto.episodes.findIndex(row => row.depth === dto.metrics.maxDrawdown.value);
  return freeze({ contractVersion: 'local-observed-risk-explanation-v1', intent: OBSERVED_RISK_EXPLANATION_INTENT,
    title: 'Что показывает риск по наблюдениям', modeLabel: 'Локальное объяснение · без AI-модели', llmUsed: false, provider: null, model: null, usage: null,
    state: dto.state, scope: { portfolioId: dto.scope.portfolioIds[0] }, period: dto.period, source: dto.evidence, coverage: dto.coverage,
    metrics: metricKeys.map(key => ({ key, title: titles[key], question: questions[key], ...dto.metrics[key], rateUnit: 'fraction',
      evidenceRefs: ['risk-metric-' + key, 'risk-method',
        ...(key === 'maxDrawdown' && deepestIndex >= 0 ? [riskEpisodeRef(deepestIndex)] : []),
        ...(key === 'currentDrawdown' && dto.points.length ? [riskPointRef(dto.points.length - 1)] : [])] })),
    points: dto.points.map((row, index) => ({ ...row, evidenceRef: riskPointRef(index) })),
    episodes: dto.episodes.map((row, index) => ({ ...row, evidenceRef: riskEpisodeRef(index),
      pointRefs: [row.peakAt, row.troughAt, row.recoveryAt].filter(Boolean).map(at => riskPointRef(pointIndex.get(at))) })),
    deepestEpisodeRef: deepestIndex >= 0 ? riskEpisodeRef(deepestIndex) : null,
    limitations: ['Это оценка по сохранённым точкам. Между наблюдениями просадка могла быть глубже.',
      'Время сохранённого наблюдения не подтверждает точное время состояния брокера.',
      'Первый профиль требует подтверждённого отсутствия любых внешних денежных событий, включая нулевые.',
      'Разброс не пересчитывается в годовую величину. Малая выборка не подтверждает устойчивость риска.',
      'Нулевой показатель не означает отсутствие риска. Сверка денежных сумм отдельно не выполнялась; причины движения рынка и качество решений здесь не определяются.'] });
}
