import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Money, ErrorBox, SkeletonRows } from '@/components/accounting/AccountingUI';
import { Button } from '@/components/ui/button';
import { balanceAfterSavedCredit, canEditDrafts, canPostDocuments } from './model.mjs';
import { useState } from 'react';

export function DraftWriteActions({ capabilities, doc, editId, busy, dirty, creditInvalid, configurationErrors = [], onReview, compact = false }) {
  const zeroTotal = !dirty && doc?.money?.gross_pence === '0';
  const actionClass = compact ? 'min-h-11 w-full sm:w-auto' : 'min-h-11 w-full';
  const ready = Boolean(doc && !dirty && !zeroTotal && configurationErrors.length === 0);
  return <>
    {canEditDrafts(capabilities) && <Button type="submit" variant={ready && canPostDocuments(capabilities) ? 'outline' : 'default'} className={actionClass} disabled={busy || creditInvalid} data-testid="button-save">{busy ? 'Working…' : editId ? 'Save changes' : 'Save draft'}</Button>}
    {canPostDocuments(capabilities) && <Button type="button" variant={ready ? 'default' : 'secondary'} className={actionClass} disabled={busy || !doc || dirty || zeroTotal || configurationErrors.length > 0} onClick={onReview} data-testid="button-post">Review & post</Button>}
    {zeroTotal && <p className="text-xs text-muted-foreground">This draft totals £0.00. Zero-value documents cannot be posted yet.</p>}
    {canEditDrafts(capabilities) && !canPostDocuments(capabilities) && <p className="text-xs text-muted-foreground">You can prepare this draft. An owner or accountant must review and post it.</p>}
  </>;
}

export function DiscountEditor({ value, onChange, priceBasis, adjustment = false, disabled = false }) {
  const [expanded, setExpanded] = useState(false);
  const type = value?.type ?? (adjustment ? 'percentage' : 'none');
  const includingVat = adjustment || priceBasis === 'including_vat';
  if (!adjustment && type === 'none' && !expanded) return <Button type="button" variant="outline" className="min-h-11" disabled={disabled} onClick={() => setExpanded(true)}>Add a discount (optional)</Button>;
  return <section className="workspace-card space-y-4 p-6" aria-label={adjustment ? 'Discount adjustment' : 'Document discount'}>
    <div><h2 className="font-semibold">{adjustment ? 'Discount adjustment' : 'Discount'}</h2><p className="mt-1 text-sm text-muted-foreground">{adjustment ? 'Prepare a credit against the original document. A percentage uses its original total including VAT, not the remaining balance.' : 'Optional discount across this document. VAT and line amounts are recalculated when you save.'}</p></div>
    <div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="discount-type">Discount type</Label><select id="discount-type" className="mt-1.5 w-full rounded-md border bg-background p-2.5 text-sm" disabled={disabled} value={type}
      onChange={event => { if (event.target.value === 'none') setExpanded(false); onChange(event.target.value === 'none' ? null : { ...value, type: event.target.value, value: value?.value ?? '' }); }}>
      {!adjustment && <option value="none">None</option>}<option value="percentage">Percentage (%)</option><option value="amount">Fixed amount (£)</option>
    </select></div>
      {type !== 'none' && <div><Label htmlFor="discount-value">{type === 'percentage' ? 'Discount percentage' : `Discount amount (${includingVat ? 'including VAT' : 'before VAT'})`}</Label><Input id="discount-value" className="mt-1.5" inputMode="decimal" required disabled={disabled} value={value?.value ?? ''} onChange={event => onChange({ ...value, type, value: event.target.value })} /></div>}
    </div>
    {type === 'amount' && <p className="text-xs text-muted-foreground">{includingVat ? 'This amount is the total reduction including VAT.' : 'This amount reduces the subtotal before VAT.'}</p>}
  </section>;
}

/** Use inside a totals definition list; every displayed amount comes from the server. */
export function SavedDiscountSummary({ money }) {
  const summary = money?.discount_adjustment ?? money?.discount;
  if (!summary) return null;
  const adjustment = Boolean(money.discount_adjustment);
  const basis = summary.price_basis === 'including_vat' ? 'including VAT' : 'before VAT';
  return <>
    <div className="flex justify-between gap-3"><dt>{adjustment ? 'Original total including VAT' : `Before discount (${basis})`}</dt><dd><Money value={summary.base_pence} /></dd></div>
    <div className="flex justify-between gap-3 text-primary"><dt>{adjustment ? 'Discount credit' : 'Discount'}{summary.type === 'percentage' ? ` (${summary.value}%)` : ''}</dt><dd>−<Money value={summary.amount_pence} /></dd></div>
    <div className="flex justify-between gap-3 border-b pb-2"><dt>{adjustment ? 'Original total less discount' : `After discount (${basis})`}</dt><dd><Money value={summary.after_pence} /></dd></div>
  </>;
}

export function DiscountBalanceReview({ original, item, money, dirty, loading, error, onRetry }) {
  const after = balanceAfterSavedCredit(item, money, dirty);
  return <section className="workspace-card order-2 space-y-3 p-5" aria-label="Discount balance review">
    <h2 className="text-sm font-semibold">Effect on the original balance</h2>
    <ErrorBox error={error} onRetry={onRetry} />
    {loading ? <SkeletonRows rows={2} /> : <dl className="space-y-2 text-sm">
      <div className="flex justify-between"><dt>Original total</dt><dd><Money value={original?.money?.gross_pence} /></dd></div>
      <div className="flex justify-between"><dt>Payments received / made</dt><dd><Money value={item?.paid_minor} /></dd></div>
      <div className="flex justify-between"><dt>Current remaining balance</dt><dd><Money value={item?.open_minor} /></dd></div>
      <div className="flex justify-between"><dt>Saved discount credit</dt><dd><Money value={!dirty ? money?.gross_pence : null} /></dd></div>
      {after !== null && <div className="flex justify-between border-t pt-2 font-semibold"><dt>Balance if posted</dt><dd><Money value={after} /></dd></div>}
    </dl>}
    {after !== null && BigInt(after) < 0n && <p role="alert" className="text-xs text-red-700">This discount exceeds the current remaining balance. Reduce it before posting.</p>}
    <p className="text-xs text-muted-foreground">{dirty || !money ? 'Save the draft to calculate the discount and its effect. ' : ''}This is a preview from the displayed balance. Posting checks the current outstanding amount again.</p>
  </section>;
}
