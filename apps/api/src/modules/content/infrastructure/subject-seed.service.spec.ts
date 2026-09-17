import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface SeedFile {
  sourceUrl: string;
  verifiedAt: string;
  sources: Array<{ family: string; sourceUrl: string; verifiedAt: string }>;
  subjects: Array<{ slug: string }>;
  topics: Array<{ subjectSlug: string; slug: string }>;
  examSubjects: Array<{
    examSlug: string;
    subjectSlug: string;
    questionCount: number | null;
    sortOrder: number;
  }>;
  examTopics: Array<{
    examSlug: string;
    subjectSlug: string;
    topicSlug: string;
  }>;
}

const seed = JSON.parse(
  readFileSync(resolve(__dirname, "../seed/subjects.seed.json"), "utf8"),
) as SeedFile;

const KPSS_EXAMS = [
  "kpss-lisans-2026",
  "kpss-onlisans-2026",
  "kpss-ortaogretim-2026",
];

describe("subject/topic taxonomy seed", () => {
  it("keeps unique subject and topic slugs and every topic has a parent", () => {
    expect(seed.sourceUrl).toContain("/2026/KPSS/LISANS/");
    expect(seed.sources.map((source) => source.family).sort()).toEqual([
      "KPSS",
      "LGS",
      "YKS",
    ]);
    const subjects = new Set(seed.subjects.map((subject) => subject.slug));
    expect(subjects.size).toBe(seed.subjects.length);
    expect(
      new Set(seed.topics.map((topic) => topic.subjectSlug + ":" + topic.slug)),
    ).toHaveLength(seed.topics.length);
    expect(seed.topics.every((topic) => subjects.has(topic.subjectSlug))).toBe(
      true,
    );
  });

  it("links the same KPSS GY-GK tree to all three 2026 exams", () => {
    const lisans = seed.examTopics.filter(
      (link) => link.examSlug === "kpss-lisans-2026",
    );
    expect(lisans.length).toBeGreaterThan(24);
    for (const examSlug of KPSS_EXAMS) {
      const links = seed.examTopics.filter((link) => link.examSlug === examSlug);
      expect(
        new Set(links.map((link) => link.subjectSlug + ":" + link.topicSlug)),
      ).toEqual(
        new Set(lisans.map((link) => link.subjectSlug + ":" + link.topicSlug)),
      );
    }
    const turkce = seed.examSubjects.find(
      (link) =>
        link.examSlug === "kpss-lisans-2026" && link.subjectSlug === "turkce",
    );
    expect(turkce?.questionCount).toBe(30);
  });

  it("seeds YKS TYT/AYT/YDT and LGS papers instead of empty trees", () => {
    expect(
      seed.examSubjects.some(
        (link) =>
          link.examSlug === "yks-2026" && link.subjectSlug === "tyt-turkce",
      ),
    ).toBe(true);
    expect(
      seed.examSubjects.some(
        (link) =>
          link.examSlug === "lgs-2026" && link.subjectSlug === "lgs-fen",
      ),
    ).toBe(true);
    const yksTopics = seed.examTopics.filter(
      (link) => link.examSlug === "yks-2026",
    );
    const lgsTopics = seed.examTopics.filter(
      (link) => link.examSlug === "lgs-2026",
    );
    expect(yksTopics.length).toBeGreaterThan(0);
    expect(lgsTopics.length).toBeGreaterThan(0);
  });

  it("only links topics that belong to an exam's subjects", () => {
    const subjectsByExam = new Map<string, Set<string>>();
    for (const link of seed.examSubjects) {
      const set = subjectsByExam.get(link.examSlug) ?? new Set();
      set.add(link.subjectSlug);
      subjectsByExam.set(link.examSlug, set);
    }
    const topicKeys = new Set(
      seed.topics.map((topic) => topic.subjectSlug + ":" + topic.slug),
    );
    for (const link of seed.examTopics) {
      expect(subjectsByExam.get(link.examSlug)?.has(link.subjectSlug)).toBe(
        true,
      );
      expect(topicKeys.has(link.subjectSlug + ":" + link.topicSlug)).toBe(true);
    }
  });

  it("offers Diğer as a catch-all subject and topic on every exam", () => {
    const exams = [...new Set(seed.examSubjects.map((link) => link.examSlug))];
    for (const examSlug of exams) {
      const other = seed.examSubjects.find(
        (link) => link.examSlug === examSlug && link.subjectSlug === "diger",
      );
      expect(other?.questionCount).toBeNull();
      const subjects = seed.examSubjects
        .filter((link) => link.examSlug === examSlug)
        .map((link) => link.subjectSlug);
      for (const subjectSlug of subjects) {
        expect(
          seed.examTopics.some(
            (link) =>
              link.examSlug === examSlug &&
              link.subjectSlug === subjectSlug &&
              link.topicSlug === "diger",
          ),
        ).toBe(true);
      }
    }
  });
});
