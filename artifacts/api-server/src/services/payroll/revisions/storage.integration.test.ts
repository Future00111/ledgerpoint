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
    const sourceSql = readFileSync('artifacts/api-server/src/services/payroll/revisions/draft-source.sql','utf8');
    await admin.query(sourceSql);
    await admin.query(breakdownSql);
    await admin.query(readFileSync('artifacts/api-server/src/services/payroll/revisions/draft-storage.sql','utf8'));
    const line = {line_id:randomUUID(),employee_id:randomUUID(),input_revision_id:randomUUID(),
      gross:'9007199254740993',net:'9007199254740890',deductions:{paye:'100'},adjustments:{rounding:'-3'}};
    const another = {...line,line_id:randomUUID(),employee_id:randomUUID(),input_revision_id:randomUUID(),
      gross:'200',net:'180',deductions:{paye:'20'},adjustments:{}};
    const payInput = (tenant:string,employee:string,id:string,date:string) => admin.query(
      'INSERT INTO public.employee_pay_records(company_id,employee_id,id,effective_from,annual_salary_pence) VALUES ($1,$2,$3,$4,4200000)',
      [tenant,employee,id,date]);
    const stale = randomUUID(), foreign = randomUUID(), future = randomUUID();
    await payInput(company,line.employee_id,stale,'2026-09-01');
    await payInput(company,line.employee_id,line.input_revision_id,'2026-10-01');
    await payInput(company,line.employee_id,future,'2026-11-01');
    await payInput(other,line.employee_id,foreign,'2026-10-01');
    await payInput(company,another.employee_id,another.input_revision_id,'2026-08-01');
    const insert = (id:string,revision:number,version:string,lines:unknown[] = []) => admin.query(
      `INSERT INTO pay_run_draft_revisions(company_id,run_id,revision_number,revision_id,period_start,period_end,payday,currency,rules_version,prepared_by,employee_lines)
       VALUES ($1,$2,$3,$4,'2026-10-01','2026-10-31','2026-10-30','GBP',$5,'synthetic-preparer',$6::jsonb)`,[company,run,revision,id,version,JSON.stringify(lines)]);
    await insert(first,1,'synthetic-v1');
    await admin.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    try { await assert.rejects(insert(randomUUID(),2,'pinned-snapshot'),{code:'25000'}); }
    finally { await admin.query('ROLLBACK'); }
    const snapshot = await readDraftRevision(company,actor,first);
    assert.deepEqual(snapshot,{run_id:run,revision_id:first,revision_number:1,period_start:'2026-10-01',
      period_end:'2026-10-31',payday:'2026-10-30',currency:'GBP',rules_version:'synthetic-v1'});
    await insert(second,2,'synthetic-v2',[line,another]);
    for (const invalid of [[{...line,net:'1'}],[line,line],[line,{...another,line_id:line.employee_id}],[{...line,input_revision_id:null}],
      [{...line,adjustments:{other:'-3'}}],[{...line,net:12}],[{...line,bank_account:'invalid'}]]) {
      await assert.rejects(insert(randomUUID(),3,'invalid',invalid),{code:'23514'});
    }
    const rejectedSource = (source:string) => assert.rejects(
      insert(randomUUID(),3,'source-check',[another,{...line,input_revision_id:source}]),{code:'23514'});
    for (const source of [stale,foreign,future,another.input_revision_id,randomUUID()]) await rejectedSource(source);
    // A later backdated change does not alter the saved snapshot. New drafts require split-period support.
    const changed = randomUUID();
    const concurrent = new pg.Client({host:socket,port:55441,database,user:'w03_bootstrap',ssl:false});
    await concurrent.connect();
    try {
      const pid = (await concurrent.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      await admin.query('BEGIN');
      await admin.query('SELECT id FROM companies WHERE id=$1 FOR UPDATE',[company]);
      await payInput(company,line.employee_id,changed,'2026-10-31');
      const result = concurrent.query(
        `INSERT INTO pay_run_draft_revisions(company_id,run_id,revision_number,revision_id,period_start,period_end,payday,
          currency,rules_version,prepared_by,prepared_at,employee_lines) SELECT company_id,run_id,3,$1,period_start,period_end,payday,currency,
          rules_version,prepared_by,prepared_at,employee_lines FROM pay_run_draft_revisions WHERE revision_id=$2`,
        [randomUUID(),second]).then(() => 'accepted', error => error.code);
      let blocked = false;
      for (let attempt=0; attempt<100 && !blocked; attempt++) {
        blocked = (await admin.query('SELECT pg_backend_pid()=ANY(pg_blocking_pids($1)) AS blocked',[pid])).rows[0].blocked;
        if (!blocked) await new Promise(resolve => setTimeout(resolve,20));
      }
      assert.equal(blocked,true);
      await admin.query('COMMIT');
      assert.equal(await result,'23514');
    } finally { await admin.query('ROLLBACK'); await concurrent.end(); }
    await rejectedSource(line.input_revision_id);
    await rejectedSource(changed);
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
    await admin.query('DROP FUNCTION public.check_pay_run_draft_sources()');
    await admin.query(sourceSql);
    await admin.query(breakdownSql);
    execFileSync('pg_restore',[...args,'--exit-on-error'],{input:archive});
    await rejectedSource(changed);
    assert.deepEqual((await rawHeaders()).rows,beforeRestore);
    await verify();
    const receipts = await admin.query("SELECT company_id,actor_id,target_id FROM accounting_audit_events WHERE actor_id=$1 AND capability='payroll.read'",[actor]);
    assert.equal(receipts.rowCount,5);
    assert.ok(receipts.rows.every(row => row.company_id === company && row.actor_id === actor && [first,second].includes(row.target_id)));
  } finally { await admin.end(); await pool.end(); }
});
