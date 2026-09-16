(() => {
  const main = document.getElementById('mainContent');
  const panel = document.createElement('section');
  panel.className = 'demo-service'; panel.hidden = true; main.append(panel);
  const content = {
    subscription: '<h2>Ваша подписка</h2><p>Это учебный пример управления личным Invest. Подписка и оплата здесь не оформляются.</p><dl><dt>План</dt><dd>Invest Workspace</dd><dt>Период</dt><dd>Пробный · 30 дней</dd><dt>Устройства</dt><dd>1 из 3</dd><dt>Автосписание</dt><dd>Выключено</dd></dl><p>В кабинете доступны срок подписки, выбор периода, история оплаты и отключение устройств.</p><a href="../account.html" target="_top">Перейти в личный кабинет</a>',
    support: '<h2>Поддержка</h2><p>Поможем с установкой, подключением и работой Invest Workspace. В демонстрации сообщения не отправляются.</p><a href="https://t.me/VertuxManager" target="_blank" rel="noopener noreferrer">Открыть контакт Vertux</a>',
  };
  document.addEventListener('click', event => {
    const system = event.target.closest('[data-system-section]');
    if (system && content[system.dataset.systemSection]) {
      event.stopImmediatePropagation(); event.preventDefault();
      main.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
      document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item === system));
      panel.innerHTML = content[system.dataset.systemSection]; panel.hidden = false;
      document.getElementById('viewTitle').textContent = system.textContent.trim();
      document.body.classList.remove('rail-open'); main.scrollTop = 0;
      document.querySelector('[data-open-rail]')?.setAttribute('aria-expanded','false');
      main.focus({preventScroll:true});
    } else if (event.target.closest('[data-view]')) { panel.hidden = true; main.scrollTop = 0; }
  }, true);
})();
