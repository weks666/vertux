import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const code=readFileSync(new URL('../nexus/assets/public-download.js',import.meta.url),'utf8');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function setup(response) {
  const elements=Object.fromEntries(['publicDownload','publicDownloadStatus','retryPublicDownload'].map(id=>[id,{hidden:true,textContent:'',addEventListener(name,fn){this[name]=fn;}}]));
  const listeners={},document={documentElement:{lang:'ru'},getElementById:id=>elements[id],addEventListener:(name,fn)=>listeners[name]=fn};
  const state={response,calls:0,aborted:false};
  runInNewContext(code,{document,AbortController,
    setTimeout:fn=>{state.timeout=fn;return 1;},clearTimeout:()=>{},
    fetch:async(url,options)=>{
      assert.equal(url,'https://nexus.vertux.online/api/desktop/download/status');
      assert.equal(options.credentials,'omit');assert.equal(options.cache,'no-store');state.calls++;
      if(state.response==='timeout')return new Promise((_,reject)=>options.signal.addEventListener('abort',()=>{state.aborted=true;reject(new Error('timeout'));}));
      if(state.response==='offline')throw new Error('offline');
      return state.response;
    }
  });
  return {elements,listeners,document,state};
}
const ready={ok:true,json:async()=>({ok:true,data:{available:true}})};
test('only an explicit available status reveals the existing protected download',async()=>{
  for(const available of [false,true]){
    const h=setup({ok:true,json:async()=>({ok:true,data:{available}})});await settle();
    assert.equal(h.elements.publicDownload.hidden,!available);
    assert.equal(h.elements.retryPublicDownload.hidden,available);
    assert.match(h.elements.publicDownloadStatus.textContent,available ? /Установщик доступен/ : /Публичное скачивание готовится/);
  }
});
test('offline, malformed and HTTP failures offer retry; retry can recover',async()=>{
  for(const response of ['offline',{ok:false},{ok:true,json:async()=>({ok:true,data:{available:'true'}})}]){
    const h=setup(response);await settle();
    assert.equal(h.elements.publicDownload.hidden,true);assert.equal(h.elements.retryPublicDownload.hidden,false);
    assert.match(h.elements.publicDownloadStatus.textContent,/Не удалось проверить/);
    h.state.response=ready;await h.elements.retryPublicDownload.click();
    assert.equal(h.elements.publicDownload.hidden,false);assert.equal(h.state.calls,2);
    h.document.documentElement.lang='en';h.listeners['nexus:language-change']();
    assert.match(h.elements.publicDownloadStatus.textContent,/installer is ready/);
  }
});
test('a stalled status request is aborted and never enables download',async()=>{
  const h=setup('timeout');h.state.timeout();await settle();
  assert.equal(h.state.aborted,true);assert.equal(h.elements.publicDownload.hidden,true);
  assert.equal(h.elements.retryPublicDownload.hidden,false);assert.match(h.elements.publicDownloadStatus.textContent,/повторите попытку/);
});
