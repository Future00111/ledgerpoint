import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { SECTIONS, EVERYDAY_ROUTES, findActiveItem } from './navConfig';
import { useAuth } from '@/lib/AuthContext';
import { useCompany } from '@/lib/useCompany';
import { canAccessDevTools } from '@/lib/devAccess';
import CompanySwitcher from './CompanySwitcher';
import { NavigationLinks } from './NavigationLinks';
import { navigationGroups } from '@/features/workspaceNavigation/model.mjs';
import { ChevronsLeft, LogOut, Search } from 'lucide-react';

const itemClass = 'flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';
const idleClass = 'text-muted-foreground hover:bg-muted/70 hover:text-foreground';

export default function Sidebar({ collapsed = false, setCollapsed, tablet = false, mobile = false, onNavigate = () => {}, onOpenNavigation, initialSection }) {
  const location = useLocation();
  const [menuSearch, setMenuSearch] = useState('');
  const [showPlanned, setShowPlanned] = useState(false);
  const { user, logout } = useAuth();
  const { activeCompany, roles } = useCompany();
  const canDev = canAccessDevTools(user);
  const activeItem = findActiveItem(location.pathname);
  const query = menuSearch.trim().toLowerCase();
  const { everyday, more } = navigationGroups(SECTIONS, EVERYDAY_ROUTES, { canDev, showPlanned, query, companyRole: roles[activeCompany?.id] });
  const [openSection, setOpenSection] = useState(initialSection ?? activeItem?.sectionKey);
  useEffect(() => { setOpenSection(findActiveItem(location.pathname)?.sectionKey); setMenuSearch(''); }, [location.pathname]);
  useEffect(() => { if (initialSection) setOpenSection(initialSection); }, [initialSection]);
  const handleSectionClick = section => {
    if (tablet) { onOpenNavigation?.(section.key); return; }
    if (collapsed) { setCollapsed?.(false); setOpenSection(section.key); return; }
    setOpenSection(current => current === section.key ? null : section.key);
  };

  return <aside className={cn('ledger-sidebar flex h-full shrink-0 flex-col', mobile ? 'w-full' : collapsed ? 'w-[76px]' : 'w-[260px]')} aria-label={mobile ? 'Mobile workspace sidebar' : 'Workspace sidebar'}>
    <div className={cn('flex h-[76px] shrink-0 items-center', collapsed ? 'justify-center' : 'px-6')}>
      <Link to="/" className="flex min-h-11 items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={onNavigate} aria-label="Ledgerly overview">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-xl font-semibold text-white" aria-hidden="true">L</span>
        {!collapsed && <span className="text-[23px] font-semibold tracking-tight">Ledgerly<span className="text-primary">.</span></span>}
      </Link>
    </div>
    <div className={cn('shrink-0 pb-3', collapsed ? 'px-2' : 'px-4')}><CompanySwitcher collapsed={collapsed} onNavigate={onNavigate} /></div>
    {!collapsed && <div className="px-4 pb-2"><label className="flex items-center gap-2 rounded-xl border border-transparent bg-muted/40 px-3 text-muted-foreground focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/20">
      <Search className="h-4 w-4 shrink-0" aria-hidden="true" /><input aria-label="Find a feature" placeholder="Find a feature…" value={menuSearch} onChange={event => setMenuSearch(event.target.value)} className="h-11 w-full min-w-0 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
    </label></div>}
    <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4" aria-label="Main navigation">
      <NavigationLinks everyday={everyday} sections={more} activePath={activeItem?.path} collapsed={collapsed} mobile={mobile} query={query} openSection={openSection} onSectionClick={handleSectionClick} onNavigate={onNavigate} />
    </nav>
    {!collapsed && <button type="button" onClick={() => setShowPlanned(value => !value)} aria-pressed={showPlanned} className="mx-4 mb-2 min-h-11 rounded-xl px-2 text-left text-xs text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{showPlanned ? 'Hide planned tools' : 'Show planned tools'}</button>}
    <div className="flex shrink-0 items-center gap-1 border-t p-3">
      <button type="button" onClick={logout} aria-label="Sign out" title={collapsed ? 'Sign out' : undefined} className={cn(itemClass, idleClass, 'min-w-0 flex-1', collapsed && 'justify-center px-0')}><LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />{!collapsed && <span>Sign out</span>}</button>
      {!mobile && !tablet && <button type="button" onClick={() => setCollapsed?.(value => !value)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className={cn('flex h-11 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', collapsed && 'w-6')}><ChevronsLeft className={cn('h-4 w-4', collapsed && 'rotate-180')} aria-hidden="true" /></button>}
    </div>
  </aside>;
}
