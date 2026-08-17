import React from 'react';
import { Link } from 'react-router-dom';
import { useCompany } from '@/lib/useCompany';
import {
  Plus, FileText, Receipt, Users, Truck, Undo2, Landmark, BookOpen, FolderOpen, Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

export default function QuickCreate() {
  const { activeCompany, roles } = useCompany();
  const role = activeCompany ? roles?.[activeCompany.id] : null;
  const isOwner = role === 'owner' || role === 'admin';

  const items = [
    { label: 'Invoice', path: '/invoices/new', icon: FileText },
    { label: 'Bill', path: '/bills/new', icon: Receipt },
    { label: 'Customer', path: '/customers', icon: Users },
    { label: 'Supplier', path: '/suppliers', icon: Truck },
    { label: 'Credit Note', path: '/sales-credit-notes/new', icon: Undo2 },
    { label: 'Bank Transaction', path: '/transactions', icon: Landmark },
    { label: 'Journal', path: '/general-ledger', icon: BookOpen },
    { label: 'Document', path: '/documents', icon: FolderOpen },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="gap-1.5 shadow-sm">
          <Plus className="w-4 h-4" /> New
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wide">
          Create new
        </DropdownMenuLabel>
        {items.map((i) => (
          <DropdownMenuItem asChild key={i.label}>
            <Link to={i.path}>
              <i.icon className="w-4 h-4 mr-2" /> {i.label}
            </Link>
          </DropdownMenuItem>
        ))}
        {isOwner && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/companies">
                <Building2 className="w-4 h-4 mr-2" /> Company
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}