// Shared mappings and helpers for the Smart Account Suggestions engine.
// Used by base44/functions/suggestAccount. Keep pure (no SDK calls) so it can be
// imported by any backend function and extended with new data sources without redesign.

// Category -> default account name (purchase side).
export const CATEGORY_ACCOUNT = {
  parts: "Purchases",
  tools: "Tools & Equipment",
  utilities: "Utilities",
  rent: "Rent",
  insurance: "Insurance",
  wages: "Wages & Salaries",
  fuel: "Fuel & Vehicle Costs",
  office: "Office Expenses",
  professional_fees: "Professional Fees",
  other: "General Expenses",
};

// Business-type / industry-pack overrides for specific categories.
export const BUSINESS_TYPE_OVERRIDES = {
  garage: { parts: "Parts & Materials", fuel: "Fuel & Vehicle Costs", tools: "Tools & Equipment" },
  restaurant: { parts: "Food & Beverage", utilities: "Utilities" },
  construction: { parts: "Building Materials", tools: "Tools & Equipment", fuel: "Fuel & Vehicle Costs" },
  retail: { parts: "Purchases", tools: "Shop Equipment" },
  ecommerce: { parts: "Purchases", tools: "Equipment" },
  property: { parts: "Property Repairs", utilities: "Utilities" },
  consultant: { office: "Office Expenses", professional_fees: "Professional Fees" },
  tradesperson: { parts: "Materials", tools: "Tools & Equipment", fuel: "Fuel & Vehicle Costs" },
};

export function accountNameForCategory(businessType, category, isSales) {
  if (isSales) return "Sales";
  if (!category) return null;
  const overrides = BUSINESS_TYPE_OVERRIDES[businessType] || {};
  return overrides[category] || CATEGORY_ACCOUNT[category] || null;
}

// Confidence scales with how often an account was used for a party.
export function confidenceForHistory(timesUsed) {
  const n = timesUsed || 0;
  if (n >= 5) return 99;
  if (n >= 3) return 95;
  if (n === 2) return 88;
  return 78; // first use
}

export function sourceLabel(sourceType) {
  const map = {
    purchase_bill: "bills",
    sales_invoice: "invoices",
    sales_credit_note: "credit notes",
    supplier_credit_note: "credit notes",
    bank_transaction: "transactions",
    manual_journal: "journals",
    document_extraction: "documents",
  };
  return map[sourceType] || "transactions";
}

export function matchesRule(rule, ctx) {
  const mv = (rule.match_value || "").toLowerCase();
  if (!mv) return false;
  switch (rule.match_type) {
    case "supplier_name_contains":
      return ctx.partyType === "supplier" && (ctx.partyName || "").toLowerCase().includes(mv);
    case "description_contains":
      return (ctx.description || "").toLowerCase().includes(mv);
    case "category":
      return !!ctx.category && ctx.category.toLowerCase() === mv;
    case "line_description_contains":
      return (ctx.lineItems || []).some((l) => ((l && l.description) || "").toLowerCase().includes(mv));
    default:
      return false;
  }
}