// Run only against the fresh, pre-upgrade source in the disposable migration suite.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {realpathSync} from 'node:fs';
import pg from 'pg';
import {pool} from '../../../lib/db/src/index.ts';
import {saveConfiguration,addPeriod} from '../../../artifacts/api-server/src/services/accountingDocuments/configuration.ts';
import {saveDocument} from '../../../artifacts/api-server/src/services/accountingDocuments/documents.ts';
import {captureConditionalEvidence,observeConditionalOriginal} from '../../../artifacts/api-server/src/services/accountingDocuments/conditionalDiscount.ts';
import {postConditionalOriginal} from '../../../artifacts/api-server/src/services/accountingDocuments/posting.ts';

async function seed() {
  const socket = process.env.ACCOUNTING_FLOW_TEST_SOCKET;
  assert.match(socket,/^\/tmp\/ledgerly-accounting-flow-tests-[A-Za-z0-9]{6}\/socket$/);
  assert.equal(realpathSync(socket),socket);
  const database = 'ledgerly_upgrade_source_test';
  const admin = new pg.Client({host:socket,port:55441,user:'w03_bootstrap',database,ssl:false});
  await admin.connect();
  try {
    assert.deepEqual((await admin.query("SELECT current_database() db, current_user actor, inet_server_addr() addr,current_setting('data_directory') dir")).rows[0],
      {db:database,actor:'w03_bootstrap',addr:null,dir:path.join(path.dirname(socket),'data')});
    assert.deepEqual((await pool.query('SELECT current_database() db,current_user actor,inet_server_addr() addr')).rows[0],
      {db:database,actor:'ledgerly_api',addr:null});
    const company='00000000-0000-4000-8000-000000000001', actor='upgrade-owner', customer=randomUUID();
    await admin.query("UPDATE companies SET country='GB',base_currency='GBP',vat_registered=false,vat_scheme='standard',vat_accounting_basis='invoice',status='active' WHERE id=$1",[company]);
    await admin.query("INSERT INTO company_users(id,company_id,user_id,role,is_active) VALUES($1,$2,$3,'owner',true)",[randomUUID(),company,actor]);
    await admin.query("INSERT INTO customers(id,company_id,name,status) VALUES($1,$2,'Synthetic upgrade customer','active')",[customer,company]);
    const mappings={};
    for (const [role,type] of [['receivables','asset'],['payables','liability'],['revenue','income'],['expense','expense'],['output_vat','liability'],['input_vat','asset']]) {
      mappings[role]=randomUUID();
      await admin.query('INSERT INTO chart_of_accounts(id,company_id,code,name,account_type,is_active) VALUES($1,$2,$3,$3,$4,true)',[mappings[role],company,role,type]);
    }
    await saveConfiguration(company,actor,{revision:null,mappings,business_accounting_basis:'accrual'});
    await addPeriod(company,actor,{start_date:'2026-01-01',end_date:'2026-12-31',financial_year_label:'Synthetic 2026'});
    await admin.query("INSERT INTO vat_tax_rules(id,company_id,code,label,rate,treatment,effective_from,is_active) VALUES($1,$2,'NONE','Synthetic no VAT',0,'no_vat','2000-01-01',true)",[randomUUID(),company]);
    const terms={version:1,party_type:'customer',party_id:customer,currency:'GBP',agreement_id:randomUUID(),
      agreement_date:'2026-11-01',payment_deadline:'2026-11-30',discount_gross_pence:'1200'};
    const evidence=await captureConditionalEvidence(company,actor,{request_id:randomUUID(),terms,evidence_text:'Synthetic upgrade agreement',attested:true});
    const draft=await saveDocument(company,actor,{kind:'sales_invoice',source:{contract:'w03.draft.v1',currency:'GBP',
      customer_id:customer,invoice_number:'UPGRADE-001',issue_date:'2026-11-01',due_date:'2026-11-30',payment_terms:29,
      reference:'',notes:'',conditional_discount:{...terms,evidence_receipt_id:evidence.id},
      line_items:[{description:'Synthetic service',quantity:'1',unit_price:'120',tax_code:'NONE'}]}});
    await postConditionalOriginal(company,actor,draft.id,draft.revision);
    await observeConditionalOriginal(company,actor,draft.id);
  } finally { await admin.end(); await pool.end(); }
}
seed().catch(error=>{console.error(error);process.exitCode=1;});
