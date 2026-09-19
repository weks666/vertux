// Presentation helpers shared by the working screens. No financial calculations.
export function signedClass(value) {
  if (value == null) return '';
  return BigInt(value) < 0n ? 'negative' : BigInt(value) > 0n ? 'positive' : '';
}

export function metricNote(value, note) {
  const cell = value?.parentElement;
  if (!cell) return;
  const help = cell.querySelector('.term-help');
  if (help && note) help.dataset.evidenceNote = note;
  value.title = note || '';
}

export function resultTrend(value, rate) {
  const icon = value?.parentElement?.querySelector('.trend-icon');
  if (!icon) return;
  if (rate == null) icon.setAttribute('hidden', '');
  else icon.removeAttribute('hidden');
  icon.classList.toggle('negative', rate != null && rate < 0);
  icon.classList.toggle('positive', rate != null && rate >= 0);
  icon.classList.toggle('trend-down', rate != null && rate < 0);
}

export function initLedgerTabs(root = document) {
  const tabs = [...root.querySelectorAll('[data-ledger-tab]')];
  const select = name => {
    for (const tab of tabs) {
      const active = tab.dataset.ledgerTab === name;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      tab.classList.toggle('active', active);
    }
    for (const panel of root.querySelectorAll('[data-ledger-panel]')) panel.hidden = panel.dataset.ledgerPanel !== name;
  };
  for (const [index, tab] of tabs.entries()) {
    tab.addEventListener('click', () => select(tab.dataset.ledgerTab));
    tab.addEventListener('keydown', event => {
      const target = event.key === 'ArrowRight' ? (index+1)%tabs.length : event.key === 'ArrowLeft' ? (index+tabs.length-1)%tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length-1 : null;
      if (target === null) return;
      event.preventDefault(); select(tabs[target].dataset.ledgerTab); tabs[target].focus();
    });
  }
  // Direct links to closed positions land on the correct table.
  root.querySelector('.positions-surface [data-go-view="operations"]')?.addEventListener('click', () => select('closed'));
  select('operations');
}
