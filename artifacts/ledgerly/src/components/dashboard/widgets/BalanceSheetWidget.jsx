import React from 'react';
import { base44 } from '@/api/base44Client';
import { useWidgetData } from '../useWidgetData';
import { ListSkeleton, EmptyState } from '../WidgetPrimitives';
import { gbp } from '@/lib/format';
import { Scale } from 'lucide-react';

export default function BalanceSheetWidget({ company }) {
  const { data, loading } = useWidgetData(company?.id, async (cid) => {
    const [accts, journals] = await Promise.all([
      base44.entities.ChartOfAccount.filter({ company_id: cid }),
      base44.entities.JournalEntry.filter({ company_id: cid }, '-date', 5000),
    ]);
    return { accts, journals };
  });

  if (loading) return <ListSkeleton rows={4} />;
  const { accts, journals } = data || {};
  if (!journals || journals.length === 0)
    return <EmptyState icon={Scale} title="No ledger data" description="Post transactions to generate a balance sheet." />;

  const bal = {};
  journals.forEach((j) => {
    if (!j.account_code) return;
    bal[j.account_code] = (bal[j.account_code] || 0) + (Number(j.debit) || 0) - (Number(j.credit) || 0);
  });
  const sumByType = (type) => (accts || []).filter((a) => a.type === type).reduce((s, a) => s + (bal[a.code] || 0), 0);
  const assets = sumByType('asset');
  const liabilities = sumByType('liability');
  const equity = assets - liabilities;

  const rows = [
    ['Assets', assets],
    ['Liabilities', -liabilities],
    ['Equity', equity],
  ];

  return (
    <div className="space-y-1.5">
      {rows.map(([label, val]) => (
        <div key={label} className="flex items-center justify-between py-1.5 border-b border-border/60 last:border-0">
          <span className="text-sm">{label}</span>
          <span className={`text-sm font-semibold ${val < 0 ? 'text-rose-600' : ''}`}>{gbp(val)}</span>
        </div>
      ))}
    </div>
  );
}