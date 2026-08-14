import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { gbp } from '@/lib/format';

const TYPE_LABELS = {
  sales_invoice: 'Invoice', purchase_bill: 'Bill',
  sales_credit_note: 'Credit note', supplier_credit_note: 'Credit note', ledger_account: 'Ledger',
};

const txnAmount = (t) => Number(t.money_in || 0) + Number(t.money_out || 0);

export default function MatchTab({ transaction, suggestions, onMatch, onSplit, onFindMatch, approving }) {
  const [whyOpen, setWhyOpen] = useState(false);
  const top = suggestions?.[0];
  const alternatives = (suggestions || []).slice(1);
  const amountDiff = top ? Math.abs(txnAmount(transaction) - (top.record_amount || 0)) : 0;

  if (!top) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">No suggested match. Use Find &amp; Match to search, or Create to categorise.</p>
        <div className="flex items-center gap-3 pt-2 border-t border-[#E5E7EB]">
          {onSplit && <button type="button" onClick={onSplit} className="text-sm text-muted-foreground hover:text-foreground">Split</button>}
          {onFindMatch && <button type="button" onClick={onFindMatch} className="text-sm text-muted-foreground hover:text-foreground">Find another match</button>}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Section 1 — Suggested match */}
      <div>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground/60">Suggested match</p>
        <p className="text-sm font-medium mt-0.5">{TYPE_LABELS[top.record_type]} {top.record_number}</p>
        <p className="text-sm text-muted-foreground">{top.record_name}</p>
        <p className="text-sm font-medium tabular-nums">{gbp(top.record_amount || txnAmount(transaction))}</p>
      </div>

      {/* Section 2 — Confidence + Why? */}
      <div className="mt-2 pt-2 border-t border-[#E5E7EB]">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Confidence: {Math.round(top.confidence)}%</span>
          <button type="button" onClick={() => setWhyOpen((v) => !v)} className="text-foreground hover:underline">
            {whyOpen ? 'Hide' : 'Why?'}
          </button>
        </div>
        {whyOpen && (
          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            {(top.reasons || []).map((r, i) => (
              <li key={i} className="flex gap-1.5"><span className="text-emerald-600">✓</span><span>{r}</span></li>
            ))}
            {amountDiff > 0.01 && (
              <li className="flex gap-1.5"><span className="text-amber-600">⚠</span><span>Payment amount differs by {gbp(amountDiff)}</span></li>
            )}
          </ul>
        )}
      </div>

      {/* Section 3 — Primary action */}
      <div className="mt-2 pt-2 border-t border-[#E5E7EB]">
        <Button size="sm" onClick={() => onMatch(top)} disabled={approving} className="h-8">{approving ? 'Approving…' : 'Approve'}</Button>
        <div className="mt-1.5 flex items-center gap-3">
          {onSplit && <button type="button" onClick={onSplit} className="text-sm text-muted-foreground hover:text-foreground">Split</button>}
          {onFindMatch && <button type="button" onClick={onFindMatch} className="text-sm text-muted-foreground hover:text-foreground">Find another match</button>}
        </div>
      </div>

      {/* Section 4 — Alternative matches */}
      {alternatives.length > 0 && (
        <div className="mt-2 pt-2 border-t border-[#E5E7EB]">
          <p className="text-xs text-muted-foreground/70">Alternative matches</p>
          <div className="mt-1 divide-y divide-[#E5E7EB]">
            {alternatives.map((alt) => (
              <div key={alt.record_id} className="flex items-center justify-between py-1.5 gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{TYPE_LABELS[alt.record_type]} {alt.record_number}</p>
                  <p className="text-xs text-muted-foreground truncate">{alt.record_name} · {gbp(alt.record_amount || txnAmount(transaction))}</p>
                </div>
                <button type="button" onClick={() => onMatch(alt)} className="text-sm text-foreground hover:underline flex-shrink-0">Match</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}