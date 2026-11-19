import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import pg from 'pg';
import {pool} from '@workspace/db';
import {readDraftRevision} from './readDraftRevision';

test('draft revision headers are immutable, company-scoped and recoverable', async () => {
  const socket = process.env.ACCOUNTING_FLOW_TEST_SOCKET ?? '', database = process.env.REVISION_TEST_DATABASE ?? '';
  assert.match(socket, /^\/tmp\/ledgerly-accounting-flow-tests-[A-Za-z0-9]+\/socket$/);
  assert.match(database, /^ledgerly_revision_test_[a-f0-9]{32}$/);
  const admin = new pg.Client({host:socket, port:55441, database, user:'w03_bootstrap', ssl:false});
  await admin.connect();
  try {
    assert.deepEqual((await pool.query('SELECT current_database() db, current_user actor, inet_server_addr() addr')).rows,
      [{db:database,actor:'ledgerly_api',addr:null}]);
    const company=randomUUID(), other=randomUUID(), run=randomUUID(), first=randomUUID(), second=randomUUID(), actor='revision-reviewer';
    await admin.query("INSERT INTO companies(id,name) VALUES ($1,'Revision A'),($2,'Revision B')",[company,other]);
    for (const id of [company,other]) await admin.query("INSERT INTO company_users(id,company_id,user_id,role,is_active) VALUES ($1,$2,$3,'payroll_approver',true)",[randomUUID(),id,actor]);
    await admin.query("INSERT INTO company_users(id,company_id,user_id,role,is_active) VALUES ($1,$2,'header-reader','payroll_reader',true)",[randomUUID(),company]);
    const breakdownSql = readFileSync('artifacts/api-server/src/services/payroll/revisions/draft-breakdown.sql','utf8');
    await admin.query(breakdownSql);
    await admin.query(readFileSync('artifacts/api-server/src/services/payroll/revisions/draft-storage.sql','utf8'));
    const line = {line_id:randomUUID(),employee_id:randomUUID(),input_revision_id:randomUUID(),
      gross:'9007199254740993',net:'9007199254740890',deductions:{paye:'100'},adjustments:{rounding:'-3'}};
    const another = {...line,line_id:randomUUID(),employee_id:randomUUID(),input_revision_id:randomUUID(),
      gross:'200',net:'180',deductions:{paye:'20'},adjustments:{}};
    const insert = (id:string,revision:number,version:string,lines:unknown[] = []) => admin.query(
      `INSERT INTO pay_run_draft_revisions(company_id,run_id,revision_number,revision_id,period_start,period_end,payday,currency,rules_version,prepared_by,employee_lines)
       VALUES ($1,$2,$3,$4,'2026-10-01','2026-10-31','2026-10-30','GBP',$5,'synthetic-preparer',$6::jsonb)`,[company,run,revision,id,version,JSON.stringify(lines)]);
    await insert(first,1,'synthetic-v1');
    const snapshot = await readDraftRevision(company,actor,first);
    assert.deepEqual(snapshot,{run_id:run,revision_id:first,revision_number:1,period_start:'2026-10-01',
      period_end:'2026-10-31',payday:'2026-10-30',currency:'GBP',rules_version:'synthetic-v1'});
    await insert(second,2,'synthetic-v2',[line,another]);
    for (const invalid of [[{...line,net:'1'}],[line,line],[line,{...another,line_id:line.employee_id}],[{...line,input_revision_id:null}],
      [{...line,adjustments:{other:'-3'}}],[{...line,net:12}],[{...line,bank_account:'invalid'}]]) {
      await assert.rejects(insert(randomUUID(),3,'invalid',invalid),{code:'23514'});
    }
    await assert.rejects(insert(randomUUID(),2,'duplicate'),{code:'23505'});
    const verify = async () => {
      assert.deepEqual(await readDraftRevision(company,actor,first),snapshot);
      const detailed = await readDraftRevision(company,actor,second,true);
      assert.equal(detailed.revision_number,2);
      assert.deepEqual(detailed.review_breakdown,{
        lines:[line,another].map(({employee_id,input_revision_id,...visible}) => visible),
        totals:{line_count:2,gross:'9007199254741193',net:'9007199254741070',deductions:{paye:'120'},adjustments:{rounding:'-3'}}
      });
      await assert.rejects(readDraftRevision(company,'header-reader',second,true),{code:'SENSITIVE_ACCESS_DENIED'});
      await assert.rejects(readDraftRevision(other,actor,second,true),{code:'SENSITIVE_ACCESS_DENIED'});
      await assert.rejects(readDraftRevision(company,'unrelated-user',first),{code:'SENSITIVE_ACCESS_DENIED'});
      for (const sql of ["UPDATE pay_run_draft_revisions SET currency='GBP'",'DELETE FROM pay_run_draft_revisions','TRUNCATE pay_run_draft_revisions']) {
        await assert.rejects(admin.query(sql),{code:'P0001'});
        await assert.rejects(pool.query(sql),{code:'42501'});
      }
    };
    const rawHeaders = () => admin.query('SELECT * FROM public.pay_run_draft_revisions WHERE company_id=$1 ORDER BY revision_number',[company]);
    await verify();
    const beforeRestore = (await rawHeaders()).rows;
    assert.equal(beforeRestore.length,2);
    const args=['-h',socket,'-p','55441','-U','w03_bootstrap','-d',database];
    const archive=execFileSync('pg_dump',[...args,'--format=custom','--table=public.pay_run_draft_revisions']);
    await admin.query('DROP TABLE public.pay_run_draft_revisions');
    await admin.query('DROP FUNCTION public.pay_run_draft_breakdown(jsonb)');
    await admin.query(breakdownSql);
    execFileSync('pg_restore',[...args,'--exit-on-error'],{input:archive});
    assert.deepEqual((await rawHeaders()).rows,beforeRestore);
    await verify();
    const receipts = await admin.query("SELECT company_id,actor_id,target_id FROM accounting_audit_events WHERE actor_id=$1 AND capability='payroll.read'",[actor]);
    assert.equal(receipts.rowCount,5);
    assert.ok(receipts.rows.every(row => row.company_id === company && row.actor_id === actor && [first,second].includes(row.target_id)));
  } finally { await admin.end(); await pool.end(); }
});
