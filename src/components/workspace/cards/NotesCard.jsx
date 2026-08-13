import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { StickyNote, Plus, Pencil, Save } from 'lucide-react';

// Reusable Notes card — compact by default (preview + Add/Edit), or `expanded`
// for a full inline editor (e.g. a dedicated Notes tab). Auto-saves on blur in
// expanded mode; explicit Save button in compact mode. Keeps the notes field
// honest — no fabricated authors/dates, just the stored text and last-updated.
export default function NotesCard({ value = '', onChange, onSave, updatedDate, expanded = false }) {
  const [editing, setEditing] = useState(expanded);
  useEffect(() => { setEditing(expanded); }, [expanded]);

  const hasNotes = (value || '').trim().length > 0;
  const preview = (value || '').slice(0, 200) + ((value || '').length > 200 ? '…' : '');

  if (expanded) {
    return (
      <Card className="border shadow-sm">
        <CardContent className="p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1.5 mb-2">
            <StickyNote className="w-3.5 h-3.5" /> Notes
          </p>
          <Textarea
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            onBlur={() => onSave?.(value)}
            placeholder="Add notes about this customer…"
            className="min-h-[200px]"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border shadow-sm">
      <CardContent className="p-3.5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1.5">
            <StickyNote className="w-3.5 h-3.5" /> Notes
          </p>
          {!editing && (
            <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs" onClick={() => setEditing(true)}>
              {hasNotes ? <><Pencil className="w-3.5 h-3.5" /> Edit</> : <><Plus className="w-3.5 h-3.5" /> Add Note</>}
            </Button>
          )}
        </div>
        {editing ? (
          <div className="space-y-2">
            <Textarea
              value={value}
              onChange={(e) => onChange?.(e.target.value)}
              placeholder="Add notes about this customer…"
              className="min-h-[100px]"
            />
            <Button size="sm" className="gap-1.5" onClick={() => { onSave?.(value); setEditing(false); }}>
              <Save className="w-3.5 h-3.5" /> Save
            </Button>
          </div>
        ) : hasNotes ? (
          <div>
            <p className="text-sm whitespace-pre-wrap">{preview}</p>
            {updatedDate && <p className="text-xs text-muted-foreground mt-1.5">Last updated {String(updatedDate).slice(0, 10)}</p>}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        )}
      </CardContent>
    </Card>
  );
}