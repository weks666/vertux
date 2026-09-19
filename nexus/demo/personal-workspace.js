// Product preferences stay scoped to the signed-in user and this Workspace.
// Retired digest/watchlist records remain in storage; no background digest is started.
const preferenceIcons = {
  personalLanguage: '<path d="M4 5h12M10 3v2M6 5c.5 5 3.5 8 8 10M14 5c-.5 5-3.5 8-8 10M14 20l4-10 4 10M15.5 16h5"/>',
  personalCurrency: '<path d="M8 21V3h6a5 5 0 0 1 0 10H5M5 17h10"/>',
  personalDensity: '<path d="M8 5h13M8 12h13M8 19h13M3 5h.01M3 12h.01M3 19h.01"/>',
  personalTextSize: '<path d="M4 19 10 5l6 14M6 15h8M18 9v10M16 11l2-2 2 2"/>',
  workspaceTheme: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M12 3a9 9 0 0 1 0 18Z"/>',
};

// Keep the original select values as the form contract. Native radio groups
// provide visible choices, arrow-key navigation and a single selection per row.
export function mountWorkspaceSettingsAppearance(form) {
  if (form.dataset.appearanceReady) return;
  form.dataset.appearanceReady = 'true';
  form.classList.add('personal-preferences');
  const fieldset = form.querySelector('fieldset');
  fieldset.querySelector('legend').textContent = 'Внешний вид';
  const grid = form.querySelector('.personal-settings-grid');
  for (const id of ['personalLanguage', 'personalCurrency', 'personalDensity', 'personalTextSize', 'workspaceTheme']) {
    const select = form.querySelector('#' + id);
    const originalLabel = select.closest('label');
    const title = originalLabel.firstChild.textContent.trim();
    const row = document.createElement('div');
    row.className = 'personal-preference-row';
    row.innerHTML = '<svg class="personal-preference-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + preferenceIcons[id] + '</svg>';
    const label = document.createElement('span');
    label.className = 'personal-preference-title';
    label.id = id + 'Label';
    label.textContent = title;
    const choices = document.createElement('div');
    choices.className = 'personal-choice-group';
    choices.setAttribute('role', 'radiogroup');
    choices.setAttribute('aria-labelledby', label.id);
    for (const option of select.options) {
      const choice = document.createElement('label');
      choice.className = 'personal-choice';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = id + 'Choice';
      input.value = option.value;
      input.dataset.preferenceSelect = id;
      input.checked = option.value === select.value;
      const text = document.createElement('span');
      text.textContent = option.textContent;
      choice.append(input, text);
      choices.append(choice);
      input.addEventListener('change', event => {
        event.stopPropagation();
        if (!input.checked) return;
        select.value = input.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }
    // The enhanced radio group is the accessible control; the select stays as
    // the compatibility bridge for saved preferences and the theme handler.
    select.hidden = true;
    row.append(label, choices, select);
    originalLabel.remove();
    grid.append(row);
    if (id === 'personalCurrency') {
      const note = form.querySelector('#displayCurrencyNote');
      note.className = 'personal-row-note';
      row.append(note);
      choices.setAttribute('aria-describedby', note.id);
    }
  }
  for (const note of form.querySelectorAll('.personal-preview')) note.className = 'personal-settings-note';
  const retry = document.createElement('button');
  retry.id = 'personalSettingsRetry';
  retry.className = 'button secondary';
  retry.type = 'button';
  retry.textContent = 'Повторить';
  retry.hidden = true;
  form.querySelector('.personal-actions').append(retry);
}

export function initWorkspacePreferences({ request, showToast, onPresentation=()=>{} }) {
  const $ = selector => document.querySelector(selector);
  const form = $('#personalSettings');
  mountWorkspaceSettingsAppearance(form);
  let preferences = null;
  let pending = null;
  const syncChoices = () => {
    for (const input of form.querySelectorAll('[data-preference-select]')) input.checked = input.value === $('#' + input.dataset.preferenceSelect).value;
  };
  const setBusy = busy => {
    form.setAttribute('aria-busy', String(busy));
    for (const control of form.querySelectorAll('input,select,button')) control.disabled = busy || !preferences;
    $('#personalSettingsRetry').disabled = busy;
  };
  const apply = settings => {
    document.documentElement.dataset.textSize = settings.textSize;
    document.documentElement.dataset.density = settings.density;
    syncChoices();
    onPresentation(settings);
  };
  const values = () => ({ textSize: $('#personalTextSize').value, density: $('#personalDensity').value,language:$('#personalLanguage').value,displayCurrency:$('#personalCurrency').value,
    digestEnabled: preferences?.digestEnabled ?? false, digestTime: preferences?.digestTime || '09:00' });
  const render = settings => {
    preferences = settings;
    $('#personalTextSize').value = settings.textSize;
    $('#personalDensity').value = settings.density;
    $('#personalLanguage').value = settings.language||'ru';
    $('#personalCurrency').value = settings.displayCurrency||'RUB';
    apply(settings);
  };
  function refresh() {
    if (pending) return pending;
    setBusy(true);
    $('#personalSettingsRetry').hidden = true;
    pending = Promise.resolve().then(async () => {
      try { render(await request('/api/market/preferences')); $('#personalSettingsStatus').textContent = ''; }
      catch (error) {
        $('#personalSettingsStatus').textContent = error.message;
        $('#personalSettingsRetry').hidden = false;
      }
      finally { pending = null; setBusy(false); }
    });
    return pending;
  }
  form.addEventListener('change', event => {
    if (!preferences || pending) return;
    apply(values());
    if (event.target.id !== 'workspaceTheme') $('#personalSettingsStatus').textContent = 'Изменения видны сразу. Сохраните их для следующего входа.';
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!preferences || pending || $('#personalSettingsSave').disabled) return;
    const draft = values();
    setBusy(true);
    pending = Promise.resolve().then(async () => {
      try {
        render(await request('/api/market/preferences', { method: 'POST', body: JSON.stringify(draft) }));
        $('#personalSettingsStatus').textContent = 'Вид Workspace сохранён.';
      } catch (error) { $('#personalSettingsStatus').textContent = error.message; showToast(error.message, true); }
      finally { pending = null; setBusy(false); }
    });
    await pending;
  });
  $('#personalSettingsReset').addEventListener('click', () => {
    if (!preferences || pending) return;
    $('#personalTextSize').value = 'standard'; $('#personalDensity').value = 'comfortable'; apply(values());
    $('#personalSettingsStatus').textContent = 'Обычный вид выбран. Сохраните настройки, чтобы оставить его.';
  });
  $('#personalSettingsRetry').addEventListener('click', () => refresh());
  void refresh();
  return { refresh };
}
