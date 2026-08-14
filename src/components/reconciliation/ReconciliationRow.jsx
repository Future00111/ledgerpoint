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

const TYPE_LABEL = { income: 'Money in', expense: 'Money out', transfer: 'Transfer' };

// One selected row expands inline into TWO ADJACENT BOXES: bank (52%) · actions (48%).
export default function ReconciliationRow({
  transaction, suggestions, bankAccounts, companyId, onMatch, onCreate, onTransfer, onSplit, onCollapse, approving,
}) {
  const [tab, setTab] = useState('match');
  const [more, setMore] = useState(false);
  const t = transaction;
  const isIncome = Number(t.money_in || 0) > 0;
  const amount = txnAmount(t);

  return (
    <div className="flex border-b border-[#E5E7EB] border-l-2 border-l-foreground/30 min-h-[160px]">
      {/* LEFT — bank transaction (52%) */}
      <div className="w-full md:w-[52%] p-3 border-r border-[#E5E7EB] bg-white flex flex-col relative">
        <button type="button" onClick={onCollapse} className="absolute top-2 right-2 text-muted-foreground hover:text-foreground" title="Collapse">
          <ChevronUp className="w-4 h-4" />
        </button>
        <p className="text-xs text-muted-foreground">{fmtDate(t.date)}</p>
        <div className="flex items-center justify-between gap-3 mt-1 pr-6">
          <p className="text-sm font-medium truncate flex-1">{t.description || 'Untitled transaction'}</p>
          <p className={`text-sm font-semibold tabular-nums flex-shrink-0 ${isIncome ? 'text-emerald-700' : 'text-rose-600'}`}>
            {isIncome ? '+' : '−'}{gbp(amount)}
          </p>
        </div>
        <p className="text-xs text-muted-foreground/70 mt-1">{t.reference ? `Ref ${t.reference}` : '\u00A0'}</p>
        <p className="text-xs text-muted-foreground truncate">{t.bank_account_name}</p>
        <div className="mt-auto pt-1">
          <button type="button" onClick={() => setMore((v) => !v)} className="text-xs text-foreground hover:underline">
            {more ? 'Hide details' : 'More details'}
          </button>
          {more && (
            <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
              <p>Type: {TYPE_LABEL[t.type] || '—'}</p>
              <p>Category: {t.category || '—'}</p>
              <p>Status: {t.status}</p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT — reconciliation actions (48%) */}
      <div className="w-full md:w-[48%] flex flex-col bg-white">
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
        <div className="p-3 flex-1">
          {tab === 'match' && (
            <MatchTab
              transaction={t}
              suggestions={suggestions}
              onMatch={(rec) => onMatch(rec)}
              onSplit={onSplit}
              onFindMatch={() => setTab('find')}
              onCategorise={() => setTab('create')}
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