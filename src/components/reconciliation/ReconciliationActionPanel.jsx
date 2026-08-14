import React from 'react';
import { Button } from '@/components/ui/button';
import { gbp, fmtDate } from '@/lib/format';

const TYPE_LABELS = {
  sales_invoice: 'Invoice', purchase_bill: 'Bill',
  sales_credit_note: 'Credit note', supplier_credit_note: 'Credit note', ledger_account: 'Ledger',
};

const txnAmount = (t) => Number(t.money_in || 0) + Number(t.money_out || 0);

function ConfidenceScore({ value }) {
  const pct = Math.round(value);
  const bar = value >= 80 ? 'bg-emerald-500' : value >= 50 ? 'bg-amber-500' : 'bg-rose-400';
  const tone = value >= 80 ? 'text-emerald-600' : value >= 50 ? 'text-amber-600' : 'text-rose-600';
  return (
    <div className="flex flex-col items-end flex-shrink-0">
      <span className={`text-xs font-medium ${tone}`}>{pct}%</span>
      <div className="mt-1 w-14 h-1 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// Right-hand decision panel. Only meaningful when a transaction is selected.
export default function ReconciliationActionPanel({
  transaction, suggestions, onApprove, onFindMatch, onSplit, onCategorise, approving,
}) {
  if (!transaction) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 p-10 text-center lg:sticky lg:top-4">
        <p className="text-sm text-muted-foreground">Select a transaction to reconcile.</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Its suggested match and actions will appear here.</p>
      </div>
    );
  }

  const t = transaction;
  const isIncome = Number(t.money_in || 0) > 0;
  const amount = txnAmount(t);
  const isMatched = t.status === 'matched';
  const top = suggestions?.[0];
  const alternatives = (suggestions || []).slice(1);
  const amountDiff = top ? Math.abs(amount - (top.record_amount || 0)) : 0;
  const meta = [fmtDate(t.date), t.bank_account_name, t.reference].filter(Boolean).join('  ·  ');

  return (
    <div className="rounded-lg border border-border/50 bg-card p-5 lg:sticky lg:top-4">
      <p className="text-xs text-muted-foreground/70">Bank transaction</p>
      <h2 className="text-base font-medium mt-0.5 truncate">{t.description || 'Untitled transaction'}</h2>
      <p className="text-xs text-muted-foreground/70 mt-1 truncate">{meta}</p>
      <p className={`text-lg font-semibold mt-2 ${isIncome ? 'text-emerald-700' : 'text-foreground'}`}>{isIncome ? '+' : '−'}{gbp(amount)}</p>

      <div className="h-px bg-border/40 my-4" />

      {isMatched ? (
        <div>
          <p className="text-xs text-muted-foreground/70">Reconciled</p>
          <p className="text-sm font-medium mt-1">{TYPE_LABELS[t.matched_type] || 'Record'} {t.matched_record_number}</p>
          <p className="text-xs text-muted-foreground mt-0.5">This transaction has already been reconciled.</p>
        </div>
      ) : top ? (
        <>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">AI suggested match</p>
          <div className="mt-2 rounded-lg border border-border/50 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{TYPE_LABELS[top.record_type]} {top.record_number}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{top.record_name}</p>
              </div>
              <ConfidenceScore value={top.confidence} />
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              <p className="text-muted-foreground/70">Why this transaction was matched:</p>
              <ul className="mt-1 space-y-0.5">
                {(top.reasons || []).map((r, i) => (
                  <li key={i} className="flex gap-1.5"><span className="text-emerald-600">✓</span><span>{r}</span></li>
                ))}
                {amountDiff > 0.01 && (
                  <li className="flex gap-1.5"><span className="text-amber-600">⚠</span><span>Payment amount differs by {gbp(amountDiff)}.</span></li>
                )}
              </ul>
            </div>
          </div>

          {alternatives.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-muted-foreground/70">Alternative matches ({alternatives.length})</p>
              <div className="mt-1.5 space-y-1.5">
                {alternatives.map((alt) => (
                  <div key={alt.record_id} className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{TYPE_LABELS[alt.record_type]} {alt.record_number}</p>
                      <p className="text-xs text-muted-foreground truncate">{alt.record_name} · {Math.round(alt.confidence)}%</p>
                    </div>
                    <button type="button" onClick={() => onApprove?.(alt)} className="text-xs text-foreground font-medium hover:underline ml-2 flex-shrink-0">Use</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div>
          <p className="text-sm text-muted-foreground">No suggested match found.</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Use <span className="text-foreground/80 font-medium">Find another match</span> to locate a record, or categorise this transaction.
          </p>
        </div>
      )}

      {!isMatched && (
        <>
          <div className="h-px bg-border/40 my-4" />
          <div className="flex items-center gap-2 flex-wrap">
            {top && (
              <Button variant="secondary" size="sm" onClick={() => onApprove?.(top)} disabled={approving} className="h-8">
                {approving ? 'Approving…' : 'Approve'}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => onFindMatch?.()} className="h-8 text-muted-foreground hover:text-foreground">Find another match</Button>
            <Button variant="ghost" size="sm" onClick={() => onSplit?.()} className="h-8 text-muted-foreground hover:text-foreground">Split</Button>
            <Button variant="ghost" size="sm" onClick={() => onCategorise?.()} className="h-8 text-muted-foreground hover:text-foreground">Categorise</Button>
          </div>
        </>
      )}
    </div>
  );
}