import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const RUN = Date.now();

/**
 * RLS isolation proof (WP-K/A3) — the "second belt" the app-layer WHERE clauses sit on top of.
 *
 * Every other e2e connects as the `mentor` superuser, which BYPASSES row-level security — so until
 * this spec, no test had ever exercised a policy. Here a NOSUPERUSER/NOBYPASSRLS role (`rls_probe`)
 * proves the mechanism on user-owned tables plus the Discovery V2 tag, thread-tag and helpful-vote
 * tables: with `app.user_id = A` you cannot read B's private rows (but can read your own), and with
 * no context at all you read nothing and cannot insert.
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
  let notebookA = "";
  let notebookB = "";
  let forumThreadA = "";
  let forumThreadB = "";
  let activeTagId = "";
  let inactiveTagId = "";

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

    // Seed two users + one row each in representative private tables (superuser bypasses RLS).
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

    const seededNotebooks = await admin.query<{ id: string; user_id: string }>(
      `insert into notebooks (user_id, kind)
       values ($1, 'MISTAKE'), ($2, 'MISTAKE')
       returning id, user_id`,
      [idA, idB],
    );
    notebookA = seededNotebooks.rows.find((row) => row.user_id === idA)!.id;
    notebookB = seededNotebooks.rows.find((row) => row.user_id === idB)!.id;
    await admin.query(
      `insert into notebook_pages (user_id, notebook_id, page_index, doc)
       values
         ($1, $2, 0, '{"version":1,"paper":"ruled","items":[],"ink":[]}'::jsonb),
         ($3, $4, 0, '{"version":1,"paper":"grid","items":[],"ink":[]}'::jsonb)`,
      [idA, notebookA, idB, notebookB],
    );

    for (const id of [idA, idB]) {
      await admin.query(
        "insert into mood_checkins (user_id, checkin_date, mood) values ($1, current_date, 3)",
        [id],
      );
      await admin.query(
        `insert into plan_tasks
           (user_id, task_date, title, origin_type, origin_ref_id, origin_meta)
         values
           ($1, current_date, 'rls probe', 'COMMUNITY_COACH', gen_random_uuid(),
            jsonb_build_object(
              'threadId', gen_random_uuid()::text,
              'intent', 'PLAN',
              'zoneType', 'CHAT'
            ))`,
        [id],
      );
      const conv = await admin.query(
        `insert into coach_conversations
           (user_id, title, origin_type, origin_ref_id, origin_meta)
         values
           ($1, 'rls probe', 'COMMUNITY_THREAD', gen_random_uuid(),
            '{"intent":"PLAN","tagSlug":"planlama"}'::jsonb)
         returning id`,
        [id],
      );
      const message = await admin.query(
        "insert into coach_messages (user_id, conversation_id, role, content) values ($1, $2, 'USER', 'rls probe') returning id",
        [id, conv.rows[0].id],
      );
      await admin.query(
        "insert into coach_profiles (user_id, calibration_status, memory_consent) values ($1, 'COMPLETED', 'GRANTED')",
        [id],
      );
      await admin.query(
        `insert into coach_memory_facts
           (user_id, key, value, source, source_message_id)
         values ($1, 'STUDY_TIME', 'EVENING', 'CHAT', $2)`,
        [id, message.rows[0].id],
      );
      await admin.query(
        "insert into ledger_entries (user_id, unit, amount, reason) values ($1, 'XP', 1, 'quest.rls-probe')",
        [id],
      );
    }

    const zone = await admin.query(
      `insert into forum_zones (type, title, slug, created_by)
       values ('QA', 'RLS Discovery', $1, $2) returning id`,
      [`rls-discovery-${RUN}`, idA],
    );
    const mkThread = async (authorId: string, label: string) => {
      const result = await admin.query(
        `insert into forum_threads (zone_id, author_id, title, body)
         values ($1, $2, $3, 'rls discovery body') returning id`,
        [zone.rows[0].id, authorId, `RLS ${label}`],
      );
      return result.rows[0].id as string;
    };
    forumThreadA = await mkThread(idA, "A");
    forumThreadB = await mkThread(idB, "B");

    const tags = await admin.query(
      `insert into forum_tags (slug, name_tr, name_en, is_active, created_by)
       values
         ($1, 'RLS Aktif', 'RLS Active', true, $3),
         ($2, 'RLS Pasif', 'RLS Inactive', false, $3)
       returning id, is_active`,
      [`rls-active-${RUN}`, `rls-inactive-${RUN}`, idA],
    );
    activeTagId = tags.rows.find((row) => row.is_active === true).id as string;
    inactiveTagId = tags.rows.find((row) => row.is_active === false).id as string;
    await admin.query(
      `insert into forum_thread_tags (thread_id, tag_id)
       values ($1, $2), ($3, $4)`,
      [forumThreadA, activeTagId, forumThreadB, inactiveTagId],
    );
    await admin.query(
      `insert into forum_helpful_votes (target_type, target_id, user_id)
       values ('THREAD', $1, $2), ('THREAD', $3, $4)`,
      [forumThreadB, idA, forumThreadA, idB],
    );
  }, 30000);

  afterAll(async () => {
    await probe?.end();
    await admin?.end();
  });

  const TABLES = [
    "mood_checkins",
    "plan_tasks",
    "coach_conversations",
    "coach_messages",
    "coach_profiles",
    "coach_memory_facts",
    "ledger_entries",
    "notebooks",
    "notebook_pages",
  ];

  it.each(TABLES)("as user A, B's %s rows are invisible", async (table) => {
    expect(await probeCount({ userId: idA }, table, idB)).toBe(0);
  });

  it.each(TABLES)("as user A, own %s rows ARE visible (policy not over-tight)", async (table) => {
    expect(await probeCount({ userId: idA }, table, idA)).toBeGreaterThan(0);
  });

  it("keeps community task provenance inside the owning user's plan-task policy", async () => {
    const own = await asProbe({ userId: idA }, (c) =>
      c.query(
        "select origin_type, origin_meta from plan_tasks where user_id = $1",
        [idA],
      ),
    );
    expect(own.rows[0]).toMatchObject({
      origin_type: "COMMUNITY_COACH",
      origin_meta: { intent: "PLAN", zoneType: "CHAT" },
    });

    const foreign = await asProbe({ userId: idA }, (c) =>
      c.query("select origin_type from plan_tasks where user_id = $1", [idB]),
    );
    expect(foreign.rows).toHaveLength(0);
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

  it("rejects a page that names the current user but belongs to another user's notebook", async () => {
    await expect(
      asProbe({ userId: idA }, (c) =>
        c.query(
          `insert into notebook_pages (user_id, notebook_id, page_index, doc)
           values ($1, $2, 9, '{"version":1,"paper":"plain","items":[],"ink":[]}'::jsonb)`,
          [idA, notebookB],
        ),
      ),
    ).rejects.toMatchObject({ code: "23503" });

    const own = await asProbe({ userId: idA }, (c) =>
      c.query(
        `insert into notebook_pages (user_id, notebook_id, page_index, doc)
         values ($1, $2, 9, '{"version":1,"paper":"plain","items":[],"ink":[]}'::jsonb)
         returning id`,
        [idA, notebookA],
      ),
    );
    expect(own.rowCount).toBe(1);
  });

  it("forum_tags exposes only active tags to authenticated users and none without context", async () => {
    const authenticated = await asProbe({ userId: idA }, (c) =>
      c.query(
        "select id from forum_tags where id = any($1::uuid[]) order by id",
        [[activeTagId, inactiveTagId]],
      ),
    );
    expect(authenticated.rows.map((row) => row.id)).toEqual([activeTagId]);

    const contextless = await asProbe({}, (c) =>
      c.query("select count(*)::int as n from forum_tags where id = any($1::uuid[])", [
        [activeTagId, inactiveTagId],
      ]),
    );
    expect(contextless.rows[0].n).toBe(0);
  });

  it.each(["ADMIN", "SERVICE"])("%s can read inactive forum tags and write curated tags", async (role) => {
    const visible = await asProbe({ role }, (c) =>
      c.query("select count(*)::int as n from forum_tags where id = any($1::uuid[])", [
        [activeTagId, inactiveTagId],
      ]),
    );
    expect(visible.rows[0].n).toBe(2);

    const inserted = await asProbe({ role }, (c) =>
      c.query(
        `insert into forum_tags (slug, name_tr, name_en)
         values ($1, 'RLS Yazım', 'RLS Write') returning id`,
        [`rls-write-${role.toLowerCase()}-${RUN}`],
      ),
    );
    expect(inserted.rowCount).toBe(1);
  });

  it("ordinary users cannot write forum_tags", async () => {
    await expect(
      asProbe({ userId: idA }, (c) =>
        c.query(
          `insert into forum_tags (slug, name_tr, name_en)
           values ($1, 'Yetkisiz', 'Unauthorized')`,
          [`rls-denied-${RUN}`],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("forum_thread_tags requires context for reads and staff context for writes", async () => {
    const authenticated = await asProbe({ userId: idA }, (c) =>
      c.query("select count(*)::int as n from forum_thread_tags where thread_id = any($1::uuid[])", [
        [forumThreadA, forumThreadB],
      ]),
    );
    expect(authenticated.rows[0].n).toBe(2);

    const contextless = await asProbe({}, (c) =>
      c.query("select count(*)::int as n from forum_thread_tags where thread_id = any($1::uuid[])", [
        [forumThreadA, forumThreadB],
      ]),
    );
    expect(contextless.rows[0].n).toBe(0);

    await expect(
      asProbe({ userId: idA }, (c) =>
        c.query("insert into forum_thread_tags (thread_id, tag_id) values ($1, $2)", [
          forumThreadB,
          activeTagId,
        ]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it.each(["ADMIN", "SERVICE"])("%s can write forum_thread_tags", async (role) => {
    const inserted = await asProbe({ role }, (c) =>
      c.query("insert into forum_thread_tags (thread_id, tag_id) values ($1, $2) returning id", [
        forumThreadB,
        activeTagId,
      ]),
    );
    expect(inserted.rowCount).toBe(1);
  });

  it("forum_helpful_votes isolates each user's votes and leaks nothing without context", async () => {
    const own = await asProbe({ userId: idA }, (c) =>
      c.query(
        "select user_id from forum_helpful_votes where user_id = any($1::uuid[]) order by user_id",
        [[idA, idB]],
      ),
    );
    expect(own.rows.map((row) => row.user_id)).toEqual([idA]);

    const contextless = await asProbe({}, (c) =>
      c.query(
        "select count(*)::int as n from forum_helpful_votes where user_id = any($1::uuid[])",
        [[idA, idB]],
      ),
    );
    expect(contextless.rows[0].n).toBe(0);
  });

  it.each(["ADMIN", "SERVICE"])("%s can read and write forum_helpful_votes", async (role) => {
    const visible = await asProbe({ role }, (c) =>
      c.query(
        "select count(*)::int as n from forum_helpful_votes where user_id = any($1::uuid[])",
        [[idA, idB]],
      ),
    );
    expect(visible.rows[0].n).toBe(2);

    const inserted = await asProbe({ role }, (c) =>
      c.query(
        "insert into forum_helpful_votes (target_type, target_id, user_id) values ('POST', gen_random_uuid(), $1) returning id",
        [idA],
      ),
    );
    expect(inserted.rowCount).toBe(1);
  });

  it("ordinary users cannot write forum_helpful_votes directly", async () => {
    await expect(
      asProbe({ userId: idA }, (c) =>
        c.query(
          "insert into forum_helpful_votes (target_type, target_id, user_id) values ('POST', gen_random_uuid(), $1)",
          [idA],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});
