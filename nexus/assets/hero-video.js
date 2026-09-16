(() => {
  'use strict';
  const film = document.getElementById('heroVideo');
  const intro = document.getElementById('heroIntroVideo');
  if (!film) return;
  const hero = film.closest('.hero');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const connection = navigator.connection;
  const clips = [intro, film].filter(Boolean);
  const pending = new Set();
  let stage = intro ? 'intro' : 'film';
  let inView = hero.getBoundingClientRect().bottom > 0;
  let failed = false;
  const staticMode = () => reduced.matches || Boolean(connection?.saveData);
  const revealCopy = () => document.documentElement.classList.add('hero-copy-ready');
  const canPlay = () => !staticMode() && inView && !document.hidden && !failed;
  const wanted = clip => clip === film ? stage !== 'intro' : stage !== 'film';
  clips.forEach(clip => { clip.muted = true; clip.defaultMuted = true; });
  function load(clip) {
    if (clip.getAttribute('src')) return;
    clip.src = window.matchMedia('(max-width:767px)').matches ? clip.dataset.mobileSrc : clip.dataset.desktopSrc;
  }
  function filmFailed() {
    failed = true;
    clips.forEach(clip => clip.pause());
    hero.classList.remove('has-playing-film', 'has-playing-intro');
    hero.classList.add('has-failed-film');
    revealCopy();
  }
  function continueFilm() {
    stage = 'film';
    intro?.pause();
    sync();
  }
  function play(clip) {
    load(clip);
    if (!clip.paused || pending.has(clip)) return;
    pending.add(clip);
    Promise.resolve(clip.play()).then(() => {
      pending.delete(clip);
      if (!canPlay() || !wanted(clip)) clip.pause();
    }).catch(() => {
      pending.delete(clip);
      if (!canPlay()) return;
      if (clip === intro) continueFilm();
      else filmFailed();
    });
  }
  function sync() {
    hero.classList.toggle('is-static-film', staticMode());
    if (staticMode()) revealCopy();
    if (!canPlay()) { clips.forEach(clip => clip.pause()); return; }
    clips.forEach(clip => {
      if (wanted(clip) && !clip.ended) play(clip);
      else clip.pause();
    });
  }
  intro?.addEventListener('timeupdate', () => {
    // The heading arrives as the lid begins to open, rather than before the video is ready.
    if (intro.currentTime >= .25) revealCopy();
    // Dissolve before the clip ends, while its camera is still moving.
    if (stage === 'intro' && Number.isFinite(intro.duration) && intro.duration > 0 &&
        intro.currentTime >= Math.max(0, intro.duration - 1.35)) {
      stage = 'crossfade';
      sync();
    }
  });
  intro?.addEventListener('ended', continueFilm);
  intro?.addEventListener('error', continueFilm);
  clips.forEach(clip => clip.addEventListener('playing', () => {
    if (!canPlay() || !wanted(clip)) { clip.pause(); return; }
    hero.classList.add(clip === film ? 'has-playing-film' : 'has-playing-intro');
    if (clip === intro) { film.preload = 'auto'; load(film); }
    else revealCopy();
  }));
  film.addEventListener('error', filmFailed);
  hero.addEventListener('focusin', revealCopy);
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', sync);
  connection?.addEventListener?.('change', sync);
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
    inView = entries[0].isIntersecting; sync();
  }, {threshold:.01}).observe(hero);
  sync();
})();
