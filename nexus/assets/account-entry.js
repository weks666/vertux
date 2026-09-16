(() => {
  // A minimal dark route replaces the former intermediate screen. Defer allows local preview metadata to be read.
  const page = document.documentElement.dataset.page;
  const plan = new URL(location.href).searchParams.get('plan');
  let origin = 'https://nexus.vertux.online';
  // The local preview server injects this only for an isolated fixture service.
  const preview = document.querySelector('meta[name="nexus-account-preview"]')?.content;
  if (preview && ['localhost','127.0.0.1'].includes(location.hostname)) {
    try {
      const candidate = new URL(preview);
      if (candidate.protocol === 'http:' && candidate.hostname === '127.0.0.1') origin = candidate.origin;
    } catch { /* Invalid preview metadata must not alter the public destination. */ }
  }
  const destination = new URL('/account.html', origin);
  if (page === 'register') destination.searchParams.set('register','1');
  if (['month','quarter','year'].includes(plan)) destination.searchParams.set('plan',plan);
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-portal-link]').forEach(link => { link.href = destination.href; });
  });
  if (['register','account'].includes(page)) location.replace(destination.href);
})();
