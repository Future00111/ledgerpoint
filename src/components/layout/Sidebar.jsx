import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { SECTIONS, findActiveItem } from './navConfig';
import CompanySwitcher from './CompanySwitcher';
import { base44 } from '@/api/base44Client';
import { ChevronDown, ChevronsLeft, X, Landmark, LogOut } from 'lucide-react';

const OPEN_KEY = 'lp.sidebar.openSections';

function isItemActive(pathname, path) {
  if (path === '/') return pathname === '/';
  return pathname === path || pathname.startsWith(path + '/');
}

export default function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) {
  const location = useLocation();
  const [openSections, setOpenSections] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(OPEN_KEY) || '[]'));
    } catch {
      return new Set();
    }
  });

  // Auto-expand the section containing the active route.
  useEffect(() => {
    const active = findActiveItem(location.pathname);
    if (!active) return;
    setOpenSections((prev) => {
      if (prev.has(active.sectionKey)) return prev;
      const n = new Set(prev);
      n.add(active.sectionKey);
      localStorage.setItem(OPEN_KEY, JSON.stringify([...n]));
      return n;
    });
  }, [location.pathname]);

  const toggleSection = (key) =>
    setOpenSections((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      localStorage.setItem(OPEN_KEY, JSON.stringify([...n]));
      return n;
    });

  const handleSectionClick = (section) => {
    if (collapsed) {
      setCollapsed(false);
      setOpenSections((prev) => {
        const n = new Set(prev);
        n.add(section.key);
        localStorage.setItem(OPEN_KEY, JSON.stringify([...n]));
        return n;
      });
    } else {
      toggleSection(section.key);
    }
  };

  const handleLogout = () => base44.auth.logout('/login');

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-50 bg-white border-r border-border flex flex-col w-64',
        'transition-[width,transform] duration-200 ease-in-out lg:relative',
        collapsed ? 'lg:w-[68px]' : 'lg:w-64',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'flex items-center h-16 border-b border-border flex-shrink-0',
          collapsed ? 'lg:justify-center px-2' : 'justify-between px-4'
        )}
      >
        <Link to="/" className="flex items-center gap-2.5 min-w-0" onClick={() => setMobileOpen(false)}>
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
            <Landmark className="w-4 h-4 text-primary-foreground" />
          </div>
          {!collapsed && <span className="font-semibold text-base tracking-tight truncate">Ledgerly</span>}
        </Link>
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1.5 hover:bg-muted rounded-md flex-shrink-0"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Company switcher */}
      <div className={cn('border-b border-border flex-shrink-0 px-3 py-3', collapsed && 'lg:px-2')}>
        <CompanySwitcher collapsed={collapsed} onNavigate={() => setMobileOpen(false)} />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3" aria-label="Main navigation">
        <div className="space-y-0.5 px-2">
          {SECTIONS.map((section) => {
            const realItems = section.items.filter((i) => !i.soon);
            const hasChildren = realItems.length > 1;
            const activeItem = findActiveItem(location.pathname);
            const sectionActive = activeItem?.sectionKey === section.key;
            const isOpen = openSections.has(section.key);

            if (!hasChildren) {
              const item = realItems[0];
              const active = isItemActive(location.pathname, item.path);
              return (
                <Link
                  key={section.key}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  title={collapsed ? section.label : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-lg text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    collapsed ? 'lg:justify-center lg:w-10 lg:h-10 lg:mx-auto py-2 px-2' : 'px-3 py-2',
                    active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <section.icon className="w-[18px] h-[18px] flex-shrink-0" />
                  {!collapsed && <span>{section.label}</span>}
                </Link>
              );
            }

            return (
              <div key={section.key}>
                <button
                  onClick={() => handleSectionClick(section)}
                  title={collapsed ? section.label : undefined}
                  aria-expanded={isOpen}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-lg text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    collapsed ? 'lg:justify-center lg:w-10 lg:h-10 lg:mx-auto py-2 px-2' : 'px-3 py-2',
                    sectionActive ? 'text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <section.icon className="w-[18px] h-[18px] flex-shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">{section.label}</span>
                      <ChevronDown className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-180')} />
                    </>
                  )}
                </button>
                {!collapsed && isOpen && (
                  <div className="mt-0.5 mb-1 space-y-0.5 ml-3 pl-3 border-l border-border">
                    {section.items.map((item) => {
                      if (item.soon) {
                        return (
                          <div
                            key={item.label}
                            className="flex items-center gap-3 px-3 py-1.5 rounded-md text-sm text-muted-foreground/50"
                          >
                            <item.icon className="w-4 h-4 flex-shrink-0" />
                            <span className="flex-1">{item.label}</span>
                            <span className="text-[10px] uppercase tracking-wide bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                              Soon
                            </span>
                          </div>
                        );
                      }
                      const active = isItemActive(location.pathname, item.path);
                      return (
                        <Link
                          key={item.label}
                          to={item.path}
                          onClick={() => setMobileOpen(false)}
                          className={cn(
                            'flex items-center gap-3 px-3 py-1.5 rounded-md text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            active
                              ? 'bg-primary/10 text-primary font-medium'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          )}
                        >
                          <item.icon className="w-4 h-4 flex-shrink-0" />
                          <span className="flex-1">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-2 flex-shrink-0 space-y-1">
        <button
          onClick={handleLogout}
          title={collapsed ? 'Sign out' : undefined}
          className={cn(
            'w-full flex items-center gap-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
            collapsed ? 'lg:justify-center lg:w-10 lg:h-10 lg:mx-auto py-2 px-2' : 'px-3 py-2'
          )}
        >
          <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            'hidden lg:flex w-full items-center gap-3 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
            collapsed ? 'lg:justify-center lg:w-10 lg:h-10 lg:mx-auto py-2 px-2' : 'px-3 py-2'
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronsLeft className={cn('w-[18px] h-[18px] transition-transform', collapsed && 'rotate-180')} />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}