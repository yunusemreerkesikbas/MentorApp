import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = resolve(__dirname, "../drizzle");

function databaseUrl(base: string, database: string): string {
  const url = new URL(base);
  url.pathname = `/${database}`;
  return url.toString();
}

function migrationFilesThrough(lastIndex: number): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .filter((name) => Number(name.slice(0, 4)) <= lastIndex)
    .sort();
}

async function applyFiles(pool: Pool, files: string[]): Promise<void> {
  for (const file of files) {
    await pool.query(readFileSync(resolve(MIGRATIONS_DIR, file), "utf8"));
  }
}

describe("notebook collection migration rehearsal", () => {
  it(
    "moves legacy pages and cover metadata without weakening ownership",
    async () => {
      const baseUrl =
        process.env.TEST_DATABASE_URL ??
        "postgres://mentor:mentor@localhost:5433/mentor_test";
      const database = `mentor_nb_migration_${Date.now()}`;
      const probeRole = `mentor_nb_rls_${Date.now()}`;
      const admin = new Pool({ connectionString: databaseUrl(baseUrl, "postgres") });
      let target: Pool | undefined;
      let probeRoleCreated = false;

      try {
        await admin.query(`CREATE DATABASE "${database}"`);
        await admin.query(
          `CREATE ROLE "${probeRole}" NOLOGIN NOSUPERUSER NOBYPASSRLS`,
        );
        probeRoleCreated = true;
        await admin.query(`GRANT "${probeRole}" TO CURRENT_USER`);
        target = new Pool({ connectionString: databaseUrl(baseUrl, database) });
        await applyFiles(target, migrationFilesThrough(83));

        const users = await target.query<{ id: string }>(
          `INSERT INTO users (email, password_hash, display_name, kvkk_accepted_at)
           VALUES
             ('notebook-migration-a@test.local', 'x', 'Notebook A', now()),
             ('notebook-migration-b@test.local', 'x', 'Notebook B', now())
           RETURNING id`,
        );
        const [userA, userB] = users.rows.map((row) => row.id);
        const legacyPage = {
          version: 1,
          paper: "ruled",
          items: [],
          cover: { title: "Geometri", color: "plum", material: "leather" },
        };
        await target.query(
          `INSERT INTO mistake_notebook_pages (user_id, page_index, doc)
           VALUES ($1, 0, $2::jsonb), ($1, 1, $3::jsonb), ($4, 0, $3::jsonb)`,
          [
            userA,
            JSON.stringify(legacyPage),
            JSON.stringify({ version: 1, paper: "grid", items: [] }),
            userB,
          ],
        );

        await applyFiles(target, ["0084_unknown_old_lace.sql"]);

        const notebooks = await target.query<{
          id: string;
          user_id: string;
          title: string | null;
          cover_color: string;
          cover_material: string;
        }>(
          `SELECT id, user_id, title, cover_color, cover_material
           FROM notebooks ORDER BY user_id`,
        );
        expect(notebooks.rows).toHaveLength(2);
        const notebookA = notebooks.rows.find((row) => row.user_id === userA)!;
        const notebookB = notebooks.rows.find((row) => row.user_id === userB)!;
        expect(notebookA).toMatchObject({
          title: "Geometri",
          cover_color: "plum",
          cover_material: "leather",
        });

        const pages = await target.query<{
          user_id: string;
          notebook_id: string;
          page_index: number;
          has_cover: boolean;
        }>(
          `SELECT user_id, notebook_id, page_index, doc ? 'cover' AS has_cover
           FROM notebook_pages ORDER BY user_id, page_index`,
        );
        expect(pages.rows).toHaveLength(3);
        expect(pages.rows.every((row) => row.has_cover === false)).toBe(true);
        expect(
          pages.rows.filter((row) => row.user_id === userA).every((row) => row.notebook_id === notebookA.id),
        ).toBe(true);
        expect(pages.rows.find((row) => row.user_id === userB)?.notebook_id).toBe(notebookB.id);

        const custom = await target.query<{ id: string }>(
          `INSERT INTO notebooks (user_id, kind, title)
           VALUES ($1, 'CUSTOM', 'Custom') RETURNING id`,
          [userA],
        );
        const customId = custom.rows[0]!.id;
        await target.query(
          `INSERT INTO notebook_pages (user_id, notebook_id, page_index, doc)
           VALUES ($1, $2, 0, $3::jsonb)`,
          [userA, customId, JSON.stringify({ version: 1, paper: "plain", items: [] })],
        );
        await expect(
          target.query(
            `INSERT INTO notebook_pages (user_id, notebook_id, page_index, doc)
             VALUES ($1, $2, 1, $3::jsonb)`,
            [userB, customId, JSON.stringify({ version: 1, paper: "plain", items: [] })],
          ),
        ).rejects.toMatchObject({ code: "23503" });

        await target.query("DELETE FROM notebooks WHERE id = $1", [customId]);
        const cascaded = await target.query<{ count: number }>(
          "SELECT count(*)::int AS count FROM notebook_pages WHERE notebook_id = $1",
          [customId],
        );
        expect(cascaded.rows[0]?.count).toBe(0);

        await applyFiles(target, ["0085_unknown_newton_destine.sql"]);
        const chain = await target.query<{ table_name: string | null }>(
          "SELECT to_regclass('public.study_rooms')::text AS table_name",
        );
        expect(chain.rows[0]?.table_name).toBe("study_rooms");

        const rlsFlags = await target.query<{
          relname: string;
          relrowsecurity: boolean;
          relforcerowsecurity: boolean;
        }>(
          `SELECT relname, relrowsecurity, relforcerowsecurity
           FROM pg_class
           WHERE relname = ANY($1::text[])
           ORDER BY relname`,
          [["study_room_members", "study_rooms"]],
        );
        expect(rlsFlags.rows).toEqual([
          {
            relname: "study_room_members",
            relrowsecurity: true,
            relforcerowsecurity: true,
          },
          {
            relname: "study_rooms",
            relrowsecurity: true,
            relforcerowsecurity: true,
          },
        ]);
        const roleFlags = await target.query<{
          rolcanlogin: boolean;
          rolsuper: boolean;
          rolbypassrls: boolean;
        }>(
          `SELECT rolcanlogin, rolsuper, rolbypassrls
           FROM pg_roles WHERE rolname = $1`,
          [probeRole],
        );
        expect(roleFlags.rows[0]).toEqual({
          rolcanlogin: false,
          rolsuper: false,
          rolbypassrls: false,
        });

        const room = await target.query<{ id: string }>(
          `INSERT INTO study_rooms
             (owner_user_id, name, theme, capacity, invite_code)
           VALUES ($1, 'RLS Probe', 'LIBRARY', 4, 'MASA-RLSP01')
           RETURNING id`,
          [userA],
        );
        await target.query(
          `INSERT INTO study_room_members (room_id, user_id, role)
           VALUES ($1, $2, 'OWNER')`,
          [room.rows[0]!.id, userA],
        );
        await target.query(`GRANT USAGE ON SCHEMA public TO "${probeRole}"`);
        await target.query(
          `GRANT SELECT, INSERT, UPDATE, DELETE
           ON study_rooms, study_room_members TO "${probeRole}"`,
        );

        const probe = await target.connect();
        try {
          await probe.query("BEGIN");
          await probe.query(`SET LOCAL ROLE "${probeRole}"`);
          const identity = await probe.query<{
            current_user: string;
            session_user: string;
          }>("SELECT current_user, session_user");
          expect(identity.rows[0]).toMatchObject({ current_user: probeRole });
          expect(identity.rows[0]?.session_user).not.toBe(probeRole);
          await probe.query("SELECT set_config('app.user_id', $1, true)", [userA]);
          const hidden = await probe.query<{ rooms: number; members: number }>(
            `SELECT
               (SELECT count(*)::int FROM study_rooms) AS rooms,
               (SELECT count(*)::int FROM study_room_members) AS members`,
          );
          expect(hidden.rows[0]).toEqual({ rooms: 0, members: 0 });
          await probe.query("SAVEPOINT denied_room");
          await expect(
            probe.query(
              `INSERT INTO study_rooms
                 (owner_user_id, name, theme, capacity, invite_code)
               VALUES ($1, 'Denied', 'HOME', 4, 'MASA-RLSP02')`,
              [userA],
            ),
          ).rejects.toMatchObject({ code: "42501" });
          await probe.query("ROLLBACK TO SAVEPOINT denied_room");

          await probe.query("SAVEPOINT denied_member");
          await expect(
            probe.query(
              `INSERT INTO study_room_members (room_id, user_id, role)
               VALUES ($1, $2, 'MEMBER')`,
              [room.rows[0]!.id, userB],
            ),
          ).rejects.toMatchObject({ code: "42501" });
          await probe.query("ROLLBACK TO SAVEPOINT denied_member");
          await probe.query("ROLLBACK");

          await probe.query("BEGIN");
          await probe.query(`SET LOCAL ROLE "${probeRole}"`);
          await probe.query("SELECT set_config('app.role', 'SERVICE', true)");
          const visible = await probe.query<{ rooms: number; members: number }>(
            `SELECT
               (SELECT count(*)::int FROM study_rooms) AS rooms,
               (SELECT count(*)::int FROM study_room_members) AS members`,
          );
          expect(visible.rows[0]).toEqual({ rooms: 1, members: 1 });
          const inserted = await probe.query<{ id: string }>(
            `INSERT INTO study_rooms
               (owner_user_id, name, theme, capacity, invite_code)
             VALUES ($1, 'Allowed', 'HOME', 4, 'MASA-RLSP03')
             RETURNING id`,
            [userA],
          );
          expect(inserted.rows).toHaveLength(1);
          const insertedMember = await probe.query<{ id: string }>(
            `INSERT INTO study_room_members (room_id, user_id, role)
             VALUES ($1, $2, 'MEMBER') RETURNING id`,
            [inserted.rows[0]!.id, userB],
          );
          expect(insertedMember.rows).toHaveLength(1);
        } finally {
          await probe.query("ROLLBACK").catch(() => undefined);
          probe.release();
        }
      } finally {
        await target?.end();
        await admin.query(
          `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
          [database],
        );
        await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
        if (probeRoleCreated) {
          await admin.query(`DROP ROLE IF EXISTS "${probeRole}"`);
        }
        await admin.end();
      }
    },
    120_000,
  );
});
