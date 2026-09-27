import { HttpStatus } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PremiumFeatureId } from "@mentor/types";
import { ErrorCode } from "../../../common/errors/error-code";
import { PremiumFeatureGateService } from "./premium-feature-gate.service";

describe("PremiumFeatureGateService", () => {
  let getEntitlement: ReturnType<typeof vi.fn>;
  let configGet: ReturnType<typeof vi.fn>;
  let countFeaturesSince: ReturnType<typeof vi.fn>;
  let gate: PremiumFeatureGateService;

  beforeEach(() => {
    getEntitlement = vi.fn(async () => ({ isPremium: false }));
    configGet = vi.fn(async (key: string) => {
      if (key.endsWith("free_enabled")) return true;
      if (key.endsWith("free_limit")) return 1;
      return null;
    });
    countFeaturesSince = vi.fn(async () => 0);
    gate = new PremiumFeatureGateService(
      { getEntitlement } as never,
      { get: configGet } as never,
      { countFeaturesSince } as never,
    );
  });

  it("allows premium without counting usage", async () => {
    getEntitlement.mockResolvedValue({ isPremium: true });
    await expect(
      gate.isAllowed("u1", [], PremiumFeatureId.MOOD_REFLECTION),
    ).resolves.toBe(true);
    expect(countFeaturesSince).not.toHaveBeenCalled();
  });

  it("allows a free user under the free cap", async () => {
    await expect(
      gate.isAllowed("u1", [], PremiumFeatureId.MOOD_REFLECTION),
    ).resolves.toBe(true);
  });

  it("denies a free user who has used the free cap", async () => {
    countFeaturesSince.mockResolvedValue(1);
    await expect(
      gate.assertAllowed("u1", [], PremiumFeatureId.MOOD_REFLECTION),
    ).rejects.toMatchObject({
      code: ErrorCode.PAYMENT_PREMIUM_REQUIRED,
      httpStatus: HttpStatus.FORBIDDEN,
    });
  });

  /**
   * A coach has no Premium to buy, so "open on Premium" sends them nowhere. A caller may name its
   * own code for the one refusal a free coach meets: the day's taste is used up.
   */
  it("names the caller's code when the free taste is used up", async () => {
    countFeaturesSince.mockResolvedValue(1);
    await expect(
      gate.assertAllowed(
        "coach",
        [],
        PremiumFeatureId.MENTORSHIP_BRIEF,
        ErrorCode.MENTORSHIP_AI_DAILY_LIMIT,
      ),
    ).rejects.toMatchObject({
      code: ErrorCode.MENTORSHIP_AI_DAILY_LIMIT,
      httpStatus: HttpStatus.FORBIDDEN,
    });
  });

  it("keeps the Premium refusal when no free taste is switched on", async () => {
    configGet.mockImplementation(async (key: string) =>
      key.endsWith("free_enabled") ? false : 1,
    );
    await expect(
      gate.assertAllowed(
        "coach",
        [],
        PremiumFeatureId.MENTORSHIP_BRIEF,
        ErrorCode.MENTORSHIP_AI_DAILY_LIMIT,
      ),
    ).rejects.toMatchObject({ code: ErrorCode.PAYMENT_PREMIUM_REQUIRED });
  });
});
