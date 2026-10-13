export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Parse Groq/OpenAI-style "Please try again in 37.9425s" or Retry-After header. */
export function parseRetryAfterMs(body: string, headerValue?: string | null): number | null {
  if (headerValue) {
    const asNum = Number(headerValue);
    if (Number.isFinite(asNum) && asNum >= 0) {
      // HTTP Retry-After is seconds if numeric
      return Math.ceil(asNum * 1000);
    }
    const asDate = Date.parse(headerValue);
    if (Number.isFinite(asDate)) {
      return Math.max(0, asDate - Date.now());
    }
  }

  const msHint = /retry_after_ms\s*=\s*(\d+)/i.exec(body);
  if (msHint) {
    return Number(msHint[1]);
  }

  const m =
    /try again in\s+(\d+(?:\.\d+)?)\s*s/i.exec(body) ||
    /retry after\s+(\d+(?:\.\d+)?)\s*s/i.exec(body) ||
    /"retry[_\s-]?after"\s*:\s*(\d+(?:\.\d+)?)/i.exec(body);
  if (m) {
    return Math.ceil(Number(m[1]) * 1000);
  }
  return null;
}

export function isRateLimitError(status: number, body: string): boolean {
  if (status === 429) return true;
  return /rate_limit|rate limit|tokens per minute|TPM/i.test(body);
}

export type RetryHooks = {
  onWait?: (seconds: number, attempt: number) => void | Promise<void>;
};

/**
 * Retry async LLM call on 429 / rate limit. Waits the server-suggested delay (+ small jitter).
 */
export async function withRateLimitRetry<T>(
  label: string,
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    hooks?: RetryHooks;
    /** Fallback wait when body has no delay hint */
    defaultWaitMs?: number;
    maxWaitMs?: number;
  } = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 8;
  const defaultWaitMs = options.defaultWaitMs ?? 40_000;
  const maxWaitMs = options.maxWaitMs ?? 120_000;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const message = err instanceof Error ? err.message : String(err);
      const statusMatch = /HTTP\s+(\d+)/i.exec(message);
      const status = statusMatch ? Number(statusMatch[1]) : 0;
      if (!isRateLimitError(status, message) && !/429/.test(message)) {
        throw err;
      }
      if (attempt >= maxAttempts) break;

      let waitMs = parseRetryAfterMs(message) ?? defaultWaitMs;
      waitMs = Math.min(maxWaitMs, Math.max(2_000, waitMs + Math.floor(Math.random() * 1500)));
      const seconds = Math.ceil(waitMs / 1000);
      console.warn(`[agents-team] ${label} rate limit, wait ${seconds}s (attempt ${attempt}/${maxAttempts})`);
      await options.hooks?.onWait?.(seconds, attempt);
      await sleep(waitMs);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
