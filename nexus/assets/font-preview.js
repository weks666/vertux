(() => {
  const families={rubik:'Rubik',plex:'IBM Plex Sans',unbounded:'Unbounded',onest:'Onest',golos:'Golos Text',geologica:'Geologica',manrope:'Manrope',inter:'Inter'};
  const params=new URL(location.href).searchParams,id=params.get('font');
  if(!Object.hasOwn(families,id))return;
  const weight=['400','500','600'].includes(params.get('weight'))?params.get('weight'):'500';
  const note=document.createElement('a');note.className='font-preview-note';note.href=`font-lab.html?font=${id}&weight=${weight}`;note.textContent=`Загружаем ${families[id]}…`;note.setAttribute('aria-label',`Предпросмотр ${families[id]}. Вернуться к выбору шрифта`);document.body.append(note);
  const link=document.createElement('link');link.rel='stylesheet';link.href='assets/fonts/font-choices.css?v=20260916c';
  link.addEventListener('load',async()=>{
    try {
      const groups=await Promise.all([document.fonts.load(`${weight} 48px "${families[id]}"`,'Ваши инвестиции'),document.fonts.load(`400 16px "${families[id]}"`,'Workspace 123 ₽')]);
      if(groups.some(group=>group.length===0||group.some(face=>face.status!=='loaded')))throw new Error('Missing font face');
      for(const role of ['--body','--display','--accent'])document.documentElement.style.setProperty(role,`'${families[id]}',system-ui,sans-serif`);
      const style=document.createElement('style');style.textContent=`
        .nexus-home h1,.nexus-home .section-title,.nexus-home .business-heading h2,.nexus-home .final-inner h2 {font-weight:${weight};overflow-wrap:anywhere}
        @media(max-width:700px) {
          .nexus-home .nav-wrap {gap:4px}
          .nexus-home .brand-name b {font-size:17px}
          .nexus-home .language {min-width:38px;font-size:9px}
          .nexus-home .nav-actions {gap:4px}
          .nexus-home .nav-cta {font-size:10px;padding-inline:8px}
          .font-preview-note {max-width:calc(100% - 166px)}
        }
      `;document.head.append(style);
      note.textContent=`${families[id]} · к шрифтам`;
    }catch{note.textContent=`${families[id]} не загрузился · к шрифтам`;}
  },{once:true});
  link.addEventListener('error',()=>{note.textContent=`Шрифт не загрузился · к шрифтам`;},{once:true});
  document.head.append(link);
})();
