import React from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useWidgetData } from '../useWidgetData';
import { ListSkeleton, EmptyState } from '../WidgetPrimitives';
import { gbp } from '@/lib/format';
import { Scale } from 'lucide-react';

export default function TrialBalanceWidget({ company }) {
  const nav = useNavigate();
  const { data, loading } = useWidgetData(company?.id, async (cid) => {
    const [accts, journals] = await Promise.all([
      base44.entities.ChartOfAccount.filter({ company_id: cid }),
      base44.entities.JournalEntry.filter({ company_id: cid }, '-date', 5000),
    ]);
    return { accts, journals };
  });

  if (loading) return <ListSkeleton rows={6} />;
  const { accts, journals } = data || {};
  if (!journals || journals.length === 0)
    return <EmptyState icon={Scale} title="No journal entries" description="Post transactions to generate a trial balance." actionLabel="Go to Ledger" onAction={() => nav('/general-ledger')} />;

  const byCode = {};
  journals.forEach((j) => {
    if (!j.account_code) return;
    byCode[j.account_code] = byCode[j.account_code] || { debit: 0, credit: 0 };
    byCode[j.account_code].debit += Number(j.debit) || 0;
    byCode[j.account_code].credit += Number(j.credit) || 0;
  });
  const rows = (accts || [])
    .filter((a) => byCode[a.code])
    .map((a) => ({ code: a.code, name: a.name, debit: byCode[a.code].debit, credit: byCode[a.code].credit }));
  const td = rows.reduce((s, r) => s + r.debit, 0);
  const tc = rows.reduce((s, r) => s + r.credit, 0);

  return (
    <div className="overflow-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="py-1 font-medium">Code</th>
            <th className="font-medium">Account</th>
            <th className="text-right font-medium">Debit</th>
            <th className="text-right font-medium">Credit</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 12).map((r) => (
            <tr key={r.code} className="border-t border-border/60">
              <td className="py-1">{r.code}</td>
              <td className="truncate max-w-[120px]">{r.name}</td>
              <td className="text-right">{r.debit ? gbp(r.debit) : ''}</td>
              <td className="text-right">{r.credit ? gbp(r.credit) : ''}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border font-semibold">
            <td colSpan={2} className="py-1">Total</td>
            <td className="text-right">{gbp(td)}</td>
            <td className="text-right">{gbp(tc)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}