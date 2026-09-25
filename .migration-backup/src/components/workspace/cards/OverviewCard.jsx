import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

// Reusable Overview card — renders a list of labelled fields (icon · label · value)
// and optional children (e.g. a notes editor or summary paragraph).
export default function OverviewCard({ fields = [], children }) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-4 space-y-1">
        {fields.map((f, i) => (
          <div key={i} className="flex items-start gap-3 py-2">
            {f.icon && <f.icon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />}
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{f.label}</p>
              <p className="text-sm font-medium break-words">{f.value || '—'}</p>
            </div>
          </div>
        ))}
        {children}
      </CardContent>
    </Card>
  );
}