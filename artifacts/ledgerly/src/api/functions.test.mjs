import test from "node:test";
import assert from "node:assert/strict";
import { invokeApiFunction } from "./functions.mjs";

test("first-party function client sends authenticated JSON and returns its native response", async () => {
  let observed;
  const expected={answer:"Use the invoice date's supported tax rule."};
  const result=await invokeApiFunction("askAI",{company_id:"company",question:"Explain VAT"},
    async(url,options)=>{
      observed={url,options};
      return new Response(JSON.stringify(expected),{status:200});
    });
  assert.equal(observed.url,"/api/functions/askAI");
  assert.equal(observed.options.credentials,"include");
  assert.equal(JSON.parse(observed.options.body).company_id,"company");
  assert.deepEqual(result,expected);
});

test("first-party function client reports server failures instead of returning fake success", async () => {
  await assert.rejects(
    invokeApiFunction("postSalesInvoice",{invoice_id:"invoice"},
      async()=>new Response(JSON.stringify({error:"Posting is not available"}),{status:503})),
    error=>error.status===503 && error.message==="Posting is not available",
  );
});
