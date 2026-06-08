/**
 * Email port (§8) — Postmark adapter behind it (transactional).
 * Usage: verification, password reset, invoice notice, dunning, trial reminder.
 */
export const EMAIL_PORT = Symbol("EMAIL_PORT");

export interface EmailPort {
  sendTransactional(input: {
    to: string;
    template: string;
    variables?: Record<string, unknown>;
  }): Promise<void>;
}
