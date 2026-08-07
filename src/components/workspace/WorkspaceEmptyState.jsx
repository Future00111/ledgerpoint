import React from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Standard empty state for Workspace cards/sections.
// Explains what the section does, why it matters, and how to get started —
// never a blank page. Optional Ask shortcut action.
export default function WorkspaceEmptyState({ icon: Icon, title, description, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center text-center py-10 px-4">
      {Icon && <Icon className="w-9 h-9 text-muted-foreground/30 mb-3" />}
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-sm">{description}</p>
      {actionLabel && onAction && (
        <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={onAction}>
          <Sparkles className="w-3.5 h-3.5" /> {actionLabel}
        </Button>
      )}
    </div>
  );
}