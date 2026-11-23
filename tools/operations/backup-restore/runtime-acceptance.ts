// Executed only by the disposable restore runner, against its guarded socket.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
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
  const { previewPayment, postPayment, recoverPayment } = await import('../../../artifacts/api-server/src/services/accountingDocuments/payments');
  const { captureCommittedPaymentWitness } = await import('../../../artifacts/api-server/src/services/accountingDocuments/conditionalDiscount');
  const { getIntakeContent } = await import('../../../artifacts/api-server/src/services/documentIntake/service');
  const { withCanonicalPostingTransaction } = await import('../../../artifacts/api-server/src/services/accounting/canonicalPosting');
  const {conditionalReplacementOverview}=await import('../../../artifacts/api-server/src/services/accountingDocuments/conditionalReplacementOverview');
  const {reports}=await import('../../../artifacts/api-server/src/services/accountingDocuments/reports');
  const {recoverBankOpening}=await import('../../../artifacts/api-server/src/services/accountingDocuments/bankOpenings');
  const {recoverBankImport}=await import('../../../artifacts/api-server/src/services/accountingDocuments/bankImports');
  const {recoverBankMatch}=await import('../../../artifacts/api-server/src/services/accountingDocuments/bankStatements');
  const {recoverBankCorrection}=await import('../../../artifacts/api-server/src/services/accountingDocuments/bankCorrections');
  const { readEmployeeBankDetails } = await import('../../../artifacts/api-server/src/services/payroll/access/bankDetails');
  const { createPersonalTaxPreparation, readPersonalTaxPreparation } = await import('../../../artifacts/api-server/src/services/tax/access/preparationRecord');
  const { createPayRecord, readPayRecord } = await import('../../../artifacts/api-server/src/services/payroll/access/payRecord');
  const {preparePaymentAttempts, verifyPaymentAttempts}=await import('./payment-attempt-acceptance');
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
    const bankingRecovery = async () => {
      const result:any[]=[];
      for (const [kind,table,id,reader] of [
        ['opening','accounting_bank_openings','bank_account_id',recoverBankOpening],
        ['import','accounting_bank_import_reviews','request_id',recoverBankImport],
        ['match','accounting_bank_matches','request_id',recoverBankMatch],
        ['correction','accounting_bank_match_corrections','request_id',recoverBankCorrection],
        ['refund_match','accounting_bank_matches','request_id',recoverBankMatch],
        ['corrected_payment_reversal','accounting_payment_events','id',recoverPayment],
      ] as const) {
        const filter=kind==='refund_match'
          ? "WHERE EXISTS(SELECT 1 FROM accounting_payment_events p WHERE p.company_id=r.company_id AND p.id=r.payment_id AND p.kind='refund')"
          :kind==='corrected_payment_reversal'
          ? "WHERE r.kind='reversal' AND EXISTS(SELECT 1 FROM accounting_bank_matches m JOIN accounting_bank_match_corrections c ON c.company_id=m.company_id AND c.match_request_id=m.request_id WHERE m.company_id=r.company_id AND m.payment_id=r.payment_id)"
          :'';
        const rows=(await pool.query(`SELECT r.company_id,r.${id} id,u.user_id actor
          FROM ${table} r JOIN company_users u ON u.company_id=r.company_id AND u.is_active AND u.role='owner'
          ${filter}
          ORDER BY r.company_id,r.${id},u.user_id`)).rows;
        let found=false;
        for(const row of rows) {
          const receipt=await reader(row.company_id,row.actor,row.id);
          if(receipt.status==='unknown')continue;
          result.push({kind,...row,receipt});found=true;break;
        }
        assert.ok(found,`Populated ${kind} recovery evidence is required`);
      }
      return result;
    };
    const sourceMetadata = (row: any) => Object.fromEntries(
      ['id', 'revision', 'sha256', 'media_type', 'filename', 'byte_length', 'document_id'].map(key => [key, row[key]]));
    const verifyCapture = async (capture: any) => {
      const expectedBytes = Buffer.from(capture.contentBase64, 'base64');
      assert.equal(createHash('sha256').update(expectedBytes).digest('hex'), capture.metadata.sha256);
      assert.equal(expectedBytes.length, capture.metadata.byte_length);
      for (const [actor, active, role] of [[capture.actor, true, 'owner'],
        [capture.reader, true, 'read_only'], [capture.inactive, false, 'owner']] as const) {
        const membership = await pool.query('SELECT role,is_active FROM company_users WHERE company_id=$1 AND user_id=$2',
          [capture.company, actor]);
        assert.deepEqual(membership.rows, [{ role, is_active: active }]);
      }
      assert.deepEqual((await pool.query('SELECT role,is_active FROM company_users WHERE company_id=$1 AND user_id=$2',
        [capture.foreignCompany, capture.actor])).rows, [{ role: 'owner', is_active: true }]);
      assert.equal((await pool.query('SELECT id FROM company_users WHERE company_id=$1 AND user_id=$2',
        [capture.company, capture.foreignActor])).rowCount, 0);
      // Compare the native reader against bytes taken independently from storage
      // before the dump, including the originally captured document association.
      for (const actor of [capture.actor, capture.reader]) {
        const result = await getIntakeContent(capture.company, actor, capture.metadata.id);
        assert.deepEqual(result.content, expectedBytes);
        assert.deepEqual(sourceMetadata(result.source), capture.metadata);
      }
      for (const [company, actor] of [[capture.foreignCompany, capture.actor],
        [capture.company, capture.inactive], [capture.company, capture.foreignActor]]) {
        await assert.rejects(() => getIntakeContent(company, actor, capture.metadata.id),
          (error: any) => error.status === 404 && error.code === 'RESOURCE_NOT_FOUND');
      }
    };
    if (phase === 'prepare') {
      // Reuse the dedicated fixture's valid configuration and single owner.
      // Create this event through the native transaction before the dump baseline.
      const seeds = (await pool.query(`SELECT e.company_id,e.id,e.source,e.actor_id
        FROM accounting_payment_events e JOIN conditional_discount_commit_witnesses w ON w.event_id=e.id AND w.company_id=e.company_id
        WHERE e.actor_id='synthetic-witness-owner' AND e.kind='payment' AND e.party_type='customer'
        AND e.source->'intent'->>'reference'='Synthetic restore rehearsal seed'
        AND (SELECT count(*) FROM company_users u WHERE u.company_id=e.company_id AND u.user_id=e.actor_id)=1
        AND EXISTS(SELECT 1 FROM company_users u WHERE u.company_id=e.company_id AND u.user_id=e.actor_id AND u.is_active AND u.role='owner')
        `)).rows;
      assert.equal(seeds.length, 1, 'Expected one isolated native payment witness for restore.');
      const [fixture] = seeds;
      // Reuse the capture permission fixture; no source or membership mutation.
      const source = (await pool.query(`SELECT s.*,inactive.user_id inactive_actor,reader.user_id reader_actor
        FROM document_intake_sources s
        JOIN company_users creator ON creator.company_id=s.company_id AND creator.user_id=s.created_by
          AND creator.is_active AND creator.role='owner'
        JOIN company_users inactive ON inactive.company_id=s.company_id AND NOT inactive.is_active
          AND inactive.role='owner' AND inactive.user_id LIKE 'capture-role-%'
        JOIN company_users reader ON reader.company_id=s.company_id AND reader.is_active AND reader.role='read_only'
        WHERE s.document_id IS NOT NULL
        ORDER BY s.company_id,s.id,inactive.user_id,reader.user_id LIMIT 1`)).rows[0];
      assert.ok(source, 'Populated capture permission fixture is required before restore.');
      const foreignCompany = (await pool.query(`SELECT company_id FROM company_users
        WHERE company_id<>$1 AND user_id=$2 AND is_active AND role='owner'
        ORDER BY company_id LIMIT 1`, [source.company_id, source.created_by])).rows[0]?.company_id;
      assert.ok(foreignCompany, 'A second permitted company is required for scoped source denial.');
      const capture = { company: source.company_id, actor: source.created_by, reader: source.reader_actor,
        inactive: source.inactive_actor, foreignActor: fixture.actor_id, foreignCompany,
        metadata: sourceMetadata(source), contentBase64: source.content.toString('base64') };
      await verifyCapture(capture);
      const historical = await captureCommittedPaymentWitness(fixture.company_id, fixture.actor_id, fixture.id);
      assert.equal(historical.status, 'recorded');
      const body = await reviewed(fixture.company_id, fixture.actor_id, fixture.source.intent);
      const posted = await withCanonicalPostingTransaction(tx => postPayment(fixture.company_id, fixture.actor_id, body, undefined, tx));
      assert.equal(posted.status, 'posted');
      assert.equal(await witnesses(body.id), 0);
      const transaction = (await pool.query('SELECT cluster_id FROM conditional_discount_payment_transactions WHERE event_id=$1', [body.id])).rows[0];
      assert.ok(transaction?.cluster_id);
      const lifecycleRows=(await pool.query(`SELECT DISTINCT o.company_id,o.actor_id,d.id,d.kind FROM accounting_paid_credit_operations o
        JOIN accounting_document_sources d ON d.company_id=o.company_id AND d.id::text=o.intent->>'original_id'
        WHERE o.intent ? 'commercial_admission' AND EXISTS(SELECT 1 FROM conditional_discount_compensations c WHERE c.company_id=o.company_id)
        ORDER BY o.company_id,d.id`)).rows;
      assert.ok(lifecycleRows.some(r=>r.kind==='sales_invoice')&&lifecycleRows.some(r=>r.kind==='purchase_bill'),'Both replacement lifecycles required for executable restore');
      const replacementAcceptance=[];
      for(const row of lifecycleRows) {
        const overview=await conditionalReplacementOverview(row.company_id,row.actor_id,row.id);
        assert.equal(overview.consumed,true);
        assert.ok(overview.replacements.some(r=>r.observation.state==='observed'));
        const cutoffs=[];
        for(const date of ['2026-11-06','2026-11-07','2026-11-08','2026-11-10','2199-12-02','2199-12-03'])
          cutoffs.push({date,report:await reports(row.company_id,row.actor_id,'2026-01-01',date)});
        replacementAcceptance.push({...row,overview,cutoffs});
      }
      const banking = await bankingRecovery();
      const paymentAttempts = await preparePaymentAttempts(pool, { company: fixture.company_id, actor: fixture.actor_id,
        template: fixture.source.intent, foreignCompany: capture.company, foreignActor: capture.actor });
      const pay = { id: randomUUID(), employee_id: randomUUID(), effective_from: '2026-04-06', annual_salary_pence: '4250000' };
      const creation = await createPayRecord(capture.company, capture.actor, pay);
      assert.deepEqual(creation, { id: pay.id, status: 'created' });
      // Capture expected projections from the populated source independently of the API.
      const taxRow = (await pool.query(`SELECT t.company_id, t.id, t.taxpayer_id, t.tax_year_start,
        t.employment_income_pence::text AS employment_income_pence, o.user_id AS owner, s.user_id AS submitter
        FROM public.personal_tax_preparations t
        JOIN public.company_users o ON o.company_id=t.company_id AND o.role='owner' AND o.is_active
        JOIN public.company_users s ON s.company_id=t.company_id AND s.role='personal_tax_submitter' AND s.is_active
        WHERE NOT EXISTS (SELECT 1 FROM public.company_users x WHERE x.company_id=t.company_id
          AND ((x.user_id=o.user_id AND x.id<>o.id) OR (x.user_id=s.user_id AND x.id<>s.id)))
        ORDER BY t.company_id,t.id,o.id,s.id LIMIT 1`)).rows[0];
      assert.ok(taxRow, 'A populated personal-tax record with both read roles is required');
      const publicFields = { id: taxRow.id, tax_year_start: taxRow.tax_year_start,
        employment_income_pence: taxRow.employment_income_pence, currency: 'GBP' };
      const taxPreparation = { company: taxRow.company_id, owner: taxRow.owner, submitter: taxRow.submitter,
        submitterFields: publicFields, ownerFields: { ...publicFields, taxpayer_id: taxRow.taxpayer_id } };
      const taxCreated = { id: randomUUID(), taxpayer_id: randomUUID(), tax_year_start: 2026, employment_income_pence: '4200000' };
      assert.equal((await createPersonalTaxPreparation(taxRow.company_id, taxRow.owner, taxCreated)).status, 'created');
      const bank = (await pool.query(`SELECT b.company_id, b.employee_id, b.account_number, o.user_id AS owner, a.user_id AS approver
        FROM public.employee_bank_details b JOIN public.company_users o ON o.company_id=b.company_id AND o.role='owner' AND o.is_active
        JOIN public.company_users a ON a.company_id=b.company_id AND a.role='payroll_approver' AND a.is_active
        WHERE NOT EXISTS (SELECT 1 FROM public.company_users x WHERE x.company_id=b.company_id AND
          ((x.user_id=o.user_id AND x.id<>o.id) OR (x.user_id=a.user_id AND x.id<>a.id)))
        ORDER BY b.company_id,b.employee_id,o.id,a.id LIMIT 1`)).rows[0];
      assert.ok(bank, 'A synthetic bank-detail fixture with owner and approver is required');
      const bankFixture = { company: bank.company_id, employee: bank.employee_id, owner: bank.owner, approver: bank.approver,
        fullDigest: createHash('sha256').update(bank.account_number).digest('hex'),
        suffixDigest: createHash('sha256').update(bank.account_number.slice(-4)).digest('hex') };
      return { bankFixture, taxCreated, taxPreparation, pay, paymentAttempts,bankingRecovery:banking,replacementAcceptance,company: fixture.company_id, actor: fixture.actor_id, historicalEvent: fixture.id, historical,
        unwitnessedEvent: body.id, sourceCluster: transaction.cluster_id, template: fixture.source.intent, permissions, capture };
    }
    const fixture = JSON.parse(readFileSync(0, 'utf8'));
    assert.deepEqual(await bankingRecovery(),fixture.bankingRecovery,'Native banking receipts changed across restore');
    assert.deepEqual(permissions, fixture.permissions, 'Effective function permissions changed during restore.');
    await verifyCapture(fixture.capture);
    const bank = fixture.bankFixture;
    for (const [actor, field, digest] of [[bank.owner, 'account_number', bank.fullDigest], [bank.approver, 'last_four', bank.suffixDigest]]) {
      const projection = await readEmployeeBankDetails(bank.company, actor, bank.employee);
      const entries = Object.entries(projection);
      assert.ok(entries.length === 1 && entries[0][0] === field && typeof entries[0][1] === 'string' &&
        createHash('sha256').update(entries[0][1]).digest('hex') === digest, 'Restored bank-detail projection differs');
    }
    const tax = fixture.taxPreparation;
    // Compare without printing sensitive field values if a check fails.
    const { isDeepStrictEqual } = await import('node:util');
    for (const [actor, expected] of [[tax.owner, tax.ownerFields], [tax.submitter, tax.submitterFields]]) {
      const result = await readPersonalTaxPreparation(tax.company, actor, tax.submitterFields.id);
      assert.ok(isDeepStrictEqual(result, expected), 'Restored personal-tax projection differs');
    }
    const created = fixture.taxCreated;
    assert.equal((await createPersonalTaxPreparation(tax.company, tax.owner, created)).status, 'replayed');
    await assert.rejects(() => createPersonalTaxPreparation(tax.company, tax.owner, { ...created, employment_income_pence: '4200001' }),
      (error: any) => error.code === 'SENSITIVE_REQUEST_CONFLICT');
    const { taxpayer_id, ...publicInput } = created;
    for (const [actor, expected] of [[tax.owner, { ...created, currency: 'GBP' }], [tax.submitter, { ...publicInput, currency: 'GBP' }]]) {
      const projection = await readPersonalTaxPreparation(tax.company, actor, created.id);
      assert.ok(isDeepStrictEqual(projection, expected), 'Restored created personal-tax projection differs');
    }
    const taxReceipts = await pool.query(`SELECT id FROM public.accounting_audit_events WHERE company_id=$1
      AND target_type='personal_tax_preparation' AND target_id=$2 AND action='personal_tax_preparation_create'`, [tax.company, created.id]);
    assert.equal(taxReceipts.rowCount, 1, 'Restored retry must preserve the single personal-tax creation receipt');
    const pay = fixture.pay;
    const company = fixture.capture.company, owner = fixture.capture.actor;
    assert.deepEqual(await createPayRecord(company, owner, pay), { id: pay.id, status: 'replayed' });
    await assert.rejects(() => createPayRecord(company, owner, { ...pay, annual_salary_pence: '4250001' }),
      (err: any) => err.code === 'SENSITIVE_REQUEST_CONFLICT');
    const restoredPay = await readPayRecord(company, owner, pay.id);
    assert.ok(restoredPay.id === pay.id && restoredPay.effective_from === pay.effective_from && restoredPay.currency === 'GBP' &&
      restoredPay.annual_salary_pence === pay.annual_salary_pence && restoredPay.employee_id === pay.employee_id);
    const receipts = await pool.query(`SELECT id FROM public.accounting_audit_events WHERE company_id=$1
      AND target_type='employee_pay_record' AND target_id=$2 AND action='employee_pay_record_create'`, [company, pay.id]);
    assert.equal(receipts.rowCount, 1, 'Restored retry must preserve the single pay creation receipt');
    assert.ok(fixture.replacementAcceptance?.length>=2);
    for(const row of fixture.replacementAcceptance) {
      assert.deepEqual(await conditionalReplacementOverview(row.company_id,row.actor_id,row.id),row.overview,'Restored replacement history/consumption changed');
      for(const cutoff of row.cutoffs)
        assert.deepEqual(await reports(row.company_id,row.actor_id,'2026-01-01',cutoff.date),cutoff.report,'Restored executable lifecycle report changed');
    }
    assert.deepEqual(await captureCommittedPaymentWitness(fixture.company, fixture.actor, fixture.historicalEvent), fixture.historical);
    assert.equal(await witnesses(fixture.unwitnessedEvent), 0);
    await assert.rejects(() => captureCommittedPaymentWitness(fixture.company, fixture.actor, fixture.unwitnessedEvent),
      (error: any) => /separately committed native payment/.test(error.cause?.message ?? error.message));
    assert.equal(await witnesses(fixture.unwitnessedEvent), 0, 'Foreign-origin event must remain unwitnessed.');
    const paymentAttemptRecovery = await verifyPaymentAttempts(pool, fixture.paymentAttempts);
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
    return { payrollBankReadVerified: true, personalTaxCreateReplayVerified: true, personalTaxReadVerified: true, payRecordReplayVerified: true, paymentAttemptRecovery,nativeBankingRecoveryVerified:true,bankingRecoveryKinds:fixture.bankingRecovery.map((r:any)=>r.kind),
      replacementLifecyclesVerified:fixture.replacementAcceptance.length,replacementHistoricalReportsPreserved:true,
      replacementObservationAndConsumptionPreserved:true,newNativePaymentPosted: true, newCommittedWitnessRecorded: true, retrySingleEffect: true,
      historicalWitnessPreserved: true, foreignUnwitnessedRejected: true, distinctClusterOrigin: true,
      effectiveFunctionPermissionsPreserved: true, nativeCaptureBytesAndMetadataPreserved: true,
      nativeCaptureReadOnlyAccessPreserved: true, nativeCaptureForeignCompanyDenied: true,
      nativeCaptureInactiveAndForeignActorsDenied: true };
  } finally { await pool.end(); }
}

main().then(result => process.stdout.write(JSON.stringify(result) + '\n')).catch(error => {
  console.error(error); process.exitCode = 1;
});
