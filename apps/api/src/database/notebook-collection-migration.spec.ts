import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(__dirname, "../../drizzle/0084_unknown_old_lace.sql"),
  "utf8",
);

describe("notebook collection migration", () => {
  it("backfills one system notebook before making the page relationship mandatory", () => {
    const backfill = sql.indexOf('INSERT INTO "notebooks"');
    const attach = sql.indexOf('SET "notebook_id" = n."id"');
    const required = sql.indexOf(
      'ALTER TABLE "notebook_pages" ALTER COLUMN "notebook_id" SET NOT NULL',
    );

    expect(backfill).toBeGreaterThan(-1);
    expect(attach).toBeGreaterThan(backfill);
    expect(required).toBeGreaterThan(attach);
    expect(sql).toContain("notebooks_one_mistake_per_user_idx");
  });

  it("moves page-zero cover metadata to the notebook and strips the old JSON field", () => {
    expect(sql).toContain("'{cover,title}'");
    expect(sql).toContain("'{cover,color}'");
    expect(sql).toContain("'{cover,material}'");
    expect(sql).toContain('SET "doc" = "doc" - \'cover\'');
  });

  it("keeps user isolation on both collection and page tables", () => {
    expect(sql).toContain('ALTER TABLE "notebooks" FORCE ROW LEVEL SECURITY');
    expect(sql).toContain("CREATE POLICY notebooks_self_or_service");
    expect(sql).toContain("notebook_pages_notebook_page_idx");
  });

  it("enforces that a page and its notebook belong to the same user", () => {
    expect(sql).toContain("notebooks_id_user_unique_idx");
    expect(sql).toContain(
      'FOREIGN KEY ("notebook_id","user_id") REFERENCES "public"."notebooks"("id","user_id") ON DELETE cascade',
    );
    expect(sql).not.toContain(
      'FOREIGN KEY ("notebook_id") REFERENCES "public"."notebooks"("id")',
    );
  });
});
