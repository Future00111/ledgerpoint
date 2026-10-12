import React from 'react';
import AskTrigger from '@/components/ask/AskTrigger';
import QuickCreate from './QuickCreate';
import { Menu } from 'lucide-react';
import NotificationCentre from '@/components/notifications/NotificationCentre';

export default function TopHeader({ onToggleMobile }) {
  return (
    <header className="flex items-center gap-3 h-16 px-4 lg:px-6 border-b border-border bg-white/80 backdrop-blur flex-shrink-0">
      <button
        onClick={onToggleMobile}
        className="lg:hidden p-2 -ml-2 hover:bg-muted rounded-md"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>
      <div className="flex-1 min-w-0">
        <AskTrigger />
      </div>
      <div className="ml-auto flex items-center gap-1 flex-shrink-0">
        <NotificationCentre />
        <QuickCreate />
      </div>
    </header>
  );
}