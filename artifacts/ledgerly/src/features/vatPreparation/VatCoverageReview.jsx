import { penceToDisplay } from '@/api/accountingDocuments.mjs';

export default function VatCoverageReview({ coverage }) {
  if (!coverage) return <div role="note" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950" data-testid="vat-coverage-unavailable">
    <p className="font-semibold">Coverage check unavailable</p>
    <p className="mt-1">Refresh these workings to load the server reconciliation. No complete-return or filing readiness has been confirmed.</p>
  </div>;
  return <section aria-labelledby="vat-coverage-title" className="rounded-xl border bg-card" data-testid="vat-coverage">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-4">
      <div><h3 id="vat-coverage-title" className="font-semibold">Workings reconciled · 5 of 9 boxes</h3>
        <p className="mt-1 text-sm text-muted-foreground">{coverage.movement_count} posted movements from {coverage.source_document_count} source documents match the supported boxes.</p>
        <p className="mt-2 text-xs text-muted-foreground">Boxes 2, 3, 8 and 9 remain unimplemented. Their amounts are unknown, not zero.</p></div>
      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">Filing unavailable</span>
    </div>
    <details className="group">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-primary">Coverage and reconciliation details</summary>
      <div className="space-y-4 px-4 pb-4">
        <div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm">
          <caption className="sr-only">Server reconciliation for each VAT return box. Unsupported amounts are unknown.</caption>
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground"><tr><th scope="col" className="px-3 py-2">Box</th><th scope="col" className="px-3 py-2">Coverage</th><th scope="col" className="px-3 py-2 text-right">Workings</th><th scope="col" className="px-3 py-2 text-right">Source evidence</th></tr></thead>
          <tbody>{coverage.boxes.map(box => <tr key={box.box} className="border-t" data-testid={`vat-coverage-box-${box.box}`}>
            <th scope="row" className="px-3 py-2 text-left font-medium">{box.box}</th>
            <td className="px-3 py-2 text-xs">{box.status === 'reconciled' ? 'Reconciled' : 'Not implemented'}</td>
            <td className="px-3 py-2 text-right font-mono text-xs">{box.amount_pence === null ? 'Unknown' : penceToDisplay(box.amount_pence)}</td>
            <td className="px-3 py-2 text-right font-mono text-xs">{box.source_total_pence === null ? 'Unknown' : penceToDisplay(box.source_total_pence)}</td>
          </tr>)}</tbody>
        </table></div>
        <div><h4 className="text-sm font-semibold">Current engine scope</h4><p className="mt-1 text-xs text-muted-foreground">These are implementation capabilities, not confirmation that every transaction in this period qualifies.</p>
          <ul className="mt-2 divide-y text-xs">{coverage.cases.map(item => <li key={item.id} className="flex flex-wrap justify-between gap-2 py-2"><span>{item.label}</span><span className={item.status === 'supported' ? 'font-medium' : 'font-medium text-amber-800'}>{item.status === 'supported' ? 'Supported scope' : 'Not supported'}</span></li>)}</ul>
        </div>
        <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-950"><h4 className="font-semibold">Before a return can be filed</h4><ul className="mt-2 list-disc space-y-1 pl-4">{coverage.blockers.map(item => <li key={item.code}>{item.message}</li>)}</ul></div>
      </div>
    </details>
  </section>;
}
