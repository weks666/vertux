const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.join(__dirname,'../nexus');
const code=fs.readFileSync(path.join(root,'assets/hero-video.js'),'utf8');
const events=()=>{const handlers={};return{addEventListener(n,fn){(handlers[n]??=[]).push(fn)},emit(n){for(const fn of handlers[n]||[])fn()}}};
function setup({reduce=false,saveData=false,mobile=false,reject=false}={}){
 const classes=new Set();let observer,time=0,sequence=0;const timers=new Map();
 const setTimeout=(fn,delay)=>{const id=++sequence;timers.set(id,{fn,at:time+delay});return id};
 const clearTimeout=id=>timers.delete(id);
 const advance=ms=>{const end=time+ms;while(true){const due=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;time=due[1].at;timers.delete(due[0]);due[1].fn()}time=end};
 const hero=Object.assign(events(),{getBoundingClientRect:()=>({bottom:900}),classList:{add:(...v)=>v.forEach(c=>classes.add(c)),remove:(...v)=>v.forEach(c=>classes.delete(c)),toggle(c,on){on?classes.add(c):classes.delete(c)}}});
 function clip(name){const attrs={};const video=Object.assign(events(),{paused:true,plays:0,dataset:{desktopSrc:name+'-desktop.mp4',mobileSrc:name+'-mobile.mp4'},closest:()=>hero,getAttribute:k=>attrs[k],pause(){this.paused=true},play(){this.plays++;if(reject)return Promise.reject(Error('Autoplay denied'));this.paused=false;this.emit('playing');return Promise.resolve()}});Object.defineProperty(video,'src',{get:()=>attrs.src,set:v=>{attrs.src=v}});return video;}
 const intro=clip('intro'),film=clip('film');
 const reduced=Object.assign(events(),{matches:reduce}),connection=Object.assign(events(),{saveData});
 const rootClasses=new Set();
 const document=Object.assign(events(),{hidden:false,documentElement:{classList:{add:(...v)=>v.forEach(c=>rootClasses.add(c))}},getElementById:id=>id==='heroVideo'?film:intro});
 class IntersectionObserver{constructor(fn){observer=fn}observe(){}}
 vm.runInNewContext(code,{document,navigator:{connection},window:{matchMedia:q=>q.includes('reduced')?reduced:{matches:mobile},IntersectionObserver},IntersectionObserver,setTimeout,clearTimeout,Date:{now:()=>time}});
 return{intro,film,hero,classes,rootClasses,advance,hidden(v){document.hidden=v;document.emit('visibilitychange')},out(v){observer([{isIntersecting:!v}])},reduce(v){reduced.matches=v;reduced.emit('change')},save(v){connection.saveData=v;connection.emit('change')}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.doesNotMatch(html,/class="hero-intro"|hero-video-toggle/);assert.match(html,/id="heroIntroVideo"/);
 assert.doesNotMatch(html,/<video[^>]*\sposter=/);
 const css=fs.readFileSync(path.join(root,'assets/hero-video.css'),'utf8');
 assert.match(css,/\.hero-film-poster \{ opacity: 0;/);
 assert.match(html,/<noscript>[\s\S]*hero-film-poster \{ opacity: 1;/);
 assert.ok(html.indexOf("classList.add('hero-motion')")<html.indexOf('</head>'));
 const bootstrap=html.match(/<script>([\s\S]*?)<\/script>/)[1];
 const bootClasses=new Set();let watchdog;
 vm.runInNewContext(bootstrap,{document:{documentElement:{classList:{add:value=>bootClasses.add(value)}}},navigator:{},matchMedia:()=>({matches:false}),setTimeout:fn=>{watchdog=fn}});
 assert.ok(bootClasses.has('hero-motion'));assert.equal(bootClasses.has('hero-copy-ready'),false);watchdog();assert.ok(bootClasses.has('hero-copy-ready'));
 let s=setup();await settle();assert.equal(s.intro.paused,false);assert.equal(s.film.paused,true);assert.equal(s.film.plays,0);assert.ok(s.classes.has('has-playing-intro'));
 assert.equal(s.rootClasses.has('hero-copy-ready'),false);s.intro.currentTime=.3;s.intro.emit('timeupdate');assert.ok(s.rootClasses.has('hero-copy-ready'));
 s.hidden(true);assert.equal(s.intro.paused,true);s.hidden(false);await settle();assert.equal(s.intro.paused,false);
 s.intro.duration=5;s.intro.currentTime=3.5;s.intro.emit('timeupdate');assert.equal(s.film.plays,0);
 s.intro.currentTime=3.7;s.intro.emit('timeupdate');await settle();assert.equal(s.film.paused,false);assert.equal(s.intro.paused,false);assert.ok(s.classes.has('has-playing-film'));
 s.hidden(true);assert.equal(s.intro.paused,true);assert.equal(s.film.paused,true);s.hidden(false);await settle();assert.equal(s.intro.paused,false);assert.equal(s.film.paused,false);
 s.intro.ended=true;s.intro.emit('ended');await settle();assert.equal(s.intro.paused,true);assert.equal(s.film.paused,false);
 s.out(true);assert.equal(s.film.paused,true);s.out(false);await settle();assert.equal(s.film.paused,false);assert.equal(s.intro.paused,true);
 s.reduce(true);assert.equal(s.film.paused,true);s.reduce(false);await settle();assert.equal(s.film.paused,false);
 s.save(true);assert.equal(s.film.paused,true);s.save(false);await settle();assert.equal(s.film.paused,false);
 for(const options of [{reduce:true},{saveData:true}]){s=setup(options);await settle();assert.equal(s.intro.src,undefined);assert.equal(s.film.src,undefined);assert.equal(s.intro.plays+s.film.plays,0);assert.ok(s.rootClasses.has('hero-copy-ready'));}
 s=setup({mobile:true});await settle();assert.equal(s.intro.src,'intro-mobile.mp4');assert.equal(s.film.src,'film-mobile.mp4');assert.equal(s.intro.muted,true);
 s=setup({reject:true});await settle();assert.equal(s.classes.has('has-playing-intro'),false);assert.equal(s.classes.has('has-playing-film'),false);assert.ok(s.classes.has('has-failed-film'));assert.ok(s.rootClasses.has('hero-copy-ready'));
 s=setup();await settle();s.intro.emit('error');await settle();assert.equal(s.film.paused,false);
 s=setup();await settle();s.film.emit('error');assert.equal(s.intro.paused,true);assert.equal(s.film.paused,true);assert.equal(s.classes.has('has-playing-film'),false);
 s=setup();s.out(true);await settle();assert.equal(s.intro.paused,true);assert.equal(s.film.plays,0);
 s=setup();s.hero.emit('focusin');assert.ok(s.rootClasses.has('hero-copy-ready'));
 console.log('PASS: no open-laptop poster flash, copy entrance follows video with a fail-safe, continuous dissolve, hidden/offscreen pause, mobile, reduced motion, Save-Data and failures');
})().catch(error=>{console.error(error);process.exitCode=1});
