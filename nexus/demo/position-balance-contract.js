const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const integer = value => typeof value === 'string' && /^-?(?:0|[1-9]\d{0,79})$/.test(value);
const id = value => typeof value === 'string' && /^[A-Za-z0-9._:@/-]{1,160}$/.test(value);
function part(value) {
  if (!exact(value, ['presence', 'freeQuantityNanos', 'blockedQuantityNanos', 'totalQuantityNanos', 'exchangeBlocked'])
    || ![true, false, null].includes(value.exchangeBlocked)) return false;
  const values = [value.freeQuantityNanos, value.blockedQuantityNanos, value.totalQuantityNanos];
  if (value.presence === 'unknown') return values.every(item => item === null) && value.exchangeBlocked === null;
  if (value.presence === 'absent') return values.every(item => item === '0') && value.exchangeBlocked === null;
  if (value.presence !== 'reported' || !values.every(item => item === null || integer(item))
    || value.blockedQuantityNanos !== null && BigInt(value.blockedQuantityNanos) < 0n) return false;
  return values[0] === null || values[1] === null ? values[2] === null
    : values[2] !== null && BigInt(values[0]) + BigInt(values[1]) === BigInt(values[2]);
}

/** Fail closed on stale account/period data or a broken free + blocked identity.
 * This display check cannot upgrade a saved comparison to reconciliation. */
export function validPositionBalance(value, reference) {
  if (!exact(value, ['contractVersion', 'comparison', 'parts']) || value.contractVersion !== 'position-balance-comparison-v1') return false;
  const dto = value.comparison;
  if (!object(dto) || dto.contractVersion !== 'position-quantity-comparison-v3' || !['partial', 'not-performed'].includes(dto.state)
    || dto.evidence?.source !== 't-invest.saved-security-balances-and-operations'
    || !['synthetic', 'local-saved'].includes(dto.evidence.dataMode)
    || dto.financialReconciliation?.state !== 'not-performed' || dto.financialReconciliation.residualNanos !== null
    || !object(reference?.scope) || dto.scope?.kind !== reference.scope.kind
    || !Array.isArray(dto.scope?.portfolioIds) || !Array.isArray(reference.scope.portfolioIds)
    || JSON.stringify(dto.scope.portfolioIds) !== JSON.stringify(reference.scope.portfolioIds)
    || !object(reference.requestedPeriod) || dto.requestedPeriod?.from !== reference.requestedPeriod.from
    || dto.requestedPeriod?.to !== reference.requestedPeriod.to || !Array.isArray(dto.blockers)
    || !Array.isArray(dto.rows) || !Array.isArray(value.parts) || dto.rows.length > 10000 || value.parts.length !== dto.rows.length) return false;
  if (dto.state === 'not-performed') return dto.rows.length === 0;
  if (dto.scope.kind !== 'single-account' || dto.scope.portfolioIds.length !== 1) return false;
  const seen = new Set();
  return dto.rows.every((row, index) => {
    const parts = value.parts[index];
    if (!object(row) || !id(row.instrumentUid) || seen.has(row.instrumentUid) || row.state !== 'partial' || row.residualNanos !== null
      || !exact(parts, ['instrumentUid', 'opening', 'closing']) || parts.instrumentUid !== row.instrumentUid
      || !part(parts.opening) || !part(parts.closing) || row.openingQuantityNanos !== parts.opening.totalQuantityNanos
      || row.closingQuantityNanos !== parts.closing.totalQuantityNanos) return false;
    seen.add(row.instrumentUid);
    const values = [row.openingQuantityNanos, row.boughtQuantityNanos, row.soldQuantityNanos,
      row.transferredInQuantityNanos, row.transferredOutQuantityNanos, row.expectedClosingQuantityNanos, row.closingQuantityNanos, row.observedDifferenceNanos];
    if (!values.every(item => item === null || integer(item))) return false;
    if (row.expectedClosingQuantityNanos === null) return row.observedDifferenceNanos === null;
    if (values.some(item => item === null)) return false;
    const [start, buy, sell, incoming, outgoing, expected, end, difference] = values.map(BigInt);
    return buy >= 0n && sell >= 0n && incoming >= 0n && outgoing >= 0n
      && start + buy - sell + incoming - outgoing === expected && end - expected === difference;
  });
}
