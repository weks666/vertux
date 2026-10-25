import { createPriceAlertProtocolClient, parseAlertEvent } from './price-alert-protocol.js';

const freeze = Object.freeze;
const empty = status => ({ status, snapshot: null, fresh: false, pending: null, errorCode: null, confirmedAt: null });
const safeCode = value => /^(?:ALERT|RELAY)_[A-Z0-9_]{1,56}$/u.test(value || '') ? value : 'ALERT_TRANSPORT_UNAVAILABLE';
export function isNotificationAlert(value) { try { return parseAlertEvent(value).notificationEligible === true; } catch { return false; } }

export function createPriceAlertsController({ request, onChange = () => {}, now = () => new Date().toISOString(), clock = () => Date.now() } = {}) {
  if (typeof request !== 'function') throw new TypeError('Explicit alert request adapter required');
  let access = { allowed: false, ownerScope: null, accessRevision: null, bootstrapRevision: 0 };
  let epoch = 0; let sequence = 0; let client = null; let disposed = false; let denied = false; let deniedAt = 0;
  let state = empty('unavailable'); let pending = null; const requests = new Set();
  // Background polls back off after failures: a missing relay must not keep the
  // screen in a permanent checking state or flood the service every 10 seconds.
  let failures = 0; let retryAt = 0;
  let authority = freeze({ isCurrent: () => false });
  const available = () => !disposed && !denied && access.allowed && access.ownerScope !== null;
  const current = (capturedEpoch, capturedSequence = sequence) => available() && epoch === capturedEpoch && sequence === capturedSequence;
  const getState = () => freeze({ ...state, epoch, allowed: available(), transferAvailable: Boolean(client?.transferAvailable), archiveAvailable: Boolean(client?.archiveAvailable) });
  function emit() { onChange(getState()); }
  function reset(status) {
    epoch++; sequence++; client?.dispose(); client = null; pending = null;
    for (const controller of requests) controller.abort(); requests.clear();
    const value = {}; value.isCurrent = () => value === authority && available(); authority = freeze(value);
    failures = 0; retryAt = 0; state = empty(status); emit();
  }
  function rejectAccess(capturedEpoch = epoch) {
    if (disposed || capturedEpoch !== epoch) return;
    denied = true; deniedAt = access.bootstrapRevision; reset('forbidden');
  }
  function updateAccess(input) {
    if (disposed) return false;
    const next = { ownerScope: /^[a-f0-9]{32}$/u.test(input?.ownerScope || '') ? input.ownerScope : null,
      allowed: input?.allowed === true, accessRevision: Number.isSafeInteger(input?.accessRevision) && input.accessRevision > 0 ? input.accessRevision : null,
      bootstrapRevision: Number.isSafeInteger(input?.bootstrapRevision) ? input.bootstrapRevision : 0 };
    next.allowed &&= next.ownerScope !== null && next.accessRevision !== null;
    const changed = ['ownerScope', 'allowed', 'accessRevision'].some(key => next[key] !== access[key]);
    const recover = denied && next.bootstrapRevision > deniedAt;
    access = next;
    if (!changed && !recover) return false;
    denied = false; reset(available() ? 'unloaded' : 'unavailable'); return true;
  }
  async function call(input) {
    const capturedEpoch = epoch; const controller = new AbortController(); requests.add(controller);
    try {
      const result = await request(input, { signal: controller.signal, onAccessRejected: () => rejectAccess(capturedEpoch) });
      if ([401, 403].includes(result?.status)) rejectAccess(capturedEpoch);
      return result;
    } finally { requests.delete(controller); }
  }
  function protocol() {
    client ||= createPriceAlertProtocolClient({ request: call,
      access: { capture: () => available() ? authority : null, isCurrent: value => value === authority && available() } });
    return client;
  }
  function failure(error) {
    const errorCode = safeCode(error?.code); failures = Math.min(failures + 1, 6); retryAt = clock() + Math.min(300000, 15000 * 2 ** (failures - 1));
    state = { ...state, pending: null, fresh: false, errorCode,
      status: state.snapshot ? 'stale' : errorCode === 'ALERT_RELAY_NOT_CONFIGURED' ? 'unconfigured' : 'unavailable' };
    emit(); return { ok: false, code: errorCode };
  }
  async function load(capturedEpoch, capturedSequence) {
    const service = protocol();
    if (service.mode !== 'ready') await service.connect();
    if (!current(capturedEpoch, capturedSequence)) return false;
    const snapshot = await service.snapshot();
    if (!current(capturedEpoch, capturedSequence)) return false;
    failures = 0; retryAt = 0;
    state = { status: snapshot.mode, snapshot, fresh: true, pending: null, errorCode: null, confirmedAt: now() }; emit();
    return current(capturedEpoch, capturedSequence);
  }
  function refresh({background=false}={}) {
    if (!available()) return Promise.resolve({ ok: false, stale: true });
    if (background && (['unconfigured','unloaded'].includes(state.status) || clock() < retryAt)) return Promise.resolve({ ok:false, skipped:true });
    if (pending) return pending;
    if (state.pending) return Promise.resolve({ ok: false, code: 'ALERT_BUSY' });
    const capturedEpoch = epoch; const capturedSequence = ++sequence;
    state = { ...state, status: background || state.snapshot || state.status==='unconfigured' ? state.status : 'loading', pending: 'read' }; emit();
    if (!current(capturedEpoch, capturedSequence)) return Promise.resolve({ ok: false, stale: true });
    const operation = (async () => {
      try { return { ok: await load(capturedEpoch, capturedSequence) }; }
      catch (error) { return current(capturedEpoch, capturedSequence) ? failure(error) : { ok: false, stale: true }; }
    })().finally(() => { if (pending === operation) pending = null; });
    pending = operation; return operation;
  }
  function mutate(kind, operation) {
    if (!available() || pending || state.pending || !state.fresh || state.status !== 'ready') return Promise.resolve({ ok: false, code: 'ALERT_READ_REQUIRED' });
    const capturedEpoch = epoch; const capturedSequence = ++sequence;
    state = { ...state, pending: kind }; emit();
    if (!current(capturedEpoch, capturedSequence)) return Promise.resolve({ ok: false, stale: true });
    const result = (async () => {
      let acknowledged = false; let data;
      try {
        data = await operation(protocol());
        if (!current(capturedEpoch, capturedSequence)) return { ok: false, stale: true };
        acknowledged = true;
        const snapshot = state.snapshot;
        if (kind === 'read-event') {
          if (data) state = { ...state, snapshot: freeze({ ...snapshot, events: freeze(snapshot.events.map(event => event.id === data.id ? data : event)) }) };
        } else if (kind !== 'transfer-apply') {
          const id = data.id; const rules = snapshot.rules.filter(rule => (rule.id ?? rule.rule?.id) !== id);
          state = { ...state, snapshot: freeze({ ...snapshot, rules: freeze([data, ...rules]) }) };
        }
        state = { ...state, fresh: false, pending: 'read' }; emit();
        if (!current(capturedEpoch, capturedSequence)) return { ok: false, stale: true };
        const fresh = await load(capturedEpoch, capturedSequence);
        return current(capturedEpoch, capturedSequence) ? { ok: true, data, fresh, authority } : { ok: false, stale: true };
      } catch (error) {
        if (!current(capturedEpoch, capturedSequence)) return { ok: false, stale: true };
        const failed = failure(error);
        return acknowledged ? { ok: true, data, fresh: false, authority } : failed;
      }
    })().finally(() => { if (pending === result) pending = null; });
    pending = result; return result;
  }
  function setup() {
    if (!available() || pending || state.pending || state.status !== 'unconfigured') return Promise.resolve({ ok: false, code: 'ALERT_SETUP_UNAVAILABLE' });
    const capturedEpoch = epoch; const capturedSequence = ++sequence;
    state = { ...state, pending: 'setup' }; emit();
    if (!current(capturedEpoch, capturedSequence)) return Promise.resolve({ ok: false, stale: true });
    const operation = (async () => {
      try {
        const response = await call({ method: 'POST', path: '/api/alerts/setup', body: '{}' });
        if (!current(capturedEpoch, capturedSequence)) return { ok: false, stale: true };
        if (response?.status !== 200 || response.payload?.data?.saved !== true) throw Object.assign(new Error(), { code: response?.payload?.code });
        await load(capturedEpoch, capturedSequence);
        return current(capturedEpoch, capturedSequence) ? { ok: true, authority } : { ok: false, stale: true };
      } catch (error) {
        if(!current(capturedEpoch,capturedSequence))return {ok:false,stale:true};
        state={...state,status:'unconfigured',pending:null,errorCode:safeCode(error?.code)};emit();
        return {ok:false,code:safeCode(error?.code),cancelled:error?.code==='ALERT_SETUP_CANCELLED'};
      }
    })().finally(() => { if (pending === operation) pending = null; });
    pending = operation; return operation;
  }
  function transferRead(kind, operation) {
    if (!available() || pending || state.pending || !state.fresh || state.status !== 'ready') return Promise.resolve({ ok: false, code: 'ALERT_READ_REQUIRED' });
    const capturedEpoch = epoch, capturedSequence = ++sequence;
    state = { ...state, pending: kind }; emit();
    if (!current(capturedEpoch, capturedSequence)) return Promise.resolve({ ok: false, stale: true });
    const result = (async () => {
      try {
        const data = await operation(protocol());
        if (!current(capturedEpoch, capturedSequence)) return { ok: false, stale: true };
        state = { ...state, pending: null }; emit(); return current(capturedEpoch, capturedSequence) ? { ok: true, data, authority } : { ok: false, stale: true };
      } catch (error) {
        if (!current(capturedEpoch, capturedSequence)) return { ok: false, stale: true };
        if (kind === 'archive-read' && error?.code === 'ALERT_ARCHIVE_CANCELLED') { state = { ...state, pending: null }; emit(); return { ok: false, cancelled: true }; }
        return failure(error);
      }
    })().finally(() => { if (pending === result) pending = null; });
    pending = result; return result;
  }
  return freeze({ updateAccess, refresh, setup, rejectAccess, getState, notificationAuthority: () => authority,
    archiveDownload: options => transferRead('archive-read', service => service.archiveDownload(options)),
    transferSnapshot: () => transferRead('transfer-read', service => service.transferSnapshot()),
    transferPreview: (before, file, choices) => transferRead('transfer-preview', service => service.transferPreview(before, file, choices)),
    transferApply: (before, file, choices, token) => mutate('transfer-apply', service => service.transferApply(before, file, choices, token)),
    create: config => mutate('create', service => service.create(config)),
    command: (id, command) => mutate('command', service => service.command(id, command)),
    markRead: id => mutate('read-event', service => service.markRead(id)),
    dispose() { if (!disposed) { disposed = true; reset('unavailable'); } } });
}
