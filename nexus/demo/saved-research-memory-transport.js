import { applySavedResearchCommand } from './saved-research-model.js';

// Explicit static-preview session only. This never opens a device bucket, file,
// browser storage, database, or remote endpoint. A new instance starts empty.
export function createSavedResearchMemoryTransport({ staticPreview, sessionId, environment }) {
  if (staticPreview !== true || typeof sessionId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/u.test(sessionId)
    || typeof environment !== 'function') throw new TypeError('Explicit static preview session required');
  const ownerScope = `preview_${sessionId}`, persistence = 'memory-session';
  let revision = 0, document = { schemaVersion: 1, entries: [] }, updatedAt = null;
  const copy = value => structuredClone(value);
  const base = () => ({ ownerScope, persistence, revision });
  const error = (state, code) => ({ ...base(), ok: false, state, error: { code } });
  const read = () => ({ ...base(), ok: true, state: revision === 0 ? 'empty' : 'ready', document: copy(document),
    updatedAt, recovery: { available: false, revision: null } });
  function command(input) {
    if (!input || Object.keys(input).length !== 2 || !Object.hasOwn(input, 'command')
      || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) return error('invalid-input', 'invalid-input');
    if (input.expectedRevision !== revision) return error('conflict', 'revision-conflict');
    if (revision === Number.MAX_SAFE_INTEGER) return error('limit', 'revision-limit');
    let env, now, result;
    try {
      env = environment(); now = typeof env?.now === 'function' ? env.now() : env?.now;
      if (updatedAt !== null && typeof now === 'string' && now < updatedAt) return error('error', 'clock-invalid');
      result = applySavedResearchCommand(document, input.command, { ...env, now, ownerScope });
    } catch { return error('unavailable', 'storage-unavailable'); }
    if (!result.ok) return { ...base(), ...result };
    if (!result.changed) return { ...read(), changed: false };
    document = result.document; updatedAt = now; ++revision;
    return read();
  }
  function recover(input) {
    if (!input || Object.keys(input).length !== 1 || !Number.isSafeInteger(input.expectedRevision)
      || input.expectedRevision < 0) return error('invalid-input', 'invalid-input');
    return input.expectedRevision === revision ? error('not-needed', 'recovery-not-needed') : error('conflict', 'revision-conflict');
  }
  return Object.freeze({ ownerScope, read, command, recover });
}
