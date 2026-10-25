// Pure schema shared by the proposed relay/store boundary. No market-data engine.
export const RULE_LIMITS = Object.freeze({ versions: 64, bodyBytes: 4096, cooldownSeconds: 86400, recoveryBytes: 12288 });
export class RuleError extends Error {
  constructor(code, status = 400) { super(code); this.name = 'RuleError'; this.code = code; this.status = this.statusCode = status; }
}
export function fail(code, status) { throw new RuleError(code, status); }
export function exactObject(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Object.keys(value).some(key => !keys.includes(key))) fail('ALERT_INPUT_INVALID');
  return value;
}
export function decimal(value) {
  if (typeof value !== 'string' || !/^\d{1,24}(?:\.\d{1,9})?$/u.test(value)) fail('ALERT_PRICE_INVALID');
  const [a, b = ''] = value.split('.');
  const whole = a.replace(/^0+(?=\d)/u, ''); const fraction = b.replace(/0+$/u, '');
  if (whole === '0' && !fraction) fail('ALERT_PRICE_INVALID');
  return fraction ? `${whole}.${fraction}` : whole;
}
export function nanos(value) { const [a, b = ''] = decimal(value).split('.'); return BigInt(a) * 1000000000n + BigInt(b.padEnd(9, '0')); }
export function utc(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(value)) fail('ALERT_TIME_INVALID');
  const ms = Date.parse(value);
  const expected = value.includes('.') ? value.replace(/\.(\d{1,3})Z$/u, (_, digits) => `.${digits.padEnd(3, '0')}Z`) : value.replace('Z', '.000Z');
  if (!Number.isFinite(ms) || new Date(ms).toISOString() !== expected) fail('ALERT_TIME_INVALID');
  return expected;
}
export function label(value, field) {
  if (typeof value !== 'string' || value.length > 64) fail('ALERT_MARKET_INVALID');
  const result = value.trim().toUpperCase();
  if (!(field === 'symbol' ? /^[A-Z0-9][A-Z0-9._!\/-]{0,63}$/u : /^[A-Z0-9][A-Z0-9._-]{0,31}$/u).test(result)) fail('ALERT_MARKET_INVALID');
  return result;
}
export function ruleId(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)) fail('ALERT_ID_INVALID');
  return value.toLowerCase();
}
export function revision(value, allowZero = false) {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1) || value >= Number.MAX_SAFE_INTEGER) fail('ALERT_REVISION_INVALID');
  return value;
}
export function scopeValues({ organizationId, productId, userId }) {
  const values = [organizationId, productId, userId];
  if (values.some(value => typeof value !== 'string' || !value.trim() || value.length > 128 || /[\u0000-\u001f\u007f]/u.test(value))) fail('ALERT_SCOPE_INVALID');
  return Object.freeze(values);
}
export function canonicalRule(input) {
  exactObject(input, ['schemaVersion', 'source', 'subject', 'condition', 'targetPrice', 'intent', 'note', 'cooldownSeconds', 'expiresAt', 'deliverTelegram', 'evaluationClock']);
  if (input.schemaVersion !== 1) fail('ALERT_SCHEMA_UNSUPPORTED');
  exactObject(input.subject, ['symbol', 'exchange']);
  if (input.source !== 'tradingview' || input.evaluationClock !== 'source-event-arrival'
    || !['above', 'below', 'crossing'].includes(input.condition) || !['buy', 'sell', 'watch'].includes(input.intent)
    || typeof input.deliverTelegram !== 'boolean' || !Number.isInteger(input.cooldownSeconds)
    || input.cooldownSeconds < 0 || input.cooldownSeconds > RULE_LIMITS.cooldownSeconds
    || typeof input.note !== 'string' || input.note.length > 1000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(input.note)) fail('ALERT_RULE_INVALID');
  const result = Object.freeze({ schemaVersion: 1, source: 'tradingview',
    subject: Object.freeze({ exchange: label(input.subject.exchange, 'exchange'), symbol: label(input.subject.symbol, 'symbol') }),
    condition: input.condition, targetPrice: decimal(input.targetPrice), intent: input.intent, note: input.note,
    cooldownSeconds: input.cooldownSeconds, expiresAt: input.expiresAt === null ? null : utc(input.expiresAt),
    deliverTelegram: input.deliverTelegram, evaluationClock: 'source-event-arrival' });
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > RULE_LIMITS.bodyBytes) fail('ALERT_BODY_LIMIT');
  return result;
}
export function webhook(input) {
  exactObject(input, ['ruleVersion', 'symbol', 'exchange', 'price', 'sourceTime', 'source']);
  if (!Number.isInteger(input.ruleVersion) || input.ruleVersion < 1 || input.ruleVersion > RULE_LIMITS.versions) fail('ALERT_VERSION_REQUIRED');
  if (input.source !== undefined && input.source !== 'tradingview') fail('ALERT_INPUT_INVALID');
  return Object.freeze({ ruleVersion: input.ruleVersion, symbol: label(input.symbol, 'symbol'), exchange: label(input.exchange, 'exchange'), price: decimal(input.price), sourceTime: utc(input.sourceTime) });
}
export function decide({ config, event, receivedAt, activatedAt, cooldown = null, maxEventAgeMs = 86400000, maxFutureSkewMs = 60000 }) {
  config = canonicalRule(config); event = webhook(event);
  if (!Number.isInteger(maxEventAgeMs) || maxEventAgeMs < 1000 || maxEventAgeMs > 7 * 86400000
    || !Number.isInteger(maxFutureSkewMs) || maxFutureSkewMs < 0 || maxFutureSkewMs > 300000) fail('ALERT_TIME_WINDOW_INVALID');
  if (cooldown !== null) {
    exactObject(cooldown, ['lastReceivedAt', 'nextAllowedAt']);
    if (Date.parse(utc(cooldown.nextAllowedAt)) < Date.parse(utc(cooldown.lastReceivedAt))) fail('ALERT_COOLDOWN_CORRUPT', 409);
  }
  const now = Date.parse(utc(receivedAt)); const source = Date.parse(event.sourceTime);
  if (event.symbol !== config.subject.symbol || event.exchange !== config.subject.exchange) fail('ALERT_MARKET_MISMATCH');
  if (now - source > maxEventAgeMs || source - now > maxFutureSkewMs) fail('ALERT_TIME_OUT_OF_WINDOW');
  if (source < Date.parse(utc(activatedAt))) fail('ALERT_BEFORE_ACTIVATION');
  if (config.expiresAt !== null && now >= Date.parse(config.expiresAt)) fail('ALERT_EXPIRED');
  if (config.condition === 'above' && nanos(event.price) < nanos(config.targetPrice)
    || config.condition === 'below' && nanos(event.price) > nanos(config.targetPrice)) fail('ALERT_CONDITION_NOT_MET');
  if (cooldown && now < Date.parse(utc(cooldown.lastReceivedAt))) fail('ALERT_CLOCK_REGRESSION');
  const suppressed = cooldown !== null && now < Date.parse(utc(cooldown.nextAllowedAt));
  return Object.freeze({ state: suppressed ? 'cooldown-suppressed' : 'accepted', lastReceivedAt: receivedAt,
    nextAllowedAt: suppressed ? cooldown.nextAllowedAt : utc(new Date(now + config.cooldownSeconds * 1000).toISOString()) });
}
