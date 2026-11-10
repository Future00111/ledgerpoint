import assert from 'node:assert/strict';
// Test-only cross-workspace import of the actual untyped browser projection.
// @ts-expect-error ledgerCsv.mjs has no TypeScript declaration; PG assertions verify its result.
import { statementRows, reportRows } from '../../../../ledgerly/src/lib/ledgerCsv.mjs';

const sum=(rows:any[],field:string)=>rows.reduce((n,r)=>n+BigInt(r[field]),0n);
const buckets=['current_minor','days_1_30_minor','days_31_60_minor','days_61_90_minor','days_90_plus_minor'];

/** Exercise the SAME statement/CSV projection used by the customer screens. */
export function reconcileLifecycleReport(full:any,period:any,previous:any,partyId:string,
  expected:{open:string,pool:string,cash:string,net:string,vat:string,vatNet?:string,side:'customer'|'supplier'}) {
  assert.equal(full.to,period.to);
  assert.deepEqual(period.trial_balance,full.trial_balance,'from date must not reset closing balances');
  assert.deepEqual(period.balance_sheet,full.balance_sheet);
  assert.deepEqual(period.ageing,full.ageing);
  assert.deepEqual(period.open_items,full.open_items);
  assert.equal(sum(full.trial_balance,'debit_minor'),sum(full.trial_balance,'credit_minor'));
  for(const data of [full,period]) {
    assert.equal(sum(data.general_ledger,'debit_minor'),sum(data.general_ledger,'credit_minor'));
    assert.equal(data.journal_movements.debit_minor,sum(data.general_ledger,'debit_minor').toString());
    assert.equal(data.balance_sheet.balanced,true);
    assert.equal(BigInt(data.balance_sheet.assets_minor),
      BigInt(data.balance_sheet.liabilities_minor)+BigInt(data.balance_sheet.equity_minor)+BigInt(data.balance_sheet.current_earnings_minor));
    assert.ok(data.general_ledger.every((l:any)=>l.posting_date>=data.from&&l.posting_date<=data.to));
    assert.ok(data.party_transactions.every((l:any)=>l.date>=data.from&&l.date<=data.to));
    const party=data.party_balances.find((p:any)=>p.party_id===partyId);
    assert.equal(party.balance_minor,expected.open);
    assert.equal(party.unapplied_minor,expected.pool);
    assert.equal(party.net_balance_minor,(BigInt(expected.open)-BigInt(expected.pool)).toString());
    assert.equal(sum(data.open_items.filter((d:any)=>d.party_id===partyId),'open_minor').toString(),expected.open);
    const age=data.ageing.find((a:any)=>a.party_id===partyId);
    assert.equal(buckets.reduce((n,k)=>n+BigInt(age?.[k]??0),0n).toString(),expected.open);
    assert.equal(data.cash.balance_minor,expected.cash);
    const statement=statementRows(data,partyId);
    assert.equal(statement.closing,expected.open);assert.equal(statement.unapplied,expected.pool);
    if(statement.rows.length) {
      assert.equal(statement.rows.at(-1).running_balance_minor,expected.open);
      assert.equal(statement.rows.at(-1).running_unapplied_minor,expected.pool);
    }
    assert.equal(reportRows(data,'gl').length,data.general_ledger.length+1);
    assert.equal(reportRows(data,'tb').length,data.trial_balance.length+1);
  }
  const before=previous.party_balances.find((p:any)=>p.party_id===partyId);
  const statement=statementRows(period,partyId);
  assert.equal(statement.opening,before?.balance_minor??'0');
  assert.equal(statement.openingUnapplied,before?.unapplied_minor??'0');
  const field=expected.side==='customer'?'revenue_minor':'expense_minor';
  const box=expected.side==='customer'?'box1_pence':'box4_pence';
  const netbox=expected.side==='customer'?'box6_pence':'box7_pence';
  assert.equal(full.pnl[field],expected.net);assert.equal(full.vat[box],expected.vat);
  assert.equal(full.vat[netbox],expected.vatNet??expected.net);
  assert.equal(BigInt(period.pnl[field]),BigInt(full.pnl[field])-BigInt(previous.pnl[field]));
  assert.equal(BigInt(period.vat[box]),BigInt(full.vat[box])-BigInt(previous.vat[box]));
  assert.equal(BigInt(period.vat[netbox]),BigInt(full.vat[netbox])-BigInt(previous.vat[netbox]));
  const sign=expected.side==='customer'?1n:-1n;
  assert.equal(BigInt(full.balance_sheet.current_earnings_minor),sign*BigInt(expected.net));
  assert.equal(BigInt(full.balance_sheet.net_vat_payable_minor),sign*BigInt(expected.vat));
}
