import { Inject, Injectable } from "@nestjs/common";
import { desc } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { adminAuditLog } from "../../../database/schema";

export type AuditLogRow = typeof adminAuditLog.$inferSelect;
export type NewAuditLog = typeof adminAuditLog.$inferInsert;

/**
 * Append-only admin audit trail (§9). Writes/reads run in SERVICE context — admin acts
 * cross-user, so the per-user RLS belt doesn't apply (policy allows SERVICE/ADMIN only).
 */
@Injectable()
export class AdminAuditRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Append one immutable audit row. Never updated, never deleted. */
  async append(entry: NewAuditLog): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx.insert(adminAuditLog).values(entry);
    });
  }

  /** Newest-first page of the audit trail. */
  async list(page: number, pageSize: number): Promise<{ rows: AuditLogRow[] }> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select()
        .from(adminAuditLog)
        .orderBy(desc(adminAuditLog.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize);
      return { rows };
    });
  }
}
