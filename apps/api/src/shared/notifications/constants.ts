/** Job row status values (jobs.status). */
export const JobStatus = {
  PENDING: "PENDING",
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  DEAD: "DEAD",
} as const;
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

/** Queue job names (code-style §4: module.action). */
export const JobName = {
  SEND_EMAIL: "notifications.send-email",
  SEND_PUSH: "notifications.send-push",
  DISPATCH_DAILY_REMINDERS: "notifications.dispatch-daily-reminders",
  SESSION_RETURN_REMINDER: "notifications.session-return-reminder",
  DISPATCH_ANNOUNCEMENT: "notifications.dispatch-announcement",
} as const;
export type JobName = (typeof JobName)[keyof typeof JobName];

/** Transactional email template ids (Postmark alias or internal key). */
export const EmailTemplate = {
  VERIFY_EMAIL: "identity.verify-email",
  RESET_PASSWORD: "identity.reset-password",
  PAYMENT_DUNNING: "payments.dunning",
  SUBSCRIPTION_WELCOME: "payments.subscription-welcome",
  DAILY_REMINDER: "coaching.daily-reminder",
} as const;
export type EmailTemplate = (typeof EmailTemplate)[keyof typeof EmailTemplate];

/** Maps `EmailTemplate` ids to `notifications.email.*` i18n keys. */
export const EMAIL_COPY_KEY: Record<string, string> = {
  "identity.verify-email": "identityVerifyEmail",
  "identity.reset-password": "identityResetPassword",
  "payments.dunning": "paymentsDunning",
  "payments.subscription-welcome": "paymentsWelcome",
  "coaching.daily-reminder": "dailyReminder",
};

/** Delivery / schedule template ids (notification_deliveries.template — not only email). */
export const DeliveryTemplate = {
  SESSION_RETURN: "coaching.session-return",
  NOTEBOOK_REVIEW: "coaching.notebook-review",
} as const;
export type DeliveryTemplate = (typeof DeliveryTemplate)[keyof typeof DeliveryTemplate];
