import { beforeEach, describe, expect, it } from "vitest";
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
}

function makeRepoFake() {
  const byInviter = new Map<string, { inviterUserId: string; code: string; createdAt: Date }>();
  const byCode = new Map<string, string>();
  const redemptions: Redemption[] = [];
  return {
    redemptions,
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
  let premium: boolean;

  const service = () => {
    grants = [];
    premium = false;
    const entitlement = { getEntitlement: async () => ({ isPremium: premium }) };
    const economy = {
      grant: async (userId: string, unit: string, amount: number, opts: { reason: string }) => {
        grants.push({ userId, unit, amount, reason: opts.reason });
        return { xp: 0, coinConfirmed: amount, coinPending: 0 };
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

    await svc.onInvitedConverted("burak");
    expect(grants).toEqual([
      { userId: "ayse", unit: Currency.COIN, amount: 20, reason: "invite.converted" },
    ]);

    // second activation event → already CONVERTED → no double reward
    await svc.onInvitedConverted("burak");
    expect(grants).toHaveLength(1);
  });

  it("conversion with no pending redemption is a no-op", async () => {
    const svc = service();
    await svc.onInvitedConverted("nobody");
    expect(grants).toHaveLength(0);
  });
});
