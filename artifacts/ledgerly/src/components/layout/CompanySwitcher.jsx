import React from 'react';
import { Link } from 'react-router-dom';
import { useCompany } from '@/lib/useCompany';
import { Building2, ChevronDown, Plus, Settings, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export default function CompanySwitcher({ collapsed = false, onNavigate, surface = 'sidebar' }) {
  const { companies, activeCompany, switchCompany, loading } = useCompany();

  if (companies.length === 0) {
    return (
      <Link
        to="/companies"
        onClick={onNavigate}
        className={cn(
          'flex min-h-11 items-center gap-2 rounded-xl text-sm text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          collapsed ? 'lg:justify-center lg:w-10 lg:h-10 lg:mx-auto p-2' : 'px-3 py-2'
        )}
        title="Choose company" aria-label={loading ? "Loading companies" : "Choose or create a company"}
      >
        <Building2 className="w-5 h-5 flex-shrink-0" />
        {!collapsed && <span>{loading ? 'Loading companies…' : 'Choose a company'}</span>}
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'w-full min-h-11 flex items-center gap-2 rounded-xl border border-transparent text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
            collapsed
              ? 'justify-center p-2 text-foreground hover:bg-muted'
              : surface === 'sidebar' ? 'items-center justify-between px-3 py-3 bg-muted/60 text-foreground hover:border-border hover:bg-muted' : 'items-center justify-between px-3 py-2 bg-muted/50 text-foreground hover:bg-muted'
          )}
          title={collapsed ? activeCompany?.name : undefined}
          aria-label={`Current company: ${activeCompany?.name || 'none selected'}. Switch company`}
        >
          {collapsed ? (
            <Building2 className="w-5 h-5 text-current" />
          ) : (
            <>
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg border bg-white text-primary flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <span className="min-w-0 text-left"><span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Your business</span><span className="block truncate font-medium text-sm">{activeCompany?.name || 'Select company'}</span></span>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wide">
          Companies
        </DropdownMenuLabel>
        {companies.map((c) => (
          <DropdownMenuItem
            key={c.id}
            onClick={() => {
              switchCompany(c);
              onNavigate?.();
            }}
            className="min-h-11 gap-2"
          >
            <Building2 className="w-4 h-4 flex-shrink-0" />
            <span className="truncate flex-1">{c.name}</span>
            {c.id === activeCompany?.id && <Check className="w-4 h-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="min-h-11">
          <Link to="/companies" onClick={onNavigate}>
            <Plus className="w-4 h-4 mr-2" /> Create company
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="min-h-11">
          <Link to="/companies" onClick={onNavigate}>
            <Settings className="w-4 h-4 mr-2" /> Manage companies
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
