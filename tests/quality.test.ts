import { test } from 'node:test';
import assert from 'node:assert/strict';
import { profileFor, materialize } from '../lib/quality.ts';
import { createProject, makeContext } from '../lib/studio.ts';
const context = (type: 'video'|'image'|'code'|'custom', goal: string) => makeContext(createProject(type, 'beginner', goal));
import { base, fixture } from './fixtures/visual.ts';
test('routes creative content by task without interpreting code permission roles as visual characters', () => {
  assert.deepEqual(profileFor(context('code','用户角色和权限管理，页面里可以上传分镜文件')).kind, 'general');
  assert.equal(profileFor(context('image','生成一个成年女剑客角色三视图')).needsCharacters, true);
  assert.equal(profileFor(context('image','咖啡海报，不含人物')).needsCharacters, false);
  assert.equal(profileFor(context('video','50秒雪地两名武者刀剑对决')).expectedSeconds, 50);
  assert.equal(profileFor(context('custom','为50秒水墨动画写具体分镜')).kind, 'video');
  assert.equal(profileFor(context('video','只写让编剧AI构思的元提示词，不要具体分镜')).kind, 'general');
});
test('rejects a meta checklist pretending to be actual storyboard or character description', () => {
  const bad = { ...base, prompt: '请输出50秒分镜表（时间轴、景别、机位、动作、画面要点），说明人物装扮并保持一致。' };
  assert.throws(() => materialize(bad, profileFor(context('video','50秒两名武者动画对决'))));
  assert.throws(() => materialize(bad, profileFor(context('image','成年女剑客角色设定图'))));
});
test('materializes actual timed shots and repeats visible character anchors into each copyable shot prompt', () => {
  const result = materialize(fixture(), profileFor(context('video','50秒两名武者雪地对决')));
  assert.match(result, /0[–-]20/); assert.match(result, /20[–-]50/);
  assert.match(result, /全景/); assert.match(result, /低机位固定相机/); assert.match(result, /直刀横切/);
  assert.ok((result.match(/暗红布腰带/g)||[]).length >= 3);
  assert.ok((result.match(/银白高马尾/g)||[]).length >= 3);
  assert.match(result, /起始状态/); assert.match(result, /结束状态/);
});
test('rejects missing costume, timing gaps, wrong duration and nonexistent character references', () => {
  const profile = profileFor(context('video','50秒两名武者对决'));
  for (const mutate of [
    (x: any) => { x.visualPlan.characters[0].costume = ''; },
    (x: any) => { x.visualPlan.shots[1].start = 22; },
    (x: any) => { x.visualPlan.totalSeconds = 45; x.visualPlan.shots[1].end = 45; },
    (x: any) => { x.visualPlan.shots[0].characters = ['C']; },
  ]) {
    const candidate = structuredClone(fixture()); mutate(candidate);
    assert.throws(() => materialize(candidate, profile));
  }
});
test('does not force fake people or a storyboard into product photography and ordinary coding prompts', () => {
  assert.equal(materialize({ prompt:'实现本地记账与CSV导出' }, profileFor(context('code','记账应用'))), '实现本地记账与CSV导出');
  const image = fixture(); image.visualPlan.characters = []; image.visualPlan.shots = []; image.visualPlan.totalSeconds = 0;
  const prompt = materialize(image, profileFor(context('image','咖啡产品摄影，不含人物')));
  assert.ok(!prompt.includes('角色设定')); assert.ok(!prompt.includes('分镜表')); assert.match(prompt, /构图/);
});
test('preserves intentional single-shot plans and validates updated duration from explicit feedback', () => {
  const c = context('video','50秒一镜到底的山巅对峙，两名武者');
  c.feedback = '总时长改成10秒';
  const f = fixture(); f.visualPlan.totalSeconds=10; f.visualPlan.shots=[{...f.visualPlan.shots[0],end:10}];
  assert.doesNotThrow(()=>materialize(f,profileFor(c)));
});
test('later edits retain the accepted timeline instead of reverting to the original duration', () => {
  const c=context('video','制作50秒两名武者动画');
  c.currentPrompt='## 分镜表（合计 10 秒）\n\n| S01 | 0–5 | 全景 | 固定 | 对峙 | 切镜 |\n| S02 | 5–10 | 中景 | 横移 | 收势 | 停住 |';
  c.summary='已改为10秒的水墨对决'; c.constraints=['总时长10秒'];c.feedback='只把男子腰带改为蓝色，其他不变';
  assert.equal(profileFor(c).expectedSeconds,10);
  assert.equal(profileFor(context('video','每镜5秒，总时长50秒，两名武者对决')).expectedSeconds,50);
  assert.equal(profileFor(context('video','每镜时长5秒，总时长50秒，两名武者对决')).expectedSeconds,50);
  c.feedback='每镜时长改为5秒，总时长保持10秒';
  assert.equal(profileFor(c).expectedSeconds,10);
});
test('negative meta and single-shot requests cannot disable actual-storyboard validation or force a single shot', () => {
  assert.equal(profileFor(context('video','50秒武者对决，不要元提示词，要实际分镜')).kind,'video');
  assert.equal(profileFor(context('video','50秒武者对决，不要一镜到底，拆成多镜头')).singleShot,false);
  const c=context('video','50秒武者一镜到底');c.feedback='不要一镜到底，改为多镜头';
  assert.equal(profileFor(c).singleShot,false);
  c.feedback='只改腰带颜色';c.currentPrompt='## 分镜表（合计 50 秒）\n\n| S01 | 0–20 | 全景 | 固定 | 对峙 | 切镜 |\n| S02 | 20–50 | 中景 | 横移 | 交锋 | 停住 |';
  assert.equal(profileFor(c).singleShot,false);
});
test('copyable shot text includes relevant avoidances and never refers to hidden implementation fields',()=>{
  const f=fixture();f.prompt='按visualPlan中的具体镜头执行。';
  const prompt=materialize(f,profileFor(context('video','50秒两名武者动画')));
  assert.ok(!prompt.includes('visualPlan'));
  const first=prompt.split('### S01')[1].split('### S02')[0];
  assert.match(first,/无文字水印/);
});
