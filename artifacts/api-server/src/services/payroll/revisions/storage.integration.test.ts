import test from 'node:test';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { createCompaniesRouter } from '../../../routes/companies';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {promisify} from 'node:util';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFile,execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import pg from 'pg';
import {pool} from '@workspace/db';
import {prepareDatedLoanLine} from './datedLoanLine.mjs';
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
    const line = {line_id:randomUUID(),employee_id:randomUUID(),input_revision_id:randomUUID(),
      gross:'9007199254740993',net:'9007199254740890',deductions:{paye:'100'},adjustments:{rounding:'-3'}};
    function calculationFor(employeeId:string) {
      const payday = '2026-10-30';
      const notice = (plan:string,type:string) => ({plan,type,id:type,employmentId:employeeId,effectiveDate:'2026-09-10',
        receivedDate:'2026-09-10',firstAvailablePayday:'2026-09-30',availabilityEvidence:'Synthetic regular cutoff'});
      return {grossHistory:Array(7).fill('350000'),taxCodes:'BR',priorityOrder:{deductionMinor:'5000',protectedLevelMinor:'245000'},
        noticeContext:{taxYear:'2026-27',frequency:'monthly',paymentDate:payday,payMinor:'350000',plan:'plan_2',
          employmentId:employeeId,earningsBasis:'class1_ni_earnings',activeEmployment:true,employeeStopRequest:false,otherInstructions:[],
          occupationalPensionOnly:false,deceased:false,protectedEarnings:true,concurrentLoan:true,correction:false,offPayroll:false,
          notices:[notice('plan_2','SL1'),notice('postgraduate','PGL1')]}};
    }
    const employeeId = randomUUID();
    const source = { lineId:randomUUID(), employeeId, inputRevisionId:randomUUID(), payday:'2026-10-30', calculation:calculationFor(employeeId) };
    const {advanceDatedLoanPayslipDraft} = await import(pathToFileURL(path.resolve(
      'artifacts/api-server/src/services/payroll/contracts/datedLoanPayslipDraft.mjs')).href);
    type Opening = { employmentId:string, taxYear:string, frequency:string, completedPeriods:number, taxablePayMinor:string, taxPaidMinor:string };
    let opening: Opening | undefined;
    for (const paymentDate of ['2026-04-30','2026-05-29','2026-06-30','2026-07-31','2026-08-28','2026-09-30']) {
      const draft: {nextOpening:Opening | null} = advanceDatedLoanPayslipDraft({...source.calculation,opening,grossHistory:['350000'],
        noticeContext:{...source.calculation.noticeContext,paymentDate}});
      assert.ok(draft.nextOpening);
      opening = draft.nextOpening;
    }
    assert.ok(opening);
    assert.equal(opening.taxablePayMinor,'2100000');
    assert.equal(opening.taxPaidMinor,'420000');
    const another = prepareDatedLoanLine({...source,calculation:{...source.calculation,grossHistory:['350000'],opening}});
    assert.deepEqual(another,prepareDatedLoanLine(source));
    assert.throws(() => prepareDatedLoanLine({...source, employeeId:randomUUID()}), RangeError);
    assert.throws(() => prepareDatedLoanLine({...source, payday:'2026-10-31'}), RangeError);
    assert.throws(() => prepareDatedLoanLine({...source, lineId:employeeId}), RangeError);
    assert.deepEqual(another.deductions,{paye:'70000',employee_ni:'19616',student_loan:'0',postgraduate_loan:'10300',priority_order:'5000'});
    assert.equal(another.net,'245084');
    const {priorityOrder, ...ordinaryCalculation} = source.calculation;
    const ordinary = prepareDatedLoanLine({...source, calculation:{...ordinaryCalculation,
      noticeContext:{...ordinaryCalculation.noticeContext,protectedEarnings:false}}});
    assert.equal(Object.hasOwn(ordinary.deductions,'priority_order'),false);
    const zeroOrder = prepareDatedLoanLine({...source, calculation:{...source.calculation,
      priorityOrder:{...priorityOrder,deductionMinor:'0'}}});
    assert.equal(zeroOrder.deductions.priority_order,'0');
    const payInput = (tenant:string,employee:string,id:string,date:string) => admin.query(
      'INSERT INTO public.employee_pay_records(company_id,employee_id,id,effective_from,annual_salary_pence) VALUES ($1,$2,$3,$4,4200000)',
      [tenant,employee,id,date]);
    const stale = randomUUID(), foreign = randomUUID(), future = randomUUID();
    await payInput(company,line.employee_id,stale,'2026-09-01');
    await payInput(company,line.employee_id,line.input_revision_id,'2026-10-01');
    await payInput(company,line.employee_id,future,'2026-11-01');
    await payInput(other,line.employee_id,foreign,'2026-10-01');
    await payInput(company,another.employee_id,another.input_revision_id,'2026-08-01');
    const insert = (id:string,revision:number,version:string,lines:unknown[] = [],
      writer = admin, tenant = company, runId = run) => writer.query(
      `INSERT INTO pay_run_draft_revisions(company_id,run_id,revision_number,revision_id,period_start,period_end,payday,currency,rules_version,prepared_by,employee_lines)
       VALUES ($1,$2,$3,$4,'2026-10-01','2026-10-31','2026-10-30','GBP',$5,'synthetic-preparer',$6::jsonb)`,[tenant,runId,revision,id,version,JSON.stringify(lines)]);
    await assert.rejects(insert(randomUUID(),2,'missing-first'),{code:'23514'});
    await insert(first,1,'synthetic-v1');
    await admin.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    try { await assert.rejects(insert(randomUUID(),2,'pinned-snapshot'),{code:'25000'}); }
    finally { await admin.query('ROLLBACK'); }
    const snapshot = await readDraftRevision(company,actor,first);
    assert.deepEqual(snapshot,{run_id:run,revision_id:first,revision_number:1,period_start:'2026-10-01',
      period_end:'2026-10-31',payday:'2026-10-30',currency:'GBP',rules_version:'synthetic-v1'});
    await insert(second,2,'synthetic-v2',[line,another]);
    for (const invalid of [[{...another,net:'250085',deductions:{...another.deductions,priority_order:'-1'}}],[{...line,net:'1'}],[line,line],[line,{...another,line_id:line.employee_id}],[{...line,input_revision_id:null}],
      [{...line,adjustments:{other:'-3'}}],[{...line,net:12}],[{...line,bank_account:'invalid'}]]) {
      await assert.rejects(insert(randomUUID(),3,'invalid',invalid),{code:'23514'});
    }
    const rejectedSource = (source:string, writer = admin) => assert.rejects(
      insert(randomUUID(),3,'source-check',[another,{...line,input_revision_id:source}],writer),{code:'23514'});
    for (const source of [stale,foreign,future,another.input_revision_id,randomUUID()]) await rejectedSource(source);
    const waitForBlockedWriter = async (pid:number) => {
      let blocked = false;
      for (let attempt=0; attempt<100 && !blocked; attempt++) {
        blocked = (await admin.query('SELECT pg_backend_pid()=ANY(pg_blocking_pids($1)) AS blocked',[pid])).rows[0].blocked;
        if (!blocked) await new Promise(resolve => setTimeout(resolve,20));
      }
      assert.equal(blocked,true);
    };
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
      await waitForBlockedWriter(pid);
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
      assert.equal(detailed.is_current_revision,true);
      assert.equal((await readDraftRevision(company,actor,first,true)).is_current_revision,false);
      assert.deepEqual(detailed.review_breakdown,{
        lines:[line,another].map(({employee_id,input_revision_id,...visible}) => visible),
        totals:{line_count:2,gross:'9007199255090993',net:'9007199254985974',deductions:{paye:'70100',employee_ni:'19616',student_loan:'0',postgraduate_loan:'10300',priority_order:'5000'},adjustments:{rounding:'-3'}}
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
    const archive=execFileSync('pg_dump',[...args,'--format=custom']);
    const restoredDatabase = database + '_restore';
    await admin.query('CREATE DATABASE ' + restoredDatabase + ' TEMPLATE template0');
    const restored = new pg.Client({host:socket,port:55441,database:restoredDatabase,user:'w03_bootstrap',ssl:false});
    try {
      execFileSync('pg_restore',['-h',socket,'-p','55441','-U','w03_bootstrap','-d',restoredDatabase,'--exit-on-error','--single-transaction'],{input:archive});
      await restored.connect();
      const history = 'SELECT * FROM public.schema_migrations ORDER BY id';
      const sourceHistory = (await admin.query(history)).rows;
      assert.ok(sourceHistory.some(row => row.id === 'pay-run-draft-revisions'));
      assert.deepEqual((await restored.query(history)).rows,sourceHistory);
      await assert.rejects(restored.query('DELETE FROM public.pay_run_draft_revisions'),{code:'P0001'});
      await rejectedSource(changed,restored);
      const auditQuery = "SELECT count(*)::int n FROM accounting_audit_events WHERE company_id=$1 AND actor_id=$2 AND target_id=$3 AND capability='payroll.read'";
      const auditArgs = [company,actor,second];
      const priorReads = (await restored.query(auditQuery,auditArgs)).rows[0].n;
      const probeDir = mkdtempSync(path.join(process.cwd(),'generated-artifacts/revision-restore-'));
      try {
        const probe = path.join(probeDir,'probe.cjs');
        execFileSync('pnpm',['--filter','@workspace/api-server','exec','esbuild','src/services/payroll/revisions/restore-read.test-probe.ts',
          '--bundle','--platform=node','--format=cjs','--external:pg','--outfile='+probe]);
        const restoredUrl = new URL(process.env.DATABASE_URL!);
        restoredUrl.pathname = '/' + restoredDatabase;
        execFileSync(process.execPath,[probe,company,other,actor,second],{env:{...process.env,DATABASE_URL:restoredUrl.href}});
      } finally { rmSync(probeDir,{recursive:true,force:true}); }
      assert.equal((await restored.query(auditQuery,auditArgs)).rows[0].n,priorReads+1);
      await restored.query('SET ROLE ledgerly_api');
      assert.deepEqual((await restored.query('SELECT * FROM public.pay_run_draft_revisions WHERE company_id=$1 ORDER BY revision_number',[company])).rows,beforeRestore);
      await assert.rejects(restored.query('DELETE FROM public.pay_run_draft_revisions'),{code:'42501'});
    } finally {
      await restored.end();
      await admin.query('DROP DATABASE ' + restoredDatabase);
    }
    await rejectedSource(changed);
    assert.deepEqual((await rawHeaders()).rows,beforeRestore);
    await verify();
    // Competing drafts based on revision 2: one wins, the other must reload.
    const otherCompanyRevision = randomUUID(), otherRunRevision = randomUUID();
    const latest = randomUUID(), winner = randomUUID();
    const contender = new pg.Client({host:socket,port:55441,database,user:'w03_bootstrap',ssl:false});
    await contender.connect();
    try {
      const pid = (await contender.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      await assert.rejects(insert(randomUUID(),4,'gap'),{code:'23514'});
      await admin.query('BEGIN');
      await insert(winner,3,'winner');
      const outcome = insert(randomUUID(),3,'contender',[],contender).then(() => 'accepted', error => error.code);
      await waitForBlockedWriter(pid);
      await admin.query('COMMIT');
      assert.equal(await outcome,'23505');
      const head = await admin.query('SELECT revision_id FROM pay_run_draft_revisions WHERE company_id=$1 AND run_id=$2 ORDER BY revision_number DESC LIMIT 1',[company,run]);
      assert.equal(head.rows[0].revision_id,winner);
      await insert(latest,4,'after-reload');
      await insert(otherCompanyRevision,1,'same-run-different-company',[],admin,other);
      assert.equal((await readDraftRevision(other,actor,otherCompanyRevision,true)).is_current_revision,true);
      await insert(otherRunRevision,1,'different-run',[],admin,company,randomUUID());
      assert.equal((await readDraftRevision(company,actor,otherRunRevision,true)).is_current_revision,true);
    } finally { await admin.query('ROLLBACK'); await contender.end(); }
    await admin.query("INSERT INTO company_users(id,company_id,user_id,role,is_active) VALUES ($1,$2,'revision-owner','owner',true)",[randomUUID(),company]);
    const app = express();
    const browserCookie = randomUUID();
    await admin.query("INSERT INTO company_users(id,company_id,user_id,role,is_active) VALUES ($1,$2,'browser-reviewer','payroll_approver',true)",[randomUUID(),company]);
    app.use('/api/companies',createCompaniesRouter((req,res,next) => {
      const identity = req.get('cookie') === 'revision_fixture='+browserCookie ? 'browser-reviewer' : req.get('x-test-actor');
      if (!identity) { res.sendStatus(401); return; }
      Object.assign(req,{userId:identity});
      next();
    }));
    const server = app.listen(0,'127.0.0.1');
    try {
      await new Promise<void>(resolve => server.once('listening',resolve));
      const origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
      const review = async (tenant:string,id:string,identity:string,method='GET',query='') => {
        const response = await fetch(origin+'/api/companies/'+tenant+'/payroll-run-revisions/'+id+query,{
          method,headers:{'x-test-actor':identity,'If-None-Match':'*'}});
        assert.equal(response.headers.get('cache-control'),'no-store');
        return response;
      };
      for (const identity of [actor,'revision-owner']) {
        const response = await review(company,second,identity);
        assert.equal(response.status,200);
        assert.equal(response.headers.get('etag'),null);
        const body = await response.json();
        assert.deepEqual(body,{...snapshot,revision_number:2,revision_id:second,rules_version:'synthetic-v2',
          is_current_revision:false,current_revision_id:latest,review_breakdown:{
            lines:[line,another].map(({employee_id,input_revision_id,...visible}) => visible),
            totals:{line_count:2,gross:'9007199255090993',net:'9007199254985974',deductions:{paye:'70100',employee_ni:'19616',student_loan:'0',postgraduate_loan:'10300',priority_order:'5000'},adjustments:{rounding:'-3'}}
          }});
        for (const id of [line.employee_id,line.input_revision_id,another.employee_id,another.input_revision_id])
          assert.ok(!JSON.stringify(body).includes(id));
      }
      for (const query of ['?history=all','?history=adjacent&extra=1','?history=adjacent&history=adjacent']) {
        assert.equal((await review(company,second,actor,'GET',query)).status,400);
      }
      assert.equal((await review(other,second,actor,'GET','?history=adjacent')).status,403);
      assert.equal((await review(company,second,'header-reader','GET','?history=adjacent')).status,403);
      const foreign = await review(other,second,actor);
      const missing = await review(company,randomUUID(),actor);
      assert.equal(foreign.status,403);
      assert.equal(missing.status,403);
      assert.deepEqual(await foreign.json(),await missing.json());
      assert.equal((await review(company,second,'header-reader')).status,403);
      assert.equal((await review(company,second,'')).status,401);
      assert.equal((await review(company,second,actor,'HEAD')).status,405);
      assert.equal((await review(company,second,actor,'GET','?role=owner')).status,400);
      const dir = mkdtempSync(path.join(path.dirname(socket),'revision-browser-'));
      try {
        const frontend = path.resolve('artifacts/ledgerly/src');
        const bundle = path.join(dir,'revision.js');
        execFileSync('pnpm',['--filter','@workspace/api-server','exec','esbuild',
          path.join(frontend,'features/payroll/payRecords/revisionBrowserAcceptance.jsx'),'--bundle','--platform=browser',
          '--format=iife','--jsx=automatic','--alias:@='+frontend,'--define:import.meta.env.BASE_URL="/"','--outfile='+bundle]);
        app.get('/revision-browser.js',(_req,res)=>res.type('js').send(readFileSync(bundle,'utf8')));
        app.get('/revision-browser',(_req,res)=>{
          res.cookie('revision_fixture',browserCookie,{httpOnly:true,sameSite:'strict'});
          res.type('html').send('<!doctype html><meta charset="utf-8"><div id="root"></div><script>window.revisionFixture='+
            JSON.stringify({company,revision:second,latest,lineIds:[line.line_id,another.line_id]})+'</script><script src="/revision-browser.js"></script>');
        });
        const {stdout} = await promisify(execFile)('chromium',['--headless','--no-first-run','--disable-gpu',
          '--disable-background-networking','--user-data-dir='+path.join(dir,'profile'),'--dump-dom',
          '--virtual-time-budget=15000',origin+'/revision-browser'],{timeout:45000,killSignal:'SIGKILL'});
        assert.match(stdout,/data-revision-review="passed"/);
        const audited = await admin.query("SELECT company_id,target_id FROM accounting_audit_events WHERE actor_id='browser-reviewer' AND capability='payroll.read'");
        assert.deepEqual(audited.rows.map(row=>row.target_id).sort(),[second,first,second,latest,winner].sort());
        assert.ok(audited.rows.every(row=>row.company_id===company));
      } finally { rmSync(dir,{recursive:true,force:true,maxRetries:6,retryDelay:100}); }
    } finally { await new Promise<void>(resolve => server.close(()=>resolve())); }
    const ownerReceipts = await admin.query("SELECT company_id,target_id FROM accounting_audit_events WHERE actor_id='revision-owner' AND capability='payroll.read'");
    assert.deepEqual(ownerReceipts.rows,[{company_id:company,target_id:second}]);
    const receipts = await admin.query("SELECT company_id,actor_id,target_id FROM accounting_audit_events WHERE actor_id=$1 AND capability='payroll.read'",[actor]);
    assert.equal(receipts.rowCount,10);
    assert.ok(receipts.rows.every(row => row.actor_id === actor && (row.company_id === company
      ? [first,second,otherRunRevision].includes(row.target_id) : row.company_id === other && row.target_id === otherCompanyRevision)));
  } finally { await admin.end(); await pool.end(); }
});
