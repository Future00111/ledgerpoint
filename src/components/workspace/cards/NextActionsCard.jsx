import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

// Reusable "What Next" card — recommended next actions for a Workspace.
// The Workspace computes the actions (context-aware) and passes them in;
// the card just renders clickable action chips. Always ends the Overview so
// the user is guided toward their next logical action.
export default function NextActionsCard({ title = 'What should I do next?', actions = [] }) {
  if (!actions.length) return null;

  return (
    <Card className="border border-primary/20 bg-primary/5 shadow-sm">
      <CardContent className="p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-primary mb-3">{title}</p>
        <div className="flex flex-wrap gap-2">
          {actions.map((a, i) => (
            <Button
              key={i}
              variant={i === 0 ? 'default' : 'outline'}
              size="sm"
              onClick={a.onClick}
              className="gap-2"
            >
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