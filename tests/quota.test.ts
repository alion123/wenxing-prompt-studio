import test from 'node:test';
import assert from 'node:assert/strict';
import {readQuotaSnapshot,QuotaNoticeTracker,withQuotaHeaders} from '../lib/quota.ts';
const resetAt='2026-11-06T16:00:00Z';
const headers=(remaining:string,reset=resetAt)=>new Headers({'X-Wenxing-Quota-Remaining':remaining,'X-Wenxing-Quota-Limit':'7','X-Wenxing-Quota-Reset':reset});
test('quota parser accepts server counts and rejects missing, fractional and out-of-range values',()=>{
 assert.deepEqual(readQuotaSnapshot(headers('3')),{remaining:3,limit:7,resetAt});
 for(const h of [new Headers(),headers('-1'),headers('8'),headers('3.5'),headers(''),headers('3','invalid')])assert.equal(readQuotaSnapshot(h),null);
});
test('low allowance warns once per day and exhaustion is a separate notice',()=>{
 const tracker=new QuotaNoticeTracker();
 assert.equal(tracker.next({remaining:4,limit:7,resetAt}),null);
 assert.equal(tracker.next({remaining:3,limit:7,resetAt}),'low');
 assert.equal(tracker.next({remaining:3,limit:7,resetAt}),null);
 assert.equal(tracker.next({remaining:2,limit:7,resetAt}),null);
 assert.equal(tracker.next({remaining:0,limit:7,resetAt}),'exhausted');
 assert.equal(tracker.next({remaining:0,limit:7,resetAt}),null);
 assert.equal(tracker.next({remaining:3,limit:7,resetAt:'2026-11-07T16:00:00Z'}),'low');
});
test('opening another device with two remaining requests still receives the low allowance warning',()=>{
 assert.equal(new QuotaNoticeTracker().next({remaining:2,limit:7,resetAt}),'low');
});
test('quota metadata preserves failed model response content and prevents shared caching',async()=>{
 const response=withQuotaHeaders(Response.json({message:'model unavailable'},{status:502,headers:{'Retry-After':'10'}}),headers('3'));
 assert.equal(response.status,502);assert.equal(response.headers.get('Retry-After'),'10');
 assert.equal(response.headers.get('X-Wenxing-Quota-Remaining'),'3');
 assert.match(response.headers.get('Cache-Control')!,/private.*no-store/);
 assert.deepEqual(await response.json(),{message:'model unavailable'});
});
