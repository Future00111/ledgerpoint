import React from 'react';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AskTooltip({ onTry, onDismiss }) {
  return (
    <div className="fixed bottom-[88px] right-6 z-40 w-64 bg-white rounded-xl shadow-xl border border-border p-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
      <div className="flex items-start gap-2">
        <span className="text-lg leading-none">💬</span>
        <div className="flex-1">
          <p className="text-sm font-semibold">New!</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Press <span className="font-medium text-foreground">Space</span> or{' '}
            <span className="font-medium text-foreground">Ctrl + K</span> to Ask Ledgerly anything.
          </p>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <Button size="sm" onClick={onTry} className="h-7 text-xs px-3">
          Try It
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss} className="h-7 text-xs px-3">
          Dismiss
        </Button>
      </div>
      <div className="absolute -bottom-1.5 right-10 w-3 h-3 bg-white border-r border-b border-border rotate-45" />
    </div>
  );
}