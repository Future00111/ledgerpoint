import React, { useState } from 'react';
import MatchTab from './MatchTab';
import CreateTab from './CreateTab';
import TransferTab from './TransferTab';
import DiscussTab from './DiscussTab';
import FindMatchView from './FindMatchView';

const TABS = [
  { key: 'match', label: 'Match' },
  { key: 'create', label: 'Create' },
  { key: 'transfer', label: 'Transfer' },
  { key: 'discuss', label: 'Discuss' },
  { key: 'find', label: 'Find & Match' },
];

// Reconciliation actions panel shown below the selected bank card. No internal scroll.
export default function ReconciliationRow({
  transaction, suggestions, bankAccounts, companyId, onMatch, onCreate, onTransfer, onSplit, approving,
}) {
  const [tab, setTab] = useState('match');
  return (
    <div className="px-4 py-2.5 border-b border-[#E5E7EB] bg-white">
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
      <div className="pt-2">
        {tab === 'match' && (
          <MatchTab
            transaction={transaction}
            suggestions={suggestions}
            onMatch={(rec) => onMatch(rec)}
            onSplit={onSplit}
            onFindMatch={() => setTab('find')}
            approving={approving}
          />
        )}
        {tab === 'create' && <CreateTab transaction={transaction} onCreate={onCreate} />}
        {tab === 'transfer' && <TransferTab transaction={transaction} bankAccounts={bankAccounts} onTransfer={onTransfer} />}
        {tab === 'discuss' && <DiscussTab transaction={transaction} companyId={companyId} />}
        {tab === 'find' && <FindMatchView transaction={transaction} onSelect={(rec) => onMatch(rec)} />}
      </div>
    </div>
  );
}