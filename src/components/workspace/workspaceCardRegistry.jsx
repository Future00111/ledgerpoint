import React from 'react';
import OverviewCard from './cards/OverviewCard';
import FinancialSummaryCard from './cards/FinancialSummaryCard';
import BusinessHealthCard from './cards/BusinessHealthCard';
import TimelineCard from './cards/TimelineCard';
import RecentActivityCard from './cards/RecentActivityCard';
import DocumentsCard from './cards/DocumentsCard';
import RelatedRecordsCard from './cards/RelatedRecordsCard';
import AIInsightsCard from './cards/AIInsightsCard';
import TasksCard from './cards/TasksCard';
import RemindersCard from './cards/RemindersCard';
import AutomationCard from './cards/AutomationCard';
import AISuggestionsCard from './cards/AISuggestionsCard';

// The Workspace Card Registry.
// Maps a stable `kind` string to a reusable card component, so a Workspace is
// declared as data ({ kind, ...props }) instead of hand-assembled JSX.
// Add a new reusable card here once; every Workspace can then use it.
export const CARD_REGISTRY = {
  overview: OverviewCard,
  'financial-summary': FinancialSummaryCard,
  'business-health': BusinessHealthCard,
  timeline: TimelineCard,
  'recent-activity': RecentActivityCard,
  documents: DocumentsCard,
  'related-records': RelatedRecordsCard,
  'ai-insights': AIInsightsCard,
  tasks: TasksCard,
  reminders: RemindersCard,
  automation: AutomationCard,
  'ai-suggestions': AISuggestionsCard,
};

// Renders a single card from a config object: { kind, span, ...cardProps }.
// `kind` selects the component; everything else is passed as props.
export function renderCard(card) {
  if (!card || !card.kind) return null;
  const C = CARD_REGISTRY[card.kind];
  if (!C) return null;
  const { kind, span, ...props } = card;
  return <C {...props} />;
}