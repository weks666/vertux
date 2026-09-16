const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.join(__dirname,'../nexus');
const code=fs.readFileSync(path.join(root,'assets/hero-video.js'),'utf8');
const events=()=>{const handlers={};return{addEventListener(n,fn){(handlers[n]??=[]).push(fn)},emit(n){for(const fn of handlers[n]||[])fn()}}};
function setup({reduce=false,saveData=false,mobile=false,reject=false}={}){
 const classes=new Set();let observer,time=0,sequence=0;const timers=new Map();
 const setTimeout=(fn,delay)=>{const id=++sequence;timers.set(id,{fn,at:time+delay});return id};
 const clearTimeout=id=>timers.delete(id);
 const advance=ms=>{const end=time+ms;while(true){const due=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;time=due[1].at;timers.delete(due[0]);due[1].fn()}time=end};
 const hero={getBoundingClientRect:()=>({bottom:900}),classList:{add:(...v)=>v.forEach(c=>classes.add(c)),remove:(...v)=>v.forEach(c=>classes.delete(c)),toggle(c,on){on?classes.add(c):classes.delete(c)}}};
 function clip(name){const attrs={};const video=Object.assign(events(),{paused:true,plays:0,dataset:{desktopSrc:name+'-desktop.mp4',mobileSrc:name+'-mobile.mp4'},closest:()=>hero,getAttribute:k=>attrs[k],pause(){this.paused=true},play(){this.plays++;if(reject)return Promise.reject(Error('Autoplay denied'));this.paused=false;this.emit('playing');return Promise.resolve()}});Object.defineProperty(video,'src',{get:()=>attrs.src,set:v=>{attrs.src=v}});return video;}
 const intro=clip('intro'),film=clip('film');
 const reduced=Object.assign(events(),{matches:reduce}),connection=Object.assign(events(),{saveData});
 const document=Object.assign(events(),{hidden:false,getElementById:id=>id==='heroVideo'?film:intro});
 class IntersectionObserver{constructor(fn){observer=fn}observe(){}}
 vm.runInNewContext(code,{document,navigator:{connection},window:{matchMedia:q=>q.includes('reduced')?reduced:{matches:mobile},IntersectionObserver},IntersectionObserver,setTimeout,clearTimeout,Date:{now:()=>time}});
 return{intro,film,classes,advance,hidden(v){document.hidden=v;document.emit('visibilitychange')},out(v){observer([{isIntersecting:!v}])},reduce(v){reduced.matches=v;reduced.emit('change')},save(v){connection.saveData=v;connection.emit('change')}};
}
const settle=async()=>{await Promise.resolve();await Promise.resolve()};
(async()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.doesNotMatch(html,/class="hero-intro"|hero-video-toggle/);assert.match(html,/id="heroIntroVideo"/);
 let s=setup();await settle();assert.equal(s.intro.paused,false);assert.equal(s.film.paused,true);assert.equal(s.film.plays,0);assert.ok(s.classes.has('has-playing-intro'));
 s.hidden(true);assert.equal(s.intro.paused,true);s.hidden(false);await settle();assert.equal(s.intro.paused,false);
 s.intro.duration=5;s.intro.currentTime=3.5;s.intro.emit('timeupdate');assert.equal(s.film.plays,0);
 s.intro.currentTime=3.7;s.intro.emit('timeupdate');await settle();assert.equal(s.film.paused,false);assert.equal(s.intro.paused,false);assert.ok(s.classes.has('has-playing-film'));
 s.hidden(true);assert.equal(s.intro.paused,true);assert.equal(s.film.paused,true);s.hidden(false);await settle();assert.equal(s.intro.paused,false);assert.equal(s.film.paused,false);
 s.intro.ended=true;s.intro.emit('ended');await settle();assert.equal(s.intro.paused,true);assert.equal(s.film.paused,false);
 s.out(true);assert.equal(s.film.paused,true);s.out(false);await settle();assert.equal(s.film.paused,false);assert.equal(s.intro.paused,true);
 s.reduce(true);assert.equal(s.film.paused,true);s.reduce(false);await settle();assert.equal(s.film.paused,false);
 s.save(true);assert.equal(s.film.paused,true);s.save(false);await settle();assert.equal(s.film.paused,false);
 for(const options of [{reduce:true},{saveData:true}]){s=setup(options);await settle();assert.equal(s.intro.src,undefined);assert.equal(s.film.src,undefined);assert.equal(s.intro.plays+s.film.plays,0);}
 s=setup({mobile:true});await settle();assert.equal(s.intro.src,'intro-mobile.mp4');assert.equal(s.film.src,'film-mobile.mp4');assert.equal(s.intro.muted,true);
 s=setup({reject:true});await settle();assert.equal(s.classes.has('has-playing-intro'),false);assert.equal(s.classes.has('has-playing-film'),false);
 s=setup();await settle();s.intro.emit('error');await settle();assert.equal(s.film.paused,false);
 s=setup();await settle();s.film.emit('error');assert.equal(s.intro.paused,true);assert.equal(s.film.paused,true);assert.equal(s.classes.has('has-playing-film'),false);
 s=setup();s.out(true);await settle();assert.equal(s.intro.paused,true);assert.equal(s.film.plays,0);
 console.log('PASS: intro and film move together during the dissolve before the final frame; hidden/offscreen pause, mobile, reduced motion, Save-Data and failures');
})().catch(error=>{console.error(error);process.exitCode=1});
