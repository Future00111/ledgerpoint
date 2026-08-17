import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import moment from 'moment';

const SOURCE_LABELS = {
  user_rule: 'Rule',
  party_history: 'History',
  supplier_default: 'Supplier default',
  business_type: 'Business type',
  ai: 'AI',
  none: 'None',
};

export default function AuditTab() {
  const { activeCompany } = useCompany();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeCompany) return;
    (async () => {
      const list = await base44.entities.AccountSuggestionLog.filter({ company_id: activeCompany.id }, '-created_date', 50);
      setRows(list);
      setLoading(false);
    })();
  }, [activeCompany]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Suggestion Audit Trail</CardTitle>
        <CardDescription>Recent suggestions and whether they were accepted or changed.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No suggestions recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {rows.map(r => (
              <div key={r.id} className="border rounded-lg p-3 text-sm">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="font-medium capitalize">{(r.source_type || '').replace(/_/g, ' ')}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{SOURCE_LABELS[r.suggestion_source] || r.suggestion_source}</Badge>
                    <Badge variant={r.accepted ? 'secondary' : 'outline'} className={!r.accepted ? 'text-amber-700 border-amber-300' : ''}>
                      {r.accepted ? 'Accepted' : 'Changed'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{r.confidence}%</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {r.party_name || '—'}: <span className="line-through">{r.suggested_account_name || '—'}</span> → {r.final_account_name || '—'}
                </p>
                {r.reason && <p className="text-xs text-muted-foreground mt-0.5">{r.reason}</p>}
                <p className="text-[10px] text-muted-foreground mt-1">{r.created_date ? moment(r.created_date).format('DD/MM/YYYY HH:mm') : ''}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}