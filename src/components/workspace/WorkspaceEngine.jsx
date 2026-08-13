import React, { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import WorkspaceShell from './WorkspaceShell';
import WorkspaceSkeleton from './WorkspaceSkeleton';
import { renderCard } from './workspaceCardRegistry';
import { cn } from '@/lib/utils';

// Static class maps so Tailwind keeps the literal strings (no dynamic names).
const COLS = { 1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3' };
const SPAN = { full: 'lg:col-span-3', 2: 'lg:col-span-2', 1: 'lg:col-span-1' };

// =============================================================================
// The Ledgerly Workspace Engine
// =============================================================================
// One configurable engine renders every Workspace. A Workspace is declared as a
// config object — header, summaryStats, tabs (each a list of cards), a right-
// hand context panel and an Ask context. The engine renders the shared shell
// and pulls the correct cards from the registry. Only the data and the
// available actions differ between Workspaces; the layout, interaction model
// and components stay identical.
//
// tab card config:  { kind, span?, ...cardProps }
//   span: 1 | 2 | 'full'   (column span within the tab grid)
// tab config:       { label, value?, columns?, cards: [card config] }
// contextPanel:     [card config]  (stacked in the right panel)
// =============================================================================
export default function WorkspaceEngine({
  type,            // 'customer' | 'supplier' | 'invoice' | ... (analytics + theming)
  open,
  onOpenChange,
  loading = false,
  header,
  executiveSummary,
  summaryStats = [],
  tabs = [],
  contextPanel = [],
  ask,
  primaryActions,
  arrival,
}) {
  useEffect(() => {
    if (open && type) {
      base44.analytics?.track?.({ eventName: 'workspace_opened', properties: { workspace_type: type } });
    }
  }, [open, type]);

  const tabsConfig = tabs.map((t) => {
    const value = t.value || t.label.toLowerCase().replace(/\s+/g, '-');
    const content = loading ? (
      <WorkspaceSkeleton lines={6} />
    ) : (
      <div className={cn('grid gap-4 items-start', COLS[t.columns] || COLS[3])}>
        {(t.cards || []).map((c, i) => (
          <div key={i} className={cn('min-w-0', SPAN[c.span] || SPAN[1])}>
            {renderCard(c)}
          </div>
        ))}
      </div>
    );
    return { value, label: t.label, icon: t.icon, content };
  });

  const panel = contextPanel.length ? (
    <>
      {contextPanel.map((c, i) => (
        <React.Fragment key={i}>{renderCard(c)}</React.Fragment>
      ))}
    </>
  ) : null;

  const executiveSummaryNode = executiveSummary ? renderCard(executiveSummary) : null;
  const primaryActionsNode = primaryActions ? renderCard(primaryActions) : null;

  return (
    <WorkspaceShell
      open={open}
      onOpenChange={onOpenChange}
      header={header}
      executiveSummary={executiveSummaryNode}
      primaryActions={primaryActionsNode}
      summaryStats={summaryStats}
      tabs={tabsConfig}
      loading={loading}
      ask={ask}
      arrival={arrival}
      contextPanel={panel}
    />
  );
}