import test from 'node:test';
import assert from 'node:assert/strict';
import {newPasswordError} from '../lib/password-policy.ts';
import {accountErrorMessage} from '../lib/auth-email.ts';
test('new passwords require at least eight characters and an actual supported special symbol',()=>{
 for(const p of ['12345678','Abcdefgh','Abcd1234','中文密码没有符号','Abcd123 ','Abcd123！'])assert.match(newPasswordError(p),/特殊符号/);
 assert.match(newPasswordError('Abc1!'),/至少8/);
 for(const p of ['Abc1234!','Eight_12','中文密码Ab1!','Eight++1'])assert.equal(newPasswordError(p),'');
 for(const p of ['lower123!','UPPER123!','NoDigits!!','Abcd1234'])assert.notEqual(newPasswordError(p),'');
});
test('weak password provider errors are actionable but never echo provider data',()=>{
 assert.match(accountErrorMessage({code:'weak_password',message:'private provider data'}),/特殊符号/);
 assert.doesNotMatch(accountErrorMessage({code:'weak_password',message:'private provider data'}),/private/);
});
