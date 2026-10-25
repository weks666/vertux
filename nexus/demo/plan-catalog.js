const TYPES = new Set(['share', 'future', 'bond', 'etf', 'currency']);
const UID = /^[A-Za-z0-9._:@/-]{1,160}$/u;
// A saved catalogue identifies a candidate for a personal note. It grants no trading permission.
export function planCatalogInstrument(rows, instrumentUid) {
  if (!Array.isArray(rows) || typeof instrumentUid !== 'string' || !UID.test(instrumentUid)) return null;
  const matches = rows.filter(row => row && typeof row === 'object' && row.instrumentUid === instrumentUid);
  if (matches.length !== 1) return null;
  const row = matches[0];
  if (row.instrumentOrigin?.provider !== 'tinvest' || row.instrumentOrigin?.market !== 'broker' || !TYPES.has(row.assetType)) return null;
  try { return structuredClone(row); } catch { return null; }
}
