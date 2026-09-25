import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { document_id } = await req.json();
    if (!document_id) return Response.json({ error: 'document_id is required' }, { status: 400 });

    const doc = await base44.entities.Document.get(document_id);
    if (!doc) return Response.json({ error: 'Document not found' }, { status: 404 });
    if (!doc.file_url) return Response.json({ error: 'No file attached to document' }, { status: 400 });

    const prompt = `You are an AI assistant specialized in extracting structured data from UK business documents (invoices, receipts, credit notes, bank statements).

Analyze the attached document and extract the following fields:
- supplier_name: The name of the supplier, vendor, or company issuing the document
- invoice_number: The invoice, bill, or reference number on the document
- invoice_date: The date on the document (return in YYYY-MM-DD format)
- net_amount: The net or subtotal amount (before VAT/tax)
- vat_amount: The VAT or tax amount
- gross_amount: The gross or total amount (net + VAT)

For each field, provide:
1. The extracted value (use null if not found)
2. A confidence score between 0 and 1 (1 = very confident, 0 = not found at all)

Return only the JSON object.`;

    const response = await base44.integrations.Core.InvokeLLM({
      prompt,
      file_urls: [doc.file_url],
      response_json_schema: {
        type: "object",
        properties: {
          supplier_name: {
            type: "object",
            properties: {
              value: { type: "string" },
              confidence: { type: "number" }
            }
          },
          invoice_number: {
            type: "object",
            properties: {
              value: { type: "string" },
              confidence: { type: "number" }
            }
          },
          invoice_date: {
            type: "object",
            properties: {
              value: { type: "string" },
              confidence: { type: "number" }
            }
          },
          net_amount: {
            type: "object",
            properties: {
              value: { type: "number" },
              confidence: { type: "number" }
            }
          },
          vat_amount: {
            type: "object",
            properties: {
              value: { type: "number" },
              confidence: { type: "number" }
            }
          },
          gross_amount: {
            type: "object",
            properties: {
              value: { type: "number" },
              confidence: { type: "number" }
            }
          }
        }
      }
    });

    const updated = await base44.entities.Document.update(document_id, {
      extraction_data: response,
      status: 'pending_review'
    });

    return Response.json({ document: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});