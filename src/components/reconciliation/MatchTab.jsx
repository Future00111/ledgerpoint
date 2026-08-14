import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { gbp } from '@/lib/format';
import FindMatchView from './FindMatchView';

const TYPE_LABELS = {
  sales_invoice: 'Invoice', purchase_bill: 'Bill',
  sales_credit_note: 'Credit note', supplier_credit_note: 'Credit note', ledger_account: 'Ledger',
};

const txnAmount = (t) => Number(t.money_in || 0) + Number(t.money_out || 0);

export default function MatchTab({ transaction, suggestions, onMatch, onSplit, approving }) {
  const [showFind, setShowFind] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);

  const top = suggestions?.[0];
  const alternatives = (suggestions || []).slice(1);
  const amountDiff = top ? Math.abs(txnAmount(transaction) - (top.record_amount || 0)) : 0;
  const confident = top ? top.confidence >= 80 : false;

  if (showFind) {
    return (
      <FindMatchView
        transaction={transaction}
        onSelect={(rec) => { onMatch(rec); setShowFind(false); }}
        onBack={() => setShowFind(false)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground/60">Suggested match</p>
        {top ? (
          <div className="mt-2">
            <p className="text-sm font-medium">{TYPE_LABELS[top.record_type]} {top.record_number}</p>
            <p className="text-sm text-muted-foreground">{top.record_name}</p>
            <p className="text-sm font-medium mt-1.5 tabular-nums">{gbp(top.record_amount || txnAmount(transaction))}</p>

            <div className="mt-2 flex items-center gap-2 text-xs">
              {confident
                ? <span className="text-muted-foreground">{Math.round(top.confidence)}% confidence</span>
                : <span className="text-muted-foreground">AI confidence · Low</span>}
              {!confident && (
                <button type="button" onClick={() => setWhyOpen((v) => !v)} className="text-foreground hover:underline">
                  {whyOpen ? 'Hide' : 'Why?'}
                </button>
              )}
            </div>

            {((confident) || (!confident && whyOpen)) && (
              <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                {(top.reasons || []).map((r, i) => <li key={i}>{r}</li>)}
                {amountDiff > 0.01 && <li className="text-amber-600">Payment amount differs by {gbp(amountDiff)}</li>}
              </ul>
            )}

            <div className="mt-3">
              <Button size="sm" onClick={() => onMatch(top)} disabled={approving} className="h-8">
                {approving ? 'Matching…' : 'Match'}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground mt-2">No confident match found. Use Find &amp; match to search records.</p>
        )}
      </div>

      <button type="button" onClick={() => setShowFind(true)} className="text-sm text-foreground hover:underline">
        Find &amp; match
      </button>

      {alternatives.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground/70">Other possible matches</p>
          <div className="mt-1.5 divide-y divide-border/40">
            {alternatives.map((alt) => (
              <div key={alt.record_id} className="flex items-center justify-between py-2 gap-3">
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

      {onSplit && (
        <div className="pt-3 border-t border-border/40">
          <button type="button" onClick={onSplit} className="text-sm text-muted-foreground hover:text-foreground">Split</button>
        </div>
      )}
    </div>
  );
}