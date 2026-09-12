/**
 * The invite code is a bearer secret: whoever reads it can attach themselves to this coach as a
 * student. It does not need to be visible to be copied, so the panel shows it masked and makes
 * revealing it a deliberate act — a screen share or a shoulder should not hand it away by default.
 *
 * The prefix survives masking. It is not the secret (every code carries it), and keeping it lets
 * the coach recognise WHAT is in the box without exposing WHICH code it is.
 */

/** Everything up to and including the last `-` is structure; what follows is the secret. */
const PREFIX_PATTERN = /^(.*-)(.+)$/;

export function maskInviteCode(code: string): string {
  const match = PREFIX_PATTERN.exec(code);
  // No separator: mask the lot rather than guessing where a prefix would have ended.
  if (match === null) return "•".repeat(code.length);
  const [, prefix, secret] = match;
  return `${prefix}${"•".repeat(secret.length)}`;
}
