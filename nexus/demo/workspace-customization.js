const hex=value=>/^#[0-9a-f]{6}$/i.test(value||'');
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const luminance=color=>{const c=color.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];};
const mix=(a,b,t)=>'#'+a.slice(1).match(/../g).map((v,i)=>Math.round(parseInt(v,16)*(1-t)+parseInt(b.slice(1+i*2,3+i*2),16)*t).toString(16).padStart(2,'0')).join('');
export function workspaceColors({theme='invest',accent='#865dff',background}={}) {
 const base=hex(background)?background:theme==='light'?'#f3f5fa':theme==='graphite'?'#101114':'#080e16';
 const light=luminance(base)>.35,foreground=light?'#172334':'#f3f6fd',edge=light?'#172334':'#e9efff';
 const color=hex(accent)?accent:'#865dff';let readable=color;
 for(let i=0;i<12&&(Math.max(luminance(readable),luminance(base))+.05)/(Math.min(luminance(readable),luminance(base))+.05)<4.5;i++)readable=mix(readable,foreground,.16);
 return {light,variables:{'--ink':base,'--surface':mix(base,light?'#ffffff':'#ffffff',light?.62:.025),'--surface-raised':mix(base,'#ffffff',light?.88:.05),'--surface-strong':mix(base,edge,.09),'--chart-bg':mix(base,'#ffffff',light?.9:.025),'--chart-line':mix(base,edge,.1),'--rail-bg':mix(base,light?'#ffffff':'#000000',.25),'--text':foreground,'--muted':mix(base,foreground,.72),'--faint':mix(base,foreground,.62),'--line':mix(base,edge,.15),'--line-strong':mix(base,edge,.27),'--vertux':color,'--vertux-soft':readable,'--focus':readable,'--action-fill':color,'--action-hover':mix(color,foreground,.12),'--action-text':luminance(color)>.18?'#111827':'#ffffff','--accent-surface':mix(base,color,.18),'--positive':light?'#087554':'#5ed0a0','--negative':light?'#bc304c':'#ef7b76','--warning':light?'#896018':'#e1b264'}};
}
export function preserveNavigationBindings(actions,saved={}) {
 const known=saved&&typeof saved==='object'&&!Array.isArray(saved)?Object.fromEntries(actions.filter(a=>typeof saved[a.id]==='string').map(a=>[a.id,saved[a.id]])):{};
 const used=new Set(Object.values(known));
 return actions.map((action,index)=>{let shortcut=action.shortcut;if(!Object.hasOwn(known,action.id)){if(used.has(shortcut)){let key=index+1;do{shortcut=`Ctrl+Alt+${key<=9?key:'F'+(key-9)}`;key++;}while(used.has(shortcut));}used.add(shortcut);}return {...action,shortcut};});
}
export function workspaceNavigationActions() {
 const actions=[...document.querySelectorAll('.navigation [data-view]')].map((b,i)=>({id:b.dataset.view==='terminal'?'instruments':b.dataset.view,label:b.querySelector('span').textContent,shortcut:'Ctrl+'+(i===9?'0':i+1)})).concat([
  {id:'subscription',label:'Подписка',shortcut:'Ctrl+Shift+1'},{id:'support',label:'Поддержка',shortcut:'Ctrl+Shift+2'},
  {id:'settings',label:'Настройки',shortcut:'Ctrl+,'},{id:'profile',label:'Профиль',shortcut:'Ctrl+Shift+3'}]);
 // Preserve existing choices when new sections introduce colliding defaults.
 let saved={};try{saved=JSON.parse(localStorage.getItem('vertux:workspace-navigation:kovrocity-invest')||'{}');}catch{}
 return preserveNavigationBindings(actions,saved);
}
export function initWorkspaceCustomization({navigation}) {
 const root=document.documentElement,rail=document.querySelector('.rail'),nav=rail.querySelector('.navigation');
 let scope='device',settings={},manualExpanded=false;
 const read=key=>{try{const value=JSON.parse(localStorage.getItem(key)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}};
 const key=()=>`invest:presentation:${scope}`;
 const readPresentation=()=>{const value=read(key());if(!value.theme){try{const legacy=localStorage.getItem('vertux-invest:appearance');if(['invest','graphite','light'].includes(legacy))value.theme=legacy;}catch{}}return value;};
 const save=()=>{try{localStorage.setItem(key(),JSON.stringify(settings));}catch{status.textContent='Не удалось сохранить настройки на устройстве.';}};
 const toggle=document.createElement('button');toggle.type='button';toggle.className='rail-collapse';toggle.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 3v18M3 3h18v18H3z M15 8l-4 4 4 4"/></svg>';rail.querySelector('.brand-lockup').append(toggle);
 function collapse(value){document.body.classList.toggle('rail-compact',value);toggle.setAttribute('aria-label',value?'Развернуть меню':'Свернуть меню');toggle.title=value?'Развернуть меню':'Свернуть меню';toggle.setAttribute('aria-expanded',String(!value));}
 toggle.addEventListener('click',()=>{const value=!document.body.classList.contains('rail-compact');manualExpanded=!value;settings.compact=value;collapse(value);save();});
 for(const b of rail.querySelectorAll('.nav-item')){const label=b.querySelector('span')?.textContent;if(label){b.setAttribute('aria-label',label);b.title=label;}}
 const section=document.createElement('section');section.className='workspace-customization';section.innerHTML=`<h3>Мой Workspace</h3><p>Оформление и порядок разделов сохраняются на этом устройстве.</p><div class="workspace-palette"><label>Тема<select data-presentation="theme"><option value="invest">Тёмная · Invest</option><option value="graphite">Графит</option><option value="light">Светлая</option></select></label><label>Акцент<input type="color" data-presentation="accent" value="#865dff"></label><label>Фон<input type="color" data-presentation="background" value="#080e16"></label><button type="button" data-reset-palette>Исходная палитра</button></div><h4>Порядок разделов и сочетания клавиш</h4><div class="workspace-menu-order"></div><p class="workspace-customization-status" role="status"></p>`;
 document.querySelector('[data-view-panel=settings]').prepend(section);const status=section.querySelector('[role=status]');
 function order(){const buttons=[...nav.querySelectorAll('[data-view]')],keys=[...new Set(Array.isArray(settings.order)?settings.order:[])];for(const id of keys){const b=buttons.find(b=>b.dataset.view===id);if(b)nav.append(b);}for(const b of buttons)if(!keys.includes(b.dataset.view))nav.append(b);}
 function renderOrder(){const shortcuts=navigation.read(),buttons=[...nav.querySelectorAll('[data-view]')];section.querySelector('.workspace-menu-order').innerHTML=buttons.map((b,i)=>{const id=b.dataset.view,action=id==='terminal'?'instruments':id;return `<div data-menu-view="${id}"><span>${esc(b.querySelector('span').textContent)}</span><button type="button" data-move="-1" ${i===0?'disabled':''} aria-label="Переместить вверх: ${esc(b.textContent)}">↑</button><button type="button" data-move="1" ${i===buttons.length-1?'disabled':''} aria-label="Переместить вниз: ${esc(b.textContent)}">↓</button><input aria-label="Сочетание: ${esc(b.textContent)}" data-shortcut="${action}" value="${esc(shortcuts[action])}" maxlength="40"></div>`;}).join('')+navigation.actions.filter(a=>['settings','profile','subscription','support'].includes(a.id)).map(a=>`<div class="fixed-menu-item"><span>${a.label}</span><small>Закреплён</small><input aria-label="Сочетание: ${a.label}" data-shortcut="${a.id}" value="${esc(shortcuts[a.id])}" maxlength="40"></div>`).join('');}
 function apply(){const value=workspaceColors(settings);root.dataset.workspaceTheme=settings.theme||'invest';root.dataset.palette=value.light?'light':'dark';for(const[name,color]of Object.entries(value.variables))root.style.setProperty(name,color);
  for(const field of section.querySelectorAll('[data-presentation]'))field.value=settings[field.dataset.presentation]||(field.dataset.presentation==='theme'?'invest':field.dataset.presentation==='accent'?'#865dff':value.variables['--ink']);
  order();renderOrder();collapse(settings.compact===true||(document.body.dataset.currentView==='terminal'&&!manualExpanded));
 }
 section.addEventListener('change',e=>{const name=e.target.dataset.presentation;if(name){settings[name]=e.target.value;if(name==='theme')delete settings.background;apply();save();status.textContent='Оформление сохранено.';}const action=e.target.dataset.shortcut;if(action){try{navigation.update({[action]:e.target.value});status.textContent='Сочетание сохранено.';}catch(error){status.textContent=({DUPLICATE_SHORTCUT:'Это сочетание уже занято.',RESERVED_SHORTCUT:'Это системное сочетание. Выберите другое.',INVALID_SHORTCUT:'Например: Ctrl+Alt+1.',APP_SETTINGS_WRITE_FAILED:'Не удалось сохранить сочетание.'})[error.code]||'Не удалось сохранить сочетание.';}}});
 section.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-reset-palette')){delete settings.accent;delete settings.background;settings.theme='invest';apply();save();}if(b.dataset.move){const rows=[...nav.querySelectorAll('[data-view]')],i=rows.findIndex(n=>n.dataset.view===b.closest('[data-menu-view]').dataset.menuView),next=i+Number(b.dataset.move);if(next<0||next>=rows.length)return;[rows[i],rows[next]]=[rows[next],rows[i]];settings.order=rows.map(n=>n.dataset.view);order();renderOrder();save();status.textContent='Порядок разделов сохранён.';}});
 document.addEventListener('invest:view-changed',e=>{if(e.detail==='terminal'){manualExpanded=false;collapse(true);}else collapse(settings.compact===true);});
 document.addEventListener('invest:identity',e=>{const identity=e.detail||{};scope=String(identity.userId||identity.id||identity.displayName||identity.name||'device');settings=readPresentation();apply();});
 const owner=document.querySelector('#identityName');const brand=()=>{const name=owner.textContent.trim();const label=name&&!['KovroCity','Демо-профиль'].includes(name)?name:'Vertux';rail.querySelector('.brand-lockup strong').textContent=label;rail.querySelector('.brand-mark').textContent=label==='Vertux'?'V':label.slice(0,2).toUpperCase();if(!document.body.classList.contains('terminal-detached'))document.title=label+' Invest Workspace';};
 new MutationObserver(brand).observe(owner,{childList:true,characterData:true,subtree:true});brand();settings=readPresentation();apply();
 document.querySelector('#workspaceTheme')?.addEventListener('change',e=>{settings.theme=e.target.value;delete settings.background;apply();save();});
 return {apply};
}
