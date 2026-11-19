/** Runs only after the existing populated disposable pg_restore. */
import test from 'node:test';import assert from 'node:assert/strict';import{realpathSync}from'node:fs';
import{pool}from'@workspace/db';import{recoverCorrection,discoverCorrections}from'../accountingDocuments/corrections';
const socket=process.env.ACCOUNTING_FLOW_TEST_SOCKET??'';
if(!/^\/tmp\/ledgerly-accounting-flow-tests-[A-Za-z0-9]{6}\/socket$/.test(socket)||realpathSync(socket)!==socket||process.env.NODE_ENV!=='test'||process.env.DATABASE_URL!==`postgresql://ledgerly_api@localhost/ledgerly_accounting_flow_restore_test?host=${encodeURIComponent(socket)}&port=55441`)throw Error('Disposable correction restore socket required');
test.after(()=>pool.end());
test('restored correction admissions retain native pending, terminal and canonical outcomes with immutable runtime history',async()=>{
 assert.deepEqual((await pool.query('SELECT current_database() db,current_user actor,inet_server_addr() addr')).rows[0],{db:'ledgerly_accounting_flow_restore_test',actor:'ledgerly_api',addr:null});
 const rows=(await pool.query("SELECT * FROM correction_attempt_admissions WHERE reason LIKE 'Restore correction %' ORDER BY request_id")).rows;assert.equal(rows.length,3);
 const states=new Set();for(const row of rows){const found=await recoverCorrection(row.company_id,row.actor_id,row.document_id,row.request_id);assert.equal(found.state,row.reason.replace('Restore correction ',''));states.add(found.state);const listed=await discoverCorrections(row.company_id,row.actor_id,row.document_id);assert.ok([...listed.receipts,...(listed.pending??[])].some(r=>r.request_id===row.request_id));}
 assert.deepEqual([...states].sort(),['known','no_effect','pending']);
 for(const table of ['correction_attempt_admissions','correction_attempt_no_effect'])for(const sql of [`UPDATE ${table} SET actor_id=actor_id`,`DELETE FROM ${table}`,`TRUNCATE ${table}`])await assert.rejects(()=>pool.query(sql),(e:any)=>e.code==='42501');
 const guards=await pool.query("SELECT count(*)::int n FROM pg_trigger WHERE tgenabled='A' AND tgname IN ('correction_attempt_admission_immutable','correction_attempt_admission_no_truncate','correction_attempt_terminal_immutable','correction_attempt_terminal_no_truncate')");assert.equal(guards.rows[0].n,4);
 console.log('CORRECTION_RECOVERY_RESTORE_ACCEPTANCE',JSON.stringify({states:[...states].sort(),nativeRuntime:true,immutable:true}));
});
