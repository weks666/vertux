(() => {
  'use strict';

  const rawFragment = globalThis.location?.hash?.slice(1) || '';
  if (!rawFragment) return;

  const questionMark = rawFragment.indexOf('?');
  const routePrefix = questionMark >= 0 ? rawFragment.slice(0, questionMark) : '';
  const parameterText = questionMark >= 0 ? rawFragment.slice(questionMark + 1) : rawFragment;
  const parameters = new URLSearchParams(parameterText);
  if (!parameters.has('nexusLaunch') && !parameters.has('nexusProduct')) return;

  parameters.delete('nexusLaunch');
  parameters.delete('nexusProduct');
  const remainingParameters = parameters.toString();
  const cleanFragment = routePrefix
    ? `${routePrefix}${remainingParameters ? `?${remainingParameters}` : ''}`
    : remainingParameters;
  const cleanUrl = `${location.pathname}${location.search}${cleanFragment ? `#${cleanFragment}` : ''}`;

  // Do not retain, exchange, log or persist launch values in the public preview.
  history.replaceState(history.state, '', cleanUrl);
})();
