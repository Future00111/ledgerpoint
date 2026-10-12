import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { provider, company_id, max_results = 50 } = await req.json();
    if (!provider || !['gmail', 'outlook'].includes(provider)) {
      return Response.json({ error: 'Valid provider (gmail or outlook) is required' }, { status: 400 });
    }
    if (!company_id) return Response.json({ error: 'company_id is required' }, { status: 400 });

    // Get OAuth token for the shared connector
    let accessToken;
    try {
      const conn = await base44.asServiceRole.connectors.getConnection(provider);
      accessToken = conn.accessToken;
    } catch (e) {
      return Response.json({
        error: `${provider === 'gmail' ? 'Gmail' : 'Outlook'} is not connected. Please authorize the ${provider} connector first.`,
        not_connected: true
      }, { status: 403 });
    }

    // Fetch emails with attachments
    let emails = [];
    if (provider === 'gmail') {
      emails = await fetchGmailEmails(accessToken, max_results);
    } else {
      emails = await fetchOutlookEmails(accessToken, max_results);
    }

    const results = { scanned: 0, found: 0, documents: [], ignored: 0, errors: [] };

    for (const email of emails) {
      results.scanned++;

      if (!email.attachments || email.attachments.length === 0) {
        results.ignored++;
        continue;
      }

      // Classify email using AI
      let classification;
      try {
        classification = await classifyEmail(base44, email);
      } catch (e) {
        results.ignored++;
        continue;
      }

      if (!classification || classification.classification === 'ignore') {
        results.ignored++;
        continue;
      }

      // Process attachments
      for (const attachment of email.attachments) {
        const isPdf = attachment.mimeType === 'application/pdf' || (attachment.filename || '').toLowerCase().endsWith('.pdf');
        const isImage = (attachment.mimeType || '').startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|webp|tiff?)$/i.test(attachment.filename || '');
        if (!isPdf && !isImage) continue;

        try {
          // Download attachment content
          let fileBytes;
          if (provider === 'gmail') {
            fileBytes = await downloadGmailAttachment(accessToken, email.id, attachment.attachmentId);
          } else {
            if (!attachment.contentBytes) continue;
            fileBytes = base64ToUint8Array(attachment.contentBytes);
          }

          // Upload to storage
          const file = new File([fileBytes], attachment.filename, { type: attachment.mimeType || 'application/octet-stream' });
          const uploadResult = await base44.integrations.Core.UploadFile({ file });

          // Create Document record with status pending_extraction
          const doc = await base44.entities.Document.create({
            company_id,
            name: attachment.filename,
            document_type: classification.classification,
            file_url: uploadResult.file_url,
            status: 'pending_extraction',
            upload_date: new Date().toISOString().split('T')[0],
            document_date: email.date || null,
            supplier_or_customer: email.sender,
            reference_number: email.subject,
            notes: `Captured from ${provider === 'gmail' ? 'Gmail' : 'Outlook'} email scan`,
          });

          // Run AI extraction
          try {
            await base44.functions.invoke('extractDocumentData', { document_id: doc.id });
          } catch (e) {
            results.errors.push(`Extraction failed for "${attachment.filename}": ${e.message}`);
          }

          results.found++;
          results.documents.push({
            id: doc.id,
            name: attachment.filename,
            type: classification.classification,
            sender: email.sender,
          });
        } catch (e) {
          results.errors.push(`Failed to process attachment "${attachment.filename}": ${e.message}`);
        }
      }
    }

    return Response.json(results);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function base64ToUint8Array(base64) {
  const standardBase64 = base64.replace(/-/g, '+').replace(/_/g, '/');
  const binaryString = atob(standardBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function fetchGmailEmails(accessToken, maxResults) {
  const authHeader = { Authorization: `Bearer ${accessToken}` };

  const afterDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const afterStr = `${afterDate.getFullYear()}/${afterDate.getMonth() + 1}/${afterDate.getDate()}`;

  const searchRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=has:attachment+after:${afterStr}&maxResults=${maxResults}`,
    { headers: authHeader }
  );
  if (!searchRes.ok) throw new Error(`Gmail search failed: ${searchRes.status}`);
  const searchData = await searchRes.json();

  const emails = [];
  for (const msg of searchData.messages || []) {
    try {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
        { headers: authHeader }
      );
      if (!msgRes.ok) continue;
      const msgData = await msgRes.json();

      const headers = msgData.payload?.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const from = headers.find(h => h.name === 'From')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value || '';

      const attachments = [];
      extractGmailAttachments(msgData.payload, attachments);

      emails.push({
        id: msgData.id,
        subject,
        sender: from,
        date: date ? new Date(date).toISOString().split('T')[0] : '',
        attachments,
      });
    } catch (e) {
      // Skip this email on error
    }
  }

  return emails;
}

function extractGmailAttachments(payload, attachments) {
  if (!payload) return;
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.filename && part.body?.attachmentId) {
        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType,
          attachmentId: part.body.attachmentId,
        });
      }
      if (part.parts) {
        extractGmailAttachments(part, attachments);
      }
    }
  }
}

async function downloadGmailAttachment(accessToken, messageId, attachmentId) {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`Failed to download attachment: ${res.status}`);
  const data = await res.json();
  return base64ToUint8Array(data.data);
}

async function fetchOutlookEmails(accessToken, maxResults) {
  const authHeader = { Authorization: `Bearer ${accessToken}` };

  const searchRes = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages?$filter=hasAttachments eq true&$top=${maxResults}&$select=id,subject,from,receivedDateTime&$expand=attachments`,
    { headers: authHeader }
  );
  if (!searchRes.ok) throw new Error(`Outlook search failed: ${searchRes.status}`);
  const searchData = await searchRes.json();

  const emails = [];
  for (const msg of searchData.value || []) {
    const attachments = (msg.attachments || [])
      .filter(att => att.contentBytes && !att.isInline)
      .map(att => ({
        filename: att.name,
        mimeType: att.contentType,
        contentBytes: att.contentBytes,
      }));

    emails.push({
      id: msg.id,
      subject: msg.subject || '',
      sender: msg.from?.emailAddress?.name || msg.from?.emailAddress?.address || '',
      date: msg.receivedDateTime?.split('T')[0] || '',
      attachments,
    });
  }

  return emails;
}

async function classifyEmail(base44, email) {
  const attachmentNames = email.attachments.map(a => a.filename).join(', ');
  const prompt = `You are an AI assistant that classifies emails for an accounting system.
Determine if this email contains a business document that should be processed.

Email details:
- Subject: ${email.subject}
- Sender: ${email.sender}
- Attachments: ${attachmentNames}

Classify this email as exactly one of:
- "purchase_invoice": An invoice or bill from a supplier requesting payment
- "sales_invoice": A sales invoice or order confirmation sent to a customer
- "receipt": A payment receipt or proof of purchase
- "credit_note": A credit note from a supplier or to a customer
- "ignore": Newsletters, marketing emails, personal emails, shipping notifications, social media, or anything that is not a business document

Rules:
- Only classify as a business document if the email clearly contains an invoice, receipt, or credit note
- Ignore newsletters, marketing, shipping notifications, and personal emails
- When in doubt, classify as "ignore"

Return a JSON object with "classification" (one of the above values) and "confidence" (0-1).`;

  const response = await base44.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: "object",
      properties: {
        classification: { type: "string" },
        confidence: { type: "number" }
      }
    }
  });

  return response;
}