import React from 'react';
import { gbp, fmtDate } from '@/lib/format';

const txnAmount = (t) => Number(t.money_in || 0) + Number(t.money_out || 0);

// The selected row becomes the bank transaction card — no duplicate inside the workspace.
export default function BankTransactionCard({ transaction, onSelect }) {
  const t = transaction;
  const isIncome = Number(t.money_in || 0) > 0;
  const amount = txnAmount(t);
  return (
    <div
      onClick={onSelect}
      className="relative px-4 py-2.5 border-b border-[#E5E7EB] border-l-2 border-l-foreground/30 bg-muted/30 cursor-pointer"
    >
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground">{fmtDate(t.date)}</span>
        <span className={`text-sm font-semibold tabular-nums ${isIncome ? 'text-emerald-700' : 'text-rose-600'}`}>
          {isIncome ? '+' : '−'}{gbp(amount)}
        </span>
      </div>
      <p className="text-sm font-medium mt-0.5 truncate">{t.description || 'Untitled transaction'}</p>
      <p className="text-xs text-muted-foreground truncate">{t.bank_account_name}{t.reference ? ` · Ref ${t.reference}` : ''}</p>
    </div>
  );
}