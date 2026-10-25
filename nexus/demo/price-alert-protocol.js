// Portable protocol boundary. No Node imports, owner IDs, storage, global fetch,
// timer, DOM, or notification side effects. Access tickets belong to the host.
import { RULE_LIMITS, canonicalRule, exactObject, fail, label, decimal, revision, ruleId, utc } from './price-alert-rule-model.js';
import { ALERT_TRANSFER_LIMITS, priceRulesCommand, validatePriceRulesSnapshot, validatePriceRulesPreview, validatePriceRulesApplied } from './price-rules-transfer-model.js';
import { createArchiveDownload, priceAlertArchivePath, isPriceAlertArchivePath, validateArchiveStart, validateArchivePart, validateArchiveHeader } from './price-alert-archive-model.js';
const V1 = '/api/alerts/versioned';
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const object = value => { if (!value || typeof value !== 'object' || Array.isArray(value)) fail('ALERT_RESPONSE_INVALID', 502); return value; };
const valid = condition => { if (!condition) fail('ALERT_RESPONSE_INVALID', 502); };
const stamp = (value, nullable = false) => { if (nullable && value === null) return null; valid(utc(value) === value); return value; };
const price = value => { valid(decimal(value) === value); return value; };
function business(value) {
  object(value); valid(value.source === 'tradingview' && ['buy', 'sell', 'watch'].includes(value.intent));
  valid(label(value.symbol, 'symbol') === value.symbol && label(value.exchange, 'exchange') === value.exchange);
  return { id: ruleId(value.id), source: 'tradingview', symbol: value.symbol, exchange: value.exchange, targetPrice: price(value.targetPrice), intent: value.intent };
}
function legacyRule(value) {
  const safe = business(value); const condition = value.condition ?? 'crossing'; const note = value.note ?? '';
  valid(typeof value.enabled === 'boolean' && typeof (value.deliverTelegram ?? true) === 'boolean'
    && ['crossing', 'above', 'below'].includes(condition) && typeof note === 'string' && note.length <= 1000
    && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(note));
  return Object.freeze({ ...safe, condition, note, enabled: value.enabled, deliverTelegram: value.deliverTelegram ?? true,
    createdAt: stamp(value.createdAt), updatedAt: stamp(value.updatedAt) });
}
export function parseAlertRule(value, expectedId = null) {
  object(value);
  if (value.state === 'legacy') {
    valid(value.headRevision === 0 && value.ruleVersion === 0);
    const rule = legacyRule(value.rule); valid(expectedId === null || rule.id === expectedId);
    return Object.freeze({ state: 'legacy', headRevision: 0, ruleVersion: 0, rule });
  }
  const id = ruleId(value.id); valid(expectedId === null || id === expectedId);
  valid(typeof value.recoveryAvailable === 'boolean');
  if (['corrupt', 'unsupported'].includes(value.state)) {
    valid(value.headRevision === null || Number.isSafeInteger(value.headRevision) && value.headRevision > 0 && value.headRevision < Number.MAX_SAFE_INTEGER);
    valid(value.ruleVersion === null || Number.isSafeInteger(value.ruleVersion) && value.ruleVersion >= 0);
    valid(value.enabled === false && value.config === undefined);
    return Object.freeze({ id, state: value.state, headRevision: value.headRevision, ruleVersion: value.ruleVersion,
      enabled: false, recoveryAvailable: value.recoveryAvailable });
  }
  revision(value.headRevision); valid(Number.isInteger(value.ruleVersion) && value.ruleVersion >= 1 && value.ruleVersion <= RULE_LIMITS.versions
    && ['active', 'paused'].includes(value.state) && value.enabled === (value.state === 'active'));
  const config = canonicalRule(value.config); valid(same(config, value.config));
  const activatedAt = stamp(value.activatedAt, true); valid(value.state !== 'active' || activatedAt !== null);
  valid(value.changed === undefined || typeof value.changed === 'boolean');
  return Object.freeze({ id, state: value.state, headRevision: value.headRevision, ruleVersion: value.ruleVersion,
    enabled: value.enabled, config, activatedAt, recoveryAvailable: value.recoveryAvailable,
    ...(value.changed === undefined ? {} : { changed: value.changed }) });
}
export function parseAlertEvent(value, { legacy = false } = {}) {
  const safe = business(value); const version = legacy ? 0 : value.ruleVersion;
  valid(typeof value.eventKey === 'string' && (version === 0 ? /^[0-9a-f]{64}$/u : /^v1:[0-9a-f]{64}$/u).test(value.eventKey)
    && Number.isInteger(version) && version >= 0 && version <= RULE_LIMITS.versions
    && ['pending', 'not_configured', 'sent', 'failed', 'unknown'].includes(value.telegramStatus)
    && Number.isInteger(value.attempts) && value.attempts >= 0 && value.attempts <= 20
    && (value.telegramErrorCode === null || typeof value.telegramErrorCode === 'string' && /^(?:ALERT|TELEGRAM)_[A-Z0-9_]{1,54}$/u.test(value.telegramErrorCode)));
  if (!legacy) valid(value.notificationEligible === true && value.evaluationState === (version === 0 ? 'legacy' : 'accepted'));
  return Object.freeze({ ...safe, ruleId: ruleId(value.ruleId), eventKey: value.eventKey, actualPrice: price(value.actualPrice),
    sourceTime: stamp(value.sourceTime), receivedAt: stamp(value.receivedAt), readAt: stamp(value.readAt, true),
    telegramStatus: value.telegramStatus, telegramErrorCode: value.telegramErrorCode, attempts: value.attempts,
    nextAttemptAt: stamp(value.nextAttemptAt, true), ruleVersion: version, evaluationState: version === 0 ? 'legacy' : 'accepted',
    nextAllowedAt: legacy ? null : stamp(value.nextAllowedAt, true), notificationEligible: true });
}
function metadata(value) {
  valid(typeof value.configured === 'boolean' && value.fixture === false && typeof value.telegramConfigured === 'boolean');
  const webhookUrl = value.webhookUrl ?? null;
  if (webhookUrl !== null) {
    let url; try { url = new URL(webhookUrl); } catch { fail('ALERT_RESPONSE_INVALID', 502); }
    valid(url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password && !url.search && !url.hash);
  }
  return { configured: value.configured, fixture: false, telegramConfigured: value.telegramConfigured, webhookUrl };
}
export function parseAlertCapability(value) {
  object(value); valid(value.protocolVersion === 1 && Array.isArray(value.capabilities)
    && ['versions', 'cas', 'recovery', 'cooldown'].every(item => value.capabilities.includes(item))
    && same(value.limits, RULE_LIMITS));
  return Object.freeze({ protocolVersion: 1, capabilities: Object.freeze(['versions', 'cas', 'recovery', 'cooldown', ...['rule-transfer','rule-archive'].filter(name=>value.capabilities.includes(name))]), limits: RULE_LIMITS });
}
export function parseAlertSnapshot(value, { legacy = false } = {}) {
  object(value); const connection = metadata(value);
  valid(Array.isArray(value.rules) && value.rules.length <= 1000 && Array.isArray(value.events) && value.events.length <= (legacy ? 200 : 100));
  if (!legacy) valid(value.protocolVersion === 1 && value.historyLimit === 100);
  const rules = value.rules.map(row => legacy ? Object.freeze({ state: 'legacy', headRevision: 0, ruleVersion: 0, rule: legacyRule(row) }) : parseAlertRule(row));
  const events = value.events.map(row => parseAlertEvent(row, { legacy }));
  valid(new Set(rules.map(row => row.state === 'legacy' ? row.rule.id : row.id)).size === rules.length && new Set(events.map(row => row.id)).size === events.length);
  return Object.freeze({ ...connection, protocolVersion: legacy ? 0 : 1, mode: legacy ? 'legacy-read-only' : 'ready',
    historyLimit: legacy ? 200 : 100, rules: Object.freeze(rules), events: Object.freeze(events) });
}
export function captureAlertCommand(input) {
  exactObject(input, ['expectedRevision', 'command']); const supplied = exactObject(input.command, ['kind', 'config', 'enabled']);
  let command;
  if (supplied.kind === 'edit' || supplied.kind === 'enroll') {
    exactObject(supplied, ['kind', 'config']); command = Object.freeze({ kind: supplied.kind, config: canonicalRule(supplied.config) });
  } else if (supplied.kind === 'set-enabled') {
    exactObject(supplied, ['kind', 'enabled']); if (typeof supplied.enabled !== 'boolean') fail('ALERT_INPUT_INVALID');
    command = Object.freeze({ kind: supplied.kind, enabled: supplied.enabled });
  } else if (supplied.kind === 'recover') { exactObject(supplied, ['kind']); command = Object.freeze({ kind: 'recover' }); }
  else fail('ALERT_INPUT_INVALID');
  return Object.freeze({ expectedRevision: revision(input.expectedRevision, command.kind === 'enroll'), command });
}
export function createPriceAlertProtocolClient({ request, access } = {}) {
  if (typeof request !== 'function' || typeof access?.capture !== 'function' || typeof access?.isCurrent !== 'function') throw new TypeError('Explicit request and opaque access adapters required');
  let mode = 'unavailable'; let sequence = 0; let connected = null; let disposed = false; let transferReady = false; let archiveReady = false;
  function capture() {
    const ticket = access.capture();
    if (disposed || !ticket || typeof ticket !== 'object' || !Object.isFrozen(ticket) || access.isCurrent(ticket) !== true) fail('ALERT_ACCESS_STALE', 409);
    return ticket;
  }
  function current(ticket, expectedSequence) { if (disposed || sequence !== expectedSequence || access.isCurrent(ticket) !== true) fail('ALERT_ACCESS_STALE', 409); }
  async function call(method, path, input, { discovery = false, legacy = false } = {}) {
    const ticket = capture(); const started = sequence;
    if (!discovery && connected && access.isCurrent(connected) !== true) fail('ALERT_ACCESS_STALE', 409);
    if (!discovery && (!connected || mode !== (legacy ? 'legacy-read-only' : 'ready'))) fail('ALERT_PROTOCOL_UNAVAILABLE', 409);
    const body = input === undefined ? undefined : JSON.stringify(input);
    const transfer = [`${V1}/transfer`, `${V1}/transfer/preview`, `${V1}/transfer/apply`].includes(path);
    if (transfer && !transferReady) fail('ALERT_TRANSFER_UNAVAILABLE', 409);
    if (isPriceAlertArchivePath(path) && !archiveReady) fail('ALERT_ARCHIVE_UNAVAILABLE', 409);
    if (body !== undefined && new TextEncoder().encode(body).byteLength > (transfer ? ALERT_TRANSFER_LIMITS.bodyBytes : RULE_LIMITS.bodyBytes)) fail('ALERT_BODY_LIMIT', 413);
    let response;
    try { response = await request({ method, path, ...(body === undefined ? {} : { body }) }); }
    catch { current(ticket, started); fail('ALERT_TRANSPORT_UNAVAILABLE', 503); }
    current(ticket, started);
    if (!response || !Number.isInteger(response.status) || response.status < 200 || response.status >= 300) {
      const code = response?.payload?.code;
      fail(typeof code === 'string' && /^(?:ALERT|RELAY)_[A-Z0-9_]{1,56}$/u.test(code) ? code : 'ALERT_TRANSPORT_UNAVAILABLE', response?.status ?? 503);
    }
    return response.payload?.data;
  }
  async function connect() {
    const started = ++sequence; mode = 'unavailable'; connected = null; transferReady = false; archiveReady = false; const ticket = capture();
    try {
      const result = parseAlertCapability(await call('GET', V1, undefined, { discovery: true })); current(ticket, started);
      connected = ticket; mode = 'ready'; transferReady = result.capabilities.includes('rule-transfer'); archiveReady = result.capabilities.includes('rule-archive'); return Object.freeze({ mode, ...result });
    } catch (error) {
      current(ticket, started);
      if (error.statusCode === 404 || ['ALERT_PROTOCOL_UNAVAILABLE', 'ALERT_RESPONSE_INVALID'].includes(error.code)) {
        connected = ticket; mode = 'legacy-read-only'; return Object.freeze({ mode, protocolVersion: 0 });
      }
      throw error;
    }
  }
  async function snapshot() {
    const legacy = mode === 'legacy-read-only';
    return parseAlertSnapshot(await call('GET', legacy ? '/api/alerts' : `${V1}/rules`, undefined, { legacy }), { legacy });
  }
  async function readRule(idInput) { const id = ruleId(idInput); return parseAlertRule(await call('GET', `${V1}/rules/${id}`), id); }
  async function create(input) {
    const config = canonicalRule(input); const data = parseAlertRule(await call('POST', `${V1}/rules`, { config }));
    valid(data.state === 'paused' && data.headRevision === 1 && data.ruleVersion === 1 && same(data.config, config)); return data;
  }
  async function command(idInput, input) {
    const id = ruleId(idInput); const captured = captureAlertCommand(input); const intent = captured.command;
    const data = parseAlertRule(await call('POST', `${V1}/rules/${id}/commands`, captured), id);
    valid(['active', 'paused'].includes(data.state) && data.headRevision === captured.expectedRevision + (data.changed === false ? 0 : 1));
    if (intent.kind === 'edit' || intent.kind === 'enroll') valid(same(data.config, intent.config) && (data.changed === false || data.state === 'paused'));
    else if (intent.kind === 'set-enabled') valid(data.enabled === intent.enabled);
    else valid(data.state === 'paused');
    return data;
  }
  async function markRead(idInput) {
    const id = ruleId(idInput); const data = object(await call('POST', `/api/alerts/events/${id}/read`, {}));
    if (data.read === null) return null; const event = parseAlertEvent(data.read); valid(event.id === id && event.readAt !== null); return event;
  }
  async function transferSnapshot() { return validatePriceRulesSnapshot(await call('GET', `${V1}/transfer`)); }
  async function transferPreview(before, file, choices) {
    before = validatePriceRulesSnapshot(before);
    const command = priceRulesCommand(before, file, choices);
    return validatePriceRulesPreview(await call('POST', `${V1}/transfer/preview`, command), before, command.file, command.choices);
  }
  async function transferApply(before, file, choices, previewToken) {
    before = validatePriceRulesSnapshot(before);
    const command = priceRulesCommand(before, file, choices, previewToken);
    return validatePriceRulesApplied(await call('POST', `${V1}/transfer/apply`, command), before, command.file, command.choices);
  }
  async function archiveStart() { return validateArchiveStart(await call('GET', priceAlertArchivePath())); }
  async function archivePart(cursor, header) { header=validateArchiveHeader(header);return validateArchivePart(await call('GET', priceAlertArchivePath(cursor)),header); }
  async function archiveDownload({isCurrent=()=>true,onProgress=()=>{}}={}) {
    const ticket=capture(),started=sequence;
    const check=()=>{current(ticket,started);if(!isCurrent())fail('ALERT_ARCHIVE_CANCELLED',409);};
    check();const start=await archiveStart();check();const writer=createArchiveDownload(start);
    onProgress({counts:writer.counts,total:{...start.header.counts}});check();
    while(writer.cursor){const part=await archivePart(writer.cursor,start.header);check();writer.append(part);onProgress({counts:writer.counts,total:{...start.header.counts}});check();}
    const result=writer.finish();check();return result;
  }
  return Object.freeze({ connect, snapshot, readRule, create, command, markRead, transferSnapshot, transferPreview, transferApply, archiveStart, archivePart, archiveDownload,
    get transferAvailable() { return transferReady && !disposed && connected && access.isCurrent(connected) === true; },
    get archiveAvailable() { return archiveReady && !disposed && connected && access.isCurrent(connected) === true; },
    dispose() { disposed = true; sequence++; connected = null; mode = 'unavailable'; },
    get mode() { return !disposed && connected && access.isCurrent(connected) === true ? mode : 'unavailable'; } });
}
