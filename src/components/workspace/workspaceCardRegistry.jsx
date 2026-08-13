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
import NextActionsCard from './cards/NextActionsCard';
import ExecutiveSummaryCard from './cards/ExecutiveSummaryCard';
import NeedsAttentionCard from './cards/NeedsAttentionCard';
import ProfileCard from './cards/ProfileCard';
import CustomerHealthCard from './cards/CustomerHealthCard';
import NotesCard from './cards/NotesCard';
import RelationshipIntelligenceCard from './cards/RelationshipIntelligenceCard';
import CustomerTagsCard from './cards/CustomerTagsCard';
import CollectionsCentreCard from './cards/CollectionsCentreCard';
import RevenueAnalyticsCard from './cards/RevenueAnalyticsCard';
import CustomerLifecycleCard from './cards/CustomerLifecycleCard';
import CommunicationCentreCard from './cards/CommunicationCentreCard';

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
  'next-actions': NextActionsCard,
  'executive-summary': ExecutiveSummaryCard,
  'needs-attention': NeedsAttentionCard,
  'profile': ProfileCard,
  'customer-health': CustomerHealthCard,
  'relationship-intelligence': RelationshipIntelligenceCard,
  'customer-tags': CustomerTagsCard,
  'collections-centre': CollectionsCentreCard,
  'revenue-analytics': RevenueAnalyticsCard,
  'customer-lifecycle': CustomerLifecycleCard,
  'communication-centre': CommunicationCentreCard,
  'notes': NotesCard,
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