import React from 'react';
import AskTrigger from '@/components/ask/AskTrigger';
import QuickCreate from './QuickCreate';
import Breadcrumbs from './Breadcrumbs';
import { Menu } from 'lucide-react';
import NotificationCentre from '@/components/notifications/NotificationCentre';
export default function TopHeader({ onToggleMobile }) {
  return <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-white px-4 lg:px-8">
    <button type="button" onClick={onToggleMobile} className="rounded-lg p-2 hover:bg-muted lg:hidden" aria-label="Open menu"><Menu className="h-5 w-5" /></button>
    <div className="min-w-0 flex-1"><Breadcrumbs /></div>
    <AskTrigger compact />
    <NotificationCentre />
    <QuickCreate />
  </header>;
}
