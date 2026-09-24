import {readFile} from 'node:fs/promises';
export async function websiteFixture(source) {
 const data=JSON.parse(await readFile(source+'/fixtures/tinvest/kovrocity-account.json','utf8'));
 const a=data.accounts[0],money=(v,currency='rub')=>({units:String(Math.trunc(v)),nano:Math.round((v-Math.trunc(v))*1e9),currency});
 data.label='Nexus website: fictional portfolio, no customer data';a.name='Личный портфель';a.clientWorkspace.portfolioLabel='Основной счёт';
 const assets=[['sber','SBER','Сбербанк',1200,280,305,10],['yndx','YDEX','Яндекс',80,3910,4120,1],['lkoh','LKOH','Лукойл',45,7420,7290,1],['gazp','GAZP','Газпром',500,141,148.4,10]];
 const base=a.portfolio.positions[0],future=a.portfolio.positions[1];
 a.portfolio.positions=assets.map(([id,ticker,name,q,avg,last,lot])=>({...structuredClone(base),instrumentUid:'fixture-share-'+id,figi:'FIXTURE-'+ticker,ticker,name,quantity:money(q),quantityLots:money(q/lot),averagePositionPrice:money(avg),currentPrice:money(last),expectedYield:money((last-avg)*q),dailyYield:money((last-avg)*q*.045)}));
 a.portfolio.positions.push(future);a.portfolio.cash=money(89650);a.portfolio.totalAmountPortfolio=money(1257500);a.portfolio.expectedYield=money(44650);
 a.positions.securities=a.portfolio.positions.filter(p=>p.instrumentType==='share').map(p=>({instrumentUid:p.instrumentUid,figi:p.figi,balance:p.quantity,blocked:money(0)}));
 const template=a.operations.pages[0].items[0],items=[];let serial=0;
 const trade=(asset,q,price,date,sell=false)=>{const [id,ticker,name]=asset,uid='fixture-share-'+id;const n=++serial,quantity=money(q);items.push({...structuredClone(template),id:'website-operation-'+n,reconciliationFingerprint:'website-operation-'+n,instrumentUid:uid,figi:'FIXTURE-'+ticker,date,type:sell?'OPERATION_TYPE_SELL':'OPERATION_TYPE_BUY',quantity,payment:money(q*price*(sell?1:-1)),price:money(price),commission:money(-Math.round(q*price*.0003*100)/100),description:(sell?'Продажа ':'Покупка ')+name,tradesInfo:{trades:[{tradeId:'website-trade-'+n,dateTime:date,quantity,price:money(price)}]}});};
 // Fully closed lots first; open lots exactly match the displayed holdings.
 for(let j=0;j<24;j++){const asset=assets[j%4],quantity=asset[6]*(1+j%4),p=asset[4]*(.94+j*.001),day=3+j;trade(asset,quantity,p,new Date(Date.UTC(2026,6,day,9)).toISOString());trade(asset,quantity,p*(j%4===0?.978:1.018+(j%3)*.012),new Date(Date.UTC(2026,6,day+3,12)).toISOString(),true);}
 assets.forEach((asset,i)=>trade(asset,asset[3],asset[4],new Date(Date.UTC(2026,7,3+i,9,15+i*7)).toISOString()));
 const futureOps=a.operations.pages.flatMap(p=>p.items).filter(o=>o.instrumentUid===future.instrumentUid);items.push(...futureOps);
 a.operations={replay:{enabled:false},pages:[{cursorIn:'',cursorOut:'',hasNext:false,items}]};
 const count=378,end=Date.UTC(2026,7,12,9,59,59);const wave=i=>Math.sin(i*.19)*10500+Math.sin(i*.81)*3900+Math.sin(i*1.73)*1300;const endpoint=wave(count-1);
 a.portfolioHistory=Array.from({length:count},(_,i)=>{const value=Math.round(875000+382500*i/(count-1)+wave(i)-endpoint*i/(count-1));return {asOf:new Date(Date.UTC(2026,7,11,21)-(count-1-i)*86400000).toISOString(),totalAmountPortfolio:money(value),cash:money(89650),blocked:money(0),expectedYield:money(0),positions:[]};});
 a.candles=[];
 // Seeded, non-periodic sessions: gaps, quiet stretches and clustered volatility.
 for(const [ix,p] of a.portfolio.positions.entries()) {
  let seed=7319+ix*104729;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const dates=[];for(let at=Date.UTC(2026,7,12,12);at>=Date.UTC(2018,0,1);at-=86400000){const day=new Date(at).getUTCDay();if(day!==0&&day!==6)dates.unshift(at);}
  const bars=[];let prior=100,vol=.006;
  for(let i=0;i<dates.length;i++){vol=.84*vol+.16*(.003+random()*.018);const regime=i<45?.0018:i<85?-.0015:i<125?.0004:.002;
   const open=prior*(1+(random()-.5)*vol*.55),move=regime+(random()+random()+random()-1.5)*vol*1.9+(i===67?-.042:i===112?.029:0),close=open*Math.exp(move),wick=vol*(.1+random()*.75);
   const high=Math.max(open,close)*(1+wick),low=Math.min(open,close)*(1-wick*(.4+random()*.7));
   bars.push({open,high,low,close,volume:Math.round((45000+random()*90000)*(1+Math.abs(move)/vol*1.6))});prior=close;
  }
  const last=Number(p.currentPrice.units)+p.currentPrice.nano/1e9,factor=last/bars.at(-1).close,round=v=>Math.round(v*factor*100)/100;
  bars.forEach((b,i)=>a.candles.push({instrumentUid:p.instrumentUid,interval:'CANDLE_INTERVAL_DAY',time:new Date(dates[i]).toISOString(),open:money(round(b.open)),high:money(round(b.high)),low:money(round(b.low)),close:money(round(b.close)),volume:money(b.volume),isComplete:true,isStale:false}));
 }

 a.clientWorkspace.openPositionDetails=Object.fromEntries(a.portfolio.positions.map(p=>[p.instrumentUid,{lots:Number(p.quantityLots.units),dayPnlNanos:String(Math.round(Number(p.dailyYield.units)*1e9)),dayReturnPpm:12700,possibleLeverage:2.2}]));
 a.clientWorkspace.tradingPlanDate='2026-08-12';
 return data;
}
