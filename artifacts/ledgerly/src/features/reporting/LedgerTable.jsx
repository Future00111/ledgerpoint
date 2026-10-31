import { Link } from 'react-router-dom';
import { docPath, KINDS } from '@/api/accountingDocuments.mjs';
import { Money } from '@/components/accounting/AccountingUI';
import { columnTotals } from '@/lib/accountingEditor.mjs';
import EmptyState from '@/components/workspace/EmptyState';

export default function LedgerTable({ rows, from, to }) {
  const totals = columnTotals(rows);
  return <div tabIndex={0} role="region" aria-label="General ledger table, scroll for more columns" className="overflow-x-auto rounded-xl border bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
    <table className="workspace-table"><caption className="sr-only">Matching posted ledger lines from {from} to {to}. Amounts in GBP.</caption>
      <thead><tr>{['Date', 'Account', 'Document / event', 'Debit', 'Credit', 'Evidence'].map((h, i) => <th key={h} scope="col" className={i === 3 || i === 4 ? 'text-right' : ''}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((row, i) => <tr key={row.id || `${row.journal_id}-${i}`}>
        <td className="whitespace-nowrap tabular-nums">{row.posting_date}</td>
        <td><span className="font-mono text-xs text-muted-foreground">{row.account_code}</span><p>{row.account_name}</p></td>
        <td data-testid={`text-gl-number-${i}`}>{docPath(row.document_kind ?? row.source_type, row.document_id ?? row.source_id) ? <Link to={docPath(row.document_kind ?? row.source_type, row.document_id ?? row.source_id)} className="font-medium text-primary underline underline-offset-4">{row.source_number || 'Open source'}</Link> : <span>{row.source_number || 'Journal entry'}</span>}<p className="mt-1 text-xs text-muted-foreground">{row.movement_kind === 'financial_correction' ? 'Document correction' : KINDS[row.source_type]?.label || row.source_type?.replaceAll('_', ' ')}</p>{typeof row.description === 'string' && row.description.trim() && <details className="mt-2 max-w-md text-xs"><summary className="w-fit cursor-pointer rounded-sm text-primary underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Entry description<span className="sr-only"> for {row.source_number || 'journal entry'}, account {row.account_code}</span></summary><p className="mt-2 whitespace-pre-wrap break-words text-muted-foreground">{row.description}</p></details>}</td>
        <td className="whitespace-nowrap text-right"><Money value={row.debit_minor} /></td>
        <td className="whitespace-nowrap text-right"><Money value={row.credit_minor} /></td>
        <td><Link to={`/accounting/journals/${encodeURIComponent(row.journal_id)}`} aria-label={`View journal for ${row.source_number || 'this entry'}, account ${row.account_code}`} className="whitespace-nowrap text-sm font-medium text-primary underline underline-offset-4">View journal</Link></td>
      </tr>)}</tbody>
      {rows.length > 0 && <tfoot className="border-t bg-muted/40 font-semibold"><tr data-testid="totals-general-ledger"><th colSpan={3} scope="row" className="px-5 py-3 text-left">Matching movement totals</th><td className="whitespace-nowrap text-right"><Money value={totals.debit_minor} /></td><td className="whitespace-nowrap text-right"><Money value={totals.credit_minor} /></td><td /></tr></tfoot>}
    </table>
    {!rows.length && <EmptyState title="No posted entries match" description="Try another date range or clear the filters. Draft documents are not included in the ledger." />}
  </div>;
}
