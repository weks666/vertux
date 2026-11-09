// Product fan on the Nexus home page. Each card opens its product; the card
// under the pointer or keyboard focus lifts and its neighbours step aside.
(() => {
  const fan = document.querySelector('[data-product-fan]');
  if (!fan) return;
  const cards = [...fan.querySelectorAll('.nx-fan-card')];
  const narrow = matchMedia('(max-width: 760px)');
  // Offsets are in % of a card's own width: left, centre, right.
  const BASE = [{x:-58, y:6, r:-8, s:.86, z:1}, {x:0, y:0, r:0, s:1, z:3}, {x:58, y:6, r:8, s:.86, z:1}];

  function place(active) {
    cards.forEach((card, index) => {
      const base = BASE[index] || BASE[1];
      let {x, y, r, s, z} = base;
      if (active !== null && !narrow.matches) {
        if (index === active) { y -= 7; s *= 1.06; z = 5; }
        else { const side = index < active ? -1 : 1; x += side * 9; r += side * 2.5; }
      }
      card.style.setProperty('--fan-x', `${x}%`);
      card.style.setProperty('--fan-y', `${y}%`);
      card.style.setProperty('--fan-r', `${r}deg`);
      card.style.setProperty('--fan-s', String(s));
      card.style.zIndex = String(z);
      card.classList.toggle('is-active', index === active);
    });
  }

  cards.forEach((card, index) => {
    card.style.setProperty('--fan-delay', `${120 + index * 90}ms`);
    card.addEventListener('pointerenter', () => place(index));
    card.addEventListener('focus', () => place(index));
  });
  fan.addEventListener('pointerleave', () => place(null));
  fan.addEventListener('focusout', event => { if (!fan.contains(event.relatedTarget)) place(null); });
  place(null);

  // Cards fly out from the centre once; after that hover moves stay quick.
  requestAnimationFrame(() => requestAnimationFrame(() => fan.classList.add('is-ready')));
  setTimeout(() => fan.classList.add('is-settled'), 1300);
  // On a phone the cards scroll sideways. The middle one starts in the centre,
  // the card in the centre is marked, and dots under the row show the position;
  // a dot brings its card to the centre.
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dots = document.createElement('div');
  dots.className = 'nx-fan-dots';
  cards.forEach((card, index) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('aria-label', card.querySelector('b')?.textContent.trim() || String(index + 1));
    dot.addEventListener('click', () => center(index, !reduced));
    dots.append(dot);
  });
  fan.after(dots);
  function center(index, smooth) {
    const card = cards[index];
    fan.scrollTo({left:card.offsetLeft - (fan.clientWidth - card.offsetWidth) / 2, behavior:smooth ? 'smooth' : 'auto'});
  }
  function mark() {
    const middle = fan.scrollLeft + fan.clientWidth / 2;
    let current = 0, distance = Infinity;
    cards.forEach((card, index) => {
      const gap = Math.abs(card.offsetLeft + card.offsetWidth / 2 - middle);
      if (gap < distance) { distance = gap; current = index; }
    });
    cards.forEach((card, index) => card.classList.toggle('is-current', narrow.matches && index === current));
    [...dots.children].forEach((dot, index) => dot.setAttribute('aria-current', String(index === current)));
  }
  let pending = 0;
  fan.addEventListener('scroll', () => { if (!pending) pending = requestAnimationFrame(() => { pending = 0; mark(); }); }, {passive:true});
  const arrange = () => { if (narrow.matches && cards[1]) center(1, false); mark(); };
  narrow.addEventListener('change', arrange);
  arrange();
})();
