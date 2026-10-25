const node = (tag, text, className) => {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
};
let nextId = 0;

// Presentation owns panels and focus. Data owners keep their existing revision,
// abort and access guards; hiding a sibling pane does not close its controller.
export function createPlanReviewWorkspace({ region, opener, title, context, widgets, actions, canOpen, closeOthers }) {
  const id = 'plan-review-' + (++nextId);
  region.id = id; region.className += ' plan-review-workspace'; region.hidden = true;
  region.setAttribute('aria-label', 'Разбор выбранного плана');
  opener.dataset.planReviewOpen = ''; opener.setAttribute('aria-controls', id);
  opener.setAttribute('aria-expanded', 'false');
  const heading = node('h4', title); heading.tabIndex = -1;
  const intro = node('div'); intro.append(heading, node('p', context, 'plan-review-context'));
  const header = node('header', undefined, 'plan-review-header');
  const actionBar = node('div', undefined, 'plan-review-actions'); actionBar.append(...actions);
  header.append(intro, actionBar);
  const nav = node('nav', undefined, 'plan-review-nav'); nav.setAttribute('aria-label', 'Представления разбора плана');
  const layout = node('div', undefined, 'plan-review-layout');
  const content = node('div', undefined, 'plan-review-content');
  const source = node('aside', undefined, 'plan-review-source'); source.hidden = true; source.setAttribute('aria-label', 'Подробности выбранного источника');
  layout.append(content, source); region.replaceChildren(header, nav, layout);
  let active = widgets[0]?.key, returnTo = null, sourceOwner = null, disposed = false;
  const panes = new Map();

  function hideSource(restore = false, owner = null) {
    if (source.hidden || owner && sourceOwner !== owner) return;
    const focusWasInside = source.contains(document.activeElement), oldOwner = sourceOwner;
    source.hidden = true; source.replaceChildren(); delete layout.dataset.sourceOpen;
    const previous = returnTo; returnTo = null; sourceOwner = null;
    if (restore && previous) {
      const target = previous.opener?.isConnected && previous.opener.getClientRects().length
        ? previous.opener : widgets.find(item => item.key === active)?.widget.button;
      target?.focus({ preventScroll: true }); window.scrollTo({ left: previous.x, top: previous.y, behavior: 'instant' });
    } else if (focusWasInside) widgets.find(item => item.key === oldOwner)?.widget.button.focus({ preventScroll: true });
  }
  function showSource({ title: label, body, opener: trigger, owner }) {
    if (disposed || region.hidden || !canOpen()) return;
    if (source.hidden) returnTo = { opener: trigger, x: window.scrollX, y: window.scrollY };
    else if (trigger?.isConnected && !source.contains(trigger)) returnTo = { opener: trigger, x: window.scrollX, y: window.scrollY };
    const back = node('button', 'Вернуться к разбору', 'button'); back.type = 'button'; back.dataset.planReviewSourceClose = '';
    back.addEventListener('click', () => hideSource(true));
    const labelNode = node('h5', label); labelNode.tabIndex = -1;
    source.replaceChildren(back, labelNode, body); source.hidden = false; sourceOwner = owner; layout.dataset.sourceOpen = 'true';
    labelNode.focus({ preventScroll: true }); labelNode.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }
  for (const item of widgets) {
    const { key, label, widget } = item;
    const pane = node('div', undefined, 'plan-review-pane'); pane.dataset.planReviewPane = key;
    pane.hidden = key !== active; pane.append(widget.region); content.append(pane); panes.set(key, pane);
    const button = widget.button; button.textContent = label; button.dataset.planReviewView = key;
    button.setAttribute('aria-pressed', String(key === active)); nav.append(button);
    // An already loaded owner must not receive its old toggle-to-close action.
    button.addEventListener('click', event => {
      if (disposed || region.hidden || !canOpen()) { event.preventDefault(); event.stopImmediatePropagation(); return; }
      hideSource(); active = key;
      for (const entry of widgets) {
        panes.get(entry.key).hidden = entry.key !== key;
        entry.widget.button.setAttribute('aria-pressed', String(entry.key === key));
      }
      if (!widget.region.hidden) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
  }
  function close(restore = false) {
    hideSource(); widgets.forEach(item => item.widget.close());
    region.hidden = true; opener.setAttribute('aria-expanded', 'false');
    if (restore && opener.isConnected) opener.focus({ preventScroll: true });
  }
  function open() {
    if (disposed || !canOpen()) return;
    closeOthers(); region.hidden = false; opener.setAttribute('aria-expanded', 'true');
    widgets.find(item => item.key === active)?.widget.button.click();
    heading.focus({ preventScroll: true }); heading.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }
  function setWriting(pending) {
    if (disposed) return;
    nav.setAttribute('aria-busy', String(pending));
    for (const control of [...widgets.map(item => item.widget.button), ...actions]) control.disabled = pending || !canOpen();
  }
  opener.addEventListener('click', () => region.hidden ? open() : close(true));
  source.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); hideSource(true); }
  });
  region.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    event.preventDefault(); event.stopPropagation();
    if (!source.hidden) hideSource(true); else close(true);
  });
  return { region, open, close, showSource, hideSource, setWriting,
    dispose() { close(); disposed = true; widgets.forEach(item => item.widget.dispose()); } };
}
