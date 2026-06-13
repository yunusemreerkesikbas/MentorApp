import { Inject, Injectable } from "@nestjs/common";
import { DRIZZLE } from "../../database/database.constants";
import type { Database } from "../../database/drizzle";
import { withServiceContext } from "../../database/rls";
import { configOverrides } from "../../database/schema";

export type ConfigOverrideRow = typeof configOverrides.$inferSelect;

/**
 * Config override persistence. Reads/writes run in SERVICE context (config is platform-wide, not
 * user-scoped; the `config_overrides` RLS policy allows SERVICE/ADMIN only).
 */
@Injectable()
export class ConfigRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** All overrides as a key→value map (for the in-memory cache). */
  async getAll(): Promise<Map<string, unknown>> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select({ key: configOverrides.key, value: configOverrides.value })
        .from(configOverrides);
      return new Map(rows.map((r) => [r.key, r.value as unknown]));
    });
  }

  /** Upsert a single override (last-write-wins on the key PK). */
  async upsert(key: string, value: unknown, updatedBy: string): Promise<void> {
    // `value` is JSON-serializable (boolean/number/string/object) — it matches the jsonb column's
    // insert type. The previous `as object` cast was inaccurate for primitive flag values.
    const jsonValue = value as ConfigOverrideRow["value"];
    await withServiceContext(this.db, async (tx) => {
      await tx
        .insert(configOverrides)
        .values({ key, value: jsonValue, updatedBy, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: configOverrides.key,
          set: { value: jsonValue, updatedBy, updatedAt: new Date() },
        });
    });
  }
}
