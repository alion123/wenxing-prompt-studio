import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccountFetch} from '../lib/account-fetch.ts';

test('a stalled account request is aborted and reports timeout without retrying the side effect',async()=>{
  let calls=0,aborted=false;
  const fetcher:typeof fetch=async(_url,options)=>{
    calls++;
    return new Promise((_resolve,reject)=>options!.signal!.addEventListener('abort',()=>{aborted=true;reject(options!.signal!.reason);},{once:true}));
  };
  const response=await createAccountFetch(fetcher,10)('https://example.com/auth');
  assert.equal(response.status,408);
  assert.equal((await response.json() as {code:string}).code,'request_timeout');
  assert.equal(calls,1);assert.equal(aborted,true);
});

test('a stalled account response body also releases the UI with timeout',async()=>{
  const fetcher:typeof fetch=async(_url,options)=>new Response(new ReadableStream({
    start(controller){options!.signal!.addEventListener('abort',()=>controller.error(options!.signal!.reason),{once:true});},
  }));
  assert.equal((await createAccountFetch(fetcher,10)('https://example.com/auth')).status,408);
});

test('refresh timeout stays retryable so an existing session is not invalidated',async()=>{
  const fetcher:typeof fetch=async(_url,options)=>new Promise((_resolve,reject)=>options!.signal!.addEventListener('abort',()=>reject(options!.signal!.reason),{once:true}));
  const response=await createAccountFetch(fetcher,10)('https://example.com/auth/v1/token?grant_type=refresh_token');
  assert.equal(response.status,503);
});
