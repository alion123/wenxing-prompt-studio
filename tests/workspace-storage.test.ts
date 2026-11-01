import {test} from 'node:test';
import assert from 'node:assert/strict';
import {saveWorkspace,WorkspaceConflictError} from '../lib/workspace-storage.ts';

test('a stale editor cannot overwrite another tab or recreate externally cleared data',()=>{
  const key='test';let stored:string|null='initial';
  const storage={getItem:()=>stored,setItem:(_key:string,value:string)=>{stored=value;}};
  saveWorkspace(storage,key,'initial','tab A changes');
  assert.throws(()=>saveWorkspace(storage,key,'initial','stale tab B'),WorkspaceConflictError);
  assert.equal(stored,'tab A changes');
  stored=null;
  assert.throws(()=>saveWorkspace(storage,key,'tab A changes','stale content'),WorkspaceConflictError);
  assert.equal(stored,null);
});

test('the editor can keep saving its own successive changes',()=>{
  let stored:string|null=null;
  const storage={getItem:()=>stored,setItem:(_key:string,value:string)=>{stored=value;}};
  saveWorkspace(storage,'test',null,'first');saveWorkspace(storage,'test','first','second');
  assert.equal(stored,'second');
});

test('opening unchanged normalized data does not rewrite storage and trigger a false conflict in other tabs',()=>{
  let stored='{"active":"x","projects":[]}',writes=0;
  const storage={getItem:()=>stored,setItem:(_key:string,value:string)=>{stored=value;writes++;}};
  const normalized='{"projects":[],"active":"x"}';
  saveWorkspace(storage,'test',stored,normalized,normalized);
  assert.equal(writes,0);
  assert.equal(stored,'{"active":"x","projects":[]}');
});
