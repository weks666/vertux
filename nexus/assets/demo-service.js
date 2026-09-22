// Public site demo: only navigation and reading; no mutations or simulated writes.
(() => {
 const allowed='[data-view],[data-go-view],[data-ledger-tab],.rail-collapse,[data-risk-tab],[data-terminal-tab],[data-side],[data-company-tab],[data-open-rail],[data-close-rail],.mobile-menu,.rail-close,summary,[data-chart-uid]';
 function lock(root=document){
  root.querySelectorAll('button,input,select,textarea,[contenteditable]').forEach(el=>{
   if(el.matches(allowed))return;
   if(!el.disabled)el.disabled=true;
   if(el.hasAttribute('contenteditable'))el.contentEditable='false';
   if(!el.title)el.title='Просмотр демо. Изменения доступны в приложении.';
  });
 }
 document.addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation();},true);
 document.addEventListener('click',e=>{const target=e.target.closest('button,input,select,textarea,a,[contenteditable]');if(!target)return;if(target.matches(allowed))return;e.preventDefault();e.stopImmediatePropagation();},true);
 document.addEventListener('keydown',e=>{if(e.target.matches('input,textarea,[contenteditable]')){e.preventDefault();e.stopImmediatePropagation();}},true);
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
