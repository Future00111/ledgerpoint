/**
 * OpenAI provider implementation.
 *
 * All OpenAI-specific code lives here.  Nothing outside this file should
 * import from the "openai" SDK directly.
 */
import OpenAI from "openai";
import type {
  AICompletionOptions,
  AICompletionResult,
  AIProvider,
} from "../types.js";
import { AIProviderError } from "../types.js";

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TEMPERATURE = 0.7;

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";

  private readonly client: OpenAI;
  private readonly defaultModel: string;

  constructor(options?: { apiKey?: string; defaultModel?: string }) {
    const apiKey = options?.apiKey ?? process.env["OPENAI_API_KEY"];
    if (!apiKey) {
      throw new AIProviderError(
        "openai",
        "OPENAI_API_KEY environment variable is not set",
      );
    }
    this.client = new OpenAI({ apiKey });
    this.defaultModel = options?.defaultModel ?? DEFAULT_MODEL;
  }

  async complete(options: AICompletionOptions): Promise<AICompletionResult> {
    const model = options.model ?? this.defaultModel;
    try {
      const response = await this.client.chat.completions.create({
        model,
        messages: options.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
        temperature: options.temperature ?? DEFAULT_TEMPERATURE,
      });

      const choice = response.choices[0];
      if (!choice) {
        throw new AIProviderError("openai", "No completion choices returned");
      }

      const text = choice.message.content ?? "";
      return {
        text,
        model: response.model,
        provider: this.name,
      };
    } catch (err) {
      // Re-throw AIProviderError as-is; wrap anything else.
      if (err instanceof AIProviderError) throw err;
      const message =
        err instanceof Error ? err.message : "Unknown OpenAI error";
      throw new AIProviderError("openai", message, err);
    }
  }
}
