import test from 'node:test';
import assert from 'node:assert/strict';
import {EmailSendCooldown,accountErrorMessage} from '../lib/auth-email.ts';

test('verification and recovery share the send interval for one normalized recipient, but another recipient can proceed',()=>{
  const cooldown=new EmailSendCooldown();
  cooldown.sent(' Person@Example.com ',1000);
  assert.equal(cooldown.remaining('person@example.com',1001),60);
  assert.equal(cooldown.remaining('PERSON@example.com',60001),1);
  assert.equal(cooldown.remaining('person@example.com',61000),0);
  assert.equal(cooldown.remaining('other@example.com',1001),0);
});

test('sending to a different recipient does not clear the original send interval',()=>{
  const cooldown=new EmailSendCooldown();
  cooldown.sent('first@example.com',1000);
  cooldown.sent('second@example.com',5000);
  assert.equal(cooldown.remaining('first@example.com',6000),55);
  assert.equal(cooldown.remaining('second@example.com',6000),59);
});

test('auth failures distinguish project quota from per-user throttling and never expose provider diagnostics',()=>{
  assert.match(accountErrorMessage({code:'over_email_send_rate_limit'}),/发信额度/);
  assert.match(accountErrorMessage({code:'over_request_rate_limit'}),/频繁/);
  assert.match(accountErrorMessage({code:'email_address_not_authorized'}),/发信服务/);
  assert.match(accountErrorMessage({code:'unexpected_failure'}),/服务/);
  assert.equal(accountErrorMessage(new Error('secret smtp credentials leaked')), '操作未完成，请检查网络或稍后重试。');
});
