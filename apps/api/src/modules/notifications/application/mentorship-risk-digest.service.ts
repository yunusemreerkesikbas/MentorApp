import { Inject, Injectable } from "@nestjs/common";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { JOB_QUEUE_PORT, type JobQueuePort } from "../../../shared/ports/job-queue.port";
import { todayIso } from "../../coaching/domain/date.util";
import {
  MENTORSHIP_QUERY_PORT,
  type CoachRiskDigestCandidate,
  type MentorshipQueryPort,
} from "../../mentorship/domain/mentorship-query.port";
import { EmailTemplate, JobName } from "../domain/notifications.constants";
import { NotificationCopyKey } from "../domain/notification-copy";
import { NotificationPreferencesRepository } from "../infrastructure/notification-preferences.repository";
import { UserNotificationRepository } from "../infrastructure/user-notification.repository";
import { NotificationsService } from "./notifications.service";

/** Where the digest lands: the roster, already sorted worst-first. */
export const MENTORSHIP_RISK_DIGEST_LINK = "/students";

/**
 * The morning nudge that turns rule-based triage from a screen you must remember to open into
 * something that reaches the coach (roadmap §9: "veri-tetikli müdahale uyarısı").
 *
 * **Only new news is sent.** The unit is a `studentId:FLAG` pair, and a digest goes out only when
 * today's set contains a pair the last digest did not. Otherwise a student who has been quiet for
 * ten days would ping the coach every single morning, and the third such morning is the one where
 * the coach stops reading. Recovery is deliberately silent: no news is good news, and the roster
 * already shows it.
 *
 * The baseline is the previous digest's own `data.pairs` — no state table. A notification is
 * already an append-only record of what we told someone, so a second store of the same fact would
 * only be a second thing to keep correct (and a third thing for KVKK erasure to chase).
 *
 * Dedupe is the in-app row's `dedupeKey` alone. `createFromTemplate` returns false when the row
 * already existed, and that false is what stops the email — so a cron that fires twice, or two
 * instances racing it, cannot produce two emails.
 */
@Injectable()
export class MentorshipRiskDigestService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(JOB_QUEUE_PORT) private readonly queue: JobQueuePort,
    @Inject(MENTORSHIP_QUERY_PORT) private readonly mentorship: MentorshipQueryPort,
    private readonly preferences: NotificationPreferencesRepository,
    private readonly userNotifs: UserNotificationRepository,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigRegistryService,
  ) {}

  async dispatchDaily(now: Date = new Date()): Promise<{ sent: number; skipped: number }> {
    if (!(await this.config.get("mentorship.risk_digest.enabled"))) {
      return { sent: 0, skipped: 0 };
    }
    const repeatAfterDays = await this.config.get("mentorship.risk_digest.repeat_after_days");
    const candidates = await this.mentorship.listRiskDigestCandidates(now);
    const dateIso = todayIso(now);
    let sent = 0;
    let skipped = 0;

    for (const candidate of candidates) {
      const pairs = toPairs(candidate);
      const baseline = await this.baselineFor(candidate.coachId, now, repeatAfterDays);
      if (!hasNewNews(pairs, baseline)) {
        skipped += 1;
        continue;
      }

      const args = this.copyArgs(candidate);
      // Every name resolved empty (erased or broken identity rows): a digest that says "0 students"
      // and names nobody is worse than silence.
      if (!args.names) {
        skipped += 1;
        continue;
      }
      // In-app is its own channel and always created; its dedupe key is also the email's gate.
      const created = await this.notifications.createFromTemplate(
        candidate.coachId,
        "MENTORSHIP",
        NotificationCopyKey.MENTORSHIP_RISK_DIGEST,
        MENTORSHIP_RISK_DIGEST_LINK,
        {
          args,
          dedupeKey: `mentorship-risk-digest:${dateIso}`,
          data: { pairs },
        },
      );
      if (!created) {
        skipped += 1;
        continue;
      }

      const prefs = await withServiceContext(this.db, async (tx) =>
        this.preferences.findByUserIdService(tx, candidate.coachId),
      );
      if (prefs?.emailEnabled ?? true) {
        await this.queue.enqueue(JobName.SEND_EMAIL, {
          to: candidate.email,
          template: EmailTemplate.MENTORSHIP_RISK_DIGEST,
          variables: { displayName: candidate.displayName, ...args },
        });
      }
      sent += 1;
    }

    return { sent, skipped };
  }

  /**
   * The pairs we last told this coach about, or none when that digest is older than
   * `repeat_after_days` — which is what makes a chronic situation resurface instead of going
   * silent forever.
   */
  private async baselineFor(
    coachId: string,
    now: Date,
    repeatAfterDays: number,
  ): Promise<Set<string>> {
    const previous = await withServiceContext(this.db, async (tx) =>
      this.userNotifs.findLatestByTemplateKey(
        tx,
        coachId,
        NotificationCopyKey.MENTORSHIP_RISK_DIGEST,
      ),
    );
    if (!previous) return new Set();
    const staleAt = now.getTime() - repeatAfterDays * 86_400_000;
    if (previous.createdAt.getTime() < staleAt) return new Set();
    const stored = previous.data?.pairs;
    return new Set(Array.isArray(stored) ? stored.filter((p): p is string => typeof p === "string") : []);
  }

  /**
   * Names, not flags. "INACTIVE" reads as a diagnosis when it lands in a coach's inbox, and the
   * roster's own chip says it better in context (§0 — never accusatory).
   *
   * Every name is listed, with no cap. A cap needs an "and N more" clause, and the copy has no
   * conditional form to hold one — the earlier `{rest}` arg was computed and never rendered, so a
   * digest about five students named two and silently dropped three while the title still said
   * five. The list stays short on its own: only NEW flags reach here, never the standing ones.
   */
  private copyArgs(candidate: CoachRiskDigestCandidate): Record<string, unknown> {
    const names = candidate.students.map((student) => student.displayName).filter(Boolean);
    return { count: names.length, names: names.join(", ") };
  }
}

function toPairs(candidate: CoachRiskDigestCandidate): string[] {
  return candidate.students
    .flatMap((student) => student.flags.map((flag) => `${student.studentId}:${flag}`))
    .sort();
}

/** A digest is worth sending only when it carries something the last one did not. */
function hasNewNews(pairs: string[], baseline: Set<string>): boolean {
  return pairs.some((pair) => !baseline.has(pair));
}
