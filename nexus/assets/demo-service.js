// Public synthetic preview: chart edits live only in the page; broker and account writes remain disabled.
(() => {
 const allowed='[data-view],[data-go-view],[data-ledger-tab],.rail-collapse,[data-risk-tab],[data-terminal-tab],[data-side],[data-company-tab],[data-open-rail],[data-close-rail],.mobile-menu,.rail-close,summary,[data-chart-uid]';
 const chartAllowed='.terminal-main button,.terminal-main select,.terminal-popover button,.terminal-popover input,.terminal-popover select,.terminal-workspace-bar button,[data-collapse],[data-market-bottom],[data-market-side],#instrumentListSearch,#instrumentListScope,a[data-demo-studio]';
 const blocked='[data-detach-chart],[data-context="plan"],[data-context="alert"]';
 const canUse=el=>el.matches(allowed)||el.matches(chartAllowed)&&!el.matches(blocked);
 function lock(root=document){
  root.querySelectorAll('button,input,select,textarea,[contenteditable]').forEach(el=>{
   if(canUse(el))return;
   if(!el.disabled)el.disabled=true;
   if(el.hasAttribute('contenteditable'))el.contentEditable='false';
   if(!el.title)el.title='Просмотр демо. Изменения доступны в приложении.';
  });
 }
 document.addEventListener('submit',e=>{if(e.target.matches('.terminal-date-form'))return;e.preventDefault();e.stopImmediatePropagation();},true);
 document.addEventListener('click',e=>{const target=e.target.closest('button,input,select,textarea,a,[contenteditable]');if(!target)return;if(canUse(target))return;e.preventDefault();e.stopImmediatePropagation();},true);
 document.addEventListener('keydown',e=>{if(e.target.matches('input,textarea,[contenteditable]')&&!canUse(e.target)){e.preventDefault();e.stopImmediatePropagation();}},true);
 const query=new URLSearchParams(location.search),requested=query.get('poster')||query.get('view');
 const initialView=['overview','analytics','terminal','events'].includes(requested)?requested:'overview';
 let ready=false,viewSelected=false,painting=false;
 function signalReady(){
  if(ready||painting||!/[0-9]/.test(document.querySelector('#netPnl')?.textContent||''))return;
  if(!viewSelected){viewSelected=true;if(initialView!=='overview'){document.querySelector('[data-view="'+initialView+'"]')?.click();painting=true;requestAnimationFrame(()=>requestAnimationFrame(()=>{painting=false;signalReady();}));return;}}
  if(initialView!=='overview'&&document.body.dataset.currentView!==initialView)return;
  ready=true;document.documentElement.dataset.demoReady='true';if(parent!==window)parent.postMessage({type:'nexus-demo-ready'},location.origin);
 }
 let pending=false;new MutationObserver(()=>{if(!pending){pending=true;queueMicrotask(()=>{pending=false;lock();signalReady();});}}).observe(document.documentElement,{childList:true,subtree:true});
 lock();signalReady();
 if(new URLSearchParams(location.search).has('poster'))document.documentElement.classList.add('demo-poster');
})();
