import type { MentorshipRiskFlagId } from "@mentor/types";

/**
 * "Has the coach already dealt with this student's current signals?"
 *
 * The triage in `risk-flags.ts` answers *who is struggling*; this answers *who is still waiting for
 * me*. Without it the roster is a list — the same red row every morning, whether or not the coach
 * reached out yesterday — and the daily digest names a student the coach has already called.
 *
 * A mark is not "this is resolved". It is "I saw this and acted", which is the only thing the app
 * can know. Recovery is still measured by the rules, never by the coach's click.
 *
 * TWO ways a handled student comes back, and both are needed:
 *
 *   - **A flag the mark never covered.** A NET_DROP landing the day after the coach handled an
 *     INACTIVE is new news, and waiting out a TTL to say so would be a week late.
 *   - **The mark growing stale.** Chronic INACTIVE never changes shape, so set-comparison alone
 *     would silence the most common flag forever — one click, one student lost.
 *
 * Neither mechanism is invented here. This is `mentorship-risk-digest.service.ts` said again for a
 * single student: its `hasNewNews` is the set comparison, its `repeat_after_days` is the TTL. The
 * panel and the morning email have to agree about what "handled" means, so they run the same rule.
 */
export function needsAttention(
  flags: readonly MentorshipRiskFlagId[],
  attendedAt: Date | null,
  attendedFlags: readonly MentorshipRiskFlagId[],
  ttlDays: number,
  now: Date,
): boolean {
  // Nothing to attend to. A calm student is not "waiting", marked or not.
  if (flags.length === 0) return false;
  if (attendedAt === null) return true;
  if (now.getTime() - attendedAt.getTime() >= ttlDays * 86_400_000) return true;
  return flags.some((flag) => !attendedFlags.includes(flag));
}
