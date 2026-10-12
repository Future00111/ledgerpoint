import React from 'react';
import { Search, UserPlus, Truck, FileText, BarChart3, Sparkles } from 'lucide-react';

// Shown when a record search returns nothing. Explains the outcome and offers
// closest matches plus quick create / report / AI paths. Never an empty void.
export default function AskRecordsEmpty({
  query, similar,
  onPickSimilar, onCreateCustomer, onCreateSupplier, onSearchReports, onAskAI,
}) {
  return (
    <div className="px-4 sm:px-6 py-8">
      <div className="mx-auto w-10 h-10 rounded-xl bg-muted flex items-center justify-center mb-3">
        <Search className="w-4 h-4 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-center">No matching records found.</p>
      <p className="text-xs text-muted-foreground mt-1 text-center">
        We searched customers, suppliers, companies, invoices, bills, credit notes, bank transactions, documents, reports, VAT returns, journals, settings and help for “{query}”.
      </p>

      {similar && similar.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Closest matches</p>
          <div className="space-y-1">
            {similar.map((it, i) => (
              <button
                key={i}
                onClick={() => onPickSimilar(it)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted text-left text-sm"
              >
                <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-muted text-muted-foreground flex items-center justify-center">
                  <FileText className="w-3.5 h-3.5" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-medium text-foreground truncate">{it.label}</span>
                  <span className="block text-xs text-muted-foreground truncate">{it.sublabel}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <button
          onClick={onCreateCustomer}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-muted"
        >
          <UserPlus className="w-3.5 h-3.5" /> Create Customer
        </button>
        <button
          onClick={onCreateSupplier}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-muted"
        >
          <Truck className="w-3.5 h-3.5" /> Create Supplier
        </button>
        <button
          onClick={onSearchReports}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-muted"
        >
          <BarChart3 className="w-3.5 h-3.5" /> Search Reports
        </button>
        <button
          onClick={onAskAI}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/15"
        >
          <Sparkles className="w-3.5 h-3.5" /> Ask AI instead
        </button>
      </div>
    </div>
  );
}