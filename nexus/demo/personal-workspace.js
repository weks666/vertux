// Product preferences stay scoped to the signed-in user and this Workspace.
// Retired digest/watchlist records remain in storage; no background digest is started.
export function initWorkspacePreferences({ request, showToast, onPresentation=()=>{} }) {
  const $ = selector => document.querySelector(selector);
  let preferences = null;
  const apply = settings => {
    document.documentElement.dataset.textSize = settings.textSize;
    document.documentElement.dataset.density = settings.density;
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
  async function refresh() {
    $('#personalSettingsSave').disabled = true;
    try { render(await request('/api/market/preferences')); $('#personalSettingsStatus').textContent = ''; }
    catch (error) { $('#personalSettingsStatus').textContent = error.message; }
    finally { $('#personalSettingsSave').disabled = !preferences; }
  }
  $('#personalSettings').addEventListener('change', () => apply(values()));
  $('#personalSettings').addEventListener('submit', async event => {
    event.preventDefault();
    if (!preferences || $('#personalSettingsSave').disabled) return;
    $('#personalSettingsSave').disabled = true;
    try {
      render(await request('/api/market/preferences', { method: 'POST', body: JSON.stringify(values()) }));
      $('#personalSettingsStatus').textContent = 'Вид Workspace сохранён.';
    } catch (error) { $('#personalSettingsStatus').textContent = error.message; showToast(error.message, true); }
    finally { $('#personalSettingsSave').disabled = false; }
  });
  $('#personalSettingsReset').addEventListener('click', () => {
    $('#personalTextSize').value = 'standard'; $('#personalDensity').value = 'comfortable'; apply(values());
    $('#personalSettingsStatus').textContent = 'Обычный вид выбран. Сохраните настройки, чтобы оставить его.';
  });
  void refresh();
  return { refresh };
}
