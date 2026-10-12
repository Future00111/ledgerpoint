import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

// Reusable Workspace header.
// Renders: primary record name · status · key info chips · quick actions ·
// Ask · Favourite · More actions (⋯). Used by every Workspace.
export default function WorkspaceHeader({
  title,
  statusLabel,
  statusTone,
  metrics = [],
  info = [],
  quickActions = [],
  moreActions = [],
  favourite,
  onToggleFavourite,
  onAskClick,
}) {
  const toneCls =
    statusTone === 'green' ? 'bg-green-100 text-green-700 hover:bg-green-100'
    : statusTone === 'amber' ? 'bg-amber-100 text-amber-700 hover:bg-amber-100'
    : statusTone === 'red' ? 'bg-rose-100 text-rose-700 hover:bg-rose-100'
    : '';

  return (
    <div className="flex flex-col gap-4 pr-8">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight truncate">{title}</h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
            {statusLabel && <Badge className={toneCls}>{statusLabel}</Badge>}
            {info.map((it, i) => (
              <span key={i} className="inline-flex items-center gap-1">
                {it.icon && <it.icon className="w-3 h-3" />}
                {it.text}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {favourite !== undefined && (
            <Button variant="ghost" size="icon" onClick={onToggleFavourite} aria-label="Favourite this record">
              <Star className={cn('w-4 h-4', favourite ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground')} />
            </Button>
          )}
          {moreActions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="More actions">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {moreActions.map((a, i) =>
                  a.separator ? (
                    <DropdownMenuSeparator key={i} />
                  ) : (
                    <DropdownMenuItem
                      key={i}
                      className={a.danger ? 'text-destructive focus:text-destructive' : ''}
                      onSelect={a.onSelect}
                    >
                      {a.icon && <a.icon className="w-4 h-4 mr-2" />} {a.label}
                    </DropdownMenuItem>
                  )
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {metrics?.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
          {metrics.map((m, i) => (
            <div key={i} className="flex items-baseline gap-1.5">
              <span className="text-xs text-muted-foreground">{m.label}</span>
              <span
                className={cn(
                  'text-sm font-semibold tabular-nums',
                  m.tone === 'rose' ? 'text-rose-600'
                  : m.tone === 'amber' ? 'text-amber-600'
                  : m.tone === 'emerald' ? 'text-emerald-600'
                  : 'text-foreground'
                )}
              >
                {m.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {quickActions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {quickActions.map((a, i) => (
            <Button
              key={i}
              variant={i === 0 ? 'default' : 'outline'}
              size="sm"
              onClick={a.onClick}
              className="gap-2"
            >
              {a.icon && <a.icon className="w-3.5 h-3.5" />} {a.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}