import test from 'node:test';
import assert from 'node:assert/strict';
import {checkStudioAccess} from '../lib/studio-access.ts';
const env={SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_12345678901234567890'};
const request=()=>new Request('https://studio.test/api/studio',{method:'POST',headers:{Authorization:'Bearer user-token'}});
test('verified users must reserve durable quota before model access, preserving user authorization',async()=>{
  const calls:string[]=[];
  const result=await checkStudioAccess(request(),env,async(input,options)=>{
    calls.push(String(input));
    if(String(input).endsWith('/user'))return Response.json({id:'user',email_confirmed_at:'2026-11-05'});
    assert.equal(new Headers(options?.headers).get('authorization'),'Bearer user-token');
    assert.equal(options?.method,'POST');
    return Response.json({allowed:false,reason:'account_daily',retry_after:120,remaining:0,limit:7,reset_at:'2026-11-06T16:00:00Z'});
  });
  assert.equal(result?.status,429);assert.equal(result?.headers.get('Retry-After'),'120');
  assert.equal(calls.length,2);
});
test('quota backend failure or malformed approval fails closed',async()=>{
  for(const body of [{},{allowed:'yes'},null]){
    const result=await checkStudioAccess(request(),env,async(input)=>String(input).endsWith('/user')?Response.json({id:'user',email_confirmed_at:'2026-11-05'}):Response.json(body));
    assert.equal(result?.status,503);
  }
});

test('the account daily limit is seven and exhaustion is reported politely with reset metadata',async()=>{
 const headers=new Headers();
 const result=await checkStudioAccess(request(),env,async(input)=>String(input).endsWith('/user')?Response.json({id:'user',email_confirmed_at:'2026-11-05'}):Response.json({allowed:false,reason:'account_daily',remaining:0,limit:7,reset_at:'2026-11-06T16:00:00Z',retry_after:120}),headers);
 assert.equal(result?.status,429);
 assert.equal(headers.get('X-Wenxing-Quota-Remaining'),'0');
 assert.equal(headers.get('X-Wenxing-Quota-Limit'),'7');
 assert.equal(headers.get('X-Wenxing-Quota-Reset'),'2026-11-06T16:00:00Z');
 const body=await result!.json() as {code:string;message:string};
 assert.equal(body.code,'quota_exhausted');
 assert.match(body.message,/7次.*已用尽/);
 assert.match(body.message,/感谢|谢谢/);
});

test('successful reservations expose remaining allowance before the model request',async()=>{
 const headers=new Headers();
 const result=await checkStudioAccess(request(),env,async(input)=>String(input).endsWith('/user')?Response.json({id:'user',email_confirmed_at:'2026-11-05'}):Response.json({allowed:true,remaining:3,limit:7,reset_at:'2026-11-06T16:00:00Z'}),headers);
 assert.equal(result,null);assert.equal(headers.get('X-Wenxing-Quota-Remaining'),'3');
});

test('invalid or incompatible quota metadata cannot authorize a model request',async()=>{
 for(const body of [{allowed:true,remaining:19,limit:20,reset_at:'2026-11-06T16:00:00Z'},{allowed:true,remaining:-1,limit:7,reset_at:'2026-11-06T16:00:00Z'},{allowed:true,remaining:3.5,limit:7,reset_at:'2026-11-06T16:00:00Z'},{allowed:true,remaining:3,limit:7,reset_at:'invalid'}]){
  const result=await checkStudioAccess(request(),env,async(input)=>String(input).endsWith('/user')?Response.json({id:'user',email_confirmed_at:'2026-11-05'}):Response.json(body));
  assert.equal(result?.status,503);
 }
});
