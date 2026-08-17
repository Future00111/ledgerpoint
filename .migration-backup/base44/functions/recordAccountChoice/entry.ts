import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    const companyId = body.company_id;
    if (!companyId) return Response.json({ error: "Missing company_id" }, { status: 400 });

    const {
      source_type,
      source_record_id,
      party_type,
      party_id,
      party_name,
      suggested_account,
      final_account,
      confidence,
      reason,
      suggestion_source,
      vat_rate,
      payment_terms,
    } = body;

    const today = new Date().toISOString().slice(0, 10);

    // Upsert learning record (preferred account per party)
    if (party_type && party_id && final_account && final_account.code) {
      const existing = await base44.asServiceRole.entities.AccountLearning.filter({ company_id: companyId, party_type, party_id });
      if (existing[0]) {
        await base44.asServiceRole.entities.AccountLearning.update(existing[0].id, {
          preferred_account_code: final_account.code,
          preferred_account_id: final_account.id || existing[0].preferred_account_id,
          preferred_account_name: final_account.name,
          preferred_vat_rate: vat_rate != null ? vat_rate : existing[0].preferred_vat_rate,
          preferred_payment_terms: payment_terms != null ? payment_terms : existing[0].preferred_payment_terms,
          last_used_date: today,
          times_used: (existing[0].times_used || 0) + 1,
        });
      } else {
        await base44.asServiceRole.entities.AccountLearning.create({
          company_id: companyId,
          party_type,
          party_id,
          party_name,
          preferred_account_code: final_account.code,
          preferred_account_id: final_account.id,
          preferred_account_name: final_account.name,
          preferred_vat_rate: vat_rate,
          preferred_payment_terms: payment_terms,
          last_used_date: today,
          times_used: 1,
        });
      }
    }

    // Audit trail
    const accepted = !!(suggested_account && final_account && suggested_account.code === final_account.code);
    await base44.asServiceRole.entities.AccountSuggestionLog.create({
      company_id: companyId,
      source_type: source_type || "manual_journal",
      source_record_id,
      party_type,
      party_id,
      party_name,
      suggested_account_code: suggested_account ? suggested_account.code : null,
      suggested_account_name: suggested_account ? suggested_account.name : null,
      final_account_code: final_account ? final_account.code : null,
      final_account_name: final_account ? final_account.name : null,
      confidence: confidence || 0,
      reason: reason || "",
      suggestion_source: suggestion_source || "none",
      accepted,
    });

    return Response.json({ ok: true, accepted });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}