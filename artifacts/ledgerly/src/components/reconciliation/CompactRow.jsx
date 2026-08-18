import React from 'react';
import { gbp, fmtDate } from '@/lib/format';
import { ChevronDown } from 'lucide-react';

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
      className="w-full flex items-center gap-4 px-6 py-4 bg-white hover:bg-slate-50 hover:shadow-inner transition-all text-left group"
    >
      <span className="text-sm text-slate-500 w-[100px] flex-shrink-0 tabular-nums font-medium">
        {fmtDate(t.date)}
      </span>
      <div className="flex-1 min-w-0 pr-4">
        <p className="text-sm text-slate-900 truncate font-semibold group-hover:text-[#007bff] transition-colors">
          {t.description || 'Untitled transaction'}
        </p>
      </div>
      <span className="text-sm text-slate-500 hidden md:block w-[160px] truncate flex-shrink-0">
        {t.bank_account_name}
      </span>
      <p className={`text-sm tabular-nums w-[110px] text-right flex-shrink-0 font-bold ${isIncome ? 'text-emerald-600' : 'text-slate-900'}`}>
        {isIncome ? '+' : '-'}{gbp(amount).replace('£', '£ ')}
      </p>
      <div className="w-8 flex justify-end text-slate-300 group-hover:text-[#007bff] transition-colors">
        <ChevronDown className="w-4 h-4" />
      </div>
    </button>
  );
}
