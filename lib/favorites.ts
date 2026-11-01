import {z} from 'zod';
import {createProject,type Kind,type Mode,type Project} from './studio.ts';
export type PromptEntry={id:string;prompt:string;title:string;type:Kind;saved:boolean;dismissed:boolean;usedIn:string[];createdAt:string;lastUsedAt:string};
type Input={prompt:string;title:string;type:Kind};
export const promptIdentity=(text:string)=>text.replace(/\r\n?/g,'\n').trim();
const unique=(xs:string[])=>new Set(xs).size===xs.length;
const entrySchema=z.object({id:z.string().min(1),prompt:z.string().max(24000).refine(s=>!!promptIdentity(s)),title:z.string().min(1).max(80),type:z.enum(['code','image','video','copy','custom']),saved:z.boolean(),dismissed:z.boolean(),usedIn:z.array(z.string().min(1)).max(4).refine(unique),createdAt:z.string().datetime({offset:true}),lastUsedAt:z.string().datetime({offset:true})});
export const librarySchema=z.array(entrySchema).max(100).refine(xs=>unique(xs.map(x=>x.id))&&unique(xs.map(x=>promptIdentity(x.prompt))));
function makeEntry(input:Input):PromptEntry{
 const now=new Date().toISOString();return {id:crypto.randomUUID(),prompt:promptIdentity(input.prompt),title:input.title.trim().slice(0,80)||'未命名提示词',type:input.type,saved:false,dismissed:false,usedIn:[],createdAt:now,lastUsedAt:now};
}
function room(library:PromptEntry[]):PromptEntry[]|null{
 if(library.length<100)return library;
 const disposable=library.filter(x=>!x.saved&&!x.dismissed).sort((a,b)=>a.lastUsedAt.localeCompare(b.lastUsedAt))[0];
 return disposable?library.filter(x=>x.id!==disposable.id):null;
}
export function recordUse(library:PromptEntry[],input:Input&{projectId:string}):{library:PromptEntry[];suggest?:string}{
 const identity=promptIdentity(input.prompt);if(!identity||identity.length>24000||!input.projectId.trim())return {library};
 const found=library.find(x=>promptIdentity(x.prompt)===identity);
 if(found?.usedIn.includes(input.projectId))return {library};
 const base=found?library:room(library);if(!base)return {library};
 const prior=found??makeEntry(input),usedIn=[...prior.usedIn,input.projectId].slice(0,4);
 const next={...prior,usedIn,lastUsedAt:new Date().toISOString()};
 const result=found?base.map(x=>x.id===found.id?next:x):[next,...base];
 return {library:result,...(!next.saved&&!next.dismissed&&prior.usedIn.length<4&&usedIn.length===4?{suggest:next.id}:{})};
}
export function saveFavorite(library:PromptEntry[],input:Input){
 const identity=promptIdentity(input.prompt);if(!identity||identity.length>24000)throw Error('请先填写有效的提示词，最多24000字符。');
 const found=library.find(x=>promptIdentity(x.prompt)===identity);
 if(found)return library.map(x=>x.id===found.id?{...x,saved:true}:x);
 const base=room(library);if(!base)throw Error('常用与使用记录已达到100条，请先清除未收藏的使用记录。');
 return [{...makeEntry(input),saved:true},...base];
}
export function dismissFavorite(library:PromptEntry[],id:string){return library.map(x=>x.id===id?{...x,dismissed:true}:x);}
export function removeFavorite(library:PromptEntry[],id:string){return library.map(x=>x.id===id?{...x,saved:false,dismissed:true}:x);}
export function reuseFavorite(entry:PromptEntry,mode:Mode):Project{
 const p=createProject(entry.type,mode,entry.title);
 return {...p,stage:'preview' as const,draft:entry.prompt,versions:[{id:crypto.randomUUID(),createdAt:p.createdAt,label:'来自常用提示词',prompt:entry.prompt,summary:'从常用提示词创建，可直接编辑或继续优化。',constraints:[],assumptions:[],conflicts:[]}]};
}
export function mergeLibrary(current:PromptEntry[],incoming:PromptEntry[]){
 let result=structuredClone(current);
 for(const entry of incoming){
  const found=result.find(x=>promptIdentity(x.prompt)===promptIdentity(entry.prompt));
  if(found){result=result.map(x=>x.id===found.id?{...x,saved:x.saved||entry.saved,dismissed:x.dismissed||entry.dismissed,usedIn:[...new Set([...x.usedIn,...entry.usedIn])].slice(0,4),lastUsedAt:x.lastUsedAt>entry.lastUsedAt?x.lastUsedAt:entry.lastUsedAt}:x);continue;}
  const base=room(result);if(!base){if(entry.saved)throw Error('合并后超过100条常用与使用记录，请先清理记录再导入。');continue;}
  const next=structuredClone(entry);while(base.some(x=>x.id===next.id))next.id=crypto.randomUUID();result=[next,...base];
 }
 return result;
}
