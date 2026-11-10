import type { CanonicalLineDraft } from "../accounting/canonicalPosting";
import { sales, credit } from "./core";

export function journalLines(row:any):CanonicalLineDraft[] {
  const counterDebit=sales(row.kind)!==credit(row.kind);
  const result:CanonicalLineDraft[]=[];
  const add=(account:string,amount:string,debit:boolean,ref:string,taxCode?:string)=>{
    if(BigInt(amount)===0n) return;
    result.push({accountId:account,debitMinor:debit?amount:"0",creditMinor:debit?"0":amount,
      currencyCode:"GBP",sourceLineRef:ref,taxCode:taxCode??null});
  };
  add(row.posting_accounts[sales(row.kind)?"receivables":"payables"],row.money.gross_pence,counterDebit,"counterparty");
  row.money.lines.forEach((line:any,i:number)=>{
    const vatRecovered=sales(row.kind) || row.purchase_vat_eligible;
    const trade=(BigInt(line.net_pence)+(vatRecovered?0n:BigInt(line.vat_pence))).toString();
    const ref=credit(row.kind)?`original:${row.original_id}:${row.tax_context.original_line_refs[i]}`:String(i);
    add(row.posting_accounts[sales(row.kind)?"revenue":"expense"],trade,!counterDebit,ref,row.source.line_items[i].tax_code);
    if(vatRecovered) add(row.posting_accounts[sales(row.kind)?"output_vat":"input_vat"],line.vat_pence,!counterDebit,ref,row.source.line_items[i].tax_code);
  });
  return result;
}
