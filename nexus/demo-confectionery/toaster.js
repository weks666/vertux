// Toasts in the manner of Sonner, without dependencies. They stack in a corner,
// newest in front; hovering or focusing the stack spreads it out and pauses the
// timers; a toast closes by itself, with its button or with a sideways swipe.
// A promise toast shows a spinner and turns into success or an error when the
// work finishes. Colours come from the page's own theme variables.
//
//   NexusToaster.show('Сохранено')                          // success
//   NexusToaster.show('Не удалось', {kind:'error', description:'Проверьте сеть'})
//   NexusToaster.promise(save(), {loading:'Сохраняем…', success:'Сохранено', error:e => e.message})
(() => {
  if (window.NexusToaster) return;
  const ICONS = {
    success:'<circle cx="12" cy="12" r="9"/><path d="m8 12.4 2.7 2.7L16.2 9.5"/>',
    error:'<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5m0 3.4v.1"/>',
    warning:'<path d="M12 3.8 2.6 20h18.8z"/><path d="M12 10v4.2m0 2.9v.1"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5m0-8.9v.1"/>',
  };
  const KINDS = new Set(['success', 'error', 'warning', 'info', 'loading']);
  const VISIBLE = 3, GAP = 14, PEEK = 13, DURATION = 4200, LIMIT = 6;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const toasts = [];
  let host = null, expanded = false, counter = 0;

  function region() {
    if (host) return host;
    host = document.createElement('ol');
    host.className = 'nt-toaster';
    host.setAttribute('aria-label', document.documentElement.lang === 'en' ? 'Notifications' : 'Уведомления');
    host.setAttribute('aria-live', 'polite');
    host.addEventListener('pointerenter', () => spread(true));
    host.addEventListener('pointerleave', () => spread(false));
    host.addEventListener('focusin', () => spread(true));
    host.addEventListener('focusout', event => { if (!host.contains(event.relatedTarget)) spread(false); });
    // In the top layer (a manual popover) the stack stays above open dialogs.
    if ('popover' in host) host.popover = 'manual';
    document.body.append(host);
    document.addEventListener('visibilitychange', () => toasts.forEach(toast => (document.hidden ? pause(toast) : resume(toast))));
    return host;
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function icon(kind) {
    const span = element('span', 'nt-icon');
    span.setAttribute('aria-hidden', 'true');
    if (kind === 'loading') span.append(element('i', 'nt-spinner'));
    else span.innerHTML = `<svg viewBox="0 0 24 24">${ICONS[kind] || ICONS.info}</svg>`;
    return span;
  }

  function paint(toast) {
    const {node, kind, message, description, action} = toast;
    node.className = `nt-toast nt-${kind}`;
    node.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    const copy = element('div', 'nt-copy');
    copy.append(element('strong', 'nt-title', message));
    if (description) copy.append(element('p', 'nt-description', description));
    const parts = [icon(kind), copy];
    if (action && kind !== 'loading') {
      const button = element('button', 'nt-action', action.label);
      button.type = 'button';
      button.addEventListener('click', () => { try { action.onClick?.(); } finally { dismiss(toast.id); } });
      parts.push(button);
    }
    if (kind !== 'loading') {
      const close = element('button', 'nt-close');
      close.type = 'button';
      close.setAttribute('aria-label', document.documentElement.lang === 'en' ? 'Close' : 'Закрыть');
      close.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg>';
      close.addEventListener('click', () => dismiss(toast.id));
      parts.push(close);
    }
    node.replaceChildren(...parts);
  }

  // Positions: the newest toast sits at the bottom; older ones peek out above it,
  // smaller, and take the front toast's height so the stack stays tidy. Spread
  // out, every toast shows in full with a gap.
  function layout() {
    const live = toasts.filter(toast => !toast.leaving);
    const front = live[0]?.height || 0;
    let offset = 0;
    live.forEach((toast, index) => {
      const {node} = toast;
      const y = expanded ? -offset : -index * PEEK;
      node.style.setProperty('--nt-y', `${y}px`);
      node.style.setProperty('--nt-scale', expanded ? '1' : String(1 - index * .05));
      node.style.setProperty('--nt-height', `${expanded || index === 0 ? toast.height : front}px`);
      node.style.zIndex = String(LIMIT - index);
      node.dataset.front = String(index === 0);
      node.dataset.hidden = String(index >= VISIBLE);
      offset += toast.height + GAP;
    });
    if (host) host.style.setProperty('--nt-stack', `${expanded ? offset : front + Math.min(live.length - 1, VISIBLE - 1) * PEEK}px`);
  }

  function measure(toast) {
    toast.node.style.removeProperty('--nt-height');
    toast.node.dataset.measuring = 'true';
    toast.height = toast.node.offsetHeight;
    delete toast.node.dataset.measuring;
  }

  function spread(open) {
    if (expanded === open) return;
    expanded = open;
    host?.toggleAttribute('data-expanded', open);
    toasts.forEach(toast => (open ? pause(toast) : resume(toast)));
    layout();
  }

  function schedule(toast) {
    clearTimeout(toast.timer);
    if (toast.kind === 'loading' || toast.duration === Infinity) return;
    toast.started = Date.now();
    toast.timer = setTimeout(() => dismiss(toast.id), toast.remaining);
  }
  function pause(toast) {
    if (!toast.timer) return;
    clearTimeout(toast.timer);
    toast.timer = 0;
    toast.remaining = Math.max(800, toast.remaining - (Date.now() - toast.started));
  }
  function resume(toast) { if (!toast.timer && !expanded && !document.hidden && !toast.leaving) schedule(toast); }

  // A sideways swipe of more than 70 px closes the toast.
  function swipe(toast) {
    const {node} = toast;
    let startX = null;
    node.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.target.closest('button')) return;
      startX = event.clientX;
      node.setPointerCapture(event.pointerId);
      node.dataset.swiping = 'true';
    });
    node.addEventListener('pointermove', event => {
      if (startX === null) return;
      node.style.setProperty('--nt-swipe', `${event.clientX - startX}px`);
    });
    const end = event => {
      if (startX === null) return;
      const distance = event.clientX - startX;
      startX = null;
      delete node.dataset.swiping;
      if (Math.abs(distance) > 70) { node.dataset.swipedOut = distance > 0 ? 'right' : 'left'; dismiss(toast.id); }
      else node.style.setProperty('--nt-swipe', '0px');
    };
    node.addEventListener('pointerup', end);
    node.addEventListener('pointercancel', end);
  }

  function raise() {
    if (!host?.popover) return;
    try { if (host.matches(':popover-open')) host.hidePopover(); host.showPopover(); } catch { /* not supported: stays a fixed layer */ }
  }

  function show(message, options = {}) {
    const kind = KINDS.has(options.kind) ? options.kind : 'success';
    const duration = options.duration ?? (kind === 'error' ? DURATION + 1800 : DURATION);
    const node = element('li');
    const toast = {id:++counter, node, kind, message:String(message ?? ''), description:options.description || '', action:options.action || null,
      duration, remaining:duration, timer:0, started:0, height:0, leaving:false};
    paint(toast);
    region().prepend(node);
    raise();
    toasts.unshift(toast);
    measure(toast);
    swipe(toast);
    while (toasts.filter(item => !item.leaving).length > LIMIT) dismiss(toasts.filter(item => !item.leaving).at(-1).id);
    layout();
    // The start position is already laid out (measured above), so switching to
    // the mounted state now animates the entry from below, even in a tab that
    // draws no frames at the moment.
    void node.offsetWidth;
    node.dataset.mounted = 'true';
    if (!expanded && !document.hidden) schedule(toast);
    return toast.id;
  }

  function update(id, message, options = {}) {
    const toast = toasts.find(item => item.id === id && !item.leaving);
    if (!toast) return show(message, options);
    toast.kind = KINDS.has(options.kind) ? options.kind : toast.kind;
    toast.message = String(message ?? toast.message);
    toast.description = options.description ?? '';
    toast.duration = toast.remaining = options.duration ?? (toast.kind === 'error' ? DURATION + 1800 : DURATION);
    paint(toast);
    measure(toast);
    layout();
    if (!expanded && !document.hidden) schedule(toast);
    return id;
  }

  function dismiss(id) {
    const toast = toasts.find(item => item.id === id);
    if (!toast || toast.leaving) return;
    toast.leaving = true;
    clearTimeout(toast.timer);
    toast.node.dataset.leaving = 'true';
    layout();
    setTimeout(() => {
      toast.node.remove();
      toasts.splice(toasts.indexOf(toast), 1);
      if (!toasts.length && expanded) spread(false);
      layout();
    }, reduced.matches ? 0 : 320);
  }

  async function promise(work, messages = {}) {
    const text = (value, argument, fallback) => (typeof value === 'function' ? value(argument) : value) || fallback;
    const id = show(text(messages.loading, undefined, '…'), {kind:'loading'});
    try {
      const result = await (typeof work === 'function' ? work() : work);
      update(id, text(messages.success, result, 'Готово'), {kind:'success', description:text(messages.description, result, '')});
      return result;
    } catch (error) {
      update(id, text(messages.error, error, error?.message || 'Не получилось'), {kind:'error'});
      throw error;
    }
  }

  window.NexusToaster = Object.freeze({
    show, update, dismiss, promise,
    success:(message, options = {}) => show(message, {...options, kind:'success'}),
    error:(message, options = {}) => show(message, {...options, kind:'error'}),
    warning:(message, options = {}) => show(message, {...options, kind:'warning'}),
    info:(message, options = {}) => show(message, {...options, kind:'info'}),
  });
})();
