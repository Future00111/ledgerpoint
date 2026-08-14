import React from 'react';
import { gbp, fmtDate } from '@/lib/format';

const txnAmount = (t) => Number(t.money_in || 0) + Number(t.money_out || 0);

// Clean bank-statement row. No badges, no avatars, no buttons. Subtle selection.
export default function BankStatementRow({ transaction, selected, onSelect }) {
  const t = transaction;
  const isIncome = Number(t.money_in || 0) > 0;
  const amount = txnAmount(t);
  const meta = [t.reference, t.bank_account_name].filter(Boolean).join('  ·  ');
  const interactive = !!onSelect;

  return (
    <div
      id={`txn-${t.id}`}
      onClick={onSelect}
      className={`relative flex items-center gap-3 px-4 py-2.5 border-b border-border/40 last:border-b-0 transition-colors ${interactive ? 'cursor-pointer ' + (selected ? 'bg-primary/[0.04]' : 'hover:bg-muted/40') : ''}`}
    >
      {selected && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary" />}
      <span className="text-xs text-muted-foreground/70 w-[64px] flex-shrink-0 tabular-nums">{fmtDate(t.date)}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{t.description || 'Untitled transaction'}</p>
        {meta && <p className="text-xs text-muted-foreground/60 truncate">{meta}</p>}
      </div>
      <p className={`text-sm font-semibold flex-shrink-0 tabular-nums ${isIncome ? 'text-emerald-700' : 'text-rose-600'}`}>{isIncome ? '+' : '−'}{gbp(amount)}</p>
    </div>
  );
}