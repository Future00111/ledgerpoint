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

export default function CompanySwitcher({ collapsed, onNavigate }) {
  const { companies, activeCompany, switchCompany } = useCompany();

  if (companies.length === 0) {
    return (
      <Link
        to="/companies"
        onClick={onNavigate}
        className={cn(
          'flex items-center gap-2 rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors',
          collapsed ? 'lg:justify-center lg:w-10 lg:h-10 lg:mx-auto p-2' : 'px-3 py-2'
        )}
        title="Create company"
      >
        <Building2 className="w-5 h-5 flex-shrink-0" />
        {!collapsed && <span>No company — create one</span>}
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'w-full flex items-center gap-2 rounded-lg text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
            collapsed
              ? 'lg:justify-center lg:w-10 lg:h-10 lg:mx-auto p-2 hover:bg-muted'
              : 'items-center justify-between px-3 py-2 bg-muted hover:bg-muted/70'
          )}
          title={collapsed ? activeCompany?.name : undefined}
          aria-label="Switch company"
        >
          {collapsed ? (
            <Building2 className="w-5 h-5 text-foreground" />
          ) : (
            <>
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
                <span className="truncate font-medium text-sm">{activeCompany?.name || 'Select company'}</span>
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
            className="gap-2"
          >
            <Building2 className="w-4 h-4 flex-shrink-0" />
            <span className="truncate flex-1">{c.name}</span>
            {c.id === activeCompany?.id && <Check className="w-4 h-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/companies" onClick={onNavigate}>
            <Plus className="w-4 h-4 mr-2" /> Create company
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/companies" onClick={onNavigate}>
            <Settings className="w-4 h-4 mr-2" /> Manage companies
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}