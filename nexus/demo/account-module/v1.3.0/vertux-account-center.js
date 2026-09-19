import { createPersonalAccount } from './personal-account.js';
import { accountTemplate } from './template.js';
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/gu, value => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[value]);
const operations = Object.freeze({
  'GET /api/account/desktop-devices':'devices.list', 'POST /api/account/desktop-devices/access':'devices.access',
  'GET /api/profile':'profile.read', 'PATCH /api/profile':'profile.update',
  'POST /api/profile/password':'profile.password', 'POST /api/profile/2fa/email/start':'profile.2fa.start',
  'POST /api/profile/2fa/email/verify':'profile.2fa.verify', 'POST /api/invitations/accept':'invitation.accept',
  'GET /api/profile/sessions':'profile.sessions', 'POST /api/profile/sessions/revoke':'profile.session.revoke',
  'POST /api/profile/email/start':'profile.email.start', 'POST /api/profile/email/verify':'profile.email.verify',
  'GET /api/auth/google/status':'profile.google.status',
});
export class VertuxAccountCenter extends HTMLElement {
  static get observedAttributes() { return ['section']; }
  constructor() {
    super(); this.attachShadow({mode:'open'}); this.state = {me:null,products:[],releaseAssignments:[]};
    this.shadowRoot.innerHTML = `<link rel="stylesheet" href="${new URL('./account-center.css', import.meta.url).href}"><header class="account-heading"><h1 tabindex="-1"></h1><p></p></header><p class="account-loading" role="status">Загружаем общий аккаунт…</p><button class="account-retry" type="button" hidden>Повторить</button><div class="account-content" hidden>${accountTemplate}</div>`;
    this.shadowRoot.querySelector('.account-retry').addEventListener('click', () => void this.refresh());
    this.shadowRoot.querySelector('.theme-card')?.remove();
    const local = document.createElement('div'); local.className='workspace-options'; local.innerHTML='<slot name="workspace-settings"></slot>';
    this.shadowRoot.querySelector('#settingsPage').prepend(local);
    this.shadowRoot.querySelectorAll('.back-link').forEach(element => element.remove());
    this.shadowRoot.querySelectorAll('#profileTitle,#settingsTitle,#profileTitle + p,#settingsTitle + p').forEach(element => element.remove());
    this.shadowRoot.querySelector('#profilePage').setAttribute('aria-label','Профиль');
    this.shadowRoot.querySelector('#settingsPage').setAttribute('aria-label','Настройки');
    this.shadowRoot.querySelector('#profilePage').removeAttribute('aria-labelledby');
    this.shadowRoot.querySelector('#settingsPage').removeAttribute('aria-labelledby');
    this.shadowRoot.querySelectorAll('a[href="/launch?choose=1"]').forEach(link => {
      link.setAttribute('href','#products');
      link.addEventListener('click', event => { event.preventDefault(); void this.productBridge?.showProductSwitcher?.(); });
    });
    this.shadowRoot.addEventListener('click', event => {
      const link = event.target.closest('.profile-product-item');
      if (link) { event.preventDefault(); void this.productBridge?.showProductSwitcher?.(); }
    });
  }
  get productBridge() { return this.bridge || globalThis.nexusProduct; }
  connectedCallback() { this.showSection(); void this.refresh(); }
  attributeChangedCallback() { this.showSection(); }
  showSection() {
    const profile = this.getAttribute('section') === 'profile';
    this.shadowRoot.querySelector('.account-heading h1').textContent = profile ? 'Профиль' : 'Настройки';
    this.shadowRoot.querySelector('.account-heading p').textContent = profile ? 'Личные данные и защита входа. Изменения доступны во всех ваших Workspace.' : 'Оформление этого Workspace и общие настройки установленного Nexus.';
    this.shadowRoot.querySelector('.workspace-options').hidden = profile;
    this.shadowRoot.querySelector('#profilePage').hidden = !profile;
    this.shadowRoot.querySelector('#settingsPage').hidden = profile;
    this.controller?.viewChanged(profile ? 'profile' : 'settings');
  }
  async call(operation, value = {}) {
    const result = await this.productBridge?.account?.request?.(operation, value);
    if (result?.ok !== true) throw Object.assign(new Error(result?.error?.message || 'Общий аккаунт доступен в актуальном Nexus Desktop. Обновите приложение и откройте Workspace снова.'), { code:result?.error?.code || 'ACCOUNT_BRIDGE_UNAVAILABLE' });
    return result.data;
  }
  async request(path, options = {}) {
    if (path === '/api/status') return this.state.status || {};
    const operation = operations[`${options.method || 'GET'} ${path}`];
    if (!operation) throw new Error('Действие общего аккаунта не поддерживается.');
    return this.call(operation, options.body || {});
  }
  renderAccount() {
    const root = this.shadowRoot;
    const name = root.querySelector('#profileName');
    if (root.activeElement !== name) name.value = this.state.me?.name || '';
    root.querySelector('#profileEmail').value = this.state.me?.email || '';
    const selected = this.state.me?.startup?.mode === 'workspace' ? this.state.me.startup.productId : '';
    const workspaces = this.state.products.filter(product => product.product_type === 'workspace' && product.status === 'active');
    const unavailable = selected && !workspaces.some(product => product.id === selected);
    const selector = root.querySelector('#startupSelection');
    if (root.activeElement !== selector) {
      selector.innerHTML = '<option value="">Показывать выбор продуктов</option>' + workspaces.map(product => `<option value="${escapeHtml(product.id)}">Сразу открыть ${escapeHtml(product.name)}</option>`).join('')
        + (unavailable ? `<option value="${escapeHtml(selected)}" disabled>Выбранный Workspace сейчас недоступен</option>` : '');
      selector.value = selected;
    }
    this.dispatchEvent(new CustomEvent('vertux-account-changed', { bubbles:true, composed:true, detail:{name:this.state.me?.name || ''} }));
  }
  async refresh() {
    if (this.refreshing) return this.refreshing;
    const generation = this.requestGeneration = (this.requestGeneration || 0) + 1;
    this.refreshing = (async () => {
      const status = this.shadowRoot.querySelector('.account-loading');
      const content = this.shadowRoot.querySelector('.account-content');
      const retry = this.shadowRoot.querySelector('.account-retry');
      retry.hidden = true;
      try {
        const [context, desktopClient] = await Promise.all([this.call('context'), this.productBridge?.app?.info?.()]);
        if (generation !== this.requestGeneration || !this.isConnected) return;
        if (this.state.me && this.state.me.id !== context.me?.id) throw new Error('Аккаунт изменился. Откройте Workspace заново.');
        Object.assign(this.state, context, {desktopClient});
        this.renderAccount();
        const navigation = this.workspaceNavigation;
        if (!this.controller && navigation) {
          const form=this.shadowRoot.querySelector('#shortcutForm');
          const card=form.closest('article');
          card.querySelector('h3').textContent='Навигация в '+navigation.title;
          card.querySelector('.eyebrow').textContent='СОЧЕТАНИЯ ЭТОГО WORKSPACE';
          card.querySelector('.settings-state').textContent='Этот Workspace';
          form.querySelector('.shortcut-list').innerHTML=navigation.actions.map(action => '<div class="shortcut-row"><label for="workspaceShortcut-'+action.id+'"><strong>'+escapeHtml(action.label)+'</strong></label><div><input id="workspaceShortcut-'+action.id+'" name="'+action.id+'" class="shortcut-input" maxlength="40" autocomplete="off" spellcheck="false" aria-describedby="shortcutFeedback"><button class="button ghost compact-button" type="button" data-save-shortcut="'+action.id+'" aria-label="Сохранить сочетание: '+escapeHtml(action.label)+'">Сохранить</button></div></div>').join('');
          this.shadowRoot.querySelector('.workspace-options').after(card);
        }
        if (!this.controller) this.controller = createPersonalAccount({
          state:this.state, request:(...args)=>this.request(...args), root:this.shadowRoot, embedded:true,
          desktopBridge:this.productBridge?.app, workspaceNavigation:this.workspaceNavigation, escapeHtml, accountRoute:()=> '#products',
          refreshProducts: async () => Object.assign(this.state, await this.call('context')),
          renderAccount:()=>this.renderAccount(), onAuthRequired:()=>this.setAttribute('session-expired',''),
          openExternal:()=> { const link=document.createElement('a'); link.href='https://vertux.online/nexus/download.html'; link.target='_blank'; link.rel='noopener noreferrer'; link.click(); },
        });
        this.showSection(); await this.controller.load();
        if (generation !== this.requestGeneration || !this.isConnected) return;
        content.hidden=false;status.hidden=true;
        this.dispatchEvent(new CustomEvent('vertux-account-ready',{bubbles:true,composed:true}));
      } catch (error) {
        if (generation !== this.requestGeneration) return;
        content.hidden=true;status.hidden=false;status.textContent=error.message;retry.hidden=false;
      }
    })().finally(()=>{this.refreshing=null;});
    return this.refreshing;
  }
}
if (!customElements.get('vertux-account-center')) customElements.define('vertux-account-center',VertuxAccountCenter);
