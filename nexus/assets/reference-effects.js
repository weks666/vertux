/* Border Beam motion adapted from Motiq's MIT-licensed Border Beam Panel
 * https://motiq.dev/components/border-beam-panel (reference supplied by the user).
 * Native implementation: constant angular velocity, offscreen suspension.
 */
(() => {
  'use strict';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const items=[...document.querySelectorAll('[data-beam-panel]')].map(el=>({el,visible:false,angle:40}));
  let frame=0,last=0;
  function runnable(){return !document.hidden&&!reduced.matches&&items.some(item=>item.visible);}
  function tick(now){
    frame=0;if(!runnable()){last=0;return;}
    const dt=Math.min((now-(last||now))/1000,.04);last=now;
    for(const item of items){if(!item.visible)continue;
      // A full turn takes 15 seconds, including hover and keyboard focus.
      item.angle=(item.angle+24*dt)%360;
      item.el.style.setProperty('--nx-beam-angle',item.angle.toFixed(2)+'deg');
    }
    frame=requestAnimationFrame(tick);
  }
  function sync(){
    document.documentElement.classList.toggle('nx-effects-hidden',document.hidden);
    if(!runnable()){cancelAnimationFrame(frame);frame=0;last=0;return;}
    if(!frame)frame=requestAnimationFrame(tick);
  }
  const observer='IntersectionObserver' in window?new IntersectionObserver(entries=>{
    for(const entry of entries){const item=items.find(item=>item.el===entry.target);if(item)item.visible=entry.isIntersecting;entry.target.dataset.motionVisible=String(entry.isIntersecting);}
    sync();
  },{rootMargin:'30px'}):null;
  items.forEach(item=>{
    if(observer)observer.observe(item.el);else item.visible=true;
  });
  document.querySelectorAll('[data-motion-surface],[data-integration-map],.nx-button-primary:not(:disabled),.nav-cta').forEach(el=>observer?.observe(el));
  document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);sync();
  // Wires follow rendered endpoints after responsive layout, fonts and translations.
  for(const map of document.querySelectorAll('[data-integration-map]')){
    const svg=map.querySelector('svg'),hub=map.querySelector('[data-beam-hub]'),nodes=[...map.querySelectorAll('[data-beam-node]')];
    const ns='http://www.w3.org/2000/svg';
    const paths=nodes.map((node,i)=>{
      const base=document.createElementNS(ns,'path'),light=document.createElementNS(ns,'path');
      base.setAttribute('class','nx-wire-base'+(node.classList.contains('is-planned')?' nx-wire-planned':''));
      light.setAttribute('class','nx-wire-light'+(node.classList.contains('is-planned')?' nx-wire-future':''));
      light.setAttribute('pathLength','100');light.style.animationDelay=`-${i*.75}s`;
      svg.append(base,light);return {node,base,light};
    });
    function measure(){
      const rect=map.getBoundingClientRect(),center=hub.getBoundingClientRect();if(!rect.width)return;
      svg.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);
      const x=center.left+center.width/2-rect.left,y=center.top+center.height/2-rect.top;
      for(const {node,base,light} of paths){const r=node.getBoundingClientRect(),sx=r.left+r.width/2-rect.left,sy=r.top+r.height/2-rect.top;
        const d=`M${sx},${sy} C${(sx+x)/2},${sy} ${(sx+x)/2},${y} ${x},${y}`;
        base.setAttribute('d',d);light.setAttribute('d',d);
      }
    }
    if('ResizeObserver' in window)new ResizeObserver(measure).observe(map);
    else window.addEventListener('resize',measure,{passive:true});
    measure();
    for(const button of nodes)button.addEventListener('click',()=>{
      nodes.forEach(node=>node.setAttribute('aria-pressed',String(node===button)));
      map.parentElement.querySelectorAll('[data-integration-detail]').forEach(detail=>detail.hidden=detail.dataset.integrationDetail!==button.dataset.integrationChoice);
    });
  }
})();
