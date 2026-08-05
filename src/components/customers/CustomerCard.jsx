import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Mail, Phone, Pencil, MoreHorizontal, Archive, Trash2, Copy, Download, GitMerge } from 'lucide-react';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

// Entire card is clickable to open the Customer Profile (Workspace).
// Edit + More (⋯) are explicit actions; the rest of the surface opens the profile.
// Keyboard accessible (Enter / Space) with a clear focus ring and hover state.
export default function CustomerCard({ customer, onOpen, onEdit, onArchive, onDelete, onDuplicate, onExport, onMerge }) {
  const c = customer;
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
      className="border shadow-sm cursor-pointer transition-all hover:shadow-md hover:border-primary/30 hover:bg-muted/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <CardContent className="p-4 flex items-center justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm">{c.name}</p>
            <Badge variant={c.status === 'active' ? 'default' : 'secondary'} className="text-xs">
              {c.status === 'active' ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
            {c.contact_name && <span>{c.contact_name}</span>}
            {c.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>}
            {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
            {c.outstanding_balance > 0 && (
              <span className="font-medium text-foreground">Owed: {gbp.format(c.outstanding_balance)}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 ml-3" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" onClick={() => onEdit(c)} title="Edit" aria-label={`Edit ${c.name}`}>
            <Pencil className="w-4 h-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" title="More" aria-label={`More actions for ${c.name}`}>
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
        </div>
      </CardContent>
    </Card>
  );
}