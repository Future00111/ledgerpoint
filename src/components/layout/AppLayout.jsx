import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopHeader from './TopHeader';
import Breadcrumbs from './Breadcrumbs';
import AICopilot from '@/components/copilot/AICopilot';
import Ask from '@/components/ask/Ask';
import { findActiveItem } from './navConfig';
import { pushRecent } from './recentItems';

const COLLAPSED_KEY = 'lp.sidebar.collapsed';

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === '1');
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Tablet auto-collapse (768–1023px). Desktop respects the saved preference.
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768 && window.innerWidth < 1024) setCollapsed(true);
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  // Track recently viewed + close mobile drawer on navigation.
  useEffect(() => {
    const item = findActiveItem(location.pathname);
    if (item) pushRecent({ label: item.label, path: location.pathname });
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-muted/30">
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopHeader onToggleMobile={() => setMobileOpen(true)} />
        <div className="px-4 lg:px-6 pt-2">
          <Breadcrumbs />
        </div>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pt-3">
          <Outlet />
        </main>
      </div>

      <AICopilot />
      <Ask />
    </div>
  );
}