import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { pool } from '../../lib/db/src/index';
import { saveConfiguration, addPeriod } from '../../artifacts/api-server/src/services/accountingDocuments/configuration';
import { savePaymentConfiguration, previewPayment, postPayment } from '../../artifacts/api-server/src/services/accountingDocuments/payments';
import { saveDocument } from '../../artifacts/api-server/src/services/accountingDocuments/documents';
import { postDocument } from '../../artifacts/api-server/src/services/accountingDocuments/posting';
const name='Willow & Co — DEMO (synthetic)';
const admin=new pg.Client({host:'/tmp/ledgerly-w03-invoice-demo/socket',port:55440,database:'ledgerly_w03_invoice_demo',user:'w03_bootstrap',password:'',ssl:false,options:''});
async function main() { try {
  await admin.connect();
  const i=(await admin.query('SELECT current_database() db,current_user role,inet_server_addr() addr')).rows[0];
  if(i.db!=='ledgerly_w03_invoice_demo'||i.role!=='w03_bootstrap'||i.addr!==null) throw Error('Wrong isolated database');
  const runtime=(await pool.query('SELECT current_database() db,current_user role,inet_server_addr() addr')).rows[0];
  if(runtime.db!==i.db||runtime.role!=='ledgerly_api'||runtime.addr!==null) throw Error('Wrong runtime database');
  if((await admin.query('SELECT 1 FROM companies WHERE name=$1',[name])).rowCount) throw Error('Workspace sample already exists; never reset it');
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
  await admin.query("INSERT INTO customers(id,company_id,name,status,payment_terms) VALUES($1,$2,'Cedar Studio (sample)','active',30)",[customer,company]);
  await admin.query("INSERT INTO suppliers(id,company_id,name,status,payment_terms) VALUES($1,$2,'Paper & Press (sample)','active',30)",[supplier,company]);
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
  await addPeriod(company,actor,{start_date:`${new Date().getUTCFullYear()-1}-01-01`,end_date:`${new Date().getUTCFullYear()}-12-31`,financial_year_label:'Synthetic demonstration period'});
  const shift=(days:number)=>{const d=new Date();d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
  const date=shift(0);
  const source=(party:string,number:string,price:string,description:string,days=-2,due=28)=>({
    contract:'w03.draft.v1',currency:'GBP',price_basis:'including_vat',customer_id:party,
    invoice_number:number,issue_date:shift(days),due_date:shift(due),payment_terms:30,reference:'DEMO · sample records',
    notes:'Synthetic demonstration only. No invoice sent and no real money moved.',
    line_items:[{description,quantity:'1',unit_price:price,tax_code:'STANDARD_20'}],
  });
  const ids:Record<string,string>={};
  const make=async(kind:string,party:string,number:string,price:string,description:string,posted:boolean,days=-2,due=28)=>{
    const d=await saveDocument(company,actor,{kind,purchase_vat_eligible:kind==='purchase_bill',source:source(party,number,price,description,days,due)});
    if(posted) await postDocument(company,actor,d.id,d.revision);
    ids[number]=d.id;return d;
  };
  const customer2=randomUUID(),supplier2=randomUUID();
  await admin.query("INSERT INTO customers(id,company_id,name,status,payment_terms) VALUES($1,$2,'Northfield Services (sample)','active',30)",[customer2,company]);
  await admin.query("INSERT INTO suppliers(id,company_id,name,status,payment_terms) VALUES($1,$2,'Workshop Supplies (sample)','active',30)",[supplier2,company]);
  await make('sales_invoice',customer,'INV-001','1260','Website design — October',true,-20,-6);
  const partial=await make('sales_invoice',customer2,'INV-002','60','Monthly support',true);
  const paid=await make('sales_invoice',customer,'INV-003','480','Brand consultation',true);
  await make('sales_invoice',customer2,'INV-004','840','Project planning',false);
  await make('sales_invoice',customer,'INV-005','240','Design revisions',false);
  const bill=await make('purchase_bill',supplier,'BILL-001','360','Printed marketing materials',true,-15,15);
  await make('purchase_bill',supplier2,'BILL-002','144','Office supplies',true,-20,-4);
  await make('purchase_bill',supplier,'BILL-003','96','Packaging materials',false);
  for(const [original,kind,number,price] of [[partial,'sales_credit_note','CN-001','10'],[bill,'supplier_credit_note','SC-001','60']] as const) {
    const c=await saveDocument(company,actor,{kind,original_id:original.id,reason:'Agreed partial price reduction — synthetic example',adjustment_method:'offset_outstanding',effective_adjustment_date:date,original_line_refs:[0],
      source:{...original.source,invoice_number:number,issue_date:date,line_items:[{...original.source.line_items[0],unit_price:price}]}});
    await postDocument(company,actor,c.id,c.revision);ids[number]=c.id;
  }
  const payment={id:randomUUID(),kind:'payment',party_type:'customer',party_id:customer,payment_id:null,date,reference:'DEMO payment — no real bank transfer',amount_minor:'48000',allocations:[{document_id:paid.id,amount_minor:'48000'}]};
  const reviewed=await previewPayment(company,actor,payment);
  await postPayment(company,actor,{...payment,review_token:reviewed.review_token});
  console.log(JSON.stringify({company,name,documents:ids,syntheticOnly:true,posted_documents:7,drafts:3,payments:1}));

} finally {await admin.end();await pool.end();} }
main().catch(error => { console.error(error); process.exitCode=1; });
