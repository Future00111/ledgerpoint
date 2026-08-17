import React from 'react';
import { MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AskButton({ onClick, hidden }) {
  return (
    <button
      onClick={onClick}
      aria-label="Ask"
      className={cn(
        'fixed bottom-6 right-6 z-40 flex items-center gap-2 h-12 pl-4 pr-5 rounded-full',
        'bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:bg-primary/90 transition-all',
        hidden && 'opacity-0 pointer-events-none scale-95'
      )}
    >
      <MessageSquare className="w-5 h-5" />
      <span className="font-medium text-sm">Ask</span>
    </button>
  );
}