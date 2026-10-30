import { Link } from 'react-router-dom';
import { docPath, KINDS } from '@/api/accountingDocuments.mjs';
import PageHeader from '@/components/workspace/PageHeader';
import { Button } from '@/components/ui/button';
import { Money, ErrorBox, SkeletonRows } from '@/components/accounting/AccountingUI';
import { shortDate } from './model.mjs';

export default function JournalReview({ company, data, error, loading, onRetry }) {
  const entry = data?.entry, source = entry && docPath(entry.source_type, entry.source_id);
  const sourceLabel = KINDS[entry?.source_type]?.label.toLowerCase() || (entry?.source_type === 'accounting_payment_event' ? 'payment event' : 'source document');
  return <div className="workspace-page">
    <PageHeader eyebrow="Accounting evidence" title={entry?.reference || 'Journal entry'} description={entry?.description || 'The accounting entries behind a posted document or payment.'}
      context={<><span className="font-medium text-foreground">{company.name}</span>{entry && <><span aria-hidden="true">·</span><span>Posted {shortDate(entry.posting_date)}</span><span className="rounded-full border px-2 py-0.5 text-xs">{entry.status || 'Posted journal'}</span></>}</>}
      actions={<><Button asChild variant="outline"><Link to="/reports?tab=gl">General ledger</Link></Button>{source && <Button asChild><Link to={source} data-testid="link-source-doc">Open {sourceLabel}</Link></Button>}</>} />
    <ErrorBox error={error} onRetry={onRetry} />
    {loading && <div role="status" aria-label="Loading journal"><SkeletonRows /></div>}
    {data && <>
      <p className="text-sm text-muted-foreground">This is read-only evidence. Debit and credit entries are shown exactly as posted; later changes remain separate accounting events.</p>
      <div tabIndex={0} role="region" aria-label="Journal lines, scroll for more columns" className="overflow-x-auto rounded-xl border bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><table className="workspace-table">
        <caption className="sr-only">Journal {entry.reference || entry.id}. Debit and credit amounts in GBP.</caption>
        <thead><tr><th scope="col">Account</th><th scope="col">Source line</th><th scope="col" className="text-right">Debit</th><th scope="col" className="text-right">Credit</th></tr></thead>
        <tbody>{data.lines.map((line, index) => <tr key={line.id || index} data-testid={`row-journal-${index}`}><td><span className="font-mono text-xs text-muted-foreground">{line.account_code}</span> {line.account_name}</td><td className="text-xs text-muted-foreground">{line.source_line_ref ?? '—'}</td><td className="whitespace-nowrap text-right">{line.debit_minor === '0' ? '—' : <Money value={line.debit_minor} />}</td><td className="whitespace-nowrap text-right">{line.credit_minor === '0' ? '—' : <Money value={line.credit_minor} />}</td></tr>)}</tbody>
        <tfoot className="border-t bg-muted/30 font-semibold"><tr><th scope="row" colSpan={2} className="px-5 py-3 text-left">Posted totals</th><td className="whitespace-nowrap text-right"><Money value={entry.total_debit_minor} /></td><td className="whitespace-nowrap text-right"><Money value={entry.total_credit_minor} /></td></tr></tfoot>
      </table></div>
      <details className="workspace-card p-4"><summary className="cursor-pointer text-sm font-medium">Journal identifiers</summary><dl className="mt-3 space-y-2 text-xs text-muted-foreground"><div><dt>Journal ID</dt><dd className="break-all font-mono">{entry.id}</dd></div><div><dt>Source ID</dt><dd className="break-all font-mono">{entry.source_id}</dd></div></dl></details>
    </>}
  </div>;
}
