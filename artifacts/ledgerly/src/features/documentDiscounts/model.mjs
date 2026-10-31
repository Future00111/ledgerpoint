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

export function canApplyDiscount(kind, openItem, capabilities) {
  if (!discountCreditPath(kind, 'id') || !canEditDrafts(capabilities) || !isValidSettlementSnapshot(openItem)) return false;
  // Payment does not consume credit capacity. This only admits draft preparation;
  // protected posting rechecks capacity and explicitly reviews allocation release.
  return BigInt(openItem.gross_minor) > BigInt(openItem.credited_minor);
}

/** Only subtract saved, server-calculated pence for an explicitly labelled preview. */
export function balanceAfterSavedCredit(openItem, money, dirty = false) {
  if (!openItem || !money || dirty) return null;
  return (BigInt(openItem.open_minor) - BigInt(money.gross_pence)).toString();
}

export function isCurrentDocumentRequest(started, current) {
  return started.scope === current.scope && started.generation === current.generation;
}
