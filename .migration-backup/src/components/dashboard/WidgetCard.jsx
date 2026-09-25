import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { GripVertical, X, Lightbulb, ChevronDown } from 'lucide-react';
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
        'min-w-0 transition-opacity animate-in fade-in-0 duration-300',
        dragging && 'opacity-40',
        dragOver && 'z-10'
      )}
      style={{ gridColumn: `span ${colSpan}`, minHeight }}
      onDragOver={editMode ? onDragOver : undefined}
      onDrop={editMode ? onDrop : undefined}
    >
      <Card
        className={cn(
          'h-full flex flex-col overflow-hidden transition-shadow hover:shadow-md',
          editMode && 'ring-1 ring-dashed ring-border',
          dragOver && 'ring-2 ring-primary',
          attention && 'ring-1 ring-amber-400/70'
        )}
      >
        <CardHeader className="flex-row items-center justify-between py-3 px-4 space-y-0 border-b border-border/60 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {editMode && (
              <button
                draggable
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
                title="Drag to move"
                aria-label="Drag to move"
              >
                <GripVertical className="w-4 h-4" />
              </button>
            )}
            {Icon && <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
            <CardTitle className="text-sm font-medium truncate">{meta.title}</CardTitle>
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
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setInsightOpen(true)}
              className="p-1 rounded-md hover:bg-amber-50 text-amber-500 transition-colors"
              title="What does this mean?"
              aria-label="Explain this widget"
            >
              <Lightbulb className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onToggleCollapse}
              className="p-1 rounded-md hover:bg-muted text-muted-foreground"
              title={collapsed ? 'Expand' : 'Collapse'}
              aria-label={collapsed ? 'Expand widget' : 'Collapse widget'}
            >
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', collapsed && 'rotate-[-90deg]')} />
            </button>
            {editMode && (
              <>
                <button
                  onClick={onCycleW}
                  className="px-1.5 py-1 rounded-md hover:bg-muted text-[10px] font-medium text-muted-foreground border border-border"
                  title="Resize width"
                >
                  {W_LABEL[size.w]}
                </button>
                <button
                  onClick={onCycleH}
                  className="px-1.5 py-1 rounded-md hover:bg-muted text-[10px] font-medium text-muted-foreground border border-border"
                  title="Resize height"
                >
                  {size.h === 1 ? 'Short' : 'Tall'}
                </button>
                {!isCore && (
                  <button
                    onClick={onHide}
                    className="p-1 rounded-md hover:bg-muted text-muted-foreground"
                    title="Hide widget"
                    aria-label="Hide widget"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </>
            )}
          </div>
        </CardHeader>
        {!collapsed && <CardContent className="flex-1 p-4 pt-3 overflow-auto min-h-0">{children}</CardContent>}
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