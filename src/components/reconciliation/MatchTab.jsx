import React, { useState } from 'react';
import { gbp } from '@/lib/format';

const TYPE_LABELS = {
  sales_invoice: 'Invoice', purchase_bill: 'Bill',
  sales_credit_note: 'Credit note', supplier_credit_note: 'Credit note', ledger_account: 'Ledger',
};

const txnAmount = (t) => Number(t.money_in || 0) + Number(t.money_out || 0);

export default function MatchTab({ transaction, suggestions, onMatch, onSplit, onFindMatch, onCategorise, approving }) {
  const [whyOpen, setWhyOpen] = useState(false);
  const top = suggestions?.[0];
  const alternatives = (suggestions || []).slice(1);
  const amountDiff = top ? Math.abs(txnAmount(transaction) - (top.record_amount || 0)) : 0;

  if (!top) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-[#666]">No suggested match.</p>
        <div className="flex items-center gap-4">
          {onSplit && <button type="button" onClick={onSplit} className="text-sm text-[#007bff] hover:underline">Split</button>}
          {onFindMatch && <button type="button" onClick={onFindMatch} className="text-sm text-[#007bff] hover:underline">Find another match</button>}
          {onCategorise && <button type="button" onClick={onCategorise} className="text-sm text-[#007bff] hover:underline">Categorise</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="border border-[#cccccc] rounded-sm p-3 bg-white">
        <p className="text-sm text-[#333] font-medium">{TYPE_LABELS[top.record_type]} {top.record_number}</p>
        <p className="text-sm text-[#666]">{top.record_name}</p>
        <p className="text-sm text-[#333] tabular-nums">{gbp(top.record_amount || txnAmount(transaction))}</p>
        <div className="flex items-center gap-2 text-xs text-[#666] mt-1.5">
          <span>Confidence: {Math.round(top.confidence)}%</span>
          <button type="button" onClick={() => setWhyOpen((v) => !v)} className="text-[#007bff] hover:underline">{whyOpen ? 'Hide' : 'Why?'}</button>
        </div>
        {whyOpen && (
          <ul className="mt-1.5 space-y-0.5 text-xs text-[#666]">
            {(top.reasons || []).map((r, i) => (
              <li key={i} className="flex gap-1.5"><span className="text-[#007bff]">✓</span><span>{r}</span></li>
            ))}
            {amountDiff > 0.01 && (
              <li className="flex gap-1.5"><span className="text-[#d97706]">⚠</span><span>Differs by {gbp(amountDiff)}</span></li>
            )}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => onMatch(top)}
          disabled={approving}
          className="px-3 py-1.5 text-sm bg-[#007bff] text-white rounded hover:bg-[#0062cc] disabled:opacity-50"
        >
          {approving ? 'Matching…' : 'Match'}
        </button>
        {onSplit && <button type="button" onClick={onSplit} className="text-sm text-[#007bff] hover:underline">Split</button>}
        {onFindMatch && <button type="button" onClick={onFindMatch} className="text-sm text-[#007bff] hover:underline">Find another match</button>}
        {onCategorise && <button type="button" onClick={onCategorise} className="text-sm text-[#007bff] hover:underline">Categorise</button>}
      </div>

      {alternatives.length > 0 && (
        <div>
          <p className="text-xs text-[#666] mb-1">Alternative matches</p>
          <div className="divide-y divide-[#e5e7eb] border border-[#cccccc] rounded-sm bg-white">
            {alternatives.map((alt) => (
              <div key={alt.record_id} className="flex items-center justify-between px-3 py-2 gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-[#333] truncate">{TYPE_LABELS[alt.record_type]} {alt.record_number}</p>
                  <p className="text-xs text-[#666] truncate">{alt.record_name}</p>
                </div>
                <button type="button" onClick={() => onMatch(alt)} className="text-sm text-[#007bff] hover:underline flex-shrink-0">Match</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}