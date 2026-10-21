import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { pool } from '../../lib/db/src/index';
import { saveConfiguration, addPeriod } from '../../artifacts/api-server/src/services/accountingDocuments/configuration';
import { savePaymentConfiguration } from '../../artifacts/api-server/src/services/accountingDocuments/payments';
import { saveDocument } from '../../artifacts/api-server/src/services/accountingDocuments/documents';
import { postDocument } from '../../artifacts/api-server/src/services/accountingDocuments/posting';
const name='Synthetic Credits — TEST DATA, not business records';
const admin=new pg.Client({host:'/tmp/ledgerly-w03-invoice-demo/socket',port:55440,database:'ledgerly_w03_invoice_demo',user:'w03_bootstrap',password:'',ssl:false,options:''});
async function main() { try {
  await admin.connect();
  const i=(await admin.query('SELECT current_database() db,current_user role,inet_server_addr() addr')).rows[0];
  if(i.db!=='ledgerly_w03_invoice_demo'||i.role!=='w03_bootstrap'||i.addr!==null) throw Error('Wrong isolated database');
  const runtime=(await pool.query('SELECT current_database() db,current_user role,inet_server_addr() addr')).rows[0];
  if(runtime.db!==i.db||runtime.role!=='ledgerly_api'||runtime.addr!==null) throw Error('Wrong runtime database');
  if((await admin.query('SELECT 1 FROM companies WHERE name=$1',[name])).rowCount) throw Error('Credit sample already exists; never reset it');
  const sourceInvoice=process.argv[2];
  if(!sourceInvoice||!/^[0-9a-f-]{36}$/i.test(sourceInvoice)) throw Error('Pass an existing invoice ID from the intended synthetic company');
  const owner=(await admin.query(`SELECT u.user_id FROM company_users u JOIN companies c ON c.id=u.company_id
    WHERE c.name='Synthetic Accounting Flow — TEST DATA, not business records' AND u.is_active=true AND u.role='owner'
      AND EXISTS(SELECT 1 FROM accounting_document_sources d WHERE d.company_id=c.id AND d.id=$1 AND d.kind='sales_invoice')`,[sourceInvoice])).rows;
  if(owner.length!==1) throw Error('Expected one existing synthetic company owner');
  const actor=owner[0].user_id,company=randomUUID(),customer=randomUUID(),supplier=randomUUID();
  const mappings:Record<string,string>={},paymentMappings:Record<string,string>={};
  await admin.query('BEGIN');
  await admin.query(`INSERT INTO companies(id,name,country,base_currency,vat_registered,vat_scheme,vat_accounting_basis,status)
    VALUES($1,$2,'GB','GBP',true,'standard','invoice','active')`,[company,name]);
  await admin.query("INSERT INTO company_users(id,company_id,user_id,role,is_active) VALUES($1,$2,$3,'owner',true)",[randomUUID(),company,actor]);
  await admin.query("INSERT INTO customers(id,company_id,name,status,payment_terms) VALUES($1,$2,'Credit Demo Customer','active',30)",[customer,company]);
  await admin.query("INSERT INTO suppliers(id,company_id,name,status,payment_terms) VALUES($1,$2,'Credit Demo Supplier','active',30)",[supplier,company]);
  for(const [role,type,code,label] of [
    ['receivables','asset','1100','Trade receivables'],['payables','liability','2100','Trade payables'],
    ['revenue','income','4000','Sales revenue'],['expense','expense','5000','Purchase costs'],
    ['output_vat','liability','2200','Output VAT'],['input_vat','asset','1200','Input VAT'],
    ['bank','asset','1000','Sample current account'],['customer_credit','liability','2300','Unapplied customer credits'],
    ['supplier_prepayment','asset','1300','Supplier prepayments']]) {
    const id=randomUUID();(['bank','customer_credit','supplier_prepayment'].includes(role!)?paymentMappings:mappings)[role!]=id;
    await admin.query('INSERT INTO chart_of_accounts(id,company_id,code,name,account_type,is_active) VALUES($1,$2,$3,$4,$5,true)',[id,company,code,label,type]);
  }
  await admin.query("INSERT INTO vat_tax_rules(id,company_id,code,label,rate,treatment,effective_from,is_active) VALUES($1,$2,'STANDARD_20','Standard VAT',20,'standard','2011-01-04',true)",[randomUUID(),company]);
  await admin.query('COMMIT');
  await saveConfiguration(company,actor,{revision:null,mappings,business_accounting_basis:'accrual'});
  await savePaymentConfiguration(company,actor,{revision:null,mappings:paymentMappings});
  await addPeriod(company,actor,{start_date:'2026-01-01',end_date:'2026-12-31',financial_year_label:'Year ending 2026'});
  for(const [kind,party,number,price] of [['sales_invoice',customer,'CREDIT-DEMO-INV-001','60'],['purchase_bill',supplier,'CREDIT-DEMO-BILL-001','60']]) {
    const d=await saveDocument(company,actor,{kind,purchase_vat_eligible:kind==='purchase_bill',source:{contract:'w03.draft.v1',currency:'GBP',price_basis:'including_vat',customer_id:party,
      invoice_number:number,issue_date:'2026-10-21',due_date:'2026-11-20',payment_terms:30,reference:'TEST DATA',notes:'Separate partial credit walkthrough. No real bank transfer.',
      line_items:[{description:'Synthetic credit example',quantity:'1',unit_price:price,tax_code:'STANDARD_20'}]}});
    await postDocument(company,actor,d.id,d.revision);
    const credit=await saveDocument(company,actor,{kind:kind==='sales_invoice'?'sales_credit_note':'supplier_credit_note',
      original_id:d.id,reason:'Synthetic £10 agreed price reduction',adjustment_method:'offset_outstanding',
      effective_adjustment_date:'2026-10-21',original_line_refs:[0],
      source:{...d.source,invoice_number:number+'-CR10',line_items:[{...d.source.line_items[0],unit_price:'10'}]}});
    await postDocument(company,actor,credit.id,credit.revision);
  }
  console.log(JSON.stringify({company,name,customer,supplier,posted_documents:4,payments:0,each_original_gbp:60,each_credit_gbp:10,each_remaining_gbp:50}));
} finally {await admin.end();await pool.end();} }
main().catch(error => { console.error(error); process.exitCode=1; });
