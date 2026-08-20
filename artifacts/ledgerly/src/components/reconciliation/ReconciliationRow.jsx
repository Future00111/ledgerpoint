import React, { useState } from 'react';
import { gbp, fmtDate } from '@/lib/format';
import { ChevronUp, MoreHorizontal, MessageSquare, Search, Sparkles } from 'lucide-react';
import ExplainDialog from '@/components/ai-accountant/ExplainDialog';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import MatchTab from './MatchTab';
import CreateTab from './CreateTab';
import TransferTab from './TransferTab';
import DiscussTab from './DiscussTab';
import FindMatchView from './FindMatchView';
import { motion, AnimatePresence } from 'framer-motion';

const TABS = [
  { key: 'match', label: 'Match' },
  { key: 'create', label: 'Create' },
  { key: 'transfer', label: 'Transfer' },
  { key: 'discuss', label: 'Discuss' },
  { key: 'find', label: 'Find & Match' },
];

export default function ReconciliationRow({
  transaction, suggestions, aiRecon, categorySuggestion, analysisDecision, bankAccounts, companyId, onMatch, onMatchMany, onCreate, onTransfer, onSplit, onCollapse, approving,
}) {
  const [tab, setTab] = useState('match');
  const [more, setMore] = useState(false);
  const [explainOpen, setExplainOpen] = useState(false);
  const t = transaction;
  const isIncome = Number(t.money_in || 0) > 0;
  const amount = Number(t.money_in || 0) || Number(t.money_out || 0);
  const decisionStyle = {
    READY: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    POSSIBLE_DUPLICATE: 'bg-rose-50 text-rose-700 border-rose-200',
    VAT_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200',
    PARTIAL_MATCH: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    MULTI_MATCH: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    NO_MATCH: 'bg-slate-100 text-slate-700 border-slate-200',
  }[analysisDecision?.state] || 'bg-slate-100 text-slate-600 border-slate-200';

  return (
    <div className="flex flex-col md:flex-row relative">
      <ExplainDialog transactionId={t.id} open={explainOpen} onClose={() => setExplainOpen(false)} />
      {/* LEFT — bank transaction */}
      <div className="md:w-[42%] border-b md:border-b-0 md:border-r border-slate-200 bg-slate-50/70 p-6 flex flex-col">
        <div className="flex items-start justify-between mb-5">
          <div className="space-y-1.5">
            <span className="inline-block px-2.5 py-1 bg-slate-200/70 text-slate-700 text-[10px] font-bold uppercase tracking-widest rounded-md shadow-sm">
              {fmtDate(t.date)}
            </span>
            <p className="text-xs text-slate-500 font-medium">{t.bank_account_name}</p>
          </div>
          
          <div className="flex items-center gap-1 -mr-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:bg-slate-200/50">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setMore((v) => !v)}>
                  {more ? 'Hide extended details' : 'Show extended details'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setExplainOpen(true)} data-testid="menu-explain-this">
                  <Sparkles className="w-4 h-4 mr-2 text-slate-400" /> Explain this
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTab('discuss')}>
                  <MessageSquare className="w-4 h-4 mr-2 text-slate-400" /> Discuss
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTab('find')}>
                  <Search className="w-4 h-4 mr-2 text-slate-400" /> Find & Match
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon" onClick={onCollapse} className="h-8 w-8 text-slate-500 hover:bg-slate-200/50" title="Collapse">
              <ChevronUp className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="mb-4">
          <h3 className="text-lg font-bold text-slate-900 leading-snug">{t.description || 'Untitled transaction'}</h3>
          {analysisDecision?.state && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${decisionStyle}`}>
                {analysisDecision.state.replace(/_/g, ' ')}
              </span>
              {analysisDecision.priority_band === 'high' && (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-rose-600">High priority</span>
              )}
            </div>
          )}
          <p className={`mt-1.5 text-2xl font-black tabular-nums tracking-tight ${isIncome ? 'text-emerald-600' : 'text-slate-900'}`}>
            {isIncome ? '+' : '-'}{gbp(amount).replace('£', '£ ')}
            <span className="ml-2 align-middle text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              {isIncome ? 'Received' : 'Spent'}
            </span>
          </p>
        </div>

        <div className="pt-4 border-t border-slate-200/80 space-y-2.5 text-sm text-slate-600">
          <div className="grid grid-cols-[80px_1fr] gap-2">
            <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Reference</span>
            <span className="break-all font-medium">{t.reference || '—'}</span>
          </div>
          <div className="grid grid-cols-[80px_1fr] gap-2">
            <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Type</span>
            <span className="font-medium">{t.type || '—'}</span>
          </div>
          <AnimatePresence initial={false}>
            {more && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-2.5 pt-0.5">
                  <div className="grid grid-cols-[80px_1fr] gap-2">
                    <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Category</span>
                    <span className="font-medium">{t.category || '—'}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMore(!more)}
            className="text-[#007bff] hover:bg-blue-50 h-7 -ml-2 font-semibold text-xs transition-colors"
          >
            {more ? 'Hide details' : 'More details'}
          </Button>
        </div>
      </div>

      {/* RIGHT — reconciliation action */}
      <div className="md:w-[58%] flex flex-col min-w-0 bg-white">
        <div className="flex border-b border-slate-200 px-3 pt-3 bg-slate-50/40 overflow-x-auto no-scrollbar">
          {TABS.map((tb) => (
            <button
              key={tb.key}
              type="button"
              onClick={() => setTab(tb.key)}
              className={`px-4 py-2.5 text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${
                tab === tb.key 
                  ? 'text-[#007bff] border-[#007bff]' 
                  : 'text-slate-500 border-transparent hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>
        <div className="p-6 flex-1 relative min-h-[300px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {tab === 'match' && (
                <MatchTab
                  transaction={t}
                  suggestions={suggestions}
                  aiRecon={aiRecon}
                  categorySuggestion={categorySuggestion}
                  onMatchMany={onMatchMany}
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
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
