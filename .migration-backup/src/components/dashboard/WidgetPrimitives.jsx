import React from 'react';
import { Sparkles } from 'lucide-react';

export function Skeleton({ className, style }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className || ''}`} style={style} />;
}

export function ListSkeleton({ rows = 4 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction, askLabel, onAsk }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-8 px-4 h-full min-h-[160px]">
      {Icon && (
        <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center mb-3">
          <Icon className="w-5 h-5 text-muted-foreground" />
        </div>
      )}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">{description}</p>}
      {(actionLabel || onAsk) && (
        <div className="flex items-center gap-2 mt-4">
          {actionLabel && (
            <button onClick={onAction} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
              {actionLabel}
            </button>
          )}
          {onAsk && (
            <button onClick={onAsk} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-muted flex items-center gap-1.5 transition-colors">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              {askLabel || 'Ask'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const STATUS_STYLES = {
  draft: 'bg-muted text-muted-foreground',
  approved: 'bg-blue-50 text-blue-600',
  sent: 'bg-blue-50 text-blue-600',
  part_paid: 'bg-amber-50 text-amber-600',
  paid: 'bg-emerald-50 text-emerald-600',
  overdue: 'bg-rose-50 text-rose-600',
  awaiting_review: 'bg-amber-50 text-amber-600',
  review: 'bg-amber-50 text-amber-600',
  matched: 'bg-emerald-50 text-emerald-600',
  cancelled: 'bg-muted text-muted-foreground',
};

export function StatusBadge({ status }) {
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${STATUS_STYLES[status] || 'bg-muted text-muted-foreground'}`}>
      {(status || '').replace(/_/g, ' ')}
    </span>
  );
}