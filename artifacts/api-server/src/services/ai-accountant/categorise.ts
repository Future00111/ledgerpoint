/**
 * AI Accountant — categorisation suggestions for unmatched transactions.
 *
 * Deterministic keyword heuristics run first (instant, free). The optional AI
 * batch pass (via the central provider-independent aiService) only refines
 * transactions the heuristics couldn't classify, and every suggestion is
 * review-only — nothing is ever written to a transaction without approval.
 */
import { aiService } from "../ai/index.js";
import type { BankTxn } from "./matcher.js";

export interface CategorySuggestion {
  category: string;
  confidence: number; // 0-100
  source: "rules" | "ai";
}

const RULES: { pattern: RegExp; category: string; confidence: number }[] = [
  { pattern: /hmrc|vat payment|corporation tax|paye/i, category: "Taxes", confidence: 90 },
  { pattern: /salar|payroll|wages/i, category: "Payroll", confidence: 85 },
  { pattern: /\brent\b|landlord/i, category: "Rent", confidence: 85 },
  { pattern: /insurance|aviva|axa|hiscox/i, category: "Insurance", confidence: 85 },
  { pattern: /shell|\bbp\b|esso|texaco|fuel|petrol/i, category: "Motor Expenses", confidence: 80 },
  { pattern: /aws|azure|google cloud|hosting|digitalocean|cloudflare/i, category: "IT & Hosting", confidence: 80 },
  { pattern: /adobe|microsoft|slack|zoom|notion|subscription|saas/i, category: "Software Subscriptions", confidence: 75 },
  { pattern: /tfl|trainline|uber|taxi|rail|flight|hotel/i, category: "Travel", confidence: 75 },
  { pattern: /edf|british gas|octopus|thames water|utility|electric/i, category: "Utilities", confidence: 80 },
  { pattern: /amazon|staples|office/i, category: "Office Supplies", confidence: 60 },
  { pattern: /bank (fee|charge)|monthly fee|service charge/i, category: "Bank Fees", confidence: 80 },
  { pattern: /interest/i, category: "Bank Interest", confidence: 70 },
  { pattern: /stripe|paypal|gocardless|square/i, category: "Sales Income", confidence: 60 },
];

/** Rule-based pass. Returns null when no rule matches. */
export function categoriseByRules(txn: BankTxn): CategorySuggestion | null {
  const text = `${txn.description || ""} ${txn.reference || ""}`;
  for (const rule of RULES) {
    if (rule.pattern.test(text)) {
      // Money-in transactions default towards income categories.
      if (Number(txn.money_in || 0) > 0 && rule.category !== "Sales Income" && rule.category !== "Bank Interest") {
        continue;
      }
      return { category: rule.category, confidence: rule.confidence, source: "rules" };
    }
  }
  if (Number(txn.money_in || 0) > 0) return null; // don't guess income
  return null;
}

/**
 * Batch AI categorisation for transactions the rules couldn't classify.
 * Single completion call; failures degrade gracefully to no suggestion.
 */
export async function categoriseWithAI(
  txns: BankTxn[],
  accountNames: string[],
): Promise<Record<string, CategorySuggestion>> {
  if (txns.length === 0) return {};
  const list = txns.slice(0, 25).map((t) => ({
    id: t.id,
    description: t.description || "",
    reference: t.reference || "",
    direction: Number(t.money_in || 0) > 0 ? "money_in" : "money_out",
    amount: Number(t.money_in || 0) + Number(t.money_out || 0),
  }));

  const categories = accountNames.length > 0
    ? accountNames.join(", ")
    : "Sales Income, Other Income, Office Supplies, Software Subscriptions, Travel, Motor Expenses, Rent, Utilities, Insurance, Payroll, Taxes, Bank Fees, Bank Interest, IT & Hosting, Professional Fees, Marketing";

  try {
    const result = await aiService.complete({
      messages: [
        {
          role: "system",
          content:
            "You are a UK bookkeeping assistant. Suggest an expense/income category for each bank transaction. " +
            `Choose ONLY from this list: ${categories}. ` +
            'Respond with STRICT JSON: {"suggestions":[{"id":"...","category":"...","confidence":0-100}]}. No prose.',
        },
        { role: "user", content: JSON.stringify(list) },
      ],
      maxTokens: 1024,
      temperature: 0,
    });

    const jsonText = result.text.replace(/^```(?:json)?/m, "").replace(/```$/m, "").trim();
    const parsed = JSON.parse(jsonText) as { suggestions?: { id: string; category: string; confidence: number }[] };
    const out: Record<string, CategorySuggestion> = {};
    const validIds = new Set(list.map((l) => l.id));
    for (const s of parsed.suggestions ?? []) {
      if (!validIds.has(s.id) || typeof s.category !== "string") continue;
      out[s.id] = {
        category: s.category.slice(0, 100),
        confidence: Math.max(0, Math.min(100, Math.round(Number(s.confidence) || 50))),
        source: "ai",
      };
    }
    return out;
  } catch {
    // AI unavailable → heuristics-only. Never block the analysis.
    return {};
  }
}
