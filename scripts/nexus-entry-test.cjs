const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync(require('node:path').join(__dirname,'../nexus/assets/account-entry.js'),'utf8');
function run({url='https://vertux.online/nexus/register.html',page='register',preview}={}){
 const location=new URL(url);let redirected;
 location.replace=value=>{redirected=value};
 const links=[{href:'https://nexus.vertux.online/account.html?register=1'},{href:'https://nexus.vertux.online/account.html'}];
 let ready;
 const document={documentElement:{dataset:{page}},querySelector:()=>preview?{content:preview}:null,querySelectorAll:()=>links,addEventListener(name,fn){if(name==='DOMContentLoaded')ready=fn}};
 vm.runInNewContext(code,{URL,location,document});ready();return {redirected,links};
}
assert.equal(run().redirected,'https://nexus.vertux.online/account.html?register=1');
assert.equal(run({page:'account'}).redirected,'https://nexus.vertux.online/account.html');
assert.equal(run({url:'https://vertux.online/nexus/register.html?plan=year&next=https://untrusted.test'}).redirected,'https://nexus.vertux.online/account.html?register=1&plan=year');
assert.equal(run({url:'https://vertux.online/nexus/register.html?plan=anything'}).redirected,'https://nexus.vertux.online/account.html?register=1');
assert.equal(run({page:'security'}).redirected,undefined);
assert.equal(run({preview:'http://127.0.0.1:49733'}).redirected,'https://nexus.vertux.online/account.html?register=1');
assert.equal(run({url:'http://127.0.0.1:8768/nexus/register.html?plan=month',preview:'http://127.0.0.1:49733'}).redirected,'http://127.0.0.1:49733/account.html?register=1&plan=month');
for(const preview of ['https://untrusted.test','not a URL','http://192.168.1.1:49733'])assert.equal(run({url:'http://127.0.0.1:8768/nexus/register.html',preview}).redirected,'https://nexus.vertux.online/account.html?register=1');
assert.ok(run({url:'http://127.0.0.1:8768/nexus/register.html?plan=year',preview:'http://127.0.0.1:49733'}).links.every(link=>link.href==='http://127.0.0.1:49733/account.html?register=1&plan=year'));
for(const page of ['account','register']) {
 const html=fs.readFileSync(require('node:path').join(__dirname,`../nexus/${page}.html`),'utf8');
 assert.match(html,new RegExp(`<html lang="ru" data-page="${page}">`));
 assert.ok(html.indexOf('assets/account-entry.js')<html.indexOf('</head>'));
 assert.doesNotMatch(html,/Ваш аккаунт\.|Ваш Invest\.|site-header|assets\/site\.js/);
 assert.match(html,/<noscript>[\s\S]*visibility: visible/);
}
console.log('PASS: pre-paint registration/login redirect without a body, delayed fallback links, plan allowlist and isolated preview routing');
