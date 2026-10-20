import test from "node:test";
import assert from "node:assert/strict";
import { createInvoiceDraftClient, invoiceSource, displayPence } from "./invoiceDrafts.mjs";
const form = {customer_id:"customer",invoice_number:"DRAFT-1",issue_date:"2026-10-20",due_date:"2026-11-20",
  payment_terms:30,reference:"",notes:"",total:999,status:"paid",company_id:"forged",
  line_items:[{description:"Fixture",quantity:"1.2345",unit_price:"2.3456",tax_code:"reviewed",amount:9}]};
test("explicit client DTO preserves source text and excludes financial/tenant/status authority", () => {
  const dto = invoiceSource(form);
  assert.equal(dto.line_items[0].quantity,"1.2345");
  assert.equal(dto.line_items[0].unit_price,"2.3456");
  for(const field of ["total","status","company_id"]) assert.equal(field in dto,false);
  assert.equal("amount" in dto.line_items[0],false);
  assert.equal("currency" in invoiceSource(form,true),false);
});
test("client create/edit/read round-trip consumes envelope, company and revision", async () => {
  const calls=[];
  const client=createInvoiceDraftClient(async(url,options)=>{
    calls.push([url,options]);
    return new Response(JSON.stringify({data:{id:"draft",company_id:"company",revision:"rev",source:invoiceSource(form)}}),{status:options.method==="POST"?201:200});
  });
  await client.save("company",form);
  await client.save("company",form,"draft","rev");
  await client.get("company","draft");
  assert.deepEqual(calls.map(x=>x[1].method),["POST","PATCH","GET"]);
  assert.equal(calls[1][1].headers["If-Match"],'"rev"');
  assert.equal(calls[1][1].credentials,"include");
});
test("safe typed failures preserve code/issues and never retry", async () => {
  let calls=0;
  const client=createInvoiceDraftClient(async()=>{
    calls++;
    return new Response(JSON.stringify({error:{code:"REVISION_CONFLICT",message:"Reload required",issues:[],request_id:"r"}}),{status:409});
  });
  await assert.rejects(client.save("company",form,"draft","old"),{code:"REVISION_CONFLICT",status:409});
  assert.equal(calls,1);
});
test("wrong-company or malformed success is uncertain, not accepted as saved", async () => {
  const client=createInvoiceDraftClient(async()=>new Response(JSON.stringify({data:{id:"x",company_id:"other",revision:"x"}})));
  await assert.rejects(client.save("company",form),/could not be verified/);
  assert.equal(displayPence("999999999999"),"£9999999999.99");
});
