// Executed only by the disposable restore runner, against its guarded socket.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { applicationRuntimeTarget } from './runtime-target.mjs';

async function main() {
  const phase = process.argv[2];
  const target = applicationRuntimeTarget(phase, process.env.APPLICATION_RECOVERY_SOCKET);
  assert.equal(realpathSync(target.directory), target.directory);
  assert.equal(realpathSync(target.socket), target.socket);
  assert.equal(process.env.NODE_ENV, 'test');
  assert.equal(process.env.DATABASE_URL, target.url);
  assert.equal(process.env.W03_INVOICE_DEMO_MODE, undefined);
  // Validate the target before loading the native database/runtime modules.
  const { pool } = await import('../../../lib/db/src/index');
  const { previewPayment, postPayment } = await import('../../../artifacts/api-server/src/services/accountingDocuments/payments');
  const { captureCommittedPaymentWitness } = await import('../../../artifacts/api-server/src/services/accountingDocuments/conditionalDiscount');
  const { withCanonicalPostingTransaction } = await import('../../../artifacts/api-server/src/services/accounting/canonicalPosting');
  try {
    assert.deepEqual((await pool.query(`SELECT current_database() database,current_user actor,
      inet_server_addr() address,current_setting('port') port`)).rows[0],
      { database: target.database, actor: 'ledgerly_api', address: null, port: String(target.port) });
    const permissions = (await pool.query(`SELECT
      has_function_privilege('ledgerly_canonical_owner','pg_catalog.pg_control_system()','EXECUTE') owner_execute,
      has_function_privilege(current_user,'pg_catalog.pg_control_system()','EXECUTE') runtime_execute,
      pg_has_role(current_user,'ledgerly_canonical_owner','MEMBER') owner_member`)).rows[0];
    assert.equal(permissions.owner_execute, true);
    assert.equal(permissions.owner_member, false);
    const witnesses = async (id: string) => Number((await pool.query(
      'SELECT count(*)::int n FROM conditional_discount_commit_witnesses WHERE event_id=$1', [id])).rows[0].n);
    const reviewed = async (company: string, actor: string, template: any) => {
      const body = { ...template, id: randomUUID(), reference: 'Synthetic restore acceptance', amount_minor: '100', allocations: [] };
      const review = await previewPayment(company, actor, body);
      return { ...body, review_token: review.review_token };
    };
    if (phase === 'prepare') {
      // Reuse the dedicated fixture's valid configuration and single owner.
      // Create this event through the native transaction before the dump baseline.
      const fixture = (await pool.query(`SELECT e.company_id,e.id,e.source,e.actor_id
        FROM accounting_payment_events e JOIN conditional_discount_commit_witnesses w ON w.event_id=e.id AND w.company_id=e.company_id
        WHERE e.actor_id='synthetic-witness-owner' AND e.kind='payment' AND e.party_type='customer'
        AND (SELECT count(*) FROM company_users u WHERE u.company_id=e.company_id AND u.user_id=e.actor_id)=1
        AND EXISTS(SELECT 1 FROM company_users u WHERE u.company_id=e.company_id AND u.user_id=e.actor_id AND u.is_active AND u.role='owner')
        ORDER BY e.id LIMIT 1`)).rows[0];
      assert.ok(fixture, 'Populated native witness fixture is required before restore.');
      const historical = await captureCommittedPaymentWitness(fixture.company_id, fixture.actor_id, fixture.id);
      assert.equal(historical.status, 'recorded');
      const body = await reviewed(fixture.company_id, fixture.actor_id, fixture.source.intent);
      const posted = await withCanonicalPostingTransaction(tx => postPayment(fixture.company_id, fixture.actor_id, body, undefined, tx));
      assert.equal(posted.status, 'posted');
      assert.equal(await witnesses(body.id), 0);
      const transaction = (await pool.query('SELECT cluster_id FROM conditional_discount_payment_transactions WHERE event_id=$1', [body.id])).rows[0];
      assert.ok(transaction?.cluster_id);
      return { company: fixture.company_id, actor: fixture.actor_id, historicalEvent: fixture.id, historical,
        unwitnessedEvent: body.id, sourceCluster: transaction.cluster_id, template: fixture.source.intent, permissions };
    }
    const fixture = JSON.parse(readFileSync(0, 'utf8'));
    assert.deepEqual(permissions, fixture.permissions, 'Effective function permissions changed during restore.');
    assert.deepEqual(await captureCommittedPaymentWitness(fixture.company, fixture.actor, fixture.historicalEvent), fixture.historical);
    assert.equal(await witnesses(fixture.unwitnessedEvent), 0);
    await assert.rejects(() => captureCommittedPaymentWitness(fixture.company, fixture.actor, fixture.unwitnessedEvent),
      (error: any) => /separately committed native payment/.test(error.cause?.message ?? error.message));
    assert.equal(await witnesses(fixture.unwitnessedEvent), 0, 'Foreign-origin event must remain unwitnessed.');
    const body = await reviewed(fixture.company, fixture.actor, fixture.template);
    const posted = await postPayment(fixture.company, fixture.actor, body);
    assert.equal(posted.status, 'posted');
    assert.equal((posted as any).conditional_discount_witness, 'recorded');
    const observed = await captureCommittedPaymentWitness(fixture.company, fixture.actor, body.id);
    assert.equal(observed.status, 'recorded');
    const retry = await postPayment(fixture.company, fixture.actor, body);
    assert.equal(retry.status, 'duplicate');
    assert.equal(retry.journal_id, posted.journal_id);
    assert.deepEqual(await captureCommittedPaymentWitness(fixture.company, fixture.actor, body.id), observed);
    const counts = (await pool.query(`SELECT
      (SELECT count(*)::int FROM accounting_payment_events WHERE id=$1) events,
      (SELECT count(*)::int FROM canonical_journal_entries WHERE source_type='accounting_payment_event' AND source_id=$1::text) journals,
      (SELECT count(*)::int FROM accounting_posting_effects WHERE source_type='accounting_payment_event' AND source_id=$1::text) effects,
      (SELECT count(*)::int FROM conditional_discount_payment_transactions WHERE event_id=$1) transactions,
      (SELECT count(*)::int FROM conditional_discount_commit_witnesses WHERE event_id=$1) witnesses`, [body.id])).rows[0];
    assert.deepEqual(counts, { events: 1, journals: 1, effects: 1, transactions: 1, witnesses: 1 });
    const origin = (await pool.query('SELECT cluster_id FROM conditional_discount_payment_transactions WHERE event_id=$1', [body.id])).rows[0];
    assert.notEqual(origin.cluster_id, fixture.sourceCluster, 'Restored cluster must have a different transaction origin.');
    assert.deepEqual(await captureCommittedPaymentWitness(fixture.company, fixture.actor, fixture.historicalEvent), fixture.historical);
    return { newNativePaymentPosted: true, newCommittedWitnessRecorded: true, retrySingleEffect: true,
      historicalWitnessPreserved: true, foreignUnwitnessedRejected: true, distinctClusterOrigin: true,
      effectiveFunctionPermissionsPreserved: true };
  } finally { await pool.end(); }
}

main().then(result => process.stdout.write(JSON.stringify(result) + '\n')).catch(error => {
  console.error(error); process.exitCode = 1;
});
