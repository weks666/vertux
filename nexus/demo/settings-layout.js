import {controlNode,controlButton} from './interface-controls.js';

// Presentation only: existing controls keep their nodes, owners and persistence.
// In particular, Account Center stays outside the customization event boundary.
export function mountSettingsLayout(doc=document) {
  const host=doc.querySelector('[data-view-panel=settings]');
  const customization=host?.querySelector('.workspace-customization');
  if(!host||!customization)return {dispose(){}};
  const layout=controlNode('div',undefined,'settings-workspace');
  const navigation=controlNode('nav',undefined,'settings-navigation');
  navigation.setAttribute('aria-label','Разделы настроек');
  const content=controlNode('div',undefined,'settings-content');
  const pages=new Map(),buttons=new Map();
  layout.append(navigation,content);host.append(layout);content.append(customization);
  const titles={appearance:'Внешний вид',workspace:'Работа с приложением',charts:'Графики',account:'Личные параметры',data:'Данные и перенос',about:'О приложении'};
  function select(id,focus=false){
    if(!pages.has(id))return;
    for(const [key,page]of pages){page.hidden=key!==id;buttons.get(key).setAttribute('aria-current',key===id?'page':'false');}
    if(focus)pages.get(id).querySelector('h3')?.focus({preventScroll:true});
  }
  for(const [id,title]of Object.entries(titles)){
    const page=controlNode('section',undefined,'settings-page');page.dataset.settingsPage=id;page.id='settings-page-'+id;
    const heading=controlNode('h3',title,'settings-page-title');heading.tabIndex=-1;page.append(heading);page.setAttribute('aria-labelledby',heading.id='settings-title-'+id);
    (['appearance','workspace','data'].includes(id)?customization:content).append(page);pages.set(id,page);
    const button=controlButton(title,()=>select(id),{className:'settings-nav-item'});button.setAttribute('aria-controls',page.id);button.dataset.settingsTab=id;navigation.append(button);buttons.set(id,button);
  }
  const move=(id,selector)=>{for(const el of [...host.querySelectorAll(selector)])pages.get(id).append(el);};
  move('appearance','.visual-theme-options,.workspace-palette,.workspace-card-lighting,.workspace-background-settings');
  const effects=customization.querySelector('[data-visual-effects]')?.closest('label');if(effects)pages.get('appearance').append(effects);
  move('workspace','.workspace-panel-settings,.ux-settings-group');
  const menu=pages.get('workspace').querySelector('.ux-settings-group');
  if(menu){const group=controlNode('section',undefined,'settings-control-group');group.append(controlNode('h4','Меню и сочетания клавиш'));for(const child of [...menu.children])if(child.tagName!=='SUMMARY')group.append(child);menu.replaceWith(group);}
  const refresh=customization.querySelector('[data-refresh-status]')?.closest('label');if(refresh)pages.get('workspace').append(refresh);
  move('data','.workspace-settings-transfer,.workspace-reset-settings');
  // These hosts must not inherit workspace-customization change handlers.
  const transfer=pages.get('data'),externalData=controlNode('section',undefined,'settings-page');
  externalData.dataset.settingsPage='data';externalData.hidden=true;content.append(externalData);
  for(const selector of ['#nativeListsTransfer','#personalPreferencesTransfer']){const item=host.querySelector(selector);if(item)externalData.append(item);}
  move('account','#accountSettingsHost');move('charts','.chart-preferences-section');move('about','.app-about');
  for(const page of pages.values()){
    const nested=page.querySelector(':scope>.chart-preferences-section>h3,:scope>.app-about>h3');if(nested)nested.hidden=true;
  }
  for(const el of [...customization.children])if(el.matches('h3,p:not(.workspace-customization-status)'))el.hidden=true;
  const status=customization.querySelector('.workspace-customization-status'),recovery=customization.querySelector('.workspace-settings-recovery');
  if(recovery)customization.prepend(recovery);if(status)customization.append(status);
  const sync=()=>{externalData.hidden=transfer.hidden;};
  const observer=new MutationObserver(sync);observer.observe(transfer,{attributes:true,attributeFilter:['hidden']});
  const reveal=event=>{const page=event.detail?.target?.closest?.('[data-settings-page]');if(page&&host.contains(page)){select(page.dataset.settingsPage);sync();}};
  doc.addEventListener('invest:reveal-workspace-target',reveal,true);
  navigation.addEventListener('keydown',event=>{
    if(!['ArrowDown','ArrowUp','ArrowRight','ArrowLeft','Home','End'].includes(event.key))return;
    const rows=[...buttons.values()],at=rows.indexOf(doc.activeElement);if(at<0)return;event.preventDefault();
    const next=rows[event.key==='Home'?0:event.key==='End'?rows.length-1:(at+(['ArrowUp','ArrowLeft'].includes(event.key)?-1:1)+rows.length)%rows.length];next.focus();next.click();
  });
  select('appearance');sync();host.dataset.settingsLayout='sections';
  return {dispose(){observer.disconnect();doc.removeEventListener('invest:reveal-workspace-target',reveal,true);}};
}
