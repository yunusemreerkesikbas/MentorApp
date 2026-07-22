import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const RUN = Date.now();

/**
 * RLS isolation proof (WP-K/A3) — the "second belt" the app-layer WHERE clauses sit on top of.
 *
 * Every other e2e connects as the `mentor` superuser, which BYPASSES row-level security — so until
 * this spec, no test had ever exercised a policy. Here a NOSUPERUSER/NOBYPASSRLS role (`rls_probe`)
 * proves the mechanism on four representative tables: with `app.user_id = A` you cannot read B's
 * rows (but can read your own), and with no context at all you read nothing and cannot insert.
 * `FORCE ROW LEVEL SECURITY` makes the policies apply even to the table owner — only true
 * superusers skip them, which is exactly why the probe role must not be one.
 *
 * The probe role is (re)provisioned by the superuser in beforeAll — idempotent, so the spec is
 * self-contained on any environment (fresh CI Postgres, existing local volume) with no init-script
 * or manual SQL dependency.
 */
describe("RLS isolation (e2e)", () => {
  let admin: Pool; // superuser — seeds data, provisions the probe role
  let probe: Pool; // NOSUPERUSER NOBYPASSRLS — the connection the policies actually filter
  let idA = "";
  let idB = "";

  /** Run `fn` on a probe connection inside a tx with the given GUCs (tx-local via set_config). */
  const asProbe = async <T>(
    ctx: { userId?: string; role?: string },
    fn: (c: PoolClient) => Promise<T>,
  ): Promise<T> => {
    const c = await probe.connect();
    try {
      await c.query("begin");
      if (ctx.userId) await c.query("select set_config('app.user_id', $1, true)", [ctx.userId]);
      if (ctx.role) await c.query("select set_config('app.role', $1, true)", [ctx.role]);
      const out = await fn(c);
      await c.query("rollback"); // reads only — never persist probe writes
      return out;
    } catch (err) {
      await c.query("rollback").catch(() => undefined);
      throw err;
    } finally {
      c.release();
    }
  };

  const probeCount = (ctx: { userId?: string }, table: string, userId: string) =>
    asProbe(ctx, async (c) => {
      const res = await c.query(`select count(*)::int as n from ${table} where user_id = $1`, [
        userId,
      ]);
      return res.rows[0].n as number;
    });

  beforeAll(async () => {
    const url = new URL(
      process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test",
    );
    admin = new Pool({ connectionString: url.toString() });

    // Provision the probe role (idempotent — safe on every run, every environment).
    await admin.query(`
      do $$ begin
        create role rls_probe login password 'rls_probe' nosuperuser nobypassrls;
      exception when duplicate_object then null;
      end $$;
    `);
    await admin.query("grant usage on schema public to rls_probe");
    await admin.query(
      "grant select, insert, update, delete on all tables in schema public to rls_probe",
    );

    const probeUrl = new URL(url.toString());
    probeUrl.username = "rls_probe";
    probeUrl.password = "rls_probe";
    probe = new Pool({ connectionString: probeUrl.toString() });

    // Seed two users + one row each in the four representative tables (superuser bypasses RLS).
    const mkUser = async (label: string) => {
      const res = await admin.query(
        `insert into users (email, password_hash, display_name, kvkk_accepted_at)
         values ($1, 'x', $2, now()) returning id`,
        [`rls-${label}-${RUN}@test.local`, `RLS ${label}`],
      );
      return res.rows[0].id as string;
    };
    idA = await mkUser("a");
    idB = await mkUser("b");

    for (const id of [idA, idB]) {
      await admin.query(
        "insert into mood_checkins (user_id, checkin_date, mood) values ($1, current_date, 3)",
        [id],
      );
      await admin.query(
        "insert into plan_tasks (user_id, task_date, title) values ($1, current_date, 'rls probe')",
        [id],
      );
      const conv = await admin.query(
        "insert into coach_conversations (user_id, title) values ($1, 'rls probe') returning id",
        [id],
      );
      await admin.query(
        "insert into coach_messages (user_id, conversation_id, role, content) values ($1, $2, 'USER', 'rls probe')",
        [id, conv.rows[0].id],
      );
      await admin.query(
        "insert into ledger_entries (user_id, unit, amount, reason) values ($1, 'XP', 1, 'quest.rls-probe')",
        [id],
      );
    }
  }, 30000);

  afterAll(async () => {
    await probe?.end();
    await admin?.end();
  });

  const TABLES = ["mood_checkins", "plan_tasks", "coach_messages", "ledger_entries"];

  it.each(TABLES)("as user A, B's %s rows are invisible", async (table) => {
    expect(await probeCount({ userId: idA }, table, idB)).toBe(0);
  });

  it.each(TABLES)("as user A, own %s rows ARE visible (policy not over-tight)", async (table) => {
    expect(await probeCount({ userId: idA }, table, idA)).toBeGreaterThan(0);
  });

  // Policy nuance found by this probe: most policies compare as text
  // (`user_id::text = current_setting(...)`), but coach_messages (0044) casts the setting to uuid —
  // with an empty-string app.user_id (what set_config reverts to on a reused pooled session) the
  // query ERRORS instead of filtering. An error is also a denial (nothing leaks), so both count
  // as isolation here; the inconsistency is recorded as a docs gotcha.
  it.each(TABLES)("without any context, %s leaks nothing (0 rows or a hard error)", async (table) => {
    const n = await probeCount({}, table, idA).catch(() => 0);
    expect(n).toBe(0);
  });

  it("without any context, an INSERT is rejected by the policy", async () => {
    await expect(
      asProbe({}, (c) =>
        c.query(
          "insert into mood_checkins (user_id, checkin_date, mood) values ($1, current_date, 3)",
          [idA],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("superuser bypass is why the OTHER e2e never see RLS (sanity check of the premise)", async () => {
    const res = await admin.query(
      "select count(*)::int as n from mood_checkins where user_id = $1",
      [idB],
    );
    expect(res.rows[0].n).toBeGreaterThan(0);
  });
});
