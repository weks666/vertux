import {mountTerminalSettingsTransfer} from './terminal-settings-transfer-ui.js';
import {watchDisplayChanges,watchScopeName} from './terminal-watch-transfer-model.js';
const make=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
export function mountWatchTransfer(host,{store,getCatalog,onRestored}){
 return mountTerminalSettingsTransfer(host,{kind:'watch-preferences',store,onRestored,applyLabel:'Заменить списки и настройки таблицы',
  description:'Файл содержит личные списки, ссылки на инструменты, столбцы и сортировку таблицы.',
  boundary:'Котировки, отдельное избранное, графики и заметки не входят. Замена удалит текущие списки, отсутствующие в файле. Сначала скачайте текущие настройки, если хотите сохранить их отдельно.',
  renderPreview({host,before,after}){
   const catalog=new Map((getCatalog()||[]).map(m=>[m.instrumentUid,m]));
   const note=make('li');note.append(make('p','Наличие инструмента проверено только по загруженному каталогу. Отсутствие в нём не означает, что инструмент недоступен у источника.'));host.append(note);
   for(const row of watchDisplayChanges(before,after)){const li=make('li');li.append(make('strong',row.label),make('p','Сейчас: '+row.before),make('p','Из файла: '+row.after));host.append(li);}
   for(const [label,value,side]of [['Сейчас',before,'current'],['Из файла',after,'incoming']]){
    const section=make('li'),title=make('details'),summary=make('summary',label+': '+value.lists.length+' личных списков'),lists=make('div');lists.className='terminal-watch-file-lists';lists.dataset.watchFileSide=side;title.append(summary,make('p','Выбранный список: '+watchScopeName(value)),lists);section.append(title);host.append(section);
    if(!value.lists.length)lists.append(make('p','Личных списков нет.'));
    for(const row of value.lists){const entry=make('details'),name=make('summary',row.name+' · '+row.ids.length+' инструментов'+(value.scope==='custom:'+row.id?' · выбран':'')),refs=make('div');entry.dataset.watchFileList='';const known=row.ids.filter(id=>catalog.has(id)).length;entry.append(name,make('p','В загруженном каталоге: '+known+'. Не найдены в нём: '+(row.ids.length-known)+'.'),refs);lists.append(entry);let page=0,painted=false;
     function paint(focusDirection){refs.replaceChildren();const start=page*25,shown=row.ids.slice(start,start+25),list=make('ul');list.dataset.watchFileReferences='';for(const id of shown){const item=make('li'),meta=catalog.get(id),detail=make('details'),label=meta?[meta.ticker,meta.name,meta.exchange].filter(Boolean).join(' · '):'Нет в загруженном каталоге';detail.append(make('summary',label),make('p','Ссылка из файла'),make('code',id));item.append(detail);list.append(item);}refs.append(list);const range=make('p',row.ids.length?'Инструменты '+(start+1)+'–'+(start+shown.length)+' из '+row.ids.length:'Список пуст.');range.tabIndex=-1;range.dataset.watchFileRange='';refs.append(range);if(row.ids.length>25){const nav=make('div');nav.className='terminal-watch-file-pages';for(const [direction,text,enabled]of [['previous','Назад',page>0],['next','Далее',start+25<row.ids.length]]){const button=make('button',text);button.type='button';button.dataset.watchFilePage=direction;button.disabled=!enabled;button.addEventListener('click',()=>{page+=direction==='next'?1:-1;paint(direction);});nav.append(button);}refs.append(nav);if(focusDirection)(nav.querySelector('[data-watch-file-page='+focusDirection+']:not(:disabled)')||nav.querySelector('button:not(:disabled)')||range).focus();}}
     entry.addEventListener('toggle',()=>{if(entry.open&&!painted){painted=true;paint();}});
    }
   }
  }
 });
}
