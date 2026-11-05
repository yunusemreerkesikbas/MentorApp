import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "../src/database/drizzle";
import { CURRENT_TERMS_VERSION } from "../src/modules/identity/domain/identity.constants";
import { SignupInvitationRepository } from "../src/modules/identity/infrastructure/signup-invitation.repository";
import { UsersRepository } from "../src/modules/identity/infrastructure/users.repository";

const RUN = Date.now();
const email = (label: string) => `purge-${label}-${RUN}@test.local`;

const FORCED_RLS_TABLES = [
  "notebook_reviews",
  "plan_event_attendees",
  "plan_event_series",
  "plan_events",
  "mentorship_followups",
  "mentorship_weekly_reports",
  "economy_reward_receipts",
  "mentorship_student_briefs",
  "storage_budget_state",
  "storage_object_manifest",
  "storage_reservations",
  "ai_plan_previews",
  "ai_weekly_recaps",
  "signup_invitations",
  "ai_chat_quota_attempts",
  "ai_budget_reservations",
  "jobs",
  "email_verification_resend_attempts",
  "mentorship_coach_applications",
  "mentorship_cohort_briefs",
  "mentorship_dropped_assignments",
  "mentorship_invite_codes",
  "mentorship_program_templates",
  "coach_students",
  "buddy_pairs",
  "user_follows",
  "forum_attachments",
  "forum_bookmarks",
  "forum_pending_attachments",
];

/**
 * KVKK retention (aydınlatma metni): a waiting row lives 6 months from `created_at`, an invited row
 * 6 months from `invited_at`. A re-invite restarts the clock, so an old row invited recently stays.
 */
describe("signup_invitations purge & RLS hardening (Postgres)", () => {
  let pool: Pool;
  let repo: SignupInvitationRepository;
  let usersRepo: UsersRepository;

  const svc = async <T>(fn: (c: import("pg").PoolClient) => Promise<T>): Promise<T> => {
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query("select set_config('app.role','SERVICE',true)");
      const out = await fn(c);
      await c.query("commit");
      return out;
    } finally {
      c.release();
    }
  };

  const insert = (label: string, status: "waiting" | "invited", createdAgo: string, invitedAgo: string | null) =>
    svc((c) => c.query(
      `insert into signup_invitations (email, role, locale, status, created_at, invited_at)
       values ($1, 'student', 'tr', $2, now() - $3::interval, case when $4::text is null then null else now() - $4::interval end)`,
      [email(label), status, createdAgo, invitedAgo],
    ));

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test", max: 5 });
    const db = createDatabase(pool);
    repo = new SignupInvitationRepository(db);
    usersRepo = new UsersRepository(db);
  });

  afterAll(async () => {
    await svc(async (c) => {
      await c.query("delete from signup_invitations where email like $1", [`%-${RUN}@test.local`]);
      await c.query("delete from users where email like $1 or display_name = $2", [`%-${RUN}@test.local`, `PurgeTest-${RUN}`]);
    });
    await pool.end();
  });

  it("ignores unpurged expired (>6 months) invitations in findInvited and countInvited", async () => {
    const baseline = await repo.countInvited();
    await insert("expired-unpurged", "invited", "8 months", "7 months");
    await insert("active-unpurged", "invited", "2 months", "1 month");

    await expect(repo.findInvited(email("expired-unpurged"))).resolves.toBeNull();
    await expect(repo.findInvited(email("active-unpurged"))).resolves.toEqual({ role: "student" });
    await expect(repo.countInvited()).resolves.toBe(baseline + 1);

    await svc((c) => c.query("delete from signup_invitations where email = any($1)", [[email("expired-unpurged"), email("active-unpurged")]]));
  });

  it("deletes by created_at for waiting rows and by invited_at for invited rows", async () => {
    await insert("waiting-old", "waiting", "7 months", null);
    await insert("waiting-new", "waiting", "5 months", null);
    await insert("invited-old", "invited", "8 months", "7 months");
    await insert("invited-new", "invited", "2 months", "1 month");
    // Created long ago, re-invited recently: the clock is invited_at, so it survives.
    await insert("reinvited", "invited", "8 months", "1 month");

    await repo.purgeExpired();

    const left = await svc(async (c) => {
      const r = await c.query("select email from signup_invitations where email like $1 order by email", [`%-${RUN}@test.local`]);
      return r.rows.map((row: { email: string }) => row.email);
    });
    expect(left.sort()).toEqual([email("invited-new"), email("reinvited"), email("waiting-new")].sort());
  });

  it("serializes concurrent upsertInvited calls at the capacity limit", async () => {
    const currentCount = await repo.countInvited();
    const cap = currentCount + 1;
    const actor = await usersRepo.createService({
      email: email("actor"),
      displayName: `PurgeTest-${RUN}`,
      passwordHash: "unused",
      kvkkAcceptedAt: new Date(),
      termsAcceptedAt: new Date(),
      termsVersion: CURRENT_TERMS_VERSION,
      ageEligibilityConfirmedAt: new Date(),
    });

    const results = await Promise.allSettled([
      repo.upsertInvited({ email: email("race-1"), role: "student", locale: "tr", invitedBy: actor.id }, cap),
      repo.upsertInvited({ email: email("race-2"), role: "student", locale: "tr", invitedBy: actor.id }, cap),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toMatchObject({ code: "WAITLIST_INVITE_LIMIT", httpStatus: 409 });
  });

  it("atomically deletes signup_invitations on user creation and KVKK account anonymization", async () => {
    const targetEmail = email("kvkk-target");
    await insert("kvkk-target", "waiting", "1 day", null);

    const user = await usersRepo.createService({
      email: targetEmail,
      displayName: `PurgeTest-${RUN}`,
      passwordHash: "unused",
      kvkkAcceptedAt: new Date(),
      termsAcceptedAt: new Date(),
      termsVersion: CURRENT_TERMS_VERSION,
      ageEligibilityConfirmedAt: new Date(),
    });

    const afterCreate = await svc((c) => c.query("select 1 from signup_invitations where email = $1", [targetEmail]));
    expect(afterCreate.rows).toHaveLength(0);

    // If a row is re-inserted while the account exists and the account is later erased under KVKK,
    // anonymizeAccount must scrub the invitation row too.
    await insert("kvkk-target", "waiting", "1 day", null);
    await usersRepo.anonymizeAccount(user.id, "DELETED");

    const afterErasure = await svc((c) => c.query("select 1 from signup_invitations where email = $1", [targetEmail]));
    expect(afterErasure.rows).toHaveLength(0);
  });

  it("enforces both ENABLE and FORCE ROW LEVEL SECURITY across all hardened tables", async () => {
    const res = await pool.query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      "select relname, relrowsecurity, relforcerowsecurity from pg_class where relname = any($1::text[]) order by relname",
      [FORCED_RLS_TABLES],
    );
    expect(res.rows).toHaveLength(FORCED_RLS_TABLES.length);
    for (const row of res.rows) {
      expect(row).toEqual({
        relname: row.relname,
        relrowsecurity: true,
        relforcerowsecurity: true,
      });
    }
  });
});
