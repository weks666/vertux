// Views that work with one account explain why in their own words. Offer the
// accounts right under that message instead of sending the owner to the
// selector at the top of the page. The selector stays the only source of truth.
const PROMPT = /Выберите (?:один )?сч[её]т/u;
const SKIP = 'button,label,option,select,summary,.account-quick-pick,[hidden],.terminal-view';

export function installAccountQuickPick({ root = document.querySelector('#mainContent'), select = document.querySelector('#statisticsAccount') } = {}) {
  if (!root || !select) return () => {};
  let frame = 0;
  const accounts = () => [...select.options].filter(option => option.value).map(option => ({ id: option.value, label: option.textContent.trim() }));
  function picker(list) {
    const group = document.createElement('div');
    group.className = 'account-quick-pick'; group.setAttribute('role', 'group'); group.setAttribute('aria-label', 'Выбрать счёт');
    for (const account of list) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'button secondary'; button.dataset.quickAccount = account.id; button.textContent = account.label;
      group.append(button);
    }
    return group;
  }
  function decorate() {
    frame = 0;
    const list = accounts();
    if (select.value || list.length < 2) { root.querySelectorAll('.account-quick-pick').forEach(node => node.remove()); return; }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: node => PROMPT.test(node.data) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP });
    const hosts = new Set();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const host = node.parentElement?.closest('p,li,small,div');
      if (host && !host.closest(SKIP) && !host.querySelector('button,select')) hosts.add(host);
    }
    // One set per section, under its last (main) message.
    const sections = new Map();
    for (const host of hosts) sections.set(host.closest('section,article') || host.parentElement, host);
    for (const [section, host] of sections) if (!section.querySelector('.account-quick-pick')) host.after(picker(list));
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(decorate); };
  // Panels often render while hidden; showing them later only flips `hidden`.
  const observer = new MutationObserver(records => {
    if (records.some(record => !record.target.closest?.('.terminal-view') && (record.type === 'attributes' || [...record.addedNodes].some(node => PROMPT.test(node.textContent || ''))))) schedule();
  });
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  const click = event => {
    const button = event.target.closest('[data-quick-account]');
    if (!button || !root.contains(button)) return;
    select.value = button.dataset.quickAccount;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  };
  root.addEventListener('click', click);
  select.addEventListener('change', schedule);
  schedule();
  return () => { observer.disconnect(); cancelAnimationFrame(frame); root.removeEventListener('click', click); select.removeEventListener('change', schedule); };
}
