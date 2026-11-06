import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPagesWorker} from '../deployment/pages/worker.ts';
import {createProject,makeContext} from '../lib/studio.ts';
const assets={fetch:async()=>new Response('<html>studio assets</html>',{headers:{'Content-Type':'text/html'}})};
const env={DEEPSEEK_API_KEY:'test-provider-secret',ASSETS:assets};
const request=(path='/',options:RequestInit={})=>new Request(`https://studio.pages.dev${path}`,options);
test('unconfigured export fails closed and never requests the provider',async()=>{
  const worker=createPagesWorker(async()=>{throw Error('must not call');});
  for(const settings of [{ASSETS:assets},{...env,DEEPSEEK_API_KEY:''}]){
    const r=await worker.fetch(request(),settings);assert.equal(r.status,503);assert.match(await r.text(),/DEEPSEEK_API_KEY/);
  }
});
test('visitors open assets and status without credentials even with an obsolete access secret or cached authorization',async()=>{
  const worker=createPagesWorker(async()=>{throw Error('must not call');});
  for(const settings of [env,{...env,WENXU_ACCESS_CODE:'old-password'}])for(const path of ['/','/assets/app.js','/api/status'])for(const header of ['', 'Basic !!!']){
    const r=await worker.fetch(request(path,{headers:{Authorization:header}}),settings);
    assert.equal(r.status,200);assert.equal(r.headers.get('WWW-Authenticate'),null);
    assert.ok(!(await r.text()).includes('test-provider-secret'));
  }
});

test('studio requires a verified account before calling the model',async()=>{
  let calls=0;const worker=createPagesWorker(async()=>{calls++;return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({prompt:'写一个离线记账应用。',summary:'离线记账',constraints:[],assumptions:[],conflicts:[]})}}]}));});
  assert.deepEqual(await (await worker.fetch(request('/api/status'),env)).json(),{configured:true});
  assert.equal((await worker.fetch(request('/api/studio'),env)).status,405);
  assert.equal((await worker.fetch(request('/api/unknown'),env)).status,404);
  const body=JSON.stringify({action:'generate',context:makeContext(createProject('code','beginner','记账应用'))});
  const foreign=await worker.fetch(request('/api/studio',{method:'POST',headers:{Origin:'https://other.test'},body}),env);assert.equal(foreign.status,403);assert.equal(calls,0);
  const settings={...env,SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_12345678901234567890'};
  const post=(token?:string)=>request('/api/studio',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body});
  assert.equal((await worker.fetch(post(),settings)).status,401);
  assert.equal(calls,0);
  let verified=false;
  const secured=createPagesWorker(async(input,options)=>{
    if(String(input).endsWith('/rpc/wenxing_consume_generation'))return Response.json({allowed:true,remaining:3,limit:7,reset_at:'2026-11-06T16:00:00Z'});
    if(String(input)==='https://project.supabase.co/auth/v1/user'){
      assert.equal(new Headers(options?.headers).get('apikey'),settings.SUPABASE_PUBLISHABLE_KEY);
      return verified?Response.json({id:'user',email_confirmed_at:'2026-11-03T00:00:00Z'}):Response.json({id:'user'});
    }
    return workerModel(input,options);
  });
  const workerModel:typeof fetch=async()=>{calls++;return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({prompt:'写一个离线记账应用。',summary:'离线记账',constraints:[],assumptions:[],conflicts:[]})}}]});};
  assert.equal((await secured.fetch(post('test-token'),settings)).status,403);
  assert.equal(calls,0);
  verified=true;
  const good=await secured.fetch(post('test-token'),settings);assert.equal(good.status,200);assert.equal(calls,1);assert.match((await good.json() as {prompt:string}).prompt,/离线记账/);
  assert.equal(good.headers.get('X-Wenxing-Quota-Remaining'),'3');
});

test('auth config endpoint only publishes browser-safe settings, never provider secrets',async()=>{
 const worker=createPagesWorker(async()=>{throw Error('no upstream');});
 const settings={...env,SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_12345678901234567890'};
 const response=await worker.fetch(request('/api/auth-config'),settings);assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{url:settings.SUPABASE_URL,publishableKey:settings.SUPABASE_PUBLISHABLE_KEY});
 const secret=await worker.fetch(request('/api/auth-config'),{...settings,SUPABASE_PUBLISHABLE_KEY:'sb_secret_PRIVATE12345678'});assert.deepEqual(await secret.json(),{url:null,publishableKey:null});
 assert.equal((await worker.fetch(request('/api/auth-config',{method:'POST'}),settings)).status,405);
});
