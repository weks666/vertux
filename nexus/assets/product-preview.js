(() => {
 const nodes=[...document.querySelectorAll('[data-app-poster]')];
 function fit(node){const frame=node.querySelector('iframe');if(!frame)return;const width=Number(node.dataset.posterWidth)||1440,height=Number(node.dataset.posterHeight)||1000,scale=node.clientWidth/width;frame.style.width=width+'px';frame.style.height=height+'px';frame.style.transform='scale('+scale+')';node.style.height=(height*scale)+'px';if(node.clientWidth>0&&frame.dataset.posterSrc&&!frame.hasAttribute('src'))frame.src=frame.dataset.posterSrc;}
 window.addEventListener('message',event=>{if(event.origin!==location.origin||event.data?.type!=='nexus-demo-ready')return;const node=nodes.find(n=>n.querySelector('iframe').contentWindow===event.source);node?.classList.add('is-ready');});
 nodes.forEach(node=>node.querySelector('iframe').addEventListener('load',()=>{try{if(node.querySelector('iframe').contentDocument.documentElement.dataset.demoReady==='true')node.classList.add('is-ready');}catch{}}));
 const observer=new ResizeObserver(entries=>entries.forEach(e=>fit(e.target)));nodes.forEach(node=>{observer.observe(node);fit(node);});
})();
