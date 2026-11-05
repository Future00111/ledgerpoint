import AskTrigger from '@/components/ask/AskTrigger';
import QuickCreate from './QuickCreate';
import Breadcrumbs from './Breadcrumbs';
import CompanySwitcher from './CompanySwitcher';
import { Menu } from 'lucide-react';
import NotificationCentre from '@/components/notifications/NotificationCentre';
export default function TopHeader({ onToggleMobile, mobileOpen, showCompanyContext }) {
  return <header className="shrink-0 border-b bg-white/90">
    <div className="flex min-h-[76px] items-center gap-2 px-4 sm:gap-3 lg:px-9">
      <button type="button" onClick={onToggleMobile} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden" aria-label="Open workspace menu" aria-haspopup="dialog" aria-controls="workspace-navigation" aria-expanded={mobileOpen}><Menu className="h-5 w-5" /></button>
      <div className="min-w-0 flex-1"><Breadcrumbs /></div>
      <div className="[&_button]:min-h-11"><AskTrigger compact /></div>
      <NotificationCentre /><QuickCreate />
    </div>
    {showCompanyContext && <div className="border-t px-4 py-2 lg:px-8"><div className="sm:max-w-sm"><CompanySwitcher surface="header" /></div></div>}
  </header>;
}
