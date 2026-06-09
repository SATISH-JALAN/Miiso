/**
 * Retry helper implementing exponential backoff.
 * Used for fetching EVM contract bytecode to resolve RPC state propagation lag.
 * 
 * Formula: T_delay = T_base * 2^k for k in [0, 1, 2, 3]
 * Defaults: T_base = 250ms, maxAttempts = 4
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    baseDelayMs?: number;
    maxAttempts?: number;
    shouldRetry?: (err: any) => boolean;
    onRetry?: (attempt: number, delayMs: number, err: any) => void;
  } = {}
): Promise<T> {
  const baseDelayMs = options.baseDelayMs ?? 250;
  const maxAttempts = options.maxAttempts ?? 4;
  const shouldRetry = options.shouldRetry ?? (() => true);

  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      
      if (attempt >= maxAttempts || !shouldRetry(error)) {
        throw error;
      }
      
      // Calculate delay: baseDelayMs * 2^(attempt - 1)
      const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
      
      if (options.onRetry) {
        options.onRetry(attempt, delayMs, error);
      }
      
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
