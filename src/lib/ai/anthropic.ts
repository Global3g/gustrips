/**
 * Anthropic client wrapper for gustrips.
 *
 * Why a wrapper, not direct SDK use everywhere:
 *   - One place to pick the right model per task (Sonnet for the
 *     concierge, Haiku for high-volume parsing).
 *   - Sane defaults for prompt caching — `cache_control` on the system
 *     prompt buys us ~90% discount on repeat hits, which is the
 *     difference between $5/user/mo and $0.50/user/mo at any real scale.
 *   - Single guardrail for max_tokens, timeouts and retry policy so a
 *     run-away response can't burn through the monthly cap silently.
 *
 * Models (May 2026):
 *   - claude-opus-4-7      → highest reasoning, slow, $$$$. Reserve for
 *                            multi-step trip planning that justifies it.
 *   - claude-sonnet-4-6    → balanced. Default for the concierge,
 *                            highlight selection, daily-diary generation.
 *   - claude-haiku-4-5     → fast + cheap. Use for email parsing, label
 *                            extraction, classification, anything bulk.
 */

import Anthropic from '@anthropic-ai/sdk';

export const ANTHROPIC_MODELS = {
  /** Heaviest reasoning. Use sparingly. */
  opus: 'claude-opus-4-7',
  /** Default. Conversational, knows context, fast enough to stream. */
  sonnet: 'claude-sonnet-4-6',
  /** Cheap and fast. Email parsing, classification, batch jobs. */
  haiku: 'claude-haiku-4-5-20251001',
} as const;

export type AnthropicModel = (typeof ANTHROPIC_MODELS)[keyof typeof ANTHROPIC_MODELS];

let _client: Anthropic | null = null;

/**
 * Lazy-instantiated client. Reads the API key from the env var at first
 * call so missing keys fail loudly at first use rather than at import
 * time (which would break the build on Vercel when the env var isn't
 * set yet during the first deploy).
 */
export function getAnthropicClient(): Anthropic {
  if (_client) return _client;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      '[anthropic] ANTHROPIC_API_KEY is not set. Add it in Vercel Project Settings → Environment Variables.',
    );
  }

  _client = new Anthropic({
    apiKey,
    // Conservative timeout — the concierge streams, so the SDK-level
    // timeout only triggers if the model truly hangs.
    timeout: 60_000,
    maxRetries: 2,
  });
  return _client;
}

/**
 * True iff the API key is present. Useful for UI gates that show a
 * "AI features unavailable" banner instead of trying and failing.
 */
export function isAnthropicConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}
