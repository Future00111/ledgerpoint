import React from 'react';
import { gbp } from '@/lib/format';
import { Search, PlusCircle, Split, FileText, CheckCircle2, ArrowRight, Sparkles, AlertTriangle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STATUS_STYLES = {
  green: { icon: CheckCircle2, dot: 'bg-emerald-500', text: 'text-emerald-700', chip: 'bg-emerald-50 border-emerald-200', label: 'Ready for approval' },
  amber: { icon: AlertTriangle, dot: 'bg-amber-400', text: 'text-amber-700', chip: 'bg-amber-50 border-amber-200', label: 'Review required' },
  red: { icon: XCircle, dot: 'bg-red-500', text: 'text-red-700', chip: 'bg-red-50 border-red-200', label: 'Investigation required' },
};

function AiSummaryCard({ recon, onApprove, approving }) {
  const s = STATUS_STYLES[recon.status] || STATUS_STYLES.red;
  const StatusIcon = s.icon;
  const fullyMatched = recon.status === 'green' && recon.matched_records?.length > 0;
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50/80 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[#007bff]" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">AI Reconciliation Summary</span>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 border rounded-full text-[10px] font-black uppercase tracking-widest ${s.chip} ${s.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
          {s.label}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 border-b border-slate-100">
        {[
          ['Bank transaction', gbp(recon.transaction_amount)],
          ['Invoices matched', gbp(recon.matched_total)],
          ['Still to identify', recon.remaining > 0 ? gbp(recon.remaining) : '—'],
          ['AI Confidence', `${Math.round(recon.confidence)}%`],
        ].map(([label, value]) => (
          <div key={label} className="px-4 py-3">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
            <p className="text-sm font-black text-slate-900 tabular-nums">{value}</p>
          </div>
        ))}
      </div>
      {recon.matched_records?.length > 0 && (
        <div className="px-4 py-3 space-y-1.5">
          {recon.matched_records.map((m) => (
            <div key={m.record_id} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-slate-700 font-medium min-w-0">
                <StatusIcon className={`w-3.5 h-3.5 flex-shrink-0 ${s.text}`} />
                <span className="truncate">{m.record_number} · {m.record_name}</span>
              </span>
              <span className="font-bold tabular-nums text-slate-900 ml-3">{gbp(m.record_amount)}</span>
            </div>
          ))}
        </div>
      )}
      {recon.remaining > 0 && recon.potential_matches?.length > 0 && (
        <div className="px-4 py-3 border-t border-slate-100 bg-amber-50/30">
          <p className="text-[9px] font-bold uppercase tracking-widest text-amber-700 mb-2">
            Potential invoices for the remaining {gbp(recon.remaining)}
          </p>
          <div className="space-y-1.5">
            {recon.potential_matches.map((p) => (
              <div key={p.record_id} className="flex items-center justify-between text-sm">
                <span className="text-slate-700 font-medium truncate min-w-0">
                  <span className="text-amber-700 font-bold mr-2">{Math.round(p.confidence)}%</span>
                  {p.record_number} · {p.record_name}
                </span>
                <span className="font-bold tabular-nums text-slate-900 ml-3">{gbp(p.record_amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {(recon.possible_explanations?.length > 0 || recon.explanation || recon.recommendation) && (
        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 space-y-2">
          {recon.scenario === 'overpayment' && (
            <p className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-orange-200 bg-orange-50 text-orange-700 rounded-full text-[10px] font-black uppercase tracking-widest">
              <AlertTriangle className="w-3 h-3" /> Possible overpayment of {gbp(recon.remaining)}
            </p>
          )}
          {(recon.explanation || recon.recommendation) && (
            <p className="text-sm text-slate-700 font-medium">{recon.explanation || recon.recommendation}</p>
          )}
          {recon.possible_explanations?.length > 0 && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Possible explanations</p>
              <ul className="space-y-1">
                {recon.possible_explanations.map((ex, i) => (
                  <li key={i} className="flex gap-2 text-xs text-slate-600 font-medium">
                    <span className="w-1 h-1 rounded-full bg-slate-400 mt-1.5 flex-shrink-0" />
                    <span>{ex}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {fullyMatched && (
        <div className="px-4 pb-4">
          <Button
            onClick={() => onApprove(recon.matched_records)}
            disabled={approving}
            className="bg-[#007bff] hover:bg-[#0062cc] text-white shadow-md shadow-blue-500/20 font-bold px-6 h-10 disabled:opacity-70 transition-all"
          >
            {approving ? 'Approving…' : `Approve ${recon.matched_records.length} matched ${recon.matched_records.length === 1 ? 'record' : 'records'}`}
          </Button>
        </div>
      )}
    </div>
  );
}

const TYPE_LABELS = {
  sales_invoice: 'Invoice', purchase_bill: 'Bill',
  sales_credit_note: 'Credit note', supplier_credit_note: 'Credit note', ledger_account: 'Ledger',
};

const txnAmount = (t) => Number(t.money_in || 0) + Number(t.money_out || 0);

export default function MatchTab({ transaction, suggestions, aiRecon, categorySuggestion, onMatch, onMatchMany, onSplit, onFindMatch, onCategorise, approving }) {
  const top = suggestions?.[0];
  const alternatives = (suggestions || []).slice(1);
  const amountDiff = top ? Math.abs(txnAmount(transaction) - (top.record_amount || 0)) : 0;

  // Show the AI summary card when the engine found a multi-record combination,
  // a partial reconciliation with revenue still to identify, or potential
  // invoices worth reviewing.
  const multiCombo = (aiRecon?.matched_records?.length || 0) > 1;
  const showAiSummary = aiRecon && (
    multiCombo ||
    (aiRecon.status === 'amber' && ((aiRecon.matched_records?.length || 0) > 0 || (aiRecon.potential_matches?.length || 0) > 0))
  );

  if (!top) {
    return (
      <div className="space-y-6">
      {showAiSummary && <AiSummaryCard recon={aiRecon} onApprove={onMatchMany} approving={approving} />}
      <div className="flex flex-col items-center justify-center py-10 px-4 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
        <div className="bg-white w-14 h-14 rounded-full flex items-center justify-center mb-4 shadow-sm border border-slate-100">
          <Search className="w-6 h-6 text-slate-400" />
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 mb-3 border rounded-full text-[10px] font-black uppercase tracking-widest bg-red-50 border-red-200 text-red-700">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
          Investigation required
        </span>
        <h3 className="text-base font-bold text-slate-900 mb-1.5">No automatic match found</h3>
        <p className="text-sm text-slate-500 mb-6 max-w-[280px]">
          We couldn't confidently match this transaction to an existing record.
        </p>
        {categorySuggestion && (
          <div className="mb-6 inline-flex items-center gap-2 px-3 py-1.5 border border-blue-200 bg-blue-50 rounded-full">
            <Sparkles className="w-3.5 h-3.5 text-[#007bff]" />
            <span className="text-xs font-bold text-slate-700">
              Suggested category: {categorySuggestion.category}
            </span>
            <span className="text-[10px] font-black text-[#007bff]">{Math.round(categorySuggestion.confidence)}%</span>
          </div>
        )}
        <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3 w-full max-w-sm">
          {onFindMatch && (
            <Button variant="outline" className="w-full sm:flex-1 bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:text-[#007bff] font-semibold transition-colors" onClick={onFindMatch}>
              <Search className="w-4 h-4 mr-2" /> Find match
            </Button>
          )}
          {onCategorise && (
            <Button variant="outline" className="w-full sm:flex-1 bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:text-[#007bff] font-semibold transition-colors" onClick={onCategorise}>
              <PlusCircle className="w-4 h-4 mr-2" /> Categorise
            </Button>
          )}
          {onSplit && (
            <Button variant="ghost" className="w-full text-slate-500 font-medium hover:text-slate-900 hover:bg-slate-100" onClick={onSplit}>
              <Split className="w-4 h-4 mr-2" /> Split transaction
            </Button>
          )}
        </div>
      </div>
      </div>
    );
  }

  // When the AI found an exact multi-invoice combination, that combination is
  // the correct action — hide the single-record approve to prevent applying
  // the full bank amount to one invoice.
  if (multiCombo && aiRecon.status === 'green') {
    return (
      <div className="space-y-6">
        <AiSummaryCard recon={aiRecon} onApprove={onMatchMany} approving={approving} />
        <div className="flex flex-wrap items-center gap-3">
          {onFindMatch && (
            <Button variant="outline" size="sm" onClick={onFindMatch} className="h-10 border-slate-200 text-slate-700 font-semibold hover:text-[#007bff] hover:border-slate-300 hover:bg-slate-50">
              Find another
            </Button>
          )}
          {onCategorise && (
            <Button variant="outline" size="sm" onClick={onCategorise} className="h-10 border-slate-200 text-slate-700 font-semibold hover:text-[#007bff] hover:border-slate-300 hover:bg-slate-50">
              Categorise
            </Button>
          )}
          {onSplit && (
            <Button variant="ghost" size="sm" onClick={onSplit} className="h-10 text-slate-500 font-medium hover:text-slate-900 ml-auto">
              Split
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showAiSummary && <AiSummaryCard recon={aiRecon} onApprove={onMatchMany} approving={approving} />}
      {/* Inline AI suggested match */}
      <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-5 relative overflow-hidden transition-all hover:bg-blue-50/80">
        <div className="absolute top-0 right-0 p-4">
          {(() => {
            const pct = Math.round(top.confidence);
            const colorClass = pct >= 70
              ? 'text-emerald-700 border-emerald-200 bg-emerald-50/80'
              : pct >= 40
              ? 'text-amber-700 border-amber-200 bg-amber-50/80'
              : 'text-slate-500 border-slate-200 bg-white/60';
            const dotClass = pct >= 70
              ? 'bg-emerald-500'
              : pct >= 40
              ? 'bg-amber-400'
              : 'bg-slate-400';
            return (
              <div className={`flex items-center gap-1.5 px-2.5 py-1 border rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${colorClass}`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotClass}`} />
                <span>AI Confidence</span>
                <span className="opacity-75">{pct}%</span>
              </div>
            );
          })()}
        </div>

        <div className="space-y-4 pr-24">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <FileText className="w-4 h-4 text-[#007bff]" />
              <p className="text-sm font-bold text-slate-900">
                {TYPE_LABELS[top.record_type]} {top.record_number}
              </p>
            </div>
            <p className="text-sm text-slate-600 font-medium">{top.record_name}</p>
            <p className="text-xl font-black text-slate-900 mt-1 tabular-nums">
              {gbp(top.record_amount || txnAmount(transaction))}
            </p>
          </div>

          {(top.reasons?.length > 0 || amountDiff > 0.01) && (
            <div className="pt-3 border-t border-blue-100/50">
              <ul className="space-y-2 text-xs">
                {(top.reasons || []).map((r, i) => (
                  <li key={i} className="flex gap-2 text-slate-600 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>{r}</span>
                  </li>
                ))}
                {amountDiff > 0.01 && (
                  <li className="flex gap-2 text-orange-700 font-semibold bg-orange-50 p-2.5 rounded-md border border-orange-100 shadow-sm mt-2">
                    <span className="w-4 h-4 flex items-center justify-center rounded-full bg-orange-200 text-orange-800 text-[10px] font-black flex-shrink-0">!</span>
                    <span>Amounts differ by {gbp(amountDiff)}</span>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => onMatch(top)}
          disabled={approving}
          className="bg-[#007bff] hover:bg-[#0062cc] text-white shadow-md shadow-blue-500/20 font-bold px-6 h-10 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
        >
          {approving ? 'Approving…' : 'Approve Match'}
        </Button>
        {onFindMatch && (
          <Button variant="outline" size="sm" onClick={onFindMatch} className="h-10 border-slate-200 text-slate-700 font-semibold hover:text-[#007bff] hover:border-slate-300 hover:bg-slate-50">
            Find another
          </Button>
        )}
        {onCategorise && (
          <Button variant="outline" size="sm" onClick={onCategorise} className="h-10 border-slate-200 text-slate-700 font-semibold hover:text-[#007bff] hover:border-slate-300 hover:bg-slate-50">
            Categorise
          </Button>
        )}
        {onSplit && (
          <Button variant="ghost" size="sm" onClick={onSplit} className="h-10 text-slate-500 font-medium hover:text-slate-900 ml-auto">
            Split
          </Button>
        )}
      </div>

      {/* Alternative matches */}
      {alternatives.length > 0 && (
        <div className="pt-4 mt-2 border-t border-slate-100">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Other potential matches</p>
          <div className="border border-slate-200 rounded-lg overflow-hidden bg-white divide-y divide-slate-100">
            {alternatives.map((alt) => (
              <div key={alt.record_id} className="flex items-center justify-between p-3 gap-4 hover:bg-slate-50 transition-colors group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-900 truncate">{alt.record_number}</p>
                    {alt.confidence != null && (() => {
                      const pct = Math.round(alt.confidence);
                      const colorClass = pct >= 70
                        ? 'text-emerald-700 border-emerald-200 bg-emerald-50'
                        : pct >= 40
                        ? 'text-amber-700 border-amber-200 bg-amber-50'
                        : 'text-slate-500 border-slate-200 bg-slate-50';
                      const dotClass = pct >= 70
                        ? 'bg-emerald-500'
                        : pct >= 40
                        ? 'bg-amber-400'
                        : 'bg-slate-400';
                      return (
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 border rounded-full text-[9px] font-black uppercase tracking-widest flex-shrink-0 ${colorClass}`}>
                          <span className={`w-1 h-1 rounded-full flex-shrink-0 ${dotClass}`} />
                          {pct}%
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-xs text-slate-500 font-medium truncate mt-0.5">{alt.record_name}</p>
                </div>
                <div className="text-right flex-shrink-0 flex items-center gap-4">
                  <p className="text-sm font-black text-slate-900 tabular-nums">{gbp(alt.record_amount || 0)}</p>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => onMatch(alt)} 
                    className="h-8 px-3 text-[#007bff] bg-blue-50/50 opacity-0 group-hover:opacity-100 group-hover:bg-blue-100 font-bold transition-all transform translate-x-2 group-hover:translate-x-0"
                  >
                    Match <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
