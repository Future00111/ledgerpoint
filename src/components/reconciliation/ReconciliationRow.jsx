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

// One selected row expands inline into two side-by-side panels: bank (left) · actions (right).
export default function ReconciliationRow({
  transaction, suggestions, bankAccounts, companyId, onMatch, onCreate, onTransfer, onSplit, onCollapse, approving,
}) {
  const [tab, setTab] = useState('match');
  const [more, setMore] = useState(false);
  const t = transaction;
  const isIncome = Number(t.money_in || 0) > 0;
  const amount = txnAmount(t);

  return (
    <div className="flex border-b border-[#E5E7EB] bg-muted/20 border-l-2 border-l-foreground/30">
      {/* LEFT — bank transaction (48%) */}
      <div className="w-full md:w-[48%] p-3 border-r border-[#E5E7EB] bg-white relative">
        <button type="button" onClick={onCollapse} className="absolute top-2 right-2 text-muted-foreground hover:text-foreground" title="Collapse">
          <ChevronUp className="w-4 h-4" />
        </button>
        <div className="flex items-baseline justify-between gap-2 pr-6">
          <span className="text-xs text-muted-foreground">{fmtDate(t.date)}</span>
          <span className={`text-sm font-semibold tabular-nums ${isIncome ? 'text-emerald-700' : 'text-rose-600'}`}>
            {isIncome ? '+' : '−'}{gbp(amount)}
          </span>
        </div>
        <p className="text-sm font-medium truncate mt-0.5">{t.description || 'Untitled transaction'}</p>
        <p className="text-xs text-muted-foreground truncate">{t.bank_account_name}</p>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-xs text-muted-foreground/70 truncate">{t.reference ? `Ref ${t.reference}` : '\u00A0'}</p>
          <span className="text-[11px] text-muted-foreground/60">{TYPE_LABEL[t.type] || ''}</span>
        </div>
        <button type="button" onClick={() => setMore((v) => !v)} className="text-xs text-foreground hover:underline mt-1">
          {more ? 'Hide details' : 'More details'}
        </button>
        {more && (
          <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            <p>Category: {t.category || '—'}</p>
            <p>VAT: {t.vat_rate || '0'}%</p>
            <p>Status: {t.status}</p>
          </div>
        )}
      </div>

      {/* RIGHT — reconciliation actions (52%) */}
      <div className="w-full md:w-[52%] flex flex-col bg-white">
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
        <div className="p-3">
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