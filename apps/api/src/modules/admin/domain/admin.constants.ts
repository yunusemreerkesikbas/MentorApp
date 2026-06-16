/**
 * Admin domain constants (W6).
 *
 * Audit actions are stable, append-only keys persisted in `admin_audit_log.action`.
 * Never rename an existing value (audit history references it) — add new ones instead.
 */
export const AuditAction = {
  STAFF_ASSIGN: "staff.assign",
  STAFF_REVOKE: "staff.revoke",
  ROLE_ASSIGN: "role.assign",
  ROLE_REVOKE: "role.revoke",
  USER_STATUS: "user.status",
  USER_KVKK_EXPORT: "user.kvkk-export",
  USER_KVKK_ANONYMIZE: "user.kvkk-anonymize",
  CONFIG_UPDATE: "config.update",
  ECONOMY_ADJUST: "economy.adjust",
  CONTENT_ARTICLE_UPSERT: "content.article.upsert",
  CONTENT_ARTICLE_PUBLISH: "content.article.publish",
  CONTENT_ARTICLE_UNPUBLISH: "content.article.unpublish",
  CONTENT_EXAM_UPSERT: "content.exam.upsert",
  CONTENT_EXAM_EVENT_UPSERT: "content.exam-event.upsert",
  CONTENT_EXAM_EVENT_DELETE: "content.exam-event.delete",
  SUBSCRIPTION_REFUND: "subscription.refund",
  SUBSCRIPTION_CANCEL: "subscription.cancel",
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

/** Target entity kinds recorded in `admin_audit_log.target_type`. */
export const AuditTargetType = {
  USER: "user",
  CONFIG: "config",
  ARTICLE: "article",
  EXAM: "exam",
  EXAM_EVENT: "exam-event",
  SUBSCRIPTION: "subscription",
} as const;
export type AuditTargetType = (typeof AuditTargetType)[keyof typeof AuditTargetType];
