import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createProject,makeContext,addVersion} from '../lib/studio.ts';
import {readBackup} from '../lib/backup.ts';
import {createAutomaticReport,reportIsCurrent} from '../lib/reports.ts';
const image={id:'ref-1',name:'参考.png',note:'只参考蓝色配色',dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII='};
test('reference pictures and intent survive persistence and backups and reach model context',()=>{
  const p={...createProject('image','beginner','品牌海报'),references:[image]};
  const saved=readBackup(JSON.stringify({projects:[p],active:p.id})).projects[0];
  assert.deepEqual(saved.references,[image]);assert.deepEqual(makeContext(saved).references,[image]);
  assert.equal(makeContext(createProject('code','beginner','无图')).references.length,0);
});
test('changing reference intent or removing a picture invalidates an old report',()=>{
  const result={prompt:'蓝色海报',summary:'摘要',constraints:[],assumptions:[],conflicts:[]};
  const p={...addVersion(createProject('image','beginner','海报'),result),references:[image]};
  const report=createAutomaticReport(p.draft,makeContext(p),result);assert.equal(reportIsCurrent(report,p),true);
  assert.equal(reportIsCurrent(report,{...p,references:[{...image,note:'只参考构图'}]}),false);
  assert.equal(reportIsCurrent(report,{...p,references:[]}),false);
  const invalid={...p,references:[{...image,dataUrl:'data:image/svg+xml;base64,PHN2Zz4='}]};
  assert.throws(()=>readBackup(JSON.stringify({projects:[invalid],active:p.id})));
});
