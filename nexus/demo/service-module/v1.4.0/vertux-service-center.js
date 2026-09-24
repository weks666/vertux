(function () {
  'use strict';

  if (customElements.get('vertux-service-center')) return;

  const VERSION = '1.4.0';
  const SECTIONS = ['subscription', 'support', 'access'];
  // Public Invest presentation, pricing.html revision invest-npd-2026-09-22-r1.
  // Future plans are descriptive only; Standard checkout always uses the server catalog.
  const INVEST_PLAN_PRESENTATION = {"revision":"invest-npd-2026-09-22-r1","terms":[{"id":"month","months":1,"label":"1 месяц","en":"1 month","factor":1,"discount":0},{"id":"quarter","months":3,"label":"3 месяца","en":"3 months","factor":2.7,"discount":10},{"id":"year","months":12,"label":"12 месяцев","en":"12 months","factor":10,"discount":null}],"plans":[{"id":"free","name":"Free","en":"Free","monthlyRub":0,"status":"proposal","description":"Знакомство со своим портфелем.","descriptionEn":"Get to know your own portfolio."},{"id":"standard","name":"Standard","en":"Standard","monthlyRub":1500,"status":"prepared","description":"Для учёта и анализа личного портфеля.","descriptionEn":"For tracking and understanding your portfolio."},{"id":"plus","name":"Plus","en":"Plus","monthlyRub":2500,"status":"planned","description":"Для работы с графиками и инструментами.","descriptionEn":"For working with charts and instruments."},{"id":"pro","name":"Pro","en":"Pro","monthlyRub":3500,"status":"planned","description":"Для анализа позиций участников рынка.","descriptionEn":"For studying market participant positions."}],"features":[{"id":"portfolio","ru":"Брокерские счета","en":"Brokerage accounts","values":["one","multiple","multiple","multiple"]},{"id":"operations","ru":"История сделок и операций","en":"Trade and transaction history","values":["yes","yes","yes","yes"]},{"id":"analytics","ru":"Аналитика и выбор периода","en":"Analytics and period selection","values":["basic","yes","yes","yes"]},{"id":"plan","ru":"Заметки, план и расчёт риска","en":"Notes, plans and risk calculations","values":["no","yes","yes","yes"]},{"id":"calendar","ru":"Календарь и напоминания","en":"Calendar and reminders","values":["no","yes","yes","yes"]},{"id":"devices","ru":"Устройства","en":"Devices","values":["three","three","three","three"]},{"id":"terminal","ru":"Терминал и несколько графиков","en":"Terminal and multiple charts","values":["no","no","planned","planned"]},{"id":"ai","ru":"Расширенные AI-разборы","en":"Extended AI analysis","values":["no","no","planned","planned"]},{"id":"automation","ru":"Сделки по заданным условиям","en":"Orders based on your rules","values":["no","no","planned","planned"]},{"id":"futoi","ru":"Позиции участников MOEX FUTOI","en":"MOEX FUTOI participant positions","values":["no","no","no","planned"]}]};
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
      telegram: '<path d="m2 10 20-8-4 20-7-6-4 4 1-7Z" fill="#29b6f6" stroke="none"/><path d="m8 13 11-8-8 11-4 4Z" fill="#168ecd" stroke="none"/><path d="m11 16 7 6 4-20Z" fill="#57c9f8" stroke="none"/>',
      mail: '<rect x="2" y="4" width="20" height="16" rx="3"/><path d="m3 6 9 7 9-7"/>',
      external: '<path d="M14 3h7v7M21 3l-9 9"/><path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/>',
      bulb: '<path d="M9 18h6m-5 3h4M8 14c-5-5-2-11 4-11s9 6 4 11l-1 2H9l-1-2Z"/>',
      crown: '<path d="m3 7 5 4 4-7 4 7 5-4-3 13H6L3 7Z"/>',
      device: '<rect x="3" y="3" width="18" height="13" rx="2"/><path d="M8 21h8m-4-5v5"/>',
      person: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-3a8 8 0 0 1 16 0v3"/>',
      cube: '<path d="m12 2 9 5v10l-9 5-9-5V7l9-5Z"/><path d="m3 7 9 5 9-5M12 12v10m-5-17 10 6"/>',
      diamond: '<path d="m7 3-5 6 10 13L22 9l-5-6H7Z"/><path d="M2 9h20M7 3l5 19L17 3M7 3l5 6 5-6"/>',
      calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
      swap: '<path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4"/>',
      repeat: '<path d="m17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4m14-1v3a2 2 0 0 1-2 2H3"/>',
      card: '<rect x="2" y="4" width="20" height="16" rx="3"/><path d="M2 9h20M6 15h4"/>',
      help: '<path d="M4 13v-1a8 8 0 0 1 16 0v4c0 3-2 5-5 5h-3"/><rect x="2" y="11" width="4" height="7" rx="2"/><rect x="18" y="11" width="4" height="7" rx="2"/>',
      cross: '<path d="m7 7 10 10M7 17 17 7"/>',
      chevron: '<path d="m6 9 6 6 6-6"/>',
      receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 7h6M9 11h6"/>',
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
        autopayDialog: null,
        autopayConsent: false,
        autopayTermsAccepted: false,
        autopayPrivacyAccepted: false,
        autopayRequestId: null,
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
      this.stylesReady.then(loaded => { if (loaded && this.isConnected) this.hidden = false; });
      if (this.bridge) this.load();
      this.refreshTimer = setInterval(() => void this.refreshQuietly(), 60000);
    }

    disconnectedCallback() { clearInterval(this.refreshTimer); }

    async refreshQuietly() {
      if(document.hidden || !this.isConnected || this.closest('[hidden]') || this.state.busy || this.state.autopayDialog || this.state.loading || this.refreshing || !this.state.data) return;
      if(this.shadowRoot.activeElement?.matches('input,textarea,select,button,summary'))return;
      this.refreshing=true;
      const section=this.state.section,ticketId=this.state.ticketId;
      try {
        const next=await this.call('overview');
        if(this.state.busy || section!==this.state.section || ticketId!==this.state.ticketId || !this.isConnected)return;
        const messages=ticketId ? await this.call('ticketMessages',ticketId) : this.state.messages;
        if(this.state.busy || ticketId!==this.state.ticketId || this.shadowRoot.activeElement?.matches('input,textarea,select,button,summary'))return;
        if(this.state.stale||JSON.stringify(next)!==JSON.stringify(this.state.data)||JSON.stringify(messages)!==JSON.stringify(this.state.messages)){
          this.state.data=next;this.state.messages=messages;this.state.stale=false;this.render();
        }
      } catch {
        if (this.state.section === 'subscription') { this.state.stale = true; this.render(); }
      }
      finally {this.refreshing=false;}
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
      this.state.autopayDialog = null;
      this.state.autopayConsent = false;
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
      this.state.autopayConsent = false;
      this.state.autopayDialog = null;
      this.state.autopayRequestId = null;
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
      const generation = this.loadGeneration = (this.loadGeneration || 0) + 1;
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
      if (generation !== this.loadGeneration) return;

      if (overview) {
        this.state.data = overview;
        this.state.stale = false;
        const allowed = overview.module?.sections || SECTIONS;
        if (!allowed.includes(this.state.section)) this.state.section = 'subscription';
      }
      this.state.error = stylesLoaded
        ? overviewError
        : 'Не удалось загрузить оформление системного модуля Vertux';
      this.state.loading = false;
      this.render();

      this.hidden = !stylesLoaded;
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

      let content = '<div class="subscription-loading" role="status"><p>Загружаем условия доступа…</p><div aria-hidden="true"><span class="subscription-skeleton"></span><span class="subscription-skeleton"></span><span class="subscription-skeleton"></span><span class="subscription-skeleton"></span></div></div>';
      if (!this.state.loading && this.state.error) {
        content = `<div class="subscription-error" role="alert"><h2>Не удалось обновить данные</h2><p>${escapeText(this.state.error)}</p><div class="subscription-error-actions"><button class="button" type="button" data-action="reload">Повторить</button>${this.subscriptionSupport()}</div></div>`;
      } else if (!this.state.loading && data) {
        const embeddedSection = this.hasAttribute('section');
        content = `<div class="shell">
          ${this.hasAttribute('hide-header') ? '' : this.renderHeader()}
          ${embeddedSection ? '' : this.renderNavigation()}
          ${this.state.stale && this.state.section === 'subscription' ? '<div class="subscription-stale" role="status">Данные не обновлены. Показаны последние полученные условия.<button class="button" data-action="reload">Обновить</button></div>' : ''}
          ${this.state.notice ? `<div class="notice" role="status">${escapeText(this.state.notice)}</div>` : ''}
          <main class="body" tabindex="-1" data-section="${escapeText(this.state.section)}">${this.renderSection()}</main>
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


    subscriptionSupport(label = 'Связаться с поддержкой') {
      const data = this.state.data;
      const native = data?.module?.sections?.includes('support') && data?.support;
      return native
        ? `<button class="button" type="button" data-section="support">${escapeText(label)}${icon('external')}</button>`
        : '<a class="button" href="https://t.me/VertuxManager" target="_blank" rel="noopener noreferrer">Поддержка в Telegram' + icon('external') + '</a><a class="subscription-link" href="mailto:support@vertux.online">Написать на почту</a>';
    }

    accessState(current) {
      const end = Date.parse(current?.periodEnd);
      const status = current && ['active', 'trial'].includes(current.status) && Number.isFinite(end) && end <= Date.now()
        ? 'expired' : current?.status;
      const states = {
        active: ['Доступ активен', 'success', 'Все возможности вашего плана доступны.'],
        trial: ['Пробный период', 'accent', 'Познакомьтесь с возможностями вашего пространства.'],
        expired: ['Срок доступа истёк', 'warning', 'Уточните продление, чтобы продолжить работу. Поддержка остаётся доступна.'],
        past_due: ['Ожидает продления', 'warning', 'Оплата продления пока не подтверждена. Уточните статус или обратитесь в поддержку.'],
        grace: ['Льготный период', 'warning', 'Период подписки завершился. Уточните условия продления в поддержке.'],
        suspended: ['Доступ приостановлен', 'danger', 'Обратитесь в поддержку, чтобы уточнить причину и восстановить доступ.'],
        canceled: ['Подписка отменена', 'muted', 'Условия дальнейшего доступа можно уточнить у поддержки.'],
        revoked: ['Доступ отозван', 'danger', 'По вопросам доступа обратитесь в поддержку.'],
        provisioning: ['Доступ готовится', 'accent', 'Подготавливаем ваше пространство. Актуальные условия появятся здесь.'],
      };
      const [label, tone, description] = states[status] || (current
        ? ['Статус требует уточнения', 'muted', 'Не удалось определить состояние доступа. Обратитесь в поддержку.']
        : ['Доступ не оформлен', 'muted', 'Условия подписки пока не назначены этому пространству.']);
      return { status, label, tone, description, end };
    }

    renderSubscription() {
      const data = this.state.data;
      if (data.standardSubscription) return this.renderStandardSubscription(data.standardSubscription);
      return this.renderPersonalInvest();
    }

    renderAccessSummary(current, features, name, billing = null) {
      const access = this.accessState(current);
      const start = Date.parse(current?.periodStart);
      const remaining = Number.isFinite(access.end) ? Math.max(0, Math.ceil((access.end - Date.now()) / 86400000)) : null;
      const total = Number.isFinite(start) && access.end > start ? Math.ceil((access.end - start) / 86400000) : null;
      const elapsed = total ? Math.max(0, Math.min(total, total - remaining)) : null;
      const elapsedPercent = total ? Math.round(elapsed / total * 100) : null;
      const running = ['active', 'trial'].includes(access.status);
      const days = { one: 'день', few: 'дня', many: 'дней', other: 'дня' }[new Intl.PluralRules('ru').select(remaining)];
      const plan = current?.planName || (billing?.catalog?.planCode === 'invest-standard' ? 'Standard' : name);
      const planCode = current?.planCode || billing?.catalog?.planCode || '';
      const symbol = /plus/.test(planCode) ? 'diamond' : /pro$/.test(planCode) ? 'crown' : /free/.test(planCode) ? 'person' : 'cube';
      const price = current?.priceSnapshot;
      const plans = billing ? this.subscriptionPlans(billing) : [];
      const currentIndex = plans.findIndex(item => planCode === 'invest-' + item.id);
      const upgrade = currentIndex >= 0 ? plans[currentIndex + 1] : null;
      return `<section class="subscription-access" aria-label="Текущий тариф" data-access-state="${escapeText(access.status || 'empty')}">
        <div class="subscription-access-main">
          <div class="subscription-access-heading">
            <span class="subscription-plan-symbol" aria-hidden="true">${icon(symbol)}</span>
            <div><span class="subscription-current-label">Текущий тариф</span><div class="subscription-plan-title"><h2>${escapeText(plan)}</h2><span class="subscription-badge" data-tone="${access.tone}">${escapeText(access.status === 'active' ? 'Активна' : access.label)}</span></div>
            <p class="subscription-description">${escapeText(access.description)}</p></div>
          </div>
          <p class="subscription-hero-note">Ваш портфель.<br>Ваши решения.<br>С Vertux Nexus.</p>
          <div class="subscription-period">
            <div class="subscription-date">${icon('calendar')}<div><span>${Number.isFinite(access.end) ? access.status === 'expired' ? 'Доступ закончился' : 'Доступен до' : 'Срок доступа'}</span><strong>${Number.isFinite(access.end) ? dateText(current.periodEnd) : 'Пока не указан'}</strong></div></div>
            ${running && remaining !== null ? `<div class="subscription-days">${icon('clock')}<div><span>Осталось</span><strong>${remaining} ${days}</strong></div></div>` : ''}
          </div>
          ${running && total && remaining !== null ? `<progress class="subscription-progress" value="${elapsed}" max="${total}" aria-label="${elapsedPercent}% периода пройдено; осталось ${remaining} ${days}"></progress>` : ''}
          <div class="subscription-period-caption">${Number.isFinite(start) && Number.isFinite(access.end) ? `<span>Текущий период: <time datetime="${escapeText(current.periodStart)}">${dateText(current.periodStart)}</time> — ${dateText(current.periodEnd)}</span>` : '<span>Срок появится после предоставления доступа</span>'}${running && elapsedPercent !== null ? `<span>${elapsedPercent}% периода пройдено</span>` : ''}${access.status === 'grace' && current.graceEndsAt ? `<span>Льготный период до ${dateText(current.graceEndsAt)}</span>` : ''}</div>
          ${this.state.data?.capabilities?.viewCommercialDetails && typeof price?.priceMinor === 'number' ? `<p class="subscription-contract-price">По вашим условиям: <strong>${this.subscriptionMoney(price.priceMinor, price.currency)}</strong></p>` : ''}
        </div>
        <div class="subscription-access-actions">
          ${billing?.mayManage ? `<button class="button primary" data-subscription-scroll="payment">${running ? 'Продлить подписку' : 'Условия продления'}${icon('arrow')}</button>${upgrade ? `<button class="button subscription-upgrade" data-subscription-scroll="${escapeText(upgrade.id)}">${icon(upgrade.id === 'pro' ? 'crown' : 'diamond')}Возможности ${escapeText(upgrade.name)}${upgrade.available ? '' : '<small>Скоро</small>'}</button>` : ''}<button class="button" data-subscription-scroll="plans">${icon('swap')}Сменить тариф</button>` : '<p class="subscription-action-note">' + (billing ? 'Оплатой управляет владелец аккаунта.' : 'Индивидуальные условия вашего пространства.') + '</p>'}
        </div>
      </section>`;
    }

    renderPlanFeatures(features) {
      const available = Array.isArray(features) ? features.filter(feature => typeof feature === 'string' && feature.trim()) : [];
      return available.length
        ? `<ul class="subscription-feature-list">${available.map(feature => `<li>${icon('check')}<span>${escapeText(feature)}</span></li>`).join('')}</ul>`
        : '<p class="muted">Состав возможностей пока не указан. Поддержка поможет уточнить условия.</p>';
    }

    renderSubscriptionFaq(billing = null) {
      const hasAutopayOffer = billing?.catalog?.catalogSlug === 'vertux-invest-workspace' && billing?.catalog?.planCode === 'invest-standard';
      return `<section class="subscription-faq subscription-detail-card"><h3>Вопросы об оплате</h3>
        ${hasAutopayOffer ? '<details name="subscription-faq"><summary>Как работает автоплата?' + icon('chevron') + '</summary><p>Только после вашего согласия и привязки карты при оплате. Подписка продлевается на выбранный срок. Отключить автоплату можно здесь — оплаченный доступ сохранится.</p></details><details name="subscription-faq"><summary>Когда действует скидка 3%?' + icon('chevron') + '</summary><p>На каждое следующее автоматическое продление, пока карта привязана и автоплата включена. Скидка считается от цены выбранного срока, включая скидку за 3 или 12 месяцев. Первый платёж и разовые продления — по обычной цене.</p></details>' : ''}
        <details name="subscription-faq"><summary>Что означает зачёркнутая цена?${icon('chevron')}</summary><p>Стоимость того же срока при оплате по месяцам без скидок. Рядом указана полная сумма за выбранный срок.</p></details>
        <details name="subscription-faq"><summary>Когда продлится доступ?${icon('chevron')}</summary><p>После подтверждения оплаты. Если оплаченный период ещё действует, новый срок добавится к нему. Статус можно проверить в разделе оплаты.</p></details>
      </section>`;
    }

    subscriptionAutopay(billing) {
      const data = billing?.autopay;
      const card = data?.card && /^\d{4}$/.test(String(data.card.last4)) ? data.card : null;
      const policy = data?.policy;
      const validPolicy = policy?.discountPercent === 3 && policy?.basis === 'term_total'
        && policy?.appliesTo === 'subsequent_automatic_renewals' && typeof policy.version === 'string' && policy.version.length > 0;
      return { data, card, validPolicy,
        enabled: data?.status === 'enabled' && Boolean(card),
        pending: data?.status === 'pending',
        available: data?.available === true && validPolicy,
      };
    }

    autopayQuote(billing, plan, term, requireEnabled = true) {
      const autopay = this.subscriptionAutopay(billing);
      if (!term || this.state.stale || !autopay.validPolicy || (requireEnabled && !autopay.enabled)) return null;
      const quote = (Array.isArray(autopay.data?.quotes) ? autopay.data.quotes : []).find(item =>
        item.planCode === 'invest-' + plan.id && item.months === term.months
        && item.catalogVersion === billing.catalog?.version && item.currency === billing.catalog?.currency
        && item.baseAmountMinor === term.amountMinor && Number.isSafeInteger(item.amountMinor)
        && item.amountMinor === Math.round(term.amountMinor * 97 / 100)
        && Date.parse(item.validUntil) > Date.now());
      return quote || null;
    }

    renderAutopayCard(billing, selected, pending) {
      if (billing.catalog?.catalogSlug !== 'vertux-invest-workspace' || billing.catalog?.planCode !== 'invest-standard') return '';
      if (!billing.mayManage) return '';
      const { data, card, enabled, available, pending: awaiting } = this.subscriptionAutopay(billing);
      const mayManage = billing.mayManage === true;
      const setupReady = available && billing.checkoutEnabled === true && typeof this.bridge?.subscriptionAutopayStart === 'function';
      const disableReady = typeof this.bridge?.subscriptionAutopayDisable === 'function';
      const blocked = this.state.busy || this.state.stale || Boolean(pending) || awaiting;
      const next = data?.nextPayment;
      const nextTerm = this.subscriptionTerms(billing).find(term => term.months === next?.months);
      const nextQuote = this.autopayQuote(billing, { id: 'standard' }, nextTerm);
      const nextVerified = enabled && nextQuote && next?.amountMinor === nextQuote.amountMinor && Date.parse(next.scheduledAt) > Date.now();
      return `<div class="subscription-autopay" data-autopay-status="${escapeText(data?.status || 'unavailable')}">
        <div class="subscription-saved-card">${icon('card')}<div><strong>${card ? 'Карта •••• ' + escapeText(card.last4) : 'Карта не привязана'}</strong><span>${card ? escapeText(card.brand || 'Банковская карта') : 'Привяжите при оплате подписки'}</span></div>${card && mayManage ? `<button class="subscription-text-button subscription-card-remove" aria-label="Отвязать карту" data-autopay-dialog="remove" ${blocked || !disableReady ? 'disabled' : ''}>${icon('cross')}</button>` : card ? '<span class="subscription-card-check">' + icon('check') + '</span>' : ''}</div>
        <div class="subscription-autopay-setting"><div><strong>Автоплата</strong><span>${enabled ? 'Включена' : awaiting ? 'Ожидает подтверждения' : 'Выключена'}</span></div><button class="subscription-switch" type="button" role="switch" aria-label="Автоплата" aria-checked="${enabled}" data-autopay-dialog="${enabled ? 'disable' : 'setup'}" ${!mayManage || blocked || (enabled ? !disableReady : !setupReady) ? 'disabled' : ''}><span></span></button></div>
        <div class="subscription-autopay-benefit">${icon('repeat')}<span>${enabled ? '−3% на автопродление' : '−3% с каждой следующей автоплатой'}</span></div>
        ${nextVerified ? `<p class="subscription-next-payment">Следующая <strong>${this.subscriptionMoney(next.amountMinor, nextQuote.currency)}</strong><span>${dateText(next.scheduledAt)} · за ${next.months} мес.</span></p>` : enabled ? '<p>Дата и сумма следующей оплаты уточняются.</p>' : '<p>Дополнительно к скидке за срок. Первый платёж — по обычной цене.</p>'}
        ${awaiting ? '<p>Завершите оплату и привязку на странице Robokassa.</p><button class="button" data-autopay-refresh>Проверить привязку</button>' : !enabled && mayManage ? `<button class="button" data-autopay-dialog="setup" ${blocked || !setupReady ? 'disabled' : ''}>${card ? 'Подключить автоплату' : 'Привязать карту'}${icon('arrow')}</button>` : ''}
        ${!available && !enabled ? '<p class="subscription-autopay-unavailable">Подключение автоплаты готовится к запуску.</p>' : ''}
      </div>`;
    }

    renderAutopayDialog(billing, selected) {
      const mode = this.state.autopayDialog;
      if (!mode || !selected) return '';
      const setup = mode === 'setup';
      const quote = this.autopayQuote(billing, { id: 'standard' }, selected, false);
      const money = value => this.subscriptionMoney(value, billing.catalog?.currency);
      const title = setup ? 'Карта и автоплата' : mode === 'remove' ? 'Отвязать карту?' : 'Отключить автоплату?';
      return `<dialog class="subscription-autopay-dialog" aria-labelledby="autopay-dialog-title"><div class="subscription-dialog-heading"><span class="subscription-plan-symbol">${icon('card')}</span><button class="subscription-text-button" data-autopay-close aria-label="Закрыть" ${this.state.busy ? 'disabled' : ''}>${icon('cross')}</button></div><h3 id="autopay-dialog-title">${title}</h3>
        ${setup ? `<p>Оплатите выбранный срок и сохраните карту на защищённой странице Robokassa.</p><dl class="subscription-autopay-quote"><div><dt>Первый платёж · ${selected.months} мес.</dt><dd>${money(selected.amountMinor)}</dd></div><div><dt>Далее каждые ${selected.months} мес. <span>Скидка за автоплату 3%</span></dt><dd>${quote ? money(quote.amountMinor) : 'Уточняется'}</dd></div></dl><p>Новый срок добавится к оплаченному. Автоплата начнётся после его окончания. Можно отключить в любой момент.</p><div class="subscription-consents">
          <label><input type="checkbox" data-autopay-consent ${this.state.autopayConsent ? 'checked' : ''}><span>Разрешаю сохранять карту и автоматически продлевать подписку каждые ${selected.months} мес. на указанных условиях.</span></label>
          <label><input type="checkbox" data-autopay-terms><span>Принимаю <a href="${escapeText(this.subscriptionSafeUrl(billing.termsUrl))}" target="_blank" rel="noopener noreferrer">условия подписки</a>.</span></label>
          <label><input type="checkbox" data-autopay-privacy><span>Ознакомлен с <a href="${escapeText(this.subscriptionSafeUrl(billing.privacyUrl))}" target="_blank" rel="noopener noreferrer">политикой обработки данных</a>.</span></label></div>` : `<p>${mode === 'remove' ? 'Карта будет отвязана, автоматические продления прекратятся.' : 'Следующее автоматическое списание будет отменено.'} Цены вернутся к обычным, без дополнительных 3%.</p><p>Оплаченный доступ${billing.subscription?.periodEnd ? ' до ' + dateText(billing.subscription.periodEnd) : ''} сохранится.</p>`}
        <div class="subscription-dialog-actions"><button class="button" data-autopay-close ${this.state.busy ? 'disabled' : ''}>${setup ? 'Отмена' : 'Оставить автоплату'}</button><button class="button primary" data-autopay-confirm ${setup || this.state.busy ? 'disabled' : ''}>${setup ? 'Оплатить ' + money(selected.amountMinor) : mode === 'remove' ? 'Отвязать карту' : 'Отключить'}</button></div>
      </dialog>`;
    }

    async autopayAction(action) {
      const billing = this.state.data?.standardSubscription;
      if (!billing?.mayManage || this.state.busy || this.state.stale) return;
      const autopay = this.subscriptionAutopay(billing);
      const mode = this.state.autopayDialog;
      const term = this.subscriptionTerms(billing).find(item => item.months === this.state.billingMonths);
      if (action === 'confirm' && mode === 'setup' && (!autopay.available || autopay.pending || !billing.checkoutEnabled || !term
        || !this.state.autopayConsent || !this.state.autopayTermsAccepted || !this.state.autopayPrivacyAccepted
        || !this.subscriptionSafeUrl(billing.termsUrl) || !this.subscriptionSafeUrl(billing.privacyUrl)
        || !this.autopayQuote(billing, { id: 'standard' }, term, false)
        || (billing.orders || []).some(order => ['created','pending','review'].includes(order.status)))) return;
      if (action === 'confirm' && !['setup', 'disable', 'remove'].includes(mode)) return;
      if (action === 'confirm' && ((mode === 'disable' && !autopay.enabled) || (mode === 'remove' && !autopay.card))) return;
      this.state.busy = true;
      this.state.notice = '';
      this.state.autopayDialog = null;
      this.render();
      try {
        if (action === 'confirm') {
          this.state.autopayRequestId ||= crypto.randomUUID();
          if (mode === 'setup') await this.call('subscriptionAutopayStart', {
            requestId: this.state.autopayRequestId, months: term.months,
            policyVersion: autopay.data.policy.version, consentAccepted: true,
            termsVersion: billing.termsVersion, acceptedTerms: true, privacyVersion: billing.privacyVersion, privacyAcknowledged: true,
          });
          else await this.call('subscriptionAutopayDisable', { requestId: this.state.autopayRequestId, removeCard: mode === 'remove' });
        }
        // Only the authoritative overview can confirm a saved card, mandate, or discount.
        this.state.data = await this.call('overview');
        const next = this.subscriptionAutopay(this.state.data.standardSubscription);
        this.state.autopayRequestId = null;
        this.state.notice = next.enabled ? 'Автоплата включена. Цены показаны со скидкой для последующих автопродлений.'
          : next.pending ? 'Ожидаем подтверждение оплаты и привязки карты.' : 'Автоплата выключена. Автоматических списаний не будет.';
      } catch (cause) {
        this.state.notice = cause.message || 'Не удалось проверить автоплату. Обновите статус перед повторной попыткой.';
        this.state.stale = true;
      } finally {
        this.state.busy = false;
        this.state.autopayDialog = null;
        this.state.autopayConsent = false;
        this.state.autopayTermsAccepted = false;
        this.state.autopayPrivacyAccepted = false;
        this.render();
        const notice = this.shadowRoot.querySelector('[role="status"]');
        notice?.setAttribute('tabindex', '-1'); notice?.focus();
      }
    }

    renderSubscriptionHelp() {
      return `<section class="subscription-help subscription-detail-card"><h3>${icon('help')}Нужна помощь?</h3><p class="muted">Поможем с оплатой, сроком доступа и выбором тарифа.</p><div class="subscription-help-actions">${this.subscriptionSupport()}</div><p class="subscription-help-note">Номер заказа поможет быстрее найти платёж.</p></section>`;
    }

    renderSubscriptionUsage() {
      const usage = this.state.data?.usage;
      const totals = Array.isArray(usage?.totals) ? usage.totals.filter(item =>
        Object.hasOwn(metricLabel, item.metric) && item.metric !== 'node.heartbeat' && typeof item.quantity === 'number' && Number.isFinite(item.quantity)) : [];
      if (!usage?.available || !usage?.measured || !totals.length) return '';
      return `<section class="subscription-usage"><h3>Использование${Number.isFinite(usage.periodDays) ? ' за ' + escapeText(usage.periodDays) + ' дней' : ''}</h3><dl>${totals.map(item => `<div><dt>${escapeText(metricLabel[item.metric])}</dt><dd>${item.metric === 'ai.cost_minor' ? this.subscriptionMoney(item.quantity) : quantityText(item.quantity)}</dd></div>`).join('')}</dl></section>`;
    }

    renderSubscriptionEntitlements() {
      const data = this.state.data;
      const labels = { 'workspace.access': 'Работа в Workspace', 'ai.tokens': 'AI-токены', 'ai.cost_minor': 'AI-бюджет', 'storage.bytes': 'Хранилище', 'support.hours': 'Часы поддержки', 'users.seats': 'Участники', 'devices.count': 'Устройства' };
      const items = (data?.subscription?.entitlements || []).filter(item =>
        (!item.product_id || item.product_id === data.currentProduct?.id) && (Object.hasOwn(labels, item.entitlement_key) || item.label));
      if (!data?.capabilities?.viewCommercialDetails || !items.length) return '';
      return `<section class="subscription-entitlements"><h3>Лимиты и доступы</h3><dl>${items.map(item => {
        const expired = item.valid_until && Date.parse(item.valid_until) <= Date.now();
        return `<div><dt>${escapeText(item.label || labels[item.entitlement_key])}</dt><dd>${!item.enabled ? 'Отключено' : expired ? 'Срок истёк' : escapeText(item.limit_value ?? 'Включено')}</dd></div>`;
      }).join('')}</dl></section>`;
    }

    renderPersonalInvest() {
      const data = this.state.data;
      const current = data.subscription;
      const name = data.currentProduct?.name || 'Workspace';
      return `<div class="subscription-page">
        ${this.renderAccessSummary(current, current?.features, name)}
        <section class="subscription-personal-features"><h3>Возможности вашего пространства</h3>${this.renderPlanFeatures(current?.features)}</section>
        ${this.renderSubscriptionEntitlements()}${this.renderSubscriptionUsage()}
        <div class="subscription-details subscription-details-personal">${this.renderSubscriptionHelp()}</div>
      </div>`;
    }

    subscriptionMoney(minor, currency = 'RUB') {
      if (typeof minor !== 'number' || !Number.isFinite(minor)) return 'Стоимость уточняется';
      return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: ['RUB', 'USD', 'EUR'].includes(currency) ? currency : 'RUB', maximumFractionDigits: minor % 100 ? 2 : 0 }).format(minor / 100);
    }

    subscriptionTerms(billing) {
      return (Array.isArray(billing.catalog?.terms) ? billing.catalog.terms : []).filter(term =>
        [1, 3, 12].includes(term.months) && Number.isSafeInteger(term.amountMinor) && term.amountMinor >= 0);
    }

    subscriptionSafeUrl(value) {
      try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; }
      catch { return ''; }
    }

    renderBillingConsents(billing) {
      const termsUrl = this.subscriptionSafeUrl(billing.termsUrl);
      const privacyUrl = this.subscriptionSafeUrl(billing.privacyUrl || 'https://vertux.online/nexus/privacy.html');
      return `<div class="subscription-consents">
        ${termsUrl ? `<label><input type="checkbox" data-billing-consent ${this.state.billingTermsAccepted ? 'checked' : ''} ${this.state.busy ? 'disabled' : ''}><span>Принимаю <a data-billing-terms href="${escapeText(termsUrl)}" target="_blank" rel="noopener noreferrer">публичную оферту</a></span></label>` : '<p class="muted">Условия оплаты пока недоступны.</p>'}
        <label><input type="checkbox" data-billing-privacy ${this.state.billingPrivacyAcknowledged ? 'checked' : ''} ${this.state.busy ? 'disabled' : ''}><span>Ознакомлен с <a href="${escapeText(privacyUrl)}" target="_blank" rel="noopener noreferrer">политикой обработки данных</a></span></label>
      </div>`;
    }

    renderPendingPayment(order, billing) {
      const labels = { created: 'Создание оплаты не завершено', pending: 'Ожидает оплаты', review: 'Оплату проверяет поддержка' };
      const descriptions = {
        created: 'Заказ сохранён. Повторите создание с теми же условиями — новый заказ не появится.',
        pending: 'Срок изменится после подтверждения оплаты. Если вы уже оплатили, проверьте статус.',
        review: 'Результат оплаты пока не подтверждён. Обратитесь в поддержку перед повторной оплатой.',
      };
      const disabled = this.state.busy ? 'disabled' : '';
      const retryDisabled = this.state.busy || !billing.checkoutEnabled || !this.state.billingTermsAccepted || !this.state.billingPrivacyAcknowledged;
      return `<section class="subscription-payment" aria-label="Незавершённая оплата">
        <div class="subscription-payment-copy"><span class="subscription-badge" data-tone="warning">${escapeText(labels[order.status])}</span><h3>${this.subscriptionMoney(order.amountMinor)} <span>за ${order.months} мес.</span></h3><p>${descriptions[order.status]}</p></div>
        <div class="subscription-payment-actions">
          ${order.status === 'pending' && order.confirmationUrl ? `<button class="button primary" data-billing-open="${escapeText(order.id)}" ${disabled}>Перейти к оплате${icon('external')}</button>` : ''}
          ${order.status === 'pending' ? `<button class="button" data-billing-refresh="${escapeText(order.id)}" ${disabled}>Проверить оплату</button>` : ''}
          ${order.status === 'created' && billing.checkoutEnabled ? `${this.renderBillingConsents(billing)}<button class="button" data-billing-refresh="${escapeText(order.id)}" ${retryDisabled ? 'disabled' : ''}>Повторить создание</button>` : ''}
          ${order.status === 'review' || (order.status === 'created' && !billing.checkoutEnabled) ? this.subscriptionSupport() : ''}
        </div>
      </section>`;
    }

    renderSubscriptionHistory(billing) {
      if (!billing.mayManage) return '';
      const labels = { applied: 'Оплачено', canceled: 'Отменено' };
      const orders = (Array.isArray(billing.orders) ? billing.orders : []).filter(order => !['created', 'pending', 'review'].includes(order.status));
      const visible = this.state.allPayments ? orders : orders.slice(0, 3);
      return `<section class="subscription-history-v2 subscription-detail-card"><div class="subscription-section-heading"><h3>История платежей</h3>${orders.length > 3 ? `<button class="subscription-text-button" data-all-payments aria-expanded="${!!this.state.allPayments}">${this.state.allPayments ? 'Свернуть' : 'Все платежи'}${icon('arrow')}</button>` : ''}</div>${orders.length
        ? `<ol class="subscription-order-list">${visible.map(order => `<li><span class="subscription-order-icon" data-tone="${order.status === 'applied' ? 'success' : 'muted'}" aria-label="${escapeText(labels[order.status] || 'Статус уточняется')}">${icon(order.status === 'applied' ? 'check' : 'cross')}</span><div><strong>${this.subscriptionMoney(order.amountMinor)} <span>· ${order.months} мес.</span></strong><p>${escapeText(labels[order.status] || 'Статус уточняется')}${order.periodEnd ? ' · до ' + dateText(order.periodEnd) : ''}</p></div><time datetime="${escapeText(order.createdAt || '')}">${dateText(order.createdAt)}</time></li>`).join('')}</ol>`
        : '<div class="subscription-history-empty">' + icon('receipt') + '<div><strong>Оплат пока нет</strong><p>После оплаты здесь появятся сумма, дата и срок подписки.</p></div></div>'}</section>`;
    }

    subscriptionPlans(billing) {
      const standard = {
        id: 'standard', name: 'Standard', description: 'Для учёта и анализа личного портфеля.',
        monthlyPriceMinor: billing.catalog?.monthlyPriceMinor, terms: this.subscriptionTerms(billing),
        features: (billing.catalog?.features || []).map(text => ({ text, included: true })), available: true,
      };
      if (billing.catalog?.catalogSlug !== 'vertux-invest-workspace' || billing.catalog?.planCode !== 'invest-standard') {
        return [{ ...standard, name: billing.catalog?.name || 'Ваш тариф' }];
      }
      return INVEST_PLAN_PRESENTATION.plans.map((plan, index) => {
        const features = INVEST_PLAN_PRESENTATION.features.map(feature => {
          const value = feature.values[index];
          const text = value === 'one' ? 'Один брокерский счёт'
            : value === 'multiple' ? 'Несколько брокерских счетов'
            : value === 'basic' ? 'Базовая аналитика'
            : value === 'three' ? 'До 3 устройств' : feature.ru;
          return { text, included: value !== 'no', planned: value === 'planned' };
        });
        if (plan.id === 'standard') return { ...standard, features };
        return {
          id: plan.id, name: plan.name, description: plan.description, features, available: false,
          monthlyPriceMinor: plan.monthlyRub * 100,
          terms: INVEST_PLAN_PRESENTATION.terms.map(term => ({ months: term.months, amountMinor: Math.round(plan.monthlyRub * 100 * term.factor) })),
        };
      });
    }

    renderSubscriptionPlans(billing, selected, pending) {
      const plans = this.subscriptionPlans(billing);
      const terms = this.subscriptionTerms(billing);
      const active = billing.subscription && ['active', 'trial', 'grace'].includes(this.accessState(billing.subscription).status);
      const price = value => this.subscriptionMoney(value, billing.catalog?.currency);
      const selectedMonths = selected?.months || 1;
      const autopayPrices = Boolean(this.autopayQuote(billing, { id: 'standard' }, selected));
      return `<section class="subscription-renewal" id="subscription-plans" tabindex="-1">
        <div class="subscription-plans-toolbar"><div><h3>Выберите свой тариф</h3><p class="muted">Все возможности — в карточках. Выберите удобный срок.</p></div>
          ${terms.length ? `<fieldset class="subscription-terms" ${this.state.busy || pending ? 'disabled' : ''}><legend>Срок подписки</legend>${terms.map(term => {
            const base = billing.catalog?.monthlyPriceMinor * term.months;
            const savings = base - term.amountMinor;
            const freeMonths = savings > 0 && billing.catalog.monthlyPriceMinor > 0 ? savings / billing.catalog.monthlyPriceMinor : 0;
            const offer = savings > 0 ? term.months === 12 && Number.isInteger(freeMonths) ? freeMonths + ' мес. в подарок' : '−' + Math.round(savings / base * 100) + '%' : '';
            return `<label class="subscription-term"><input type="radio" name="billing-months" value="${term.months}" ${selectedMonths === term.months ? 'checked' : ''}><span>${term.months === 1 ? 'Ежемесячно' : term.months === 3 ? '3 месяца' : '12 месяцев'}${offer ? `<small>${escapeText(offer)}</small>` : ''}</span></label>`;
          }).join('')}</fieldset>` : ''}
        </div>
        ${billing.testMode ? '<p class="subscription-test">Тестовый магазин: реальные деньги не списываются.</p>' : ''}
        ${billing.catalog?.pricingStatus === 'draft' ? '<p class="subscription-test">Предварительные условия. Цены ещё не утверждены.</p>' : ''}
        ${autopayPrices ? '<p class="subscription-autopay-prices">' + icon('repeat') + '<strong>Ваша скидка за автоплату −3%</strong><span>Учтена в ценах для следующих автопродлений, вместе со скидкой за срок.</span></p>' : ''}
        <div class="subscription-plans" data-plan-count="${plans.length}">${plans.map(plan => {
          const term = plan.terms.find(item => item.months === selectedMonths);
          const recurringQuote = plan.id === 'free' || !autopayPrices ? null : this.autopayQuote(billing, plan, term);
          const shownAmount = recurringQuote?.amountMinor ?? term?.amountMinor;
          const base = Number.isSafeInteger(plan.monthlyPriceMinor) ? plan.monthlyPriceMinor * selectedMonths : null;
          const discounted = term && Number.isFinite(base) && shownAmount < base;
          const current = plan.available && active;
          const symbol = { free: 'person', standard: 'cube', plus: 'diamond', pro: 'crown' }[plan.id];
          return `<article class="subscription-plan-card ${current ? 'is-current' : ''}" data-plan="${plan.id}" tabindex="-1">
            <div class="subscription-plan-card-heading"><span class="subscription-plan-symbol" aria-hidden="true">${icon(symbol)}</span><div><h4>${escapeText(plan.name)}</h4><span class="subscription-plan-caption">${current ? 'Ваш текущий тариф' : plan.available ? 'Доступный тариф' : 'Скоро'}</span></div></div>
            <p class="subscription-plan-description">${escapeText(plan.description)}</p>
            <div class="subscription-plan-price"><div><strong>${term ? price(shownAmount) : 'Уточняется'}</strong>${discounted ? `<s aria-label="Без скидки ${price(base)}">${price(base)}</s>` : ''}</div>
            <span>${plan.id === 'free' ? 'Бесплатный режим · без ограничения срока' : term ? selectedMonths === 1 ? recurringQuote ? 'за месяц · при автопродлении' : 'за месяц · разовая оплата' : price(Math.round(shownAmount / selectedMonths)) + ' / месяц · ' + (recurringQuote ? 'при автопродлении' : 'оплата за весь срок') : 'Условия продления уточнит поддержка'}</span>
            </div>
            <ul class="subscription-plan-features">${plan.features.map(feature => `<li class="${feature.included ? '' : 'not-included'}">${icon(feature.included ? 'check' : 'cross')}<span>${escapeText(feature.text)}${feature.planned ? '<span class="subscription-sr-only"> — готовится к запуску</span>' : ''}</span></li>`).join('')}</ul>
            ${plan.available ? billing.mayManage ? `<button class="button ${current ? 'primary' : ''}" data-subscription-scroll="payment">${current ? 'Продлить ' + escapeText(plan.name) : 'Выбрать ' + escapeText(plan.name)}${icon('arrow')}</button>` : '<p class="subscription-plan-readonly">Управляет владелец аккаунта</p>'
              : '<button class="button" disabled>Готовится к запуску</button>'}
          </article>`;
        }).join('')}</div>
        ${plans.length > 1 ? '<p class="subscription-catalog-note">Free, Plus и Pro готовятся к запуску. Указаны планируемые цены и возможности; условия уточним до открытия продаж.</p>' : ''}
      </section>`;
    }

    renderSubscriptionPaymentInfo(billing, selected, pending) {
      const checkout = billing.mayManage === true && billing.checkoutEnabled === true;
      const price = minor => this.subscriptionMoney(minor, billing.catalog?.currency);
      const autopay = this.renderAutopayCard(billing, selected, pending);
      return `<section class="subscription-payment-info subscription-detail-card" id="subscription-payment-info" tabindex="-1"><h3>${icon('card')}Способ оплаты</h3>${autopay || '<p>Платёжные данные вводятся на странице сервиса оплаты.</p>'}
        ${billing.mayManage ? !checkout ? `<div class="subscription-payment-unavailable"><span class="subscription-badge" data-tone="muted">Приём оплаты пока закрыт</span>${autopay ? '' : `<p>${escapeText(billing.unavailableReason?.replace(/^Приём оплаты готовится к запуску\.\s*/u, '') || 'По вопросам продления напишите в поддержку.')}</p>`}</div>`
          : !pending && selected ? `<details class="subscription-manual-payment" ${(this.state.manualPaymentOpen ?? !this.subscriptionAutopay(billing).enabled) ? 'open' : ''}><summary>Разовая оплата · ${price(selected.amountMinor)}${icon('chevron')}</summary><p>Продление без автоплаты и без скидки 3%.</p><div class="subscription-checkout">${this.renderBillingConsents(billing)}<button class="button primary" data-billing-checkout ${this.state.busy || this.state.stale || !this.state.billingTermsAccepted || !this.state.billingPrivacyAcknowledged || !this.subscriptionSafeUrl(billing.termsUrl) ? 'disabled' : ''}>Оплатить ${price(selected.amountMinor)}</button></div></details>`
          : '<p class="muted">Незавершённая оплата показана выше.</p>'
          : '<p class="subscription-owner-note">Оплатой управляет владелец или администратор аккаунта.</p>'}
        ${!checkout && this.subscriptionSafeUrl(billing.termsUrl) ? `<a class="subscription-link" href="${escapeText(this.subscriptionSafeUrl(billing.termsUrl))}" target="_blank" rel="noopener noreferrer">Условия оплаты${icon('external')}</a>` : ''}
      </section>`;
    }

    renderStandardSubscription(billing) {
      const terms = this.subscriptionTerms(billing);
      const orders = Array.isArray(billing.orders) ? billing.orders : [];
      const pending = billing.mayManage && orders.find(order => ['created', 'pending', 'review'].includes(order.status));
      const selected = terms.find(term => term.months === (pending?.months || this.state.billingMonths)) || terms[0];
      const name = this.state.data.currentProduct?.name || billing.catalog?.name || 'Invest Workspace';
      return `<div class="subscription-page">
        ${this.renderAccessSummary(billing.subscription, billing.catalog?.features, name, billing)}
        ${pending ? this.renderPendingPayment(pending, billing) : ''}
        ${this.renderSubscriptionPlans(billing, selected, pending)}
        <div class="subscription-details">
          ${this.renderSubscriptionFaq(billing)}
          ${this.renderSubscriptionPaymentInfo(billing, selected, pending)}
          ${this.renderSubscriptionHistory(billing)}
          ${this.renderSubscriptionHelp()}
        </div>
        ${this.renderSubscriptionUsage()}
        ${this.renderAutopayDialog(billing, selected)}
      </div>`;
    }

    async billingAction(action, orderId) {
      if (this.state.busy) return;
      const billing = this.state.data.standardSubscription;
      if (!billing?.mayManage) return;
      const order = (billing.orders || []).find(item => item.id === orderId);
      if ((action === 'checkout' || order?.status === 'created')
        && (!billing.checkoutEnabled || this.state.stale || !this.state.billingTermsAccepted || !this.state.billingPrivacyAcknowledged)) return;
      if (action === 'checkout' && (billing.orders || []).some(item => ['created', 'pending', 'review'].includes(item.status))) return;
      if (action === 'checkout' && !this.subscriptionTerms(billing).some(term => term.months === this.state.billingMonths)) return;
      if (action === 'open' && order?.status !== 'pending') return;
      this.state.busy = true;
      this.state.notice = '';
      this.state.autopayDialog = null;
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
            : result.status === 'pending' ? 'Оплата создана. Перейдите к оплате, затем проверьте статус.'
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
            <a class="support-channel" href="https://t.me/VertuxManager" target="_blank" rel="noopener noreferrer"><span class="contact-symbol">${icon('telegram')}</span><span><strong>Поддержка в Telegram</strong><small>Написать команде Vertux</small></span>${icon('external')}</a>
            <a class="support-channel" href="mailto:support@vertux.online"><span class="contact-symbol email-symbol">${icon('mail')}</span><span><strong>Поддержка по почте</strong><small>support@vertux.online</small></span>${icon('external')}</a>
            <p class="privacy-note">Обращения из формы и ответы команды сохраняются в кабинете.</p>
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
          <details><summary>Данные не обновляются. Что проверить?</summary><p>Проверьте интернет и статус подключения в Workspace, обновление повторится автоматически. Если ошибка остаётся, укажите её текст и время в обращении.</p></details>
          <details><summary>Где посмотреть срок подписки?</summary><p>В разделе «Подписка» показаны текущий статус, срок доступа и доступные условия продления. Подтверждение оплаты должно появиться в Nexus.</p></details>
          <details><summary>Как войти на другом компьютере?</summary><p>Установите Nexus и войдите в свой аккаунт. Список устройств и управление доступом находятся в настройках. Локальные данные Workspace и ключи брокера остаются на том компьютере, где вы их добавили.</p></details>
          <details><summary>Как подключиться по приглашению?</summary><p>Введите код компании в профиле Nexus. Приглашение добавит выданные вам продукты к вашему аккаунту.</p></details>
          <aside class="support-tip">${icon('bulb')}<div><strong>Совет</strong><p>Укажите раздел и последовательность действий — это поможет быстрее разобраться в вопросе.</p></div></aside>
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
      this.shadowRoot.querySelectorAll('[data-subscription-scroll]').forEach(button => button.addEventListener('click', () => {
        const destination = button.dataset.subscriptionScroll;
        const selector = destination === 'plans' ? '#subscription-plans' : ['free','standard','plus','pro'].includes(destination) ? `[data-plan="${destination}"]` : '.subscription-payment, #subscription-payment-info';
        const target = this.shadowRoot.querySelector(selector);
        target?.setAttribute('tabindex', '-1');
        target?.focus({ preventScroll: true });
        target?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
      }));
      this.shadowRoot.querySelector('.subscription-manual-payment')?.addEventListener('toggle', event => {
        this.state.manualPaymentOpen = event.currentTarget.open;
      });
      this.shadowRoot.querySelectorAll('[data-autopay-dialog]').forEach(button => button.addEventListener('click', () => {
        if (this.state.busy || this.state.stale) return;
        this.state.autopayDialog = button.dataset.autopayDialog;
        this.state.autopayConsent = false;
        this.state.autopayTermsAccepted = false;
        this.state.autopayPrivacyAccepted = false;
        this.state.autopayRequestId = null;
        this.render();
      }));
      const closeAutopay = () => {
        if (this.state.busy) return;
        this.state.autopayDialog = null;
        this.state.autopayConsent = false;
        this.render();
        this.shadowRoot.querySelector('[role="switch"]')?.focus();
      };
      this.shadowRoot.querySelectorAll('[data-autopay-close]').forEach(button => button.addEventListener('click', closeAutopay));
      const dialog = this.shadowRoot.querySelector('.subscription-autopay-dialog');
      if (dialog) {
        dialog.addEventListener('cancel', event => { event.preventDefault(); closeAutopay(); });
        for (const [selector, key] of [['[data-autopay-consent]','autopayConsent'], ['[data-autopay-terms]','autopayTermsAccepted'], ['[data-autopay-privacy]','autopayPrivacyAccepted']]) {
          dialog.querySelector(selector)?.addEventListener('change', event => {
            this.state[key] = event.target.checked;
            const billing = this.state.data?.standardSubscription;
            const term = this.subscriptionTerms(billing).find(item => item.months === this.state.billingMonths);
            dialog.querySelector('[data-autopay-confirm]').disabled = this.state.busy || this.state.stale || !this.state.autopayConsent || !this.state.autopayTermsAccepted || !this.state.autopayPrivacyAccepted
              || !this.autopayQuote(billing, {id:'standard'}, term, false) || !this.subscriptionSafeUrl(billing.termsUrl) || !this.subscriptionSafeUrl(billing.privacyUrl);
          });
        }
        dialog.showModal();
      }
      this.shadowRoot.querySelector('[data-autopay-confirm]')?.addEventListener('click', () => this.autopayAction('confirm'));
      this.shadowRoot.querySelector('[data-autopay-refresh]')?.addEventListener('click', () => this.autopayAction('refresh'));
      this.shadowRoot.querySelector('[data-all-payments]')?.addEventListener('click', () => {
        this.state.allPayments = !this.state.allPayments;
        this.render();
        this.shadowRoot.querySelector('[data-all-payments]')?.focus();
      });
      this.shadowRoot.querySelector('[data-billing-terms]')?.addEventListener('click', event => {
        if (window.nexusProduct) { event.preventDefault(); this.billingAction('terms'); }
      });
      this.shadowRoot.querySelectorAll('[name="billing-months"]').forEach(input => input.addEventListener('change', () => {
        this.selectSubscriptionTerm(Number(input.value));
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
        button.addEventListener('click', () => { this.openSection(button.dataset.section); this.shadowRoot.querySelector('.body')?.focus(); });
      });
      this.shadowRoot.querySelectorAll('[data-action="reload"]').forEach((button) => {
        button.addEventListener('click', async () => { await this.load(); const focus = this.shadowRoot.querySelector('.body, .subscription-error'); focus?.setAttribute('tabindex', '-1'); focus?.focus(); });
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
