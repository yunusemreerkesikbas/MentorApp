import { Injectable, Logger } from "@nestjs/common";
import { AdminAuditRepository, type NewAuditLog } from "../infrastructure/admin-audit.repository";

export interface AuditEntryView {
  id: string;
  actorUserId: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  createdAt: string;
}

/**
 * Writes and reads the admin audit trail (§9). `record` is best-effort-but-loud: the audited
 * mutation already committed by the time the interceptor calls it, so a failed audit write is
 * logged at error level rather than failing the request. The trail is append-only.
 */
@Injectable()
export class AdminAuditService {
  private readonly logger = new Logger(AdminAuditService.name);

  constructor(private readonly repo: AdminAuditRepository) {}

  async record(entry: NewAuditLog): Promise<void> {
    try {
      await this.repo.append(entry);
    } catch (err) {
      // Never break an admin action because the audit write failed — but make it visible.
      this.logger.error(
        { err, action: entry.action, actorUserId: entry.actorUserId, targetId: entry.targetId },
        "admin audit write failed",
      );
    }
  }

  async list(page: number, pageSize: number): Promise<AuditEntryView[]> {
    const { rows } = await this.repo.list(page, pageSize);
    return rows.map((r) => ({
      id: r.id,
      actorUserId: r.actorUserId,
      action: r.action,
      targetType: r.targetType,
      targetId: r.targetId,
      before: r.before,
      after: r.after,
      ip: r.ip,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
