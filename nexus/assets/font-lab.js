(() => {
  const families = {rubik:'Rubik',plex:'IBM Plex Sans',unbounded:'Unbounded',onest:'Onest',golos:'Golos Text',geologica:'Geologica',manrope:'Manrope',inter:'Inter'};
  const character = {
    rubik:'Rubik: округлые углы и более мягкий рисунок букв.',
    plex:'IBM Plex Sans: открытые формы, характерные срезы штрихов и двухэтажная латинская g. Посмотрите на строку «бт ag».',
    unbounded:'Unbounded: широкие геометрические буквы. Выразительный вариант для заголовков; для длинного текста он может быть слишком плотным.',
    onest:'Onest: близок к Inter по общему характеру. Отличия спокойные — сравните «Дд Лл» и латинские a и g.',
    golos:'Golos Text: близок к Inter. Здесь полезнее сравнивать длинный текст, пропорции и отдельные буквы, чем ждать резкой смены характера.',
    geologica:'Geologica: округлая геометрия и более плотный рисунок. При том же числовом весе может выглядеть темнее Inter.',
    manrope:'Manrope: геометрические формы и более широкие пропорции. Сравните цифры и латинскую g.',
    inter:'Inter: прежний шрифт сайта. Обе колонки намеренно одинаковые — это точка отсчёта.'
  };
  const params = new URL(location.href).searchParams;
  const selected = Object.hasOwn(families,params.get('font')) ? params.get('font') : 'rubik';
  document.querySelector(`input[name="font"][value="${selected}"]`).checked = true;
  const weight = document.getElementById('font-weight');
  if (['400','500','600'].includes(params.get('weight'))) weight.value=params.get('weight');
  let revision=0;
  async function update() {
    const id=document.querySelector('input[name="font"]:checked').value, family=families[id], turn=++revision;
    document.documentElement.style.setProperty('--sample-font',`'${family}'`);
    document.documentElement.style.setProperty('--sample-weight',weight.value);
    document.getElementById('font-name').textContent=family;
    document.getElementById('comparison-name').textContent=family;
    document.getElementById('font-character').textContent=character[id];
    const link=document.getElementById('try-font');link.removeAttribute('href');link.setAttribute('aria-disabled','true');
    history.replaceState(null,'',`?font=${id}&weight=${weight.value}`);
    const status=document.getElementById('font-status');status.textContent=`Загружаем ${family}…`;status.dataset.state='loading';
    try {
      const faces=await Promise.all([document.fonts.load(`${weight.value} 32px "${family}"`,'Дд Лл бт Ваши инвестиции'),document.fonts.load(`400 16px "${family}"`,'Workspace ag 123 ₽')]);
      if(faces.some(group=>group.length===0||group.some(face=>face.status!=='loaded')))throw new Error('Missing font face');
      if(turn===revision){status.textContent=`Показан ${family} · ${weight.value}`;status.dataset.state='ready';link.href=`index.html?font=${id}&weight=${weight.value}`;link.removeAttribute('aria-disabled');}
    } catch {if(turn===revision){status.textContent=`Не удалось загрузить ${family}. Обновите страницу, чтобы сравнить его корректно.`;status.dataset.state='error';}}
  }
  document.querySelectorAll('input[name="font"]').forEach(input=>input.addEventListener('change',update));
  weight.addEventListener('change',update);void update();
})();
