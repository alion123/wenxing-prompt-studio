import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleStudio } from '../lib/deepseek.ts';
import { createProject, makeContext } from '../lib/studio.ts';
import { fixture } from './fixtures/visual.ts';
const context = makeContext(createProject('code', 'beginner', '制作记账应用'));
const req = (body: unknown = { action: 'questions', context }) => new Request('https://studio.test/api/studio', { method: 'POST', body: JSON.stringify(body) });
const key = { DEEPSEEK_API_KEY: 'test-secret' };
const output = (data: unknown, finish_reason = 'stop') => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(data) }, finish_reason }] }));

test('references are real user image blocks paired with notes; invalid images are rejected before upstream',async()=>{
  const image={id:'ref-1',name:'参考.png',note:'只参考构图，不复制画面文字',dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII='};
  const second={...image,id:'ref-2',name:'色彩.png',note:'第二张只参考配色'};
  const c={...context,references:[image,second]};let calls=0;
  const questions=[1,2].map(i=>({id:`q${i}`,text:'参考哪一部分？',hint:'',options:['构图','配色','不确定']}));
  const r=await handleStudio(req({action:'questions',context:c}),key,async(_url,init)=>{
    calls++;const payload=JSON.parse(init!.body as string);assert.equal(payload.model,'deepseek-flash');
    const content=payload.messages[1].content;assert.ok(Array.isArray(content));
    assert.ok(content.some((x:any)=>x.type==='image_url'&&x.image_url.url===image.dataUrl));
    assert.deepEqual(content.filter((x:any)=>x.type==='image_url').map((x:any)=>x.image_url.url),[image.dataUrl,second.dataUrl]);
    assert.match(content[1].text,/参考图1.*只参考构图/);assert.match(content[3].text,/参考图2.*第二张只参考配色/);
    const text=content.filter((x:any)=>x.type==='text').map((x:any)=>x.text).join(' ');assert.match(text,/只参考构图/);assert.ok(!text.includes(image.dataUrl));
    return output({questions});
  });assert.equal(r.status,200);assert.equal(calls,1);
  for(const references of [[{...image,dataUrl:'https://example.com/a.png'}],[{...image,dataUrl:'data:image/svg+xml;base64,PHN2Zz4='}],Array.from({length:4},(_,i)=>({...image,id:`r${i}`})),[{...image,note:'长'.repeat(1001)}],[{...image,dataUrl:'data:image/png;base64,SGVsbG8='}]]){
    assert.equal((await handleStudio(req({action:'questions',context:{...context,references}}),key,async()=>{throw Error('must not call');})).status,400);
  }
});

test('suggestions fills options for the exact original questions without replacing questions or answers',async()=>{
  const c={...context,questions:[{id:'old-q',text:'用途和受众是谁？',hint:'',options:[]}],answers:{'old-q':'原回答，不能丢失'}};
  const suggestions=[{id:'old-q',hint:'选择用途，也可以保留原回答',options:['个人阅读','社交平台发布','不确定']}];
  let calls=0;
  const r=await handleStudio(req({action:'suggestions',context:c}),key,async(_url,init)=>{
    calls++;const payload=JSON.parse(init!.body as string);assert.match(payload.messages[0].content,/原问题|原题/);
    assert.equal(JSON.parse(payload.messages[1].content).answers['old-q'],c.answers['old-q']);
    return output({suggestions});
  });
  assert.equal(r.status,200);assert.equal(calls,1);assert.deepEqual(await r.json(),{suggestions});
  for(const bad of [[{...suggestions[0],id:'new-q'}],[...suggestions,...suggestions],[],[{...suggestions[0],options:['不确定']}]]){
    assert.equal((await handleStudio(req({action:'suggestions',context:c}),key,async()=>output({suggestions:bad}))).status,502);
  }
  assert.equal((await handleStudio(req({action:'suggestions',context}),key,async()=>{throw Error('must not call');})).status,400);
});

test('client cancellation reaches the upstream signal and is not retried',async()=>{
  const controller=new AbortController();let calls=0;
  const request=new Request(req(),{signal:controller.signal});
  await handleStudio(request,key,async(_url,init)=>{
    calls++;controller.abort();assert.equal(init?.signal?.aborted,true);
    throw new DOMException('cancelled','AbortError');
  });
  assert.equal(calls,1);
});

test('empty model content retries once and shares the two-call repair budget',async()=>{
  const blank=()=>Response.json({choices:[{finish_reason:'stop',message:{content:'  \n '}}]});
  const g={prompt:'具体的离线记账提示词',summary:'记账',constraints:[],assumptions:[],conflicts:[]};
  let calls=0;
  const ok=await handleStudio(req({action:'generate',context}),key,async()=>{calls++;return calls===1?blank():output(g);});
  assert.equal(ok.status,200);assert.equal(calls,2);
  calls=0;const failed=await handleStudio(req({action:'generate',context}),key,async()=>{calls++;return blank();});
  assert.equal(calls,2);assert.equal((await failed.json() as {code:string}).code,'empty_response');
  calls=0;await handleStudio(req(),key,async()=>{calls++;return new Response('',{status:429});});assert.equal(calls,1);
});
test('missing key is explicit and does not call upstream', async () => {
  const r = await handleStudio(req(), {}, async () => { throw Error('must not call'); });
  assert.equal(r.status, 503); assert.equal((await r.json() as { code: string }).code, 'not_configured');
});
test('rejects malformed context, excess body and foreign origin before upstream', async () => {
  assert.equal((await handleStudio(req({ action: 'questions', context: {} }), key)).status, 400);
  assert.equal((await handleStudio(req({ large: 'x'.repeat(5_000_000) }), key)).status, 413);
  const r = req(); r.headers.set('origin', 'https://other.test');
  assert.equal((await handleStudio(r, key)).status, 403);
});
test('valid question result uses configured server key and enforces new user question count', async () => {
  const questions = [1, 2].map(i => ({ id: `q${i}`, text: `问题${i}`, hint: '简单描述', options: ['A', '不确定'] }));
  let payload: any;
  const r = await handleStudio(req(), key, async (url, init) => {
    assert.equal(url, 'https://api.deepseek.com/chat/completions');
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer test-secret');
    payload = JSON.parse(init?.body as string); return output({ questions });
  });
  assert.equal(r.status, 200); assert.deepEqual((await r.json() as { questions: unknown }).questions, questions);
  assert.equal(payload.response_format.type, 'json_object');
  assert.equal(JSON.parse(payload.messages[1].content).goal, context.goal);
});
test('upstream authorization, balance, throttling, timeout and malformed outputs are safe failures', async () => {
  for (const status of [401, 402, 429, 500]) {
    const r = await handleStudio(req(), key, async () => new Response('secret debug', { status }));
    assert.ok(r.status >= 400); assert.ok(!(await r.text()).includes('secret debug'));
  }
  assert.equal((await handleStudio(req(), key, async () => { throw new DOMException('timeout', 'TimeoutError'); })).status, 504);
  for (const response of [new Response('not-json'), output({ questions: [] }), output({ questions: [{ id: 'q', text: 'X', options: [] }] }), output({}, 'length')]) {
    assert.equal((await handleStudio(req(), key, async () => response)).status, 502);
  }
});
test('generation retains prompt, assumptions, conflict warnings and cumulative constraints', async () => {
  const generated = { prompt: '# 任务\n制作应用', summary: '保留需求', constraints: ['本地存储'], assumptions: ['采用人民币'], conflicts: ['离线与云同步需确认'] };
  const r = await handleStudio(req({ action: 'generate', context }), key, async () => output(generated));
  assert.equal(r.status, 200); const {qualityReport,requirementUpdates,...rest}=await r.json() as any;
  assert.deepEqual(rest, generated); assert.equal(qualityReport.kind,'automatic'); assert.deepEqual(requirementUpdates,[]);
});
test('evaluation is explicit, read-only and requires evidence from the current draft', async()=>{
  const c={...context,currentPrompt:'实现离线记账，数据仅保存在本地。'};
  const assessment={summary:'建议明确货币',strengths:['已明确本地存储'],findings:[{severity:'suggestion',title:'货币未指定',reason:'金额展示需要单位',evidenceQuote:'实现离线记账',suggestion:'请补充默认货币。'}]};
  let calls=0;
  const r=await handleStudio(req({action:'evaluate',context:c}),key,async(_url,init)=>{
    calls++; const body=JSON.parse(init!.body as string); assert.match(body.messages[0].content,/evidenceQuote/);return output(assessment);
  });
  assert.equal(r.status,200);assert.equal(calls,1);const data=await r.json() as any;assert.equal(data.kind,'ai');assert.equal(data.prompt,c.currentPrompt);assert.ok(!('questions' in data));
  const bad=await handleStudio(req({action:'evaluate',context:c}),key,async()=>output({...assessment,findings:[{...assessment.findings[0],evidenceQuote:'并不存在的引用'}]}));
  assert.equal(bad.status,502);
  assert.equal((await handleStudio(req({action:'evaluate',context}),key,async()=>{throw Error('must not call');})).status,400);
});
test('only explicit current user quotations can update a confirmed requirement',async()=>{
  const c={...context,feedback:'请改为导出JSON文件',confirmedRequirements:[{id:'format',text:'导出CSV文件',scope:'project' as const}]};
  const g={prompt:'实现导出JSON文件。',summary:'JSON导出',constraints:['导出JSON文件'],assumptions:[],conflicts:[],requirementUpdates:[{id:'format',quote:'改为导出JSON文件',source:'feedback'}]};
  const r=await handleStudio(req({action:'generate',context:c}),key,async()=>output(g));
  assert.equal(r.status,200);assert.deepEqual((await r.json() as any).requirementUpdates,g.requirementUpdates);
  const bad=await handleStudio(req({action:'generate',context:c}),key,async()=>output({...g,requirementUpdates:[{id:'format',quote:'导出XML文件',source:'feedback'}]}));
  assert.equal(bad.status,502);
  assert.equal((await handleStudio(req({action:'generate',context:{...c,confirmedRequirements:[{id:'format',text:'x'.repeat(1501),scope:'project'}]}}),key)).status,400);
});
test('a missing requirement update ledger gets one bounded contract repair instead of silently keeping old facts',async()=>{
  const c={...context,feedback:'导出格式改为JSON文件',confirmedRequirements:[{id:'format',text:'导出CSV文件',scope:'project' as const}]};
  const base={prompt:'导出JSON文件',summary:'JSON导出',constraints:['导出JSON文件'],assumptions:[],conflicts:[]};let calls=0;
  const r=await handleStudio(req({action:'generate',context:c}),key,async()=>{calls++;return output(calls===1?base:{...base,requirementUpdates:[{id:'format',quote:'导出格式改为JSON文件',source:'feedback'}]});});
  assert.equal(r.status,200);assert.equal(calls,2);assert.equal((await r.json() as any).requirementUpdates.length,1);
  const failed=await handleStudio(req({action:'generate',context:c}),key,async()=>output(base));assert.equal(failed.status,422);
});
test('untrusted model question IDs are normalized before reaching the browser', async () => {
  const qs = ['constructor', 'toString'].map(id => ({ id, text: '请描述偏好', hint: '', options: ['不确定'] }));
  const r = await handleStudio(req(), key, async () => output({ questions: qs }));
  assert.equal(r.status, 200);
  assert.deepEqual((await r.json() as { questions: { id: string }[] }).questions.map(q => q.id), ['q1', 'q2']);
});
test('video quality gate rejects a bare output checklist after one bounded repair', async () => {
  const video = makeContext(createProject('video','beginner','50秒两名武者雪地对决'));
  let calls = 0;
  const r = await handleStudio(req({action:'generate', context:video}), key, async () => { calls++; return output({prompt:'请输出50秒分镜表和角色设定。',summary:'水墨对决',constraints:['50秒'],assumptions:[],conflicts:[]}); });
  assert.equal(r.status,422); assert.equal(calls,2);
  assert.equal((await r.json() as {code:string}).code,'insufficient_detail');
});
test('a repaired video is materialized into actual shots and stable standalone character prompts', async () => {
  const video = makeContext(createProject('video','beginner','50秒两名武者雪地对决'));
  let calls = 0;
  const r = await handleStudio(req({action:'generate',context:video}),key,async ()=>{
    calls++; return output(calls === 1 ? {...fixture(), visualPlan:undefined} : fixture());
  });
  assert.equal(r.status,200); assert.equal(calls,2);
  const data = await r.json() as {prompt:string};
  assert.match(data.prompt,/0–20/); assert.match(data.prompt,/20–50/); assert.match(data.prompt,/暗红布腰带/);
  assert.ok(!('visualPlan' in data));
});
test('character image cannot pass without concrete visual anchors and provider failures are not retried', async () => {
  const image = makeContext(createProject('image','beginner','女性剑客角色设定图'));
  const invalid = fixture(); invalid.visualPlan.shots=[]; invalid.visualPlan.totalSeconds=0; invalid.visualPlan.characters[0].appearance='漂亮';
  const bad = await handleStudio(req({action:'generate',context:image}), key, async()=>output(invalid));
  assert.equal(bad.status,422);
  let calls = 0;
  const unavailable = await handleStudio(req({action:'generate',context:image}), key, async()=>{calls++;return new Response('',{status:429});});
  assert.equal(unavailable.status,429); assert.equal(calls,1);
});
test('recovers a missing outer JSON closing brace without inventing values or requiring another model call', async () => {
  const video = makeContext(createProject('video','beginner','50秒两名武者雪地对决'));
  let calls=0;
  const r=await handleStudio(req({action:'generate',context:video}),key,async()=>{
    calls++; return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(fixture()).slice(0,-1)}}]}));
  });
  assert.equal(r.status,200);assert.equal(calls,1);
  assert.match((await r.json() as {prompt:string}).prompt,/20–50/);
});
