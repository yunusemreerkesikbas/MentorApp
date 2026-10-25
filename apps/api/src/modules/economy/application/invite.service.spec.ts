import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentSucceeded } from "../../payments/domain/payments.events";
import { InviteSignalRegistry } from "../../payments/application/invite-signal.registry";
import { Currency, UserRole } from "@mentor/types";
import { inviteCodeSchema, normalizeInviteCode, redeemInviteSchema } from "@mentor/validation";
import { ErrorCode } from "../../../common/errors/error-code";
import { DomainError } from "../../../common/errors/domain-error";
import { EconomyEventTopic } from "../domain/economy.events";
import { InviteService, generateInviteCode } from "./invite.service";

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
    markRewardReversed: async (id: string) => {
      redemptions.find(r => r.id === id)!.rewardOutcome = "REVERSED";
    },
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
        // One second apart, so "newest first" has something to order by.
        redeemedAt: new Date(Date.parse("2026-09-01T00:00:00Z") + redemptions.length * 1000),
      };
      redemptions.push(r);
      return r;
    },
    listJoinedByInviter: async (inviter: string, limit: number) =>
      redemptions
        .filter((r) => r.inviterUserId === inviter)
        .sort((a, b) => b.redeemedAt.getTime() - a.redeemedAt.getTime())
        .slice(0, limit)
        .map((r) => ({ invitedUserId: r.invitedUserId, redeemedAt: r.redeemedAt })),
    countConvertedByInviter: async (inviter: string) =>
      redemptions.filter(
        (r) =>
          r.inviterUserId === inviter &&
          r.status === "CONVERTED" &&
          !["REFUNDED", "REVERSED"].includes(r.rewardOutcome ?? ""),
      ).length,
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

interface PromotionSummaryFake {
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
}

interface UserFake {
  id: string;
  displayName: string;
  status: string;
  erasureStartedAt: Date | null;
  roles: string[];
  createdAt: Date;
}

const DAY_MS = 86_400_000;
const NOW = new Date("2026-10-25T12:00:00Z");

describe("InviteService", () => {
  let repo: ReturnType<typeof makeRepoFake>;
  let grants: Array<{ userId: string; unit: string; amount: number; reason: string }>;
  let reversals: Array<{ userId: string; opts: Record<string, string> }>;
  let reverseResult: number;
  let reverseError: Error | null;
  let paid: boolean;
  let refunded: boolean;
  let grantError: Error | null;
  let windowDays: number;
  let buddyResult: boolean;
  let buddyError: Error | null;
  let followError: Error | null;
  let buddyCalls: Array<[string, string]>;
  let followCalls: Array<[string, string]>;
  let emitted: Array<{ topic: string; payload: unknown }>;
  let economyEnabled: boolean;
  let signals: InviteSignalRegistry;
  let phoneVerified: boolean;
  let inviteOffer: { promotion: PromotionSummaryFake | null } | null;
  let previewSummary: PromotionSummaryFake | null;
  let blockingSubscription: boolean;
  let offerLookups: string[];
  let identityLookups: string[][];
  /** Per-user overrides; any other id is a fresh, active student created a day ago. */
  let userRows: Map<string, UserFake | null>;

  const setUser = (id: string, patch: Partial<UserFake>) => {
    userRows.set(id, { ...defaultUser(id), ...patch });
  };
  const defaultUser = (id: string): UserFake => ({
    id,
    displayName: `${id}-name`,
    status: "ACTIVE",
    erasureStartedAt: null,
    roles: [UserRole.STUDENT],
    createdAt: new Date(Date.now() - DAY_MS),
  });

  const service = () => {
    grants = [];
    reversals = [];
    reverseResult = 20;
    reverseError = null;
    paid = false;
    refunded = false;
    grantError = null;
    windowDays = 7;
    buddyResult = true;
    buddyError = null;
    followError = null;
    buddyCalls = [];
    followCalls = [];
    emitted = [];
    economyEnabled = true;
    signals = new InviteSignalRegistry();
    userRows = new Map();
    phoneVerified = true;
    inviteOffer = null;
    previewSummary = null;
    blockingSubscription = false;
    offerLookups = [];
    identityLookups = [];
    const users = {
      findByIdService: async (id: string) => (userRows.has(id) ? (userRows.get(id) ?? undefined) : defaultUser(id)),
    };
    // Identity's public seam: an id with no row is simply absent from the map.
    const identities = {
      isPhoneVerified: async () => phoneVerified,
      listDisplayIdentities: async (ids: string[]) => {
        identityLookups.push(ids);
        return new Map(
          ids
            .filter((id) => userRows.get(id) !== null)
            .map((id) => [id, { userId: id, displayName: (userRows.get(id) ?? defaultUser(id)).displayName, username: "handle", avatarUrl: "https://cdn/a.png" }]),
        );
      },
    };
    const subscriptions = {
      findInviteOffer: async (userId: string) => {
        offerLookups.push(userId);
        return inviteOffer;
      },
      previewInviteOffer: async () => previewSummary,
      hasCheckoutBlockingSubscription: async () => blockingSubscription,
    };
    const economy = {
      grantInServiceTx: async (userId: string, unit: string, amount: number, opts: { reason: string }) => {
        if (grantError) throw grantError;
        grants.push({ userId, unit, amount, reason: opts.reason });
        return { xp: 0, coinConfirmed: amount, coinPending: 0 };
      },
      reverseInServiceTx: async (userId: string, opts: Record<string, string>) => {
        if (reverseError) throw reverseError;
        reversals.push({ userId, opts });
        return reverseResult;
      },
    };
    const config = {
      get: async (key: string) =>
        key === "economy.invite.redeem_window_days"
          ? windowDays
          : key === "economy.enabled"
            ? economyEnabled
            : 20,
    };
    const quests = { evaluateAndGrant: async () => undefined };
    const buddy = {
      requestFromInvite: async (requesterId: string, addresseeId: string) => {
        buddyCalls.push([requesterId, addresseeId]);
        if (buddyError) throw buddyError;
        return buddyResult;
      },
    };
    const follows = {
      followEachOtherSilently: async (a: string, b: string) => {
        followCalls.push([a, b]);
        if (followError) throw followError;
      },
    };
    const events = { emit: (topic: string, payload: unknown) => void emitted.push({ topic, payload }) };
    return new InviteService(
      repo as never,
      economy as never,
      quests as never,
      config as never,
      { isRefunded: async () => refunded, hasPaid: async () => paid } as never,
      users as never,
      buddy as never,
      follows as never,
      events as never,
      signals,
      identities as never,
      subscriptions as never,
    );
  };

  beforeEach(() => {
    repo = makeRepoFake();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("getOrCreateCode is stable (same code on second call)", async () => {
    const svc = service();
    const a = await svc.getOrCreateCode("inviter");
    const b = await svc.getOrCreateCode("inviter");
    expect(a).toBe(b);
    expect(a).toMatch(/^PUHU-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
  });

  describe("invite signal for the INVITED promotion", () => {
    it("tells payments when a user redeemed, once registered at boot", async () => {
      const svc = service();
      await svc.redeem("burak", await svc.getOrCreateCode("ayse"));
      expect(await signals.invitedAt("burak")).toBeNull(); // nothing registered yet

      svc.onModuleInit();

      expect(await signals.invitedAt("burak")).toEqual(new Date("2026-09-01T00:00:00Z"));
      expect(await signals.invitedAt("never-invited")).toBeNull();
    });

    it("answers null while the economy is switched off, so a dormant economy never discounts", async () => {
      const svc = service();
      await svc.redeem("burak", await svc.getOrCreateCode("ayse"));
      svc.onModuleInit();
      economyEnabled = false;

      expect(await signals.invitedAt("burak")).toBeNull();
    });
  });

  it("redeem creates a PENDING redemption (no reward yet)", async () => {
    const svc = service();
    const code = await svc.getOrCreateCode("ayse");
    const res = await svc.redeem("burak", code);
    expect(res.status).toBe("PENDING");
    expect(grants).toHaveLength(0);
  });

  it("rejects self-redeem, unknown code, double redeem, and a user who already paid", async () => {
    const svc = service();
    const code = await svc.getOrCreateCode("ayse");

    await expect(svc.redeem("ayse", code)).rejects.toMatchObject({ code: ErrorCode.INVITE_SELF });
    await expect(svc.redeem("burak", "PUHU-NOPE2345")).rejects.toMatchObject({
      code: ErrorCode.INVITE_CODE_INVALID,
    });
    await svc.redeem("burak", code);
    await expect(svc.redeem("burak", code)).rejects.toMatchObject({
      code: ErrorCode.INVITE_ALREADY_REDEEMED,
    });
    paid = true;
    await expect(svc.redeem("cem", code)).rejects.toMatchObject({
      constructor: DomainError,
      code: ErrorCode.INVITE_ALREADY_PAID,
      httpStatus: 409,
    });
  });

  it("lets a trialing user (no positive charge yet) redeem", async () => {
    const svc = service();
    const code = await svc.getOrCreateCode("ayse");
    paid = false; // a trial grants premium entitlement but moved no money
    await expect(svc.redeem("burak", code)).resolves.toEqual({ status: "PENDING" });
  });

  describe("redeem side effects", () => {
    it("asks for a study buddy request invited → inviter and emits INVITE_REDEEMED once", async () => {
      const svc = service();
      const code = await svc.getOrCreateCode("ayse");
      await expect(svc.redeem("burak", code)).resolves.toEqual({ status: "PENDING" });

      expect(buddyCalls).toEqual([["burak", "ayse"]]);
      expect(followCalls).toEqual([]);
      expect(emitted).toEqual([
        {
          topic: EconomyEventTopic.INVITE_REDEEMED,
          payload: {
            redemptionId: "r1",
            inviterUserId: "ayse",
            invitedUserId: "burak",
            invitedDisplayName: "burak-name",
            buddyRequested: true,
          },
        },
      ]);
      expect(EconomyEventTopic.INVITE_REDEEMED).toBe("economy.invite.redeemed");
    });

    it("falls back to a silent mutual follow when no buddy request was made", async () => {
      const svc = service();
      const code = await svc.getOrCreateCode("ayse");
      buddyResult = false;
      await expect(svc.redeem("burak", code)).resolves.toEqual({ status: "PENDING" });

      expect(buddyCalls).toEqual([["burak", "ayse"]]);
      expect(followCalls).toEqual([["burak", "ayse"]]);
      expect(emitted).toHaveLength(1);
      expect(emitted[0]!.payload).toMatchObject({ buddyRequested: false, redemptionId: "r1" });
    });

    it("still returns PENDING, follows and emits when the buddy request throws", async () => {
      const svc = service();
      const code = await svc.getOrCreateCode("ayse");
      buddyError = new Error("db down");
      await expect(svc.redeem("burak", code)).resolves.toEqual({ status: "PENDING" });

      expect(followCalls).toEqual([["burak", "ayse"]]);
      expect(emitted).toHaveLength(1);
      expect(emitted[0]!.payload).toMatchObject({ buddyRequested: false });
    });

    it("still returns PENDING and emits when the mutual follow throws", async () => {
      const svc = service();
      const code = await svc.getOrCreateCode("ayse");
      buddyResult = false;
      followError = new Error("db down");
      await expect(svc.redeem("burak", code)).resolves.toEqual({ status: "PENDING" });

      expect(emitted).toHaveLength(1);
      expect(emitted[0]!.payload).toMatchObject({ buddyRequested: false });
    });

    it("does nothing when the redemption insert lost the race (no row returned)", async () => {
      const svc = service();
      const code = await svc.getOrCreateCode("ayse");
      repo.createRedemption = async () => undefined as never;
      await expect(svc.redeem("burak", code)).rejects.toMatchObject({
        code: ErrorCode.INVITE_ALREADY_REDEEMED,
      });

      expect(buddyCalls).toEqual([]);
      expect(followCalls).toEqual([]);
      expect(emitted).toEqual([]);
    });

    it("does nothing for any rejected redeem", async () => {
      const svc = service();
      const code = await svc.getOrCreateCode("ayse");
      await expect(svc.redeem("ayse", code)).rejects.toBeInstanceOf(DomainError); // self
      await expect(svc.redeem("burak", "PUHU-NOPE2345")).rejects.toBeInstanceOf(DomainError); // unknown
      paid = true;
      await expect(svc.redeem("cem", code)).rejects.toBeInstanceOf(DomainError); // already paid
      setUser("dilek", { createdAt: new Date(Date.now() - 30 * DAY_MS) });
      await expect(svc.redeem("dilek", code)).rejects.toBeInstanceOf(DomainError); // window

      expect(buddyCalls).toEqual([]);
      expect(followCalls).toEqual([]);
      expect(emitted).toEqual([]);
    });
  });

  describe("redeem window", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(NOW);
    });

    it("rejects an account created 7 days + 1 second ago", async () => {
      const svc = service();
      const code = await svc.getOrCreateCode("ayse");
      setUser("burak", { createdAt: new Date(NOW.getTime() - 7 * DAY_MS - 1000) });
      await expect(svc.redeem("burak", code)).rejects.toMatchObject({
        constructor: DomainError,
        code: ErrorCode.INVITE_WINDOW_CLOSED,
        httpStatus: 409,
        details: { days: 7 },
      });
      expect(repo.redemptions).toHaveLength(0);
    });

    it("accepts an account created 7 days - 1 second ago", async () => {
      const svc = service();
      const code = await svc.getOrCreateCode("ayse");
      setUser("burak", { createdAt: new Date(NOW.getTime() - 7 * DAY_MS + 1000) });
      await expect(svc.redeem("burak", code)).resolves.toEqual({ status: "PENDING" });
    });

    it("reads the window length from config", async () => {
      const svc = service();
      const code = await svc.getOrCreateCode("ayse");
      windowDays = 3;
      setUser("burak", { createdAt: new Date(NOW.getTime() - 4 * DAY_MS) });
      await expect(svc.redeem("burak", code)).rejects.toMatchObject({
        code: ErrorCode.INVITE_WINDOW_CLOSED,
        details: { days: 3 },
      });
    });

    it("checks the window before the paid check", async () => {
      const svc = service();
      const code = await svc.getOrCreateCode("ayse");
      paid = true;
      setUser("burak", { createdAt: new Date(NOW.getTime() - 30 * DAY_MS) });
      await expect(svc.redeem("burak", code)).rejects.toMatchObject({ code: ErrorCode.INVITE_WINDOW_CLOSED });
    });
  });

  describe("coaches and unusable owners", () => {
    it("treats a code whose owner became a coach as invalid", async () => {
      const svc = service();
      const code = await svc.getOrCreateCode("ayse");
      setUser("ayse", { roles: [UserRole.STUDENT, UserRole.COACH] });
      await expect(svc.redeem("burak", code)).rejects.toMatchObject({
        code: ErrorCode.INVITE_CODE_INVALID,
        httpStatus: 404,
      });
      expect(repo.redemptions).toHaveLength(0);
    });

    it("treats a code whose owner is erased, suspended or gone as invalid", async () => {
      const svc = service();
      const code = await svc.getOrCreateCode("ayse");
      for (const patch of [
        { status: "DELETED" },
        { status: "SUSPENDED" },
        { erasureStartedAt: new Date() },
      ]) {
        setUser("ayse", patch);
        await expect(svc.redeem("burak", code)).rejects.toMatchObject({ code: ErrorCode.INVITE_CODE_INVALID });
      }
      userRows.set("ayse", null);
      await expect(svc.redeem("burak", code)).rejects.toMatchObject({ code: ErrorCode.INVITE_CODE_INVALID });
    });

    it("judges the owner before the redeemer's own checks", async () => {
      const svc = service();
      const code = await svc.getOrCreateCode("ayse");
      setUser("ayse", { roles: [UserRole.COACH] });
      // a coach redeeming a dead code still sees the code verdict, not a role verdict
      setUser("burak", { roles: [UserRole.COACH] });
      await expect(svc.redeem("burak", code)).rejects.toMatchObject({ code: ErrorCode.INVITE_CODE_INVALID });
    });

    it("rejects a redeemer who is a coach", async () => {
      const svc = service();
      const code = await svc.getOrCreateCode("ayse");
      setUser("burak", { roles: [UserRole.COACH] });
      await expect(svc.redeem("burak", code)).rejects.toMatchObject({
        constructor: DomainError,
        code: ErrorCode.INVITE_COACH_NOT_ALLOWED,
        httpStatus: 403,
      });
      expect(repo.redemptions).toHaveLength(0);
    });

    it("keeps the self-redeem verdict ahead of the redeemer role check", async () => {
      const svc = service();
      const code = await svc.getOrCreateCode("ayse");
      await expect(svc.redeem("ayse", code)).rejects.toMatchObject({ code: ErrorCode.INVITE_SELF });
    });

    it("skips the reward when the inviter became a coach before the first payment", async () => {
      const svc = service();
      await svc.redeem("burak", await svc.getOrCreateCode("ayse"));
      setUser("ayse", { roles: [UserRole.COACH] });
      await svc.onInvitedConverted(new PaymentSucceeded("burak", "sub", "pay-1", 100, new Date()));
      expect(grants).toHaveLength(0);
      expect(repo.redemptions[0]).toMatchObject({ status: "CONVERTED", rewardOutcome: "COACH_SKIPPED" });
      // nothing was granted, so a refund has nothing to take back
      await svc.onInvitedRefunded("burak", "pay-1");
      expect(reversals).toHaveLength(0);
    });

    it("skips the reward when the invited user became a coach before the first payment", async () => {
      const svc = service();
      await svc.redeem("burak", await svc.getOrCreateCode("ayse"));
      setUser("burak", { roles: [UserRole.COACH] });
      await svc.onInvitedConverted(new PaymentSucceeded("burak", "sub", "pay-1", 100, new Date()));
      expect(grants).toHaveLength(0);
      expect(repo.redemptions[0]).toMatchObject({ status: "CONVERTED", rewardOutcome: "COACH_SKIPPED" });
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

  it("settles a spent-down reward so a replay cannot debit later earnings", async () => {
    const svc = service();
    await svc.redeem("burak", await svc.getOrCreateCode("ayse"));
    await svc.onInvitedConverted(new PaymentSucceeded("burak", "sub", "pay-1", 100, new Date()));
    reverseResult = 0;
    await svc.onInvitedRefunded("burak", "pay-1");
    reverseResult = 20;
    await svc.onInvitedRefunded("burak", "pay-1");
    expect(reversals).toHaveLength(1);
    expect(repo.redemptions[0]!.rewardOutcome).toBe("REVERSED");
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

  describe("getView (the user's own card)", () => {
    const joinFriends = async (svc: InviteService, inviter: string, friends: string[]) => {
      const code = await svc.getOrCreateCode(inviter);
      for (const friend of friends) await svc.redeem(friend, code);
    };

    it("lists joined friends newest first by display name and counts only payers whose payment stands", async () => {
      const svc = service();
      await joinFriends(svc, "ayse", ["burak", "cem", "dilek"]);
      // burak paid and the reward stands, cem paid and was refunded, dilek has not paid.
      Object.assign(repo.redemptions[0]!, { status: "CONVERTED", rewardOutcome: "GRANTED" });
      Object.assign(repo.redemptions[1]!, { status: "CONVERTED", rewardOutcome: "REFUNDED" });

      const view = await svc.getView("ayse");

      expect(view.joined).toEqual([
        { displayName: "dilek-name" },
        { displayName: "cem-name" },
        { displayName: "burak-name" },
      ]);
      expect(view.convertedCount).toBe(1);
      expect(view.code).toMatch(/^PUHU-/);
      expect(view.rewardCoin).toBe(20);
      expect(view.redeemed).toBeNull();
    });

    it("counts a reversed conversion out and a granted one in", async () => {
      const svc = service();
      await joinFriends(svc, "ayse", ["burak", "cem"]);
      Object.assign(repo.redemptions[0]!, { status: "CONVERTED", rewardOutcome: "REVERSED" });
      Object.assign(repo.redemptions[1]!, { status: "CONVERTED", rewardOutcome: "GRANTED" });

      expect((await svc.getView("ayse")).convertedCount).toBe(1);
    });

    it("shows at most 20 joined friends and asks for exactly that many", async () => {
      const svc = service();
      await joinFriends(svc, "ayse", Array.from({ length: 23 }, (_, i) => `friend${i}`));

      const view = await svc.getView("ayse");

      expect(view.joined).toHaveLength(20);
      expect(view.joined[0]).toEqual({ displayName: "friend22-name" });
      expect(identityLookups.at(-1)).toHaveLength(20);
    });

    it("exposes a display name per friend and nothing else about them", async () => {
      const svc = service();
      await joinFriends(svc, "ayse", ["burak"]);

      const view = await svc.getView("ayse");

      expect(view.joined).toEqual([{ displayName: "burak-name" }]);
      expect(JSON.stringify(view)).not.toMatch(/handle|cdn/);
    });

    it("skips a friend whose identity cannot be resolved instead of showing a placeholder", async () => {
      const svc = service();
      await joinFriends(svc, "ayse", ["burak", "cem"]);
      userRows.set("burak", null);

      expect((await svc.getView("ayse")).joined).toEqual([{ displayName: "cem-name" }]);
    });

    it("has an empty card for a user who invited nobody", async () => {
      const svc = service();
      const view = await svc.getView("ayse");
      expect(view).toMatchObject({ joined: [], convertedCount: 0, redeemed: null, canRedeem: true });
    });

    it("names the inviter to an invited user, who can no longer redeem", async () => {
      const svc = service();
      await svc.redeem("burak", await svc.getOrCreateCode("ayse"));

      const view = await svc.getView("burak");

      expect(view.redeemed).toEqual({ inviterDisplayName: "ayse-name", discount: null });
      expect(view.canRedeem).toBe(false);
    });

    describe("canRedeem", () => {
      beforeEach(() => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(NOW);
      });

      it("is true for a new, unpaid user who has not redeemed", async () => {
        const svc = service();
        setUser("burak", { createdAt: new Date(NOW.getTime() - DAY_MS) });
        expect((await svc.getView("burak")).canRedeem).toBe(true);
      });

      it("is false once the user paid", async () => {
        const svc = service();
        paid = true;
        expect((await svc.getView("burak")).canRedeem).toBe(false);
      });

      it("is false once the signup window closed, and follows the configured length", async () => {
        const svc = service();
        setUser("burak", { createdAt: new Date(NOW.getTime() - 8 * DAY_MS) });
        expect((await svc.getView("burak")).canRedeem).toBe(false);
        windowDays = 10;
        expect((await svc.getView("burak")).canRedeem).toBe(true);
      });

      it("is false while the economy is switched off", async () => {
        const svc = service();
        economyEnabled = false;
        expect((await svc.getView("burak")).canRedeem).toBe(false);
      });

      it("agrees with redeem: whoever can redeem gets in and whoever cannot is turned away", async () => {
        const svc = service();
        const code = await svc.getOrCreateCode("ayse");
        setUser("late", { createdAt: new Date(NOW.getTime() - 30 * DAY_MS) });
        expect((await svc.getView("late")).canRedeem).toBe(false);
        await expect(svc.redeem("late", code)).rejects.toMatchObject({ code: ErrorCode.INVITE_WINDOW_CLOSED });
        expect((await svc.getView("burak")).canRedeem).toBe(true);
        await expect(svc.redeem("burak", code)).resolves.toEqual({ status: "PENDING" });
      });
    });

    describe("the invited user's discount", () => {
      const THIRTY_PERCENT: PromotionSummaryFake = { discountType: "PERCENT", discountValue: 30 };
      const redeemAs = async (svc: InviteService, friend = "burak") => {
        await svc.redeem(friend, await svc.getOrCreateCode("ayse"));
      };

      it("with a verified phone, tells the discount checkout will honour (no phone step)", async () => {
        const svc = service();
        await redeemAs(svc);
        inviteOffer = { promotion: THIRTY_PERCENT };

        const view = await svc.getView("burak");

        expect(view.redeemed!.discount).toEqual({ discountType: "PERCENT", discountValue: 30, phoneRequired: false });
        expect(offerLookups).toEqual(["burak"]);
      });

      it("with a verified phone, has no discount when checkout would not give one", async () => {
        const svc = service();
        await redeemAs(svc);
        inviteOffer = null; // no live INVITED promotion, already paid, trialing, phone used elsewhere...

        expect((await svc.getView("burak")).redeemed!.discount).toBeNull();
      });

      it("without a verified phone, says the discount waits for one when an INVITED promotion is live", async () => {
        const svc = service();
        await redeemAs(svc);
        phoneVerified = false;
        previewSummary = THIRTY_PERCENT;

        const view = await svc.getView("burak");

        expect(view.redeemed!.discount).toEqual({ discountType: "PERCENT", discountValue: 30, phoneRequired: true });
        expect(offerLookups).toEqual([]); // the per-user lookup is for verified phones only
      });

      it("without a verified phone and no live INVITED promotion (or no web sales), has no discount", async () => {
        const svc = service();
        await redeemAs(svc);
        phoneVerified = false;
        previewSummary = null;

        expect((await svc.getView("burak")).redeemed!.discount).toBeNull();
      });

      it("without a verified phone, promises nothing to someone who already paid", async () => {
        const svc = service();
        await redeemAs(svc);
        phoneVerified = false;
        previewSummary = THIRTY_PERCENT;
        paid = true;

        expect((await svc.getView("burak")).redeemed!.discount).toBeNull();
      });

      it("without a verified phone, promises nothing to someone checkout would refuse (open subscription)", async () => {
        const svc = service();
        await redeemAs(svc);
        phoneVerified = false;
        previewSummary = THIRTY_PERCENT;
        blockingSubscription = true;

        expect((await svc.getView("burak")).redeemed!.discount).toBeNull();
      });

      it("carries a FIXED discount as the kuruş amount checkout applies", async () => {
        const svc = service();
        await redeemAs(svc);
        inviteOffer = { promotion: { discountType: "FIXED", discountValue: 5000 } };

        expect((await svc.getView("burak")).redeemed!.discount).toEqual({
          discountType: "FIXED",
          discountValue: 5000,
          phoneRequired: false,
        });
      });

      it("shows no discount to a user who never redeemed, even with a live promotion", async () => {
        const svc = service();
        inviteOffer = { promotion: THIRTY_PERCENT };
        previewSummary = THIRTY_PERCENT;

        const view = await svc.getView("burak");

        expect(view.redeemed).toBeNull();
        expect(offerLookups).toEqual([]);
      });
    });
  });

  describe("getPreview (the public landing)", () => {
    it("answers with the inviter's display name and nothing else about them", async () => {
      const svc = service();
      const code = await svc.getOrCreateCode("ayse");
      setUser("ayse", { displayName: "Ayşe Y." });

      const preview = await svc.getPreview(code);

      expect(preview).toEqual({ inviterDisplayName: "Ayşe Y.", discount: null });
      expect(Object.keys(preview).sort()).toEqual(["discount", "inviterDisplayName"]);
    });

    it("carries the live INVITED discount without the phoneRequired flag", async () => {
      const svc = service();
      const code = await svc.getOrCreateCode("ayse");
      previewSummary = { discountType: "PERCENT", discountValue: 30 };

      expect((await svc.getPreview(code)).discount).toEqual({ discountType: "PERCENT", discountValue: 30 });
    });

    it("has no discount when no INVITED promotion is live or the web cannot sell a plan", async () => {
      const svc = service();
      const code = await svc.getOrCreateCode("ayse");
      previewSummary = null;

      expect((await svc.getPreview(code)).discount).toBeNull();
    });

    it("answers INVITE_CODE_INVALID (404) for an unknown code", async () => {
      const svc = service();
      await expect(svc.getPreview("PUHU-NOPE2345")).rejects.toMatchObject({
        constructor: DomainError,
        code: ErrorCode.INVITE_CODE_INVALID,
        httpStatus: 404,
      });
    });

    it("answers INVITE_CODE_INVALID for a coach-owned code", async () => {
      const svc = service();
      const code = await svc.getOrCreateCode("ayse");
      setUser("ayse", { roles: [UserRole.STUDENT, UserRole.COACH] });
      await expect(svc.getPreview(code)).rejects.toMatchObject({ code: ErrorCode.INVITE_CODE_INVALID, httpStatus: 404 });
    });

    it("answers INVITE_CODE_INVALID when the owner is anonymized, erasing, suspended or gone", async () => {
      const svc = service();
      const code = await svc.getOrCreateCode("ayse");
      for (const patch of [
        { status: "DELETED", displayName: "Silinmiş Kullanıcı" }, // KVKK anonymization keeps the row
        { erasureStartedAt: new Date() },
        { status: "SUSPENDED" },
      ]) {
        setUser("ayse", patch);
        await expect(svc.getPreview(code)).rejects.toMatchObject({ code: ErrorCode.INVITE_CODE_INVALID, httpStatus: 404 });
      }
      userRows.set("ayse", null);
      await expect(svc.getPreview(code)).rejects.toMatchObject({ code: ErrorCode.INVITE_CODE_INVALID });
    });

    it("answers INVITE_CODE_INVALID while the economy is switched off, so the landing shows one invalid state", async () => {
      const svc = service();
      const code = await svc.getOrCreateCode("ayse");
      economyEnabled = false;
      await expect(svc.getPreview(code)).rejects.toMatchObject({ code: ErrorCode.INVITE_CODE_INVALID, httpStatus: 404 });
    });
  });

});

describe("invite code format", () => {
  it("generateInviteCode returns PUHU- + 8 chars from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateInviteCode()).toMatch(/^PUHU-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    }
  });

  it("normalizeInviteCode trims, uppercases and maps the legacy MENTOR- prefix", () => {
    expect(normalizeInviteCode(" puhu-7kx4m9qr ")).toBe("PUHU-7KX4M9QR");
    expect(normalizeInviteCode("mentor-d650653f9bb6")).toBe("PUHU-D650653F9BB6");
  });

  it("inviteCodeSchema outputs the normalized code and rejects malformed input", () => {
    expect(inviteCodeSchema.parse(" puhu-7kx4m9qr ")).toBe("PUHU-7KX4M9QR");
    expect(inviteCodeSchema.parse("MENTOR-D650653F9BB6")).toBe("PUHU-D650653F9BB6");
    expect(inviteCodeSchema.safeParse("PUHU-7KX4").success).toBe(false);
    expect(inviteCodeSchema.safeParse("hello").success).toBe(false);
    expect(inviteCodeSchema.safeParse("PUHU-7KX4M9QRABCDE").success).toBe(false);
  });

  it("redeemInviteSchema hands the normalized code to the service", () => {
    expect(redeemInviteSchema.parse({ code: "puhu-7kx4m9qr" })).toEqual({ code: "PUHU-7KX4M9QR" });
  });
});
