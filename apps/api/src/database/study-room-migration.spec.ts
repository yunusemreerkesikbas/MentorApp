import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(__dirname, "../../drizzle/0085_unknown_newton_destine.sql"),
  "utf8",
);

describe("study room migration", () => {
  it.each(["study_rooms", "study_room_members"])(
    "forces service-only RLS on %s",
    (table) => {
      expect(sql).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      expect(sql).toContain(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
      expect(sql).toContain(`CREATE POLICY "${table}_service_all" ON "${table}" FOR ALL`);
    },
  );

  it("requires SERVICE context for reads and writes", () => {
    expect(sql.match(/current_setting\('app\.role', true\) = 'SERVICE'/g)).toHaveLength(4);
  });
});
