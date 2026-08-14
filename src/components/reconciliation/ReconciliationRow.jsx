import React, { useState } from 'react';
import { gbp, fmtDate } from '@/lib/format';
import { ChevronUp } from 'lucide-react';
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

// Expanded two-panel workspace for the selected transaction. Light, dense, thin borders.
export default function ReconciliationRow({
  transaction, suggestions, bankAccounts, companyId, onMatch, onCreate, onTransfer, onSplit, onCollapse, approving,
}) {
  const [tab, setTab] = useState('match');
  const t = transaction;
  const isIncome = Number(t.money_in || 0) > 0;
  const amount = txnAmount(t);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 border-b border-[#E5E7EB]">
      {/* LEFT — bank transaction */}
      <div className="p-3 border-r border-[#E5E7EB] flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{fmtDate(t.date)}</p>
          <p className="text-sm font-medium truncate">{t.description || 'Untitled transaction'}</p>
          <p className="text-xs text-muted-foreground truncate">{t.bank_account_name}{t.reference ? ` · Ref ${t.reference}` : ''}</p>
        </div>
        <p className={`text-sm font-semibold tabular-nums flex-shrink-0 ${isIncome ? 'text-emerald-700' : 'text-rose-600'}`}>
          {isIncome ? '+' : '−'}{gbp(amount)}
        </p>
        <button type="button" onClick={onCollapse} className="text-muted-foreground hover:text-foreground flex-shrink-0" title="Collapse">
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>

      {/* RIGHT — reconciliation actions */}
      <div className="p-3">
        <div className="flex gap-4 border-b border-[#E5E7EB]">
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
        <div className="pt-2.5">
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