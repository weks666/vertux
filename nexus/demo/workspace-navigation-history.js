export function mountWorkspaceHistory({doc=document,store}) {
 const bar=doc.createElement('nav');bar.className='workspace-history';bar.setAttribute('aria-label','История переходов');
 bar.innerHTML='<button type="button" data-history-step="-1" aria-label="Назад к предыдущему экрану" title="Назад · Alt + ←"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg></button><button type="button" data-history-step="1" aria-label="Вперёд к следующему экрану" title="Вперёд · Alt + →"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 6 6 6-6 6"/></svg></button>';
 doc.querySelector('.topbar-title').before(bar);
 let entries=[],index=-1,replaying=false,queued=false,disposed=false;
 const read=()=>({view:doc.body.dataset.currentView||'overview',deep:doc.querySelector('[data-deep-view][aria-pressed=true]')?.dataset.deepView||doc.querySelector('[data-deep-view].active')?.dataset.deepView,
  risk:doc.querySelector('[data-risk-tab][aria-selected=true]')?.dataset.riskTab,ledger:doc.querySelector('[data-ledger-tab][aria-selected=true]')?.dataset.ledgerTab,
  research:doc.querySelector('[data-visual-research-tool]')?.value,portfolio:doc.querySelector('[data-portfolio-picker]')?.value,portfolioArea:doc.querySelector('[data-portfolio-area][aria-pressed=true]')?.dataset.portfolioArea});
 const identity=s=>JSON.stringify([s.view,...(s.view==='analytics'?[s.deep,s.deep==='instrument'?s.research:s.deep==='capital'?s.portfolio:null]:s.view==='risk-plan'?[s.risk]:s.view==='operations'?[s.ledger]:[])]);
 const available=entry=>{const button=doc.querySelector('.rail [data-view="'+entry.view+'"]');return button&&!button.disabled&&!button.hidden;};
 function destination(step){for(let at=index+step;at>=0&&at<entries.length;at+=step)if(available(entries[at]))return at;return -1;}
 const paint=()=>bar.querySelectorAll('button').forEach(b=>b.disabled=destination(Number(b.dataset.historyStep))<0);
 function record(){queued=false;if(disposed||replaying)return;const next=read();if(index>=0&&identity(entries[index])===identity(next)){paint();return;}entries=entries.slice(0,index+1);entries.push(next);if(entries.length>60)entries.shift();index=entries.length-1;paint();}
 function schedule(){if(!queued){queued=true;queueMicrotask(record);}}
 function restore(step){const next=destination(step),s=entries[next];if(!s)return;const nav=doc.querySelector('.rail [data-view="'+s.view+'"]');if(!nav||nav.disabled||nav.hidden)return;
  replaying=true;nav.click();
  const click=(selector)=>{const b=doc.querySelector(selector);if(b&&!b.disabled&&b.getClientRects().length)b.click();};
  if(s.view==='analytics'){
   if(s.deep)click('[data-deep-view="'+s.deep+'"]');
   if(s.deep==='capital'&&s.portfolioArea)click('[data-portfolio-area="'+s.portfolioArea+'"]');
   if(s.deep==='capital'&&s.portfolio)click('[data-portfolio-tool="'+s.portfolio+'"]');
   const select=doc.querySelector(s.deep==='instrument'?'[data-visual-research-tool]':'[data-portfolio-picker]'),value=s.deep==='instrument'?s.research:s.portfolio;
   if(value&&select&&!select.disabled&&select.getClientRects().length){select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));}
  }
  if(s.view==='risk-plan')click('[data-risk-tab="'+s.risk+'"]');
  if(s.view==='operations')click('[data-ledger-tab="'+s.ledger+'"]');
  index=next;queueMicrotask(()=>{replaying=false;paint();});
 }
 bar.addEventListener('click',e=>{const b=e.target.closest('[data-history-step]');if(b&&!b.disabled)restore(Number(b.dataset.historyStep));});
 const keys=e=>{if(e.altKey&&!e.ctrlKey&&!e.metaKey&&['ArrowLeft','ArrowRight'].includes(e.key)&&!doc.querySelector('dialog[open]')){e.preventDefault();restore(e.key==='ArrowLeft'?-1:1);}};
 const events=['invest:view-changed','invest:task-route-changed'];events.forEach(name=>doc.addEventListener(name,schedule));
 const afterControl=e=>{if(e.target.closest('[data-deep-view],[data-risk-tab],[data-ledger-tab],[data-research-view],[data-visual-research-tool],[data-portfolio-tool],[data-portfolio-picker],[data-portfolio-area]'))schedule();};
 doc.addEventListener('click',afterControl);doc.addEventListener('change',afterControl);doc.addEventListener('keydown',keys);
 // Route history contains no profile data. A rejected settings write or a
 // feature-specific access error must still let the user return to a safe page.
 const owner=()=>JSON.stringify([store.key?.()||null,store.status().persistence]);
 let historyOwner=owner();
 const unsubscribe=store.subscribe(reason=>{if(reason==='identity'){const nextOwner=owner();if(nextOwner!==historyOwner){historyOwner=nextOwner;entries=[];index=-1;}schedule();}else if(reason==='error')paint();});record();
 return{dispose(){disposed=true;unsubscribe();events.forEach(name=>doc.removeEventListener(name,schedule));doc.removeEventListener('click',afterControl);doc.removeEventListener('change',afterControl);doc.removeEventListener('keydown',keys);bar.remove();}};
}
