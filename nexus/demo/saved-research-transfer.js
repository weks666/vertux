import {validateSavedResearchDocument,SAVED_RESEARCH_LIMITS} from './saved-research-model.js';
// Bounded whitespace/envelope room; the validated document itself stays 64 KiB.
export const SAVED_RESEARCH_TRANSFER_BYTES=SAVED_RESEARCH_LIMITS.bytes+32768;
const fail=code=>({ok:false,state:'invalid-file',error:{code}});
const stamp=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
export function serializeSavedResearchTransfer(document,exportedAt){
 const checked=validateSavedResearchDocument(document);if(!checked.ok)return checked;
 if(!stamp(exportedAt))return fail('invalid-export-time');
 const value={format:'vertux.saved-research',version:1,exportedAt,document:checked.document};
 const text=JSON.stringify(value,null,2)+'\n';
 if(new TextEncoder().encode(text).length>SAVED_RESEARCH_TRANSFER_BYTES)return fail('file-too-large');
 return {ok:true,text,filename:'vertux-research-'+exportedAt.slice(0,10)+'.json'};
}
export function parseSavedResearchTransfer(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>SAVED_RESEARCH_TRANSFER_BYTES)return fail('file-too-large');
 let value;try{value=JSON.parse(text);}catch{return fail('invalid-json');}
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==4
  ||!['format','version','exportedAt','document'].every(key=>Object.hasOwn(value,key))||value.format!=='vertux.saved-research')return fail('invalid-transfer');
 if(value.version!==1)return fail('unsupported-transfer-version');
 if(!stamp(value.exportedAt))return fail('invalid-export-time');
 const checked=validateSavedResearchDocument(value.document);return checked.ok?{ok:true,document:checked.document,exportedAt:value.exportedAt}:checked;
}
