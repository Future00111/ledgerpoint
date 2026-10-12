import React from 'react';
import { TrendingUp, Scale, Calculator, Users, Truck, AlertCircle, AlertTriangle, Landmark } from 'lucide-react';

const REPORTS = [
  { id: 'profit_loss', name: 'Profit and Loss', icon: TrendingUp, description: 'Income vs expenses' },
  { id: 'balance_sheet', name: 'Balance Sheet', icon: Scale, description: 'Assets, liabilities & equity' },
  { id: 'vat_summary', name: 'VAT Summary', icon: Calculator, description: 'Output vs input VAT' },
  { id: 'sales_by_customer', name: 'Sales by Customer', icon: Users, description: 'Revenue per customer' },
  { id: 'purchases_by_supplier', name: 'Purchases by Supplier', icon: Truck, description: 'Spending per supplier' },
  { id: 'aged_debtors', name: 'Aged Debtors', icon: AlertCircle, description: 'Outstanding receivables' },
  { id: 'aged_creditors', name: 'Aged Creditors', icon: AlertTriangle, description: 'Outstanding payables' },
  { id: 'bank_reconciliation', name: 'Bank Reconciliation', icon: Landmark, description: 'Matched vs unmatched' },
];

export default function ReportSelector({ selected, onSelect }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {REPORTS.map(r => {
        const Icon = r.icon;
        return (
          <button
            key={r.id}
            onClick={() => onSelect(r.id)}
            className={`flex flex-col items-start p-4 rounded-lg border text-left transition-colors ${selected === r.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'}`}
          >
            <Icon className={`w-6 h-6 mb-2 ${selected === r.id ? 'text-primary' : 'text-muted-foreground'}`} />
            <p className="font-medium text-sm">{r.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>
          </button>
        );
      })}
    </div>
  );
}