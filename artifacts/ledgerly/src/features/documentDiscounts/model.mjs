export const canEditDrafts = capabilities => capabilities?.edit_drafts === true;
export const canPostDocuments = capabilities => capabilities?.post_documents === true;
export const documentActionLabel = (status, capabilities) => status === 'draft' && canEditDrafts(capabilities) ? 'Edit draft' : 'View';

export function discountAdjustment(original, previous) {
  return { type: previous?.type ?? 'percentage', value: previous?.value ?? '', original_revision: original.revision };
}

export function discountCreditPath(kind, id) {
  const path = kind === 'sales_invoice' ? '/sales-credit-notes' : kind === 'purchase_bill' ? '/supplier-credit-notes' : null;
  return path && id ? `${path}/new?original=${encodeURIComponent(id)}&discount=1` : null;
}

export function isValidSettlementSnapshot(openItem) {
  if (!openItem) return false;
  const amounts = ['gross_minor', 'credited_minor', 'paid_minor', 'open_minor'].map(field => openItem[field]);
  if (amounts.some(value => typeof value !== 'string' || value.length > 12 || !/^(?:0|[1-9]\d*)$/.test(value))) return false;
  const [gross, credited, paid, open] = amounts.map(BigInt);
  return gross > 0n && gross === credited + paid + open;
}

export function canPrepareCredit(kind, openItem, capabilities) {
  if (!discountCreditPath(kind, 'id') || !canEditDrafts(capabilities) || !isValidSettlementSnapshot(openItem)) return false;
  // Payment does not consume credit capacity. This only admits draft preparation;
  // protected posting rechecks capacity and explicitly reviews allocation release.
  return BigInt(openItem.gross_minor) > BigInt(openItem.credited_minor);
}

export function canApplyDiscount(kind, openItem, capabilities) {
  return canPrepareCredit(kind,openItem,capabilities) && BigInt(openItem.open_minor)>0n;
}

/** Only subtract saved, server-calculated pence for an explicitly labelled preview. */
export function balanceAfterSavedCredit(openItem, money, dirty = false) {
  if (dirty || !isValidSettlementSnapshot(openItem) || typeof money?.gross_pence !== 'string'
    || money.gross_pence.length > 12 || !/^(?:0|[1-9]\d*)$/.test(money.gross_pence)) return null;
  const credit = BigInt(money.gross_pence);
  if (BigInt(openItem.open_minor)<=0n || credit > BigInt(openItem.open_minor)) return null;
  return (BigInt(openItem.open_minor) - credit).toString();
}

export function isCurrentDocumentRequest(started, current) {
  return started.scope === current.scope && started.generation === current.generation;
}

/** Decimal entry is converted without binary floating point. Server owns admissibility. */
export function agreementPence(value) {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  const pence = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  return pence > 0n && pence <= 999999999999n ? String(pence) : null;
}
export function agreementTerms(entry, partyType, partyId) {
  const amount = agreementPence(entry.amount);
  if (!amount || !partyId || !entry.agreement_id || !entry.agreement_date || !entry.payment_deadline || entry.payment_deadline < entry.agreement_date) return null;
  return {version:1, party_type:partyType, party_id:partyId.toLowerCase(), currency:'GBP', agreement_id:entry.agreement_id, agreement_date:entry.agreement_date, payment_deadline:entry.payment_deadline, discount_gross_pence:amount};
}
export function matchesAgreementReceipt(receipt, company, terms, evidenceText) {
  const keys = ['version','party_type','party_id','currency','agreement_id','agreement_date','payment_deadline','discount_gross_pence'];
  return Boolean(terms && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(receipt?.id ?? '') && receipt.company_id === company && receipt.attested === true
    && receipt.party_type === terms.party_type && receipt.party_id === terms.party_id
    && receipt.currency === 'GBP' && keys.every(key => receipt.terms?.[key] === terms[key])
    && (evidenceText === undefined || receipt.evidence_text === evidenceText));
}
