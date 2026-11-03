(() => {
  'use strict';
  // Live demo switch: storefront and owner workspace share one sessionStorage,
  // so a request sent from the storefront appears after switching to the workspace.
  const host = document.querySelector('[data-cf-live]');
  if (!host) return;
  const tabs = [...host.querySelectorAll('[role="tab"]')];
  const frames = tabs.map(tab => document.getElementById(tab.getAttribute('aria-controls')));
  function select(index, { focus = false } = {}) {
    tabs.forEach((tab, position) => {
      const active = position === index;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      frames[position].hidden = !active;
    });
    const frame = frames[index];
    if (!frame.getAttribute('src')) frame.setAttribute('src', frame.dataset.src);
    else if (frame.dataset.loaded === 'true') { try { frame.contentWindow.location.reload(); } catch { frame.setAttribute('src', frame.getAttribute('src')); } }
    if (focus) tabs[index].focus();
  }
  frames.forEach(frame => frame.addEventListener('load', () => { frame.dataset.loaded = 'true'; }));
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => { if (tab.getAttribute('aria-selected') !== 'true') select(index); });
    tab.addEventListener('keydown', event => {
      const last = tabs.length - 1;
      const next = { ArrowRight: index === last ? 0 : index + 1, ArrowLeft: index === 0 ? last : index - 1, Home: 0, End: last }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      select(next, { focus: true });
    });
  });
})();
