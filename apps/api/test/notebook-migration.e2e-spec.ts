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
      const admin = new Pool({ connectionString: databaseUrl(baseUrl, "postgres") });
      let target: Pool | undefined;

      try {
        await admin.query(`CREATE DATABASE "${database}"`);
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
      } finally {
        await target?.end();
        await admin.query(
          `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
          [database],
        );
        await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
        await admin.end();
      }
    },
    120_000,
  );
});
