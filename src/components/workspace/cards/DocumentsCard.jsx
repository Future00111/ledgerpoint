import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Upload } from 'lucide-react';
import WorkspaceEmptyState from '../WorkspaceEmptyState';

// Reusable Documents card — clickable document rows. The whole row opens the
// document (One Click Rule); no separate "Open" button.
export default function DocumentsCard({ documents = [], onOpen }) {
  if (!documents.length) {
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
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 hover:border-primary/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
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