import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { SECTIONS, findActiveItem } from './navConfig';
import { useAuth } from '@/lib/AuthContext';
import { canAccessDevTools } from '@/lib/devAccess';
import CompanySwitcher from './CompanySwitcher';
import { useClerk } from '@clerk/react';
import { ChevronDown, ChevronsLeft, X, LogOut, Search } from 'lucide-react';


export default function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) {
  const location = useLocation();
  const [menuSearch, setMenuSearch] = useState('');
  const [showPlanned, setShowPlanned] = useState(false);
  const { user } = useAuth();
  const canDev = canAccessDevTools(user);
  const sections = SECTIONS
    .filter((s) => !s.devOnly || canDev)
    .map((s) => ({ ...s, items: s.items.filter((i) => (!i.devOnly || canDev) && (showPlanned || !i.soon || menuSearch.trim())).filter(i => !menuSearch.trim() || `${s.label} ${i.label}`.toLowerCase().includes(menuSearch.trim().toLowerCase())) }))
    .filter((s) => s.items.length);
  const [openSection, setOpenSection] = useState(() => findActiveItem(location.pathname)?.sectionKey);
  useEffect(() => { setOpenSection(findActiveItem(location.pathname)?.sectionKey); setMenuSearch(''); }, [location.pathname]);
  const handleSectionClick = section => {
    if (collapsed) setCollapsed(false);
    setOpenSection(current => current === section.key ? null : section.key);
  };

  const { signOut } = useClerk();
  const handleLogout = () => signOut({ redirectUrl: '/' });

  return (
    <aside
      className={cn(
        'ledger-sidebar fixed inset-y-0 left-0 z-50 flex flex-col w-60',
        'transition-[width,transform] duration-200 ease-in-out lg:relative',
        collapsed ? 'lg:w-[68px]' : 'lg:w-60',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'flex items-center h-16 border-b border-white/10 flex-shrink-0',
          collapsed ? 'lg:justify-center px-2' : 'justify-between px-4'
        )}
      >
        <Link to="/" className="flex items-center gap-2.5 min-w-0" onClick={() => setMobileOpen(false)}>
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-lg font-semibold text-white" aria-hidden="true">L</span>
          </div>
          {!collapsed && <span className="font-semibold text-xl tracking-tight truncate">Ledgerly<span className="text-emerald-400">.</span></span>}
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
      <div className={cn('border-b border-white/10 flex-shrink-0 px-3 py-3', collapsed && 'lg:px-2')}>
        <CompanySwitcher collapsed={collapsed} onNavigate={() => setMobileOpen(false)} />
      </div>

      {!collapsed && <div className="px-4 pt-4">
        <label className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 text-slate-300">
          <Search className="h-4 w-4 shrink-0" />
          <input aria-label="Find a feature" placeholder="Find a feature…" value={menuSearch} onChange={e => setMenuSearch(e.target.value)} className="h-9 w-full min-w-0 bg-transparent text-xs text-white placeholder:text-slate-400 focus:outline-none" />
        </label>
      </div>}
      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-5" aria-label="Main navigation">
        <div className="space-y-1 px-3">
          {sections.map((section) => {
            const realItems = section.items.filter((i) => !i.soon);
            const hasChildren = section.items.length > 1 || section.items[0]?.soon;
            const activeItem = findActiveItem(location.pathname);
            const sectionActive = activeItem?.sectionKey === section.key;
            const isOpen = !!menuSearch.trim() || openSection === section.key;

            if (!hasChildren) {
              const item = realItems[0];
              const active = findActiveItem(location.pathname)?.path === item.path;
              return (
                <Link
                  key={section.key}
                  to={item.path}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setMobileOpen(false)}
                  aria-label={menuSearch.trim() && !hasChildren ? item.label : section.label}
                  title={collapsed ? section.label : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-lg text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    collapsed ? 'lg:justify-center lg:w-10 lg:h-10 lg:mx-auto py-2 px-2' : 'px-3 py-2.5',
                    active ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  )}
                >
                  <section.icon className="w-[18px] h-[18px] flex-shrink-0" />
                  {!collapsed && <span>{menuSearch.trim() ? item.label : section.label}</span>}
                </Link>
              );
            }

            return (
              <div key={section.key}>
                <button
                  onClick={() => handleSectionClick(section)}
                  aria-label={section.label}
                  title={collapsed ? section.label : undefined}
                  aria-expanded={isOpen}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-lg text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    collapsed ? 'lg:justify-center lg:w-10 lg:h-10 lg:mx-auto py-2 px-2' : 'px-3 py-2.5',
                    sectionActive ? 'text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
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
                  <div className="mt-0.5 mb-1 space-y-0.5 ml-3 pl-3 border-l border-white/10">
                    {section.items.map((item) => {
                      if (item.soon) {
                        return (
                          <div
                            key={item.label}
                            className="flex items-center gap-3 px-3 py-1.5 rounded-md text-sm text-slate-400"
                          >
                            <item.icon className="w-4 h-4 flex-shrink-0" />
                            <span className="flex-1">{item.label}</span>
                            <span className="text-[10px] uppercase tracking-wide bg-white/10 text-slate-300 px-1.5 py-0.5 rounded">
                              Soon
                            </span>
                          </div>
                        );
                      }
                      const active = findActiveItem(location.pathname)?.path === item.path;
                      return (
                        <Link
                          key={item.label}
                          to={item.path}
                          aria-current={active ? 'page' : undefined}
                          onClick={() => setMobileOpen(false)}
                          className={cn(
                            'flex items-center gap-3 px-3 py-1.5 rounded-md text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            active
                              ? 'bg-white/10 text-white font-medium'
                              : 'text-slate-300 hover:bg-white/5 hover:text-white'
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
          {!sections.length && <p className="px-3 py-4 text-xs text-slate-300">No tools match “{menuSearch}”. Try invoices, VAT or reports.</p>}
        </div>
      </nav>

      {!collapsed && <button type="button" onClick={() => setShowPlanned(v => !v)} aria-pressed={showPlanned} className="mx-4 mb-3 text-left text-xs text-slate-400 hover:text-white">{showPlanned ? 'Hide planned tools' : 'Show planned tools'}</button>}
      {/* Footer */}
      <div className="border-t border-white/10 p-2 flex-shrink-0 space-y-1">
        <button
          onClick={handleLogout}
          title={collapsed ? 'Sign out' : undefined}
          className={cn(
            'w-full flex items-center gap-3 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
            collapsed ? 'lg:justify-center lg:w-10 lg:h-10 lg:mx-auto py-2 px-2' : 'px-3 py-2.5'
          )}
        >
          <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            'hidden lg:flex w-full items-center gap-3 rounded-lg text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
            collapsed ? 'lg:justify-center lg:w-10 lg:h-10 lg:mx-auto py-2 px-2' : 'px-3 py-2.5'
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