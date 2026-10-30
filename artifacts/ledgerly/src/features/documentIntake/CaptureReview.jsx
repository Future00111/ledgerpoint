import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ErrorBox, SkeletonRows } from '@/components/accounting/AccountingUI';
import { allAcknowledged, capturePath } from './model.mjs';
import { SourceCard } from './SourceFiles';

export function CaptureSourceReview({ capture, companyId }) {
  return <section className="workspace-card space-y-3 p-5" aria-label="Source review"><div><h2 className="font-semibold">Prepare from source file</h2><p className="mt-1 text-sm text-muted-foreground">Download and check the source while entering the details below. Automatic extraction and email intake are not connected. No fields have been extracted.</p></div><ErrorBox error={capture.error} onRetry={capture.refresh} />{capture.loading ? <SkeletonRows rows={2} /> : capture.source ? <><SourceCard source={capture.source} companyId={companyId} compact />{capture.source.document_id && <p className="text-sm">This file already has a linked document. <Link className="text-primary underline" to={capturePath(capture.source)}>Open the existing document</Link>.</p>}{!capture.canManage && !capture.source.document_id && <p className="text-sm text-muted-foreground">You can view the source, but preparing a draft requires editing permission.</p>}</> : null}</section>;
}

export function CaptureDraftActions({ capture, canEdit, invalid = false }) {
  if (!canEdit || !capture.canManage) return null;
  const reviewed = Boolean(capture.currentReview);
  const fields = [['source_reviewed', 'I checked the entered lines and totals against the source file.'], ['supplier_confirmed', 'I confirmed the supplier and document reference.'], ['tax_treatment_confirmed', 'I checked the VAT codes, price basis and VAT recovery treatment.']];
  return <section className="space-y-3" aria-label="Review source before saving">
    <Button type="submit" name="capture_action" value="review" variant={reviewed ? 'outline' : 'default'} className="w-full" disabled={capture.busy || invalid}>{capture.busy ? 'Working…' : reviewed ? 'Review details again' : 'Review details & totals'}</Button>
    {reviewed ? <><fieldset disabled={capture.busy} className="space-y-3 rounded-lg border p-3"><legend className="px-1 text-sm font-semibold">Confirm your review</legend>{fields.map(([field, label]) => <label key={field} className="flex gap-2 text-sm"><input type="checkbox" checked={capture.acknowledgements[field]} onChange={event => capture.acknowledge(field, event.target.checked)} className="mt-1" /><span>{label}</span></label>)}</fieldset><Button type="submit" name="capture_action" value="save" className="w-full" disabled={capture.busy || invalid || !allAcknowledged(capture.acknowledgements)}>Save linked draft</Button></> : <p className="text-xs text-muted-foreground">Review the current details to calculate authoritative totals. Any edit requires another review.</p>}
    <p className="text-xs text-muted-foreground">Saving links this file to a draft. You will review and post that saved draft separately.</p>
  </section>;
}
