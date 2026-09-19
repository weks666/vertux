(function () {
  'use strict';

  if (customElements.get('vertux-service-center')) return;

  const VERSION = '1.3.0';
  const SECTIONS = ['subscription', 'support', 'access'];
  const assetBaseUrl = new URL('.', document.currentScript?.src || window.location.href).href;
  const escapeText = (value) => String(value ?? '').replace(/[&<>"']/gu, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
  const dateText = (value, withTime = false) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    }).format(date);
  };
  const quantityText = (value) => Number(value || 0).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
  const statusLabel = {
    trial: 'Пробный период',
    active: 'Активна',
    past_due: 'Ожидает оплаты',
    grace: 'Льготный период',
    suspended: 'Приостановлена',
    provisioning: 'Подготавливается',
    open: 'Открыто',
    in_progress: 'В работе',
    waiting: 'Ждёт ответа',
    waiting_client: 'Ждёт клиента',
    resolved: 'Решено',
    closed: 'Закрыто',
    pending: 'Ожидает активации',
    used: 'Активировано',
    expired: 'Истекло',
    revoked: 'Отозвано',
  };
  const roleLabel = {
    owner: 'Владелец',
    admin: 'Администратор',
    manager: 'Менеджер',
    viewer: 'Наблюдатель',
  };
  const metricLabel = {
    'ai.tokens': 'AI-токены',
    'ai.cost_minor': 'AI-расход',
    'widget.conversation': 'Диалоги',
    'storage.bytes': 'Хранилище',
    'support.hours': 'Поддержка',
    'node.heartbeat': 'Сигналы Node',
  };
  const sectionLabel = {
    subscription: 'Подписка',
    support: 'Поддержка',
    access: 'Доступы',
  };
  const supportCategories = Object.freeze({
    general: 'Общий вопрос',
    connection: 'Подключение',
    data: 'Данные и синхронизация',
    billing: 'Подписка и оплата',
    account: 'Аккаунт и доступ',
    suggestion: 'Предложение',
  });
  const emptyTicketDraft = () => ({ category: 'general', subject: '', priority: 'normal', message: '' });
  const icon = (name) => {
    const paths = {
      telegram: '<circle cx="12" cy="12" r="12" fill="#229ed9" stroke="none"/><path d="m5.1 11.7 12.4-4.8c.6-.2 1.1.2.9.9l-2.1 9.8c-.1.7-.6.9-1.2.5l-3.2-2.4-1.6 1.5c-.2.2-.3.3-.6.3l.2-3.3 6-5.4c.3-.2-.1-.4-.4-.2l-7.4 4.7-3.2-1c-.7-.2-.7-.6.2-.9Z" fill="white" stroke="none"/>',
      external: '<path d="M14 3h7v7M21 3l-9 9"/><path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/>',
      check: '<path d="m5 12 4 4L19 6"/>',
    };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.check}</svg>`;
  };

  class VertuxServiceCenter extends HTMLElement {
    static get observedAttributes() {
      return ['section', 'hide-header'];
    }

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.state = {
        loading: true,
        section: this.normalizedSection(this.getAttribute('section')),
        data: null,
        error: '',
        notice: '',
        busy: false,
        invite: null,
        ticketId: null,
        messages: [],
        ticketDraft: emptyTicketDraft(),
        ticketRequestId: null,
        ticketRequestFingerprint: '',
        replyDraft: '',
        replyRequestId: null,
        replyRequestMessage: '',
        editMemberId: null,
        billingMonths: 1,
        billingTermsAccepted: false, billingPrivacyAcknowledged: false,
        billingRequestId: null,
      };
      const stylesheet = document.createElement('link');
      stylesheet.rel = 'stylesheet';
      stylesheet.href = `${assetBaseUrl}vertux-service-center.css?v=${VERSION}`;
      this.stylesReady = new Promise((resolve) => {
        stylesheet.addEventListener('load', () => resolve(true), { once: true });
        stylesheet.addEventListener('error', () => resolve(false), { once: true });
      });
      this.contentRoot = document.createElement('div');
      this.contentRoot.className = 'vsc-root';
      this.contentRoot.setAttribute('aria-live', 'polite');
      this.shadowRoot.append(stylesheet, this.contentRoot);
      this.hasLoaded = false;
    }

    connectedCallback() {
      if (this.hasLoaded) return;
      this.hasLoaded = true;
      this.hidden = true;
      this.render();
      this.load();
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) return;
      if (name === 'section') {
        this.openSection(newValue, false);
      } else if (name === 'hide-header') {
        this.render();
      }
    }

    normalizedSection(value) {
      return SECTIONS.includes(value) ? value : 'subscription';
    }

    openSection(section, emit = true) {
      const next = this.normalizedSection(section);
      this.state.section = next;
      this.state.invite = null;
      this.state.editMemberId = null;
      this.state.notice = '';
      this.render();
      if (emit) {
        this.dispatchEvent(new CustomEvent('vertux-service-section-change', {
          bubbles: true,
          composed: true,
          detail: { section: next },
        }));
      }
    }

    get bridge() {
      return this.serviceAdapter || (window.nexusProduct && window.nexusProduct.service);
    }

    selectSubscriptionTerm(months) {
      if (![1, 3, 12].includes(months) || this.state.busy) return false;
      this.state.billingMonths = months;
      this.state.billingTermsAccepted = false;
      this.state.billingPrivacyAcknowledged = false;
      this.state.billingRequestId = null;
      this.render();
      return true;
    }

    async call(action, ...args) {
      const method = this.bridge && this.bridge[action];
      if (typeof method !== 'function') throw new Error('Сервисный мост Workspace не подключён');
      const result = await method(...args);
      if (!result || result.ok !== true) throw new Error(result?.error?.message || 'Nexus не выполнил запрос');
      return result.data;
    }

    async load() {
      this.state.loading = true;
      this.state.error = '';
      this.render();

      let overview = null;
      let overviewError = '';
      try {
        overview = await this.call('overview');
      } catch (error) {
        overviewError = error.message || String(error);
      }
      const stylesLoaded = await this.stylesReady;

      if (overview) {
        this.state.data = overview;
        const allowed = overview.module?.sections || SECTIONS;
        if (!allowed.includes(this.state.section)) this.state.section = 'subscription';
      }
      this.state.error = stylesLoaded
        ? overviewError
        : 'Не удалось загрузить оформление системного модуля Vertux';
      this.state.loading = false;
      this.render();

      if (stylesLoaded) this.hidden = false;
      if (stylesLoaded && overview && !overviewError) {
        const allowed = overview.module?.sections || SECTIONS;
        this.dispatchEvent(new CustomEvent('vertux-service-center-ready', {
          bubbles: true,
          composed: true,
          detail: {
            version: VERSION,
            sections: allowed,
            productId: overview.currentProduct?.id || null,
          },
        }));
      } else {
        this.dispatchEvent(new CustomEvent('vertux-service-center-error', {
          bubbles: true,
          composed: true,
          detail: {
            fatal: !stylesLoaded,
            message: this.state.error,
          },
        }));
      }
    }

    render() {
      const data = this.state.data;
      let content = '<div class="state-card"><span class="spinner" aria-hidden="true"></span><div><b>Подключаю Vertux</b><p>Получаю актуальные данные из Nexus…</p></div></div>';
      if (!this.state.loading && this.state.error) {
        content = `<div class="state-card error" role="alert"><div><b>Системный модуль временно недоступен</b><p>${escapeText(this.state.error)}</p></div><button class="button" data-action="reload">Повторить</button></div>`;
      } else if (!this.state.loading && data) {
        const embeddedSection = this.hasAttribute('section');
        content = `<div class="shell">
          ${this.hasAttribute('hide-header') ? '' : this.renderHeader()}
          ${embeddedSection ? '' : this.renderNavigation()}
          ${this.state.notice ? `<div class="notice" role="status">${escapeText(this.state.notice)}</div>` : ''}
          <main class="body" data-section="${escapeText(this.state.section)}">${this.renderSection()}</main>
        </div>`;
      }
      this.contentRoot.innerHTML = content;
      this.contentRoot.setAttribute('aria-busy', this.state.loading || this.state.busy ? 'true' : 'false');
      this.bind();
    }

    renderHeader() {
      const data = this.state.data;
      const canSwitch = Boolean(data.capabilities?.switchProducts || data.products?.length > 1);
      return `<header class="context">
        <div class="context-mark" aria-hidden="true">V</div>
        <div class="context-copy">
          <span class="eyebrow">Системные функции Vertux</span>
          <strong>${escapeText(data.currentProduct?.name || 'Workspace')}</strong>
          <span>${escapeText(data.organization?.name || '')}</span>
        </div>
        <div class="context-actions">
          ${canSwitch ? '<button class="button subtle" type="button" data-action="switch-product">Сменить продукт</button>' : ''}
          <button class="icon-button" type="button" data-action="reload" aria-label="Обновить данные" title="Обновить">↻</button>
        </div>
      </header>`;
    }

    renderNavigation() {
      return `<nav class="section-nav" aria-label="Системные разделы">
        ${SECTIONS.map((section) => `<button type="button" class="${this.state.section === section ? 'active' : ''}" data-section="${section}" aria-current="${this.state.section === section ? 'page' : 'false'}">${sectionLabel[section]}</button>`).join('')}
      </nav>`;
    }

    renderSection() {
      if (this.state.section === 'support') return this.renderSupport();
      if (this.state.section === 'access') return this.renderAccess();
      return this.renderSubscription();
    }

    renderSubscription() {
      const data = this.state.data;
      if (data.standardSubscription) return this.renderStandardSubscription(data.standardSubscription);
      const subscription = data.subscription;
      if (!subscription) {
        return '<div class="empty"><b>Подписка ещё не зарегистрирована</b><p>Здесь появятся только подтверждённые условия из Nexus. Демонстрационных тарифов нет.</p></div>';
      }
      const price = subscription.priceSnapshot?.priceMinor == null
        ? 'По договору'
        : `${(Number(subscription.priceSnapshot.priceMinor) / 100).toLocaleString('ru-RU')} ${escapeText(subscription.priceSnapshot.currency || 'RUB')}`;
      const usage = data.usage;
      const customerUsageTotals = Array.isArray(usage?.totals)
        ? usage.totals.filter((item) => Object.prototype.hasOwnProperty.call(metricLabel, item.metric))
        : [];
      const realUsage = Boolean(usage?.available && usage?.measured && customerUsageTotals.length);
      return `<div class="stack">
        <section class="summary-grid" aria-label="Состояние подписки">
          <article class="metric"><span>Состояние</span><strong>${escapeText(statusLabel[subscription.status] || subscription.status)}</strong></article>
          <article class="metric"><span>Тариф</span><strong>${escapeText(subscription.planName || subscription.planCode || '—')}</strong></article>
          <article class="metric"><span>Текущий период до</span><strong>${dateText(subscription.periodEnd)}</strong></article>
          ${data.capabilities.viewCommercialDetails ? `<article class="metric"><span>Стоимость</span><strong>${price}</strong></article>` : ''}
        </section>
        <section class="panel">
          <div class="panel-title"><h3>Что входит в план</h3></div>
          ${this.renderPlanFeatures(subscription.features)}
          ${subscription.entitlements?.length ? `<div class="rows compact">${subscription.entitlements.map((item) => `<div class="row">
            <div class="row-main"><b>${escapeText(item.entitlement_key)}</b><span>${item.product_id ? 'Лимит продукта' : 'Лимит компании'}</span></div>
            <span class="status">${item.enabled ? escapeText(item.limit_value ?? 'Включено') : 'Выключено'}</span>
          </div>`).join('')}</div>` : ''}
        </section>
        ${realUsage ? `<section class="panel">
          <div class="panel-title"><div><span class="eyebrow">Только измеренные данные</span><h3>Фактическое использование за ${escapeText(usage.periodDays)} дней</h3></div></div>
          <div class="usage-grid">${customerUsageTotals.map((item) => `<div class="usage-item"><span>${escapeText(metricLabel[item.metric])}</span><strong>${quantityText(item.quantity)}</strong></div>`).join('')}</div>
        </section>` : ''}
      </div>`;
    }

    renderPlanFeatures(features) {
      const available = Array.isArray(features) ? features.filter(feature => typeof feature === 'string' && feature.trim()) : [];
      return available.length
        ? `<ul class="plan-features">${available.map(feature => `<li>${icon('check')}<span>${escapeText(feature)}</span></li>`).join('')}</ul>`
        : '<p class="muted">Состав плана пока не указан. Уточните его у поддержки.</p>';
    }

    renderStandardSubscription(billing) {
      const money = minor => `${(minor / 100).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`;
      const current = billing.subscription;
      const pending = billing.orders.find(order => ['created','pending','review'].includes(order.status));
      const selected = billing.catalog.terms.find(term => term.months === (pending?.months || this.state.billingMonths)) || billing.catalog.terms[0];
      const disabled = this.state.busy || !billing.checkoutEnabled || Boolean(pending);
      const labels = { created: 'Создание оплаты не завершено', pending: 'Ожидает оплаты', applied: 'Оплачено', canceled: 'Отменено платёжной системой', review: 'Оплата требует проверки поддержки' };
      return `<div class="subscription-layout">
        <section class="panel current-plan" aria-label="Состояние подписки">
          <div class="panel-title"><h3>Текущий план</h3></div>
          <div class="plan-identity"><span class="plan-symbol" aria-hidden="true">${icon('check')}</span><div><h3>Invest Workspace</h3><p><span class="status">${escapeText(statusLabel[current?.status] || (current ? current.status : 'Ещё не оформлена'))}</span>${current?.periodEnd ? `<span class="plan-date">Доступ до ${dateText(current.periodEnd)}</span>` : ''}</p></div></div>
          <h4>Что входит в план</h4>${this.renderPlanFeatures(billing.catalog.features)}
          <p class="privacy-note">Состав возможностей одинаковый для всех сроков подписки.</p>
          <div class="plan-ai-note"><strong>AI-анализ</strong><p class="muted">Модель ещё не подключена. Дополнительные AI-пакеты пока не продаются.</p></div>
        </section>
        <section class="panel billing-purchase"><div class="panel-title"><h3>Продлить подписку</h3></div>
          <p class="muted">Одинаковые возможности при любом сроке. Оплата целиком за выбранный период, без автоматических списаний.</p>
          ${billing.testMode ? '<p class="notice">Тестовый магазин: реальные деньги не списываются.</p>' : ''}
          ${billing.catalog.pricingStatus === 'draft' ? '<p class="muted">Цены — черновик до запуска продаж.</p>' : ''}
          <fieldset class="billing-terms" ${this.state.busy || pending ? 'disabled' : ''}><legend>Срок подписки</legend>
            ${billing.catalog.terms.map(term => `<label class="billing-term"><input type="radio" name="billing-months" value="${term.months}" ${selected.months === term.months ? 'checked' : ''}>
              <span><b>${escapeText(term.label)}</b><strong>${money(term.amountMinor)}</strong><small>${money(term.amountMinor / term.months)} в месяц${term.months > 1 ? ` · экономия ${money(billing.catalog.monthlyPriceMinor * term.months - term.amountMinor)}` : ''}</small></span></label>`).join('')}
          </fieldset>
          <p class="muted">При раннем продлении оплаченный срок добавляется к текущему. После окончания доступа новый срок начинается с подтверждения оплаты.</p>
          ${billing.mayManage ? `${billing.termsUrl ? `<label class="billing-consent"><input type="checkbox" data-billing-consent ${this.state.billingTermsAccepted ? 'checked' : ''} ${this.state.busy ? 'disabled' : ''}> <span>Принимаю <a data-billing-terms href="${escapeText(billing.termsUrl)}" target="_blank" rel="noopener noreferrer">публичную оферту</a></span></label>` : ''}
            <label class="billing-consent"><input type="checkbox" data-billing-privacy ${this.state.billingPrivacyAcknowledged ? 'checked' : ''} ${this.state.busy ? 'disabled' : ''}><span>Ознакомлен с <a href="${escapeText(billing.privacyUrl || 'https://vertux.online/nexus/privacy.html')}" target="_blank" rel="noopener noreferrer">политикой обработки данных</a></span></label>
            <button class="button primary" data-billing-checkout ${disabled || !this.state.billingTermsAccepted || !this.state.billingPrivacyAcknowledged ? 'disabled' : ''}>Оплатить ${money(selected.amountMinor)}</button>
            ${billing.unavailableReason ? `<p class="muted">${escapeText(billing.unavailableReason)}</p>` : ''}` : '<p class="muted">Оплатой управляет владелец или администратор аккаунта.</p>'}
        </section>
        ${billing.mayManage ? `<section class="panel subscription-history"><div class="panel-title"><h3>История подписки и оплаты</h3></div><div class="rows">
          ${billing.orders.map(order => `<article class="row"><div class="row-main"><b>${money(order.amountMinor)} · ${order.months} мес.</b><span>${escapeText(labels[order.status] || order.status)} · ${dateText(order.createdAt, true)}</span>
            ${order.periodEnd ? `<span>Добавленный период: ${dateText(order.periodStart)} — ${dateText(order.periodEnd)}</span>` : ''}</div>
            ${order.confirmationUrl ? `<button class="button" data-billing-open="${escapeText(order.id)}" ${this.state.busy ? 'disabled' : ''}>Перейти к оплате</button>` : ''}
            ${['pending','created'].includes(order.status) ? `<button class="button subtle" data-billing-refresh="${escapeText(order.id)}" ${this.state.busy ? 'disabled' : ''}>${order.status === 'created' ? 'Повторить создание' : 'Проверить оплату'}</button>` : ''}
          </article>`).join('') || '<div class="empty small"><b>История пока пуста</b><p>Здесь появятся оплаты и продления вашей подписки.</p></div>'}</div></section>` : ''}
      </div>`;
    }

    async billingAction(action, orderId) {
      if (this.state.busy) return;
      const billing = this.state.data.standardSubscription;
      const order = billing.orders.find(item => item.id === orderId);
      this.state.busy = true;
      this.state.notice = '';
      this.render();
      try {
        if (action === 'terms') {
          await this.call('subscriptionOpenTerms');
        } else if (action === 'open') {
          if (typeof this.bridge?.subscriptionOpenPayment === 'function') await this.call('subscriptionOpenPayment', { orderId });
          else if (!window.nexusProduct) {
            const url = new URL(order?.confirmationUrl);
            if (url.protocol !== 'https:' || url.username || url.password || url.port || !['yoomoney.ru','yookassa.ru','auth.robokassa.ru'].includes(url.hostname)) throw new Error('Ссылка оплаты недоступна');
            window.open(url.href, '_blank', 'noopener,noreferrer');
          } else throw new Error('Обновите Nexus, чтобы открыть оплату, или откройте раздел «Подписка и оплата» из списка продуктов в браузере.');
        } else {
          let result;
          if (action === 'checkout' || order?.status === 'created') {
            this.state.billingRequestId ||= crypto.randomUUID();
            result = await this.call('subscriptionCheckout', { months: order?.months || this.state.billingMonths,
              requestId: order?.requestId || this.state.billingRequestId, termsVersion: billing.termsVersion,
              acceptedTerms: order?.status === 'created' || this.state.billingTermsAccepted, privacyVersion:billing.privacyVersion,privacyAcknowledged:this.state.billingPrivacyAcknowledged });
          } else result = await this.call('subscriptionRefresh', { orderId });
          // Read authoritative dates after payment; a returned browser URL is never proof of payment.
          this.state.data = await this.call('overview');
          if (result.status !== 'created') this.state.billingRequestId = null;
          this.state.notice = result.status === 'applied' ? 'Оплата подтверждена. Срок подписки обновлён.'
            : result.status === 'pending' ? 'Оплата создана. Откройте её из истории, затем проверьте статус.'
            : result.status === 'canceled' ? 'Оплата отменена. Можно выбрать срок и попробовать снова.' : 'Статус оплаты обновлён.';
        }
      } catch (cause) {
        this.state.notice = cause.message || 'Не удалось обновить подписку. Повторите попытку.';
        try { this.state.data = await this.call('overview'); } catch { /* Keep the visible data and retry controls. */ }
      } finally {
        this.state.busy = false;
        this.render();
        this.shadowRoot.querySelector('[role="status"]')?.setAttribute('tabindex', '-1');
        this.shadowRoot.querySelector('[role="status"]')?.focus();
      }
    }

    renderSupport() {
      const tickets = [...(this.state.data.support?.tickets || [])].sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
      const selected = tickets.find((ticket) => ticket.id === this.state.ticketId);
      const draft = this.state.ticketDraft;
      const ticketRow = ticket => `<button class="row selectable ${selected?.id === ticket.id ? 'selected' : ''}" type="button" data-ticket="${escapeText(ticket.id)}" ${this.state.busy ? 'disabled' : ''}>
        <span class="row-main"><b>${escapeText(ticket.subject)}</b><span>${escapeText(ticket.product_name || 'Общий вопрос')}</span></span>
        <span class="status" data-status="${escapeText(ticket.status)}">${escapeText(statusLabel[ticket.status] || ticket.status)}</span><time>${dateText(ticket.updated_at)}</time><span class="ticket-arrow" aria-hidden="true">›</span>
      </button>`;
      return `<div class="stack support-page">
        <div class="support-top">
          <section class="panel support-contact">
            <div class="panel-title"><h3>Связаться с Vertux</h3></div>
            <div class="contact-description"><span class="contact-symbol">${icon('telegram')}</span><div><strong>Поддержка в Telegram</strong><p class="muted">Задайте вопрос команде Vertux или оставьте обращение здесь.</p></div></div>
            <a class="button telegram-link" href="https://t.me/VertuxManager" target="_blank" rel="noopener noreferrer">Написать в Telegram ${icon('external')}</a>
            <a class="support-email" href="mailto:support@vertux.online">support@vertux.online</a>
            <p class="privacy-note">Откроется Telegram в отдельном окне.</p>
          </section>
          <section class="panel compose">
            <div class="panel-title"><h3>Создать запрос</h3></div><p class="muted compose-intro">Опишите вопрос, и мы поможем вам разобраться.</p>
            ${this.state.data.capabilities.createSupportTicket ? `<form class="form" data-form="ticket">
              <div class="form-grid">
                <label><span>Категория</span><select name="category" ${this.state.busy ? 'disabled' : ''}>${Object.entries(supportCategories).map(([key, label]) => `<option value="${key}" ${draft.category === key ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
                <label><span>Тема</span><input name="subject" required minlength="3" maxlength="128" value="${escapeText(draft.subject)}" placeholder="Кратко опишите вопрос" ${this.state.busy ? 'disabled' : ''}></label>
              </div>
              <label><span>Описание</span><textarea name="message" required minlength="3" maxlength="4900" placeholder="Что вы хотели сделать и что произошло?" aria-describedby="support-privacy" ${this.state.busy ? 'disabled' : ''}>${escapeText(draft.message)}</textarea></label>
              <div class="support-submit"><label><span>Приоритет</span><select name="priority" ${this.state.busy ? 'disabled' : ''}><option value="normal" ${draft.priority === 'normal' ? 'selected' : ''}>Обычный</option><option value="high" ${draft.priority === 'high' ? 'selected' : ''}>Высокий</option><option value="urgent" ${draft.priority === 'urgent' ? 'selected' : ''}>Срочный</option><option value="low" ${draft.priority === 'low' ? 'selected' : ''}>Низкий</option></select></label><button class="button primary" type="submit" ${this.state.busy ? 'disabled' : ''}>Отправить в поддержку</button></div>
              <p class="privacy-note" id="support-privacy">Пароли, коды из писем и ключи брокера не отправляйте.</p>
            </form>` : '<div class="empty small"><p>Глобальный администратор работает со входящей очередью в Nexus Admin.</p></div>'}
          </section>
        </div>
        <div class="support-bottom">
        <section class="panel support-history">
          <div class="panel-title"><h3>Мои обращения</h3><span class="counter" aria-label="Количество обращений">${tickets.length}</span></div>
          <div class="rows ticket-list">${tickets.slice(0, 5).map(ticketRow).join('') || '<div class="empty small"><b>Обращений пока нет</b><p>Ваши вопросы и ответы поддержки появятся здесь.</p></div>'}</div>
          ${tickets.length > 5 ? `<details class="older-tickets" ${tickets.slice(5).some(ticket => ticket.id === selected?.id) ? 'open' : ''}><summary>Все обращения · ещё ${tickets.length - 5}</summary><div class="rows ticket-list">${tickets.slice(5).map(ticketRow).join('')}</div></details>` : ''}
          ${selected ? `<div class="conversation">
            <div class="messages">${this.state.messages.map((message) => `<article class="message"><span>${escapeText(message.author_name)} · ${dateText(message.created_at, true)}</span><p>${escapeText(message.body)}</p></article>`).join('') || '<p class="muted">Загружаю переписку…</p>'}</div>
            ${this.state.data.capabilities.replySupportTicket ? `<form class="form" data-form="reply">
              <input type="hidden" name="ticketId" value="${escapeText(selected.id)}">
              <label><span>Ответ</span><textarea name="message" required minlength="2" maxlength="5000" ${this.state.busy ? 'disabled' : ''}>${escapeText(this.state.replyDraft)}</textarea></label>
              <button class="button primary" type="submit" ${this.state.busy ? 'disabled' : ''}>Отправить ответ</button>
            </form>` : ''}
          </div>` : ''}
        </section>
        <section class="panel support-faq">
          <div class="panel-title"><h3>Частые вопросы</h3></div>
          <details><summary>Какие данные приложить к вопросу?</summary><p>Укажите раздел, последовательность действий и текст ошибки. На снимке экрана скройте личные данные. Пароли и ключи доступа поддержке не нужны.</p></details>
          <details><summary>Данные не обновляются. Что проверить?</summary><p>Проверьте интернет и статус подключения в Workspace, затем повторите обновление. Если ошибка остаётся, укажите её текст и время в обращении.</p></details>
          <details><summary>Где посмотреть срок подписки?</summary><p>В разделе «Подписка» показаны текущий статус, срок доступа и доступные условия продления. Подтверждение оплаты должно появиться в Nexus.</p></details>
          <details><summary>Как войти на другом компьютере?</summary><p>Установите Nexus и войдите в свой аккаунт. Список устройств и управление доступом находятся в настройках. Локальные данные Workspace и ключи брокера остаются на том компьютере, где вы их добавили.</p></details>
          <details><summary>Как подключиться по приглашению?</summary><p>Введите код компании в профиле Nexus. Приглашение добавит выданные вам продукты к вашему аккаунту.</p></details>
          <aside class="support-tip"><strong>Совет</strong><p>Укажите раздел и последовательность действий — это поможет быстрее разобраться в вопросе.</p></aside>
        </section>
        </div>
      </div>`;
    }

    renderAccess() {
      const access = this.state.data.access;
      const invite = this.state.invite;
      return `<div class="access-layout">
        <section class="panel">
          <div class="panel-title"><div><span class="eyebrow">Nexus — источник правды</span><h3>Участники</h3></div><span class="counter">${access.members.length}</span></div>
          <div class="member-list">${access.members.map((member) => this.renderMember(member, access)).join('') || '<div class="empty small"><p>Участников нет.</p></div>'}</div>
          ${access.invitations.length ? `<div class="subsection"><h4>Приглашения</h4><div class="rows">${access.invitations.map((item) => `<div class="row">
            <div class="row-main"><b>${escapeText(item.email)}</b><span>${escapeText(roleLabel[item.role] || item.role)} · активировать до ${dateText(item.expiresAt, true)}</span><span>${escapeText(item.productNames?.join(', ') || (item.accessMode === 'all' ? 'Все продукты' : 'Выбранные продукты'))}</span></div>
            <div class="row-actions"><span class="status">${escapeText(statusLabel[item.status] || item.status)}</span>${item.canRevoke ? `<button class="button danger" type="button" data-revoke="${escapeText(item.id)}">Отозвать</button>` : ''}</div>
          </div>`).join('')}</div></div>` : ''}
        </section>
        <section class="panel invite-panel">
          <div class="panel-title"><div><span class="eyebrow">Новый сотрудник</span><h3>Создать приглашение</h3></div></div>
          ${access.canManage ? `<form class="form" data-form="invite">
            <label><span>E-mail</span><input type="email" name="email" required maxlength="320"></label>
            <div class="form-grid">
              <label><span>Роль</span><select name="role">${access.grantableRoles.map((role) => `<option value="${role}">${escapeText(roleLabel[role] || role)}</option>`).join('')}</select></label>
              <label><span>Срок активации</span><select name="expiresHours"><option value="24">24 часа</option><option value="48" selected>2 дня</option><option value="168">7 дней</option><option value="720">30 дней</option></select></label>
            </div>
            <input type="hidden" name="accessMode" value="selected">
            <input type="hidden" name="productIds" value="${escapeText(this.state.data.currentProduct.id)}">
            <div class="product-checks" data-product-scope><strong>Текущий продукт</strong><span>${escapeText(this.state.data.currentProduct.name)}</span></div>
            <p class="privacy-note">Приглашение действует выбранное время. После принятия доступ сохраняется, пока вы не приостановите или не отзовёте его.</p>
            <button class="button primary" type="submit" ${this.state.busy ? 'disabled' : ''}>Создать код</button>
          </form>
          ${invite ? `<div class="invite-code" role="status"><span>Одноразовый код</span><code>${escapeText(invite.code)}</code><button class="button" type="button" data-copy="${escapeText(invite.code)}">Копировать</button></div>` : ''}` : '<div class="empty small"><p>Управление доступами разрешено владельцу и администратору компании.</p></div>'}
        </section>
      </div>`;
    }

    renderMember(member, access) {
      const editing = this.state.editMemberId === member.id;
      const productNames = member.accessMode === 'all'
        ? 'Все продукты компании'
        : access.availableProducts.filter((product) => member.productIds?.includes(product.id)).map((product) => product.name).join(', ') || 'Нет доступных продуктов';
      const statusActions = !member.canChangeAccess
        ? ''
        : member.status === 'active'
          ? `<button class="button" type="button" data-member="${escapeText(member.id)}" data-status="suspended">Приостановить</button><button class="button danger" type="button" data-member="${escapeText(member.id)}" data-status="revoked">Отозвать</button>`
          : `<button class="button" type="button" data-member="${escapeText(member.id)}" data-status="active">Восстановить</button>`;
      return `<article class="member">
        <div class="member-summary">
          <div class="avatar" aria-hidden="true">${escapeText((member.name || member.email || '?').trim().charAt(0).toUpperCase())}</div>
          <div class="member-copy"><b>${escapeText(member.name)}</b><span>${escapeText(member.email || 'E-mail скрыт')}</span><span>${escapeText(roleLabel[member.role] || member.role)} · ${escapeText(productNames)}</span></div>
          <div class="member-actions"><span class="status">${escapeText(statusLabel[member.status] || member.status)}</span>${member.canChangeAccess ? `<button class="button" type="button" data-edit-member="${escapeText(member.id)}">${editing ? 'Закрыть' : 'Роль и продукты'}</button>` : ''}${statusActions}</div>
        </div>
        ${editing ? `<form class="member-editor form" data-form="member-access">
          <input type="hidden" name="userId" value="${escapeText(member.id)}">
          <div class="form-grid">
            <label><span>Роль</span><select name="role">${access.grantableRoles.map((role) => `<option value="${role}" ${member.role === role ? 'selected' : ''}>${escapeText(roleLabel[role] || role)}</option>`).join('')}</select></label>
          </div>
          <input type="hidden" name="accessMode" value="selected">
          <input type="hidden" name="productIds" value="${escapeText(this.state.data.currentProduct.id)}">
          <div class="product-checks" data-product-scope><strong>Текущий продукт</strong><span>${escapeText(this.state.data.currentProduct.name)}</span></div>
          <button class="button primary" type="submit" ${this.state.busy ? 'disabled' : ''}>Сохранить доступ</button>
        </form>` : ''}
      </article>`;
    }

    bind() {
      this.shadowRoot.querySelector('[data-billing-terms]')?.addEventListener('click', event => {
        if (window.nexusProduct) { event.preventDefault(); this.billingAction('terms'); }
      });
      this.shadowRoot.querySelectorAll('[name="billing-months"]').forEach(input => input.addEventListener('change', () => {
        this.state.billingMonths = Number(input.value); this.state.billingRequestId = null; this.render();
        this.shadowRoot.querySelector(`[name="billing-months"][value="${this.state.billingMonths}"]`)?.focus();
      }));
      this.shadowRoot.querySelector('[data-billing-consent]')?.addEventListener('change', event => {
        this.state.billingTermsAccepted = event.target.checked; this.render(); this.shadowRoot.querySelector('[data-billing-consent]')?.focus();
      });
      this.shadowRoot.querySelector('[data-billing-privacy]')?.addEventListener('change', event => {
        this.state.billingPrivacyAcknowledged = event.target.checked; this.render(); this.shadowRoot.querySelector('[data-billing-privacy]')?.focus();
      });
      this.shadowRoot.querySelector('[data-billing-checkout]')?.addEventListener('click', () => this.billingAction('checkout'));
      this.shadowRoot.querySelectorAll('[data-billing-refresh]').forEach(button => button.addEventListener('click', () => this.billingAction('refresh', button.dataset.billingRefresh)));
      this.shadowRoot.querySelectorAll('[data-billing-open]').forEach(button => button.addEventListener('click', () => this.billingAction('open', button.dataset.billingOpen)));
      // Keep the unsent ticket while another conversation is opened or refreshed.
      this.shadowRoot.querySelectorAll('form[data-form="ticket"] [name]').forEach(field => {
        if (!['category','subject','message','priority'].includes(field.name)) return;
        const remember = () => { this.state.ticketDraft[field.name] = field.value; };
        field.addEventListener('input', remember);
        field.addEventListener('change', remember);
      });
      this.shadowRoot.querySelectorAll('button[data-section]').forEach((button) => {
        button.addEventListener('click', () => this.openSection(button.dataset.section));
      });
      this.shadowRoot.querySelectorAll('[data-action="reload"]').forEach((button) => {
        button.addEventListener('click', () => this.load());
      });
      this.shadowRoot.querySelectorAll('[data-action="switch-product"]').forEach((button) => {
        button.addEventListener('click', async () => {
          const event = new CustomEvent('vertux-product-switch', { bubbles: true, composed: true, cancelable: true });
          if (!this.dispatchEvent(event)) return;
          if (typeof window.nexusProduct?.showProductSwitcher === 'function') await window.nexusProduct.showProductSwitcher();
          else if (typeof window.nexusProduct?.close === 'function') await window.nexusProduct.close('launch');
        });
      });
      this.shadowRoot.querySelectorAll('[data-ticket]').forEach((button) => {
        button.addEventListener('click', async () => {
          if (this.state.busy) return;
          const requestedTicketId = button.dataset.ticket;
          this.state.ticketId = requestedTicketId;
          this.state.messages = [];
          this.state.replyDraft = '';
          this.state.replyRequestId = null;
          this.state.replyRequestMessage = '';
          this.state.notice = '';
          this.render();
          try {
            const messages = await this.call('ticketMessages', requestedTicketId);
            if (this.state.ticketId !== requestedTicketId) return;
            this.state.messages = messages;
          } catch (error) {
            if (this.state.ticketId !== requestedTicketId) return;
            this.state.notice = error.message || String(error);
          }
          if (this.state.ticketId === requestedTicketId) this.render();
        });
      });
      const replyField = this.shadowRoot.querySelector('form[data-form="reply"] textarea[name="message"]');
      replyField?.addEventListener('input', () => {
        this.state.replyDraft = replyField.value;
      });
      this.shadowRoot.querySelectorAll('[data-copy]').forEach((button) => {
        button.addEventListener('click', async () => {
          let copied = false;
          if (typeof window.nexusProduct?.copyText === 'function') {
            const result = await window.nexusProduct.copyText(button.dataset.copy);
            copied = result?.copied === true;
          } else if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(button.dataset.copy);
            copied = true;
          }
          button.textContent = copied ? 'Скопировано' : 'Скопируйте вручную';
        });
      });
      this.shadowRoot.querySelectorAll('[data-revoke]').forEach((button) => {
        button.addEventListener('click', () => this.mutate('revokeInvitation', button.dataset.revoke, 'Приглашение отозвано'));
      });
      this.shadowRoot.querySelectorAll('[data-edit-member]').forEach((button) => {
        button.addEventListener('click', () => {
          this.state.editMemberId = this.state.editMemberId === button.dataset.editMember ? null : button.dataset.editMember;
          this.render();
        });
      });
      this.shadowRoot.querySelectorAll('[data-member]').forEach((button) => {
        button.addEventListener('click', () => {
          if (button.dataset.status === 'revoked'
            && !window.confirm('Отозвать доступ участника? Запись и аудит сохранятся.')) return;
          this.mutate('setMemberStatus', {
            userId: button.dataset.member,
            status: button.dataset.status,
          }, button.dataset.status === 'active' ? 'Доступ восстановлен' : 'Доступ обновлён');
        });
      });
      this.shadowRoot.querySelectorAll('form[data-form]').forEach((form) => {
        form.addEventListener('submit', (event) => this.submit(event));
      });
    }

    async mutate(action, value, successMessage) {
      if (this.state.busy) return;
      this.state.busy = true;
      this.state.notice = '';
      this.render();
      try {
        await this.call(action, value);
        this.state.data = await this.call('overview');
        this.state.notice = successMessage;
      } catch (error) {
        this.state.notice = error.message || String(error);
      } finally {
        this.state.busy = false;
        this.render();
      }
    }

    async submit(event) {
      event.preventDefault();
      if (this.state.busy) return;
      const form = event.currentTarget;
      const values = new FormData(form);
      const isTicket = form.dataset.form === 'ticket';
      const isReply = form.dataset.form === 'reply';
      const submittedTicketId = isReply ? String(values.get('ticketId') || '') : null;
      let ticketPayload = null;
      if (isTicket) {
        const category = Object.hasOwn(supportCategories, String(values.get('category'))) ? String(values.get('category')) : 'general';
        this.state.ticketDraft = {
          category,
          subject: String(values.get('subject') || '').slice(0, 128),
          priority: String(values.get('priority') || 'normal'),
          message: String(values.get('message') || '').slice(0, 4900),
        };
        ticketPayload = {
          subject: `[${supportCategories[category]}] ${this.state.ticketDraft.subject}`,
          priority: this.state.ticketDraft.priority,
          message: `Категория: ${supportCategories[category]}\n\n${this.state.ticketDraft.message}`,
        };
        const fingerprint = JSON.stringify(ticketPayload);
        if (!this.state.ticketRequestId || this.state.ticketRequestFingerprint !== fingerprint) {
          this.state.ticketRequestId = crypto.randomUUID();
          this.state.ticketRequestFingerprint = fingerprint;
        }
      }
      if (isReply) {
        this.state.replyDraft = String(values.get('message') || '');
        if (!this.state.replyRequestId || this.state.replyRequestMessage !== this.state.replyDraft) {
          this.state.replyRequestId = crypto.randomUUID();
          this.state.replyRequestMessage = this.state.replyDraft;
        }
      }
      this.state.busy = true;
      this.state.notice = '';
      this.render();
      let ticketStored = false;
      let replyStored = false;
      try {
        if (form.dataset.form === 'ticket') {
          await this.call('createTicket', {
            ...ticketPayload,
            requestId: this.state.ticketRequestId,
          });
          ticketStored = true;
          this.state.ticketDraft = emptyTicketDraft();
          this.state.ticketRequestId = null;
          this.state.ticketRequestFingerprint = '';
          this.state.notice = 'Обращение отправлено в Vertux';
        } else if (form.dataset.form === 'reply') {
          await this.call('replyTicket', {
            ticketId: submittedTicketId,
            message: this.state.replyDraft,
            requestId: this.state.replyRequestId,
          });
          replyStored = true;
          this.state.replyDraft = '';
          this.state.replyRequestId = null;
          this.state.replyRequestMessage = '';
          this.state.notice = 'Ответ отправлен';
        } else if (form.dataset.form === 'member-access') {
          await this.call('updateMemberAccess', {
            userId: values.get('userId'),
            role: values.get('role'),
            accessMode: 'selected',
            productIds: [this.state.data.currentProduct.id],
          });
          this.state.editMemberId = null;
          this.state.notice = 'Роль и продукты синхронизированы с Nexus';
        } else {
          this.state.invite = await this.call('invite', {
            email: values.get('email'),
            role: values.get('role'),
            expiresHours: Number(values.get('expiresHours')),
            accessMode: 'selected',
            productIds: [this.state.data.currentProduct.id],
          });
          this.state.notice = 'Приглашение создано в Nexus';
        }
        const savedInvite = this.state.invite;
        this.state.data = await this.call('overview');
        this.state.invite = savedInvite;
        if (this.state.ticketId && this.state.section === 'support') {
          const requestedTicketId = this.state.ticketId;
          const messages = await this.call('ticketMessages', requestedTicketId);
          if (this.state.ticketId === requestedTicketId) this.state.messages = messages;
        }
      } catch (error) {
        this.state.notice = ticketStored
          ? 'Обращение сохранено, но обновить список не удалось. Откройте поддержку повторно.'
          : replyStored
          ? 'Ответ сохранён, но обновить историю не удалось. Откройте обращение повторно.'
          : error.message || String(error);
      } finally {
        this.state.busy = false;
        this.render();
      }
    }
  }

  customElements.define('vertux-service-center', VertuxServiceCenter);
})();
