import React from 'react';
import { gbp } from '@/lib/format';
import { Search, PlusCircle, Split, FileText, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TYPE_LABELS = {
  sales_invoice: 'Invoice', purchase_bill: 'Bill',
  sales_credit_note: 'Credit note', supplier_credit_note: 'Credit note', ledger_account: 'Ledger',
};

const txnAmount = (t) => Number(t.money_in || 0) + Number(t.money_out || 0);

export default function MatchTab({ transaction, suggestions, onMatch, onSplit, onFindMatch, onCategorise, approving }) {
  const top = suggestions?.[0];
  const alternatives = (suggestions || []).slice(1);
  const amountDiff = top ? Math.abs(txnAmount(transaction) - (top.record_amount || 0)) : 0;

  if (!top) {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-4 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
        <div className="bg-white w-14 h-14 rounded-full flex items-center justify-center mb-4 shadow-sm border border-slate-100">
          <Search className="w-6 h-6 text-slate-400" />
        </div>
        <h3 className="text-base font-bold text-slate-900 mb-1.5">No automatic match found</h3>
        <p className="text-sm text-slate-500 mb-6 max-w-[280px]">
          We couldn't confidently match this transaction to an existing record.
        </p>
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
    );
  }

  return (
    <div className="space-y-6">
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
                <span>Smart Match</span>
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
