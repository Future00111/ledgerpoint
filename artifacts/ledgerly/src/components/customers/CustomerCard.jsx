import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Mail, Phone, Pencil, MoreHorizontal, Archive, Trash2, Copy, Download, GitMerge, ArrowUpRight } from 'lucide-react';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

// Entire card is clickable to open the Customer Profile (Workspace).
// Edit + More (⋯) are explicit actions; the rest of the surface opens the profile.
// Keyboard accessible (Enter / Space) with a clear focus ring and hover state.
export default function CustomerCard({ customer, onOpen, onEdit, onArchive, onDelete, onDuplicate, onExport, onMerge }) {
  const c = customer;
  const initials = (c.name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  const handleKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen(c);
    }
  };
  return (
    <Card
      role="button"
      tabIndex={0}
      aria-label={`Open ${c.name} profile`}
      onClick={() => onOpen(c)}
      onKeyDown={handleKey}
      className="group rounded-2xl border-border/80 shadow-sm cursor-pointer transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <CardContent className="flex items-center justify-between gap-3 p-4 sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
            {initials}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-semibold text-sm">{c.name}</p>
              <Badge variant={c.status === 'active' ? 'default' : 'secondary'} className="rounded-full text-[10px]">
                {c.status === 'active' ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {c.contact_name && <span className="truncate">{c.contact_name}</span>}
              {c.email && <span className="flex max-w-full items-center gap-1 truncate"><Mail className="h-3 w-3 shrink-0" />{c.email}</span>}
              {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3 shrink-0" />{c.phone}</span>}
              {!c.contact_name && !c.email && !c.phone && <span>No contact details yet</span>}
            </div>
            {c.outstanding_balance > 0 && (
              <span className="mt-2 inline-flex rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">
                Owed: {gbp.format(c.outstanding_balance)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(c)} title="Edit" aria-label={`Edit ${c.name}`}>
            <Pencil className="w-4 h-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="More" aria-label={`More actions for ${c.name}`}>
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={() => onArchive(c)}>
                <Archive className="w-4 h-4 mr-2" /> Archive
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onDuplicate(c)}>
                <Copy className="w-4 h-4 mr-2" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onExport(c)}>
                <Download className="w-4 h-4 mr-2" /> Export
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onMerge(c)}>
                <GitMerge className="w-4 h-4 mr-2" /> Merge Customer
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => onDelete(c)}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ArrowUpRight className="ml-1 hidden h-4 w-4 text-muted-foreground/50 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 sm:block" />
        </div>
      </CardContent>
    </Card>
  );
}