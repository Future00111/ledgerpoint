import React from 'react';
import { gbp, fmtDate } from '@/lib/format';

const txnAmount = (t) => Number(t.money_in || 0) + Number(t.money_out || 0);

// Compact statement row. Click to expand into the two-panel workspace.
export default function CompactRow({ transaction, onSelect }) {
  const t = transaction;
  const isIncome = Number(t.money_in || 0) > 0;
  const amount = txnAmount(t);
  return (
    <div
      onClick={onSelect}
      className="flex items-center gap-3 px-3 py-2 border-b border-[#E5E7EB] cursor-pointer hover:bg-muted/30 transition-colors"
    >
      <span className="text-xs text-muted-foreground w-[64px] flex-shrink-0 tabular-nums">{fmtDate(t.date)}</span>
      <p className="text-sm font-medium truncate flex-1 min-w-0">{t.description || 'Untitled transaction'}</p>
      <p className="text-xs text-muted-foreground truncate hidden md:block flex-shrink-0 max-w-[180px]">{t.bank_account_name}</p>
      <p className={`text-sm font-medium tabular-nums flex-shrink-0 ${isIncome ? 'text-emerald-700' : 'text-rose-600'}`}>{isIncome ? '+' : '−'}{gbp(amount)}</p>
    </div>
  );
}