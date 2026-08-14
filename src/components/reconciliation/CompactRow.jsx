import React from 'react';
import { gbp, fmtDate } from '@/lib/format';

const txnAmount = (t) => Number(t.money_in || 0) + Number(t.money_out || 0);

// 70px compact statement row. Stays the same when selected (subtle highlight only).
export default function CompactRow({ transaction, selected, onSelect }) {
  const t = transaction;
  const isIncome = Number(t.money_in || 0) > 0;
  const amount = txnAmount(t);
  return (
    <div
      onClick={onSelect}
      className={`relative flex items-center px-4 h-[70px] border-b border-[#E5E7EB] cursor-pointer transition-colors ${selected ? 'bg-muted/40' : 'hover:bg-muted/30'}`}
    >
      {selected && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary" />}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{t.description || 'Untitled transaction'}</p>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {fmtDate(t.date)} · {t.bank_account_name}{t.reference ? ` · Ref ${t.reference}` : ''}
        </p>
      </div>
      <p className={`text-sm font-semibold tabular-nums flex-shrink-0 ml-3 ${isIncome ? 'text-emerald-700' : 'text-rose-600'}`}>
        {isIncome ? '+' : '−'}{gbp(amount)}
      </p>
    </div>
  );
}