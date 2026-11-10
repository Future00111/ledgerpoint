import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_PENCE, parseInvoice, draftSourceFingerprint, netPence, money } from './contract';
import { allocateDiscount, creditFromGross, discountAmount, discountedAmounts, proratedDiscountedCredit, type Discount } from './discounts';
import { calculateReturnLine, calculateTaxLine, createProductionInvoiceDraftAuthority } from './productionAuthority';
import { InvoiceDraftService } from './invoiceService';

const company = '11111111-1111-4111-8111-111111111111';
const originalRevision = '22222222-2222-4222-8222-222222222222';
const source = (basis: 'excluding_vat' | 'including_vat' = 'excluding_vat') => ({
  contract: 'w03.draft.v1', currency: 'GBP', customer_id: company, invoice_number: 'SYNTH-DISCOUNT',
  issue_date: '2026-10-30', due_date: '2026-11-29', payment_terms: 30, price_basis: basis,
  line_items: ['STANDARD','REDUCED','ZERO'].map(tax_code => ({description:tax_code,quantity:'1',unit_price:'100',tax_code})),
});
const rates: Record<string, [string,string]> = {STANDARD:['20','standard'],REDUCED:['5','reduced'],ZERO:['0','zero']};
function fixture() {
  const writes: string[] = [];
  const tx = { release() {}, async query(sql: string, values: any[] = []) {
    if (sql.startsWith('SELECT role')) return {rowCount:1,rows:[{role:'owner',is_active:true}]};
    if (sql.includes('FROM companies')) return {rowCount:1,rows:[{id:company,country:'GB',base_currency:'GBP',vat_registered:true,vat_scheme:'standard',vat_accounting_basis:'invoice'}]};
    if (sql.includes('FROM customers')) return {rowCount:1,rows:[{id:company,name:'Synthetic customer'}]};
    if (sql.includes('FROM vat_tax_rules')) { const [rate,treatment]=rates[values[1]]!;
      return {rowCount:1,rows:[{id:'rule-'+values[1],code:values[1],label:values[1],rate,treatment,effective_from:'2026-01-01',effective_to:null}]}; }
    if (/^(INSERT|UPDATE)/.test(sql)) writes.push(sql);
    return {rowCount:0,rows:[]};
  }};
  return {tx,writes};
}

test('discount parser preserves absent legacy fields, canonical fingerprints and explicit removal', () => {
  const legacy=parseInvoice(source());
  assert.equal(Object.hasOwn(legacy,'discount'),false);
  assert.equal(Object.hasOwn(legacy,'discount_adjustment'),false);
  assert.equal(draftSourceFingerprint(legacy),draftSourceFingerprint(parseInvoice({...source(),discount:null,discount_adjustment:null})));
  const discounted=parseInvoice({...source(),discount:{type:'percentage',value:'12.3456'}});
  assert.notEqual(draftSourceFingerprint(discounted),draftSourceFingerprint(legacy));
  assert.equal(parseInvoice({contract:'w03.draft.v1',notes:'Other edit'},discounted).discount?.value,'12.3456');
  assert.deepEqual(parseInvoice({contract:'w03.draft.v1',discount:null},discounted),legacy);
  const adjustment=parseInvoice({...source(),discount_adjustment:{type:'amount',value:'30.00',original_revision:originalRevision}});
  assert.equal(adjustment.discount_adjustment?.original_revision,originalRevision);
});

test('discount input rejects hidden fields, invalid decimals, zero, over 100%, precision and conflicting intents', () => {
  for (const discount of [
    {type:'percentage',value:'100.0001'},{type:'percentage',value:'0'}, {type:'percentage',value:'1.00001'},
    {type:'amount',value:'0.001'},{type:'amount',value:'10000000000.00'}, {type:'amount',value:'-1'},
    {type:'amount',value:'01'}, {type:'amount',value:'1e2'}, {type:'amount',value:10},
    {type:'other',value:'10'},{type:['percentage'],value:'10'},{type:['amount'],value:'10'},
    {type:{toString:()=> 'percentage'},value:'10'},{type:'amount',value:'10',total:'9'}, [], true,
  ]) assert.throws(()=>parseInvoice({...source(),discount}));
  for (const type of [['percentage'], ['amount'], {toString:()=> 'percentage'}, null, true, 1]) {
    assert.throws(()=>parseInvoice({...source(),discount_adjustment:{type,value:'10',original_revision:originalRevision}}),/DISCOUNT_INVALID/);
  }
  assert.throws(()=>parseInvoice({...source(),discount:{type:'amount',value:'1'},discount_adjustment:{type:'amount',value:'1',original_revision:originalRevision}}),/DISCOUNT_CONFLICT/);
  assert.throws(()=>parseInvoice({...source(),discount_adjustment:{type:'amount',value:'1',original_revision:'stale'}}));
});

test('largest remainders allocate every penny deterministically, including ties and zero lines', () => {
  assert.deepEqual(allocateDiscount([1n,1n,1n],1n),[1n,0n,0n]);
  assert.deepEqual(allocateDiscount([1n,1n,1n],2n),[1n,1n,0n]);
  assert.deepEqual(allocateDiscount([0n,1n,2n],2n),[0n,1n,1n]);
  assert.deepEqual(allocateDiscount([0n,0n],0n),[0n,0n]);
  assert.throws(()=>allocateDiscount([1n,2n],4n),/DISCOUNT_EXCEEDS_TOTAL/);
  for (let a=0n;a<8n;a++) for(let b=0n;b<8n;b++) for(let c=0n;c<4n;c++) for(let value=0n;value<=a+b+c;value++) {
    const weights=[a,b,c],allocated=allocateDiscount(weights,value);
    assert.equal(allocated.reduce((n,v)=>n+v,0n),value);
    assert.ok(allocated.every((n,i)=>n>=0n && n<=weights[i]!));
  }
});

test('percentage precision and amounts remain exact up to the supported money ceiling', () => {
  assert.equal(discountAmount(MAX_PENCE,{type:'amount',value:'9999999999.99'}),MAX_PENCE);
  assert.equal(discountAmount(MAX_PENCE,{type:'percentage',value:'99.9999'}),999998999999n);
  assert.equal(discountAmount(3n,{type:'percentage',value:'33.3333'}),1n);
  assert.equal(discountAmount(1n,{type:'percentage',value:'50'}),1n);
  assert.throws(()=>discountAmount(100n,{type:'amount',value:'1.01'}),/DISCOUNT_EXCEEDS_TOTAL/);
  assert.throws(()=>discountedAmounts([MAX_PENCE,1n],{type:'percentage',value:'10'},'excluding_vat'),/MONEY_LIMIT/);
});

test('positive percentages rounding to zero cannot create no-op discounts or unpostable zero credits',()=>{
  assert.throws(()=>discountAmount(4n,{type:'percentage',value:'0.0001'}),/DISCOUNT_ROUNDS_TO_ZERO/);
  assert.throws(()=>discountAmount(0n,{type:'percentage',value:'100'}),/DISCOUNT_ROUNDS_TO_ZERO/);
  assert.throws(()=>discountedAmounts([3n,1n],{type:'percentage',value:'1'},'including_vat'),/DISCOUNT_ROUNDS_TO_ZERO/);
  assert.equal(discountAmount(4n,{type:'amount',value:'0.01'}),1n);
  assert.deepEqual(discountedAmounts([4n],{type:'percentage',value:'100'},'excluding_vat').amounts,[0n]);
});

for (const basis of ['excluding_vat','including_vat'] as const) for(const discount of [
  {type:'percentage',value:'10'}, {type:'amount',value:'30'}] as Discount[]) {
  test(`${basis} ${discount.type} discount is applied before authoritative mixed 20/5/0 VAT`, async()=>{
    const invoice=parseInvoice({...source(basis),discount}), {tx}=fixture();
    const tax=await createProductionInvoiceDraftAuthority().resolveTax(tx as never,company,invoice,netPence(invoice.line_items));
    const totals=money(tax.netPence.map(BigInt),tax.vatPence);
    assert.deepEqual([totals.net_pence,totals.vat_pence,totals.gross_pence],basis==='excluding_vat'?['27000','2250','29250']:['25071','1929','27000']);
    assert.equal(invoice.line_items[0]!.unit_price,'100');
    assert.deepEqual((tax.context.discount as any).lines.map((l:any)=>l.discount_pence),['1000','1000','1000']);
    assert.equal((tax.context.discount as any).amount_pence,'3000');
    assert.equal((tax.context.discount as any).price_basis,basis);
  });
}

test('no-discount production authority keeps legacy amounts and context free of discount fields',async()=>{
  const invoice=parseInvoice(source()), {tx}=fixture();
  const tax=await createProductionInvoiceDraftAuthority().resolveTax(tx as never,company,invoice,netPence(invoice.line_items));
  assert.deepEqual(tax.netPence,['10000','10000','10000']);assert.deepEqual(tax.vatPence,['2000','500','0']);
  assert.equal(Object.hasOwn(tax.context,'discount'),false);
  assert.ok((tax.context.lines as any[]).every(l=>!Object.hasOwn(l,'discount_pence')));
  const zero=parseInvoice({...source(),discount:{type:'percentage',value:'100'}});
  const all=await createProductionInvoiceDraftAuthority().resolveTax(tx as never,company,zero,netPence(zero.line_items));
  assert.deepEqual(all.netPence,['0','0','0']);assert.deepEqual(all.vatPence,['0','0','0']);
});

test('legacy financial-draft service accepts and persists authoritative discounted totals and audit',async()=>{
  const {tx,writes}=fixture(),service=new InvoiceDraftService({connect:async()=>tx} as never,createProductionInvoiceDraftAuthority());
  const result=await service.save(company,'synthetic-owner',{...source(),discount:{type:'percentage',value:'10'}});
  assert.equal(result.money.gross_pence,'29250');assert.equal(result.money.discount?.amount_pence,'3000');
  assert.equal(result.source.discount?.value,'10');
  assert.ok(writes.some(sql=>sql.includes('INSERT INTO w03_invoice_draft_audit')));
  assert.ok(writes.every(sql=>!sql.includes('canonical_journal')));
  await assert.rejects(service.save(company,'synthetic-owner',{...source(),discount_adjustment:{type:'amount',value:'10',original_revision:originalRevision}}),/DISCOUNT_ADJUSTMENT_REQUIRES_CREDIT/);
});

test('later gross credit retains original VAT pennies including exact full reductions',()=>{
  for(const rate of [2000n,500n,0n]) for(let base=0n;base<100n;base++) {
    const original=calculateTaxLine(base,rate,'excluding_vat','1');
    const money={net_pence:original.net.toString(),vat_pence:original.vat.toString(),gross_pence:(original.net+original.vat).toString()};
    assert.deepEqual(creditFromGross(BigInt(money.gross_pence),money,rate),{net:original.net,vat:original.vat});
    for(let amount=0n;amount<=BigInt(money.gross_pence);amount++) {
      const credit=creditFromGross(amount,money,rate);
      assert.equal(credit.net+credit.vat,amount);
      assert.ok(credit.net<=original.net && credit.vat<=original.vat && credit.net>=0n && credit.vat>=0n);
    }
  }
});

test('partial returns on discounted originals prorate stored net/VAT and never use pre-discount prices',()=>{
  const original={description:'Caliper',quantity:'2',unit_price:'100',tax_code:'STANDARD'};
  const amount={net_pence:'18000',vat_pence:'3600'};
  assert.deepEqual(proratedDiscountedCredit(original,original,amount),{net:18000n,vat:3600n});
  assert.deepEqual(proratedDiscountedCredit({...original,quantity:'1'},original,amount),{net:9000n,vat:1800n});
  assert.deepEqual(proratedDiscountedCredit({...original,quantity:'0.5',unit_price:'50'},original,amount),{net:2250n,vat:450n});
  assert.throws(()=>proratedDiscountedCredit({...original,quantity:'3'},original,amount),/CREDIT_ORIGINAL_MISMATCH/);
  assert.deepEqual(proratedDiscountedCredit({...original,unit_price:'0'},{...original,unit_price:'0'},{net_pence:'0',vat_pence:'0'}),{net:0n,vat:0n});
});

test('a zero-allocated discount line keeps its original partial-return VAT rounding',()=>{
  const discounted=discountedAmounts([100n,3n],{type:'amount',value:'0.01'},'excluding_vat');
  assert.deepEqual(discounted.summary!.lines.map(l=>l.discount_pence),['1','0']);
  const original={description:'Small item',quantity:'1',unit_price:'0.03',tax_code:'STANDARD'}, partial={...original,quantity:'0.5'};
  const result=calculateReturnLine(netPence([partial])[0]!,2000n,'excluding_vat',partial,original,{net_pence:'3',vat_pence:'1'},discounted.summary!.lines[1]!.discount_pence);
  assert.equal(result.net,2n);assert.equal(result.vat,0n);
});
