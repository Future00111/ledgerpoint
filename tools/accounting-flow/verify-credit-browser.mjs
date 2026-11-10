// Offline native receipt verification; no database or network access.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
const dir=path.resolve(process.argv[2]??'../job22-evidence/browser');
const read=name=>JSON.parse(readFileSync(path.join(dir,name),'utf8'));
const r=read('final-report.json'),c=read('cleanup.json');
for(const key of ['syntheticOnly','apiStopped','postgresStopped','directoryRemoved'])assert.equal(c[key],true,key);
assert.equal(c.existingDatabasesAccessed,false);
assert.equal(r.general_ledger.length,26);
const journals=new Map();
for(const line of r.general_ledger){
  assert.ok(line.source_id&&line.journal_id);
  journals.set(line.journal_id,(journals.get(line.journal_id)??0n)+BigInt(line.debit_minor)-BigInt(line.credit_minor));
}
assert.equal(journals.size,10);
for(const net of journals.values())assert.equal(net,0n);
assert.equal(r.journal_movements.debit_minor,r.journal_movements.credit_minor);
for(const [code,value] of Object.entries({bank:'8400',receivables:'0',payables:'0',customer_credit:'-2400',supplier_prepayment:'1200',expense:'4000',revenue:'-10000',input_vat:'800',output_vat:'-2000'}))
  assert.equal(r.trial_balance.find(a=>a.code===code)?.balance_minor,value,code);
assert.equal(r.open_items.length,2);
for(const [number,gross,paid,credit] of [['JOB22-SI-001','14400','12000','2400'],['JOB22-PB-001','12000','4800','7200']]){
  const item=r.open_items.find(a=>a.number===number);assert.ok(item);
  assert.equal(item.gross_minor,gross);assert.equal(item.paid_minor,paid);
  assert.equal(item.credited_minor,credit);assert.equal(item.open_minor,'0');
}
for(const [type,unapplied] of [['customer','2400'],['supplier','1200']]){
  const party=r.party_balances.find(p=>p.party_type===type);
  assert.equal(party.balance_minor,'0');assert.equal(party.unapplied_minor,unapplied);
}
assert.equal(r.vat.box1_pence,'2000');assert.equal(r.vat.box4_pence,'800');
assert.equal(r.vat.net_payable_pence,'1200');
console.log('PASS: 10 balanced journals/26 lines; cash £84, customer reusable £24, supplier prepayment £12; both originals settled; VAT £12; disposable cleanup confirmed.');
