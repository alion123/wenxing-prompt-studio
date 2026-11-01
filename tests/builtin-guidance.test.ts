import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handleStudio} from '../lib/deepseek.ts';
import {createProject,makeContext,type Kind} from '../lib/studio.ts';
import {fixture} from './fixtures/visual.ts';

async function systemFor(type:Kind,action:'questions'|'generate'|'evaluate',goal:string){
  const context=makeContext(createProject(type,'beginner',goal));context.currentPrompt=action==='evaluate'?'保留当前手工编辑内容':'';
  let system='';
  const response=await handleStudio(new Request('https://studio.test/api/studio',{method:'POST',body:JSON.stringify({action,context})}),{DEEPSEEK_API_KEY:'test-secret'},async(_url,init)=>{
    const payload=JSON.parse(init!.body as string);system=payload.messages[0].content;
    assert.deepEqual(JSON.parse(payload.messages[1].content),JSON.parse(JSON.stringify(context)));
    const result=action==='questions'?{questions:[{id:'q1',text:'主要用途？',hint:'',options:[]},{id:'q2',text:'有哪些限制？',hint:'',options:[]}]}:action==='evaluate'?{summary:'检查现有内容',strengths:[],findings:[]}:type==='video'?fixture():{prompt:'明确的可执行任务',summary:'任务摘要',constraints:[],assumptions:[],conflicts:[]};
    return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(result)}}]}));
  });
  assert.equal(response.status,200);return system;
}
test('code questions, generation and assessment use common development principles without unrelated visual defaults',async()=>{
  for(const action of ['questions','generate','evaluate'] as const){
    const system=await systemFor('code',action,'制作离线待办网页');
    assert.match(system,/内置通用原则/);assert.match(system,/代码通用/);assert.match(system,/输入.*输出/);assert.match(system,/验收/);
    assert.doesNotMatch(system,/【图片通用】|【视频通用】/);
    if(action==='evaluate'){assert.match(system,/不改写/);assert.doesNotMatch(system,/action=generate 时输出/);}
  }
});
test('visual principles follow the actual task and retain the existing storyboard contract',async()=>{
  const image=await systemFor('image','questions','为咖啡产品设计海报');assert.match(image,/【图片通用】/);assert.match(image,/参考图/);assert.doesNotMatch(image,/【代码通用】|【视频通用】/);
  const video=await systemFor('video','generate','50秒两名武者雪地对决');assert.match(video,/【视频通用】/);assert.match(video,/主要动作/);assert.match(video,/visualPlan/);assert.match(video,/不臆造.*能力/);
  const custom=await systemFor('custom','questions','为水墨动画视频写分镜');assert.match(custom,/【视频通用】/);
  const generic=await systemFor('custom','questions','制定口语练习计划');assert.match(generic,/内置通用原则/);assert.doesNotMatch(generic,/【代码通用】|【图片通用】|【视频通用】/);
});
test('custom images route visually while writing and explicit meta-prompts retain general guidance',async()=>{
  const custom=await systemFor('custom','questions','制作一张咖啡海报');assert.match(custom,/【图片通用】/);
  const writing=await systemFor('copy','questions','写一篇介绍动画分镜的文章');assert.match(writing,/内置通用原则/);assert.doesNotMatch(writing,/【代码通用】|【图片通用】|【视频通用】/);
  const meta=await systemFor('video','questions','只要元提示词，不要具体分镜');assert.match(meta,/内置通用原则/);assert.doesNotMatch(meta,/【视频通用】|visualPlan/);
});
