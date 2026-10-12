---
name: AI service layer
description: Provider-agnostic AI service architecture in the api-server; how to add a new provider.
---

# AI Service Layer

## Structure
- `artifacts/api-server/src/services/ai/types.ts` — AIProvider interface, AICompletionOptions/Result, AIProviderError
- `artifacts/api-server/src/services/ai/providers/openai.ts` — OpenAI implementation (only file that imports the `openai` SDK)
- `artifacts/api-server/src/services/ai/index.ts` — singleton `aiService` exported to the rest of the app; factory switches on `AI_PROVIDER` env-var (default: "openai")

## How to add a new provider
1. Create `src/services/ai/providers/<name>.ts` implementing `AIProvider`.
2. Import it in `createAIProvider()` in `index.ts`; add a `case "<name>"` keyed on `AI_PROVIDER`.
3. Add the provider's SDK to `artifacts/api-server/package.json`.
4. No other application code changes needed.

## Wired functions (functions.ts)
- `testAI` — minimal test endpoint (no company context required); returns `{ ok, provider, model, reply }`
- `askAI` — general accounting chat; accepts `{ prompt }` or `{ messages }`, optional `company_id` for membership check
- `generateInsights`, `createRecordFromDocument` — still 503; need domain logic before implementing

**Why:** Keeps all provider-specific SDK code isolated so the accounting logic never imports a vendor SDK directly.
