import { randomUUID } from 'node:crypto';

// Explicit ordinary VAT treatments for the synthetic, standard-scheme demo.
// These are company rules, not a fallback around the server's tax authority.
export const workspaceTaxRules = [
  { code: 'STANDARD_20', label: 'Standard VAT', rate: 20, treatment: 'standard' },
  { code: 'REDUCED_5', label: 'Reduced rate', rate: 5, treatment: 'reduced' },
  { code: 'ZERO_0', label: 'Zero-rated', rate: 0, treatment: 'zero' },
];

/** Caller owns the transaction and verifies the isolated demo identity. */
export async function ensureWorkspaceTaxRules(q, company) {
  const added = [];
  for (const rule of workspaceTaxRules) {
    const existing = (await q.query('SELECT *,effective_from::text FROM vat_tax_rules WHERE company_id=$1 AND code=$2', [company, rule.code])).rows;
    if (existing.length) {
      if (existing.length !== 1 || Number(existing[0].rate) !== rule.rate || existing[0].treatment !== rule.treatment || existing[0].is_active !== true || existing[0].effective_to !== null || existing[0].effective_from !== '2011-01-04') {
        throw Error(`Existing ${rule.code} differs; no tax rule will be replaced`);
      }
      continue;
    }
    await q.query("INSERT INTO vat_tax_rules(id,company_id,code,label,rate,treatment,effective_from,is_active) VALUES($1,$2,$3,$4,$5,$6,'2011-01-04',true)", [randomUUID(), company, rule.code, rule.label, rule.rate, rule.treatment]);
    added.push(rule.code);
  }
  return added;
}
