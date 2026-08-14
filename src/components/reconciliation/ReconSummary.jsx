import React from 'react';

// Single horizontal summary — typography only, no cards.
function Metric({ value, label }) {
  return (
    <div>
      <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

export default function ReconSummary({ metrics }) {
  const m = metrics || {};
  return (
    <div className="flex items-end gap-8 md:gap-12">
      <Metric value={m.reviewCount ?? 0} label="Awaiting review" />
      <span className="hidden md:block w-px h-9 bg-border/70 self-center" />
      <Metric value={`${m.completionPct ?? 100}%`} label="Reconciled" />
      <span className="hidden md:block w-px h-9 bg-border/70 self-center" />
      <Metric value={m.estimatedLabel || 'Complete'} label="Estimated remaining" />
    </div>
  );
}