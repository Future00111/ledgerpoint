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
  source: "rules" | "ai" | "learning";
  account_id?: string;
  account_code?: string | null;
  account_name?: string;
  evidence?: string[];
}

export interface NominalAccount {
  id: string;
  code: string | null;
  name: string | null;
  account_type: string | null;
}

export interface AccountLearning {
  party_name: string | null;
  account_id: string | null;
  account_code: string | null;
  account_name: string | null;
  confidence: unknown;
  occurrence_count: number | null;
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

const normalise = (value: string | null | undefined) =>
  (value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Maps a deterministic category (or an exact account-name signal) onto a
 * company-owned nominal account. A suggestion is never allowed to invent a
 * chart code: callers only receive an account id/code from the supplied chart.
 */
export function suggestNominalAccount(
  txn: BankTxn,
  accounts: NominalAccount[],
  learnings: AccountLearning[] = [],
): CategorySuggestion | null {
  if (accounts.length === 0) return null;
  const text = normalise(`${txn.description || ""} ${txn.reference || ""}`);
  const direction = Number(txn.money_in || 0) > 0 ? "income" : "expense";
  const rule = categoriseByRules(txn);
  const accountsById = new Map(accounts.map((account) => [account.id, account]));

  // Approved company history wins over a generic keyword rule. The account
  // must still exist in the active chart, so a stale learning row cannot
  // suggest an unavailable nominal code.
  const learning = learnings
    .filter((entry) => entry.party_name && entry.account_id && accountsById.has(entry.account_id))
    .map((entry) => ({ entry, party: normalise(entry.party_name) }))
    .filter(({ party }) => party && (text === party || text.includes(party) || party.includes(text)))
    .sort((a, b) => (b.entry.occurrence_count ?? 0) - (a.entry.occurrence_count ?? 0))[0];
  if (learning?.entry.account_id) {
    const account = accountsById.get(learning.entry.account_id)!;
    return {
      category: account.name ?? learning.entry.account_name ?? "Account",
      confidence: Math.min(95, Math.max(80, Math.round(Number(learning.entry.confidence ?? 85)))),
      source: "learning",
      account_id: account.id,
      account_code: account.code,
      account_name: account.name ?? undefined,
      evidence: [`Matched an approved company learning for "${learning.entry.party_name}".`],
    };
  }

  const candidates = accounts
    .filter((account) => account.name)
    .map((account) => {
      const accountName = normalise(account.name);
      const nameWords = accountName.split(" ").filter((word) => word.length >= 4);
      const matchedWords = nameWords.filter((word) => text.includes(word));
      const typeSignal = direction === "income"
        ? /income|revenue|sales|turnover/.test(normalise(account.account_type) + " " + accountName)
        : /expense|cost|overhead|admin|purchases/.test(normalise(account.account_type) + " " + accountName);
      const categoryMatch = rule && (
        accountName.includes(normalise(rule.category)) || normalise(rule.category).includes(accountName)
      );
      const score = (categoryMatch ? 75 : 0) + Math.min(20, matchedWords.length * 10) + (typeSignal ? 5 : 0);
      return { account, score, matchedWords, categoryMatch };
    })
    .filter((candidate) => candidate.score >= 50)
    .sort((a, b) => b.score - a.score);

  const best = candidates[0];
  if (!best || !best.account.name) return null;
  const confidence = Math.min(95, Math.max(rule?.confidence ?? 50, best.score));
  return {
    category: best.account.name,
    confidence,
    source: "rules",
    account_id: best.account.id,
    account_code: best.account.code,
    account_name: best.account.name,
    evidence: [
      rule ? `Matched bookkeeping rule: ${rule.category}` : "Matched bank description to your chart of accounts",
      ...(best.matchedWords.length ? [`Matching terms: ${best.matchedWords.join(", ")}`] : []),
    ],
  };
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

  // AI may rank only accounts which already exist in the company's chart. It
  // must not fabricate a nominal category or code when the chart is empty.
  if (accountNames.length === 0) return {};
  const categories = accountNames.join(", ");
  const canonicalNames = new Map(accountNames.map((name) => [normalise(name), name]));

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
      const canonical = typeof s.category === "string" ? canonicalNames.get(normalise(s.category)) : undefined;
      if (!validIds.has(s.id) || !canonical) continue;
      out[s.id] = {
        category: canonical.slice(0, 100),
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
