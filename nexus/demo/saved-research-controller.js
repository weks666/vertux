import {
  applySavedResearchCommand, resolveRestoreIntent, validateSavedResearchDocument, SAVED_RESEARCH_TABS,
} from './saved-research-model.js';

const copy = value => structuredClone(value);
const revision = value => Number.isSafeInteger(value) && value >= 0;
const owner = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/u.test(value);
const time = value => typeof value === 'string' && Number.isFinite(Date.parse(value))
  && new Date(value).toISOString() === value;
const fail = (state, code) => ({ ok: false, state, error: { code } });
const stale = () => fail('stale', 'stale-request');
const errorStates = new Set(['corrupt', 'unsupported-version', 'conflict', 'scope-changed', 'invalid-command',
  'invalid-input', 'missing-entry', 'missing', 'ambiguous', 'unverified-origin', 'changed-identity',
  'identity-unverified', 'forbidden', 'limit', 'not-needed', 'unavailable', 'error']);
const errorCodes = new Set(['revision-conflict', 'scope-changed', 'invalid-json', 'payload-limit',
  'invalid-storage-metadata', 'unsupported-version', 'record-limit', 'pin-limit', 'entry-not-found',
  'instrument-unavailable', 'instrument-ambiguous', 'origin-unverified', 'reference-mismatch',
  'guard-unavailable', 'guard-changed', 'current-identity-invalid', 'research-not-permitted',
  'research-permission-required', 'research-permission-unavailable', 'recovery-unavailable',
  'recovery-payload-unbackupable', 'recovery-not-needed', 'storage-unavailable', 'clock-invalid',
  'invalid-title', 'invalid-pin', 'invalid-pin-order', 'invalid-target', 'invalid-reference',
  'unknown-command', 'invalid-input', 'revision-limit', 'access-denied']);
const noRecovery = () => ({ available: false, revision: null });
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const visibleCapture = capture => [capture?.scopeKey, capture?.instrumentRef, capture?.analysisTab, capture?.mode, capture?.interactionRevision];
const semantic = entry => ({ id: entry.id, title: entry.title, target: entry.target, analysisTab: entry.analysisTab,
  instrumentRef: entry.instrumentRef, identityGuards: entry.identityGuards, pinOrder: entry.pinOrder });

// No DOM, storage, timers, global clock, network, navigation, or optimistic writes.
// The injected Research adapter owns its monotonic context/tab/mode generations.
export function createSavedResearchController({ transport, currentResearch, onChange = () => {}, persistence = 'local-node' }) {
  if (!['local-node', 'memory-session'].includes(persistence)) throw new TypeError('Explicit saved research persistence required');
  if (![transport?.read, transport?.command, transport?.recover, currentResearch?.capture,
    currentResearch?.isCurrent, currentResearch?.resolve, currentResearch?.canResearch,
    currentResearch?.commit, onChange].every(value => typeof value === 'function')) {
    throw new TypeError('Saved research controller dependencies required');
  }
  let disposed = false, access = { ownerScope: null, allowed: false, ownerRevision: null, permissionRevision: null };
  let ownerGeneration = 0, permissionGeneration = 0, documentGeneration = 0, sequence = 0, pendingWrite = null;
  let state = emptyState('unavailable', 'access-unavailable');
  function emptyState(status, code = null) {
    return { state: status, ownerScope: access.ownerScope, persistence: access.ownerScope ? persistence : null,
      revision: null, document: null, recovery: noRecovery(), fresh: false, pending: null,
      error: code ? { code } : null };
  }
  const getState = () => copy(state);
  function emit() { try { onChange(getState()); } catch { /* Observers cannot turn a committed write into a retry. */ } }
  function available() { return !disposed && access.ownerScope !== null && access.allowed === true; }
  function updateAccess(value) {
    if (disposed) return fail('disposed', 'controller-disposed');
    const next = { ownerScope: owner(value?.ownerScope) ? value.ownerScope : null, allowed: value?.allowed === true,
      ownerRevision: revision(value?.ownerRevision) ? value.ownerRevision : null,
      permissionRevision: revision(value?.permissionRevision) ? value.permissionRevision : null };
    const ownerChanged = next.ownerScope !== access.ownerScope || next.ownerRevision !== access.ownerRevision;
    const permissionChanged = next.allowed !== access.allowed || next.permissionRevision !== access.permissionRevision;
    if (!ownerChanged && !permissionChanged) return getState();
    if (ownerChanged) ++ownerGeneration;
    if (permissionChanged) ++permissionGeneration;
    access = next; ++sequence; ++documentGeneration; pendingWrite = null;
    state = emptyState(available() ? 'unloaded' : access.ownerScope ? 'forbidden' : 'unavailable',
      available() ? null : access.ownerScope ? 'research-forbidden' : 'access-unavailable');
    emit(); return getState();
  }
  function permitted() {
    return available() ? null : fail(disposed ? 'disposed' : access.ownerScope ? 'forbidden' : 'unavailable',
      disposed ? 'controller-disposed' : access.ownerScope ? 'research-forbidden' : 'access-unavailable');
  }
  function ready() {
    return permitted() || (pendingWrite ? fail('busy', 'request-in-progress') : null)
      || (!state.fresh || !['ready', 'empty'].includes(state.state) ? fail('unavailable', 'refresh-required') : null);
  }
  function capture() {
    try {
      const value = currentResearch.capture();
      return value && typeof value.scopeKey === 'string' && value.scopeKey.trim()
        && revision(value.interactionRevision) && revision(value.sourceRevision)
        && ['instrument', 'portfolio'].includes(value.mode) && SAVED_RESEARCH_TABS.includes(value.analysisTab)
        && currentResearch.isCurrent(value) === true ? value : null;
    } catch { return null; }
  }
  function begin(kind, research = kind === 'refresh' ? null : capture()) {
    if (kind !== 'refresh' && !research) return null;
    const ticket = { kind, ownerGeneration, permissionGeneration, documentGeneration, sequence: ++sequence,
      revision: state.revision, ownerScope: access.ownerScope, research };
    state.pending = kind; state.error = null; emit(); return ticket;
  }
  function current(ticket, includeResearch = true) {
    if (!ticket || !available() || ticket.ownerGeneration !== ownerGeneration
      || ticket.permissionGeneration !== permissionGeneration || ticket.documentGeneration !== documentGeneration
      || ticket.sequence !== sequence || ticket.revision !== state.revision || ticket.ownerScope !== access.ownerScope) return false;
    if (ticket.externalCurrent) { try { if (ticket.externalCurrent() !== true) return false; } catch { return false; } }
    // Listing the owner's document does not select an instrument. Initial
    // catalog/selection changes must not discard that read. Writes and restore
    // still require the exact captured Research context as well as owner access.
    try { return !includeResearch || ticket.kind === 'refresh' || currentResearch.isCurrent(ticket.research) === true; } catch { return false; }
  }
  function finish(ticket, result) {
    if (pendingWrite === ticket) pendingWrite = null;
    if (ticket?.sequence === sequence && ticket.ownerGeneration === ownerGeneration
      && ticket.permissionGeneration === permissionGeneration && !disposed) {
      state.pending = null; emit();
    }
    // Observers are synchronous and can revoke access/start a newer operation.
    // Never return a now-private DTO after that final notification. Research
    // itself may have intentionally changed in a successful restore commit.
    return current(ticket, false) ? result : stale();
  }
  function environment(ticket) {
    return { ownerScope:ticket.ownerScope,currentScope: ticket.research.scopeKey, resolve: ref => currentResearch.resolve(copy(ref)),
      canResearch: resolved => available() && currentResearch.canResearch(resolved) === true };
  }
  function decode(value, ticket) {
    if (!value || typeof value !== 'object' || typeof value.ok !== 'boolean') return fail('unavailable', 'invalid-response');
    if (value.ownerScope !== ticket.ownerScope || value.persistence !== persistence) return fail('unavailable', 'invalid-response');
    if (!value.ok) {
      if (!errorStates.has(value.state)) return fail('unavailable', 'invalid-response');
      return { ...fail(value.state, errorCodes.has(value.error?.code) ? value.error.code : 'request-failed'),
        revision: revision(value.revision) ? value.revision : null,
        recovery: recovery(value.recovery, value.revision) };
    }
    const validated = validateSavedResearchDocument(value.document);
    if (!validated.ok) return fail(validated.state, validated.state === 'unsupported-version' ? 'unsupported-version' : 'invalid-response');
    if (!revision(value.revision) || !['ready', 'empty'].includes(value.state)
      || (value.state === 'empty' ? value.revision !== 0 || validated.document.entries.length !== 0 || value.updatedAt !== null
        : value.revision < 1 || !time(value.updatedAt))
      || revision(ticket.revision) && value.revision < ticket.revision
      || value.revision === ticket.revision && state.document && !same(validated.document, state.document)) return fail('unavailable', 'invalid-response');
    return { ok: true, state: value.state, revision: value.revision, document: validated.document,
      recovery: recovery(value.recovery, value.revision), changed: value.changed };
  }
  function recovery(value, at) {
    return value?.available === true && revision(at) && Number.isSafeInteger(value.revision)
      && value.revision > 0 && value.revision < at ? { available: true, revision: value.revision } : noRecovery();
  }
  function applyResult(ticket, result) {
    if (!current(ticket)) return false;
    ++documentGeneration;
    if (result.ok) {
      state = { ...state, state: result.state, revision: result.revision, document: copy(result.document),
        recovery: copy(result.recovery), fresh: true, error: null };
    } else {
      const unreadable = ['corrupt', 'unsupported-version'].includes(result.state);
      state = { ...state, state: result.state, fresh: false, error: copy(result.error),
        ...(unreadable ? { document: null, revision: result.revision ?? null, recovery: copy(result.recovery || noRecovery()) } : {}) };
    }
    ticket.documentGeneration = documentGeneration; ticket.revision = state.revision;
    emit(); return true;
  }
  async function request(ticket, fn) {
    if (!current(ticket)) return stale();
    try {
      const value = await fn();
      return current(ticket) ? decode(value, ticket) : stale();
    } catch { return current(ticket) ? fail('unavailable', 'transport-unavailable') : stale(); }
  }
  function uncertainWrite(ticket) {
    // A sent request may have committed. Preserve confirmed contents, but require
    // explicit refresh; do not display a stale acknowledgment as a successful save.
    if (current(ticket, false)) {
      state = { ...state, state: 'unavailable', fresh: false, error: { code: 'stale-acknowledgment' } };
      ++documentGeneration; emit();
    }
  }
  async function refresh() {
    const blocked = permitted() || (pendingWrite ? fail('busy', 'request-in-progress') : null);
    if (blocked) return blocked;
    const ticket = begin('refresh');
    if (!ticket) return fail('unavailable', 'current-context-required');
    const result = await request(ticket, () => transport.read());
    if (result.state !== 'stale') applyResult(ticket, result);
    return finish(ticket, current(ticket) ? result : stale());
  }
  function preview(command, ticket) {
    const now = state.document.entries.reduce((latest, entry) => entry.updatedAt > latest ? entry.updatedAt : latest, '1970-01-01T00:00:00.000Z');
    let ordinal = 0;
    while (state.document.entries.some(entry => entry.id === `controller-validation-${ordinal}`)) ++ordinal;
    return applySavedResearchCommand(state.document, command, { ...environment(ticket), now,
      idFactory: () => {while(state.document.entries.some(entry=>entry.id===`controller-validation-${ordinal}`))++ordinal;return `controller-validation-${ordinal++}`;} });
  }
  function acknowledgment(result, expectedRevision, before, planned, command) {
    if (!result.ok) return result;
    const noChange = planned.changed === false;
    if (result.revision !== expectedRevision + (noChange ? 0 : 1)
      || noChange && result.changed !== false) return fail('unavailable', 'invalid-response');
    if (command.type === 'import') {
      const priorIds=new Set(before.entries.map(entry=>entry.id)),added=result.document.entries.filter(entry=>!priorIds.has(entry.id));
      const plannedAdded=planned.document.entries.filter(entry=>!priorIds.has(entry.id));
      if(result.document.entries.length!==planned.document.entries.length||added.length!==plannedAdded.length
        ||!before.entries.every((entry,index)=>same(entry,result.document.entries[index]))
        ||!same(added.map(entry=>({...semantic(entry),id:null})),plannedAdded.map(entry=>({...semantic(entry),id:null}))))return fail('unavailable','invalid-response');
    } else if (command.type !== 'create') {
      if (!same(result.document.entries.map(semantic), planned.document.entries.map(semantic))) return fail('unavailable', 'invalid-response');
    } else {
      const priorIds = new Set(before.entries.map(entry => entry.id));
      const created = result.document.entries.filter(entry => !priorIds.has(entry.id));
      const expected = planned.document.entries.at(-1);
      if (created.length !== 1 || result.document.entries.length !== before.entries.length + 1
        || !before.entries.every(entry => same(semantic(entry), semantic(result.document.entries.find(item => item.id === entry.id) || {})))
        || !same({ ...semantic(created[0]), id: expected.id }, semantic(expected))) return fail('unavailable', 'invalid-response');
    }
    return result;
  }
  async function write(command, kind, research) {
    const blocked = ready(); if (blocked) return blocked;
    const ticket = begin(kind, research);
    if (!ticket) return fail('unavailable', 'current-context-required');
    if (!current(ticket)) return finish(ticket, stale());
    const planned = preview(command, ticket);
    if (!planned.ok) return finish(ticket, planned);
    if (kind === 'mutate' && command.type === 'create') return finish(ticket, fail('invalid-command', 'use-save-current'));
    if (!current(ticket)) return finish(ticket, stale());
    const before = copy(state.document), expectedRevision = ticket.revision;
    // Invalidate already pending reads/restores at request start, not at ack.
    ++documentGeneration; ticket.documentGeneration = documentGeneration; pendingWrite = ticket;
    const result = await request(ticket, () => transport.command({ expectedRevision, command: copy(command) }));
    if (result.state === 'stale') uncertainWrite(ticket);
    else applyResult(ticket, acknowledgment(result, expectedRevision, before, planned, command));
    const output = result.state === 'stale' || !current(ticket) ? stale()
      : state.error ? fail(state.state, state.error.code) : result;
    return finish(ticket, output);
  }
  async function saveCurrent(title) {
    const blocked = ready(); if (blocked) return blocked;
    const research = capture();
    if (!research || research.mode !== 'instrument') return fail('unavailable', 'current-research-required');
    return write({ type: 'create', title, instrumentRef: research.instrumentRef, analysisTab: research.analysisTab }, 'save', research);
  }
  async function mutate(command) {
    return write(command, 'mutate');
  }
  async function restore(id, { isCurrent: externalCurrent } = {}) {
    if (externalCurrent !== undefined) {
      try { if (typeof externalCurrent !== 'function' || externalCurrent() !== true) return stale(); } catch { return stale(); }
    }
    const blocked = ready(); if (blocked) return blocked;
    const ticket = begin('restore');
    if (!ticket) return fail('unavailable', 'current-context-required');
    ticket.externalCurrent = externalCurrent;
    // Explicit restore rereads so externally removed entries are not reopened.
    const read = await request(ticket, () => transport.read());
    if (read.state === 'stale' || !applyResult(ticket, read) || !current(ticket)) return finish(ticket, stale());
    if (!read.ok) return finish(ticket, read);
    if (!state.document.entries.some(entry => entry.id === id)) return finish(ticket, fail('missing-entry', 'entry-not-found'));
    if (typeof currentResearch.prepare === 'function') {
      let preparationValid = true, preparationActive = true, publicationUsed = false, prepared, preparationFailed = false;
      try {
        prepared = await currentResearch.prepare({ isCurrent: () => preparationActive && current(ticket), publishSources(publish) {
          if (!preparationActive || publicationUsed || typeof publish !== 'function' || !current(ticket)) { preparationValid = false; return false; }
          publicationUsed = true;
          const before = copy(visibleCapture(ticket.research)), sourceBefore = ticket.research.sourceRevision;
          const result = publish();
          if (result && typeof result.then === 'function') { preparationValid = false; return false; }
          const after = capture();
          if (!current(ticket, false) || !after || !same(before, visibleCapture(after))
            || after.sourceRevision < sourceBefore || after.sourceRevision > sourceBefore + 1) { preparationValid = false; return false; }
          ticket.research = after; return true;
        } });
      } catch { preparationFailed = true; }
      finally { preparationActive = false; }
      // Close the lease before final resolution/commit and before finish emits.
      // A retained callback cannot publish after success, failure or cancellation.
      if (preparationFailed || prepared === false || !preparationValid) return finish(ticket, current(ticket) ? fail('unavailable', 'prepare-failed') : stale());
    }
    if (!current(ticket)) return finish(ticket, stale());
    const entry = state.document.entries.find(item => item.id === id);
    if (!entry) return finish(ticket, fail('missing-entry', 'entry-not-found'));
    const resolved = resolveRestoreIntent(entry, environment(ticket));
    if (!resolved.ok) return finish(ticket, resolved);
    if (!current(ticket)) return finish(ticket, stale());
    // Adapter must synchronously recheck guard before its first side effect,
    // select once, capture the new target, apply the tab, then load with that token.
    let committed;
    try { committed = currentResearch.commit(copy(resolved.intent), { isCurrent: () => current(ticket), isNavigationCurrent: () => current(ticket, false) }); }
    catch { return finish(ticket, fail('unavailable', 'commit-failed')); }
    return finish(ticket, committed === true ? { ok: true, state: 'restored' } : fail('unavailable', 'commit-failed'));
  }
  async function recover() {
    const blocked = permitted() || (pendingWrite ? fail('busy', 'request-in-progress') : null);
    if (blocked) return blocked;
    if (!['corrupt', 'unsupported-version'].includes(state.state) || !state.recovery.available || !revision(state.revision)) {
      return fail('unavailable', 'recovery-unavailable');
    }
    const ticket = begin('recover');
    if (!ticket) return fail('unavailable', 'current-context-required');
    if (!current(ticket)) return finish(ticket, stale());
    ++documentGeneration; ticket.documentGeneration = documentGeneration; pendingWrite = ticket;
    let result = await request(ticket, () => transport.recover({ expectedRevision: ticket.revision }));
    if (result.ok && (result.revision !== ticket.revision + 1 || result.state !== 'ready')) result = fail('unavailable', 'invalid-response');
    if (result.state === 'stale') uncertainWrite(ticket); else applyResult(ticket, result);
    return finish(ticket, current(ticket) ? result : stale());
  }
  function dispose() {
    if (disposed) return;
    disposed = true; ++sequence; ++documentGeneration; pendingWrite = null;
    state = emptyState('disposed', 'controller-disposed'); state.ownerScope = null; state.persistence = null; emit();
  }
  return Object.freeze({ updateAccess, refresh, saveCurrent, restore, mutate, recover, getState, dispose });
}
