import { Inject, Injectable } from "@nestjs/common";
import { and, eq, lt, sql } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { authRateLimits } from "../../../database/schema-auth-rate-limits";

@Injectable()
export class AuthRateLimitRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Atomic fixed window; rejected requests never move the expiry or send gap. */
  consume(key: string, limit: number, windowSeconds: number, gapSeconds = 0) {
    return withServiceContext(this.db, async (tx) => {
      const result = await tx.execute<{ key: string }>(sql`
        INSERT INTO auth_rate_limits (key, hits, expires_at, next_allowed_at)
        VALUES (${key}, 1, now() + ${windowSeconds} * interval '1 second',
          now() + ${gapSeconds} * interval '1 second')
        ON CONFLICT (key) DO UPDATE SET
          hits = CASE WHEN auth_rate_limits.expires_at <= now() THEN 1 ELSE auth_rate_limits.hits + 1 END,
          expires_at = CASE WHEN auth_rate_limits.expires_at <= now()
            THEN now() + ${windowSeconds} * interval '1 second' ELSE auth_rate_limits.expires_at END,
          next_allowed_at = now() + ${gapSeconds} * interval '1 second'
        WHERE (auth_rate_limits.expires_at <= now() OR auth_rate_limits.hits < ${limit})
          AND (${gapSeconds} = 0 OR auth_rate_limits.next_allowed_at <= now())
        RETURNING key`);
      if (result.rows.length) return { allowed: true, retryAfter: 0 };
      const [row] = await tx.select({
        retryAfter: sql<number>`greatest(1, ceil(extract(epoch from
          (greatest(${authRateLimits.expiresAt}, ${authRateLimits.nextAllowedAt}) - now()))))::int`,
      }).from(authRateLimits).where(eq(authRateLimits.key, key));
      return { allowed: false, retryAfter: row!.retryAfter };
    });
  }

  async purgeExpired(): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx.delete(authRateLimits).where(and(lt(authRateLimits.expiresAt, sql`now()`), lt(authRateLimits.nextAllowedAt, sql`now()`)));
    });
  }
}
