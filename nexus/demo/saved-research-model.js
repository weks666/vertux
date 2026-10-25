// Shared pure model. Storage, authenticated ownership and navigation stay outside.
export const SAVED_RESEARCH_LIMITS = Object.freeze({ records: 20, pins: 3, bytes: 65536 });
export const SAVED_RESEARCH_COMMAND_BYTES = SAVED_RESEARCH_LIMITS.bytes + 1024;
export const SAVED_RESEARCH_TABS = Object.freeze(['price', 'risk', 'performance', 'financials', 'seasonality', 'technical', 'profile']);
const namespaces = new Set(['tinvest:broker', 'bybit:spot', 'binance:spot']);
const guardKeys = Object.freeze([
  'assetType', 'currency', 'priceUnit', 'assetUid', 'figi', 'isin', 'classCode',
  'exchange', 'realExchange', 'expirationDate', 'lastTradeDate', 'futuresType', 'basicAsset', 'underlyingType',
]);
const entryKeys = ['id', 'title', 'target', 'analysisTab', 'instrumentRef', 'identityGuards', 'createdAt', 'updatedAt', 'pinOrder'];
const clone = value => structuredClone(value);
const fail = (state, code, path = '') => ({ ok: false, state, error: { code, path } });
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value, maximum) => typeof value === 'string' && value.length > 0 && value.length <= maximum
  && value === value.trim() && !/[\u0000-\u001f\u007f]/u.test(value);
const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/u.test(value);
const timestamp = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const sameRef = (left, right) => left?.namespace === right?.namespace && left?.instrumentUid === right?.instrumentUid;
const known = value => typeof value === 'string' && value !== ''
  && !/(?:^|[_ -])(?:unknown|unspecified|undefined|not[_ -]?defined)(?:$|[_ -])/iu.test(value);

// Inspect descriptors before reading properties: input is JSON, never an object
// with getters, prototypes, sparse arrays, custom toJSON or non-finite values.
function boundedJson(value, byteLimit = SAVED_RESEARCH_LIMITS.bytes) {
  let nodes = 0;
  const ancestors = new Set();
  function visit(item, path, depth) {
    if (++nodes > 4096 || depth > 8) return fail('corrupt', 'json-limit', path);
    if (item === null || typeof item === 'boolean') return null;
    if (typeof item === 'number') return Number.isSafeInteger(item) ? null : fail('corrupt', 'json-number', path);
    if (typeof item === 'string') return item.length <= 1024 ? null : fail('corrupt', 'json-string-limit', path);
    if (typeof item !== 'object') return fail('corrupt', 'not-json', path);
    if (ancestors.has(item)) return fail('corrupt', 'json-cycle', path);
    const array = Array.isArray(item), prototype = Object.getPrototypeOf(item);
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) return fail('corrupt', 'not-json', path);
    const keys = Reflect.ownKeys(item);
    if (keys.some(key => typeof key !== 'string')) return fail('corrupt', 'not-json', path);
    if (array && (item.length > 64 || keys.length !== item.length + 1)) return fail('corrupt', 'json-array-limit', path);
    if (!array && keys.length > 32) return fail('corrupt', 'json-key-limit', path);
    ancestors.add(item);
    for (const key of keys) {
      if (array && key === 'length') continue;
      if (array && !/^(?:0|[1-9]\d*)$/u.test(key)) return fail('corrupt', 'not-json', path);
      const descriptor = Object.getOwnPropertyDescriptor(item, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) return fail('corrupt', 'not-json', path);
      if (!array && (!/^[a-zA-Z][a-zA-Z0-9]{0,39}$/u.test(key) || ['constructor', 'prototype'].includes(key))) return fail('corrupt', 'json-key', path);
      const error = visit(descriptor.value, `${path}/${key}`, depth + 1);
      if (error) return error;
    }
    ancestors.delete(item);
    return null;
  }
  try {
    const error = visit(value, '', 0);
    if (error) return error;
    return new TextEncoder().encode(JSON.stringify(value)).length <= byteLimit ? null : fail('corrupt', 'json-byte-limit');
  } catch { return fail('corrupt', 'not-json'); }
}

function shape(value, required, path) {
  if (!record(value)) return fail('corrupt', 'invalid-object', path);
  for (const key of Object.keys(value)) if (!required.includes(key)) return fail('corrupt', 'unknown-key', path);
  for (const key of required) if (!Object.hasOwn(value, key)) return fail('corrupt', 'missing-key', `${path}/${key}`);
  return null;
}

function checkRef(value, path) {
  return shape(value, ['namespace', 'instrumentUid'], path)
    || (!namespaces.has(value.namespace) || typeof value.instrumentUid !== 'string' || !/^[A-Za-z0-9._:@/-]{1,160}$/u.test(value.instrumentUid)
      ? fail('corrupt', 'invalid-reference', path) : null);
}

function checkGuards(value, path) {
  if (!record(value)) return fail('corrupt', 'invalid-guards', path);
  for (const [key, item] of Object.entries(value)) {
    if (!guardKeys.includes(key)) return fail('corrupt', 'unknown-key', path);
    if (!text(item, 256) || !known(item)) return fail('corrupt', 'invalid-guard', `${path}/${key}`);
    if (/Date$/u.test(key) && !timestamp(item)) return fail('corrupt', 'invalid-guard', `${path}/${key}`);
    if (key === 'currency' && !/^[A-Z]{3,8}$/u.test(item)) return fail('corrupt', 'invalid-guard', `${path}/${key}`);
    if (key === 'assetType' && !['share', 'future', 'bond', 'etf', 'currency', 'crypto'].includes(item)) return fail('corrupt', 'invalid-guard', `${path}/${key}`);
  }
  return null;
}

function checkEntry(entry, path = '/entry') {
  const error = shape(entry, entryKeys, path);
  if (error) return error;
  if (!id(entry.id)) return fail('corrupt', 'invalid-id', `${path}/id`);
  if (!text(entry.title, 120)) return fail('corrupt', 'invalid-title', `${path}/title`);
  if (entry.target !== 'research.instrument' || !SAVED_RESEARCH_TABS.includes(entry.analysisTab)) return fail('corrupt', 'invalid-target', path);
  if (!timestamp(entry.createdAt) || !timestamp(entry.updatedAt) || entry.updatedAt < entry.createdAt) return fail('corrupt', 'invalid-timestamp', path);
  if (entry.pinOrder !== null && (!Number.isSafeInteger(entry.pinOrder) || entry.pinOrder < 0 || entry.pinOrder >= SAVED_RESEARCH_LIMITS.pins)) return fail('corrupt', 'invalid-pin', `${path}/pinOrder`);
  return checkRef(entry.instrumentRef, `${path}/instrumentRef`) || checkGuards(entry.identityGuards, `${path}/identityGuards`);
}

export function validateSavedResearchDocument(value) {
  const jsonError = boundedJson(value);
  if (jsonError) return jsonError;
  if (!record(value)) return fail('corrupt', 'invalid-document');
  // Never reinterpret a different schema as an empty v1 document.
  if (Number.isSafeInteger(value.schemaVersion) && value.schemaVersion !== 1) return fail('unsupported-version', 'unsupported-version', '/schemaVersion');
  const error = shape(value, ['schemaVersion', 'entries'], '');
  if (error) return error;
  if (value.schemaVersion !== 1 || !Array.isArray(value.entries)) return fail('corrupt', 'invalid-document');
  if (value.entries.length > SAVED_RESEARCH_LIMITS.records) return fail('corrupt', 'record-limit', '/entries');
  const ids = new Set(), pins = [];
  for (const [index, entry] of value.entries.entries()) {
    const entryError = checkEntry(entry, `/entries/${index}`);
    if (entryError) return entryError;
    if (ids.has(entry.id)) return fail('corrupt', 'duplicate-id', `/entries/${index}/id`);
    ids.add(entry.id);
    if (entry.pinOrder !== null) pins.push(entry.pinOrder);
  }
  if (pins.length > SAVED_RESEARCH_LIMITS.pins || pins.sort((a, b) => a - b).some((pin, index) => pin !== index)) return fail('corrupt', 'invalid-pin-order', '/entries');
  return { ok: true, state: 'valid', document: clone(value) };
}

export function migrateSavedResearchDocument(value) {
  const result = validateSavedResearchDocument(value);
  return result.ok ? { ...result, migrated: false } : result;
}

function currentReference(ref, environment) {
  if (!text(environment?.currentScope, 4096) || typeof environment.resolve !== 'function') return fail('unavailable', 'current-context-required');
  let resolved;
  try { resolved = environment.resolve(clone(ref)); } catch { return fail('unavailable', 'resolver-failed'); }
  if (!resolved || resolved.scopeKey !== environment.currentScope) return fail('scope-changed', 'scope-changed');
  if (resolved.resolution === 'ambiguous') return fail('ambiguous', 'instrument-ambiguous');
  if (resolved.resolution === 'scoped-legacy') return fail('unverified-origin', 'origin-unverified');
  if (resolved.resolution !== 'exact' || !resolved.meta) return fail('missing', 'instrument-unavailable');
  if (!sameRef(ref, resolved.ref) || resolved.meta.instrumentUid !== ref.instrumentUid) return fail('changed-identity', 'reference-mismatch');
  if (resolved.revision !== undefined && (!Number.isSafeInteger(resolved.revision) || resolved.revision < 0)) return fail('unavailable', 'invalid-context-revision');
  if (typeof environment.canResearch !== 'function') return fail('forbidden', 'research-permission-required');
  try { if (environment.canResearch(clone(resolved)) !== true) return fail('forbidden', 'research-not-permitted'); }
  catch { return fail('forbidden', 'research-permission-unavailable'); }
  return { ok: true, resolved };
}

export function resolveRestoreIntent(entry, environment) {
  const error = boundedJson(entry) || checkEntry(entry);
  if (error) return error;
  const current = currentReference(entry.instrumentRef, environment);
  if (!current.ok) return current;
  for (const [key, value] of Object.entries(entry.identityGuards)) {
    const actual = current.resolved.meta[key];
    if (!known(actual)) return fail('identity-unverified', 'guard-unavailable', `/identityGuards/${key}`);
    if (actual !== value) return fail('changed-identity', 'guard-changed', `/identityGuards/${key}`);
  }
  return { ok: true, state: 'ready', intent: {
    savedResearchId: entry.id, target: entry.target, analysisTab: entry.analysisTab,
    instrumentRef: clone(current.resolved.ref), scopeKey: current.resolved.scopeKey,
    contextRevision: current.resolved.revision ?? null,
  } };
}

const commandKeys = {
  create: ['type', 'title', 'instrumentRef', 'analysisTab'], rename: ['type', 'id', 'title'],
  remove: ['type', 'id'], pin: ['type', 'id', 'enabled'], reorder: ['type', 'ids'],
  import: ['type', 'document', 'expectedOwnerScope'],
};

// User-authored navigation identity only. Export IDs/times/pins never identify
// an existing local row for overwrite or become trusted source provenance.
export function savedResearchSemanticKey(entry) {
  return JSON.stringify([entry.title,entry.target,entry.analysisTab,entry.instrumentRef.namespace,entry.instrumentRef.instrumentUid,
    Object.keys(entry.identityGuards).sort().map(key=>[key,entry.identityGuards[key]])]);
}

export function applySavedResearchCommand(value, command, environment = {}) {
  const validated = validateSavedResearchDocument(value);
  if (!validated.ok) return validated;
  const commandError = boundedJson(command,SAVED_RESEARCH_COMMAND_BYTES);
  if (commandError) return { ...commandError, state: 'invalid-command' };
  if (!record(command) || typeof command.type !== 'string' || !Object.hasOwn(commandKeys, command.type)) return fail('invalid-command', 'unknown-command');
  const shapeError = shape(command, commandKeys[command.type], '/command');
  if (shapeError) return { ...shapeError, state: 'invalid-command' };
  if (Object.hasOwn(command, 'id') && !id(command.id)) return fail('invalid-command', 'invalid-id', '/command/id');
  const document = validated.document, entries = document.entries;
  const entry = entries.find(item => item.id === command.id);
  if (!['create', 'reorder', 'import'].includes(command.type) && !entry) return fail('missing-entry', 'entry-not-found');
  if (['create', 'rename'].includes(command.type) && !text(command.title, 120)) return fail('invalid-command', 'invalid-title', '/command/title');
  let now;
  try { now = typeof environment.now === 'function' ? environment.now() : environment.now; }
  catch { return fail('unavailable', 'clock-unavailable'); }
  if (!timestamp(now)) return fail('invalid-command', 'clock-required');
  const touched = new Set();
  const pinEntries = () => entries.filter(item => item.pinOrder !== null).sort((a, b) => a.pinOrder - b.pinOrder);
  function setPin(item, order) {
    if (item.pinOrder !== order) { item.pinOrder = order; touched.add(item); }
  }
  let importSummary;
  if (command.type === 'import') {
    if(typeof command.expectedOwnerScope!=='string'||!/^[A-Za-z0-9_-]{1,128}$/u.test(command.expectedOwnerScope)
      ||command.expectedOwnerScope!==environment.ownerScope)return fail('scope-changed','scope-changed');
    const incoming=validateSavedResearchDocument(command.document);if(!incoming.ok)return incoming;
    const seen=new Set(entries.map(savedResearchSemanticKey)),added=[];
    for(const item of incoming.document.entries){const key=savedResearchSemanticKey(item);if(seen.has(key))continue;seen.add(key);added.push(item);}
    if(entries.length+added.length>SAVED_RESEARCH_LIMITS.records)return fail('limit','record-limit');
    const priorPins=pinEntries().length,pinned=added.filter(item=>item.pinOrder!==null).sort((a,b)=>a.pinOrder-b.pinOrder);
    const assigned=new Map(pinned.slice(0,SAVED_RESEARCH_LIMITS.pins-priorPins).map((item,index)=>[item,priorPins+index]));
    for(const item of added){let generatedId;try{generatedId=environment.idFactory?.();}catch{return fail('unavailable','id-factory-failed');}
      if(!id(generatedId))return fail('invalid-command','id-factory-required');
      if(entries.some(row=>row.id===generatedId))return fail('conflict','duplicate-id');
      const imported={...item,id:generatedId,createdAt:now,updatedAt:now,pinOrder:assigned.get(item)??null};entries.push(imported);touched.add(imported);
    }
    importSummary={added:added.length,duplicates:incoming.document.entries.length-added.length,pinned:assigned.size,unpinned:pinned.length-assigned.size};
  } else if (command.type === 'create') {
    if (entries.length >= SAVED_RESEARCH_LIMITS.records) return fail('limit', 'record-limit');
    const refError = checkRef(command.instrumentRef, '/command/instrumentRef');
    if (refError) return { ...refError, state: 'invalid-command' };
    if (!SAVED_RESEARCH_TABS.includes(command.analysisTab)) return fail('invalid-command', 'invalid-target', '/command/analysisTab');
    const current = currentReference(command.instrumentRef, environment);
    if (!current.ok) return current;
    let generatedId;
    try { generatedId = typeof environment.idFactory === 'function' ? environment.idFactory() : null; }
    catch { return fail('unavailable', 'id-factory-failed'); }
    if (!id(generatedId)) return fail('invalid-command', 'id-factory-required');
    if (entries.some(item => item.id === generatedId)) return fail('conflict', 'duplicate-id');
    const identityGuards = Object.fromEntries(guardKeys.filter(key => known(current.resolved.meta[key])).map(key => [key, current.resolved.meta[key]]));
    const guardError = checkGuards(identityGuards, '/identityGuards');
    if (guardError) return fail('identity-unverified', 'current-identity-invalid', guardError.error.path);
    const created = { id: generatedId, title: command.title, target: 'research.instrument', analysisTab: command.analysisTab,
      instrumentRef: clone(current.resolved.ref), identityGuards, createdAt: now, updatedAt: now, pinOrder: null };
    entries.push(created); touched.add(created);
  } else if (command.type === 'rename') {
    if (entry.title !== command.title) { entry.title = command.title; touched.add(entry); }
  } else if (command.type === 'remove') {
    if (now < entry.updatedAt) return fail('invalid-command', 'clock-regressed');
    entries.splice(entries.indexOf(entry), 1);
    pinEntries().forEach((item, index) => setPin(item, index));
  } else if (command.type === 'pin') {
    if (typeof command.enabled !== 'boolean') return fail('invalid-command', 'invalid-pin');
    if (command.enabled && entry.pinOrder === null) {
      const pins = pinEntries();
      if (pins.length >= SAVED_RESEARCH_LIMITS.pins) return fail('limit', 'pin-limit');
      setPin(entry, pins.length);
    } else if (!command.enabled && entry.pinOrder !== null) {
      setPin(entry, null);
      pinEntries().forEach((item, index) => setPin(item, index));
    }
  } else {
    const pins = pinEntries();
    if (!Array.isArray(command.ids) || command.ids.length !== pins.length || new Set(command.ids).size !== pins.length
      || command.ids.some(value => !id(value) || !pins.some(item => item.id === value))) return fail('invalid-command', 'invalid-pin-order');
    command.ids.forEach((value, index) => setPin(entries.find(item => item.id === value), index));
  }
  for (const item of touched) {
    if (now < item.updatedAt) return fail('invalid-command', 'clock-regressed');
    item.updatedAt = now;
  }
  const result = validateSavedResearchDocument(document);
  return result.ok ? { ...result, changed: touched.size > 0 || command.type === 'remove', ...(importSummary?{importSummary}:{}) } : result;
}
