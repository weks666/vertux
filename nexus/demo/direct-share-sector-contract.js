import { concentrationDecimal, concentrationScale, concentrationValue, CONCENTRATION_FX_VERSION, validateDirectShareConcentration } from './direct-share-concentration-contract.js';

export const SHARE_SECTOR_VERSION = 'direct-share-sectors-v1';
export const SHARE_SECTOR_FX_VERSION = 'direct-share-sectors-v2';
export const shareSectorVersion = concentration => concentration.contractVersion === CONCENTRATION_FX_VERSION ? SHARE_SECTOR_FX_VERSION : SHARE_SECTOR_VERSION;
export const SHARE_SECTOR_REASONS = Object.freeze({
  missing: 'Каталог акций ещё не сохранён для этого подключения.',
  invalid: 'Сохранённый каталог или время его получения не удалось проверить.',
  future: 'Каталог получен позже выбранного наблюдения состава.',
  expired: 'На время наблюдения срок свежести сохранённого каталога уже истёк.',
  unavailable: 'Исходный состав для классификации не подтверждён.',
  instrument_missing: 'Точного инструмента нет в сохранённом каталоге акций.',
  ambiguous_instrument: 'В каталоге несколько строк с этим идентификатором инструмента.',
  identity_mismatch: 'Тип, источник или валюта инструмента в каталоге не согласованы с позицией.',
  sector_missing: 'Источник не передал сектор этой акции.',
  sector_invalid: 'Значение сектора не удалось проверить.',
});
const abs = n => n < 0n ? -n : n;
const ratio = (n, d) => d ? { numerator: n.toString(), denominator: d.toString() } : null;
const closed = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join('|') === keys.split(' ').sort().join('|');
export const shareSectorLabel = value => typeof value === 'string' && value.length > 0 && value.length <= 240
  && value.trim() === value && !/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069\ufffd]/u.test(value);
export const shareSectorTime = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);

/** Every eligible position stays in the denominator. Missing classifications
 * form an explicit coverage remainder, never an assumed economic sector. */
export function calculateShareSectors(concentration, assignments) {
  const scale = concentrationScale(concentration.contractVersion);
  const included = concentration.rows.filter(row => row.state === 'included');
  const byKey = new Map(assignments.map(row => [row.key, row.sector]));
  const groups = new Map(), unknown = { long: 0n, short: 0n, keys: [] };
  let gross = 0n;
  for (const row of included) {
    const value = concentrationValue(row, scale), sector = byKey.get(row.key);
    gross += abs(value);
    let group = unknown;
    if (sector !== null && sector !== undefined) {
      if (!groups.has(sector)) groups.set(sector, { long: 0n, short: 0n, keys: [] });
      group = groups.get(sector);
    }
    if (value < 0n) group.short -= value; else group.long += value;
    group.keys.push(row.key);
  }
  const present = group => ({ positionKeys: group.keys, long: concentrationDecimal(group.long, scale), short: concentrationDecimal(group.short, scale),
    gross: concentrationDecimal(group.long + group.short, scale), net: concentrationDecimal(group.long - group.short, scale), weight: ratio(group.long + group.short, gross) });
  const ranked = [...groups].sort(([a, x], [b, y]) => x.long + x.short === y.long + y.short ? (a < b ? -1 : a > b ? 1 : 0) : x.long + x.short > y.long + y.short ? -1 : 1);
  const unknownGross = unknown.long + unknown.short, knownGross = gross - unknownGross;
  return {
    state: !included.length ? 'unavailable' : !gross ? 'zero-gross' : !groups.size ? 'unclassified' : unknown.keys.length ? 'partial' : 'classified',
    classifiedRows: included.length - unknown.keys.length, unclassifiedRows: unknown.keys.length,
    classifiedGross: included.length ? concentrationDecimal(knownGross, scale) : null,
    classifiedWeight: ratio(knownGross, gross),
    largestKnownWeight: ranked.length ? ratio(ranked[0][1].long + ranked[0][1].short, gross) : null,
    sectors: ranked.map(([sector, group]) => ({ sector, ...present(group) })),
    unclassified: included.length ? present(unknown) : null,
  };
}

export function validateShareSectors(dto, concentration) {
  try {
    if (!validateDirectShareConcentration(concentration) || !closed(dto, 'contractVersion concentrationSnapshotId catalog assignments calculation snapshotId')
      || dto.contractVersion !== shareSectorVersion(concentration) || dto.concentrationSnapshotId !== concentration.calculationSnapshotId || !digest(dto.snapshotId)
      || !closed(dto.catalog, 'source state capturedAt expiresAt contentHash timeBasis pointInTimeVerified')
      || dto.catalog.source !== 'tinvest-shares' || dto.catalog.timeBasis !== 'client-received' || dto.catalog.pointInTimeVerified !== false
      || !['saved', 'missing', 'invalid', 'future', 'expired', 'unavailable'].includes(dto.catalog.state)
      || !Array.isArray(dto.assignments) || dto.assignments.length > 500) return false;
    const catalog = dto.catalog;
    if (['saved', 'future', 'expired'].includes(catalog.state)) {
      if (!shareSectorTime(catalog.capturedAt) || !shareSectorTime(catalog.expiresAt) || catalog.expiresAt <= catalog.capturedAt || !digest(catalog.contentHash)
        || !concentration.period.observedAt || !concentration.evidence.sourceVerified) return false;
      const state = catalog.capturedAt > concentration.period.observedAt ? 'future'
        : catalog.expiresAt <= concentration.period.observedAt ? 'expired' : 'saved';
      if (state !== catalog.state) return false;
    } else if (catalog.capturedAt !== null || catalog.expiresAt !== null || catalog.contentHash !== null) return false;
    const rows = concentration.rows.filter(row => row.state === 'included');
    if (rows.length !== dto.assignments.length) return false;
    for (const [index, assignment] of dto.assignments.entries()) {
      if (!closed(assignment, 'key sector reason') || assignment.key !== rows[index].key) return false;
      if (assignment.sector !== null) {
        if (catalog.state !== 'saved' || !shareSectorLabel(assignment.sector) || assignment.reason !== null) return false;
      } else if (!Object.hasOwn(SHARE_SECTOR_REASONS, assignment.reason)
        || catalog.state !== 'saved' && assignment.reason !== catalog.state
        || catalog.state === 'saved' && !['instrument_missing', 'ambiguous_instrument', 'identity_mismatch', 'sector_missing', 'sector_invalid'].includes(assignment.reason)) return false;
    }
    return JSON.stringify(dto.calculation) === JSON.stringify(calculateShareSectors(concentration, dto.assignments));
  } catch { return false; }
}
