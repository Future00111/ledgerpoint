import {bankImportSides} from '../bankImportMoney';
import {exactFields,transact,scope,pounds} from './core';
import {uuid,fail} from '../financialDrafts/contract';
export async function recoverBankImport(company:string,actor:string,request:string) {
  uuid(request);
  return transact(async q=>{
    await scope(q,company,actor,false,true);
    const result=await q.query('SELECT ledgerly_find_bank_import($1::uuid,$2::text,$3::uuid) receipt',[company,actor,request]);
    return result.rows[0].receipt??{request_id:request,status:'unknown'};
  });
}

export function normaliseBankImport(body:unknown) {
  const b=exactFields(body,['request_id','bank_account_id','rows','review_token']);
  uuid(b.request_id);uuid(b.bank_account_id);
  if(!Array.isArray(b.rows)||b.rows.length<1||b.rows.length>500)fail(422,'BANK_IMPORT_ROWS_INVALID');
  const rows=b.rows.map((value:unknown)=>{
    const row=exactFields(value,['date','description','reference','money_in','money_out']);
    let sides;try{sides=bankImportSides(row);}catch{fail(422,'BANK_IMPORT_MONEY_INVALID');}
    if(typeof row.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||
      !Number.isFinite(Date.parse(row.date+'T00:00:00Z'))||new Date(row.date+'T00:00:00Z').toISOString().slice(0,10)!==row.date||
      typeof row.description!=='string'||!row.description.trim()||row.description.length>1000||
      (row.reference!==undefined&&typeof row.reference!=='string')||(row.reference?.length??0)>500)
      fail(422,'BANK_IMPORT_FIELDS_INVALID');
    return {date:row.date,description:row.description.trim(),reference:row.reference??'',
      money_in:pounds(sides.inPence.toString()),money_out:pounds(sides.outPence.toString())};
  });
  return {request_id:uuid(b.request_id),bank_account_id:uuid(b.bank_account_id),rows};
}
