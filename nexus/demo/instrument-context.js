import {catalogIdentityForDisplay,catalogLinksForInstrument} from './instrument-catalog-links.js';
const namespaces = new Map([
  ['tinvest:broker', { provider: 'tinvest', market: 'broker' }],
  ['bybit:spot', { provider: 'bybit', market: 'spot' }],
  ['binance:spot', { provider: 'binance', market: 'spot' }],
]);
const legacyNamespace = 'scoped-legacy';
const metadataFields = [
  'ticker', 'name', 'assetType', 'currency', 'priceUnit', 'assetUid', 'figi', 'isin',
  'classCode', 'exchange', 'realExchange', 'expirationDate', 'lastTradeDate',
  'firstTradeDate', 'futuresType', 'basicAsset', 'underlyingType', 'logoName',
  'minPriceIncrementNanos', 'basicAssetSizeNanos', 'nominalNanos', 'nominalCurrency',
  'aciValueNanos', 'aciValueCurrency', 'maturityDate', 'placementDate', 'sector', 'countryOfRisk',
  'countryOfRiskName', 'tradingStatus', 'shareType', 'sessionLabel', 'url',
];
const conflictingFields = new Set([
  'assetType', 'currency', 'priceUnit', 'assetUid', 'figi', 'isin',
  'classCode', 'exchange', 'realExchange', 'expirationDate', 'lastTradeDate',
  'futuresType', 'basicAsset', 'underlyingType',
]);
const clean = value => typeof value === 'string' ? value.trim() : '';
const validUid = value => typeof value === 'string' && /^[A-Za-z0-9._:@/-]{1,160}$/u.test(value) ? value : null;
const clone = value => structuredClone(value);
const assetType = value => ({ futures: 'future', shares: 'share', bonds: 'bond' })[clean(value)] || clean(value);
const meaningful = value => value != null && value !== '' && value !== 'unknown';
const unknownVenue = value => /(?:unspecified|unknown|undefined|not[_ -]?defined)/iu.test(value);
const sorted = value => Array.isArray(value) ? value.map(sorted) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])])) : value;
const canonical = value => JSON.stringify(sorted(value));

function originFor(meta) {
  const origin = meta?.instrumentOrigin;
  const namespace = origin && `${origin.provider}:${origin.market}`;
  return namespaces.has(namespace) ? namespace : legacyNamespace;
}

function reference(value) {
  if (typeof value === 'string') {
    const instrumentUid = validUid(value);
    return instrumentUid ? { namespace: legacyNamespace, instrumentUid } : null;
  }
  const supplied = value?.ref || value;
  const instrumentUid = validUid(supplied?.instrumentUid || supplied?.instrument_uid);
  if (!instrumentUid) return null;
  const namespace = Object.hasOwn(supplied, 'namespace') ? clean(supplied.namespace) || 'unsupported' : originFor(value);
  return { namespace, instrumentUid };
}

// Keep a closed display contract from the catalog only. Portfolio rows and a
// user selection cannot supply issue terms or arbitrary nested metadata.
function catalogBondTerms(value) {
 if(value?.contractVersion!=='bond-issue-terms-v1')return {contractVersion:'unsupported-bond-issue-terms'};
 const result={contractVersion:'bond-issue-terms-v1'};
 for(const key of ['nominal','initialNominal','accruedInterest']){
  const item=value[key];
  if(item?.state==='absent'){result[key]={state:'absent',amountNanos:null,currency:null};continue;}
  const valid=item?.state==='present'&&typeof item.amountNanos==='string'&&/^-?\d{1,29}$/u.test(item.amountNanos);
  result[key]=valid?{state:'present',amountNanos:item.amountNanos,currency:typeof item.currency==='string'&&/^[A-Z]{3}$/u.test(item.currency)?item.currency:null}:{state:'invalid',amountNanos:null,currency:null};
 }
 for(const key of ['floatingCoupon','amortizing','perpetual','subordinated']){
  const item=value[key],valid=item?.state==='present'&&typeof item.value==='boolean';
  result[key]=valid?{state:'present',value:item.value}:{state:item?.state==='absent'?'absent':'invalid',value:null};
 }
 return result;
}
function catalogFutureTerms(value) {
 if(value?.contractVersion!=='future-contract-terms-v1')return {contractVersion:'unsupported-future-contract-terms'};
 const result={contractVersion:'future-contract-terms-v1'};
 for(const key of ['step','stepAmount','marginBuy','marginSell']){
  const item=value[key],money=key.startsWith('margin');
  const valid=item?.state==='present'&&typeof item.amountNanos==='string'&&/^-?\d{1,29}$/u.test(item.amountNanos);
  result[key]={state:valid?'present':item?.state==='absent'?'absent':'invalid',amountNanos:valid?item.amountNanos:null,
   ...(money?{currency:valid&&typeof item.currency==='string'&&/^[A-Z]{3}$/u.test(item.currency)?item.currency:null}:{})};
 }
 return result;
}
function normalizedMeta(row, includeCatalogTerms=false) {
  const instrumentUid = validUid(row?.instrumentUid || row?.instrument_uid);
  if (!instrumentUid) return null;
  const meta = { instrumentUid };
  for (const key of metadataFields) {
    const raw = key === 'assetType' ? row.assetType ?? row.asset_type : row[key];
    let value = key === 'assetType' ? assetType(raw) : clean(raw);
    if (['currency', 'nominalCurrency', 'aciValueCurrency'].includes(key)) value = value.toUpperCase();
    if (['exchange', 'realExchange'].includes(key) && unknownVenue(value)) value = '';
    if (/Date$/u.test(key)) value = value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : '';
    if (meaningful(value)) meta[key] = value;
  }
  for (const key of ['lot', 'couponQuantityPerYear']) if (Number.isSafeInteger(row[key]) && row[key] >= 0) meta[key] = row[key];
  for (const key of ['apiTradeAvailableFlag', 'buyAvailableFlag', 'sellAvailableFlag', 'shortEnabledFlag', 'publicMarketData']) {
    if (typeof row[key] === 'boolean') meta[key] = row[key];
  }
  if(includeCatalogTerms&&Object.hasOwn(row,'catalogIdentity'))meta.catalogIdentity=catalogIdentityForDisplay(row);
  if(includeCatalogTerms&&meta.assetType==='bond'&&Object.hasOwn(row,'bondIssueTerms'))meta.bondIssueTerms=catalogBondTerms(row.bondIssueTerms);
  if(includeCatalogTerms&&meta.assetType==='future'){
   if(Object.hasOwn(row,'futureContractTerms'))meta.futureContractTerms=catalogFutureTerms(row.futureContractTerms);
   const source=row.futureContractSource;
   if(source?.kind==='catalog')meta.futureContractSource={kind:'catalog',capturedAt:typeof source.capturedAt==='string'&&Number.isFinite(Date.parse(source.capturedAt))?new Date(source.capturedAt).toISOString():null,stale:source.stale!==false,termsAsOf:null};
  }
  const namespace = originFor(row);
  if (namespace !== legacyNamespace) meta.instrumentOrigin = clone(namespaces.get(namespace));
  const provenance = row.instrumentProvenance;
  if (provenance && typeof provenance === 'object') {
    meta.instrumentProvenance = {
      source: clean(provenance.source) || null,
      capturedAt: clean(provenance.capturedAt) || null,
      dataMode: ['fixture', 'demo', 'live', 'sandbox'].includes(provenance.dataMode) ? provenance.dataMode : null,
    };
  }
  return { namespace, meta };
}

function buildRegistry({ catalog = [], holdings = [], companies = [] } = {}) {
  const grouped = new Map();
  for (const [source, rows] of [['catalog', catalog], ['holdings', holdings], ['companies', companies]]) {
    for (const row of Array.isArray(rows) ? rows : []) {
      const normalized = normalizedMeta(row,source==='catalog');
      if (!normalized) continue;
      const list = grouped.get(normalized.meta.instrumentUid) || [];
      list.push({ ...normalized, source });
      grouped.set(normalized.meta.instrumentUid, list);
    }
  }
  const registry = new Map();
  // Holdings alone do not make the catalog known; an absent selection is pending.
  registry.catalogReady = Array.isArray(catalog) && catalog.length > 0;
  for (const [instrumentUid, rows] of [...grouped].sort(([a], [b]) => a.localeCompare(b))) {
    const origins = new Set(rows.map(row => row.namespace).filter(namespace => namespace !== legacyNamespace));
    const types = new Set(rows.map(row => row.meta.assetType).filter(meaningful));
    let reason = origins.size > 1 ? 'provider-collision' : types.size > 1 ? 'asset-type-collision' : null;
    const namespace = origins.size === 1 ? [...origins][0] : legacyNamespace;
    // Legacy labels cannot supply missing fields to a confirmed provider ref.
    const selected = rows.filter(row => row.namespace === namespace);
    const meta = { instrumentUid };
    for (const row of selected) {
      for (const [key, value] of Object.entries(row.meta)) {
        if (key === 'name' && value === row.meta.ticker) {
          if (!meta.name) meta.name = value;
          continue;
        }
        const fallbackName = key === 'name' && meta.name === meta.ticker;
        if (conflictingFields.has(key) && meaningful(meta[key]) && meaningful(value) && meta[key] !== value && !fallbackName) reason ||= 'metadata-conflict';
        if (['futureContractTerms','futureContractSource','catalogIdentity'].includes(key) && meaningful(meta[key]) && canonical(meta[key])!==canonical(value)) reason ||= 'metadata-conflict';
        if (!meaningful(meta[key]) || fallbackName) meta[key] = clone(value);
      }
    }
    const catalogClaims=rows.filter(row=>row.source==='catalog'&&row.namespace==='tinvest:broker'&&row.meta.catalogIdentity).map(row=>row.meta.catalogIdentity);

    registry.set(instrumentUid, {
      ref: { namespace, instrumentUid }, meta: reason ? null : meta,
      resolution: reason ? 'ambiguous' : namespace === legacyNamespace ? 'scoped-legacy' : 'exact',
      reason: reason || (namespace === legacyNamespace ? 'origin-unverified' : null),
      sources: [...new Set(rows.map(row => row.source))].sort(),
      ...(catalogClaims.length?{catalogClaims}:{}),
    });
  }
  return registry;
}

function identityEnvelope(meta, ref, resolution, catalogLinks) {
  if (!meta || !ref) return null;
  const type = meta.assetType || null;
  const sourceKnown = resolution === 'exact';
  const cryptoOrigin = type === 'crypto' && ['bybit:spot', 'binance:spot'].includes(ref.namespace);
  const providerLabel = cryptoOrigin ? (ref.namespace === 'bybit:spot' ? 'Bybit' : 'Binance') : meta.exchange || null;
  const realExchange = meta.realExchange || null;
  const specifiedVenue = value => value && !unknownVenue(value);
  const issuerInapplicable = ['future', 'crypto', 'currency'].includes(type);
  return {
    version: 1, ref: clone(ref), resolution,
    display: Object.fromEntries(['ticker', 'name', 'assetType', 'currency', 'priceUnit'].map(key => [key, meta[key] || null])),
    identifiers: { ...(meta.catalogIdentity?.state==='verified'?{providerPositionUid:meta.catalogIdentity.position.uid}:{}),providerAssetUid: meta.assetUid || null, figi: meta.figi || null, isin: meta.isin || null, classCode: meta.classCode || null },
    issuer: { state: issuerInapplicable ? 'not-applicable' : 'unknown', id: null, namespace: null, reason: issuerInapplicable ? 'corporate-issuer-not-applicable' : 'issuer-identity-not-provided' },
    listing: { state: sourceKnown ? 'known' : 'unknown', providerInstrumentRef: clone(ref), canonicalId: null, canonicalState: 'unknown' },
    venue: { state: specifiedVenue(providerLabel) || specifiedVenue(realExchange) ? 'known' : 'unknown', providerLabel, realExchange, mic: null, micState: 'unknown' },
    contract: {
      state: type === 'future' ? sourceKnown ? 'known' : 'unknown' : type ? 'not-applicable' : 'unknown',
      providerInstrumentRef: type === 'future' ? clone(ref) : null,
      expirationDate: meta.expirationDate || null, lastTradeDate: meta.lastTradeDate || null,
      futuresType: meta.futuresType || null, underlyingLabel: meta.basicAsset || null,
      underlyingRef: catalogLinks?.underlying.state==='ready'&&catalogLinks.underlying.items.length===1?clone(catalogLinks.underlying.items[0].ref):null,
      underlyingState: type==='future'?(catalogLinks?.underlying.state==='ready'?(catalogLinks.underlying.items.length===1?'known':'multiple-listings'):'unknown'):'not-applicable',
    },
    crypto: type === 'crypto' ? { marketType: cryptoOrigin ? 'spot' : null, marketState: cryptoOrigin ? 'known' : 'unknown', chainId: null, tokenContract: null, chainState: 'unknown', tokenContractState: 'unknown' } : null,
    ...(catalogLinks?{catalogLinks}:{}),
    provenance: clone(meta.instrumentProvenance || { source: null, capturedAt: null, dataMode: null }),
  };
}

function resolveFromRegistry(value, registry) {
  const requested = reference(value);
  const absent = reason => ({ meta: null, ref: requested, resolution: 'missing', reason, identity: null, envelope: null, eligibility: { company: false } });
  if (!requested) return absent('no-selection');
  const entry = registry.get(requested.instrumentUid);
  // Before the first catalog arrives every saved selection is unresolved, not missing.
  if (!entry) return absent(registry.catalogReady ? 'instrument-not-found' : 'catalog-loading');
  if (entry.resolution === 'ambiguous') return { ...absent(entry.reason), resolution: 'ambiguous' };
  if (requested.namespace !== legacyNamespace && requested.namespace !== entry.ref.namespace) return absent('source-ref-unavailable');
  const identity = identityEnvelope(entry.meta, entry.ref, entry.resolution,catalogLinksForInstrument(registry,entry));
  return clone({ meta: entry.meta, ref: entry.ref, resolution: entry.resolution, reason: entry.reason, identity, envelope: identity, eligibility: { company: entry.sources.includes('companies') } });
}

// Sources are trusted producer DTOs. A selection is only a reference: it never
// adds arbitrary metadata or guesses a provider from a ticker or UID prefix.
export function resolveInstrumentContext(metaOrUid, sources = {}) {
  return { ...resolveFromRegistry(metaOrUid, buildRegistry(sources)), scopeKey: clean(sources.scopeKey) };
}

export function createInstrumentContext() {
  let registry = new Map(), sourceSignature = canonical([]), scopeKey = '', focusedRef = null, terminalRef = null, revision = 0, notifying = false;
  const pins = new Map(), surfaces = new Map([['research', null], ['company', null], ['terminal', null]]);
  const listeners = new Set(), tokens = new WeakSet(), notifications = [];
  const surfaceName = value => {
    if (typeof value !== 'string' || !/^[a-z][a-z0-9-]{0,39}$/u.test(value)) throw new TypeError('Invalid instrument context surface');
    return value;
  };
  const bindRef = ref => ref?.namespace === legacyNamespace ? { ...ref, legacyScope: scopeKey } : ref;
  function state(surface) {
    const selected = surface === 'terminal' ? terminalRef : pins.has(surface) ? pins.get(surface) : focusedRef;
    const resolved = selected?.namespace === legacyNamespace && (selected.legacyInvalidated || selected.legacyScope !== scopeKey)
      ? { ...resolveFromRegistry(null, registry), ref: reference(selected), reason: 'legacy-scope-changed' }
      : resolveFromRegistry(selected, registry);
    return { ...resolved, pinned: surface !== 'terminal' && pins.has(surface), scopeKey };
  }
  function snapshot(surface = 'research') {
    surfaceName(surface);
    if (!surfaces.get(surface)) surfaces.set(surface, { ...state(surface), revision });
    return clone(surfaces.get(surface));
  }
  function notify(event) {
    notifications.push(event);
    if (notifying) return;
    notifying = true;
    try {
      while (notifications.length) {
        const next = notifications.shift();
        for (const listener of [...listeners]) {
          if (next.revision !== revision) break;
          if (listeners.has(listener)) listener(clone(next));
        }
      }
    } finally { notifying = false; }
  }
  function publish(surface, reason, { force = false, sourcesChanged = false } = {}) {
    let changed = sourcesChanged;
    const updates = new Map();
    for (const [name, previous] of surfaces) {
      const next = state(name);
      const old = previous && Object.fromEntries(Object.entries(previous).filter(([key]) => key !== 'revision'));
      if (!previous || canonical(next) !== canonical(old) || force && name === surface) updates.set(name, next);
    }
    if (updates.size || changed) {
      revision++;
      for (const [name, value] of updates) surfaces.set(name, { ...value, revision });
      const event = { surface, reason, revision, scopeKey };
      notify(event);
    }
    return snapshot(surface || 'research');
  }
  return {
    replaceSources(sources = {}) {
      const nextRegistry = buildRegistry(sources), nextScope = clean(sources.scopeKey);
      const signature = canonical([...nextRegistry]);
      if (signature === sourceSignature && nextScope === scopeKey) return snapshot();
      registry = nextRegistry; sourceSignature = signature; scopeKey = nextScope;
      // Once a unique producer confirms a legacy selection, retain that exact
      // source ref across later refreshes; never keep a wildcard provider pin.
      const confirm = ref => {
        if (ref?.namespace !== legacyNamespace) return ref;
        if (ref.legacyInvalidated || ref.legacyScope !== scopeKey) return { ...ref, legacyInvalidated: true };
        return registry.get(ref.instrumentUid)?.resolution === 'exact' ? clone(registry.get(ref.instrumentUid).ref) : ref;
      };
      focusedRef = confirm(focusedRef); terminalRef = confirm(terminalRef);
      for (const [surface, ref] of pins) pins.set(surface, confirm(ref));
      return publish(null, 'sources-replaced', { sourcesChanged: true });
    },
    resolve(value) { return { ...resolveFromRegistry(value, registry), pinned: false, revision, scopeKey }; },
    select(value, { surface = 'research', force = false, focusContext = true } = {}) {
      surfaceName(surface); snapshot(surface);
      const resolved = resolveFromRegistry(value, registry), ref = bindRef(resolved.ref);
      if (surface === 'terminal') { terminalRef = ref; if (focusContext !== false || !focusedRef) focusedRef = ref; }
      else if (pins.has(surface)) pins.set(surface, ref);
      else focusedRef = ref;
      return publish(surface, 'selection-changed', { force: Boolean(force) });
    },
    pin(surface, enabled = true) {
      surfaceName(surface);
      if (surface === 'terminal') return snapshot(surface);
      const current = snapshot(surface);
      if (enabled && current.ref) {
        const prior = pins.has(surface) ? pins.get(surface) : focusedRef;
        pins.set(surface, current.reason === 'legacy-scope-changed' ? prior : bindRef(current.ref));
      }
      else pins.delete(surface);
      return publish(surface, enabled ? 'pinned' : 'following');
    },
    get: snapshot,
    list() { return [...registry.values()].filter(entry => entry.meta).map(entry => clone(entry.meta)); },
    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('Instrument context subscriber required');
      listeners.add(listener); return () => listeners.delete(listener);
    },
    capture(surface = 'research') {
      const current = snapshot(surface);
      const token = Object.freeze({ surface, revision: current.revision, scopeKey, ref: current.ref && Object.freeze(clone(current.ref)) });
      tokens.add(token); return token;
    },
    isCurrent(token, surface = token?.surface) {
      if (!token || !tokens.has(token) || surface !== token.surface) return false;
      const current = snapshot(surface);
      return token.revision === current.revision && token.scopeKey === scopeKey && canonical(token.ref) === canonical(current.ref);
    },
  };
}
