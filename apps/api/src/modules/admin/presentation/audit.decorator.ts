import { SetMetadata } from "@nestjs/common";
import type { AuditAction } from "../domain/admin.constants";

export const AUDIT_ACTION_KEY = "admin_audit_action";

/**
 * Marks an admin handler as audited (§9). The AdminAuditInterceptor writes one
 * `admin_audit_log` row on success with this action + actor/ip/timestamp. Handlers may
 * enrich the row (target, before/after) via `setAuditContext(req, …)`.
 */
export const Audit = (action: AuditAction) => SetMetadata(AUDIT_ACTION_KEY, action);
