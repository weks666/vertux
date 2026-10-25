import { buildTodayOverview } from './today-overview.js';

const clone = value => structuredClone(value);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const id = value => typeof value === 'string' && /^[A-Za-z0-9._:@/-]{1,160}$/u.test(value);
const stamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const integer = value => typeof value === 'string' && /^-?\d{1,40}$/u.test(value);
const moscowDate = value => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
const forbiddenSaved = () => ({ state: 'forbidden', document: null, revision: null, fresh: false, pending: null });

/** Trusted public bootstrap only. No account lookup or provider call is made. */
export function projectTodayHoldings(context, scope, environment) {
  const rows = context.bootstrap?.clientProduct?.openPositions;
  const portfolios = context.bootstrap?.clientProduct?.portfolios || [];
  const selected = new Set(scope.portfolioIds);
  const confirmedIds = new Set(portfolios.filter(row => {
    if (!selected.has(row.id)) return false;
    const current = context.bootstrap?.equityCurvesByPortfolio?.find(item => item.portfolioId === row.id)?.portfolio
      || (portfolios.length === 1 ? context.bootstrap?.portfolio : null);
    return stamp(current?.currentAsOf) && integer(current?.currentTotalNanos);
  }).map(row => row.id));
  let incomplete = confirmedIds.size !== selected.size || !Array.isArray(rows) || rows.length > 10000;
  const refs = new Map();
  if (Array.isArray(rows) && rows.length <= 10000) for (const row of rows) {
    if (!selected.has(row?.portfolioId)) continue;
    if (!confirmedIds.has(row.portfolioId) || !integer(row.quantityNanos)) { incomplete = true; continue; }
    if (BigInt(row.quantityNanos) === 0n) continue;
    let resolved;
    try { resolved = environment.resolve({ namespace: 'tinvest:broker', instrumentUid: row.instrumentUid }); } catch {}
    if (resolved?.scopeKey !== environment.currentScope || resolved.resolution !== 'exact' || !resolved.meta
      || resolved.ref?.namespace !== 'tinvest:broker' || resolved.ref.instrumentUid !== row.instrumentUid) { incomplete = true; continue; }
    refs.set(JSON.stringify(resolved.ref), clone(resolved.ref));
  }
  const usable = selected.size > 0 && confirmedIds.size > 0 && Array.isArray(rows) && rows.length <= 10000;
  return { scopeKey: scope.key, ownerScope: scope.ownerScope, portfolioIds: [...scope.portfolioIds],
    confirmed: usable, state: !usable ? 'unavailable' : incomplete || context.bootstrap?.quality?.stale === true ? 'stale' : 'ready',
    instrumentRefs: [...refs.values()], observedAt: null,
    sourceAt: null };
}

/** Owner/account binder. update() is driven only by existing app changes. */
export function createTodayOverviewBinder({ getContext, getEnvironment, calendar, savedResearch, now, onUpdate = () => {}, onNavigateSection = () => false } = {}) {
  let disposed = false, generation = 0, scopeSignature = '', meaningfulSignature = '', dto = null, receipt = null, command = null;
  function read() {
    const context = getContext(), environment = getEnvironment();
    const portfolios = context?.bootstrap?.clientProduct?.portfolios;
    const ids = Array.isArray(portfolios) ? portfolios.map(row => row?.id) : [];
    const selected = context?.analyticsAccount || '';
    const revisionKeys = ['accessRevision', 'sourceRevision', 'selectionRevision'];
    if (context?.allowed !== true || !/^[A-Za-z0-9_-]{1,128}$/u.test(context.ownerScope || '')
      || revisionKeys.some(key => !Number.isSafeInteger(context[key]) || context[key] < 0)
      || !Array.isArray(portfolios) || ids.length > 10000 || !ids.every(id) || new Set(ids).size !== ids.length
      || selected && !ids.includes(selected) || typeof environment?.currentScope !== 'string' || !environment.currentScope
      || !['local-node', 'memory-session'].includes(context.persistence)) return null;
    const uiScopeKey = JSON.stringify([context.ownerScope, context.accessRevision, context.selectionRevision,
      environment.currentScope, selected, ids.slice().sort(), context.persistence, context.persistenceDetail, context.dataMode]);
    // Source refresh changes command authority without changing the user's
    // account/owner UI scope or closing its disclosure/focus state.
    const key = JSON.stringify([uiScopeKey, context.sourceRevision]);
    return { context, environment, portfolios, ids: selected ? [selected] : ids.slice().sort(), selected, key, uiScopeKey };
  }
  function savedSnapshot() {
    let value;
    try { value = savedResearch.getConfirmedSnapshot(); } catch { return forbiddenSaved(); }
    // A restore's own pending notification is UI busy state, not lost evidence.
    // Never suppress owner/revision/document/freshness/error changes.
    if (command?.saved && value?.pending === 'restore' && value.fresh === true
      && same({ ...value, pending: null }, command.saved)) return clone(command.saved);
    return value;
  }
  function compute() {
    let current;
    try { current = read(); } catch { current = null; }
    const key = current?.key || 'forbidden';
    const uiScopeKey = current?.uiScopeKey || 'forbidden';
    if (uiScopeKey !== scopeSignature) { scopeSignature = uiScopeKey; generation++; meaningfulSignature = ''; }
    if (!current || disposed) return { dto: buildTodayOverview(null, null), receipt: null, saved: null };
    const { context, environment, ids, selected, portfolios } = current;
    const scope = { key: `today-${generation}`, ownerScope: context.ownerScope, kind: selected ? 'selected-account' : 'all-accounts', portfolioIds: ids,
      label: selected ? portfolios.find(row => row.id === selected)?.label || 'Выбранный счёт' : 'Все разрешённые счета',
      dataMode: context.dataMode, persistence: context.persistence, persistenceDetail: context.persistenceDetail };
    let snapshot;
    try { snapshot = calendar.getSnapshot(); } catch { snapshot = null; }
    const calendarMatches = snapshot?.ownerScope === context.ownerScope && snapshot.accessRevision === context.accessRevision
      && snapshot.sourceKey === environment.currentScope;
    const source = { scopeKey: scope.key, ownerScope: scope.ownerScope, state: calendarMatches ? snapshot.state : 'unavailable',
      confirmed: calendarMatches && snapshot.confirmed === true, observedAt: calendarMatches ? snapshot.observedAt : null, sourceAt: null };
    const saved = savedSnapshot();
    const at = now();
    const input = { asOf: at, scope, holdings: projectTodayHoldings(context, scope, environment),
      calendar: { ...source, provider: 'tinvest:broker', coverage: { state: 'partial' }, data: source.confirmed ? { events: snapshot.data?.events } : null },
      reminders: { ...source, items: source.confirmed ? snapshot.data?.reminders : null }, savedResearch: saved,
      sourceHealth: { ...context.sourceHealth, scopeKey: scope.key, ownerScope: scope.ownerScope } };
    const next = buildTodayOverview(input, environment);
    // Event-driven updates must not churn the UI lease just because the clock advanced.
    const signature = JSON.stringify([moscowDate(at), { ...next, asOf: null }]);
    if (signature === meaningfulSignature && dto?.asOf) next.asOf = dto.asOf;
    const nextReceipt = { key, generation, signature, calendarGeneration: snapshot?.generation ?? null,
      calendarRevision: snapshot?.revision ?? null, saved: clone(saved), scopeKey: scope.key, asOf: next.asOf };
    return { dto: next, receipt: nextReceipt, saved };
  }
  function update() {
    let result;
    try { result = compute(); } catch { result = { dto: buildTodayOverview(null, null), receipt: null }; }
    const changed = !same(dto, result.dto);
    dto = result.dto; receipt = same(receipt, result.receipt) ? receipt : result.receipt; meaningfulSignature = receipt?.signature || '';
    if (changed) { try { onUpdate(clone(dto)); } catch {} }
    return clone(dto);
  }
  function matchesReceipt(value) {
    if (!receipt || !value || value.scopeKey !== receipt.scopeKey || value.asOf !== receipt.asOf) return false;
    let latest;
    try { latest = compute(); } catch { return false; }
    return Boolean(latest.receipt && latest.receipt.key === receipt.key && latest.receipt.generation === receipt.generation
      && latest.receipt.signature === receipt.signature && latest.receipt.calendarGeneration === receipt.calendarGeneration
      && latest.receipt.calendarRevision === receipt.calendarRevision);
  }
  const isCurrent = ticket => !disposed && matchesReceipt(ticket);
  async function onNavigate(intent, ticket) {
    if (command || !isCurrent(ticket) || typeof ticket?.isCurrent !== 'function' || ticket.isCurrent() !== true) return { ok: false, code: 'stale' };
    const intents = [...dto.agenda.items, ...dto.continue.items].map(row => row.navigation)
      .concat([dto.agenda.more, dto.continue.more, dto.service.navigation]).filter(Boolean);
    if (!intents.some(value => same(value, intent))) return { ok: false, code: 'unavailable' };
    const captured = receipt;
    const guard = () => {
      try { return !disposed && receipt === captured && isCurrent(ticket) && ticket.isCurrent() === true; } catch { return false; }
    };
    command = { saved: clone(receipt.saved) };
    try {
      if (!guard()) return { ok: false, code: 'stale' };
      let result;
      if (intent.target === 'calendar.event') result = calendar.openEvent(clone(intent), { isCurrent: guard });
      else if (intent.target === 'calendar.reminder') result = calendar.openReminder(clone(intent), { isCurrent: guard });
      else if (intent.target === 'saved-research.restore') result = savedResearch.restore(intent.savedResearchId, { isCurrent: guard });
      else result = onNavigateSection(clone(intent), { isCurrent: guard });
      result = await result;
      return result?.ok === true && guard() ? { ok: true } : { ok: false, code: 'unavailable' };
    } catch { return { ok: false, code: 'unavailable' }; }
    finally { command = null; update(); }
  }
  function dispose() { if (disposed) return; disposed = true; generation++; command = null; receipt = null; }
  update();
  return Object.freeze({ update, isCurrent, onNavigate, getSnapshot: () => dto ? clone(dto) : null, dispose });
}
