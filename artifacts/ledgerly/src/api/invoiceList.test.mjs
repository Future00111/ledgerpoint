import test from "node:test";
import assert from "node:assert/strict";
import { listCompanyInvoices } from "./invoiceList.mjs";

test("invoice list uses authenticated native read endpoint scoped to one company", async () => {
  const calls=[];
  const client=async(url,options)=>{
    calls.push([url,options]);
    return new Response(JSON.stringify([{id:"invoice",company_id:"company",status:"draft"}]),{status:200});
  };
  assert.equal((await listCompanyInvoices("company",undefined,client))[0].id,"invoice");
  assert.match(calls[0][0],/\/api\/entities\/SalesInvoice\?/);
  assert.match(calls[0][0],/company_id=company/);
  assert.equal(calls[0][1].credentials,"include");
});

test("invoice list rejects cross-company and malformed responses", async () => {
  const crossCompany=async()=>new Response(JSON.stringify([{id:"x",company_id:"other"}]),{status:200});
  await assert.rejects(listCompanyInvoices("company",undefined,crossCompany),/could not be verified/);
  const invalid=async()=>new Response("not JSON",{status:200});
  await assert.rejects(listCompanyInvoices("company",undefined,invalid),/could not be verified/);
});
