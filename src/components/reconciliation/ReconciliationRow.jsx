import React, { useState } from 'react';
import { gbp, fmtDate } from '@/lib/format';
import MatchTab from './MatchTab';
import CreateTab from './CreateTab';
import TransferTab from './TransferTab';
import DiscussTab from './DiscussTab';
import FindMatchView from './FindMatchView';

const txnAmount = (t) => Number(t.money_in || 0) + Number(t.money_out || 0);

const TABS = [
  { key: 'match', label: 'Match' },
  { key: 'create', label: 'Create' },
  { key: 'transfer', label: 'Transfer' },
  { key: 'discuss', label: 'Discuss' },
  { key: 'find', label: 'Find & Match' },
];

// Expanded workspace shown below the selected row. 45% bank / 55% actions.
export default function ReconciliationRow({
  transaction, suggestions, bankAccounts, companyId, onMatch, onCreate, onTransfer, onSplit, approving,
}) {
  const [tab, setTab] = useState('match');
  const t = transaction;
  const isIncome = Number(t.money_in || 0) > 0;
  const amount = txnAmount(t);

  return (
    <div className="flex flex-col md:flex-row md:items-start border-b border-[#E5E7EB] bg-muted/20">
      {/* LEFT — bank transaction (top-aligned, compact, no empty space) */}
      <div className="w-full md:w-[45%] p-3 border-r border-[#E5E7EB] bg-white">
        <p className="text-xs text-muted-foreground">{fmtDate(t.date)}</p>
        <p className="text-sm font-medium truncate mt-0.5">{t.description || 'Untitled transaction'}</p>
        <div className="flex items-baseline justify-between gap-2 mt-1">
          <p className="text-xs text-muted-foreground truncate">{t.bank_account_name}</p>
          <p className={`text-sm font-semibold tabular-nums flex-shrink-0 ${isIncome ? 'text-emerald-700' : 'text-rose-600'}`}>
            {isIncome ? '+' : '−'}{gbp(amount)}
          </p>
        </div>
        {t.reference && <p className="text-xs text-muted-foreground/70 mt-1">Ref {t.reference}</p>}
      </div>

      {/* RIGHT — reconciliation actions (55%, 220px) */}
      <div className="w-full md:w-[55%] md:h-[220px] flex flex-col bg-white">
        <div className="flex gap-4 border-b border-[#E5E7EB] px-3">
          {TABS.map((tb) => (
            <button
              key={tb.key}
              type="button"
              onClick={() => setTab(tb.key)}
              className={`py-1.5 text-sm transition-colors ${tab === tb.key ? 'text-foreground font-medium border-b-2 border-foreground -mb-px' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {tb.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {tab === 'match' && (
            <MatchTab
              transaction={t}
              suggestions={suggestions}
              onMatch={(rec) => onMatch(rec)}
              onSplit={onSplit}
              onFindMatch={() => setTab('find')}
              approving={approving}
            />
          )}
          {tab === 'create' && <CreateTab transaction={t} onCreate={onCreate} />}
          {tab === 'transfer' && <TransferTab transaction={t} bankAccounts={bankAccounts} onTransfer={onTransfer} />}
          {tab === 'discuss' && <DiscussTab transaction={t} companyId={companyId} />}
          {tab === 'find' && <FindMatchView transaction={t} onSelect={(rec) => onMatch(rec)} />}
        </div>
      </div>
    </div>
  );
}