import { ApiClientError } from "@mentor/api-client";

export function isAmbiguousAdRequestError(error: unknown): boolean {
  if (!(error instanceof ApiClientError)) return true;
  return error.status === 408 || error.status === 429 || error.status >= 500;
}

export async function retryIdempotent<T>(operation: () => Promise<T>, attempts = 2): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isAmbiguousAdRequestError(error)) throw error;
    }
  }

  throw lastError;
}
