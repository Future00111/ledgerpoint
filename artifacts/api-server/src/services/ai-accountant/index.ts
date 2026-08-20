/**
 * AI Accountant service — Phase 1.
 *
 * Safety contract (enforced across all modules):
 *  - AI analyses, explains, and recommends. It NEVER posts transactions,
 *    creates journals or invoices, deletes records, submits VAT returns, or
 *    alters historical transactions.
 *  - Every mutation requires an explicit authenticated user approval and goes
 *    through the atomic approval path with company membership checks.
 */
export * from "./matcher.js";
export * from "./categorise.js";
export * from "./analysis.js";
export * from "./approval.js";
export * from "./insights.js";
export * from "./review.js";
export * from "./detectors.js";
export * from "./recommendations.js";
export * from "./explain.js";
export * from "./taskEngine.js";
export * from "./collections.js";
export * from "./vat.js";
