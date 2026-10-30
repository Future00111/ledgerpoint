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

export function canApplyDiscount(kind, openItem, capabilities) {
  return Boolean(discountCreditPath(kind, 'id') && canEditDrafts(capabilities) && openItem && BigInt(openItem.open_minor) > 0n);
}

/** Only subtract saved, server-calculated pence for an explicitly labelled preview. */
export function balanceAfterSavedCredit(openItem, money, dirty = false) {
  if (!openItem || !money || dirty) return null;
  return (BigInt(openItem.open_minor) - BigInt(money.gross_pence)).toString();
}

export function isCurrentDocumentRequest(started, current) {
  return started.scope === current.scope && started.generation === current.generation;
}
