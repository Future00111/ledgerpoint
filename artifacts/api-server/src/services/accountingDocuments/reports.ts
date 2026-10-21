import { paymentEvents, appliedTo, allocated, allocationSign, unappliedEffect, settlementAmounts } from './settlement';
import { fail, uuid } from "../financialDrafts/contract";
import { transact, scope, sales, credit, supportedCompany, type Kind } from "./core";
import { movementAccounts, sections } from "./presentation";

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
       a.code account_code,a.name account_name,a.account_type,j.description,d.number source_number,p.report_group,coalesce(p.display_order,0) display_order
      FROM canonical_journal_lines l JOIN canonical_journal_entries j ON j.id=l.journal_entry_id AND j.company_id=l.company_id
      JOIN chart_of_accounts a ON a.id=l.account_id AND a.company_id=l.company_id
       LEFT JOIN accounting_document_sources d ON d.journal_id=j.id AND d.company_id=j.company_id
         AND d.id::text=j.source_id AND d.kind=j.source_type
       LEFT JOIN accounting_account_presentation p ON p.account_id=a.id AND p.company_id=a.company_id
      WHERE l.company_id=$1 AND j.posting_date<=$2::date ORDER BY j.posting_date,j.id,l.line_number`,[company,to]);
    await afterLedgerRead?.();
    const payments=await paymentEvents(q,company,to);
    for(const event of payments) {
      const actual=all.rows.filter(l=>l.journal_id===event.journal_id);
      const expected=event.source.lines;
      if(actual.length!==expected.length || actual.some((l,i)=>l.account_id!==expected[i].accountId ||
        String(l.debit_minor)!==expected[i].debitMinor || String(l.credit_minor)!==expected[i].creditMinor))
        fail(503,'REPORT_PAYMENT_LEDGER_MISMATCH');
      for(const line of actual) line.source_number=event.reference;
    }
    // Reversals remain additive immutable journals; never discard a source
    // merely because its original entry now has status=reversed.
    const general_ledger=all.rows.filter(r=>r.posting_date>=from);
    const byAccount=new Map<string,any>();
    for(const line of all.rows) {
      const a=byAccount.get(line.account_id)??{account_id:line.account_id,code:line.account_code,name:line.account_name,
        account_type:line.account_type,report_group:line.report_group,display_order:line.display_order,debit:0n,credit:0n};
      a.debit+=BigInt(line.debit_minor);a.credit+=BigInt(line.credit_minor);byAccount.set(line.account_id,a);
    }
    const trial_balance=[...byAccount.values()].map(a=>{
      const balance=a.debit-a.credit;
      return {account_id:a.account_id,code:a.code,name:a.name,account_type:a.account_type,
        report_group:a.report_group,display_order:a.display_order,
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
    const docs=(await q.query(`SELECT d.*,j.posting_date::text,j.created_at journal_created_at FROM accounting_document_sources d
      JOIN canonical_journal_entries j ON j.id=d.journal_id AND j.company_id=d.company_id
        AND j.source_id=d.id::text AND j.source_type=d.kind AND j.status='posted'
      WHERE d.company_id=$1 AND d.status='posted' AND j.posting_date<=$2::date ORDER BY j.posting_date,j.id`,[company,to])).rows;
    const parties=new Map<string,any>(),transactions:any[]=[],ageing=new Map<string,any>(),openItems:any[]=[],postedDocuments:any[]=[];
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
        party_type:sales(d.kind)?"customer":"supplier",balance:0n,unapplied:0n};
      p.balance+=counter;parties.set(d.party_id,p);
      if(d.posting_date>=from) {
        transactions.push({source_type:d.kind,source_id:d.id,journal_id:d.journal_id,date:d.posting_date,recorded_at:d.journal_created_at,
          number:d.number,party_id:d.party_id,party_name:party.name,balance_effect_minor:counter.toString(),
          due_date:d.source.due_date,unapplied_effect_minor:"0",net_minor:(BigInt(d.money.net_pence)*(credit(d.kind)?-1n:1n)).toString()});
        if(sales(d.kind)) {out+=tax;saleNet+=BigInt(d.money.net_pence)*(credit(d.kind)?-1n:1n);}
        else {input+=tax;buyNet+=BigInt(d.money.net_pence)*(credit(d.kind)?-1n:1n);}
      }
      postedDocuments.push({id:d.id,kind:d.kind,party_id:d.party_id,party_name:party.name,party_type:p.party_type,
        number:d.number,date:d.posting_date,due_date:d.source.due_date,journal_id:d.journal_id,
        net_minor:(BigInt(d.money.net_pence)*(credit(d.kind)?-1n:1n)).toString(),gross_minor:counter.toString()});
      if(!credit(d.kind)) {
        const credited=docs.filter(c=>c.original_id===d.id).reduce((n,c)=>n+BigInt(c.money.gross_pence),0n);
        const paid=appliedTo(payments,d.id);
        const amounts=settlementAmounts(d.money.gross_pence,credited.toString(),paid.toString());
        const remaining=BigInt(amounts.open_minor);
        const history=[...docs.filter(c=>c.original_id===d.id).map(c=>({id:c.id,kind:c.kind,number:c.number,
          date:c.posting_date,recorded_at:c.journal_created_at,journal_id:c.journal_id,amount_minor:c.money.gross_pence})),
          ...payments.flatMap(e=>e.allocations.filter((a:any)=>a.document_id===d.id).map((a:any)=>({id:e.id,
            kind:e.kind,number:e.reference,date:e.effective_date,recorded_at:e.created_at,journal_id:e.journal_id,
            amount_minor:(allocationSign(e)*BigInt(a.amount_minor)).toString(),payment_id:e.payment_id??e.id})))];
        history.sort((a,b)=>a.date.localeCompare(b.date)||new Date(a.recorded_at).getTime()-new Date(b.recorded_at).getTime()||a.id.localeCompare(b.id));
        openItems.push({id:d.id,kind:d.kind,party_id:d.party_id,party_type:p.party_type,party_name:party.name,
          number:d.number,date:d.posting_date,due_date:d.source.due_date,
          ...amounts,history});
        const days=Math.floor((Date.parse(to+"T00:00:00Z")-Date.parse(d.source.due_date+"T00:00:00Z"))/86400000);
        const bucket=days<=0?"current_minor":days<=30?"days_1_30_minor":days<=60?"days_31_60_minor":days<=90?"days_61_90_minor":"days_90_plus_minor";
        const age=ageing.get(d.party_id)??{party_id:d.party_id,party_name:party.name,party_type:p.party_type,
          current_minor:0n,days_1_30_minor:0n,days_31_60_minor:0n,days_61_90_minor:0n,days_90_plus_minor:0n};
        age[bucket]+=remaining;ageing.set(d.party_id,age);
      }
    }
    for(const event of payments) {
      const party=(await q.query(`SELECT name FROM ${event.party_type==='customer'?'customers':'suppliers'} WHERE company_id=$1 AND id=$2`,[company,event.party_id])).rows[0];
      if(!party) fail(503,'REPORT_PARTY_MISSING');
      const p=parties.get(event.party_id)??{party_id:event.party_id,party_name:party.name,party_type:event.party_type,balance:0n,unapplied:0n};
      const effect=-allocationSign(event)*allocated(event),unapplied=unappliedEffect(event);
      p.balance+=effect;p.unapplied+=unapplied;parties.set(event.party_id,p);
      if(event.effective_date>=from) transactions.push({source_type:'accounting_payment_event',source_id:event.id,
        journal_id:event.journal_id,date:event.effective_date,recorded_at:event.created_at,number:event.reference,party_id:event.party_id,
        party_name:party.name,balance_effect_minor:effect.toString(),unapplied_effect_minor:unapplied.toString(),
        payment_kind:event.kind,event_amount_minor:event.amount_minor,party_type:event.party_type,due_date:null,net_minor:'0'});
    }
    for(const p of parties.values()) {
      const open=openItems.filter(d=>d.party_id===p.party_id).reduce((n,d)=>n+BigInt(d.open_minor),0n);
      if(open!==p.balance || p.unapplied<0n) fail(503,'REPORT_SETTLEMENT_MISMATCH');
    }
    transactions.sort((a,b)=>a.date.localeCompare(b.date)||new Date(a.recorded_at).getTime()-new Date(b.recorded_at).getTime()||a.source_id.localeCompare(b.source_id));
    const paymentConfig=(await q.query('SELECT mappings FROM accounting_payment_configuration WHERE company_id=$1',[company])).rows[0];
    const bankIds=new Set([paymentConfig?.mappings?.bank,...payments.map(e=>e.source.bank_account_id)].filter(Boolean));
    const cash=all.rows.filter(l=>bankIds.has(l.account_id)).reduce((n,l)=>n+signed(l),0n);
    const drafts=(await q.query(`SELECT id,kind,number,party_id,source->>'issue_date' date,money->>'gross_pence' gross_minor
      FROM accounting_document_sources WHERE company_id=$1 AND status='draft' ORDER BY created_at DESC`,[company])).rows;
    const difference=out-input;
    const pnlSections=sections(movementAccounts(general_ledger),["income","cost_of_sales","expense"]);
    const bsSections=sections(trial_balance.map(a=>({...a,amount_minor:
      (["liability","liabilities","equity"].includes(lower(a.account_type))?-BigInt(a.balance_minor):BigInt(a.balance_minor)).toString()})),
      ["asset","liability","equity"]);
    return {from,to,balance_basis:"Closing balances at to; profit/loss and VAT movements from through to.",
      general_ledger,trial_balance,open_items:openItems,posted_documents:postedDocuments,drafts,
      cash:{configured:bankIds.size>0,balance_minor:cash.toString(),basis:'Posted bank/cash journals only; not a live bank balance.'},
      journal_movements:{debit_minor:general_ledger.reduce((n,r)=>n+BigInt(r.debit_minor),0n).toString(),
        credit_minor:general_ledger.reduce((n,r)=>n+BigInt(r.credit_minor),0n).toString()},
      pnl:{revenue_minor:revenue.toString(),expense_minor:expenses.toString(),profit_minor:(revenue-expenses).toString(),
        sections:pnlSections,cost_of_sales_minor:pnlSections[1]!.total_minor,
        operating_expenses_minor:pnlSections[2]!.total_minor,gross_profit_minor:(revenue-BigInt(pnlSections[1]!.total_minor)).toString()},
      balance_sheet:{assets_minor:assets.toString(),liabilities_minor:liabilities.toString(),equity_minor:equity.toString(),
        sections:bsSections,current_earnings_minor:earnings.toString(),earnings_basis:"Cumulative unclosed earnings through the selected end date.",
        net_vat_payable_minor:(closingOutput-closingInput).toString(),
        net_assets_minor:(assets-closingInput+(closingInput>closingOutput?closingInput-closingOutput:0n)).toString(),
        net_liabilities_minor:(liabilities-closingOutput+(closingOutput>closingInput?closingOutput-closingInput:0n)).toString(),
        balanced:assets===liabilities+equity+earnings},
      vat:{applicable:c.vat_registered,box1_pence:out.toString(),box4_pence:input.toString(),box5_pence:(difference<0n?-difference:difference).toString(),
        box6_pence:saleNet.toString(),box7_pence:buyNet.toString(),net_payable_pence:difference.toString(),repayment:difference<0n,
        reconciliation:"Reconciled to source-linked canonical VAT lines; review workings, not an HMRC submission."},
      party_balances:[...parties.values()].map(({balance,unapplied,...p})=>({...p,balance_minor:balance.toString(),
        unapplied_minor:unapplied.toString(),net_balance_minor:(balance-unapplied).toString()})),
      party_transactions:transactions,
      ageing:[...ageing.values()].map(a=>Object.fromEntries(Object.entries(a).map(([k,v])=>[k,typeof v==="bigint"?v.toString():v])))};
  },true);
}
