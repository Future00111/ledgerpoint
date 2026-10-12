// The Ask Engine — processes every request before AI is used.
//
// Pipeline order:
//   1. instant_search   — client catalog (ms) + entity search (backend)
//   2. intent_detection  — question / create / action cues
//   3. navigation        — page matches
//   4. action_execution  — quick actions
//   5. ai_conversation   — only when no results or a question
//
// AskModal consumes the engine's helpers so the whole flow is centralised here.

import { getNavigationMatches, getCreateMatches, getActionMatches, isQuestion } from './askIntents';
import { searchCatalog } from './askCatalog';
import { rankBoost } from './askLearning';

export const STAGES = [
  'instant_search',
  'intent_detection',
  'navigation',
  'action_execution',
  'ai_conversation',
];

// Stage 2: intent detection (synchronous).
export function detectIntents(query, isOwner) {
  return {
    navigation: getNavigationMatches(query),
    create: getCreateMatches(query, isOwner),
    action: getActionMatches(query),
    isQuestion: isQuestion(query),
  };
}

// Stage 1 (client part): instant catalog search — no network.
export { searchCatalog };

// Merge + rank result groups. Pinned > frequent > recent > insertion order.
export function rankGroups(...groupSets) {
  const merged = [].concat(...groupSets).filter(Boolean);
  return merged
    .map((g) => ({
      ...g,
      items: g.items
        .map((it) => ({ ...it, _boost: rankBoost(g.label, it) }))
        .sort((a, b) => b._boost - a._boost),
    }))
    .filter((g) => g.items.length);
}

// Stage 5: AI escalation. Navigation and search never require AI.
export function shouldEscalateToAI({ hasResults, isQuestion }) {
  // Simple searches are never sent to AI — they are handled entirely by the
  // Ask Search Engine. AI is only used when the user explicitly asks a question.
  return isQuestion;
}