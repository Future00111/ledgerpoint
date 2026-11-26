import assert from 'node:assert/strict';
import {pool} from '@workspace/db';
import {readDraftRevision} from './readDraftRevision';

async function verifyRestoredRead() {
  const [company,other,actor,revision] = process.argv.slice(2);
  const result = await readDraftRevision(company,actor,revision,true);
  assert.equal(result.revision_id,revision);
  assert.equal(result.review_breakdown.totals.line_count,2);
  await assert.rejects(readDraftRevision(company,'header-reader',revision,true),{code:'SENSITIVE_ACCESS_DENIED'});
  await assert.rejects(readDraftRevision(other,actor,revision,true),{code:'SENSITIVE_ACCESS_DENIED'});
}
verifyRestoredRead().finally(() => pool.end());
