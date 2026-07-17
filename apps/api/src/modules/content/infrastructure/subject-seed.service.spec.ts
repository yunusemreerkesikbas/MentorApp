import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface SeedFile {
  sourceUrl: string;
  verifiedAt: string;
  subjects: Array<{ slug: string }>;
  topics: Array<{ subjectSlug: string; slug: string }>;
  examTopics: Array<{
    examSlug: string;
    subjectSlug: string;
    topicSlug: string;
  }>;
}

const seed = JSON.parse(
  readFileSync(resolve(__dirname, "../seed/subjects.seed.json"), "utf8"),
) as SeedFile;

describe("subject/topic taxonomy seed", () => {
  it("contains 24 parent-scoped topics from the verified 2026 source", () => {
    expect(seed.sourceUrl).toContain("/2026/KPSS/LISANS/");
    expect(seed.verifiedAt).toBe("2026-07-15");
    expect(seed.topics).toHaveLength(24);
    expect(
      new Set(seed.topics.map((topic) => topic.subjectSlug + ":" + topic.slug)),
    ).toHaveLength(24);
    const subjects = new Set(seed.subjects.map((subject) => subject.slug));
    expect(seed.topics.every((topic) => subjects.has(topic.subjectSlug))).toBe(
      true,
    );
  });

  it("links the same 24 topics idempotently to all three KPSS exams", () => {
    const examSlugs = [
      "kpss-lisans-2026",
      "kpss-onlisans-2026",
      "kpss-ortaogretim-2026",
    ];
    for (const examSlug of examSlugs) {
      const links = seed.examTopics.filter(
        (link) => link.examSlug === examSlug,
      );
      expect(links).toHaveLength(24);
      expect(
        new Set(links.map((link) => link.subjectSlug + ":" + link.topicSlug)),
      ).toHaveLength(24);
    }
  });
});
