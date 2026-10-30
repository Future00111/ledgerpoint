import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

const itemClass = 'flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';
const selectedClass = 'bg-primary/10 font-semibold text-primary';
const idleClass = 'text-muted-foreground hover:bg-muted/70 hover:text-foreground';

export function NavigationLinks({ everyday, sections, activePath, collapsed, mobile, query, openSection, onSectionClick, onNavigate = () => {} }) {
  const link = (item, fallbackIcon) => {
    const Icon = item.icon ?? fallbackIcon;
    const active = activePath === item.path;
    return <Link key={item.path} to={item.path} onClick={onNavigate} aria-current={active ? 'page' : undefined} aria-label={item.label} title={collapsed ? item.label : undefined}
      className={cn(itemClass, collapsed && 'justify-center px-0', active ? selectedClass : idleClass)}>
      {Icon && <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />}{!collapsed && <span className="flex-1">{item.label}</span>}
      {!collapsed && active && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />}
    </Link>;
  };
  return <>
    {everyday.length > 0 && <div className="space-y-1" aria-label="Everyday work">
      {!collapsed && <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Everyday</p>}
      {everyday.map(item => link(item))}
    </div>}
    {sections.length > 0 && <div className={cn('space-y-1', everyday.length > 0 && 'mt-5 border-t pt-5')} aria-label="More business tools">
      {!collapsed && <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{query ? 'Matching tools' : 'More tools'}</p>}
      {sections.map(section => {
        const single = section.items.length === 1 && !section.items[0].soon;
        const sectionActive = section.items.some(item => item.path === activePath);
        const isOpen = Boolean(query) || openSection === section.key;
        const Icon = section.icon;
        if (single) return link({ ...section.items[0], icon: section.items[0].icon ?? Icon }, Icon);
        return <div key={section.key}>
          <button type="button" onClick={() => onSectionClick(section)} aria-label={section.label} title={collapsed ? section.label : undefined} aria-expanded={!collapsed && isOpen}
            aria-controls={!collapsed ? `navigation-${mobile ? 'mobile' : 'rail'}-${section.key}` : undefined}
            className={cn(itemClass, 'w-full', collapsed && 'justify-center px-0', sectionActive ? 'font-medium text-primary' : idleClass)}>
            <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />{!collapsed && <><span className="flex-1 text-left">{section.label}</span><ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isOpen && 'rotate-180')} aria-hidden="true" /></>}
          </button>
          {!collapsed && isOpen && <div id={`navigation-${mobile ? 'mobile' : 'rail'}-${section.key}`} className="my-1 ml-5 space-y-0.5 border-l pl-2">{section.items.map(item => {
            const ItemIcon = item.icon ?? Icon;
            if (item.soon) return <div key={item.label} className="flex min-h-11 items-center gap-2 px-3 text-sm text-muted-foreground"><ItemIcon className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="flex-1">{item.label}</span><span className="rounded-md border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide">Planned</span></div>;
            return link(item, Icon);
          })}</div>}
        </div>;
      })}
    </div>}
    {!everyday.length && !sections.length && <p className="px-3 py-4 text-sm text-muted-foreground">No tools match “{query}”. Try invoices, VAT or reports.</p>}
  </>;
}

