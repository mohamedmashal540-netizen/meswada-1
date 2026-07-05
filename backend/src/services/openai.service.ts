import OpenAI from 'openai';
import { config } from '../config/env';
import { AppError } from '../middlewares/errorHandler';

type RewriteMode = 'comedy' | 'formal' | 'casual';
type ChatMessage = OpenAI.Chat.ChatCompletionMessageParam;

/**
 * Minimal circuit breaker.
 *
 * Once a provider has failed `threshold` times in a row, we stop calling
 * it for `cooldownMs` and skip straight to the next provider in the
 * chain. Without this, every single request would still pay the latency
 * of a doomed OpenAI call (e.g. a request that's guaranteed to 429 with
 * insufficient_quota) before falling back — multiplying response time
 * for no benefit once we already know the provider is down.
 */
class CircuitBreaker {
  private failures = new Map<string, number>();
  private openUntil = new Map<string, number>();

  constructor(private readonly threshold = 3, private readonly cooldownMs = 5 * 60_000) {}

  isOpen(key: string): boolean {
    const until = this.openUntil.get(key);
    return !!until && Date.now() < until;
  }

  recordSuccess(key: string): void {
    this.failures.set(key, 0);
    this.openUntil.delete(key);
  }

  recordFailure(key: string): void {
    const count = (this.failures.get(key) ?? 0) + 1;
    this.failures.set(key, count);
    if (count >= this.threshold) {
      this.openUntil.set(key, Date.now() + this.cooldownMs);
    }
  }
}

const breaker = new CircuitBreaker();

/**
 * Configuration/auth errors (invalid key, malformed request) indicate a
 * bug or misconfiguration on our side — not a transient provider issue.
 * We still fail over (per the "never 502 the user" requirement), but we
 * log these at `error` level so they don't disappear into the noise of
 * normal rate-limit/quota warnings. A masked 401 is a bug nobody will
 * ever find.
 */
function isConfigurationError(error: unknown): boolean {
  const status = (error as { status?: number } | undefined)?.status;
  return status === 401 || status === 400;
}

function describeError(error: unknown): string {
  const err = error as { status?: number; code?: string; message?: string } | undefined;
  return `status=${err?.status ?? 'unknown'} code=${err?.code ?? 'unknown'} message=${err?.message ?? String(error)}`;
}

class OpenAiService {
  private primaryClient: OpenAI | null = null;
  private fallbackClient: OpenAI | null = null;

  private getPrimaryClient(): OpenAI {
    if (!this.primaryClient) {
      if (!config.openai.apiKey) {
        throw new AppError(503, 'Primary AI provider is not configured (missing OPENAI_API_KEY).');
      }
      this.primaryClient = new OpenAI({
        apiKey: config.openai.apiKey,
        organization: config.openai.organization || undefined,
      });
    }
    return this.primaryClient;
  }

  private getFallbackClient(): OpenAI | null {
    if (!config.aiFallback.apiKey) return null;
    if (!this.fallbackClient) {
      this.fallbackClient = new OpenAI({
        apiKey: config.aiFallback.apiKey,
        baseURL: config.aiFallback.baseURL,
      });
    }
    return this.fallbackClient;
  }

  private async callChat(
    client: OpenAI,
    model: string,
    messages: ChatMessage[],
    maxTokens: number
  ): Promise<string | null> {
    const response = await client.chat.completions.create({
      model,
      messages,
      max_completion_tokens: maxTokens,
    });
    return response.choices[0]?.message?.content ?? null;
  }

  /**
   * Tries, in order: OpenAI -> free OpenAI-compatible fallback provider
   * (Groq by default) -> a local heuristic response. Returns as soon as
   * one step succeeds. Never throws: the caller always gets a usable
   * string back instead of a 502, which is the behavior you asked for.
   *
   * Unlike a static mock, the fallback provider step means most outages
   * (quota exhausted, OpenAI down, rate limited) are invisible to the
   * end user because they get a REAL AI response from the second
   * provider. The local heuristic is only a last resort when both AI
   * providers are unreachable, and it's honest about being degraded
   * rather than pretending to be a normal AI response.
   */
  private async runWithFallback(
    messages: ChatMessage[],
    maxTokens: number,
    localFallback: () => string
  ): Promise<string> {
    // 1. Primary: OpenAI
    if (config.openai.apiKey && !breaker.isOpen('openai')) {
      try {
        const client = this.getPrimaryClient();
        const result = await this.callChat(client, config.openai.model, messages, maxTokens);
        if (result) {
          breaker.recordSuccess('openai');
          return result;
        }
      } catch (error) {
        breaker.recordFailure('openai');
        const log = isConfigurationError(error) ? console.error : console.warn;
        log(`[AI] OpenAI call failed, failing over — ${describeError(error)}`);
      }
    }

    // 2. Secondary: free/cheap OpenAI-compatible provider (e.g. Groq)
    const fallbackClient = this.getFallbackClient();
    if (fallbackClient && !breaker.isOpen('fallback')) {
      try {
        const result = await this.callChat(fallbackClient, config.aiFallback.model, messages, maxTokens);
        if (result) {
          breaker.recordSuccess('fallback');
          return result;
        }
      } catch (error) {
        breaker.recordFailure('fallback');
        console.warn(`[AI] Fallback provider call failed — ${describeError(error)}`);
      }
    }

    // 3. Last resort: local heuristic. Clearly labeled as degraded mode,
    // never presented as if it came from a real AI call.
    console.warn('[AI] All AI providers unavailable — returning local degraded-mode response.');
    return localFallback();
  }

  async summarize(text: string): Promise<string> {
    return this.runWithFallback(
      [
        {
          role: 'system',
          content:
            'You are a helpful assistant that summarizes text concisely. Always respond in the same language as the input text.',
        },
        { role: 'user', content: `Please summarize the following text:\n\n${text}` },
      ],
      500,
      () => this.localSummarize(text)
    );
  }

  async rewrite(text: string, mode: RewriteMode): Promise<string> {
    const modeInstructions: Record<RewriteMode, string> = {
      comedy:
        'Rewrite it in a humorous, witty, and entertaining tone. Add comedic elements while keeping the main message.',
      formal: 'Rewrite it in a formal, professional tone.',
      casual: 'Rewrite it in a casual, conversational tone.',
    };

    return this.runWithFallback(
      [
        {
          role: 'system',
          content: `You are a helpful assistant that rewrites text. ${modeInstructions[mode]} Always respond in the same language as the input text.`,
        },
        { role: 'user', content: `Please rewrite the following text:\n\n${text}` },
      ],
      1000,
      () => this.localDegradedNotice(text)
    );
  }

  async translate(text: string): Promise<string> {
    return this.runWithFallback(
      [
        {
          role: 'system',
          content: `You are a professional translator. Detect the language of the input text:
- If the text is in English, translate it to Arabic.
- If the text is in Arabic, translate it to English.
Maintain the original meaning, tone, and style. Only provide the translation, no explanations.`,
        },
        { role: 'user', content: text },
      ],
      1000,
      () => this.localDegradedNotice(text)
    );
  }

  /** Extractive local summary (first ~2 sentences) — no API call needed. */
  private localSummarize(text: string): string {
    const isArabic = /[\u0600-\u06FF]/.test(text);
    const sentences = text.split(/(?<=[.!؟?])\s+/).filter(Boolean);
    const excerpt = (sentences.slice(0, 2).join(' ') || text).slice(0, 240).trim();
    const label = isArabic
      ? '(وضع محدود — كل مزودي الذكاء الاصطناعي غير متاحين حاليًا) أول سطرين من النص:'
      : '(Degraded mode — no AI provider reachable) First lines of the text:';
    return `${label} ${excerpt}${excerpt.length < text.length ? '…' : ''}`;
  }

  /**
   * For rewrite/translate we can't fabricate a real transformation
   * locally without lying about what happened — so instead of a fake
   * generic sentence, we return an honest, clearly labeled notice. This
   * is deliberately not a "confident-looking" mock: a static fake
   * rewrite/translation that looks plausible is worse than an honest
   * "AI unavailable" message, because it can mislead the user into
   * trusting content that was never actually processed.
   */
  private localDegradedNotice(text: string): string {
    const isArabic = /[\u0600-\u06FF]/.test(text);
    return isArabic
      ? `تعذر الوصول لأي خدمة ذكاء اصطناعي حاليًا (كل المزودين غير متاحين). النص الأصلي لسه موجود من غير تعديل:\n\n${text}`
      : `No AI provider is reachable right now. Your original text is unchanged below:\n\n${text}`;
  }
}

export const openAiService = new OpenAiService();
