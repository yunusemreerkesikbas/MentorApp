import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("forum development seed", () => {
  const source = readFileSync(resolve(__dirname, "../scripts/seed-forum.ts"), "utf8");

  it("seeds coach-intent tags and connects eligible threads to them", () => {
    expect(source).toContain('slug: "planlama", coachIntent: "PLAN"');
    expect(source).toContain('slug: "calisma-ipuclari", coachIntent: "STUDY_METHOD"');
    expect(source).toContain('slug: "sinav-stratejisi", coachIntent: "STRATEGY"');
    expect(source).toContain('slug: "motivasyon", coachIntent: "NEXT_STEP"');
    expect(source).toContain("insert into forum_thread_tags");
  });

  it("enables the coach bridge only as a local development override", () => {
    expect(source).toContain("'forum.coach_bridge.enabled', 'true'::jsonb");
  });
});
