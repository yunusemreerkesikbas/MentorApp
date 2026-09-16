import { beforeEach, describe, expect, it } from "vitest";
import { PaymentSucceeded } from "../../payments/domain/payments.events";
import { Currency } from "@mentor/types";
import { ErrorCode } from "../../../common/errors/error-code";
import { DomainError } from "../../../common/errors/domain-error";
import { InviteService } from "./invite.service";

interface Redemption {
  id: string;
  inviterUserId: string;
  invitedUserId: string;
  code: string;
  status: string;
  convertedAt: Date | null;
  redeemedAt: Date;
  sourcePaymentId?: string;
  rewardOutcome?: string;
}

function makeRepoFake() {
  const byInviter = new Map<string, { inviterUserId: string; code: string; createdAt: Date }>();
  const byCode = new Map<string, string>();
  const redemptions: Redemption[] = [];
  return {
    redemptions,
    withServiceTx: async (fn: (tx: unknown) => Promise<void>) => fn({}),
    lockRedemption: async (invited: string) => redemptions.find(r => r.invitedUserId === invited),
    lockPending: async (invited: string) => redemptions.find(r => r.invitedUserId === invited && r.status === "PENDING"),
    recordPayment: async (id: string, sourcePaymentId: string, rewardOutcome: string) => {
      Object.assign(redemptions.find(r => r.id === id)!, { status: "CONVERTED", sourcePaymentId, rewardOutcome });
    },
    findByInviter: async (id: string) => byInviter.get(id),
    findByCode: async (code: string) => {
      const inviter = byCode.get(code);
      return inviter ? { inviterUserId: inviter, code, createdAt: new Date() } : undefined;
    },
    create: async (id: string, code: string) => {
      const row = { inviterUserId: id, code, createdAt: new Date() };
      byInviter.set(id, row);
      byCode.set(code, id);
      return row;
    },
    findRedemptionByInvited: async (invited: string) =>
      redemptions.find((r) => r.invitedUserId === invited),
    createRedemption: async (inviter: string, invited: string, code: string) => {
      const r: Redemption = {
        id: `r${redemptions.length + 1}`,
        inviterUserId: inviter,
        invitedUserId: invited,
        code,
        status: "PENDING",
        convertedAt: null,
        redeemedAt: new Date("2026-09-01T00:00:00Z"),
      };
      redemptions.push(r);
      return r;
    },
    markConverted: async (invited: string) => {
      const r = redemptions.find((x) => x.invitedUserId === invited && x.status === "PENDING");
      if (!r) return undefined;
      r.status = "CONVERTED";
      r.convertedAt = new Date();
      return r;
    },
    countsByInviter: async (inviter: string) => {
      const list = redemptions.filter((r) => r.inviterUserId === inviter);
      return { invited: list.length, converted: list.filter((r) => r.status === "CONVERTED").length };
    },
  };
}

describe("InviteService", () => {
  let repo: ReturnType<typeof makeRepoFake>;
  let grants: Array<{ userId: string; unit: string; amount: number; reason: string }>;
  let reversals: Array<{ userId: string; opts: Record<string, string> }>;
  let reverseResult: number;
  let reverseError: Error | null;
  let premium: boolean;
  let refunded: boolean;
  let grantError: Error | null;

  const service = () => {
    grants = [];
    reversals = [];
    reverseResult = 20;
    reverseError = null;
    premium = false;
    refunded = false;
    grantError = null;
    const entitlement = { getEntitlement: async () => ({ isPremium: premium }) };
    const economy = {
      grantInServiceTx: async (userId: string, unit: string, amount: number, opts: { reason: string }) => {
        if (grantError) throw grantError;
        grants.push({ userId, unit, amount, reason: opts.reason });
        return { xp: 0, coinConfirmed: amount, coinPending: 0 };
      },
      reverse: async (userId: string, opts: Record<string, string>) => {
        if (reverseError) throw reverseError;
        reversals.push({ userId, opts });
        return reverseResult;
      },
    };
    const config = { get: async () => 20 };
    const quests = { evaluateAndGrant: async () => undefined };
    return new InviteService(
      repo as never,
      entitlement as never,
      economy as never,
      quests as never,
      config as never,
      { isRefunded: async () => refunded } as never,
    );
  };

  beforeEach(() => {
    repo = makeRepoFake();
  });

  it("getOrCreateCode is stable (same code on second call)", async () => {
    const svc = service();
    const a = await svc.getOrCreateCode("inviter");
    const b = await svc.getOrCreateCode("inviter");
    expect(a).toBe(b);
    expect(a).toMatch(/^MENTOR-/);
  });

  it("redeem creates a PENDING redemption (no reward yet)", async () => {
    const svc = service();
    const code = await svc.getOrCreateCode("ayse");
    const res = await svc.redeem("burak", code);
    expect(res.status).toBe("PENDING");
    expect(grants).toHaveLength(0);
  });

  it("rejects self-redeem, unknown code, double redeem, and premium", async () => {
    const svc = service();
    const code = await svc.getOrCreateCode("ayse");

    await expect(svc.redeem("ayse", code)).rejects.toMatchObject({ code: ErrorCode.INVITE_SELF });
    await expect(svc.redeem("burak", "MENTOR-NOPE")).rejects.toMatchObject({
      code: ErrorCode.INVITE_CODE_INVALID,
    });
    await svc.redeem("burak", code);
    await expect(svc.redeem("burak", code)).rejects.toMatchObject({
      code: ErrorCode.INVITE_ALREADY_REDEEMED,
    });
    premium = true;
    await expect(svc.redeem("cem", code)).rejects.toMatchObject({
      constructor: DomainError,
      code: ErrorCode.INVITE_ALREADY_PREMIUM,
    });
  });

  it("on conversion: rewards the inviter once (idempotent)", async () => {
    const svc = service();
    const code = await svc.getOrCreateCode("ayse");
    await svc.redeem("burak", code);

    await svc.onInvitedConverted(new PaymentSucceeded("burak", "sub-1", "pay-1", 100, new Date()));
    expect(grants).toEqual([
      { userId: "ayse", unit: Currency.COIN, amount: 20, reason: "invite.converted" },
    ]);

    // second activation event → already CONVERTED → no double reward
    await svc.onInvitedConverted(new PaymentSucceeded("burak", "sub-1", "pay-1", 100, new Date()));
    expect(grants).toHaveLength(1);
  });

  it("conversion with no pending redemption is a no-op", async () => {
    const svc = service();
    await svc.onInvitedConverted(new PaymentSucceeded("nobody", "sub-1", "pay-1", 100, new Date()));
    expect(grants).toHaveLength(0);
  });

  it("on refund: reverses the inviter's conversion reward (redemption-keyed, idempotent ref)", async () => {
    const svc = service();
    const code = await svc.getOrCreateCode("ayse");
    await svc.redeem("burak", code);
    await svc.onInvitedConverted(new PaymentSucceeded("burak", "sub-1", "pay-1", 100, new Date()));

    await svc.onInvitedRefunded("burak", "pay-1");
    expect(reversals).toEqual([
      {
        userId: "ayse",
        opts: {
          originalRefType: "invite-redemption",
          originalRefId: "r1",
          reason: "invite.reverted",
          refType: "invite_reversal",
          refId: "r1",
        },
      },
    ]);
  });

  it("refund without a CONVERTED redemption is a no-op", async () => {
    const svc = service();
    const code = await svc.getOrCreateCode("ayse");
    await svc.redeem("burak", code); // still PENDING
    await svc.onInvitedRefunded("burak", "pay-1");
    await svc.onInvitedRefunded("nobody");
    expect(reversals).toHaveLength(0);
  });

  it("refund reversal failure propagates so the durable event can retry", async () => {
    const svc = service();
    const code = await svc.getOrCreateCode("ayse");
    await svc.redeem("burak", code);
    await svc.onInvitedConverted(new PaymentSucceeded("burak", "sub-1", "pay-1", 100, new Date()));
    reverseError = new Error("db down");
    await expect(svc.onInvitedRefunded("burak", "pay-1")).rejects.toThrow("db down");
  });
  it("does not reward a zero charge, an old payment, or an already refunded payment", async () => {
    const svc = service();
    await svc.redeem("burak", await svc.getOrCreateCode("ayse"));
    await svc.onInvitedConverted(new PaymentSucceeded("burak", "sub", "zero", 0, new Date()));
    await svc.onInvitedConverted(new PaymentSucceeded("burak", "sub", "old", 100, new Date("2026-08-01")));
    expect(repo.redemptions[0]!.status).toBe("PENDING");
    refunded = true;
    await svc.onInvitedConverted(new PaymentSucceeded("burak", "sub", "refunded", 100, new Date()));
    expect(grants).toHaveLength(0);
    expect(repo.redemptions[0]!.rewardOutcome).toBe("REFUNDED");
  });

  it("records cap denial without claiming a grant or reversing one later", async () => {
    const svc = service();
    await svc.redeem("burak", await svc.getOrCreateCode("ayse"));
    grantError = new DomainError(ErrorCode.ECONOMY_LIMIT_EXCEEDED, 422);
    await svc.onInvitedConverted(new PaymentSucceeded("burak", "sub", "pay-1", 100, new Date()));
    expect(repo.redemptions[0]!.rewardOutcome).toBe("CAP_DENIED");
    expect(grants).toHaveLength(0);
    await svc.onInvitedRefunded("burak", "pay-1");
    expect(reversals).toHaveLength(0);
  });

  it("does not reverse the first payment reward when a renewal is refunded", async () => {
    const svc = service();
    await svc.redeem("burak", await svc.getOrCreateCode("ayse"));
    await svc.onInvitedConverted(new PaymentSucceeded("burak", "sub", "first", 100, new Date()));
    await svc.onInvitedRefunded("burak", "renewal");
    expect(reversals).toHaveLength(0);
  });

  it("leaves a failed grant pending for retry", async () => {
    const svc = service();
    await svc.redeem("burak", await svc.getOrCreateCode("ayse"));
    grantError = new Error("temporary failure");
    const event = new PaymentSucceeded("burak", "sub", "first", 100, new Date());
    await expect(svc.onInvitedConverted(event)).rejects.toThrow("temporary failure");
    expect(repo.redemptions[0]!.status).toBe("PENDING");
    grantError = null;
    await svc.onInvitedConverted(event);
    expect(grants).toHaveLength(1);
  });

});
