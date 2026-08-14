import React from 'react';
import { gbp, fmtDate } from '@/lib/format';

const txnAmount = (t) => Number(t.money_in || 0) + Number(t.money_out || 0);

// Collapsed statement row — slim, click to expand.
export default function CompactRow({ transaction, onSelect }) {
  const t = transaction;
  const isIncome = Number(t.money_in || 0) > 0;
  const amount = txnAmount(t);
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full flex items-center gap-4 px-5 h-12 border border-[#cccccc] bg-white rounded-sm hover:border-[#007bff] hover:bg-[#fafbfc] transition-colors text-left"
    >
      <span className="text-sm text-[#666] w-[88px] flex-shrink-0 tabular-nums">{fmtDate(t.date)}</span>
      <p className="text-sm text-[#333] truncate flex-1 min-w-0 font-medium">{t.description || 'Untitled transaction'}</p>
      <span className="text-xs text-[#666] hidden md:block w-[150px] truncate flex-shrink-0">{t.bank_account_name}</span>
      <p className="text-sm text-[#333] tabular-nums w-[110px] text-right flex-shrink-0">{gbp(amount)}</p>
    </button>
  );
}