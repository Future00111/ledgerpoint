import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, CheckCircle2, Loader2, XCircle, Wrench } from 'lucide-react';

const CONTEXT_PREFIX = '[Active company:';

export function stripContext(content) {
  if (!content) return content;
  if (content.startsWith(CONTEXT_PREFIX)) {
    const idx = content.indexOf('\n\n');
    if (idx !== -1) return content.slice(idx + 2).trim();
  }
  return content;
}

function MarkdownLink({ href, children }) {
  const navigate = useNavigate();
  if (href && href.startsWith('/')) {
    return (
      <a href={href} onClick={(e) => { e.preventDefault(); navigate(href); }} className="text-primary underline underline-offset-2 hover:text-primary/80">
        {children}
      </a>
    );
  }
  return <a href={href} target="_blank" rel="noreferrer" className="text-primary underline">{children}</a>;
}

function statusInfo(toolCall) {
  const status = toolCall.status;
  if (status === 'failed' || status === 'error') return { Icon: XCircle, color: 'text-red-500', label: 'Failed' };
  if (status === 'completed' || status === 'success') return { Icon: CheckCircle2, color: 'text-emerald-500', label: 'Done' };
  return { Icon: Loader2, color: 'text-blue-500', label: 'Working…', spin: true };
}

function ToolCallDisplay({ toolCall }) {
  const [expanded, setExpanded] = useState(false);
  const { Icon, color, label, spin } = statusInfo(toolCall);

  const projection = toolCall.display_projection || {};
  const hideDetails = projection.hide_details && projection.details_redacted;
  const displayLabel = hideDetails
    ? (['failed', 'error'].includes(toolCall.status)
        ? (projection.error_label || 'Failed')
        : ['pending', 'running', 'in_progress'].includes(toolCall.status)
          ? (projection.active_label || 'Working…')
          : (projection.label || 'Done'))
    : label;

  let args = toolCall.arguments_string;
  let parsedArgs = args;
  try { parsedArgs = JSON.parse(args); } catch { /* keep raw */ }

  let results = toolCall.results;
  let parsedResults = results;
  if (typeof results === 'string') {
    try { parsedResults = JSON.parse(results); } catch { /* keep raw */ }
  }

  const entityName = toolCall.name || '';

  return (
    <div className="mt-2 text-xs">
      <button
        onClick={() => !hideDetails && setExpanded(!expanded)}
        className={`flex items-center gap-1.5 ${hideDetails ? 'cursor-default' : 'hover:bg-muted rounded px-1'} -mx-1`}
      >
        {hideDetails ? (
          <Icon className={`w-3.5 h-3.5 ${color} ${spin ? 'animate-spin' : ''}`} />
        ) : (
          <Icon className={`w-3.5 h-3.5 ${color} ${spin ? 'animate-spin' : ''}`} />
        )}
        <span className="font-medium text-muted-foreground">{entityName}</span>
        <span className={color}>· {displayLabel}</span>
        {!hideDetails && (
          expanded
            ? <ChevronDown className="w-3 h-3 text-muted-foreground" />
            : <ChevronRight className="w-3 h-3 text-muted-foreground" />
        )}
      </button>
      {expanded && !hideDetails && (
        <div className="mt-1.5 ml-5 space-y-1.5">
          {parsedArgs && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Parameters</p>
              <pre className="bg-muted rounded p-1.5 overflow-x-auto text-[10px] leading-relaxed">{JSON.stringify(parsedArgs, null, 2)}</pre>
            </div>
          )}
          {parsedResults !== undefined && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Result</p>
              <pre className="bg-muted rounded p-1.5 overflow-x-auto text-[10px] leading-relaxed max-h-40">{typeof parsedResults === 'string' ? parsedResults : JSON.stringify(parsedResults, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  const display = isUser ? stripContext(message.content) : message.content;

  return (
    <div className={isUser ? 'flex justify-end' : 'flex justify-start'}>
      <div className={`max-w-[85%] ${isUser ? '' : 'w-full'}`}>
        {display && (
          isUser ? (
            <div className="rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-3.5 py-2 text-sm">
              {display}
            </div>
          ) : (
            <div className="rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2.5 text-sm">
              <ReactMarkdown
                components={{ a: MarkdownLink }}
                className="prose prose-sm max-w-none prose-p:my-1 prose-li:my-0 prose-headings:mb-1 prose-table:text-xs"
              >
                {display}
              </ReactMarkdown>
            </div>
          )
        )}
        {message.tool_calls?.map((tc, idx) => (
          <div key={idx} className={isUser ? '' : 'ml-0'}>
            <ToolCallDisplay toolCall={tc} />
          </div>
        ))}
      </div>
    </div>
  );
}