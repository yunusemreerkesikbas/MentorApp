import type { Request } from "express";
import type { AuditTargetType } from "../domain/admin.constants";

/** Optional per-request enrichment an audited handler attaches for the interceptor. */
export interface AuditContext {
  targetType?: AuditTargetType;
  targetId?: string;
  before?: unknown;
  after?: unknown;
}

/** Request augmented with the optional audit context written by audited handlers. */
export interface AuditableRequest extends Request {
  auditContext?: AuditContext;
}

/** Attach audit details (target, before/after) for the AdminAuditInterceptor to persist. */
export function setAuditContext(req: AuditableRequest, ctx: AuditContext): void {
  req.auditContext = ctx;
}
