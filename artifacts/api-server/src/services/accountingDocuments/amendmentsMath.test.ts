import test from 'node:test';
import assert from 'node:assert/strict';
import { money } from '../financialDrafts/contract';
import { amendmentContextHash, amendmentDelta, amendmentJournalLines, correctionLineSource } from './amendmentsMath';
import { correctionIntent } from './corrections';
import { amendmentSchema, amendmentHistory } from './amendments';
import { journalLines } from './documentJournal';
const id='a0000000-0000-4000-8000-000000000001';
function row(kind='sales_invoice', eligible=true, net='10000',vat='2000') {
  return {id,kind,party_id:id,revision:id,status:'posted',purchase_vat_eligible:eligible,posting_account_id:null,mapping_revision:id,
    posting_accounts:{receivables:'a',payables:'b',revenue:'c',expense:'d',output_vat:'e',input_vat:'f'},
    source:{contract:'w03.draft.v1',currency:'GBP',customer_id:id,invoice_number:'SYN',issue_date:'2026-10-01',due_date:'2026-10-01',payment_terms:0,reference:'',notes:'',price_basis:'including_vat',line_items:[{description:'Part',quantity:'1',unit_price:'120',tax_code:'STANDARD'}]},
    money:money([BigInt(net)],[vat]),tax_context:{source_fingerprint:'before',lines:[{rate:'20',treatment:'standard',entered_unit_price:'120',unit_net_price:'100',net_pence:net,vat_pence:vat}]}};
}
test('difference journals preserve double entry, per-line VAT identity and direction for sales and recoverable/nonrecoverable bills',()=>{
  for(const kind of ['sales_invoice','purchase_bill']) for(const eligible of [true,false]) for(const [net,vat] of [['9000','1800'],['11000','2200'],['0','0']]) {
    const before=row(kind,eligible),after=row(kind,eligible,net,vat),lines=amendmentJournalLines(before,after);
    assert.equal(lines.reduce((n,l)=>n+BigInt(l.debitMinor)-BigInt(l.creditMinor),0n),0n);
    const totals=(rows:any[])=>rows.reduce((m,l)=>{const k=JSON.stringify([l.accountId,l.sourceLineRef,l.taxCode,l.currencyCode]);m.set(k,(m.get(k)??0n)+BigInt(l.debitMinor)-BigInt(l.creditMinor));return m;},new Map());
    const original=totals(journalLines(before)),updated=totals([...journalLines(before),...lines]),expected=totals(journalLines(after));
    for(const key of new Set([...original.keys(),...expected.keys()])) assert.equal(updated.get(key)??0n,expected.get(key)??0n);
    assert.ok(lines.every(l=>BigInt(l.debitMinor)>=0n&&BigInt(l.creditMinor)>=0n));
    const delta=amendmentDelta(before.money,after.money);assert.equal(BigInt(delta.net_pence)+BigInt(delta.vat_pence),BigInt(delta.gross_pence));
    if(kind==='purchase_bill'&&!eligible) assert.ok(lines.every(l=>l.accountId!=='f'));
  }
});
test('decimal precision remains integer exact and a zero delta emits no journal legs',()=>{
  const before=row('sales_invoice',true,'999999999998','0'),after=row('sales_invoice',true,'999999999999','0');
  assert.equal(amendmentDelta(before.money,after.money).gross_pence,'1');
  assert.equal(amendmentJournalLines(before,after).reduce((n,l)=>n+BigInt(l.debitMinor),0n),1n);
  assert.deepEqual(amendmentJournalLines(before,before),[]);
});
test('frozen authority ignores only changed quantities/prices and derived tax amounts',()=>{
  const before=row(),after=structuredClone(before);after.source.line_items[0]!.unit_price='108';after.tax_context.lines[0]!.entered_unit_price='108';after.tax_context.lines[0]!.net_pence='9000';
  assert.equal(amendmentContextHash(before),amendmentContextHash(after));
  for(const mutate of [(r:any)=>r.source.line_items[0].tax_code='ZERO',(r:any)=>r.source.line_items[0].description='Other',(r:any)=>r.source.notes='Changed',(r:any)=>r.posting_accounts.revenue='other',(r:any)=>r.tax_context.lines[0].rate='5']) {const changed=structuredClone(after);mutate(changed);assert.notEqual(amendmentContextHash(before),amendmentContextHash(changed));}
});
test('line correction accepts only existing positions and exact decimal strings',()=>{
  const original=row();assert.equal(correctionLineSource(original,[{quantity:'0.5',unit_price:'108.1234'}]).line_items[0]!.description,'Part');
  for(const lines of [[],[{quantity:1,unit_price:'108'}],[{quantity:'0',unit_price:'108'}],[{quantity:'1',unit_price:'1e2'}],[{quantity:'1',unit_price:'108',tax_code:'ZERO'}]]) assert.throws(()=>correctionLineSource(original,lines));
});
test('request contract rejects injected fields, invalid dates and missing reasons',()=>{
  const intent={request_id:id,reason:' Price correction ',effective_date:'2026-10-22',line_items:[{quantity:'1',unit_price:'108'}]};
  assert.equal(correctionIntent(intent).reason,'Price correction');
  for(const patch of [{reason:''},{effective_date:'2026-02-30'},{effective_date:'1800-01-01'},{line_items:[]},{actor_id:'other'},{line_items:[{quantity:'1',unit_price:'108',vat_pence:'0'}]}]) assert.throws(()=>correctionIntent({...intent,...patch}));
});
test('schema absence preserves originals; partial schema and detached amendment heads fail closed',async()=>{
  for(const state of [{amendments:null,heads:'heads'},{amendments:'amendments',heads:null}]) await assert.rejects(()=>amendmentSchema({query:async()=>({rows:[state]})} as any),(e:any)=>e.code==='CORRECTION_SCHEMA_INCOMPLETE');
  assert.equal(await amendmentSchema({query:async()=>({rows:[{amendments:null,heads:null}]})} as any),false);
  const original=row();const absent=await amendmentHistory({query:async()=>({rows:[{amendments:null,heads:null}]})} as any,id,original);assert.equal(absent.available,false);assert.equal(absent.current,original);
  await assert.rejects(()=>amendmentHistory({query:async(sql:string)=>({rows:sql.includes('to_regclass')?[{amendments:'a',heads:'h'}]:sql.includes('FROM accounting_document_amendment_heads')?[{sequence:1,current_revision:id}]:[]})} as any,id,original),(e:any)=>e.code==='CORRECTION_HISTORY_INVALID');
});
