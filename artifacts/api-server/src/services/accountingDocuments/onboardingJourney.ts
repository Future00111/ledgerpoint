import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';

type Reply={status:number,data?:any,error?:any};
type Scoped=(company:string,path:string,method?:string,body?:unknown,revision?:string,user?:string|null)=>Promise<Reply>;
type Root=(path:string,method:string,body?:unknown,user?:string|null)=>Promise<Reply>;
type Dependencies={scoped:Scoped,root:Root,addRule:(company:string,rule:Record<string,unknown>,actor:string)=>Promise<unknown>};

/** Registered only by the identity-guarded disposable runner. No bootstrap writes. */
export function registerEmptyCompanyJourney({scoped,root,addRule}:Dependencies) {
  for(const vat of [true,false]) test(`empty company native first journey: ${vat?'Standard VAT':'non-VAT'}`,async()=>{
    const owner='synthetic-accounting-owner',reader='synthetic-onboarding-reader';
    const {deriveReadiness,availableTaxRules}=await import(pathToFileURL(path.resolve(
      'artifacts/ledgerly/src/features/onboarding/model.mjs')).href);
    const created=await root('/onboarding-companies','POST',{
      name:`Synthetic EMPTY onboarding ${vat?'VAT':'NO VAT'} ${randomUUID()}`,
      country:'GB',base_currency:'GBP',vat_registered:vat,vat_scheme:'standard',vat_accounting_basis:'invoice',
    });
    assert.equal(created.status,201,JSON.stringify(created));
    const company=created.data.id;
    const context=async(kind:string)=>{
      const r=await scoped(company,`/accounting-documents/context?kind=${kind}`);
      assert.equal(r.status,200,JSON.stringify(r));return r.data;
    };
    const readiness=async()=>deriveReadiness(company,{
      sales:await context('sales_invoice'),purchases:await context('purchase_bill'),
    },'2026-10-21');
    const empty=await context('sales_invoice');
    for(const key of ['accounts','parties','tax_rules','periods']) assert.deepEqual(empty[key],[]);
    assert.equal((await readiness()).sales.canCreateDraft,false);
    const listed=await root('/onboarding-companies','GET');
    assert.equal(listed.data.roles[company],'owner');
    // Membership is added by the real owner-only route, with a synthetic identity lookup.
    assert.equal((await root(`/onboarding-companies/${company}/members`,'POST',{user_id:reader,role:'read_only'})).status,201);
    assert.equal((await scoped(company,'/accounting-accounts','POST',
      {code:'DENIED',name:'Must not exist',account_type:'asset'},undefined,reader)).status,403);
    assert.equal((await scoped(company,'/accounting-documents/context?kind=sales_invoice','GET',
      undefined,undefined,'synthetic-nonmember')).status,404);
    assert.equal((await root('/onboarding-companies','POST',{name:'Denied'},null)).status,401);
    const mappings:Record<string,string>={},paymentMappings:Record<string,string>={};
    const roles=[['receivables','asset'],['payables','liability'],['revenue','income'],['expense','expense'],
      ...(vat?[['output_vat','liability'],['input_vat','asset']]:[]),
      ['bank','asset'],['customer_credit','liability'],['supplier_prepayment','asset']];
    for(const [role,type] of roles) {
      const saved=await scoped(company,'/accounting-accounts','POST',{code:role,name:`Explicit ${role}`,account_type:type});
      assert.equal(saved.status,201,JSON.stringify(saved));
      (['bank','customer_credit','supplier_prepayment'].includes(role!)?paymentMappings:mappings)[role!]=saved.data.id;
    }
    assert.equal((await scoped(company,'/accounting-configuration','PUT',{
      revision:null,business_accounting_basis:'accrual',mappings,
    })).status,200);
    assert.equal((await scoped(company,'/accounting-periods','POST',{
      start_date:'2026-01-01',end_date:'2026-12-31',financial_year_label:'Synthetic 2026',
    })).status,201);
    const code=vat?'EXPLICIT_STANDARD':'EXPLICIT_NO_VAT';
    // Same native service used by the VAT settings route; no direct SQL/seed inserts.
    // Its HTTP authorization layer is not exercised by this service call.
    await addRule(company,{code,label:vat?'Explicit standard VAT':'Not VAT registered',
      rate:vat?'20':'0',treatment:vat?'standard':'no_vat',effective_from:'2026-01-01'},owner);
    let tax=(await context('sales_invoice')).tax_rules;
    assert.deepEqual(availableTaxRules(tax,vat,'2025-12-31'),[]);
    assert.deepEqual(availableTaxRules(tax,vat,'2026-10-21').map((r:any)=>r.code),[code]);
    // Future and unsupported treatments must not be presented as usable choices.
    await addRule(company,{code:'FUTURE',label:'Future rule',rate:vat?'20':'0',
      treatment:vat?'standard':'no_vat',effective_from:'2027-01-01'},owner);
    tax=(await context('sales_invoice')).tax_rules;
    assert.deepEqual(availableTaxRules(tax,vat,'2026-10-21').map((r:any)=>r.code),[code]);
    const parties:Record<string,string>={};
    for(const entity of ['Customer','Supplier']) {
      const saved=await root(`/onboarding-entities/${entity}?company_id=${company}`,'POST',{
        company_id:company,name:`Synthetic first ${entity}`,status:'active',
      });
      assert.equal(saved.status,201,JSON.stringify(saved));parties[entity]=saved.data.id;
      assert.equal((await root(`/onboarding-entities/${entity}?company_id=${company}`,'POST',{
        company_id:company,name:'Denied write',status:'active',
      },reader)).status,403);
    }
    assert.equal((await readiness()).sales.canCreateDraft,true);
    assert.equal((await readiness()).purchases.canCreateDraft,true);
    const docs:any[]=[];
    for(const kind of ['sales_invoice','purchase_bill']) {
      const body={kind,purchase_vat_eligible:vat&&kind==='purchase_bill',source:{
        contract:'w03.draft.v1',currency:'GBP',price_basis:'including_vat',
        customer_id:parties[kind==='sales_invoice'?'Customer':'Supplier'],
        invoice_number:`EMPTY-${kind}`,issue_date:'2026-10-21',due_date:'2026-11-20',payment_terms:30,
        reference:'Explicit first document',notes:'Synthetic only',
        line_items:[{description:'Ordinary supply',quantity:'1',unit_price:kind==='sales_invoice'?'120':'60',tax_code:code}],
      }};
      const wrongDate=await scoped(company,'/accounting-documents','POST',{
        ...body,source:{...body.source,issue_date:'2025-12-31'},
      });
      assert.equal(wrongDate.status,422,JSON.stringify(wrongDate));
      const saved=await scoped(company,'/accounting-documents','POST',body);
      assert.equal(saved.status,201,JSON.stringify(saved));assert.equal(saved.data.status,'draft');
      assert.equal(saved.data.journal_id,null);
      const reopened=await scoped(company,`/accounting-documents/${saved.data.id}`);
      assert.equal(reopened.data.source.due_date,'2026-11-20');
      assert.equal(reopened.data.source.line_items[0].tax_code,code);
      docs.push(reopened.data);
    }
    const report=async()=>{
      const r=await scoped(company,'/accounting-reports?from=2026-01-01&to=2026-12-31');
      assert.equal(r.status,200,JSON.stringify(r));return r.data;
    };
    assert.equal((await report()).general_ledger.length,0);
    assert.equal((await report()).open_items.length,0);
    for(const doc of docs) {
      assert.equal((await scoped(company,`/accounting-documents/${doc.id}/post`,'POST',{},doc.revision,reader)).status,403);
      const posted=await scoped(company,`/accounting-documents/${doc.id}/post`,'POST',{},doc.revision);
      assert.equal(posted.status,200,JSON.stringify(posted));
      const reloaded=await scoped(company,`/accounting-documents/${doc.id}`);
      assert.equal(reloaded.data.status,'posted');
      const journal=await scoped(company,`/accounting-journals/${reloaded.data.journal_id}`);
      assert.equal(journal.data.entry.source_id,doc.id);
      assert.equal(journal.data.entry.total_debit_minor,doc.kind==='sales_invoice'?'12000':'6000');
      assert.equal(journal.data.entry.total_debit_minor,journal.data.entry.total_credit_minor);
      assert.equal((await scoped(company,`/accounting-documents/${doc.id}`,'PATCH',{
        source:{contract:'w03.draft.v1',notes:'Must not edit posted'},
      },doc.revision)).status,409);
    }
    const posted=await report();
    assert.equal(posted.pnl.revenue_minor,vat?'10000':'12000');
    assert.equal(posted.pnl.expense_minor,vat?'5000':'6000');
    const intents=docs.map(doc=>({id:randomUUID(),kind:'payment',
      party_type:doc.kind==='sales_invoice'?'customer':'supplier',party_id:doc.party_id,payment_id:null,
      date:'2026-10-21',reference:'Actually received/paid synthetic money',
      amount_minor:doc.kind==='sales_invoice'?'12000':'6000',
      allocations:[{document_id:doc.id,amount_minor:doc.kind==='sales_invoice'?'12000':'6000'}]}));
    // Document setup must not silently fabricate payment configuration.
    assert.equal((await scoped(company,'/accounting-payments/context')).data.configuration,null);
    const unconfigured=await scoped(company,'/accounting-payments/review','POST',intents[0]);
    assert.equal(unconfigured.status,422);
    assert.equal(unconfigured.error.code,'PAYMENT_SETUP_REQUIRED');
    assert.equal((await scoped(company,'/accounting-payments/configuration','PUT',{
      revision:null,mappings:paymentMappings,
    })).status,200);
    for(const intent of intents) {
      const review=await scoped(company,'/accounting-payments/review','POST',intent);
      assert.equal(review.status,200,JSON.stringify(review));
      const body={...intent,review_token:review.data.review_token};
      const saved=await scoped(company,'/accounting-payments','POST',body);
      assert.equal(saved.status,200,JSON.stringify(saved));
      assert.equal((await scoped(company,'/accounting-payments','POST',body)).data.status,'duplicate');
      const recovered=await scoped(company,`/accounting-payments/operations/${intent.id}`);
      assert.equal(recovered.status,200);assert.equal(recovered.data.status,'recorded');
    }
    const settled=await report();
    assert.deepEqual(settled.journal_movements,{debit_minor:'36000',credit_minor:'36000'});
    assert.equal(settled.general_ledger.length,vat?10:8);
    assert.equal(settled.open_items.every((d:any)=>d.open_minor==='0'),true);
    assert.equal(settled.balance_sheet.balanced,true);
    assert.equal(settled.pnl.profit_minor,vat?'5000':'6000');
    if(vat) assert.deepEqual([settled.vat.box1_pence,settled.vat.box4_pence,settled.vat.box5_pence],['2000','1000','1000']);
    else assert.equal(settled.vat.applicable,false);
    // Read-only reopening returns the same reports, with no write authority added.
    assert.deepEqual((await scoped(company,'/accounting-reports?from=2026-01-01&to=2026-12-31',
      'GET',undefined,undefined,reader)).data,settled);
  });
}
