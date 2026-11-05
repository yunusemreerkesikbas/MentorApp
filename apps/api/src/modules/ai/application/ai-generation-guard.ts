import { HttpStatus } from "@nestjs/common";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { AiUsageFeature } from "../domain/ai.constants";
import type { AiUsageRepository } from "../infrastructure/ai-usage.repository";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Per-user rolling 24h generation ceilings for cached/on-demand AI surfaces.
 * Cache hits return before this check and remain free; this bounds cache-invalidation
 * and locale-thrashing loops (e.g. alternating Accept-Language: tr/en or mutating
 * mood/goal/session/exam state repeatedly to force fresh LLM calls).
 */
export const PREMIUM_FEATURE_DAILY_GENERATION_LIMITS = {
  [AiUsageFeature.MOOD]: 10,
  [AiUsageFeature.VISION_NOTE]: 10,
  [AiUsageFeature.GHOST]: 10,
  [AiUsageFeature.SESSION_REFLECTION]: 20,
  [AiUsageFeature.WEEKLY_REVIEW]: 10,
  [AiUsageFeature.DAILY_GREETING]: 4,
  [AiUsageFeature.MENTORSHIP_BRIEF]: 25,
  [AiUsageFeature.MENTORSHIP_COHORT_BRIEF]: 10,
  [AiUsageFeature.MENTORSHIP_SUGGESTIONS]: 25,
} as const;

const inFlightByUserFeature = new Map<string, Promise<unknown>>();

/**
 * Serializes concurrent AI operations for the same (userId, scope) so parallel requests
 * cannot race cache-miss checks or `ai_usage` quota counters before the first call settles.
 */
export async function withUserFeatureLock<T>(
  userId: string,
  scope: string,
  fn: () => Promise<T>,
): Promise<T> {
  const key = `${userId}:${scope}`;
  const prev = inFlightByUserFeature.get(key) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = prev.then(() => gate, () => gate);
  inFlightByUserFeature.set(key, tail);

  await prev.catch(() => undefined);
  try {
    return await fn();
  } finally {
    release();
    if (inFlightByUserFeature.get(key) === tail) {
      inFlightByUserFeature.delete(key);
    }
  }
}

export async function assertWithinFeatureDailyCap(
  usage: Partial<Pick<AiUsageRepository, "countFeatureSince">>,
  userId: string,
  feature: keyof typeof PREMIUM_FEATURE_DAILY_GENERATION_LIMITS,
  errorCode: ErrorCode = ErrorCode.AI_RATE_LIMITED,
  httpStatus: HttpStatus = HttpStatus.TOO_MANY_REQUESTS,
): Promise<void> {
  const limit = PREMIUM_FEATURE_DAILY_GENERATION_LIMITS[feature];
  const used =
    (await usage.countFeatureSince?.(
      userId,
      feature,
      new Date(Date.now() - DAY_MS),
    )) ?? 0;
  if (used >= limit) {
    throw new DomainError(errorCode, httpStatus);
  }
}
