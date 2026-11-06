import test from 'node:test';
import assert from 'node:assert/strict';
import {parseQuotaStatus,parseAdminDashboard} from '../lib/admin-data.ts';
test('own quota status validates bounds and reset without inventing a full allowance',()=>{
 const data={remaining:3,limit:7,reset_at:'2026-11-07T16:00:00Z'};
 assert.deepEqual(parseQuotaStatus(data),{remaining:3,limit:7,resetAt:data.reset_at});
 for(const d of [null,{}, {...data,remaining:20},{...data,limit:20},{...data,remaining:-1}])assert.throws(()=>parseQuotaStatus(d));
});
test('admin response rejects missing or unsafe data and respects server pagination',()=>{
 const d={summary:{registered:2,verified:1,today:1,online:1,requests:4},total:1,offset:0,users:[{id:'abc',email:'owner@example.test',created_at:'2026-11-06',verified:true,admin:true,used:4,remaining:3,last_sign_in_at:null,last_seen:null,cloud_saved_at:null}],days:[{day:'2026-11-06',requests:4}]};
 assert.equal(parseAdminDashboard(d).users[0].remaining,3);
 for(const v of [null,{}, {...d,total:-1},{...d,users:[{...d.users[0],remaining:-1}]}])assert.throws(()=>parseAdminDashboard(v));
});
