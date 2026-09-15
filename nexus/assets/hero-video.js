(() => {
  'use strict';
  const video = document.getElementById('heroVideo');
  if (!video) return;
  const hero = video.closest('.hero');
  const toggle = hero.querySelector('.hero-video-toggle');
  const label = toggle.querySelector('span');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const connection = navigator.connection;
  let inView = hero.getBoundingClientRect().bottom > 0;
  let userPaused = false;
  let failed = false;
  let loading = false;
  let attempt = 0;
  video.muted = true;
  video.defaultMuted = true;
  const staticMode = () => reduced.matches || Boolean(connection && connection.saveData);
  const canPlay = () => !staticMode() && inView && !document.hidden && !userPaused && !failed;
  const updateLabel = () => {
    const english = document.documentElement.lang === 'en';
    toggle.dataset.paused = String(userPaused);
    label.textContent = userPaused ? (english ? 'Play video' : 'Продолжить') : (english ? 'Pause' : 'Пауза');
    toggle.setAttribute('aria-label', userPaused
      ? (english ? 'Play background video' : 'Воспроизвести фоновое видео')
      : (english ? 'Pause background video' : 'Приостановить фоновое видео'));
  };
  const sync = () => {
    hero.classList.toggle('is-static-film', staticMode());
    toggle.hidden = staticMode() || failed || (!hero.classList.contains('has-playing-film') && !userPaused);
    if (!canPlay()) {
      attempt += 1;
      loading = false;
      video.pause();
      return;
    }
    if (!video.getAttribute('src')) {
      video.src = window.matchMedia('(max-width: 767px)').matches ? video.dataset.mobileSrc : video.dataset.desktopSrc;
    }
    if (!video.paused || loading) return;
    loading = true;
    const id = ++attempt;
    const playback = video.play();
    if (playback) playback.then(() => {
      if (id !== attempt) return;
      loading = false;
      if (!canPlay()) video.pause();
    }).catch(() => {
      if (id !== attempt) return;
      loading = false;
      if (canPlay()) {
        userPaused = true;
        toggle.hidden = false;
        updateLabel();
      }
    });
  };
  video.addEventListener('playing', () => {
    if (!canPlay()) { video.pause(); return; }
    hero.classList.add('has-playing-film');
    toggle.hidden = false;
  });
  video.addEventListener('error', () => {
    failed = true;
    hero.classList.remove('has-playing-film');
    toggle.hidden = true;
    video.pause();
  });
  toggle.addEventListener('click', () => {
    userPaused = !userPaused;
    updateLabel();
    sync();
  });
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', sync);
  if (connection && connection.addEventListener) connection.addEventListener('change', sync);
  new MutationObserver(updateLabel).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting;
      sync();
    }, { threshold: 0.01 }).observe(hero);
  }
  updateLabel();
  sync();
})();
