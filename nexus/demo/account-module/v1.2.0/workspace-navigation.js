// Workspace navigation is a device preference, scoped to the current product.
export function createWorkspaceNavigation({key, title, actions, navigate, storage = globalThis.localStorage, windowRef = window}) {
  const defaults = Object.freeze(Object.fromEntries(actions.map(action => [action.id, action.shortcut])));
  const storageKey = 'vertux:workspace-navigation:' + key;
  const reserved = new Set(['Ctrl+A','Ctrl+C','Ctrl+F','Ctrl+H','Ctrl+K','Ctrl+L','Ctrl+N','Ctrl+O','Ctrl+P','Ctrl+Q','Ctrl+R','Ctrl+S','Ctrl+T','Ctrl+U','Ctrl+V','Ctrl+W','Ctrl+X','Ctrl+Y','Ctrl+Z','Alt+F4','Ctrl+Shift+I','Ctrl+Shift+R']);
  const failure = code => Object.assign(new Error('Сочетание не сохранено'), {code});
  function validate(patch) {
    if(!patch || typeof patch !== 'object' || Array.isArray(patch) || Object.keys(patch).some(id => !Object.hasOwn(defaults,id))) throw failure('INVALID_SHORTCUT');
    const result = {};
    for(const [id,value] of Object.entries(patch)) {
      const parts = String(value).split('+').map(s=>s.trim());
      const key = parts.pop(); const modifiers = parts.map(s=>({ctrl:'Ctrl',control:'Ctrl',alt:'Alt',shift:'Shift'})[s.toLowerCase()]);
      if(!modifiers.length || modifiers.some(s=>!s) || new Set(modifiers).size!==modifiers.length || !/^(?:[A-Za-z0-9,./=-]|F(?:[1-9]|1[0-2]))$/.test(key)) throw failure('INVALID_SHORTCUT');
      const binding = ['Ctrl','Alt','Shift'].filter(s=>modifiers.includes(s)).concat(key.toUpperCase()).join('+');
      if(reserved.has(binding))throw failure('RESERVED_SHORTCUT');
      result[id]=binding;
    }
    return result;
  }
  function read() {
    try {const saved=validate(JSON.parse(storage.getItem(storageKey)||'{}'));const value={...defaults,...saved};return new Set(Object.values(value)).size===actions.length?value:{...defaults};}
    catch{return {...defaults};}
  }
  function update(patch) {
    const value={...read(),...validate(patch)};
    if(new Set(Object.values(value)).size!==actions.length)throw failure('DUPLICATE_SHORTCUT');
    try {storage.setItem(storageKey,JSON.stringify(value));if(storage.getItem(storageKey)!==JSON.stringify(value))throw new Error();}
    catch{throw failure('APP_SETTINGS_WRITE_FAILED');}
    return value;
  }
  function keydown(event) {
    if(event.isTrusted!==true || event.defaultPrevented || event.repeat || event.isComposing || event.metaKey || (!event.ctrlKey&&!event.altKey))return;
    const path=event.composedPath();
    if(path.some(node=>node?.matches?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"]')))return;
    const hasDialog=root=>[...root.querySelectorAll('dialog[open],[aria-modal="true"]')].some(node=>node.getClientRects().length>0) || [...root.querySelectorAll('*')].some(node=>node.shadowRoot&&hasDialog(node.shadowRoot));
    if(hasDialog(windowRef.document))return;
    const key=/^Key[A-Z]$/.test(event.code)?event.code.slice(3):/^Digit[0-9]$/.test(event.code)?event.code.slice(5):({Comma:',',Period:'.',Slash:'/',Minus:'-',Equal:'='})[event.code]||event.key;
    const pressed=[event.ctrlKey&&'Ctrl',event.altKey&&'Alt',event.shiftKey&&'Shift',key].filter(Boolean).join('+');
    const current=read();const action=actions.find(action=>current[action.id]===pressed);
    if(action){event.preventDefault();navigate(action.id);}
  }
  windowRef.document.documentElement.dataset.workspaceNavigation='contextual';
  windowRef.addEventListener('keydown',keydown);
  return Object.freeze({title,actions,defaults,read,update,dispose:()=>windowRef.removeEventListener('keydown',keydown)});
}
