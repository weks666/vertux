const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const integer = value => typeof value === 'string' && /^-?\d{1,310}$/.test(value);
const count = value => Number.isSafeInteger(value) && value >= 0;
function validRatio(value, numerator, denominator) {
  if (!denominator) return value === null;
  if (!value || value.numeratorNanos !== String(numerator) || value.denominator !== String(denominator)) return false;
  const magnitude = numerator < 0n ? -numerator : numerator, sign = numerator < 0n ? -1n : 1n;
  const rounded = sign * (magnitude / denominator + (magnitude % denominator * 2n >= denominator ? 1n : 0n));
  return value.roundedNanos === (numerator !== 0n && rounded === 0n ? null : String(rounded))
    && value.precision === (numerator % denominator === 0n ? 'exact' : rounded === 0n ? 'below-nano' : 'rounded-to-nano')
    && value.sign === (numerator > 0n ? 'positive' : numerator < 0n ? 'negative' : 'zero');
}
function validSummary(value) {
  if (!value || ![value.n, value.wins, value.losses, value.breakeven].every(count)
    || value.n !== value.wins + value.losses + value.breakeven) return false;
  if (!value.n) return value.netNanos === null && value.grossNanos === null && value.costsNanos === null && value.mean === null;
  return [value.netNanos, value.grossNanos, value.costsNanos].every(integer)
    && BigInt(value.netNanos) === BigInt(value.grossNanos) + BigInt(value.costsNanos)
    && validRatio(value.mean, BigInt(value.netNanos), BigInt(value.n));
}
const net = summary => summary.n ? BigInt(summary.netNanos) : 0n;
function matchesRows(rows, value) {
  let gross = 0n, costs = 0n, wins = 0, losses = 0;
  for (const row of rows) {
    if (![row.executionNetPnlNanos, row.grossPnlNanos, row.signedExecutionCostsNanos].every(integer)
      || !row.executions?.length || row.executions.some(fill => fill.sourceState !== 'verified' || fill.costState !== 'known')) return false;
    const result = BigInt(row.executionNetPnlNanos);
    if (BigInt(row.grossPnlNanos) + BigInt(row.signedExecutionCostsNanos) !== result) return false;
    gross += BigInt(row.grossPnlNanos); costs += BigInt(row.signedExecutionCostsNanos);
    if (result > 0n) wins++; else if (result < 0n) losses++;
  }
  return rows.length === value.n && wins === value.wins && losses === value.losses
    && (!rows.length || String(gross) === value.grossNanos && String(costs) === value.costsNanos);
}

/** Presentation binding, not an authorization or source-truth boundary. Only
 * accepts the packet attached to the current accepted bootstrap/cohort. Native
 * eligibility and current account selection remain authoritative. */
export function readTradeGroupReview(dto, cohort, accountId = dto?.scope?.portfolioId) {
  try {
    const packet = cohort?.review, stats = dto?.statistics;
    if (!packet || packet.version !== 'trade-group-review-v1' || packet.intent !== 'trading.group-review' || packet.state !== 'descriptive'
      || dto.version !== 'trade-episodes-v1' || dto.scope?.currency !== 'RUB' || accountId !== dto.scope.portfolioId
      || packet.portfolioId !== accountId || packet.currency !== 'RUB' || packet.timezone !== dto.timezone
      || packet.calculationSnapshotId !== dto.calculationSnapshotId || cohort.calculationSnapshotId !== dto.calculationSnapshotId
      || !eq(packet.requestedPeriod, dto.requestedPeriod) || packet.dimension !== cohort.dimension || packet.bucket !== cohort.bucket
      || !dto.cohorts?.includes(cohort) || cohort.state !== 'descriptive'
      || stats?.state !== 'ready' || stats.calculationSnapshotId !== dto.calculationSnapshotId
      || dto.coverage?.history !== 'complete-saved-range' || dto.coverage?.quantityEvents !== 'complete'
      || ![packet.group, packet.baseline, packet.sensitivity?.retained].every(validSummary)
      || packet.group.n !== cohort.n || packet.group.netNanos !== cohort.sumNanos
      || packet.group.n + packet.baseline.n !== stats.n || String(net(packet.group) + net(packet.baseline)) !== stats.sumNetNanos
      || !validRatio(packet.meanDifference, net(packet.group) * BigInt(packet.baseline.n) - net(packet.baseline) * BigInt(packet.group.n), BigInt(packet.group.n) * BigInt(packet.baseline.n))
      || packet.baselinePolicy !== 'other-eligible-closed-in-same-period' || packet.independentObservationsClaimed !== false
      || packet.stability !== 'not-established' || packet.holdout !== 'not-performed') return null;
    const keys = new Set(cohort.episodeKeys), eligible = (dto.episodes || []).filter(row => row.eligible === true), allKeys = new Set(stats.episodeKeys);
    if (keys.size !== cohort.n || eligible.length !== stats.n || new Set(eligible.map(row => row.episodeKey)).size !== eligible.length
      || !Array.isArray(stats.episodeKeys) || stats.episodeKeys.length !== eligible.length
      || allKeys.size !== eligible.length || eligible.some(row => !allKeys.has(row.episodeKey))) return null;
    const rows = eligible.filter(row => keys.has(row.episodeKey)), sensitivity = packet.sensitivity;
    if (rows.length !== cohort.n || rows.some(row => row.state !== 'closed' || row.costState !== 'known' || row.basisState !== 'known')
      || sensitivity.method !== 'remove-one-largest-absolute-net' || sensitivity.tieBreak !== 'earliest-close-then-episode-key'
      || !count(sensitivity.tiedLargestCount) || !sensitivity.tiedLargestCount || sensitivity.tiedLargestCount > rows.length) return null;
    const removed = rows.find(row => row.episodeKey === sensitivity.removedEpisodeKey);
    if (!removed || sensitivity.removedNetNanos !== removed.executionNetPnlNanos
      || sensitivity.retained.n !== packet.group.n - 1 || net(sensitivity.retained) + BigInt(sensitivity.removedNetNanos) !== net(packet.group)) return null;
    const absolute = row => { const n = BigInt(row.executionNetPnlNanos); return n < 0n ? -n : n; };
    const tied = rows.filter(row => absolute(row) === absolute(removed));
    if (rows.some(row => absolute(row) > absolute(removed)) || tied.length !== sensitivity.tiedLargestCount
      || tied.some(row => row.closedAt < removed.closedAt || row.closedAt === removed.closedAt && row.episodeKey < removed.episodeKey)
      || !matchesRows(rows, packet.group) || !matchesRows(eligible.filter(row => !keys.has(row.episodeKey)), packet.baseline)
      || !matchesRows(rows.filter(row => row !== removed), sensitivity.retained)) return null;
    return packet;
  } catch { return null; }
}

export function resolveTradeGroupRows(dto, cohort, selection) {
  const packet = readTradeGroupReview(dto, cohort);
  if (!packet || !['group', 'baseline', 'retained', 'removed'].includes(selection)) return null;
  const keys = new Set(cohort.episodeKeys), removed = packet.sensitivity.removedEpisodeKey;
  return dto.episodes.filter(row => row.eligible === true && (selection === 'baseline' ? !keys.has(row.episodeKey)
    : selection === 'removed' ? row.episodeKey === removed : keys.has(row.episodeKey) && (selection === 'group' || row.episodeKey !== removed)));
}
