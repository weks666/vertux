// Closed trades occur in several views. Transfer them once; keep the calculation
// model unchanged and restore references only at the local API boundary.
const FORMAT = 'closed-trades-v1';
const SHARED_FIELDS = new Set(['instrumentUid','name','ticker','isin','logoUrl','brand','sector','exchange','assetType','currency','priceCurrency','direction','lots','usedLeverage','pnlCurrency','pnlState','pnlReason','historyState','historyReason','returnMethod','evidence','method','portfolioId','portfolioLabel']);
const key = (row, portfolioId = row.portfolioId) => JSON.stringify([portfolioId || '', row.id]);

export function compactBootstrapPayload(view) {
  const trades = view?.clientProduct?.closedPositions;
  if (!Array.isArray(trades) || trades.length < 200) return view;
  const metadata = [], metadataIndex = new Map(), indexes = new Map();
  const rows = trades.map((row, index) => {
    const common = {}, values = {};
    for (const [name, value] of Object.entries(row)) (SHARED_FIELDS.has(name) ? common : values)[name] = value;
    const signature = JSON.stringify(common);
    if (!metadataIndex.has(signature)) { metadataIndex.set(signature, metadata.length); metadata.push(common); }
    indexes.set(key(row), index);
    return [metadataIndex.get(signature), values];
  });
  function references(items = [], portfolioId) {
    return items.map(row => {
      const index = indexes.get(key(row, portfolioId ?? row.portfolioId));
      if (index === undefined) return { row }; // Preserve unusual rows without guessing their account.
      const base = trades[index], extra = {}, omitted = [];
      for (const [name, value] of Object.entries(row)) {
        if (value !== base[name] && JSON.stringify(value) !== JSON.stringify(base[name])) extra[name] = value;
      }
      for (const name of Object.keys(base)) if (!Object.hasOwn(row, name)) omitted.push(name);
      return Object.keys(extra).length || omitted.length ? [index, extra, omitted] : [index];
    });
  }
  const statistics = (value, portfolioId) => value && ({ ...value, efficiency: references(value.efficiency, portfolioId) });
  return { ...view, historyEncoding: FORMAT,
    clientProduct: { ...view.clientProduct, closedPositions: { metadata, rows }, statistics: statistics(view.clientProduct.statistics) },
    ...(view.equityCurvesByPortfolio && { equityCurvesByPortfolio: view.equityCurvesByPortfolio.map(account => ({ ...account,
      closedPositions: references(account.closedPositions, account.portfolioId), statistics: statistics(account.statistics, account.portfolioId) })) }),
  };
}

export function expandBootstrapPayload(view) {
  if (view?.historyEncoding !== FORMAT) return view;
  const { metadata, rows } = view.clientProduct.closedPositions;
  const trades = rows.map(([meta, values]) => ({ ...metadata[meta], ...values }));
  const references = (items = []) => items.map(ref => {
    if (!Array.isArray(ref)) return ref.row;
    const [index, extra, omitted] = ref;
    if (!extra && !omitted) return trades[index];
    const row = { ...trades[index], ...extra };
    for (const name of omitted || []) delete row[name];
    return row;
  });
  const statistics = value => value && ({ ...value, efficiency: references(value.efficiency) });
  const result = { ...view, clientProduct: { ...view.clientProduct, closedPositions: trades, statistics: statistics(view.clientProduct.statistics) },
    ...(view.equityCurvesByPortfolio && { equityCurvesByPortfolio: view.equityCurvesByPortfolio.map(account => ({ ...account,
      closedPositions: references(account.closedPositions), statistics: statistics(account.statistics) })) }),
  };
  delete result.historyEncoding;
  return result;
}
