import { HttpStatus } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { ErrorCode } from "../../../common/errors/error-code";
import { PhotoCategorizeService } from "./photo-categorize.service";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const MOCK_EXAM_ID = "00000000-0000-4000-8000-000000000002";
const OTHER_MOCK_EXAM_ID = "00000000-0000-4000-8000-000000000003";
const CLIENT_REQUEST_ID = "11111111-1111-4111-8111-111111111111";
const STORAGE_KEY = `mock-exams/${USER_ID}/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg`;

describe("PhotoCategorizeService", () => {
  let service: PhotoCategorizeService;
  let categorizeImage: ReturnType<typeof vi.fn>;
  let readObject: ReturnType<typeof vi.fn>;
  let findByClientRequestId: ReturnType<typeof vi.fn>;
  let assertCanCategorize: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    categorizeImage = vi.fn(async () => ({
      subjectSlugs: ["turkce"],
      model: "fake-vision",
      promptTokens: 1,
      completionTokens: 1,
    }));
    readObject = vi.fn(async () => Buffer.from("jpeg"));
    findByClientRequestId = vi.fn(async () => []);
    assertCanCategorize = vi.fn(async () => undefined);

    const config = {
      get: vi.fn(async (key: string) => {
        if (key === FeatureFlag.AI_ENABLED) return true;
        return null;
      }),
    };

    service = new PhotoCategorizeService(
      { categorizeImage } as never,
      { readObject } as never,
      config as never,
      {
        listExamSubjectsByExamId: vi.fn(async () => [
          { slug: "turkce", name: "Türkçe" },
        ]),
      } as never,
      {
        findPhotoCategorizationsByClientRequestId: findByClientRequestId,
        getOwnedMockExam: vi.fn(async () => ({ examId: "exam-1" })),
        recordPhotoCategorizations: vi.fn(async () => undefined),
        countPhotoCategorizationsSince: vi.fn(),
      } as never,
      { append: vi.fn() } as never,
      { assertCanCategorize } as never,
      { assertWithinBudget: vi.fn(async () => undefined) } as never,
    );
  });

  it("returns cached subjects on idempotent retry without re-running vision", async () => {
    findByClientRequestId.mockResolvedValue([
      {
        mockExamId: MOCK_EXAM_ID,
        subjectRef: "turkce",
        storageKey: STORAGE_KEY,
        clientRequestId: CLIENT_REQUEST_ID,
      },
    ]);

    const result = await service.categorize(USER_ID, [], MOCK_EXAM_ID, {
      storageKey: STORAGE_KEY,
      clientRequestId: CLIENT_REQUEST_ID,
    });

    expect(result.subjectRefs).toEqual([{ slug: "turkce", name: "Türkçe" }]);
    expect(categorizeImage).not.toHaveBeenCalled();
    expect(assertCanCategorize).not.toHaveBeenCalled();
  });

  it("throws CONFLICT when clientRequestId belongs to another mock exam", async () => {
    findByClientRequestId.mockResolvedValue([
      {
        mockExamId: OTHER_MOCK_EXAM_ID,
        subjectRef: "turkce",
        storageKey: STORAGE_KEY,
        clientRequestId: CLIENT_REQUEST_ID,
      },
    ]);

    await expect(
      service.categorize(USER_ID, [], MOCK_EXAM_ID, {
        storageKey: STORAGE_KEY,
        clientRequestId: CLIENT_REQUEST_ID,
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.CONFLICT,
      httpStatus: HttpStatus.CONFLICT,
    });
  });

  it("runs vision and records when no idempotent rows exist", async () => {
    const result = await service.categorize(USER_ID, [], MOCK_EXAM_ID, {
      storageKey: STORAGE_KEY,
      clientRequestId: CLIENT_REQUEST_ID,
    });

    expect(assertCanCategorize).toHaveBeenCalledOnce();
    expect(categorizeImage).toHaveBeenCalledOnce();
    expect(result.subjectRefs).toEqual([{ slug: "turkce", name: "Türkçe" }]);
  });
});
