// Presentation preferences never change accounts or financial records.
export function orderAccounts(accounts, pinned = []) {
  const pins = new Set(pinned);
  return [...accounts].sort((a, b) => {
    const rank = Number(pins.has(b.preferenceKey || b.id)) - Number(pins.has(a.preferenceKey || a.id));
    if (rank) return rank;
    const left = a.valueNanos == null ? null : BigInt(a.valueNanos);
    const right = b.valueNanos == null ? null : BigInt(b.valueNanos);
    if (left === null || right === null) return left === right ? 0 : left === null ? 1 : -1;
    return left === right ? String(a.label).localeCompare(String(b.label), 'ru') : left > right ? -1 : 1;
  });
}

export function readAccountPins(storage, scope) {
  try {
    const value = JSON.parse(storage.getItem(`invest:account-pins:${scope}`) || '[]');
    return Array.isArray(value) ? value.filter(id => typeof id === 'string').slice(0, 100) : [];
  } catch { return []; }
}

export function writeAccountPins(storage, scope, pins) {
  try { storage.setItem(`invest:account-pins:${scope}`, JSON.stringify(pins)); } catch { /* Optional device preference. */ }
}

export function dailyPositionSummary(rows, now = new Date()) {
  const date = value => Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('en-CA', { timeZone:'Europe/Moscow', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date(value)) : null;
  const today = date(now.toISOString());
  if (!rows.length || rows.some(row => row.dayPnlNanos == null || date(row.asOf) !== today)) return null;
  const currencies = new Set(rows.map(row => row.pnlCurrency || row.currency || 'RUB'));
  if (currencies.size !== 1) return null;
  const pnl = rows.reduce((total, row) => total + BigInt(row.dayPnlNanos), 0n);
  // A percentage is available only for comparable long cash positions, never from a futures notional.
  const comparable = rows.every(row => row.assetType === 'share' && row.direction !== 'short' && row.positionValueNanos != null && (row.positionValueCurrency || row.pnlCurrency) === [...currencies][0]);
  const base = comparable ? rows.reduce((total, row) => total + BigInt(row.positionValueNanos), 0n) - pnl : 0n;
  return { pnlNanos:pnl.toString(), currency:[...currencies][0], rate:base > 0n ? Number(pnl * 1_000_000n / base) / 1_000_000 : null };
}
