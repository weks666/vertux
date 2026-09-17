import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../nexus/assets/header-session.js',import.meta.url),'utf8');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function setup(hostname='vertux.online'){
 const listeners={},links=Array.from({length:2},()=>({textContent:'',dataset:{},attributes:{},classList:{toggle(name,value){this[name]=value;}},setAttribute(key,value){this.attributes[key]=value;}}));
 const document={documentElement:{lang:'ru'},hidden:false,querySelectorAll:()=>links,addEventListener:(name,fn)=>listeners[name]=fn};
 const state={reply:{authenticated:false},calls:0,fail:false};
 runInNewContext(source,{document,location:{hostname},window:{addEventListener:(name,fn)=>listeners[name]=fn},AbortController,setTimeout,clearTimeout,
  fetch:async(url,options)=>{state.calls++;assert.equal(url,'https://nexus.vertux.online/api/auth/site-session');assert.equal(options.credentials,'include');assert.equal(options.cache,'no-store');if(state.fail)throw Error('offline');return{ok:true,json:async()=>({ok:true,data:state.reply})};}});
 return{state,document,links,listeners};
}
test('header follows sign-in, language, return from cabinet and sign-out without exposing HTML',async()=>{
 const h=setup();await settle();assert.ok(h.links.every(link=>link.textContent==='Войти'));
 h.state.reply={authenticated:true,name:'Алексей'};h.listeners.pageshow();await settle();assert.ok(h.links.every(link=>link.textContent==='Алексей'&&link.classList['session-authenticated']));
 h.state.reply={authenticated:true,name:''};h.document.documentElement.lang='en';h.listeners.visibilitychange();await settle();assert.equal(h.links[0].textContent,'My account');
 h.state.reply={authenticated:true,name:'<img src=x>'};h.listeners.pageshow();await settle();assert.equal(h.links[0].textContent,'<img src=x>');
 h.state.fail=true;h.listeners.pageshow();await settle();assert.equal(h.links[0].textContent,'<img src=x>');
 h.state.fail=false;h.state.reply={authenticated:false};h.listeners.pageshow();await settle();assert.equal(h.links[0].textContent,'Log in');assert.equal(h.links[0].classList['session-authenticated'],false);
});
test('local preview never contacts the authenticated production endpoint',async()=>{const h=setup('127.0.0.1');await settle();h.listeners.pageshow();await settle();assert.equal(h.state.calls,0);assert.equal(h.links[0].textContent,'Кабинет');});
