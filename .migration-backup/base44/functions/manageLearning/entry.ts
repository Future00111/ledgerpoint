import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

function stripBuiltins({ id, created_date, updated_date, created_by_id, ...rest }) {
  return rest;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden — company owners only" }, { status: 403 });
    const body = await req.json();
    const companyId = body.company_id;
    if (!companyId) return Response.json({ error: "Missing company_id" }, { status: 400 });
    const action = body.action;

    if (action === "reset") {
      await base44.asServiceRole.entities.AccountLearning.deleteMany({ company_id: companyId });
      return Response.json({ ok: true, reset: true });
    }

    if (action === "export") {
      const [learning, rules, settings] = await Promise.all([
        base44.asServiceRole.entities.AccountLearning.filter({ company_id: companyId }),
        base44.asServiceRole.entities.SuggestionRule.filter({ company_id: companyId }, "priority"),
        base44.asServiceRole.entities.SuggestionSettings.filter({ company_id: companyId }),
      ]);
      return Response.json({
        export: { company_id: companyId, learning, rules, settings, exported_at: new Date().toISOString() },
      });
    }

    if (action === "import") {
      const data = body.data || {};
      let imported = { learning: 0, rules: 0, settings: 0 };
      if (Array.isArray(data.learning) && data.learning.length) {
        await base44.asServiceRole.entities.AccountLearning.bulkCreate(data.learning.map(stripBuiltins));
        imported.learning = data.learning.length;
      }
      if (Array.isArray(data.rules) && data.rules.length) {
        await base44.asServiceRole.entities.SuggestionRule.bulkCreate(data.rules.map(stripBuiltins));
        imported.rules = data.rules.length;
      }
      if (Array.isArray(data.settings) && data.settings.length) {
        await base44.asServiceRole.entities.SuggestionSettings.bulkCreate(data.settings.map(stripBuiltins));
        imported.settings = data.settings.length;
      }
      return Response.json({ ok: true, imported });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}