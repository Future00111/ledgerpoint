import React, { useState } from 'react';
import { gbp, fmtDate } from '@/lib/format';
import MatchTab from './MatchTab';
import CreateTab from './CreateTab';
import TransferTab from './TransferTab';
import DiscussTab from './DiscussTab';

const txnAmount = (t) => Number(t.money_in || 0) + Number(t.money_out || 0);

const TABS = [
  { key: 'match', label: 'Match' },
  { key: 'create', label: 'Create' },
  { key: 'transfer', label: 'Transfer' },
  { key: 'discuss', label: 'Discuss' },
];

// Right-hand accounting workspace. Only meaningful when a transaction is selected.
export default function ReconciliationPanel({
  transaction, suggestions, bankAccounts, companyId, onMatch, onCreate, onTransfer, onSplit, approving,
}) {
  const [tab, setTab] = useState('match');

  if (!transaction) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 p-12 text-center lg:sticky lg:top-4">
        <p className="text-sm text-muted-foreground">Select a transaction to reconcile.</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Its suggested match and actions will appear here.</p>
      </div>
    );
  }

  const isIncome = Number(transaction.money_in || 0) > 0;
  const amount = txnAmount(transaction);

  return (
    <div className="rounded-lg border border-border/60 bg-card lg:sticky lg:top-4">
      {/* Compact transaction header */}
      <div className="px-5 pt-4 pb-3 border-b border-border/40">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground/60">Reconcile</p>
        <div className="flex items-baseline justify-between gap-3 mt-1">
          <p className="text-sm font-medium truncate">{transaction.description || 'Untitled transaction'}</p>
          <p className={`text-base font-semibold tabular-nums flex-shrink-0 ${isIncome ? 'text-emerald-700' : 'text-rose-600'}`}>{isIncome ? '+' : '−'}{gbp(amount)}</p>
        </div>
        <p className="text-xs text-muted-foreground/60 mt-1">{fmtDate(transaction.date)} · {transaction.bank_account_name}</p>
      </div>

      {/* Tabs */}
      <div className="px-5 flex gap-5 border-b border-border/40">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`py-2.5 text-sm transition-colors ${tab === t.key ? 'text-foreground font-medium border-b-2 border-foreground -mb-px' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Active tab content */}
      <div className="px-5 py-4">
        {tab === 'match' && (
          <MatchTab transaction={transaction} suggestions={suggestions} onMatch={onMatch} onSplit={onSplit} approving={approving} />
        )}
        {tab === 'create' && <CreateTab transaction={transaction} onCreate={onCreate} />}
        {tab === 'transfer' && <TransferTab transaction={transaction} bankAccounts={bankAccounts} onTransfer={onTransfer} />}
        {tab === 'discuss' && <DiscussTab transaction={transaction} companyId={companyId} />}
      </div>
    </div>
  );
}