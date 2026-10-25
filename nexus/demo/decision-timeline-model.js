import { samePlanDetails } from './nexus-ai-contract.js';
import { validatePlanHistory } from './plan-history-ui.js';
import { validateExecutionObservations, observationTimeKey, operationObservationDates } from './execution-observations-ui.js';
import { validateNewsContentHistory } from './news-content-history-ui.js';
import { validatePlanExecutionLinks } from './plan-execution-links-contract.js';
import { samePlanRiskScenario } from './plan-risk-scenario.js';
import { samePlanPriceBasis } from './plan-price-basis.js';
const keys = (value, allowed) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === allowed.length && Object.keys(value).every(key => allowed.includes(key));
const iso = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const invalid = () => { throw new Error('Не удалось проверить сохранённую ленту.'); };
export function validateDecisionTimeline(data, query, portfolioIds) {
  const scopeKeys = ['planId', 'portfolioId', 'instrumentUid', 'from', 'to'];
  const linked = data?.schema === 'decision-timeline-v2';
  if (!keys(data, ['schema', 'scope', 'readAt', 'coverage', 'planHistory', 'executionObservations', 'newsHistory', ...(linked ? ['planExecutionLinks'] : [])])
    || !['decision-timeline-v1', 'decision-timeline-v2'].includes(data.schema) || !iso(data.readAt) || !keys(data.scope, scopeKeys)
    || scopeKeys.some(key => data.scope[key] !== query[key])) invalid();
  const c = data.coverage;
  if (!keys(c, ['complete', 'knowledgeAt', 'planExecutionLink', 'causalLink', 'snapshot', ...(linked ? ['linkPeriod', 'otherPlanExecutionContexts'] : [])]) || c.complete !== false
    || c.knowledgeAt !== 'unavailable' || c.planExecutionLink !== (linked ? 'owner-annotations' : 'unavailable') || c.causalLink !== 'unavailable' || c.snapshot !== 'saved-sqlite'
    || linked && (c.linkPeriod !== 'execution-or-owner-action' || typeof c.otherPlanExecutionContexts !== 'boolean')) invalid();
  validatePlanHistory(data.planHistory, { planId: query.planId, portfolioIds });
  if (linked) {
    validatePlanExecutionLinks(data.planExecutionLinks, { planId: query.planId, portfolioIds });
    for (const row of data.planExecutionLinks.items) {
      if (row.plan.value.portfolioId !== query.portfolioId || row.plan.value.instrumentUid !== query.instrumentUid) invalid();
      const retained = data.planHistory.items.some(plan => ['sequence', 'kind', 'recordedAt', 'clockRegressed'].every(key => plan[key] === row.plan[key])
        && Object.keys(plan.value).filter(key => !['priceBasis', 'riskScenario', 'planDetails'].includes(key)).every(key => plan.value[key] === row.plan.value[key])
        && samePlanPriceBasis(plan.value.priceBasis, row.plan.value.priceBasis)
        && samePlanRiskScenario(plan.value.riskScenario, row.plan.value.riskScenario)
        && samePlanDetails(plan.value.planDetails, row.plan.value.planDetails));
      if (retained !== row.planVersionRetained) invalid();
    }
  }
  validateExecutionObservations(data.executionObservations, query);
  const news = data.newsHistory;
  if (!keys(news, ['schema', 'instrumentUid', 'period', 'readAt', 'coverage', 'histories']) || news.schema !== 'news-instrument-history-v1'
    || news.instrumentUid !== query.instrumentUid || news.readAt !== data.readAt || !keys(news.period, ['from', 'to'])
    || news.period.from !== query.from || news.period.to !== query.to || !Array.isArray(news.histories) || news.histories.length > 100
    || !keys(news.coverage, ['complete', 'relation', 'missingTags', 'retainedCopiesLimit']) || news.coverage.complete !== false
    || news.coverage.relation !== 'exact-copy-instrument-tag' || news.coverage.missingTags !== 'omitted' || news.coverage.retainedCopiesLimit !== 100) invalid();
  let copies = 0; const ids = new Set();
  for (const history of news.histories) {
    if (typeof history?.newsId !== 'string' || !/^\d{1,24}$/u.test(history.newsId) || ids.has(history.newsId) || history.readAt !== data.readAt) invalid();
    ids.add(history.newsId); validateNewsContentHistory(history, history.newsId); copies += history.items.length;
    if (!history.items.some(row => row.content?.instruments.some(item => item.instrumentUid === query.instrumentUid)
      && row.sourceAt >= query.from && row.sourceAt <= query.to)) invalid();
  }
  if (copies > 100 || new TextEncoder().encode(JSON.stringify(news.histories)).length > 2 * 1024 * 1024) invalid();
  return data;
}

/** Independent observations plus explicit owner annotations. A saved link is
 * not evidence of causality or of what was known before its source execution. */
export function projectDecisionTimeline(data, axis = 'event') {
  if (!['event', 'local'].includes(axis)) invalid();
  const q = data.scope, within = at => at >= q.from && at <= q.to, entries = [];
  let otherPlanContext = false;
  for (const row of data.planHistory.items) {
    if (row.value.portfolioId !== q.portfolioId || row.value.instrumentUid !== q.instrumentUid) { otherPlanContext = true; continue; }
    if (!within(row.recordedAt)) continue;
    entries.push({ key: `plan-${row.sequence}`, kind: 'plan', eventAt: row.recordedAt, localAt: row.recordedAt,
      clockWarning: row.clockRegressed || row.recordedAt > data.readAt, row });
  }
  for (const row of data.executionObservations.items) {
    const cancelAt = row.recordKind === 'source-status' && row.reportedState === 'canceled' && row.details.cancelDateTime.state === 'present'
      && observationTimeKey(row.details.cancelDateTime.value) >= observationTimeKey(q.from) && observationTimeKey(row.details.cancelDateTime.value) <= observationTimeKey(q.to)
      ? row.details.cancelDateTime.value : null;
    const eventAt = cancelAt || operationObservationDates(row).filter(at => observationTimeKey(at) >= observationTimeKey(q.from)
      && observationTimeKey(at) <= observationTimeKey(q.to)).sort((a, b) => observationTimeKey(a).localeCompare(observationTimeKey(b)))[0];
    entries.push({ key: `execution-${row.position}`, kind: 'execution', eventAt, localAt: row.firstReceivedAt,
      clockWarning: row.clockRegressed || row.clockInconsistent || row.firstReceivedAt > data.readAt, row });
  }
  for (const row of data.planExecutionLinks?.items || []) {
    // The same collection is retained on both axes. An old fill can appear
    // because its owner association or withdrawal was recorded in this period.
    if (![row.execution.at, row.recordedAt, row.withdrawnAt].some(at => at !== null && within(at))) continue;
    const localAt = row.withdrawnAt ?? row.recordedAt;
    entries.push({ key: `plan-link-${row.id}`, kind: 'plan-link', eventAt: row.execution.at, localAt,
      clockWarning: row.clockRegressed || row.plan.clockRegressed || row.recordedAt > data.readAt || localAt > data.readAt
        || row.plan.recordedAt > row.recordedAt || row.execution.at > row.recordedAt, row });
  }
  for (const history of data.newsHistory.histories) for (const row of history.items) {
    if (!within(row.sourceAt) || !row.content?.instruments.some(item => item.instrumentUid === q.instrumentUid)) continue;
    entries.push({ key: `news-${history.newsId}-${row.sequence}`, kind: 'news', eventAt: row.sourceAt, localAt: row.recordedAt,
      clockWarning: row.clockRegressed || row.recordedAt < row.sourceAt || row.recordedAt > data.readAt, row });
  }
  const field = axis === 'local' ? 'localAt' : 'eventAt', counts = new Map();
  for (const row of entries) { const key = observationTimeKey(row[field]); counts.set(key, (counts.get(key) || 0) + 1); }
  entries.sort((a, b) => observationTimeKey(b[field]).localeCompare(observationTimeKey(a[field])) || a.key.localeCompare(b.key));
  return { entries: entries.map(row => ({ ...row, sortAt: row[field], tiedTime: counts.get(observationTimeKey(row[field])) > 1 })), otherPlanContext };
}
