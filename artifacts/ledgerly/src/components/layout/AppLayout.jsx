import { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopHeader from './TopHeader';
import { AskProvider } from '@/components/ask/AskProvider';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useCompany } from '@/lib/useCompany';
import { WorkspaceCapabilities } from '@/features/workspaceNavigation/WorkspaceCapabilities';
import { readCollapsed, rememberCollapsed, sidebarMode, restoreNavigationFocus } from '@/features/workspaceNavigation/model.mjs';
import { findActiveItem } from './navConfig';
import { pushRecent } from './recentItems';

export default function AppLayout() {
  const [preference, setPreference] = useState(() => { try { return readCollapsed(window.localStorage); } catch { return false; } });
  const [width, setWidth] = useState(() => typeof window === 'undefined' ? 0 : window.innerWidth);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navigationSection, setNavigationSection] = useState(null);
  const { selectionWarning } = useCompany();
  const location = useLocation();
  const returnFocus = useRef(null);
  const main = useRef(null);
  const mode = sidebarMode(width, preference);
  const setCollapsed = value => setPreference(previous => typeof value === 'function' ? value(previous) : value);
  const openNavigation = section => { returnFocus.current = document.activeElement; setNavigationSection(typeof section === 'string' ? section : null); setMobileOpen(true); };

  useEffect(() => {
    const resize = () => { setWidth(window.innerWidth); if (window.innerWidth >= 1024) setMobileOpen(false); };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  useEffect(() => { try { rememberCollapsed(window.localStorage, preference); } catch { /* Storage can be unavailable. */ } }, [preference]);
  useEffect(() => {
    const item = findActiveItem(location.pathname);
    if (item) { try { pushRecent({ label: item.label, path: location.pathname }); } catch { /* Recent-item storage must not prevent navigation. */ } }
    setMobileOpen(false);
  }, [location.pathname, location.search]);

  return <AskProvider><WorkspaceCapabilities><Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
    <div className="flex h-dvh overflow-hidden bg-background">
      <a href="#workspace-main" className="sr-only z-[100] rounded-lg bg-card px-4 py-3 text-sm font-medium focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to workspace</a>
      {mode.rail && <Sidebar collapsed={mode.collapsed} setCollapsed={setCollapsed} tablet={mode.tablet} onOpenNavigation={openNavigation} />}
      <SheetContent id="workspace-navigation" side="left" className="ledger-sidebar w-[min(320px,90vw)] border-0 p-0 [&>button]:min-h-11 [&>button]:min-w-11 [&>button]:text-foreground"
        onCloseAutoFocus={event => {
          event.preventDefault();
          restoreNavigationFocus(returnFocus.current, main.current);
        }}>
        <SheetTitle className="sr-only">Workspace navigation</SheetTitle>
        <SheetDescription className="sr-only">Choose a company or an accounting workspace. Press Escape to close.</SheetDescription>
        <Sidebar mobile collapsed={false} initialSection={navigationSection} onNavigate={() => setMobileOpen(false)} />
      </SheetContent>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopHeader onToggleMobile={openNavigation} mobileOpen={mobileOpen} showCompanyContext={mode.collapsed || !mode.rail} />
        {selectionWarning && <div role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:px-6">{selectionWarning}</div>}
        <main id="workspace-main" ref={main} tabIndex={-1} className="min-w-0 flex-1 overflow-y-auto p-4 outline-none sm:p-6 lg:px-9 lg:py-8"><Outlet /></main>
      </div>
    </div>
  </Sheet></WorkspaceCapabilities></AskProvider>;
}
