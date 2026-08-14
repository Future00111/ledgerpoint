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

// A single self-contained reconciliation row: bank transaction (left) + actions (right).
export default function ReconciliationRow({
  transaction, suggestions, bankAccounts, companyId, onMatch, onCreate, onTransfer, onSplit, approving,
}) {
  const [tab, setTab] = useState('match');
  const t = transaction;
  const isIncome = Number(t.money_in || 0) > 0;
  const amount = txnAmount(t);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* LEFT — bank statement line */}
      <div className="rounded-lg border border-[#E5E7EB] bg-white p-5 flex flex-col justify-between min-h-[200px]">
        <div>
          <p className="text-xs text-muted-foreground">{fmtDate(t.date)}</p>
          <p className="text-lg font-semibold mt-1.5 leading-tight">{t.description || 'Untitled transaction'}</p>
          <p className="text-sm text-muted-foreground mt-1">{t.bank_account_name}</p>
          {t.reference && <p className="text-xs text-muted-foreground/70 mt-1.5">Ref {t.reference}</p>}
        </div>
        <p className={`text-lg font-semibold mt-4 text-right tabular-nums ${isIncome ? 'text-emerald-700' : 'text-rose-600'}`}>
          {isIncome ? '+' : '−'}{gbp(amount)}
        </p>
      </div>

      {/* RIGHT — reconciliation actions */}
      <div className="rounded-lg border border-[#E5E7EB] bg-white p-5 flex flex-col min-h-[200px]">
        <div className="flex gap-5 border-b border-[#E5E7EB]">
          {TABS.map((tb) => (
            <button
              key={tb.key}
              type="button"
              onClick={() => setTab(tb.key)}
              className={`py-2 text-sm transition-colors ${tab === tb.key ? 'text-foreground font-medium border-b-2 border-foreground -mb-px' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {tb.label}
            </button>
          ))}
        </div>
        <div className="pt-4 flex-1">
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