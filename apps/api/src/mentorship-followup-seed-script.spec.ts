import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("mentorship follow-up development seed", () => {
  const source = readFileSync(
    resolve(__dirname, "../scripts/seed-mentorship-followups.ts"),
    "utf8",
  );

  it("is development-only and scopes records to the active relationship period", () => {
    expect(source).toContain('NODE_ENV ?? ""');
    expect(source).toContain("cs.status = 'ACTIVE'");
    expect(source).toContain("link.periodId");
  });

  it("covers actionable, private, closed and replacement states idempotently", () => {
    expect(source).toContain('key: "overdue-change"');
    expect(source).toContain('key: "private-only"');
    expect(source).toContain('key: "completed-original"');
    expect(source).toContain('replacesKey: "completed-original"');
    expect(source).toContain("on conflict (id) do update set");
  });
});
