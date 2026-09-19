(() => {
  'use strict';
  const text = [...document.querySelectorAll('[data-nx-en]')].map(node => ({node,ru:node.textContent,en:node.dataset.nxEn}));
  const attrs = [...document.querySelectorAll('[data-nx-aria-en],[data-nx-meta-en],[data-nx-title-en]:not(body)')].map(node => {
    const attr=node.hasAttribute('data-nx-aria-en')?'aria-label':node.hasAttribute('data-nx-meta-en')?'content':'title';
    return {node,attr,ru:node.getAttribute(attr),en:node.dataset.nxAriaEn||node.dataset.nxMetaEn||node.dataset.nxTitleEn};
  });
  const titleRu=document.title;
  const paint=()=>{
    const en=document.documentElement.lang==='en';
    for(const item of text) item.node.textContent=en?item.en:item.ru;
    for(const item of attrs) item.node.setAttribute(item.attr,en?item.en:item.ru);
    if(document.body.dataset.nxTitleEn) document.title=en?document.body.dataset.nxTitleEn:titleRu;
    document.querySelectorAll('.nx-demo-language').forEach(node=>{node.hidden=!en;});
  };
  document.addEventListener('nexus:language-change',paint); paint();
  const tabs=[...document.querySelectorAll('[data-plan]')];
  function choose(plan,{focus=false}={}){
    if(!['standard','pro'].includes(plan))return;
    for(const tab of tabs){const active=tab.dataset.plan===plan;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;document.getElementById(tab.getAttribute('aria-controls')).hidden=!active;if(active&&focus)tab.focus();}
  }
  tabs.forEach((tab,index)=>{
    tab.addEventListener('click',()=>choose(tab.dataset.plan));
    tab.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();
      const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
      choose(tabs[next].dataset.plan,{focus:true});
    });
  });
  document.querySelectorAll('[data-select-standard]').forEach(button=>button.addEventListener('click',()=>choose('standard',{focus:true})));
  if(new URL(location.href).searchParams.get('tier')==='pro')choose('pro');
  const current=location.pathname.split('/').pop()||'index.html';
  document.querySelectorAll('.main-nav a').forEach(link=>{if(link.getAttribute('href')===current)link.setAttribute('aria-current','page');});
  // Keep old shared links/bookmarks meaningful after separating product pages.
  if(document.body.dataset.page==='platform'){
    const old={'#invest':'invest.html','#invest-tour':'invest.html#demo','#invest-plan':'pricing.html','#business':'workspace.html','#product':'workspace.html#business'};
    if(old[location.hash])location.replace(old[location.hash]);
  }
})();
