/**
 * Central AI service.
 *
 * This is the only import the rest of the application needs:
 *
 *   import { aiService } from "../services/ai/index.js";
 *
 * To add a new provider later:
 *   1. Create `providers/<name>.ts` implementing AIProvider.
 *   2. Import it in createAIProvider() below.
 *   3. Add a case for it keyed on AI_PROVIDER env-var (e.g. "anthropic").
 *   4. That's it — no other application code changes.
 *
 * The singleton is created once at module load time so the provider
 * constructor (which validates credentials) fails fast on startup.
 */
import type { AIProvider } from "./types.js";
import { AIProviderError } from "./types.js";
import { OpenAIProvider } from "./providers/openai.js";

export type { AIProvider, AICompletionOptions, AICompletionResult, AIMessage, AIRole } from "./types.js";
export { AIProviderError } from "./types.js";

// ─── Provider factory ─────────────────────────────────────────────────────────

/**
 * Instantiates the provider selected by the AI_PROVIDER environment variable.
 * Defaults to "openai".
 *
 * Supported values:
 *   AI_PROVIDER=openai   → OpenAIProvider (default)
 *
 * Future providers (not yet implemented):
 *   AI_PROVIDER=anthropic → AnthropicProvider
 *   AI_PROVIDER=gemini    → GeminiProvider
 */
function createAIProvider(): AIProvider {
  const providerName = (process.env["AI_PROVIDER"] ?? "openai").toLowerCase();

  switch (providerName) {
    case "openai":
      return new OpenAIProvider();

    // ── Add new providers here ─────────────────────────────────────────────
    // case "anthropic":
    //   return new AnthropicProvider();
    //
    // case "gemini":
    //   return new GeminiProvider();
    // ──────────────────────────────────────────────────────────────────────

    default:
      throw new AIProviderError(
        providerName,
        `Unknown AI provider "${providerName}". Set AI_PROVIDER to a supported value (openai).`,
      );
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const aiService: AIProvider = createAIProvider();
