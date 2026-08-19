import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Check, X, ArrowRight, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { gbp } from './api';
import { useNavigate } from 'react-router-dom';

export default function AITaskCard({ task, onDecide, deciding }) {
  const nav = useNavigate();
  const [expanded, setExpanded] = useState(false);

  const isApproved = task.status === 'approved';
  const isDismissed = task.status === 'dismissed';
  const isCompleted = task.status === 'completed';
  const isInactive = isApproved || isDismissed || isCompleted;
  
  const priorityColors = {
    critical: 'bg-rose-500',
    high: 'bg-orange-500',
    medium: 'bg-indigo-500',
    low: 'bg-slate-400',
  };

  const pColor = priorityColors[task.priority] || priorityColors.low;

  return (
    <div className={`group flex flex-col border border-slate-200 bg-white rounded-lg transition-all hover:border-indigo-300 hover:shadow-sm ${isInactive ? 'opacity-60 grayscale-[0.5]' : ''}`}>
      {/* Dense Row */}
      <div className="flex items-center gap-4 p-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${pColor}`} />
        
        <div className="flex-1 grid grid-cols-12 gap-4 items-center">
          {/* Title & Type */}
          <div className="col-span-5 md:col-span-4 flex flex-col min-w-0">
            <span className="text-xs font-bold text-slate-900 truncate">{task.title}</span>
            <span className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase truncate mt-0.5">
              {(task.task_type || '').replace(/_/g, ' ')}
            </span>
          </div>

          {/* Description Snippet */}
          <div className="hidden md:flex col-span-4 flex-col min-w-0">
            <span className="text-xs text-slate-600 truncate">{task.description}</span>
            {task.recommendation && (
              <span className="text-[10px] text-indigo-600 font-medium truncate mt-0.5">↳ {task.recommendation}</span>
            )}
          </div>

          {/* Impact & Confidence */}
          <div className="col-span-7 md:col-span-4 flex items-center justify-end gap-5 text-right pr-2">
            {task.amount != null && task.amount > 0 && (
              <div className="flex flex-col items-end shrink-0">
                <span className="text-xs font-bold text-slate-900 tabular-nums">{gbp(task.amount)}</span>
                <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Impact</span>
              </div>
            )}
            {task.confidence_score != null && (
              <div className="flex flex-col items-end w-16 shrink-0">
                <span className="text-xs font-bold text-indigo-700 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> {task.confidence_score}%
                </span>
                <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Confidence</span>
              </div>
            )}
          </div>
        </div>

        {/* Expand Toggle */}
        <div className="flex items-center pl-2 border-l border-slate-100 shrink-0">
            <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] text-slate-500 hover:text-indigo-600" aria-expanded={expanded} data-testid={`button-view-details-${task.id}`} onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}>
              <span className="sr-only md:not-sr-only">View details</span>
             {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
           </Button>
        </div>
      </div>

      {/* Expanded Detail View */}
      {expanded && (
        <div className="p-4 pt-3 border-t border-slate-100 bg-slate-50/50 rounded-b-lg">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 space-y-4 min-w-0">
              <div>
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <FileText className="w-3 h-3" /> Explanation
                </h4>
                <p className="text-xs text-slate-700 leading-relaxed max-w-2xl">{task.description}</p>
              </div>
              {task.recommendation && (
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Recommended Action</h4>
                  <p className="text-xs font-medium text-indigo-900 bg-indigo-50/50 p-2.5 rounded border border-indigo-100 max-w-2xl">
                    {task.recommendation}
                  </p>
                </div>
              )}
              {task.evidence && (
                <div>
                   <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Evidence Data</h4>
                   <pre className="text-[10px] text-slate-500 bg-white border border-slate-200 p-2.5 rounded overflow-x-auto max-w-2xl max-h-40">
                     {JSON.stringify(task.evidence, null, 2)}
                   </pre>
                </div>
              )}
            </div>
            
            <div className="w-full md:w-64 flex flex-col shrink-0">
              <div className="bg-white border border-slate-200 p-3.5 rounded shadow-sm">
                <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">
                  Decisions record your review but do <strong className="font-semibold text-slate-700">not automatically alter</strong> the books.
                </p>
                {!isInactive && (
                  <div className="flex gap-2 mb-3">
                    <Button size="sm" className="flex-1 h-8 bg-indigo-600 hover:bg-indigo-700 text-white text-xs shadow-sm" 
                      disabled={deciding} data-testid={`button-approve-task-${task.id}`} onClick={() => onDecide(task.id, 'approved')}>
                      <Check className="w-3.5 h-3.5 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs border-slate-200 text-slate-700 hover:bg-slate-50" 
                      disabled={deciding} data-testid={`button-dismiss-task-${task.id}`} onClick={() => onDecide(task.id, 'dismissed')}>
                      <X className="w-3.5 h-3.5 mr-1" /> Dismiss
                    </Button>
                  </div>
                )}
                {isInactive && (
                  <div className="mb-3 p-2 bg-slate-50 rounded border border-slate-200 flex items-center justify-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs font-medium text-slate-600 uppercase tracking-wider">
                      Marked as {task.status}
                    </span>
                  </div>
                )}
                {task.route && (
                  <Button size="sm" variant="ghost" className="w-full h-8 text-xs text-indigo-700 hover:text-indigo-900 hover:bg-indigo-50"
                    onClick={() => nav(task.route)}>
                    View Source Record <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
