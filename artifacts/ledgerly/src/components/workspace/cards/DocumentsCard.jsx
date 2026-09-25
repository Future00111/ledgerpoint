import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Upload } from 'lucide-react';
import WorkspaceEmptyState from '../WorkspaceEmptyState';

// Reusable Documents card. `compact` renders a tight card (header + small
// empty state or a compact list) for use in dense layouts; otherwise the
// original roomy empty state. Whole rows open the document (One Click Rule).
export default function DocumentsCard({ documents = [], onOpen, compact = false }) {
  if (!documents.length) {
    if (compact) {
      return (
        <Card className="border shadow-sm">
          <CardContent className="p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Documents</p>
                <p className="text-sm text-muted-foreground">No documents uploaded.</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 flex-shrink-0" onClick={() => onOpen?.()}>
              <Upload className="w-3.5 h-3.5" /> Upload Document
            </Button>
          </CardContent>
        </Card>
      );
    }
    return (
      <WorkspaceEmptyState
        icon={FileText}
        title="No documents uploaded yet"
        description="Upload invoices, statements or contracts to keep customer records complete."
        actionLabel="Upload document"
        actionIcon={Upload}
        onAction={() => onOpen?.()}
      />
    );
  }

  return (
    <Card className="border shadow-sm">
      {compact && (
        <div className="flex items-center justify-between px-3.5 pt-3 pb-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Documents</p>
          <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs" onClick={() => onOpen?.()}>
            <Upload className="w-3.5 h-3.5" /> Upload
          </Button>
        </div>
      )}
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {documents.map((d) => (
            <li
              key={d.id}
              role="button"
              tabIndex={0}
              onClick={() => onOpen?.(d)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOpen?.(d);
                }
              }}
              className="flex items-center gap-3 px-3.5 py-2.5 cursor-pointer hover:bg-muted/30 hover:border-primary/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            >
              <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{d.name}</p>
                <p className="text-xs text-muted-foreground">
                  {d.date || '—'} · {d.type || 'document'}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}