import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { GripVertical, X, Lightbulb, ChevronDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import WidgetInsightDialog from './WidgetInsightDialog';

const W_LABEL = { 1: 'Narrow', 2: 'Wide', 3: 'Full' };

export default function WidgetCard({
  meta,
  size,
  editMode,
  dragging,
  dragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onCycleW,
  onCycleH,
  onHide,
  onMoveEarlier,
  onMoveLater,
  canMoveEarlier,
  canMoveLater,
  onToggleCollapse,
  collapsed,
  attention,
  isCore,
  company,
  children,
}) {
  const [insightOpen, setInsightOpen] = useState(false);
  const Icon = meta.icon;
  const colSpan = size.w === 1 ? 4 : size.w === 2 ? 6 : 12;
  const minHeight = collapsed ? 'auto' : size.h === 2 ? 460 : 240;

  return (
    <div
      className={cn(
        'min-w-0 transition-opacity',
        dragging && 'opacity-40',
        dragOver && 'z-10'
      )}
      style={{ gridColumn: `span ${colSpan}`, minHeight }}
      onDragOver={editMode ? onDragOver : undefined}
      onDrop={editMode ? onDrop : undefined}
    >
      <Card
        className={cn(
          'h-full flex flex-col overflow-hidden rounded-xl border-border bg-card shadow-none',
          editMode && 'ring-1 ring-border',
          dragOver && 'ring-2 ring-primary',
          attention && 'ring-1 ring-amber-400/70'
        )}
      >
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 py-3 px-4 space-y-0 border-b border-border/60 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {editMode && (
              <button
                type="button"
                draggable
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                className="flex h-11 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted touch-none cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title="Drag to move"
                aria-label={`Drag ${meta.title} to move; earlier and later buttons are also available`}
              >
                <GripVertical className="w-4 h-4" />
              </button>
            )}
            {Icon && (
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/70 text-primary flex-shrink-0">
                <Icon className="w-3.5 h-3.5" />
              </span>
            )}
            <CardTitle className="text-sm font-semibold truncate">{meta.title}</CardTitle>
            {attention && (
              <span className="ml-1 inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">
                Needs attention
              </span>
            )}
            {isCore && editMode && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary flex-shrink-0">
                Pinned
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <button
              onClick={() => setInsightOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title="What does this mean?"
              aria-label={`Explain ${meta.title}`}
            >
              <Lightbulb className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onToggleCollapse}
              className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title={collapsed ? 'Expand' : 'Collapse'}
              aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${meta.title}`} aria-expanded={!collapsed}
            >
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', collapsed && 'rotate-[-90deg]')} />
            </button>
            {editMode && (
              <>
                <button type="button" onClick={onMoveEarlier} disabled={!canMoveEarlier} aria-label={`Move ${meta.title} earlier in this section`} className="flex h-11 w-9 items-center justify-center rounded-md hover:bg-muted disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ArrowUp className="h-4 w-4" /></button>
                <button type="button" onClick={onMoveLater} disabled={!canMoveLater} aria-label={`Move ${meta.title} later in this section`} className="flex h-11 w-9 items-center justify-center rounded-md hover:bg-muted disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ArrowDown className="h-4 w-4" /></button>
                <button
                  onClick={onCycleW}
                  className="min-h-11 rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title="Resize width" aria-label={`Resize ${meta.title} width: ${W_LABEL[size.w]}`}
                >
                  {W_LABEL[size.w]}
                </button>
                <button
                  onClick={onCycleH}
                  className="min-h-11 rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title="Resize height" aria-label={`Resize ${meta.title} height: ${size.h === 1 ? 'Short' : 'Tall'}`}
                >
                  {size.h === 1 ? 'Short' : 'Tall'}
                </button>
                {!isCore && (
                  <button
                    onClick={onHide}
                    className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    title="Hide widget"
                    aria-label={`Hide ${meta.title}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </>
            )}
          </div>
        </CardHeader>
        {!collapsed && <CardContent className="flex-1 p-4 pt-4 overflow-auto min-h-0">{children}</CardContent>}
      </Card>
      <WidgetInsightDialog
        open={insightOpen}
        onClose={() => setInsightOpen(false)}
        widgetId={meta.id}
        title={meta.title}
        company={company}
      />
    </div>
  );
}