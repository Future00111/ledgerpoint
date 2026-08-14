import React from 'react';
import { gbp, fmtDate } from '@/lib/format';

const txnAmount = (t) => Number(t.money_in || 0) + Number(t.money_out || 0);

// Collapsed statement row — slim, single line, so 5–8 fit on screen.
export default function CompactRow({ transaction, onSelect }) {
  const t = transaction;
  const isIncome = Number(t.money_in || 0) > 0;
  const amount = txnAmount(t);
  return (
    <div
      onClick={onSelect}
      className="flex items-center gap-3 px-4 h-12 border-b border-[#E5E7EB] cursor-pointer hover:bg-muted/30 transition-colors"
    >
      <span className="text-xs text-muted-foreground w-[88px] flex-shrink-0 tabular-nums">{fmtDate(t.date)}</span>
      <p className="text-sm font-medium truncate flex-1 min-w-0">{t.description || 'Untitled transaction'}</p>
      <span className="text-xs text-muted-foreground hidden md:block w-[140px] truncate flex-shrink-0">{t.bank_account_name}</span>
      <p className={`text-sm font-semibold tabular-nums w-[104px] text-right flex-shrink-0 ${isIncome ? 'text-emerald-700' : 'text-rose-600'}`}>
        {isIncome ? '+' : '−'}{gbp(amount)}
      </p>
    </div>
  );
}