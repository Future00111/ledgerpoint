import React from 'react';
import { Play, Pause, Pencil, Trash2, Zap, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CATEGORY_LABELS } from './workflowBlocks';
import { relativeTime } from '@/lib/format';

export default function AutomationCard({ automation, onToggle, onEdit, onDelete }) {
  const isActive = automation.status === 'active';
  const workflow = automation.workflow || [];
  const whenBlock = workflow.find((b) => b.type === 'when');
  const thenBlock = workflow.find((b) => b.type === 'then');

  return (
    <Card className="p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-primary/10' : 'bg-muted'}`}>
            <Zap className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm leading-tight truncate">{automation.name}</p>
            <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[automation.category] || automation.category}</p>
          </div>
        </div>
        <button
          onClick={onToggle}
          className={`p-1.5 rounded-md transition-colors flex-shrink-0 ${isActive ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
          title={isActive ? 'Pause' : 'Activate'}
        >
          {isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>
      </div>

      {automation.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{automation.description}</p>
      )}

      <div className="space-y-1">
        {whenBlock && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
            <span className="truncate">When {whenBlock.text}</span>
          </p>
        )}
        {thenBlock && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0" />
            <span className="truncate">Then {thenBlock.text}</span>
          </p>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border">
        <div className="flex items-center gap-1.5 flex-wrap">
          {isActive ? (
            <Badge variant="default" className="text-[10px]">Active</Badge>
          ) : automation.status === 'paused' ? (
            <Badge variant="secondary" className="text-[10px]">Paused</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] capitalize">{automation.status || 'draft'}</Badge>
          )}
          {automation.test_mode && (
            <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">Test</Badge>
          )}
          {automation.requires_approval && (
            <Badge variant="outline" className="text-[10px]">Approval</Badge>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={onEdit} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground" title="Edit">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-destructive" title="Delete">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {automation.last_run_date && (
        <p className="text-[11px] text-muted-foreground/70 flex items-center gap-1">
          <Clock className="w-3 h-3" /> Last run {relativeTime(automation.last_run_date)}
        </p>
      )}
    </Card>
  );
}