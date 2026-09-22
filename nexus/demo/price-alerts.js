import {telegramIcon} from './brand-icons.js';
import {instrumentMark, issuerName, watchInstrumentImages} from './instrument-mark.js';
import {normalizeMarketCandles} from './charts.js';
import {money} from './number-format.js';
const intents = { buy: 'Покупка', sell: 'Продажа', watch: 'Наблюдение' };
const conditions = {crossing:'Пересечение',above:'Цена выше',below:'Цена ниже'};
const icon = name => name === 'telegram' ? telegramIcon : '<svg class="alert-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">'+({bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',telegram:'<path d="m3 10 18-7-4 18-6-6-4 3 1-6L18 6 8 12 3 10Z"/>',device:'<rect x="3" y="3" width="18" height="13" rx="2"/><path d="M12 16v5M7 21h10"/>',history:'<path d="M3 12a9 9 0 1 0 3-7M3 3v6h6M12 7v5l3 2"/>'})[name]+'</svg>';
const delivery = { pending: 'Telegram: в очереди', sent: 'Отправлено в Telegram', failed: 'Telegram: ошибка доставки', unknown: 'Telegram: доставка не подтверждена', not_configured: 'Telegram не подключён' };
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const stamp = (value) => new Date(value).toLocaleString('ru-RU');

export function initPriceAlerts({ request, showToast, activateView, readOnly = false, getBootstrap = () => null }) {
  const existingNav = document.querySelector('[data-view="terminal"]');
  const existingAlertNav = document.querySelector('[data-view="alerts"]');
  const nav = existingAlertNav || document.createElement('button');
  nav.disabled = false;
  nav.type = 'button'; nav.className = 'nav-item'; nav.dataset.view = 'alerts';
  nav.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><span>Ценовые уведомления</span><span id="priceAlertCount" hidden></span>';
  if (!existingAlertNav) { existingNav.after(nav); nav.addEventListener('click', () => activateView('alerts', nav)); }
  const panel = document.createElement('section');
  panel.className = 'view'; panel.dataset.viewPanel = 'alerts';
  panel.innerHTML = `
    <header class="section-intro"><div><h2>Ценовые уведомления</h2><p>Следите за важными уровнями и получайте уведомления, когда цена достигает заданных значений.</p></div></header>
    <div class="alert-summary" aria-label="Сводка уведомлений"><div><span>Всего уведомлений</span><strong id="alertActiveTotal">0</strong><small id="alertEnabledTotal">активных: 0</small></div><div><span>Сработали</span><strong id="alertUnreadTotal">0</strong><small>в сохранённой истории</small></div><div><span>Telegram</span><strong id="alertTelegramState">Проверяем…</strong></div></div>
    <p id="priceAlertStatus" class="empty-copy" role="status">Проверяем подключение…</p>
    <button type="button" id="priceAlertSetup" class="button">Подключить доставку</button>
    <div class="alert-workspace"><form id="priceAlertForm" class="data-surface price-alert-form">
      <h3>Создать уведомление</h3>
      <label class="alert-instrument-label">Инструмент<div class="alert-instrument-field"><span id="alertSelectedMark" aria-hidden="true"></span><input name="symbol" list="alertInstrumentOptions" placeholder="Тикер или компания" maxlength="64" required autocomplete="off"></div><small id="alertSelectedName"></small></label>
      <datalist id="alertInstrumentOptions"></datalist><label class="alert-exchange-label">Биржа<input name="exchange" list="alertExchangeOptions" value="MOEX" placeholder="MOEX" maxlength="32" required autocomplete="off"></label><datalist id="alertExchangeOptions"><option value="MOEX">Московская биржа</option><option value="NASDAQ">NASDAQ</option><option value="NYSE">NYSE</option><option value="SPB">СПБ Биржа</option></datalist>
      <fieldset class="alert-condition-picker"><legend>Условие</legend><div role="group" aria-label="Условие цены"><button type="button" data-alert-condition="above" aria-pressed="false">↑ Выше</button><button type="button" data-alert-condition="below" aria-pressed="false">↓ Ниже</button><button type="button" data-alert-condition="crossing" aria-pressed="true">↕ Пересечение</button></div></fieldset><label hidden>Условие<select name="condition" tabindex="-1"><option value="crossing">Пересечение уровня</option><option value="above">Цена выше уровня</option><option value="below">Цена ниже уровня</option></select></label>
      <label>Целевая цена<input name="targetPrice" placeholder="250,50" inputmode="decimal" required autocomplete="off"></label>
      <details class="alert-plan-options"><summary>План действий</summary><label>Мой план<select name="intent"><option value="watch">Наблюдение</option><option value="buy">Покупка</option><option value="sell">Продажа</option></select></label></details>
      <label>Заметка<textarea name="note" rows="2" maxlength="1000" placeholder="Что проверить при достижении цены"></textarea></label>
      <label class="check-label alert-telegram-choice"><input type="checkbox" name="deliverTelegram"><span>Присылать в Telegram</span></label>
      <small id="alertTelegramHint">В приложении сигнал сохранится в любом случае.</small>
      <button type="submit" class="primary-button" disabled>Создать уведомление</button>
      <details class="price-alert-help"><summary>Как работают уведомления</summary><p>Настройте сигнал в TradingView после добавления уровня. Workspace сохраняет срабатывания и доставляет их в приложение и Telegram. Уведомление не отправляет заявку брокеру.</p></details>
      <div class="alert-chart-preview" id="alertChartPreview"><p>Введите тикер, чтобы увидеть сохранённый график.</p></div>
    </form>
    <article class="data-surface alert-rules-surface"><header class="surface-head"><h3 id="alertRulesTitle">Мои уведомления</h3></header><div id="priceAlertRules"><p class="empty-copy">Алертов пока нет.</p></div></article></div>
    <article class="data-surface"><header class="surface-head"><h3>История сигналов</h3><button type="button" id="priceAlertRefresh" hidden>Обновить</button></header><div id="priceAlertEvents"><p class="empty-copy">Здесь появятся сработавшие алерты.</p></div></article>`;
  document.querySelector('[data-view-panel="terminal"]').after(panel);
  const popup = document.createElement('dialog');
  popup.id = 'priceAlertDialog'; popup.setAttribute('aria-labelledby', 'priceAlertPopupTitle');
  popup.innerHTML = '<div class="dialog-card"><h2 id="priceAlertPopupTitle"></h2><p id="priceAlertPopupBody"></p><p id="priceAlertPopupTime" class="empty-copy"></p><p>Сработал ваш ценовой алерт. Сделка не совершалась.</p><button type="button" class="primary-button" id="priceAlertAcknowledge">Прочитано</button><button type="button" id="priceAlertLater">Закрыть</button></div>';
  document.body.append(popup);
  for (const button of [...panel.querySelectorAll('button'), ...popup.querySelectorAll('button')]) {
    button.classList.add('button');
    if (button.classList.contains('primary-button')) button.classList.add('primary');
  }
  const form = panel.querySelector('form');
  const summary=panel.querySelector('.alert-summary');
  for(const [index,name]of ['bell','history','telegram'].entries())summary.children[index].insertAdjacentHTML('afterbegin',icon(name));
  summary.insertAdjacentHTML('beforeend','<div>'+icon('device')+'<span>На этом устройстве</span><strong class="alert-device-state">В приложении</strong></div>');
  function selectedInstrument(symbol){
    const data=getBootstrap(), ticker=String(symbol||'').trim().toUpperCase();
    const instrument=(data?.instruments||[]).find(item=>item.ticker?.toUpperCase()===ticker)||{};
    const position=(data?.clientProduct?.openPositions||data?.positions||[]).find(item=>item.ticker?.toUpperCase()===ticker||instrument.instrumentUid&&item.instrumentUid===instrument.instrumentUid);
    return {instrument:{...instrument,name:issuerName(ticker,instrument.name)},position};
  }
  function priceText(value,currency='RUB'){return money(value,currency,{locale:'ru',target:currency});}
  function targetText(value,currency='RUB'){return String(value).replace('.',',')+' '+({RUB:'₽',USD:'$',EUR:'€',PTS:'п.'}[currency]||currency);}
  function syncCondition(){for(const button of panel.querySelectorAll('[data-alert-condition]'))button.setAttribute('aria-pressed',String(button.dataset.alertCondition===form.elements.condition.value));}
  for(const button of panel.querySelectorAll('[data-alert-condition]'))button.addEventListener('click',()=>{form.elements.condition.value=button.dataset.alertCondition;syncCondition();renderPreview();});
  function renderPreview(){
    const data=getBootstrap(),symbol=form.elements.symbol.value.trim().toUpperCase();
    const {instrument,position}=selectedInstrument(symbol);
    panel.querySelector('#alertSelectedMark').innerHTML=instrumentMark({...instrument,ticker:symbol});
    panel.querySelector('#alertSelectedName').textContent=instrument.name||'';
    watchInstrumentImages(panel.querySelector('#alertSelectedMark'));
    syncCondition();
    const rows=normalizeMarketCandles((data?.candles||[]).filter(row=>instrument&&row.instrumentUid===instrument.instrumentUid)).slice(-60);
    const host=panel.querySelector('#alertChartPreview');
    const heading='<h4>Текущая цена и график</h4><div class="alert-preview-quote">'+instrumentMark({...instrument,ticker:symbol})+'<span><strong>'+escape(symbol||'Инструмент')+'</strong><small>'+escape(instrument.name||'')+'</small></span><strong>'+escape(priceText(position?.currentPriceNanos,position?.priceCurrency||instrument.currency||'RUB'))+'</strong></div>';
    if(rows.length<2){host.innerHTML=heading+'<p>'+escape(symbol?'Нет сохранённой истории для '+symbol+'. Откройте актив в «Инструментах».':'Введите тикер, чтобы увидеть сохранённый график.')+'</p>';return;}
    const target=Number(form.elements.targetPrice.value.trim().replace(',','.')),hasTarget=Number.isFinite(target)&&target>0;
    const values=rows.map(row=>row.close),min=Math.min(...values,...(hasTarget?[target]:[])),max=Math.max(...values,...(hasTarget?[target]:[])),range=max-min||1;
    const y=value=>140-(value-min)/range*115;
    const path=rows.map((row,index)=>(index?'L':'M')+(12+index/(rows.length-1)*310).toFixed(1)+','+y(row.close).toFixed(1)).join(' ');
    host.innerHTML=heading+'<div><strong>'+escape(symbol)+'</strong><span>Сохранённые свечи</span></div><svg viewBox="0 0 338 160" role="img" aria-label="График сохранённой цены '+escape(symbol)+'"><path d="'+path+'" fill="none" stroke="#aa89ff" stroke-width="2"/>'+(hasTarget?'<path d="M10 '+y(target).toFixed(1)+'H326" fill="none" stroke="#41d5ae" stroke-dasharray="5 5"/><text x="14" y="'+Math.max(13,y(target)-7).toFixed(1)+'" fill="#41d5ae" font-size="10">Уровень '+escape(String(target))+'</text>':'')+'</svg>';
  }
  form.addEventListener('input',renderPreview);
  const status = panel.querySelector('#priceAlertStatus');
  if (readOnly) {
    status.textContent = 'Ценовые алерты доступны в основной версии приложения. В локальной проверке настройки и уведомления не изменяются.';
    for (const control of panel.querySelectorAll('button, input, select, textarea')) control.disabled = true;
    panel.querySelector('#priceAlertRules').textContent = 'Настройки алертов остаются в основной версии.';
    panel.querySelector('#priceAlertEvents').textContent = 'История сигналов доступна в основной версии.';
    form.addEventListener('submit', (event) => event.preventDefault());
    return;
  }
  let snapshot = null; let fetching = false; let stopped = false; let current = null; let timer;
  let rulesRevision = null; let eventsRevision = null;
  const shown = new Set(); const queue = [];

  function openNext() {
    if (popup.open || document.querySelector('dialog[open]') || !queue.length || document.hidden) return;
    current = queue.shift(); shown.add(current.id);
    popup.querySelector('h2').textContent = `${intents[current.intent] || 'Сигнал'} · ${current.symbol}`;
    popup.querySelector('#priceAlertPopupBody').textContent = `Ваш уровень: ${current.targetPrice}. Цена сигнала: ${current.actualPrice}. Биржа: ${current.exchange}.`;
    popup.querySelector('#priceAlertPopupTime').textContent = `${snapshot?.fixture ? 'Тестовый сигнал' : 'TradingView'} · ${stamp(current.sourceTime)}`;
    popup.showModal();
  }
  function render(data) {
    snapshot = data;
    panel.querySelector('#priceAlertSetup').hidden = Boolean(data.fixture || data.configured);
    status.hidden=Boolean(data.configured);
    status.textContent = !data.configured ? 'Доставка алертов ещё не подключена. Поддержка поможет связать TradingView и Telegram с вашим Workspace.'
      : data.fixture ? 'Демонстрационный режим: тестовые сигналы остаются в приложении; в Telegram ничего не отправляется.'
      : `Сервис алертов доступен. ${data.telegramConfigured ? 'Telegram настроен; результат доставки виден у каждого сигнала.' : 'Telegram ещё не подключён.'}`;
    form.querySelector('button[type="submit"]').disabled = !data.configured;
    const rows = data.rules || [];
    panel.querySelector('#alertInstrumentOptions').innerHTML=(getBootstrap()?.instruments||[]).filter(item=>item.ticker).map(item=>'<option value="'+escape(item.ticker)+'">'+escape(item.name)+'</option>').join('');
    panel.querySelector('#alertActiveTotal').textContent = String(rows.length);
    panel.querySelector('#alertEnabledTotal').textContent = 'активных: '+rows.filter(row=>row.enabled!==false).length;
    panel.querySelector('#alertRulesTitle').textContent='Мои уведомления ('+rows.length+')';
    panel.querySelector('#alertUnreadTotal').textContent = String((data.events || []).length);
    panel.querySelector('#alertTelegramState').textContent = data.fixture ? 'Демо' : data.telegramConfigured ? 'Подключён' : 'Не подключён';
    panel.querySelector('#alertTelegramState').classList.toggle('positive',Boolean(data.telegramConfigured&&!data.fixture));
    panel.querySelector('.alert-device-state').textContent='Активно';
    const telegramChoice = form.elements.deliverTelegram;
    telegramChoice.disabled = !data.fixture && !data.telegramConfigured;
    if (telegramChoice.disabled) telegramChoice.checked = false;
    panel.querySelector('#alertTelegramHint').textContent = data.fixture ? 'Учебный режим: реальные сообщения не отправляются.' : data.telegramConfigured ? 'В приложении сигнал сохранится в любом случае.' : 'Для доставки в Telegram сначала подключите её через поддержку.';
    const nextRulesRevision = JSON.stringify([rows, data.fixture, data.webhookUrl, data.telegramConfigured]);
    if (nextRulesRevision !== rulesRevision) {
    rulesRevision = nextRulesRevision;
    panel.querySelector('#priceAlertRules').innerHTML = rows.length ? '<div class="alert-table-scroll" tabindex="0" role="region" aria-label="Список ценовых уведомлений"><div class="alert-rule-head" aria-hidden="true"><span>Инструмент</span><span>Условие</span><span>Целевая цена</span><span>Текущая цена</span><span>Статус</span><span>Доставка</span><span></span></div>'+rows.map((r) => {
      const {instrument,position}=selectedInstrument(r.symbol), currency=position?.priceCurrency||instrument.currency||'RUB';
      return '<div class="price-alert-row alert-rule-row"><div class="alert-rule-identity">'+instrumentMark({...instrument,ticker:r.symbol})+'<div><strong>'+escape(r.symbol)+'</strong><small>'+escape(instrument.name||r.exchange)+'</small>'+(r.note?'<small class="alert-rule-note" title="'+escape(r.note)+'">'+escape(r.note)+'</small>':'')+'</div></div><span class="alert-rule-condition">'+(r.condition==='above'?'<span class="positive" aria-hidden="true">↑</span> ':r.condition==='below'?'<span class="negative" aria-hidden="true">↓</span> ':'↕ ')+escape(conditions[r.condition]||conditions.crossing)+'</span><div class="alert-rule-price"><strong>'+escape(targetText(r.targetPrice,currency))+'</strong></div><div class="alert-current-quote" data-alert-quote="'+escape(r.symbol)+'">'+escape(priceText(position?.currentPriceNanos,currency))+'</div><span class="alert-rule-state '+(r.enabled!==false?'positive':'')+'">'+(r.enabled!==false?'● Активно':'Ⅱ Пауза')+'</span><label class="check-label alert-delivery"><input type="checkbox" data-alert-delivery="'+escape(r.id)+'" '+(r.deliverTelegram!==false?'checked':'')+' '+(!data.fixture&&!data.telegramConfigured&&r.deliverTelegram===false?'disabled':'')+'><span>'+icon('telegram')+'<span class="sr-only">Telegram</span></span></label><details class="price-alert-actions"><summary aria-label="Действия с уведомлением '+escape(r.symbol)+'">⋮</summary><div><button type="button" data-alert-setup="'+escape(r.id)+'">Настроить</button>'+(data.fixture?'<button type="button" data-alert-test="'+escape(r.id)+'">Тест</button>':'')+'<button type="button" data-alert-delete="'+escape(r.id)+'" aria-label="Отключить уведомление '+escape(r.symbol)+'">Отключить</button></div></details><div class="price-alert-setup" id="alert-setup-'+escape(r.id)+'" hidden></div></div>';
    }).join('')+'</div>' : '<div class="alert-empty">'+icon('bell')+'<h4>Здесь будут ваши уровни</h4><p>Выберите инструмент и целевую цену. Сработавшие сигналы сохранятся в истории.</p></div>';
    }
    for(const node of panel.querySelectorAll('[data-alert-quote]')){const {instrument,position}=selectedInstrument(node.dataset.alertQuote);node.textContent=priceText(position?.currentPriceNanos,position?.priceCurrency||instrument.currency||'RUB');}
    if(document.activeElement?.form!==form)renderPreview();
    watchInstrumentImages(panel.querySelector('#priceAlertRules'));
    const events = data.events || [];
    const nextEventsRevision = JSON.stringify(events);
    if (nextEventsRevision !== eventsRevision) {
    eventsRevision = nextEventsRevision;
    panel.querySelector('#priceAlertEvents').innerHTML = events.length ? events.map((e) => `<div class="price-alert-row"><div><strong>${escape(intents[e.intent])} · ${escape(e.symbol)}</strong><p>Уровень ${escape(e.targetPrice)} · сигнал ${escape(e.actualPrice)}</p><small>${escape(stamp(e.sourceTime))} · ${escape(e.telegramErrorCode === 'TELEGRAM_DISABLED_BY_USER' ? 'Только в приложении' : delivery[e.telegramStatus] || 'Статус доставки неизвестен')}</small></div><button type="button" data-alert-event="${escape(e.id)}">${e.readAt ? 'Посмотреть' : 'Новый сигнал'}</button></div>`).join('') : '<p class="empty-copy">Сработавших алертов пока нет.</p>';
    }
    for (const button of panel.querySelectorAll('.price-alert-row button')) button.classList.add('button');
    const unread = events.filter((e) => !e.readAt);
    const badge = nav.querySelector('#priceAlertCount'); badge.hidden = !unread.length; badge.textContent = String(unread.length);
    for (const e of [...unread].reverse()) if (!shown.has(e.id) && !queue.some((q) => q.id === e.id) && current?.id !== e.id) queue.push(e);
    openNext();
  }
  async function refresh() {
    if (fetching || stopped) return;
    fetching = true;
    try { render(await request('/api/alerts')); }
    catch { status.hidden=false; status.textContent = 'Не удалось проверить уведомления. Повторяем автоматически; сохранённый список остаётся на экране.'; form.querySelector('button[type="submit"]').disabled = true; }
    finally { fetching = false; }
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); const button = form.querySelector('button[type="submit"]'); button.disabled = true;
    try {
      const values = Object.fromEntries(new FormData(form));
      values.deliverTelegram = form.elements.deliverTelegram.checked;
      values.targetPrice = values.targetPrice.trim().replace(',', '.');
      await request('/api/alerts/rules', { method: 'POST', body: JSON.stringify(values) });
      form.reset(); renderPreview(); await refresh(); showToast('Алерт сохранён. Теперь настройте его в TradingView.');
    } catch (error) { showToast(error.message, true); }
    finally { button.disabled = !snapshot?.configured; }
  });
  panel.addEventListener('change', async (event) => {
    const input = event.target.closest('[data-alert-delivery]'); if (!input) return;
    const enabled = input.checked; input.disabled = true;
    try {
      await request(`/api/alerts/rules/${input.dataset.alertDelivery}`, { method: 'PATCH', body: JSON.stringify({ deliverTelegram: enabled }) });
      await refresh(); showToast(enabled ? 'Telegram включён для новых сигналов.' : 'Сигналы останутся только в приложении.');
    } catch (error) { input.checked = !enabled; showToast(error.message, true); }
    finally { input.disabled = false; }
  });
  panel.addEventListener('click', async (event) => {
    const button = event.target.closest('button'); if (!button) return;
    const id = button.dataset.alertSetup || button.dataset.alertDelete || button.dataset.alertTest;
    const menu=button.closest('.price-alert-actions');if(menu)menu.open=false;
    try {
      if (button.dataset.alertSetup) {
        const rule = snapshot.rules.find((r) => r.id === id); if (!rule) return;
        const target = panel.querySelector(`#alert-setup-${id}`); target.hidden = !target.hidden;
        if (target.hidden) return;
        target.replaceChildren();
        const info = document.createElement('p');
        info.textContent = `В TradingView откройте ${rule.exchange}:${rule.symbol}, выберите условие «${conditions[rule.condition]||conditions.crossing}» и уровень ${rule.targetPrice}. В уведомлениях включите Webhook URL и вставьте адрес ниже, а в сообщение — JSON. Для webhook нужна двухфакторная аутентификация TradingView.`;
        target.append(info);
        const urlField = document.createElement('input'); urlField.readOnly = true; urlField.setAttribute('aria-label', 'Адрес webhook');
        urlField.value = snapshot.webhookUrl || 'Тестовый режим: внешний адрес не подключён'; target.append(urlField);
        const message = document.createElement('textarea'); message.readOnly = true; message.rows = 7; message.setAttribute('aria-label', 'Сообщение для TradingView');
        message.value = JSON.stringify({ ruleId: rule.id, symbol: '{{ticker}}', exchange: '{{exchange}}', price: '{{close}}', sourceTime: '{{timenow}}' }, null, 2); target.append(message);
        const note = document.createElement('p'); note.textContent = 'Отключение здесь прекращает приём сигнала. Сам алерт в TradingView удаляется отдельно.'; target.append(note);
      } else if (button.dataset.alertDelete) {
        button.disabled = true; await request(`/api/alerts/rules/${id}`, { method: 'DELETE' }); await refresh();
      } else if (button.dataset.alertTest) {
        button.disabled = true; await request(`/api/alerts/rules/${id}/test`, { method: 'POST', body: '{}' }); await refresh();
      } else if (button.dataset.alertEvent) {
        const item = snapshot.events.find((e) => e.id === button.dataset.alertEvent);
        if (item && !popup.open) { queue.unshift(item); openNext(); }
      }
    } catch (error) { showToast(error.message, true); }
    finally { button.disabled = false; }
  });
  popup.querySelector('#priceAlertAcknowledge').addEventListener('click', async (event) => {
    if (!current) return; event.target.disabled = true;
    try { await request(`/api/alerts/events/${current.id}/read`, { method: 'POST', body: '{}' }); popup.close(); await refresh(); }
    catch (error) { showToast(error.message, true); }
    finally { event.target.disabled = false; }
  });
  popup.querySelector('#priceAlertLater').addEventListener('click', () => popup.close());
  popup.addEventListener('close', () => { current = null; setTimeout(openNext, 100); });
  panel.querySelector('#priceAlertRefresh').addEventListener('click', refresh);
  panel.querySelector('#priceAlertSetup').addEventListener('click', async (event) => {
    event.target.disabled = true;
    try { await request('/api/alerts/setup', { method: 'POST', body: '{}' }); await refresh(); }
    catch (error) { showToast(error.message, true); }
    finally { event.target.disabled = false; }
  });
  const visibility = () => { if (!document.hidden) { refresh(); openNext(); } };
  document.addEventListener('visibilitychange', visibility);
  timer = setInterval(() => { if (!document.hidden) { refresh(); openNext(); } }, 10000);
  refresh();
  window.addEventListener('pagehide', () => { stopped = true; clearInterval(timer); });
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    stopped = false; refresh();
    timer = setInterval(() => { if (!document.hidden) { refresh(); openNext(); } }, 10000);
  });
}
