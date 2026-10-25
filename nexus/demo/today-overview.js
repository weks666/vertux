import { selectUpcomingEvents } from './market-calendar.js';
import { validateSavedResearchDocument, resolveRestoreIntent } from './saved-research-model.js';

export const TODAY_LIMITS = Object.freeze({ agenda: 3, continue: 3, days: 7, events: 10000, holdings: 10000, reminders: 500 });
const states = new Set(['ready', 'stale', 'error', 'loading', 'unavailable', 'forbidden', 'not-connected']);
const eventTypes = new Set(['dividend', 'report', 'expiration', 'maturity']);
const codeSet = new Set(['ready', 'loading', 'sync-unavailable', 'source-stale', 'not-connected', 'permission-required', 'source-partial']);
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value, size = 240) => typeof value === 'string' && value.trim() && value.length <= size ? value : null;
const id = value => typeof value === 'string' && /^[A-Za-z0-9._:@/-]{1,160}$/u.test(value);
const owner = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/u.test(value);
const stamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(value)
  && Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const refs = value => plain(value) && id(value.instrumentUid) && ['tinvest:broker', 'bybit:spot', 'binance:spot'].includes(value.namespace);
const refKey = value => JSON.stringify([value.namespace, value.instrumentUid]);
const refCopy = value => ({ namespace: value.namespace, instrumentUid: value.instrumentUid });
const publicIds = value => Array.isArray(value) && value.length <= 10000 && value.every(id) && new Set(value).size === value.length;
const moscowDate = value => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
const cleanTime = value => stamp(value) ? value : null;
const distinct = values => [...new Set(values)];
const invalid = reason => ({ contractVersion: 'today-overview-v1', state: 'unavailable', scope: null, asOf: null, range: null,
  service: { state: 'unavailable', code: null, observedAt: null, sourceAt: null },
  agenda: { state: 'unavailable', items: [], emptyConfirmed: false, more: null },
  continue: { state: 'unavailable', items: [], more: null }, coverage: {}, reasons: [reason] });

function source(value, scope) {
  if (!plain(value) || value.ownerScope !== scope.ownerScope || value.scopeKey !== scope.key) {
    return { state: 'unavailable', usable: false, observedAt: null, sourceAt: null, reasons: ['source-scope-mismatch'] };
  }
  const state = states.has(value.state) ? value.state : 'error';
  return { state, usable: value.confirmed === true && ['ready', 'stale', 'error'].includes(state),
    observedAt: cleanTime(value.observedAt), sourceAt: cleanTime(value.sourceAt),
    reasons: state === 'ready' ? [] : [`source-${state}`] };
}

function exact(value, environment) {
  try {
    const resolved = environment.resolve(value);
    if (resolved?.scopeKey !== environment.currentScope || resolved.resolution !== 'exact' || !resolved.meta
      || !refs(resolved.ref) || resolved.meta.instrumentUid !== resolved.ref.instrumentUid
      || refs(value) && refKey(value) !== refKey(resolved.ref)) return null;
    return resolved;
  } catch { return null; }
}

function continues(snapshot, scope, environment) {
  const out = { state: 'unavailable', items: [], reasons: [], more: { target: 'saved-research.list', ownerScope: scope.ownerScope } };
  if (!snapshot || snapshot.ownerScope !== scope.ownerScope || snapshot.persistence !== scope.persistence) {
    out.reasons.push('saved-scope-mismatch'); return out;
  }
  if (snapshot.pending) { out.state = 'loading'; out.reasons.push('saved-pending'); return out; }
  if (snapshot.fresh !== true || !['ready', 'empty'].includes(snapshot.state)) {
    out.state = ['forbidden', 'error', 'loading'].includes(snapshot.state) ? snapshot.state : 'unavailable';
    out.reasons.push('saved-unconfirmed'); return out;
  }
  const validated = validateSavedResearchDocument(snapshot.document);
  if (!validated.ok || !Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0
    || snapshot.state === 'empty' && (snapshot.revision !== 0 || validated.document.entries.length !== 0)
    || snapshot.state === 'ready' && snapshot.revision === 0) {
    out.reasons.push('saved-invalid'); return out;
  }
  const entries = validated.document.entries.slice().sort((a, b) =>
    (a.pinOrder === null ? 3 : a.pinOrder) - (b.pinOrder === null ? 3 : b.pinOrder)
    || b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
  const eligible = [];
  for (const entry of entries) {
    const result = resolveRestoreIntent(entry, environment);
    if (!result.ok) { out.reasons.push('saved-not-restorable'); continue; }
    eligible.push({ key: `saved:${entry.id}`, kind: 'saved-research', title: entry.title, analysisTab: entry.analysisTab,
      instrumentRef: refCopy(entry.instrumentRef), savedAt: entry.updatedAt,
      relationReason: entry.pinOrder === null ? 'saved-research' : 'pinned-research', relationScope: 'owner',
      evidence: { state: 'confirmed', dataMode: scope.dataMode, timeBasis: 'saved-update-time' },
      navigation: { target: 'saved-research.restore', savedResearchId: entry.id, ownerScope: scope.ownerScope } });
  }
  out.items = eligible.slice(0, TODAY_LIMITS.continue); out.reasons = distinct(out.reasons);
  out.state = out.reasons.length ? 'partial' : out.items.length ? 'ready' : 'empty';
  return out;
}

function build(input, environment) {
  const scope = input?.scope;
  if (!plain(scope) || !text(scope.key, 4096) || !owner(scope.ownerScope) || !publicIds(scope.portfolioIds)
    || !['selected-account', 'all-accounts'].includes(scope.kind) || scope.kind === 'selected-account' && scope.portfolioIds.length !== 1
    || !text(scope.label) || !['local-saved', 'synthetic'].includes(scope.dataMode)
    || !['local-node', 'memory-session'].includes(scope.persistence) || scope.persistence === 'memory-session' && scope.dataMode !== 'synthetic') return invalid('invalid-scope');
  if (!stamp(input.asOf)) return invalid('invalid-as-of');
  if (!text(environment?.currentScope, 4096) || typeof environment.resolve !== 'function' || typeof environment.canResearch !== 'function') return invalid('identity-context-unavailable');
  const from = moscowDate(input.asOf), to = new Date(Date.parse(`${from}T12:00:00Z`) + (TODAY_LIMITS.days - 1) * 86400000).toISOString().slice(0, 10);
  const range = { from, to, timezone: 'Europe/Moscow' };
  const heldState = source(input.holdings, scope), calendarState = source(input.calendar, scope), reminderState = source(input.reminders, scope);
  const problems = [], selected = new Set();
  const holdings = input.holdings;
  const holdingsValid = heldState.usable && publicIds(holdings.portfolioIds)
    && same([...holdings.portfolioIds].sort(), [...scope.portfolioIds].sort())
    && Array.isArray(holdings.instrumentRefs) && holdings.instrumentRefs.length <= TODAY_LIMITS.holdings;
  if (holdingsValid) {
    for (const ref of holdings.instrumentRefs) {
      const resolved = refs(ref) && exact(ref, environment);
      if (!resolved) { problems.push('holding-identity-unavailable'); continue; }
      selected.add(refKey(resolved.ref));
    }
  } else problems.push('holdings-unconfirmed');
  const calendar = input.calendar, coverage = calendar?.coverage;
  const rangeCovered = date(coverage?.from) && date(coverage?.to) && coverage.from <= from && coverage.to >= to;
  const calendarCovered = calendarState.state === 'ready' && calendarState.usable && calendar?.provider === 'tinvest:broker'
    && coverage?.state === 'complete' && rangeCovered;
  if (!calendarCovered) problems.push('calendar-coverage-unconfirmed');
  const data = calendar?.data;
  const arrays = ['portfolioUpcoming', 'upcoming', 'events'].map(key => data?.[key] ?? []);
  const calendarRowsValid = calendarState.usable && calendar?.provider === 'tinvest:broker' && plain(data) && Array.isArray(data.events) && arrays.every(Array.isArray)
    && arrays.reduce((sum, rows) => sum + rows.length, 0) <= TODAY_LIMITS.events;
  if (!calendarRowsValid) problems.push('calendar-rows-unconfirmed');
  const eventGroups = new Map();
  if (holdingsValid && calendarRowsValid) for (const event of arrays.flat()) {
    if (!plain(event) || !id(event.id)) { problems.push('event-invalid'); continue; }
    const group = eventGroups.get(event.id) || []; group.push(event); eventGroups.set(event.id, group);
  }
  const events = [];
  for (const [eventId, group] of eventGroups) {
    if (group.some(event => event.cancelled !== undefined && typeof event.cancelled !== 'boolean')) {
      problems.push('event-invalid'); continue;
    }
    // A current cancellation cannot resurrect an older accepted duplicate.
    if (group.some(event => event.cancelled === true)) continue;
    const signatures = new Set(group.map(event => JSON.stringify([event.type, event.instrumentUid, event.date, event.at || null, event.title])));
    if (signatures.size !== 1) { problems.push('event-version-conflict'); continue; }
    const event = group[0];
    if (!eventTypes.has(event.type) || !date(event.date) || !text(event.title) || !text(event.source, 300) || !id(event.instrumentUid)
      || event.cancelled !== undefined && typeof event.cancelled !== 'boolean') {
      problems.push('event-invalid'); continue;
    }
    if (event.date < from || event.date > to) continue;
    const resolved = exact({ namespace: 'tinvest:broker', instrumentUid: event.instrumentUid }, environment);
    if (!resolved) { problems.push('event-identity-unavailable'); continue; }
    if (!selected.has(refKey(resolved.ref))) continue;
    events.push({ id: `event:${eventId}`, originalId: eventId, type: event.type, date: event.date, at: '', inPortfolio: true,
      title: event.title, instrumentRef: refCopy(resolved.ref), instrumentLabel: text(resolved.meta.ticker,80) || text(resolved.meta.name) || null, source: event.source,
      relationReason: scope.kind === 'selected-account' ? 'held-in-selected-account' : 'held-in-allowed-accounts',
      relationScope: scope.kind, evidenceState: ['error', 'stale'].includes(heldState.state) ? heldState.state : calendarState.state,
      observedAt: calendarState.observedAt, sourceAt: calendarState.sourceAt });
  }
  const reminders = input.reminders, personal = [];
  const remindersValid = reminderState.usable && Array.isArray(reminders.items) && reminders.items.length <= TODAY_LIMITS.reminders;
  if (!remindersValid) problems.push('reminders-unconfirmed');
  const reminderGroups = new Map();
  if (remindersValid) for (const reminder of reminders.items) {
    if (!plain(reminder) || !id(reminder.id)) { problems.push('reminder-invalid'); continue; }
    const group = reminderGroups.get(reminder.id) || []; group.push(reminder); reminderGroups.set(reminder.id, group);
  }
  for (const [reminderId, group] of reminderGroups) {
    if (group.some(row => typeof row.enabled !== 'boolean' || row.cancelled !== undefined && typeof row.cancelled !== 'boolean'
      || row.acknowledgedAt != null && !stamp(row.acknowledgedAt) || row.sourceEventId != null && !id(row.sourceEventId))) {
      problems.push('reminder-invalid'); continue;
    }
    if (group.some(row => row.enabled !== true || row.sourceEventId || row.acknowledgedAt || row.cancelled === true)) continue;
    const signatures = new Set(group.map(row => JSON.stringify([row.dueAt, row.snoozedUntil || null, row.title, row.instrumentUid])));
    if (signatures.size !== 1) { problems.push('reminder-version-conflict'); continue; }
    const reminder = group[0], at = reminder.snoozedUntil || reminder.dueAt;
    if (!stamp(at) || !text(reminder.title) || reminder.timezone !== 'Europe/Moscow') { problems.push('reminder-invalid'); continue; }
    const day = moscowDate(at); if (day < from || day > to) continue;
    const resolved = id(reminder.instrumentUid) ? exact(reminder.instrumentUid, environment) : null;
    personal.push({ id: `reminder:${reminderId}`, originalId: reminderId, type: 'reminder', date: day, at, inPortfolio: false,
      title: reminder.title, instrumentRef: resolved ? refCopy(resolved.ref) : null, instrumentLabel: resolved ? text(resolved.meta.ticker,80) || text(resolved.meta.name) || null : null, source: 'Личное напоминание',
      relationReason: 'personal-reminder', relationScope: 'owner', evidenceState: reminderState.state,
      observedAt: reminderState.observedAt, sourceAt: null });
  }
  const agendaItems = selectUpcomingEvents({ events: events.sort((a, b) => a.id.localeCompare(b.id)) }, personal.sort((a, b) => a.id.localeCompare(b.id)), from).map(row => ({
    key: row.id, kind: row.type === 'reminder' ? 'reminder' : 'calendar-event', title: row.title, eventDate: row.date,
    eventAt: row.type === 'reminder' ? row.at : null, source: row.source, instrumentRef: row.instrumentRef, instrumentLabel: row.instrumentLabel || null,
    relationReason: row.relationReason, relationScope: row.relationScope,
    evidence: { state: row.evidenceState, dataMode: scope.dataMode, observedAt: row.observedAt, sourceAt: row.sourceAt,
      timeBasis: row.type === 'reminder' ? 'owner-scheduled-time' : 'published-calendar-date' },
    navigation: row.type === 'reminder' ? { target: 'calendar.reminder', reminderId: row.originalId, date: row.date, scopeKey: scope.key }
      : { target: 'calendar.event', eventId: row.originalId, date: row.date, instrumentRef: row.instrumentRef, scopeKey: scope.key },
  }));
  const allSources = [heldState, calendarState, reminderState];
  problems.push(...allSources.flatMap(row => row.reasons));
  const agendaReasons = distinct(problems);
  const agendaReady = holdingsValid && heldState.state === 'ready' && calendarCovered && calendarRowsValid
    && remindersValid && reminderState.state === 'ready' && !agendaReasons.length;
  const exceptional = ['error', 'loading', 'stale', 'forbidden', 'not-connected'].find(state => allSources.some(row => row.state === state));
  const agendaState = exceptional || (agendaReady ? agendaItems.length ? 'ready' : 'empty' : agendaItems.length ? 'partial' : 'unavailable');
  const continuation = continues(input.savedResearch, scope, environment);
  const health = source(input.sourceHealth, scope);
  const result = { contractVersion: 'today-overview-v1', scope: { key: scope.key, kind: scope.kind, portfolioIds: [...scope.portfolioIds],
    label: scope.kind === 'all-accounts' ? 'Все разрешённые счета' : scope.label, dataMode: scope.dataMode,
    persistence: scope.persistence, persistenceDetail: scope.persistence === 'memory-session' ? 'transient'
      : ['persistent', 'transient'].includes(scope.persistenceDetail) ? scope.persistenceDetail : 'unknown' }, asOf: input.asOf, range,
    service: { state: health.state, code: codeSet.has(input.sourceHealth?.code) ? input.sourceHealth.code : null,
      observedAt: health.observedAt, sourceAt: health.sourceAt, navigation: { target: 'sync', scopeKey: scope.key } },
    agenda: { state: agendaState, items: agendaItems, emptyConfirmed: agendaState === 'empty', reasons: agendaReasons,
      more: { target: 'calendar', scopeKey: scope.key } }, continue: continuation,
    coverage: { holdings: { state: heldState.state, confirmed: holdingsValid, observedAt: heldState.observedAt, sourceAt: heldState.sourceAt },
      calendar: { state: calendarCovered && !agendaReasons.length ? 'complete' : calendarState.usable ? 'partial' : 'unavailable',
        requestedFrom: from, requestedTo: to, sourceFrom: date(coverage?.from) ? coverage.from : null, sourceTo: date(coverage?.to) ? coverage.to : null,
        observedAt: calendarState.observedAt, sourceAt: calendarState.sourceAt },
      reminders: { state: reminderState.state, confirmed: remindersValid, observedAt: reminderState.observedAt, sourceAt: reminderState.sourceAt },
      savedResearch: { state: continuation.state } },
    reasons: distinct([...agendaReasons, ...continuation.reasons, ...health.reasons]) };
  result.state = ['ready', 'empty'].includes(agendaState) && ['ready', 'empty'].includes(continuation.state) && health.state === 'ready'
    ? 'ready' : agendaItems.length || continuation.items.length ? 'partial' : 'unavailable';
  return result;
}

export function buildTodayOverview(input, environment) {
  try { return build(input, environment); } catch { return invalid('invalid-input'); }
}
