const clone = value => structuredClone(value);
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const id = value => typeof value === 'string' && /^[A-Za-z0-9._:@/-]{1,160}$/u.test(value);
const stamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const moscowDate = value => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const eventFields = ['id', 'type', 'instrumentUid', 'title', 'date', 'at', 'source', 'cancelled'];
const reminderFields = ['id', 'instrumentUid', 'title', 'dueAt', 'timezone', 'sourceEventId', 'sourceEventDate', 'enabled', 'acknowledgedAt', 'snoozedUntil', 'updatedAt', 'cancelled'];
const project = (value, fields) => plain(value) ? Object.fromEntries(fields.filter(key => Object.hasOwn(value, key)).map(key => [key, clone(value[key])])) : null;

/** A receipt for the existing calendar request. This module never requests data. */
export function createTodayCalendarBridge({ getAccess, resolve, onChange = () => {}, onOpen = () => false } = {}) {
  let access = null, signature = '', generation = 0, sequence = 0, revision = 0, disposed = false;
  let state = 'unavailable', data = null, observedAt = null;
  const tickets = new WeakSet(), settled = new WeakSet();
  function sync() {
    let next = null;
    try {
      const value = getAccess();
      if (value?.allowed === true && typeof value.ownerScope === 'string' && /^[A-Za-z0-9_-]{1,128}$/u.test(value.ownerScope)
        && Number.isSafeInteger(value.accessRevision) && value.accessRevision >= 0 && typeof value.sourceKey === 'string' && value.sourceKey) {
        next = { ownerScope: value.ownerScope, accessRevision: value.accessRevision, sourceKey: value.sourceKey };
      }
    } catch {}
    const nextSignature = JSON.stringify(next);
    if (nextSignature === signature) return false;
    signature = nextSignature; access = next; generation++; sequence++; revision++;
    data = null; observedAt = null; state = next ? 'unavailable' : 'forbidden';
    return true;
  }
  function notify() { try { onChange(); } catch {} }
  function updateAccess() { if (!disposed && sync()) notify(); }
  function current(ticket) {
    sync();
    return !disposed && Boolean(access) && tickets.has(ticket) && ticket.generation === generation && ticket.sequence === sequence;
  }
  function beginRead(query = {}) {
    sync();
    if (disposed || !access) return null;
    const ticket = Object.freeze({ generation, sequence: ++sequence, month: typeof query.month === 'string' ? query.month : null });
    tickets.add(ticket); state = 'loading'; revision++; notify(); return ticket;
  }
  function accept(ticket, value, { beforeNotify } = {}) {
    if (!current(ticket) || settled.has(ticket)) return false;
    // Missing arrays remain unknown; they are never coerced into confirmed empty.
    if (!plain(value) || value.events != null && (!Array.isArray(value.events) || value.events.length > 10000)
      || value.reminders != null && (!Array.isArray(value.reminders) || value.reminders.length > 500)) return reject(ticket);
    try {
      data = { month: typeof value.month === 'string' ? value.month : ticket.month,
        events: Array.isArray(value.events) ? value.events.map(row => project(row, eventFields)) : null,
        reminders: Array.isArray(value.reminders) ? value.reminders.map(row => project(row, reminderFields)) : null };
    } catch { return reject(ticket); }
    settled.add(ticket); observedAt = stamp(value.capturedAt) ? value.capturedAt : null;
    state = Array.isArray(value.warnings) && value.warnings.length ? 'stale' : 'ready'; revision++;
    // The existing calendar publishes its matching full DTO before a Today
    // observer can synchronously attempt to open a row from this projection.
    if (beforeNotify !== undefined) {
      try {
        if (typeof beforeNotify !== 'function') throw new Error('Invalid publisher');
        const result = beforeNotify();
        if (result && typeof result.then === 'function') throw new Error('Async publisher');
      } catch { data = null; observedAt = null; state = 'error'; notify(); return false; }
    }
    if (!current(ticket)) return false;
    notify();
    return current(ticket);
  }
  function reject(ticket) {
    if (!current(ticket) || settled.has(ticket)) return false;
    settled.add(ticket); state = 'error'; revision++; notify(); return false;
  }
  function getSnapshot() {
    sync();
    return clone({ ...access, generation, revision, state: disposed ? 'forbidden' : state,
      confirmed: !disposed && Boolean(access && data), observedAt, sourceAt: null,
      data: !disposed && access ? data : null });
  }
  function open(kind, intent, { isCurrent } = {}) {
    const receipt = getSnapshot();
    let active = true;
    const valid = () => {
      sync();
      try { return active && !disposed && receipt.confirmed && access && receipt.generation === generation && receipt.revision === revision
        && typeof isCurrent === 'function' && isCurrent() === true; } catch { return false; }
    };
    if (!valid()) return { ok: false, code: 'stale' };
    const recordId = kind === 'event' ? intent?.eventId : intent?.reminderId;
    if (!id(recordId)) return { ok: false, code: 'unavailable' };
    const rows = (kind === 'event' ? data?.events : data?.reminders)?.filter(row => row?.id === recordId) || [];
    // Different duplicate versions are ambiguous; a tombstone always wins.
    if (!rows.length || new Set(rows.map(row => JSON.stringify(row))).size !== 1 || rows.some(row => row.cancelled === true)) return { ok: false, code: 'unavailable' };
    const row = rows[0];
    if (row.cancelled !== undefined && typeof row.cancelled !== 'boolean') return { ok: false, code: 'unavailable' };
    if (kind === 'event') {
      if (intent?.target !== 'calendar.event' || row.date !== intent.date || !['dividend', 'report', 'expiration', 'maturity'].includes(row.type)) return { ok: false, code: 'unavailable' };
      let resolved;
      try { resolved = resolve({ namespace: 'tinvest:broker', instrumentUid: row.instrumentUid }); } catch {}
      if (resolved?.resolution !== 'exact' || !resolved.meta || resolved.scopeKey !== access.sourceKey
        || !equal(resolved.ref, intent.instrumentRef) || resolved.ref.namespace !== 'tinvest:broker') return { ok: false, code: 'unavailable' };
    } else {
      const at = row.snoozedUntil || row.dueAt;
      if (intent?.target !== 'calendar.reminder' || row.enabled !== true || row.sourceEventId || row.acknowledgedAt != null
        || row.timezone !== 'Europe/Moscow' || !stamp(at) || moscowDate(at) !== intent.date) return { ok: false, code: 'unavailable' };
    }
    if (!valid()) return { ok: false, code: 'stale' };
    try {
      const result = onOpen({ kind, id: recordId, date: intent.date, isCurrent: valid });
      return result === true && valid() ? { ok: true } : { ok: false, code: 'unavailable' };
    } catch { return { ok: false, code: 'unavailable' }; }
    finally { active = false; }
  }
  function dispose() { if (disposed) return; disposed = true; generation++; sequence++; revision++; data = null; observedAt = null; state = 'forbidden'; notify(); }
  sync();
  return Object.freeze({ updateAccess, beginRead, accept, reject, isCurrent: current, getSnapshot,
    openEvent: (intent, guard) => open('event', intent, guard), openReminder: (intent, guard) => open('reminder', intent, guard), dispose });
}
