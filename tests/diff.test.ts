import {test} from 'node:test';import assert from 'node:assert/strict';
import {compareLines} from '../lib/diff.ts';
test('Chinese and CRLF diffs reconstruct both inputs exactly without losing repeated paragraphs',()=>{
  for(const [left,right] of [['红色腰带\r\n相同段落\r\n相同段落','蓝色腰带\r\n相同段落\r\n相同段落\r\n新增镜头'],['','新增😀'],['旧版',''],['不变\n','不变\n']]){
    const {chunks}=compareLines(left,right);
    assert.equal(chunks.filter(x=>x.type!=='added').map(x=>x.text).join(''),left);
    assert.equal(chunks.filter(x=>x.type!=='removed').map(x=>x.text).join(''),right);
  }
});
test('large unrelated documents use bounded comparison and keep exact source text',()=>{
  const left='左侧长段落\n'.repeat(2000),right='右侧长段落\n'.repeat(2000);
  const r=compareLines(left,right);
  assert.ok(r.chunks.length<=4);assert.ok(r.added>0&&r.removed>0);
  assert.equal(r.chunks.filter(c=>c.type!=='removed').map(c=>c.text).join(''),right);
});
