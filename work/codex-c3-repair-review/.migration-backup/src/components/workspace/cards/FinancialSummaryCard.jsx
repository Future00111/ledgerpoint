import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import SummaryStat from '../SummaryStat';

// Reusable Financial Summary card — a titled grid of financial stat tiles.
// Used to surface the key money figures for any business object.
export default function FinancialSummaryCard({ title = 'Financial Summary', stats = [] }) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">{title}</p>
        <div className="grid grid-cols-2 gap-3">
          {stats.map((s, i) => (
            <SummaryStat key={i} {...s} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}