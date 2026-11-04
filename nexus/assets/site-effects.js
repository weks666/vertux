// Site effects: a spotlight that follows the pointer over cards, headings that
// come into focus, numbers that count up once and a glowing recommended plan.
// Each runs only on screen and not at all with reduced motion. Pointer
// coordinates go on a small glow element, never on the card, so a move does
// not restyle the card's content.
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const observe = 'IntersectionObserver' in window;

  // Spotlight on cards.
  const SPOTLIGHT = ['.nx-product-choice', '.nx-account-list li', '.nx-tier-card', '.nx-section-rows article', '.nx-section-steps article',
    '.nx-cf-price-card', '.nx-cf-feature-grid article', '.nx-cf-strip > div', '.nx-cf-format-grid article', '.nx-connection-section li'].join(',');
  if (pointer && !reduced) {
    for (const card of document.querySelectorAll(SPOTLIGHT)) {
      const glow = document.createElement('span');
      glow.className = 'nx-spot';
      glow.setAttribute('aria-hidden', 'true');
      card.classList.add('nx-spot-host');
      card.append(glow);
      card.addEventListener('pointermove', event => {
        const box = card.getBoundingClientRect();
        glow.style.setProperty('--spot-x', `${Math.round(event.clientX - box.left)}px`);
        glow.style.setProperty('--spot-y', `${Math.round(event.clientY - box.top)}px`);
      }, {passive:true});
    }
  }
  if (reduced || !observe) return;

  // Headings come into focus once. The page title does it on load; a heading is
  // hidden only once the observer has seen it below the screen, so nothing stays
  // hidden if the observer never reports.
  const headings = [...document.querySelectorAll('main h1, main h2')].filter(node => !node.closest('.nx-fan, .nx-visually-hidden, [hidden]'));
  const title = document.querySelector('main h1');
  if (title) title.classList.add('nx-reveal', 'is-in');
  const reveal = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const node = entry.target;
      if (!node.classList.contains('nx-reveal')) {
        if (entry.isIntersecting) { reveal.unobserve(node); continue; }
        node.classList.add('nx-reveal');
      } else if (entry.isIntersecting) { node.classList.add('is-in'); reveal.unobserve(node); }
    }
  }, {rootMargin:'0px 0px -6% 0px'});
  for (const node of headings) if (node !== title) reveal.observe(node);

  // Numbers count up once. Another writer (the language switch, a price
  // update) stops the count, and the last frame restores the exact text.
  function countUp(element) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node && !/\d/u.test(node.nodeValue)) node = walker.nextNode();
    if (!node) return;
    const original = node.nodeValue, match = original.match(/\d(?:[\d\s  ]*\d)?/u);
    const target = Number(match[0].replace(/\D/gu, ''));
    if (!(target >= 2)) return;
    const separator = (match[0].match(/[\s  ]/u) || [' '])[0];
    const format = value => String(value).replace(/\B(?=(\d{3})+(?!\d))/gu, separator);
    const started = performance.now(), duration = 1100;
    let written = original.replace(match[0], format(0));
    node.nodeValue = written;
    const step = now => {
      if (node.nodeValue !== written) return;
      const progress = Math.min(1, (now - started) / duration);
      written = progress < 1 ? original.replace(match[0], format(Math.round(target * (1 - (1 - progress) ** 3)))) : original;
      node.nodeValue = written;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  const counters = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) { countUp(entry.target); counters.unobserve(entry.target); }
  }, {threshold:.6});
  for (const node of document.querySelectorAll('.nx-work-stats strong, .nx-tier-price [data-price-rub], .nx-cf-price-card strong:not(.is-text)')) counters.observe(node);

  // The recommended plan's moving border runs only while the plan is on screen.
  const beams = new IntersectionObserver(entries => {
    for (const entry of entries) entry.target.classList.toggle('is-offscreen', !entry.isIntersecting);
  }, {rootMargin:'40px'});
  for (const node of document.querySelectorAll('.nx-tier-card.nx-annual, .nx-cf-price-card.is-main')) beams.observe(node);
})();
