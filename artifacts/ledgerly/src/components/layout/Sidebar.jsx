import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { SECTIONS, findActiveItem } from './navConfig';
import { useAuth } from '@/lib/AuthContext';
import { canAccessDevTools } from '@/lib/devAccess';
import CompanySwitcher from './CompanySwitcher';
import { visibleSections } from '@/features/workspaceNavigation/model.mjs';
import { useClerk } from '@clerk/react';
import { ChevronDown, ChevronsLeft, LogOut, Search } from 'lucide-react';

export default function Sidebar({ collapsed = false, setCollapsed, tablet = false, mobile = false, onNavigate = () => {}, onOpenNavigation, initialSection }) {
  const location = useLocation();
  const [menuSearch, setMenuSearch] = useState('');
  const [showPlanned, setShowPlanned] = useState(false);
  const { user } = useAuth();
  const canDev = canAccessDevTools(user);
  const activeItem = findActiveItem(location.pathname);
  const query = menuSearch.trim().toLowerCase();
  const sections = visibleSections(SECTIONS, { canDev, showPlanned, query });
  const [openSection, setOpenSection] = useState(initialSection ?? activeItem?.sectionKey);
  useEffect(() => { setOpenSection(findActiveItem(location.pathname)?.sectionKey); setMenuSearch(''); }, [location.pathname]);
  useEffect(() => { if (initialSection) setOpenSection(initialSection); }, [initialSection]);
  const handleSectionClick = section => {
    if (tablet) { onOpenNavigation?.(section.key); return; }
    if (collapsed) { setCollapsed?.(false); setOpenSection(section.key); return; }
    setOpenSection(current => current === section.key ? null : section.key);
  };
  const { signOut } = useClerk();
  const itemClass = 'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-300';

  return <aside className={cn('ledger-sidebar flex h-full shrink-0 flex-col', mobile ? 'w-full' : collapsed ? 'w-[72px]' : 'w-64')} aria-label={mobile ? 'Mobile workspace sidebar' : 'Workspace sidebar'}>
    <div className={cn('flex h-16 shrink-0 items-center border-b border-white/10', collapsed ? 'justify-center' : 'px-5')}>
      <Link to="/" className="flex min-h-11 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300" onClick={onNavigate} aria-label="Ledgerly overview">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-xl font-semibold text-white" aria-hidden="true">L</span>
        {!collapsed && <span className="text-xl font-semibold tracking-tight">Ledgerly<span className="text-emerald-400">.</span></span>}
      </Link>
    </div>
    <div className={cn('shrink-0 border-b border-white/10 py-3', collapsed ? 'px-2' : 'px-3')}><CompanySwitcher collapsed={collapsed} onNavigate={onNavigate} /></div>
    {!collapsed && <div className="px-4 pt-4"><label className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 text-slate-300 focus-within:ring-2 focus-within:ring-emerald-300">
      <Search className="h-4 w-4 shrink-0" aria-hidden="true" /><input aria-label="Find a feature" placeholder="Find a feature…" value={menuSearch} onChange={event => setMenuSearch(event.target.value)} className="h-11 w-full min-w-0 bg-transparent text-sm text-white placeholder:text-slate-400 focus:outline-none" />
    </label></div>}
    <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4" aria-label="Main navigation">
      <div className="space-y-1">{sections.map(section => {
        const single = section.items.length === 1 && !section.items[0].soon;
        const sectionActive = activeItem?.sectionKey === section.key;
        const isOpen = Boolean(query) || openSection === section.key;
        const Icon = section.icon;
        if (single) {
          const item = section.items[0], active = activeItem?.path === item.path;
          return <Link key={section.key} to={item.path} onClick={onNavigate} aria-current={active ? 'page' : undefined} aria-label={query ? item.label : section.label} title={collapsed ? section.label : undefined}
            className={cn(itemClass, collapsed && 'justify-center px-0', active ? 'bg-white/10 font-medium text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white')}>
            <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />{!collapsed && <span>{query ? item.label : section.label}</span>}
          </Link>;
        }
        return <div key={section.key}>
          <button type="button" onClick={() => handleSectionClick(section)} aria-label={section.label} title={collapsed ? section.label : undefined} aria-expanded={!collapsed && isOpen}
            aria-controls={!collapsed ? `navigation-${mobile ? 'mobile' : 'rail'}-${section.key}` : undefined}
            className={cn(itemClass, 'w-full', collapsed && 'justify-center px-0', sectionActive ? 'font-medium text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white')}>
            <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />{!collapsed && <><span className="flex-1 text-left">{section.label}</span><ChevronDown className={cn('h-4 w-4', isOpen && 'rotate-180')} aria-hidden="true" /></>}
          </button>
          {!collapsed && isOpen && <div id={`navigation-${mobile ? 'mobile' : 'rail'}-${section.key}`} className="my-1 ml-3 space-y-0.5 border-l border-white/10 pl-3">{section.items.map(item => {
            const ItemIcon = item.icon ?? Icon;
            if (item.soon) return <div key={item.label} className="flex min-h-11 items-center gap-2 px-3 text-sm text-slate-400"><ItemIcon className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="flex-1">{item.label}</span><span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">Planned</span></div>;
            const active = activeItem?.path === item.path;
            return <Link key={item.label} to={item.path} onClick={onNavigate} aria-current={active ? 'page' : undefined} className={cn(itemClass, active ? 'bg-white/10 font-medium text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white')}>
              <ItemIcon className="h-4 w-4 shrink-0" aria-hidden="true" /><span>{item.label}</span>
            </Link>;
          })}</div>}
        </div>;
      })}{!sections.length && <p className="px-3 py-4 text-sm text-slate-300">No tools match “{menuSearch}”. Try invoices, VAT or reports.</p>}</div>
    </nav>
    {!collapsed && <button type="button" onClick={() => setShowPlanned(value => !value)} aria-pressed={showPlanned} className="mx-4 mb-2 min-h-11 rounded-lg px-2 text-left text-xs text-slate-300 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300">{showPlanned ? 'Hide planned tools' : 'Show planned tools'}</button>}
    <div className="shrink-0 space-y-1 border-t border-white/10 p-3">
      <button type="button" onClick={() => signOut({ redirectUrl: '/' })} aria-label="Sign out" title={collapsed ? 'Sign out' : undefined} className={cn(itemClass, 'w-full text-slate-300 hover:bg-white/5 hover:text-white', collapsed && 'justify-center px-0')}><LogOut className="h-[18px] w-[18px]" aria-hidden="true" />{!collapsed && <span>Sign out</span>}</button>
      {!mobile && !tablet && <button type="button" onClick={() => setCollapsed?.(value => !value)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className={cn(itemClass, 'w-full text-slate-300 hover:bg-white/5 hover:text-white', collapsed && 'justify-center px-0')}><ChevronsLeft className={cn('h-[18px] w-[18px]', collapsed && 'rotate-180')} aria-hidden="true" />{!collapsed && <span>Collapse</span>}</button>}
    </div>
  </aside>;
}
