import { fail, uuid } from "../financialDrafts/contract";
import { transact, scope, sales, credit, supportedCompany, type Kind } from "./core";

const signed=(row:any)=>BigInt(row.debit_minor)-BigInt(row.credit_minor);
const lower=(value:unknown)=>String(value??"").toLowerCase();
export async function journal(company:string,actor:string,id:string) {
  return transact(async q=>{
    await scope(q,company,actor);
    const entry=await q.query("SELECT *,posting_date::text FROM canonical_journal_entries WHERE id=$1 AND company_id=$2",[uuid(id),company]);
    if(entry.rowCount!==1) fail(404,"RESOURCE_NOT_FOUND");
    const lines=await q.query(`SELECT l.*,a.code account_code,a.name account_name FROM canonical_journal_lines l
      JOIN chart_of_accounts a ON a.id=l.account_id AND a.company_id=l.company_id
      WHERE l.company_id=$1 AND l.journal_entry_id=$2 ORDER BY l.line_number`,[company,id]);
    return {entry:entry.rows[0],lines:lines.rows};
  });
}
export async function reports(company:string,actor:string,from:string,to:string,afterLedgerRead?:()=>Promise<void>) {
  const valid=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s+"T00:00:00Z")) &&
    new Date(s+"T00:00:00Z").toISOString().slice(0,10)===s;
  if(!valid(from) || !valid(to) || from>to) fail(422,"DATE_RANGE_INVALID");
  return transact(async q=>{
    const c=await scope(q,company,actor);supportedCompany(c);
    const all=await q.query(`SELECT l.*,j.id journal_id,j.posting_date::text,j.source_type,j.source_id,
      a.code account_code,a.name account_name,a.account_type,j.description
      FROM canonical_journal_lines l JOIN canonical_journal_entries j ON j.id=l.journal_entry_id AND j.company_id=l.company_id
      JOIN chart_of_accounts a ON a.id=l.account_id AND a.company_id=l.company_id
      WHERE l.company_id=$1 AND j.posting_date<=$2::date ORDER BY j.posting_date,j.id,l.line_number`,[company,to]);
    await afterLedgerRead?.();
    // Reversals remain additive immutable journals; never discard a source
    // merely because its original entry now has status=reversed.
    const general_ledger=all.rows.filter(r=>r.posting_date>=from);
    const byAccount=new Map<string,any>();
    for(const line of all.rows) {
      const a=byAccount.get(line.account_id)??{account_id:line.account_id,code:line.account_code,name:line.account_name,
        account_type:line.account_type,debit:0n,credit:0n};
      a.debit+=BigInt(line.debit_minor);a.credit+=BigInt(line.credit_minor);byAccount.set(line.account_id,a);
    }
    const trial_balance=[...byAccount.values()].map(a=>{
      const balance=a.debit-a.credit;
      return {account_id:a.account_id,code:a.code,name:a.name,account_type:a.account_type,
        debit_minor:(balance>0n?balance:0n).toString(),credit_minor:(balance<0n?-balance:0n).toString(),
        balance_minor:balance.toString(),debit_movement_minor:a.debit.toString(),credit_movement_minor:a.credit.toString()};
    });
    const income=(t:string)=>["income","revenue"].includes(lower(t));
    const expense=(t:string)=>["expense","expenses","cost_of_sales"].includes(lower(t));
    const revenue=general_ledger.filter(r=>income(r.account_type)).reduce((n,r)=>n-signed(r),0n);
    const expenses=general_ledger.filter(r=>expense(r.account_type)).reduce((n,r)=>n+signed(r),0n);
    let assets=0n,liabilities=0n,equity=0n,earnings=0n;
    for(const a of trial_balance) {
      const n=BigInt(a.balance_minor), t=lower(a.account_type);
      if(["asset","assets"].includes(t)) assets+=n;
      else if(["liability","liabilities"].includes(t)) liabilities-=n;
      else if(t==="equity") equity-=n;
      else if(income(t)||expense(t)) earnings-=n;
      else fail(503,"REPORT_ACCOUNT_TYPE_UNSUPPORTED");
    }
    const docs=(await q.query(`SELECT d.*,j.posting_date::text FROM accounting_document_sources d
      JOIN canonical_journal_entries j ON j.id=d.journal_id AND j.company_id=d.company_id
        AND j.source_id=d.id::text AND j.source_type=d.kind AND j.status='posted'
      WHERE d.company_id=$1 AND d.status='posted' AND j.posting_date<=$2::date ORDER BY j.posting_date,j.id`,[company,to])).rows;
    const parties=new Map<string,any>(),transactions:any[]=[],ageing=new Map<string,any>();
    let out=0n,input=0n,saleNet=0n,buyNet=0n,closingOutput=0n,closingInput=0n;
    for(const d of docs) {
      const role=sales(d.kind)?"receivables":"payables";
      const journalLines=all.rows.filter(l=>l.journal_id===d.journal_id);
      const counter=journalLines.filter(l=>l.account_id===d.posting_accounts[role])
        .reduce((n,l)=>n+signed(l),0n)*(sales(d.kind)?1n:-1n);
      const expected=BigInt(d.money.gross_pence)*(credit(d.kind)?-1n:1n);
      if(counter!==expected) fail(503,"REPORT_LEDGER_MISMATCH");
      const taxRole=sales(d.kind)?"output_vat":"input_vat";
      const tax=journalLines.filter(l=>l.account_id===d.posting_accounts[taxRole])
        .reduce((n,l)=>n+signed(l),0n)*(sales(d.kind)?-1n:1n);
      const taxExpected=(sales(d.kind)||d.purchase_vat_eligible?BigInt(d.money.vat_pence):0n)*(credit(d.kind)?-1n:1n);
      if(tax!==taxExpected) fail(503,"REPORT_LEDGER_MISMATCH");
      if(sales(d.kind)) closingOutput+=tax;else closingInput+=tax;
      const party=(await q.query(`SELECT name FROM ${sales(d.kind)?"customers":"suppliers"} WHERE company_id=$1 AND id=$2`,[company,d.party_id])).rows[0];
      if(!party) fail(503,"REPORT_PARTY_MISSING");
      const p=parties.get(d.party_id)??{party_id:d.party_id,party_name:party.name,
        party_type:sales(d.kind)?"customer":"supplier",balance:0n};
      p.balance+=counter;parties.set(d.party_id,p);
      if(d.posting_date>=from) {
        transactions.push({source_type:d.kind,source_id:d.id,journal_id:d.journal_id,date:d.posting_date,
          number:d.number,party_id:d.party_id,party_name:party.name,balance_effect_minor:counter.toString(),
          due_date:d.source.due_date});
        if(sales(d.kind)) {out+=tax;saleNet+=BigInt(d.money.net_pence)*(credit(d.kind)?-1n:1n);}
        else {input+=tax;buyNet+=BigInt(d.money.net_pence)*(credit(d.kind)?-1n:1n);}
      }
      if(!credit(d.kind)) {
        const credited=docs.filter(c=>c.original_id===d.id).reduce((n,c)=>n+BigInt(c.money.gross_pence),0n);
        const remaining=BigInt(d.money.gross_pence)-credited;
        const days=Math.floor((Date.parse(to+"T00:00:00Z")-Date.parse(d.source.due_date+"T00:00:00Z"))/86400000);
        const bucket=days<=0?"current_minor":days<=30?"days_1_30_minor":days<=60?"days_31_60_minor":days<=90?"days_61_90_minor":"days_90_plus_minor";
        const age=ageing.get(d.party_id)??{party_id:d.party_id,party_name:party.name,party_type:p.party_type,
          current_minor:0n,days_1_30_minor:0n,days_31_60_minor:0n,days_61_90_minor:0n,days_90_plus_minor:0n};
        age[bucket]+=remaining;ageing.set(d.party_id,age);
      }
    }
    const difference=out-input;
    return {from,to,balance_basis:"Closing balances at to; profit/loss and VAT movements from through to.",
      general_ledger,trial_balance,
      journal_movements:{debit_minor:general_ledger.reduce((n,r)=>n+BigInt(r.debit_minor),0n).toString(),
        credit_minor:general_ledger.reduce((n,r)=>n+BigInt(r.credit_minor),0n).toString()},
      pnl:{revenue_minor:revenue.toString(),expense_minor:expenses.toString(),profit_minor:(revenue-expenses).toString()},
      balance_sheet:{assets_minor:assets.toString(),liabilities_minor:liabilities.toString(),equity_minor:equity.toString(),
        current_earnings_minor:earnings.toString(),earnings_basis:"Cumulative unclosed earnings through the selected end date.",
        net_vat_payable_minor:(closingOutput-closingInput).toString(),
        net_assets_minor:(assets-closingInput+(closingInput>closingOutput?closingInput-closingOutput:0n)).toString(),
        net_liabilities_minor:(liabilities-closingOutput+(closingOutput>closingInput?closingOutput-closingInput:0n)).toString(),
        balanced:assets===liabilities+equity+earnings},
      vat:{applicable:c.vat_registered,box1_pence:out.toString(),box4_pence:input.toString(),box5_pence:(difference<0n?-difference:difference).toString(),
        box6_pence:saleNet.toString(),box7_pence:buyNet.toString(),net_payable_pence:difference.toString(),repayment:difference<0n,
        reconciliation:"Reconciled to source-linked canonical VAT lines; review workings, not an HMRC submission."},
      party_balances:[...parties.values()].map(({balance,...p})=>({...p,balance_minor:balance.toString()})),
      party_transactions:transactions,
      ageing:[...ageing.values()].map(a=>Object.fromEntries(Object.entries(a).map(([k,v])=>[k,typeof v==="bigint"?v.toString():v])))};
  },true);
}
