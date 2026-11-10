// Only executed by the existing disposable runner, after populated pg_restore.
import test from 'node:test';
import assert from 'node:assert/strict';
import {realpathSync} from 'node:fs';
import path from 'node:path';
import {pool} from '@workspace/db';
import {reports} from './reports';
import {recoverConditionalCompensation,compensationHistory} from './conditionalCompensation';
import {transact,document} from './core';
import {observeConditionalReplacement} from './replacementBindings';

const socket=process.env.ACCOUNTING_FLOW_TEST_SOCKET??'';
if(!/^\/tmp\/ledgerly-accounting-flow-tests-[A-Za-z0-9]{6}\/socket$/.test(socket)||realpathSync(socket)!==socket)
  throw Error('Fresh disposable restore socket required');
test.after(()=>pool.end());
test('populated restored compensations retain immutable children, permanent consumption, historical reports and recovery under runtime role',async()=>{
  const identity=(await pool.query(`SELECT current_database() db,current_user actor,inet_server_addr() addr`)).rows[0];
  assert.deepEqual(identity,{db:'ledgerly_accounting_flow_restore_test',actor:'ledgerly_api',addr:null});
  const rows=(await pool.query('SELECT *,effective_date::text FROM conditional_discount_compensations ORDER BY company_id,request_id')).rows;
  assert.ok(rows.length>=4,'both sides and successful rollback retries must be populated before restore');
  const kinds=new Set<string>();
  for(const row of rows) {
    const credit=await transact(q=>document(q,row.company_id,row.credit_id),true);
    kinds.add(credit.kind);
    const chain=await transact(q=>compensationHistory(q,row.company_id,credit),true);
    assert.equal(chain.length,1);assert.equal(chain[0].request_id,row.request_id);
    const recovered=await recoverConditionalCompensation(row.company_id,row.actor_id,row.request_id);
    assert.equal(recovered.state,'known');
    const before=await reports(row.company_id,row.actor_id,'2026-01-01','2199-12-02');
    const after=await reports(row.company_id,row.actor_id,'2026-01-01',row.effective_date);
    assert.equal(before.open_items.find((d:any)=>d.id===row.original_id).open_minor,'0');
    const unallocated=(await pool.query('SELECT amount_minor FROM accounting_payment_events WHERE company_id=$1 AND id=$2',[row.company_id,row.unallocation_id])).rows[0];
    assert.equal(after.open_items.find((d:any)=>d.id===row.original_id).open_minor,
      row.evidence.payment_action==='reverse_payment'?'12000':(BigInt(credit.money.gross_pence)+BigInt(unallocated.amount_minor)).toString());
    if(row.evidence.payment_action==='reverse_payment') {
      assert.equal(after.party_balances.find((p:any)=>p.party_id===credit.party_id).unapplied_minor,'0');
      assert.equal(recovered.cash_reversal_id,row.result.cash_reversal_id);
    }
    assert.equal((await pool.query('SELECT count(*)::int n FROM accounting_paid_credit_operations WHERE company_id=$1 AND credit_id=$2',[row.company_id,row.credit_id])).rows[0].n,1);
  }
  assert.deepEqual([...kinds].sort(),['sales_credit_note','supplier_credit_note']);
  const replacements=(await pool.query('SELECT company_id,replacement_id,actor_id,binding_hash FROM conditional_discount_replacement_observations')).rows;
  assert.ok(replacements.length>=4);
  for(const r of replacements) {
    const observed=await observeConditionalReplacement(r.company_id,r.actor_id,r.replacement_id);
    assert.equal(observed.observation.binding_hash,r.binding_hash);
  }
  console.log('REPLACEMENT_RESTORE_ACCEPTANCE',JSON.stringify({observations:replacements.length,retainedNativeIdentity:true}));
  for(const sql of ['UPDATE conditional_discount_compensations SET reason=reason','DELETE FROM conditional_discount_compensations','TRUNCATE conditional_discount_compensations'])
    await assert.rejects(()=>pool.query(sql),(e:any)=>e.code==='42501');
  const corrected=(await pool.query(`SELECT DISTINCT d.company_id,d.original_id,o.actor_id
    FROM accounting_document_sources d JOIN accounting_document_amendments a
    ON a.company_id=d.company_id AND a.document_id=d.original_id
    JOIN accounting_paid_credit_operations o ON o.company_id=d.company_id AND o.credit_id=d.id
    WHERE d.status='posted' AND d.number LIKE 'CAP-%'`)).rows;
  assert.ok(corrected.length>=4,'corrected cumulative credits must survive populated restore');
  for(const item of corrected) {
    const report=await reports(item.company_id,item.actor_id,'2026-10-01','2026-10-31');
    const open=report.open_items.find((d:any)=>d.id===item.original_id);
    assert.ok(open);assert.ok(BigInt(open.open_minor)>=0n);
    assert.equal(report.balance_sheet.balanced,true);
    assert.equal(report.journal_movements.debit_minor,report.journal_movements.credit_minor);
  }
  console.log('CORRECTED_CREDIT_RESTORE_ACCEPTANCE',JSON.stringify({originals:corrected.length,balanced:true}));
  console.log('COMPENSATION_RESTORE_ACCEPTANCE',JSON.stringify({rows:rows.length,bothParties:true,historicalReports:true,knownRecovery:true,
    permanentConsumption:true,runtimeMutationDenied:true,socketDirectory:path.basename(path.dirname(socket))}));
});
