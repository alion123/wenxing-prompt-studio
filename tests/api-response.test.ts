import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readStudioResponse,StudioApiError,requestFailureMessage} from '../lib/api-response.ts';

test('HTML authentication and gateway failures produce actionable messages instead of JSON parser exceptions',async()=>{
  for(const status of [401,502]){
    await assert.rejects(()=>readStudioResponse(new Response('<html>private proxy error</html>',{status}),'generate'),(e:unknown)=>{
      assert.ok(e instanceof StudioApiError);assert.equal(e.status,status);
      assert.match(e.message,status===401?/登录/:/服务/);
      assert.ok(!e.message.includes('<html>'));assert.match(e.message,/保留/);return true;
    });
  }
});

test('a malformed 200 question response cannot enter saved project state',async()=>{
  for(const body of [{},{questions:null},{questions:[{id:'q1',text:'问题',hint:'',options:[null]}]}]){
    await assert.rejects(()=>readStudioResponse(Response.json(body),'questions'),(e:unknown)=>e instanceof StudioApiError&&e.code==='invalid_response');
  }
  const body={questions:[1,2].map(i=>({id:`q${i}`,text:'用途？',hint:'',options:['不确定']}))};
  assert.deepEqual(await readStudioResponse(Response.json(body),'questions'),body);
});

test('API codes are preserved for uncertainty recovery and network failures are localized',async()=>{
  await assert.rejects(()=>readStudioResponse(Response.json({code:'insufficient_detail',message:'缺少具体分镜。'},{status:422}),'generate'),(e:unknown)=>e instanceof StudioApiError&&e.code==='insufficient_detail'&&e.message==='缺少具体分镜。');
  assert.match(requestFailureMessage(new TypeError('Failed to fetch')),/网络.*保留/);
  assert.match(requestFailureMessage(new DOMException('timed out','TimeoutError')),/超时.*保留/);
});
