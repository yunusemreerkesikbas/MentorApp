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
  };
}

describe("MockExamService", () => {
  let repo: ReturnType<typeof makeRepoFake>;
  let service: MockExamService;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = makeRepoFake();
    service = new MockExamService(fakeDb, contentPort as never, repo as never, {
      countSince: vi.fn(),
      findByClientRequestId: vi.fn(),
      insert: vi.fn(),
      listPhotoSubjectSignals: vi.fn(),
    } as never);
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
});
