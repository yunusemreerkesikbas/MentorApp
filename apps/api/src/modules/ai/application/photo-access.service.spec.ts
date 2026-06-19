import { HttpStatus } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { PhotoAccessService } from "./photo-access.service";

describe("PhotoAccessService", () => {
  let service: PhotoAccessService;
  let configGet: ReturnType<typeof vi.fn>;
  let getEntitlement: ReturnType<typeof vi.fn>;
  let countSince: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    configGet = vi.fn(async (key: string) => {
      if (key === FeatureFlag.AI_ENABLED) return true;
      if (key === "ai.photo.monthly_limit") return 30;
      return null;
    });
    getEntitlement = vi.fn(async () => ({ isPremium: true }));
    countSince = vi.fn(async () => 0);

    service = new PhotoAccessService(
      { getEntitlement } as never,
      { get: configGet } as never,
      { countPhotoCategorizationsSince: countSince } as never,
    );
  });

  it("assertCanCategorize throws FORBIDDEN for free users", async () => {
    getEntitlement.mockResolvedValue({ isPremium: false });

    await expect(service.assertCanCategorize("user-1")).rejects.toMatchObject({
      code: ErrorCode.PAYMENT_PREMIUM_REQUIRED,
      httpStatus: HttpStatus.FORBIDDEN,
    });
  });

  it("assertCanCategorize throws when monthly cap reached", async () => {
    countSince.mockResolvedValue(30);

    await expect(service.assertCanCategorize("user-1")).rejects.toMatchObject({
      code: ErrorCode.AI_PHOTO_RATE_LIMITED,
      httpStatus: HttpStatus.TOO_MANY_REQUESTS,
    });
  });

  it("assertCanCategorize passes for premium under cap", async () => {
    await expect(service.assertCanCategorize("user-1")).resolves.toBeUndefined();
  });
});
