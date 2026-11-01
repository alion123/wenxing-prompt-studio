import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recordUse,saveFavorite,dismissFavorite,removeFavorite,reuseFavorite,mergeLibrary,librarySchema,type PromptEntry} from '../lib/favorites.ts';
import {parseWorkspace} from '../lib/persistence.ts';
import {readBackup,mergeBackup} from '../lib/backup.ts';
import {createProject} from '../lib/studio.ts';
const input={prompt:'写一段温暖的故事。',title:'故事',type:'copy' as const};
test('only the fourth distinct project use suggests a favorite and repeat copying never counts twice',()=>{
 let library:PromptEntry[]=[];
 for(let i=1;i<=4;i++){
  const result=recordUse(library,{...input,projectId:'p'+i});library=result.library;
  assert.equal(library.length,1);assert.equal(library[0].usedIn.length,i);assert.equal(!!result.suggest,i===4);assert.equal(library[0].saved,false);
  const repeat=recordUse(library,{...input,projectId:'p'+i});assert.equal(repeat.library[0].usedIn.length,i);assert.equal(repeat.suggest,undefined);
 }
 assert.equal(recordUse(library,{...input,projectId:'p5'}).suggest,undefined);
});
test('prompt identity normalizes only outer whitespace and line endings, preserving indentation and content',()=>{
 let library=recordUse([],{...input,prompt:'  line1\r\n  line2\n',projectId:'a'}).library;
 library=recordUse(library,{...input,prompt:'line1\n  line2',projectId:'b'}).library;assert.equal(library.length,1);
 library=recordUse(library,{...input,prompt:'line1\nline2',projectId:'c'}).library;assert.equal(library.length,2);
 assert.equal(recordUse(library,{...input,prompt:'  \n',projectId:'d'}).library.length,2);
});
test('manual saving, dismissal and removal preserve usage while suppressing further suggestions',()=>{
 let library=recordUse([],{...input,projectId:'a'}).library;
 library=dismissFavorite(library,library[0].id);for(const id of ['b','c','d']){const r=recordUse(library,{...input,projectId:id});library=r.library;assert.equal(r.suggest,undefined);}
 library=saveFavorite(library,input);assert.equal(library[0].saved,true);
 library=removeFavorite(library,library[0].id);assert.equal(library[0].saved,false);assert.equal(library[0].dismissed,true);
 library=saveFavorite(library,input);assert.equal(library.length,1);assert.equal(library[0].saved,true);
});
test('reuse creates an independent editable project with saved-prompt provenance and does not count usage yet',()=>{
 const library=saveFavorite([],input),p=reuseFavorite(library[0],'advanced');
 assert.equal(p.draft,input.prompt);assert.equal(p.type,'copy');assert.equal(p.mode,'advanced');assert.equal(p.stage,'preview');assert.equal(p.status,'draft');
 assert.equal(p.versions.length,1);assert.equal(p.versions[0].generatedPrompt,undefined);assert.match(p.versions[0].label!,/常用/);
 assert.equal(library[0].usedIn.length,0);assert.notEqual(reuseFavorite(library[0],'advanced').id,p.id);
});
test('legacy workspace loading, backup round-trip and repeated import preserve library without inflating usage',()=>{
 const p=createProject('copy','beginner','故事');const legacy={projects:[p],active:p.id};assert.equal(parseWorkspace(JSON.stringify(legacy))?.projects[0].id,p.id);
 let library=recordUse([],{...input,projectId:p.id}).library;library=saveFavorite(library,input);
 const restored=readBackup(JSON.stringify({...legacy,library}));assert.deepEqual(restored.library,library);
 const merged=mergeBackup(legacy,restored);assert.deepEqual(merged.library,library);
 assert.deepEqual(mergeBackup(merged,restored).library,library);
 const more=recordUse(library,{...input,projectId:'another'}).library;assert.equal(mergeLibrary(library,more)[0].usedIn.length,2);
});
test('malformed or duplicate library records fail validation before they can be persisted',()=>{
 const library=saveFavorite([],input);assert.equal(librarySchema.safeParse(library).success,true);
 for(const broken of [[{...library[0],prompt:''}],[library[0],library[0]],[{...library[0],usedIn:['a','a']}],[{...library[0],usedIn:['a','b','c','d','e']}]])assert.equal(librarySchema.safeParse(broken).success,false);
});
test('at capacity new usage evicts only unsaved records; saved favorites are never silently lost',()=>{
 let library:PromptEntry[]=[];for(let i=0;i<100;i++)library=saveFavorite(library,{...input,prompt:'saved '+i});
 assert.throws(()=>saveFavorite(library,{...input,prompt:'one more'}),/100/);
 assert.equal(recordUse(library,{...input,projectId:'x'}).library.length,100);assert.equal(library.every(x=>x.saved),true);
 const tracking=recordUse([],{...input,projectId:'z'}).library;
 assert.equal(mergeLibrary(tracking,tracking)[0].usedIn.length,1);
});

test('backup project ID collisions remap usage and repeated imports neither recount nor create new projects',()=>{
 const a=createProject('copy','beginner','current'),b={...structuredClone(a),goal:'imported',updatedAt:new Date(Date.now()+1000).toISOString()};
 const current={projects:[a],active:a.id,library:recordUse([],{...input,projectId:a.id}).library};
 const backup={projects:[b],active:b.id,library:recordUse([],{...input,projectId:b.id}).library};
 const merged=mergeBackup(current,backup),imported=merged.projects.find(p=>p.goal==='imported')!;
 assert.notEqual(imported.id,b.id);assert.equal(merged.library![0].usedIn.length,2);
 assert.ok(merged.library![0].usedIn.includes(imported.id));
 assert.equal(recordUse(merged.library!,{...input,projectId:imported.id}).library[0].usedIn.length,2);
 const repeated=mergeBackup(merged,backup);assert.equal(repeated.added,0);assert.equal(repeated.library![0].usedIn.length,2);
});
