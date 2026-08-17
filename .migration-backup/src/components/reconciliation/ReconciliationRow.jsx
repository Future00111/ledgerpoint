import React, { useState } from 'react';
import { gbp, fmtDate } from '@/lib/format';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
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

// Expanded row = two adjacent cards (bank 42% · reconciliation 58%).
export default function ReconciliationRow({
  transaction, suggestions, bankAccounts, companyId, onMatch, onCreate, onTransfer, onSplit, onCollapse, approving,
}) {
  const [tab, setTab] = useState('match');
  const [more, setMore] = useState(false);
  const t = transaction;
  const isIncome = Number(t.money_in || 0) > 0;
  const amount = Number(t.money_in || 0) || Number(t.money_out || 0);

  return (
    <div className="flex border border-[#cccccc] bg-white rounded-sm overflow-hidden min-h-[260px]">
      {/* LEFT — bank transaction (42%) */}
      <div className="w-[42%] border-r border-[#cccccc] p-6 flex gap-6">
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-start justify-between">
            <p className="text-sm text-[#666]">{fmtDate(t.date)}</p>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="text-xs text-[#007bff] hover:underline inline-flex items-center gap-0.5">
                    Options <ChevronDown className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setMore((v) => !v)}>{more ? 'Hide details' : 'More details'}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTab('discuss')}>Discuss</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTab('find')}>Find &amp; Match</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <button type="button" onClick={onCollapse} className="text-[#666] hover:text-[#333]" title="Collapse">
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-sm text-[#333] font-medium break-words leading-snug">{t.description || 'Untitled transaction'}</p>
            <p className="text-sm text-[#666]">{t.bank_account_name}</p>
          </div>

          {more && (
            <div className="mt-2 space-y-1 text-xs text-[#666]">
              <p>Reference: {t.reference || '—'}</p>
              <p>Type: {t.type || '—'}</p>
              <p>Category: {t.category || '—'}</p>
            </div>
          )}

          <button type="button" onClick={() => setMore((v) => !v)} className="text-xs text-[#007bff] hover:underline mt-auto self-start pt-4">
            {more ? 'Hide details' : 'More details'}
          </button>
        </div>

        {/* Spent / Received + amount */}
        <div className="w-[120px] flex-shrink-0 flex flex-col">
          <div className="grid grid-cols-2 text-xs text-[#666]">
            <span className="text-right pr-2">Spent</span>
            <span className="text-right">Received</span>
          </div>
          <div className="grid grid-cols-2 mt-1 text-sm text-[#333] tabular-nums font-medium">
            <span className="text-right pr-2">{!isIncome ? gbp(amount) : ''}</span>
            <span className="text-right">{isIncome ? gbp(amount) : ''}</span>
          </div>
        </div>
      </div>

      {/* RIGHT — reconciliation action (58%) */}
      <div className="w-[58%] flex flex-col">
        <div className="flex border-b border-[#cccccc]">
          {TABS.map((tb) => (
            <button
              key={tb.key}
              type="button"
              onClick={() => setTab(tb.key)}
              className={`px-4 py-1.5 text-sm transition-colors ${tab === tb.key ? 'text-[#333] font-medium border-b-2 border-[#007bff] -mb-px' : 'text-[#666] hover:text-[#333]'}`}
            >
              {tb.label}
            </button>
          ))}
        </div>
        <div className="p-6 flex-1">
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