import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source=readFileSync(new URL('../nexus/assets/reference-effects.js',import.meta.url),'utf8');
test('border stays at 24 degrees per second and pauses for hidden, offscreen and reduced motion',()=>{
 const listeners={},reduced={matches:false,addEventListener:(event,fn)=>listeners.reduced=fn};
 let angle,callback,observe;
 const element={style:{setProperty:(name,value)=>angle=parseFloat(value)},dataset:{},addEventListener:(name,fn)=>listeners[name]=fn};
 const document={hidden:false,documentElement:{classList:{toggle(){}}},querySelectorAll:selector=>selector.startsWith('[data-beam-panel]')?[element]:[],addEventListener:(event,fn)=>listeners[event]=fn};
 runInNewContext(source,{document,window:{IntersectionObserver:true},matchMedia:()=>reduced,IntersectionObserver:class{constructor(fn){observe=fn}observe(){}},requestAnimationFrame:fn=>{callback=fn;return 1},cancelAnimationFrame:()=>{callback=null}});
 observe([{target:element,isIntersecting:true}]);
 let now=1000;callback(now);
 const step=()=>{now+=20;assert.ok(callback);callback(now)};
 for(let i=0;i<50;i++)step();assert.ok(Math.abs(angle-64)<.01);
 listeners.pointerenter?.();listeners.focusin?.();
 for(let i=0;i<50;i++)step();assert.ok(Math.abs(angle-88)<.01);
 document.hidden=true;listeners.visibilitychange();assert.equal(callback,null);
 document.hidden=false;listeners.visibilitychange();assert.ok(callback);
 reduced.matches=true;listeners.reduced();assert.equal(callback,null);
 reduced.matches=false;listeners.reduced();assert.ok(callback);
 observe([{target:element,isIntersecting:false}]);assert.equal(callback,null);
});
