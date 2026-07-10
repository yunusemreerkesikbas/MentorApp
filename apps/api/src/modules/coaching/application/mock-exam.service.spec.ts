import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { MockExamService } from "./mock-exam.service";

const USER = "u1";
const EXAM_ID = "e1-exam-uuid-0000-0000-000000000001";

const fakeDb = {
  transaction: async <T>(cb: (tx: unknown) => Promise<T>): Promise<T> =>
    cb({ execute: async () => undefined }),
} as never;

const contentPort = {
  getExamById: vi.fn(),
  listExamSubjects: vi.fn(),
  getExamCalendar: vi.fn(),
  getNetRule: vi.fn(),
};

function makeRepoFake() {
  return {
    create: vi.fn(async (_tx, data) => ({
      exam: {
        id: "mock-1",
        userId: data.userId,
        examId: data.examId,
        takenAt: data.takenAt,
        totalNet: data.totalNet,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      subjects: data.subjects.map((s: { subjectRef: string; correct: number; wrong: number; blank: number; net: string }, i: number) => ({
        id: `sub-${i}`,
        mockExamId: "mock-1",
        subjectRef: s.subjectRef,
        correct: s.correct,
        wrong: s.wrong,
        blank: s.blank,
        net: s.net,
        createdAt: new Date(),
      })),
    })),
    findById: vi.fn(),
    listPaged: vi.fn(),
    listTrend: vi.fn(),
    listSubjectBreakdown: vi.fn(),
    listSubjectsByMockExamIds: vi.fn(),
    maxNetExcluding: vi.fn(),
    maxTotalNet: vi.fn(),
    setGhostNarration: vi.fn(),
  };
}

const i18nFake = { translate: (key: string) => key } as never;

describe("MockExamService", () => {
  let repo: ReturnType<typeof makeRepoFake>;
  let photoRows: {
    countSince: ReturnType<typeof vi.fn>;
    findByClientRequestId: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    listPhotoSubjectSignals: ReturnType<typeof vi.fn>;
  };
  let service: MockExamService;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = makeRepoFake();
    photoRows = {
      countSince: vi.fn(),
      findByClientRequestId: vi.fn(),
      insert: vi.fn(),
      listPhotoSubjectSignals: vi.fn(),
    };
    service = new MockExamService(
      fakeDb,
      contentPort as never,
      repo as never,
      photoRows as never,
      i18nFake,
    );
    contentPort.getExamById.mockResolvedValue({
      id: EXAM_ID,
      slug: "kpss-lisans-2026",
      name: "KPSS Lisans 2026",
      netRule: { kind: "PENALTY", divisor: 4 },
    });
    contentPort.listExamSubjects.mockResolvedValue([
      { slug: "turkce", name: "Türkçe", questionCount: 30, sortOrder: 0 },
    ]);
  });

  it("creates a mock exam with server-computed net", async () => {
    const result = await service.create(USER, {
      examId: EXAM_ID,
      subjects: [{ subjectRef: "turkce", correct: 20, wrong: 4, blank: 6 }],
    });
    expect(result.totalNet).toBe("19.00");
    expect(result.subjects[0]?.net).toBe("19.00");
    expect(result.examName).toBe("KPSS Lisans 2026");
  });

  it("rejects unknown subject refs", async () => {
    await expect(
      service.create(USER, {
        examId: EXAM_ID,
        subjects: [{ subjectRef: "unknown", correct: 10, wrong: 0, blank: 0 }],
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("rejects duplicate subject refs", async () => {
    await expect(
      service.create(USER, {
        examId: EXAM_ID,
        subjects: [
          { subjectRef: "turkce", correct: 10, wrong: 0, blank: 0 },
          { subjectRef: "turkce", correct: 5, wrong: 0, blank: 0 },
        ],
      }),
    ).rejects.toMatchObject({ code: ErrorCode.COACHING_DUPLICATE_SUBJECT_REF });
  });

  it("rejects scores exceeding question count", async () => {
    await expect(
      service.create(USER, {
        examId: EXAM_ID,
        subjects: [{ subjectRef: "turkce", correct: 25, wrong: 5, blank: 5 }],
      }),
    ).rejects.toMatchObject({ code: ErrorCode.COACHING_INVALID_MOCK_EXAM_SCORES });
  });

  it("getGhostComparison returns null with fewer than 2 attempts", async () => {
    repo.listTrend.mockResolvedValue([{ id: "m1", examId: EXAM_ID, totalNet: "20.00" }]);
    expect(await service.getGhostComparison(USER)).toBeNull();
  });

  it("getGhostComparison builds the latest-vs-past comparison with the cached narration", async () => {
    repo.listTrend.mockResolvedValue([
      { id: "m2", examId: EXAM_ID, takenAt: new Date("2026-06-19T10:00:00Z"), totalNet: "42.00", aiGhostNarration: "cached-story" },
      { id: "m1", examId: EXAM_ID, takenAt: new Date("2026-06-12T10:00:00Z"), totalNet: "39.00", aiGhostNarration: null },
    ]);
    repo.maxNetExcluding.mockResolvedValue("40.00");
    repo.listSubjectsByMockExamIds.mockResolvedValue(
      new Map([
        ["m2", [{ subjectRef: "turkce", net: "25.00" }]],
        ["m1", [{ subjectRef: "turkce", net: "22.00" }]],
      ]),
    );

    const ghost = await service.getGhostComparison(USER);
    expect(ghost?.previousDelta).toBe("+3.00");
    expect(ghost?.isNewRecord).toBe(true);
    expect(ghost?.headline).toBe("coaching.ghost.NEW_RECORD"); // i18n fake echoes the key
    expect(ghost?.subjects[0]?.delta).toBe("+3.00");
    expect(ghost?.aiNarration).toBe("cached-story");
  });

  it("setLatestGhostNarration caches on the latest attempt", async () => {
    repo.listTrend.mockResolvedValue([{ id: "m2", examId: EXAM_ID, totalNet: "42.00" }]);
    await service.setLatestGhostNarration(USER, "story", "fake");
    expect(repo.setGhostNarration).toHaveBeenCalledWith(expect.anything(), "m2", "story", "fake");
  });

  it("includes normalized strengths and an evidence-aware next focus", async () => {
    repo.listTrend.mockResolvedValue([
      { id: "m1", examId: EXAM_ID, takenAt: new Date("2026-06-19T10:00:00Z"), totalNet: "42.00" },
    ]);
    repo.listSubjectBreakdown.mockResolvedValue([
      { subjectRef: "turkce", avgNet: "21.00", attemptCount: 1 },
    ]);
    repo.maxTotalNet.mockResolvedValue("42.00");
    contentPort.listExamSubjects.mockResolvedValue([
      { slug: "turkce", name: "Türkçe", questionCount: 30, sortOrder: 0 },
      { slug: "tarih", name: "Tarih", questionCount: 27, sortOrder: 1 },
    ]);
    photoRows.listPhotoSubjectSignals.mockResolvedValue([
      { subjectRef: "tarih", count: 2 },
    ]);

    await expect(service.getAnalysis(USER)).resolves.toMatchObject({
      subjects: [
        {
          subjectRef: "turkce",
          questionCount: 30,
          normalizedAveragePercent: "70.00",
        },
      ],
      nextFocus: {
        subjectRef: "tarih",
        subjectName: "Tarih",
        source: "PHOTO_SIGNAL",
        evidenceCount: 2,
        evidenceLevel: "REPEATED",
        message: "coaching.focus.PHOTO_SIGNAL_REPEATED",
        suggestedTaskTitle: "coaching.focus.TASK_TITLE_PHOTO_SIGNAL",
      },
    });
  });

  it("scopes every analysis source to the requested exam", async () => {
    repo.listTrend.mockResolvedValue([
      { id: "m1", examId: EXAM_ID, takenAt: new Date("2026-06-19T10:00:00Z"), totalNet: "42.00" },
    ]);
    repo.listSubjectBreakdown.mockResolvedValue([
      { subjectRef: "turkce", avgNet: "21.00", attemptCount: 1 },
    ]);
    repo.maxTotalNet.mockResolvedValue("42.00");
    repo.listSubjectsByMockExamIds.mockResolvedValue(new Map());
    photoRows.listPhotoSubjectSignals.mockResolvedValue([]);

    await (service.getAnalysis as unknown as (
      userId: string,
      examId: string,
    ) => Promise<unknown>)(USER, EXAM_ID);

    expect(repo.listTrend).toHaveBeenCalledWith(expect.anything(), USER, 12, EXAM_ID);
    expect(repo.listSubjectBreakdown).toHaveBeenCalledWith(expect.anything(), USER, EXAM_ID);
    expect(photoRows.listPhotoSubjectSignals).toHaveBeenCalledWith(
      expect.anything(),
      USER,
      EXAM_ID,
    );
    expect(repo.maxTotalNet).toHaveBeenCalledWith(expect.anything(), USER, EXAM_ID);
  });
});
