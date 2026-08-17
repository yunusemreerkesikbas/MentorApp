import { describe, expect, it, vi } from "vitest";

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(() =>
    JSON.stringify({
      exams: [
        {
          slug: "kpss-lisans-2026",
          name: "KPSS Lisans 2026",
          family: "KPSS",
          variant: "LISANS",
          isCurrent: true,
          netRule: { kind: "PENALTY", divisor: 4 },
          events: [
            {
              type: "EXAM_DATE",
              eventAt: "2026-07-12T06:00:00.000Z",
              source: "ÖSYM",
              sourceUrl: "https://www.osym.gov.tr",
              verifiedAt: "2026-06-01T10:00:00.000Z",
              verifiedBy: "editorial-seed",
            },
          ],
        },
      ],
    }),
  ),
}));

import { ContentSeedService } from "./content-seed.service";

describe("ContentSeedService", () => {
  it("does not overwrite an existing exam or calendar event", async () => {
    const content = {
      hasExam: vi.fn(async () => true),
      hasExamEvent: vi.fn(async () => true),
      upsertExam: vi.fn(),
      upsertEvent: vi.fn(),
    };

    await new ContentSeedService(content as never).onModuleInit();

    expect(content.upsertExam).not.toHaveBeenCalled();
    expect(content.upsertEvent).not.toHaveBeenCalled();
  });

  it("inserts a missing event type on an existing exam without rewriting the exam row", async () => {
    const content = {
      hasExam: vi.fn(async () => true),
      hasExamEvent: vi.fn(async () => false),
      upsertExam: vi.fn(),
      upsertEvent: vi.fn(),
    };

    await new ContentSeedService(content as never).onModuleInit();

    expect(content.upsertExam).not.toHaveBeenCalled();
    expect(content.upsertEvent).toHaveBeenCalledOnce();
    expect(content.upsertEvent).toHaveBeenCalledWith(
      "kpss-lisans-2026",
      expect.objectContaining({ type: "EXAM_DATE" }),
    );
  });

  it("inserts a brand-new exam and its events", async () => {
    const content = {
      hasExam: vi.fn(async () => false),
      hasExamEvent: vi.fn(async () => false),
      upsertExam: vi.fn(),
      upsertEvent: vi.fn(),
    };

    await new ContentSeedService(content as never).onModuleInit();

    expect(content.upsertExam).toHaveBeenCalledOnce();
    expect(content.upsertEvent).toHaveBeenCalledOnce();
  });
});
