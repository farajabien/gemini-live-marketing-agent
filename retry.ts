/**
 * Generic retry wrapper for async functions with exponential backoff.
 * Useful for handling transient API errors like 429 Resource Exhausted.
 */

interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  factor?: number;
  retryOnStatusCodes?: number[];
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    factor = 2,
    retryOnStatusCodes = [429, 500, 502, 503, 504],
  } = options;

  let attempt = 1;
  let delay = initialDelay;

  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      const status = error?.status || error?.code || (error?.response?.status);
      const isRetryable = retryOnStatusCodes.includes(status);

      if (attempt >= maxAttempts || !isRetryable) {
        console.error(`[Retry] Failed after ${attempt} attempts. Final error:`, error);
        throw error;
      }

      console.warn(`[Retry] Attempt ${attempt} failed with status ${status}. Retrying in ${delay}ms...`);
      
      await new Promise((resolve) => setTimeout(resolve, delay));

      attempt++;
      delay = Math.min(delay * factor, maxDelay);
    }
  }
}
