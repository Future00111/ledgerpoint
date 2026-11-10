import test from 'node:test';
import assert from 'node:assert/strict';
import {aiService,AIProviderError} from './index';
test('native module imports require no AI credentials, but AI use fails honestly',async()=>{
  assert.equal(process.env.OPENAI_API_KEY,undefined,'Run only in sanitized test environment');
  await assert.rejects(()=>aiService.complete({messages:[{role:'user',content:'Synthetic test; no network'}]}),AIProviderError);
});
