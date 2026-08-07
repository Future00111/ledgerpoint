import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

// Reusable "What Next" card — recommended next actions for a Workspace.
// Supports a prominent Primary action (when something needs doing now) plus
// Secondary actions, or a calm "No immediate action required" state with
// optional actions beneath. Falls back to a flat `actions` list for legacy use.
// Recommendations are always based on live data supplied by the Workspace.
export default function NextActionsCard({ title = 'What should I do next?', primary, secondary = [], actions, noActionLabel = 'No immediate action is required.' }) {
  const renderChip = (a, i) => (
    <Button key={i} variant="outline" size="sm" onClick={a.onClick} className="gap-2">
      {a.icon && <a.icon className="w-3.5 h-3.5" />}
      {a.label}
    </Button>
  );

  // Legacy flat list (no primary/secondary split)
  if (!primary && actions?.length) {
    return (
      <Card className="border border-primary/20 bg-primary/5 shadow-sm">
        <CardContent className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary mb-3">{title}</p>
          <div className="flex flex-wrap gap-2">
            {actions.map((a, i) => (
              <Button key={i} variant={i === 0 ? 'default' : 'outline'} size="sm" onClick={a.onClick} className="gap-2">
                {a.icon && <a.icon className="w-3.5 h-3.5" />}
                {a.label}
                <ArrowRight className="w-3 h-3 opacity-60" />
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-primary/20 bg-primary/5 shadow-sm">
      <CardContent className="p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-primary mb-3">{title}</p>
        {primary ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <Button variant="default" size="sm" onClick={primary.onClick} className="gap-2 w-full sm:w-auto">
              {primary.icon && <primary.icon className="w-3.5 h-3.5" />}
              {primary.label}
              <ArrowRight className="w-3 h-3" />
            </Button>
            {secondary.length > 0 && (
              <div className="flex flex-wrap gap-2">{secondary.map((a, i) => renderChip(a, i))}</div>
            )}
          </div>
        ) : (
          <div>
            <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              {noActionLabel}
            </p>
            {secondary.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">{secondary.map((a, i) => renderChip(a, i))}</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}