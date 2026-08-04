import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  accountNameForCategory,
  confidenceForHistory,
  sourceLabel,
  matchesRule,
} from '../../shared/suggestionMappings.ts';

function buildResult(account, confidence, source, reason, engine) {
  return {
    suggestion: account
      ? {
          account_id: account.id || null,
          account_code: account.code,
          account_name: account.name,
        }
      : null,
    confidence: Math.round(confidence),
    source,
    engine,
    reason,
  };
}

async function runAI(base44, params) {
  const { accounts, partyName, description, lineItems, businessType, documentText, isSales, category } = params;
  const accountList = accounts.map((a) => `${a.code} - ${a.name} (${a.type})`).join("\n");
  const lines = (lineItems || []).map((l) => l && l.description).filter(Boolean).join("; ");

  const prompt = `You are a UK bookkeeping assistant. Choose the single most appropriate ledger account (nominal code) for the transaction below, from the company's Chart of Accounts.

Chart of Accounts:
${accountList}

Business type: ${businessType || "general"}
Transaction type: ${params.sourceType || "transaction"}
${isSales ? "This is a sales/income transaction." : "This is a purchase/expense transaction."}
Supplier/Customer: ${partyName || "n/a"}
Description: ${description || "n/a"}
Category: ${category || "n/a"}
Line items: ${lines || "n/a"}
${documentText ? `Document text: ${documentText.slice(0, 1200)}` : ""}

Respond with the best matching account_code from the chart above, a confidence percentage (0-100, below 70 if unsure), and a short reason. Only use account codes that exist in the chart.`;

  const schema = {
    type: "object",
    properties: {
      account_code: { type: "string" },
      account_name: { type: "string" },
      confidence: { type: "number" },
      reason: { type: "string" },
    },
    required: ["account_code", "confidence", "reason"],
  };

  const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: schema,
  });
  return res;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    const companyId = body.company_id;
    if (!companyId) return Response.json({ error: "Missing company_id" }, { status: 400 });

    // Settings (default hybrid)
    const settingsList = await base44.asServiceRole.entities.SuggestionSettings.filter({ company_id: companyId });
    const settings = settingsList[0] || { mode: "hybrid", ai_enabled: true };
    const mode = settings.mode || "hybrid";
    const useRules = mode !== "ai_only";
    const useAI = mode !== "rules_only" && settings.ai_enabled !== false;

    // Chart of accounts
    const accounts = await base44.asServiceRole.entities.ChartOfAccount.filter({ company_id: companyId });
    const activeAccounts = accounts.filter((a) => a.is_active !== false);
    const accountByCode = {};
    const accountByNameLower = {};
    activeAccounts.forEach((a) => {
      accountByCode[a.code] = a;
      accountByNameLower[(a.name || "").toLowerCase()] = a;
    });

    const sourceType = body.source_type;
    const isSales = sourceType === "sales_invoice" || sourceType === "sales_credit_note";
    const partyType = body.party_type;
    const partyId = body.party_id;
    const partyName = body.party_name || "";
    const description = body.description || "";
    const category = body.category || "";
    const lineItems = body.line_items || [];
    const businessType = body.business_type || "";
    const documentText = body.document_text || "";
    const ctx = { partyType, partyName, description, category, lineItems };

    // Priority 1: user automation rules
    if (useRules) {
      const rules = await base44.asServiceRole.entities.SuggestionRule.filter({ company_id: companyId, is_active: true }, "priority");
      for (const rule of rules) {
        if (matchesRule(rule, ctx)) {
          const acc = accountByCode[rule.target_account_code];
          return Response.json(
            buildResult(
              acc || { code: rule.target_account_code, name: rule.target_account_name },
              99,
              "user_rule",
              `Matches your rule "${rule.name}".`,
              "rules"
            )
          );
        }
      }
    }

    // Priority 2: previous selections for the same supplier/customer
    if (useRules && partyId) {
      const learned = await base44.asServiceRole.entities.AccountLearning.filter({ company_id: companyId, party_type: partyType, party_id: partyId });
      const rec = learned[0];
      if (rec && rec.preferred_account_code) {
        const acc = accountByCode[rec.preferred_account_code];
        const conf = confidenceForHistory(rec.times_used);
        const label = sourceLabel(sourceType);
        return Response.json(
          buildResult(
            acc || { code: rec.preferred_account_code, name: rec.preferred_account_name },
            conf,
            "party_history",
            `Previous ${rec.times_used} ${label} from ${partyName || "this party"} were posted to ${rec.preferred_account_name || rec.preferred_account_code}.`,
            "history"
          )
        );
      }
    }

    // Priority 3: supplier default ledger account (mapped from default expense category)
    if (useRules && partyType === "supplier" && partyId) {
      try {
        const supplier = await base44.asServiceRole.entities.Supplier.get(partyId);
        if (supplier && supplier.default_expense_category) {
          const name = accountNameForCategory(businessType, supplier.default_expense_category, false);
          const acc = name ? accountByNameLower[name.toLowerCase()] : null;
          if (acc) {
            return Response.json(
              buildResult(acc, 80, "supplier_default", `Default expense category for supplier ${partyName} is ${supplier.default_expense_category}.`, "supplier_default")
            );
          }
        }
      } catch (_e) {
        // supplier lookup failed; continue
      }
    }

    // Priority 4: business type and industry pack
    if (useRules) {
      const name = accountNameForCategory(businessType, category, isSales);
      if (name) {
        const acc = accountByNameLower[name.toLowerCase()];
        if (acc) {
          const reason = isSales
            ? `Based on business type (${businessType || "general"}) — sales posted to a Sales account.`
            : `Based on business type (${businessType || "general"}) and category (${category}).`;
          return Response.json(buildResult(acc, 60, "business_type", reason, "business_type"));
        }
      }
    }

    // Priority 5: AI recommendation
    if (useAI) {
      try {
        const ai = await runAI(base44, { accounts: activeAccounts, partyName, description, lineItems, businessType, documentText, isSales, category, sourceType });
        if (ai && ai.account_code) {
          const acc = accountByCode[ai.account_code];
          if (acc) {
            const conf = Math.min(99, Math.max(0, Math.round(ai.confidence || 60)));
            return Response.json(
              buildResult(acc, conf, "ai", `Based on AI analysis. ${ai.reason || ""}`, "ai")
            );
          }
        }
      } catch (_e) {
        // AI failed; fall through
      }
    }

    return Response.json({ suggestion: null, confidence: 0, source: "none", engine: "none", reason: "No suggestion available — please select an account." });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}