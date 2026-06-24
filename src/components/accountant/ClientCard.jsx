import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, ArrowRight, AlertCircle, FileClock, Receipt } from 'lucide-react';
import moment from 'moment';

function formatCurrency(a) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(a || 0);
}

const STATUS_CONFIG = {
  up_to_date: { label: 'Up to Date', className: 'bg-emerald-100 text-emerald-700' },
  needs_review: { label: 'Needs Review', className: 'bg-amber-100 text-amber-700' },
  vat_due_soon: { label: 'VAT Due Soon', className: 'bg-blue-100 text-blue-700' },
  overdue: { label: 'Overdue', className: 'bg-red-100 text-red-700' },
};

const VAT_FREQUENCY_LABELS = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

export default function ClientCard({ client, onView }) {
  const statusConfig = STATUS_CONFIG[client.status] || STATUS_CONFIG.up_to_date;

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-base truncate">{client.name}</h3>
              <p className="text-xs text-muted-foreground">{client.vat_number || 'No VAT number'}</p>
            </div>
          </div>
          <Badge className={'text-xs ' + statusConfig.className}>{statusConfig.label}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">VAT Period</p>
            <p className="font-medium">{VAT_FREQUENCY_LABELS[client.vat_frequency] || client.vat_frequency}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Estimated VAT Due</p>
            <p className="font-medium">{formatCurrency(client.estimated_vat_due)}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col items-center p-2 rounded-lg bg-muted/50">
            <AlertCircle className="w-4 h-4 text-amber-500 mb-1" />
            <p className="text-lg font-semibold">{client.txns_needing_review}</p>
            <p className="text-xs text-muted-foreground text-center leading-tight">Txns Review</p>
          </div>
          <div className="flex flex-col items-center p-2 rounded-lg bg-muted/50">
            <FileClock className="w-4 h-4 text-blue-500 mb-1" />
            <p className="text-lg font-semibold">{client.docs_pending_review}</p>
            <p className="text-xs text-muted-foreground text-center leading-tight">Docs Pending</p>
          </div>
          <div className="flex flex-col items-center p-2 rounded-lg bg-muted/50">
            <Receipt className="w-4 h-4 text-orange-500 mb-1" />
            <p className="text-lg font-semibold">{client.bills_awaiting_approval}</p>
            <p className="text-xs text-muted-foreground text-center leading-tight">Bills Review</p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <div>
            <p className="text-xs text-muted-foreground">Last Activity</p>
            <p className="text-sm font-medium">
              {client.last_activity ? moment(client.last_activity).format('DD MMM YYYY') : 'No activity'}
            </p>
          </div>
          <Button size="sm" className="gap-2" onClick={onView}>
            View Dashboard <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}