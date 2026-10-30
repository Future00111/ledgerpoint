import { Link } from 'react-router-dom';
import { docPath } from '@/api/accountingDocuments.mjs';
import { Money, JournalLink } from '@/components/accounting/AccountingUI';
import EmptyState from '@/components/workspace/EmptyState';
import { BookOpen } from 'lucide-react';

export default function StatementMovements({ rows }) {
  if (!rows.length) return <EmptyState icon={BookOpen} title="No movements in this period" description="The opening balances are retained. Choose another period to see earlier or later activity." />;
  return <>
    <ul className="divide-y md:hidden" aria-label="Statement movements">{rows.map(row => <li key={row.source_id} className="space-y-4 p-4">
      <div><Link to={docPath(row.source_type, row.source_id)} className="break-words font-medium text-primary underline underline-offset-4">{row.number}</Link><p className="mt-1 text-xs text-muted-foreground">{row.date} · {(row.payment_kind || row.source_type).replaceAll('_', ' ')}</p></div>
      <dl className="space-y-2 text-sm">{[['Document change', row.balance_effect_minor], ['Unapplied change', row.unapplied_effect_minor || '0'], ['Document balance', row.running_balance_minor], ['Unapplied balance', row.running_unapplied_minor]].map(([label, value]) => <div className="flex flex-wrap justify-between gap-2" key={label}><dt className="text-muted-foreground">{label}</dt><dd><Money value={value} /></dd></div>)}</dl><JournalLink id={row.journal_id} />
    </li>)}</ul>
    <div className="hidden overflow-auto md:block" role="region" tabIndex={0} aria-label="Statement movements table"><table className="workspace-table"><caption className="sr-only">Posted movements and running document and unapplied balances</caption><thead><tr>{['Date', 'Reference / event', 'Document change', 'Unapplied change', 'Document balance', 'Unapplied balance', 'Journal'].map((heading, index) => <th scope="col" key={heading} className={index > 1 && index < 6 ? '!text-right' : ''}>{heading}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.source_id}>
      <td className="whitespace-nowrap">{row.date}</td><td className="min-w-40"><Link to={docPath(row.source_type, row.source_id)} className="font-medium text-primary underline underline-offset-4">{row.number}</Link><p className="mt-1 text-xs text-muted-foreground">{(row.payment_kind || row.source_type).replaceAll('_', ' ')}</p></td>
      {[row.balance_effect_minor, row.unapplied_effect_minor || '0', row.running_balance_minor, row.running_unapplied_minor].map((value, index) => <td className="whitespace-nowrap text-right" key={index}><Money value={value} /></td>)}<td><JournalLink id={row.journal_id} /></td>
    </tr>)}</tbody></table></div>
  </>;
}
