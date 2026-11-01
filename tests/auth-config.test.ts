import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicAuthConfig} from '../lib/auth-config.ts';
const url='https://project-ref.supabase.co';
test('public auth configuration excludes secret and service role keys',()=>{
 assert.deepEqual(publicAuthConfig({}),{url:null,publishableKey:null});
 assert.deepEqual(publicAuthConfig({SUPABASE_URL:url,SUPABASE_PUBLISHABLE_KEY:'sb_publishable_12345678901234567890'}),{url,publishableKey:'sb_publishable_12345678901234567890'});
 for(const key of ['sb_secret_'+'1'.repeat(20),'not-a-public-key',`e30.${Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')}.sig`])assert.equal(publicAuthConfig({SUPABASE_URL:url,SUPABASE_PUBLISHABLE_KEY:key}).publishableKey,null);
 assert.equal(publicAuthConfig({SUPABASE_URL:'http://evil.test',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_12345678901234567890'}).url,null);
});
