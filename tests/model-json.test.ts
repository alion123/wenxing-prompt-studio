import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseModelJSON } from '../lib/model-json.ts';
test('missing container closure is recoverable but values and delimiters inside strings remain literal',()=>{
  assert.deepEqual(parseModelJSON('{"value":"literal } [ text","items":[]'),{value:'literal } [ text',items:[]});
  assert.deepEqual(parseModelJSON('{"items":[{"text":"a\\\"b"}'),{items:[{text:'a"b'}]});
});
test('cannot recover unfinished strings, missing values, mismatched delimiters or broken properties',()=>{
  for(const broken of ['{"value":"unfinished','{"value":','{"items":[1,2}', '{"a":1, BROKEN}', '{"items":[{"x":1},'])assert.throws(()=>parseModelJSON(broken));
});
