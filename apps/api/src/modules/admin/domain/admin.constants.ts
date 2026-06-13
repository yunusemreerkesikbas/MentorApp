/**
 * Admin domain constants (W6).
 *
 * Audit actions are stable, append-only keys persisted in `admin_audit_log.action`.
 * Never rename an existing value (audit history references it) — add new ones instead.
 */
export const AuditAction = {
  STAFF_ASSIGN: "staff.assign",
  STAFF_REVOKE: "staff.revoke",
  USER_STATUS: "user.status",
  USER_KVKK_EXPORT: "user.kvkk-export",
  USER_KVKK_ANONYMIZE: "user.kvkk-anonymize",
  CONFIG_UPDATE: "config.update",
  ECONOMY_ADJUST: "economy.adjust",
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

/** Target entity kinds recorded in `admin_audit_log.target_type`. */
export const AuditTargetType = {
  USER: "user",
  CONFIG: "config",
} as const;
export type AuditTargetType = (typeof AuditTargetType)[keyof typeof AuditTargetType];
