(() => {
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
  if (document.body.dataset.page === 'register') destination.searchParams.set('register','1');
  if (['month','quarter','year'].includes(plan)) destination.searchParams.set('plan',plan);
  document.querySelectorAll('[data-portal-link]').forEach(link => {
    const url = new URL(link.href); url.protocol=new URL(origin).protocol; url.host=new URL(origin).host;
    if (['month','quarter','year'].includes(plan)) url.searchParams.set('plan',plan);
    link.href=url.href;
  });
  if (['register','account'].includes(document.body.dataset.page)) location.replace(destination.href);
})();
