import { HttpStatus } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { ContentServiceAdapter } from "./content-service.adapter";

const adapter = (getCurrentExamByFamily: () => Promise<unknown>) =>
  new ContentServiceAdapter({ getCurrentExamByFamily: vi.fn(getCurrentExamByFamily) } as never);

describe("ContentServiceAdapter.getTaxonomyExamId", () => {
  it("returns the family's taxonomy exam", async () => {
    await expect(adapter(async () => ({ id: "exam-1" })).getTaxonomyExamId("YKS")).resolves.toBe("exam-1");
  });

  it("says nothing, rather than failing the report, when content knows no exam for the family", async () => {
    const missing = adapter(async () => {
      throw new DomainError(ErrorCode.CONTENT_EXAM_NOT_FOUND, HttpStatus.NOT_FOUND);
    });
    await expect(missing.getTaxonomyExamId("LGS")).resolves.toBeNull();
    await expect(adapter(async () => ({ id: "exam-1" })).getTaxonomyExamId(null)).resolves.toBeNull();
  });

  it("does not swallow any other failure", async () => {
    const broken = adapter(async () => {
      throw new Error("db down");
    });
    await expect(broken.getTaxonomyExamId("KPSS")).rejects.toThrow("db down");
  });
});
