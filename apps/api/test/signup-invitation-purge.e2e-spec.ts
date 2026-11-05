import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "../src/database/drizzle";
import { SignupInvitationRepository } from "../src/modules/identity/infrastructure/signup-invitation.repository";

const RUN = Date.now();
const email = (label: string) => `purge-${label}-${RUN}@test.local`;

/**
 * KVKK retention (aydınlatma metni): a waiting row lives 6 months from `created_at`, an invited row
 * 6 months from `invited_at`. A re-invite restarts the clock, so an old row invited recently stays.
 */
describe("signup_invitations purge (Postgres)", () => {
  let pool: Pool;
  let repo: SignupInvitationRepository;

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
    pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test", max: 3 });
    repo = new SignupInvitationRepository(createDatabase(pool));
  });

  afterAll(async () => {
    await svc((c) => c.query("delete from signup_invitations where email like $1", [`%-${RUN}@test.local`]));
    await pool.end();
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
});
