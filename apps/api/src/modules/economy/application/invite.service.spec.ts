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
    const users = {
      findByIdService: async (id: string) => (userRows.has(id) ? (userRows.get(id) ?? undefined) : defaultUser(id)),
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
      { isEnabled: async () => true, assertEnabled: async () => undefined } as never,
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

    it("answers null for a coach, so a redeem made before becoming one never discounts", async () => {
      const svc = service();
      await svc.redeem("burak", await svc.getOrCreateCode("ayse"));
      svc.onModuleInit();
      setUser("burak", { roles: [UserRole.STUDENT, UserRole.COACH] });

      expect(await signals.invitedAt("burak")).toBeNull();
    });

    it("answers null when the user row is gone", async () => {
      const svc = service();
      await svc.redeem("burak", await svc.getOrCreateCode("ayse"));
      svc.onModuleInit();
      userRows.set("burak", null);

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

  describe("an inviter who is gone by the first payment", () => {
    const convert = async (patch: Partial<UserFake> | null) => {
      const svc = service();
      await svc.redeem("burak", await svc.getOrCreateCode("ayse"));
      if (patch === null) userRows.set("ayse", null);
      else setUser("ayse", patch);
      await svc.onInvitedConverted(new PaymentSucceeded("burak", "sub", "pay-1", 100, new Date()));
      return svc;
    };

    for (const [label, patch] of [
      ["erased by the user (DELETED, anonymized row)", { status: "DELETED", displayName: "Silinmiş Kullanıcı" }],
      ["anonymized by an admin (BANNED)", { status: "BANNED", displayName: "Silinmiş Kullanıcı" }],
      ["mid-erasure", { erasureStartedAt: new Date() }],
      ["without a row", null],
    ] as const) {
      it(`earns no Coin when ${label}: outcome INVITER_GONE`, async () => {
        const svc = await convert(patch);
        expect(grants).toHaveLength(0);
        expect(repo.redemptions[0]).toMatchObject({ status: "CONVERTED", rewardOutcome: "INVITER_GONE" });
        // nothing was granted, so a refund has nothing to take back
        await svc.onInvitedRefunded("burak", "pay-1");
        expect(reversals).toHaveLength(0);
      });
    }

    it("still earns the Coin while merely SUSPENDED (a suspension ends, the account is still theirs)", async () => {
      await convert({ status: "SUSPENDED" });
      expect(grants).toEqual([{ userId: "ayse", unit: Currency.COIN, amount: 20, reason: "invite.converted" }]);
      expect(repo.redemptions[0]).toMatchObject({ rewardOutcome: "GRANTED" });
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
