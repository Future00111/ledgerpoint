import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Check } from 'lucide-react';
import moment from 'moment';

function formatCurrency(a) { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(a || 0); }

const TYPE_LABELS = {
  sales_invoice: 'Sales Invoice',
  purchase_bill: 'Purchase Bill',
  sales_credit_note: 'Sales Credit Note',
  supplier_credit_note: 'Supplier Credit Note',
};

export default function SuggestedMatches({ suggestions, onApprove, approving }) {
  if (!suggestions || suggestions.length === 0) return null;
  const top = suggestions.slice(0, 3);

  return (
    <div className="mt-3 pt-3 border-t border-dashed space-y-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
        <span>Suggested Matches</span>
      </div>
      {top.map((s, i) => (
        <div key={i} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-amber-50/50 border border-amber-200/50">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">{TYPE_LABELS[s.record_type]}</Badge>
              <p className="text-sm font-medium truncate">{s.record_number}</p>
              <span className="text-xs text-muted-foreground truncate">{s.record_name}</span>
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs text-muted-foreground">{formatCurrency(s.record_amount)}</span>
              {s.record_date && <span className="text-xs text-muted-foreground">· {moment(s.record_date).format('DD MMM YYYY')}</span>}
              <span className="text-xs text-muted-foreground">· {s.reasons.join(', ')}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge className="text-xs bg-amber-100 text-amber-700 border-transparent">{s.confidence}%</Badge>
            <Button size="sm" variant="outline" onClick={() => onApprove(s)} disabled={approving} className="gap-1 h-7">
              <Check className="w-3 h-3" />Approve
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}