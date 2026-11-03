import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";
import { ContentService } from "../application/content.service";
import { ContentSeedService } from "./content-seed.service";
import { SubjectSeedService } from "./subject-seed.service";

describe("content seed startup order", () => {
  it("finishes creating exam rows before linking their subject/topic taxonomy", async () => {
    const exams = new Set<string>();
    let links = 0;
    const link = async ({ examSlug }: { examSlug: string }) => {
      if (!exams.has(examSlug)) throw new Error(`Exam not ready: ${examSlug}`);
      links += 1;
    };
    const content = {
      hasExam: async () => false,
      hasExamEvent: async () => false,
      upsertExam: async ({ slug }: { slug: string }) => {
        await new Promise<void>((resolve) => setImmediate(resolve));
        exams.add(slug);
      },
      upsertEvent: async () => {},
      upsertSubject: async () => {},
      upsertTopic: async () => {},
      linkExamSubject: link,
      linkExamTopic: link,
    };
    const module = await Test.createTestingModule({
      providers: [ContentSeedService, SubjectSeedService, { provide: ContentService, useValue: content }],
    }).compile();
    try {
      await module.init();
      expect(exams.has("ales-3-2026")).toBe(true);
      expect(exams.has("dgs-2027")).toBe(true);
      expect(links).toBeGreaterThan(0);
    } finally {
      await module.close();
    }
  });
});
