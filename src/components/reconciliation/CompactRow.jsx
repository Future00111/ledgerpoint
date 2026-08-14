import React from 'react';
import { gbp, fmtDate } from '@/lib/format';

const txnAmount = (t) => Number(t.money_in || 0) + Number(t.money_out || 0);

// 70px compact statement row.
export default function CompactRow({ transaction, onSelect }) {
  const t = transaction;
  const isIncome = Number(t.money_in || 0) > 0;
  const amount = txnAmount(t);
  return (
    <div
      onClick={onSelect}
      className="flex items-center px-4 h-[70px] border-b border-[#E5E7EB] cursor-pointer hover:bg-muted/30 transition-colors"
    >
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