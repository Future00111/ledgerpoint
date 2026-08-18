/**
 * Provider-agnostic AI service interface.
 *
 * Every provider (OpenAI, Anthropic, Gemini, …) must implement AIProvider.
 * The rest of the application depends only on this file — never on a
 * provider-specific SDK.
 */

// ─── Message format ───────────────────────────────────────────────────────────

export type AIRole = "system" | "user" | "assistant";

export interface AIMessage {
  role: AIRole;
  content: string;
}

// ─── Completion options ───────────────────────────────────────────────────────

export interface AICompletionOptions {
  /** Conversation history / prompt. At least one message is required. */
  messages: AIMessage[];
  /**
   * Provider-specific model identifier, e.g. "gpt-4o" for OpenAI or
   * "claude-3-5-sonnet-20241022" for Anthropic.  Each provider should
   * apply a sensible default when omitted.
   */
  model?: string;
  /** Maximum tokens the provider may generate in its response. */
  maxTokens?: number;
  /** Sampling temperature (0–2 for OpenAI; 0–1 for Anthropic / Gemini). */
  temperature?: number;
}

// ─── Completion result ────────────────────────────────────────────────────────

export interface AICompletionResult {
  /** The assistant's reply text. */
  text: string;
  /** Actual model used (providers may map aliases to concrete names). */
  model: string;
  /** Human-readable provider identifier, e.g. "openai" or "anthropic". */
  provider: string;
}

// ─── Provider interface ───────────────────────────────────────────────────────

/**
 * Implement this interface to add a new AI provider.
 *
 * Minimal checklist for a new provider:
 *  1. Create `src/services/ai/providers/<name>.ts` that implements AIProvider.
 *  2. In `src/services/ai/index.ts`, import and return the new provider from
 *     `createAIProvider()` (keyed on an env-var like AI_PROVIDER=anthropic).
 *  3. Add the provider's SDK to the api-server package.json.
 *  4. No other application code needs to change.
 */
export interface AIProvider {
  /** Stable identifier used in logs and response metadata. */
  readonly name: string;

  /**
   * Send a chat completion request and return the assistant's reply.
   * Throws an `AIProviderError` on non-retryable failures so callers can
   * surface a consistent error shape.
   */
  complete(options: AICompletionOptions): Promise<AICompletionResult>;
}

// ─── Error type ───────────────────────────────────────────────────────────────

export class AIProviderError extends Error {
  constructor(
    public readonly provider: string,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}
