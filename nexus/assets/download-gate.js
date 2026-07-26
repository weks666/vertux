(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) api.init(root.document, root);
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var REQUEST_TIMEOUT_MS = 12000;
  var MAX_TICKET_LIFETIME_MS = 10 * 60 * 1000;

  function isLoopback(hostname) {
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  }

  function parseSecureAbsoluteUrl(value) {
    if (typeof value !== 'string') return null;
    var source = value.trim();
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(source)) return null;
    try {
      var url = new URL(source);
      if (url.username || url.password) return null;
      if (url.protocol === 'https:') return url;
      if (url.protocol === 'http:' && isLoopback(url.hostname)) return url;
    } catch (error) {
      return null;
    }
    return null;
  }

  function validateTicket(payload, now) {
    if (!payload || typeof payload !== 'object') return null;
    var ticketUrl = parseSecureAbsoluteUrl(payload.ticket_url);
    var expiresAt = Date.parse(payload.expires_at);
    var currentTime = typeof now === 'number' ? now : Date.now();
    if (!ticketUrl || !Number.isFinite(expiresAt)) return null;
    if (expiresAt <= currentTime || expiresAt - currentTime > MAX_TICKET_LIFETIME_MS) return null;
    return {
      url: ticketUrl.href,
      expiresAt: expiresAt,
      filename: typeof payload.filename === 'string' && /^[\w .()-]{1,180}$/.test(payload.filename) ? payload.filename : '',
      version: typeof payload.version === 'string' ? payload.version.slice(0, 32) : ''
    };
  }

  function init(document, win) {
    document.querySelectorAll('[data-download-gate]').forEach(function (gate) {
      var form = gate.querySelector('[data-download-form]');
      var input = gate.querySelector('input[name="access_code"]');
      var submit = gate.querySelector('[data-download-submit]');
      var toggle = gate.querySelector('[data-download-code-toggle]');
      var toggleLabel = toggle && toggle.querySelector('span');
      var status = gate.querySelector('[data-download-status]');
      var endpoint = parseSecureAbsoluteUrl(gate.getAttribute('data-endpoint') || '');
      var artifact = (gate.getAttribute('data-artifact') || '').trim();
      var statusCode = endpoint ? 'ready' : 'unconfigured';
      var busy = false;

      if (!form || !input || !submit || !status || !artifact) return;

      function copy(code) {
        var node = gate.querySelector('[data-gate-copy="' + code + '"]');
        return node ? node.textContent.trim() : '';
      }

      function setStatus(code, tone) {
        statusCode = code;
        status.textContent = copy(code);
        status.setAttribute('data-status-code', code);
        status.classList.toggle('is-error', tone === 'error');
        status.classList.toggle('is-success', tone === 'success');
      }

      function renderToggle() {
        if (!toggle || !toggleLabel) return;
        var visible = input.type === 'text';
        toggleLabel.textContent = copy(visible ? 'hide-code' : 'show-code');
        toggle.setAttribute('aria-label', copy(visible ? 'hide-code-aria' : 'show-code-aria'));
      }

      function setBusy(next) {
        busy = next;
        form.setAttribute('aria-busy', String(next));
        submit.setAttribute('aria-busy', String(next));
        submit.disabled = next || !endpoint;
        input.disabled = next || !endpoint;
        if (toggle) toggle.disabled = next || !endpoint;
        gate.classList.toggle('is-busy', next);
      }

      gate.classList.toggle('is-configured', Boolean(endpoint));
      setBusy(false);
      setStatus(statusCode);
      renderToggle();

      if (toggle) {
        toggle.addEventListener('click', function () {
          if (toggle.disabled) return;
          var reveal = input.type === 'password';
          input.type = reveal ? 'text' : 'password';
          toggle.setAttribute('aria-pressed', String(reveal));
          renderToggle();
          input.focus();
        });
      }

      input.addEventListener('input', function () {
        if (!busy && statusCode !== 'ready') setStatus('ready');
      });

      async function requestDownload(event) {
        event.preventDefault();
        if (!endpoint || busy) return;

        var accessCode = input.value.trim();
        if (accessCode.length < 8 || accessCode.length > 128) {
          setStatus('empty', 'error');
          input.focus();
          return;
        }

        setBusy(true);
        setStatus('requesting');
        input.value = '';
        input.type = 'password';
        if (toggle) toggle.setAttribute('aria-pressed', 'false');
        renderToggle();

        var controller = typeof AbortController === 'function' ? new AbortController() : null;
        var timeout = controller ? win.setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT_MS) : null;

        try {
          var response = await win.fetch(endpoint.href, {
            method: 'POST',
            mode: 'cors',
            credentials: 'omit',
            cache: 'no-store',
            redirect: 'error',
            referrerPolicy: 'no-referrer',
            headers: {'Accept': 'application/json', 'Content-Type': 'application/json'},
            body: JSON.stringify({artifact: artifact, access_code: accessCode, locale: document.documentElement.lang === 'en' ? 'en' : 'ru'}),
            signal: controller ? controller.signal : undefined
          });

          var payload = null;
          try { payload = await response.json(); } catch (error) { payload = null; }

          if (response.status === 401 || response.status === 403) {
            setStatus('invalid', 'error');
            input.focus();
            return;
          }
          if (response.status === 429) {
            setStatus('limited', 'error');
            return;
          }
          if (!response.ok) {
            setStatus('unavailable', 'error');
            return;
          }

          var ticket = validateTicket(payload, Date.now());
          if (!ticket) {
            setStatus('invalid-response', 'error');
            return;
          }

          setStatus('success', 'success');
          var downloadLink = document.createElement('a');
          downloadLink.href = ticket.url;
          downloadLink.rel = 'noreferrer';
          if (ticket.filename) downloadLink.download = ticket.filename;
          downloadLink.hidden = true;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          win.setTimeout(function () { downloadLink.remove(); }, 1000);
        } catch (error) {
          setStatus('unavailable', 'error');
        } finally {
          if (timeout) win.clearTimeout(timeout);
          setBusy(false);
        }
      }

      form.addEventListener('submit', requestDownload);
      submit.addEventListener('click', function (event) {
        event.preventDefault();
        void requestDownload(event);
      });

      var languageObserver = new MutationObserver(function () {
        win.setTimeout(function () {
          setStatus(statusCode, status.classList.contains('is-error') ? 'error' : status.classList.contains('is-success') ? 'success' : '');
          renderToggle();
        }, 0);
      });
      languageObserver.observe(document.documentElement, {attributes:true, attributeFilter:['lang']});
    });
  }

  return {
    init: init,
    parseSecureAbsoluteUrl: parseSecureAbsoluteUrl,
    validateTicket: validateTicket,
    constants: {requestTimeoutMs: REQUEST_TIMEOUT_MS, maxTicketLifetimeMs: MAX_TICKET_LIFETIME_MS}
  };
});
