import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Logger } from "@nestjs/common";
import { UserRole } from "@mentor/types";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { InviteSignalRegistry } from "../../payments/application/invite-signal.registry";
import { InviteService } from "./invite.service";
import { InviteViewService } from "./invite-view.service";

interface Redemption {
  id: string;
  inviterUserId: string;
  invitedUserId: string;
  code: string;
  status: string;
  redeemedAt: Date;
  rewardOutcome?: string;
}

/** Only what the view and the redeem path it shares rules with touch. */
function makeRepoFake() {
  const byInviter = new Map<string, { inviterUserId: string; code: string }>();
  const byCode = new Map<string, string>();
  const redemptions: Redemption[] = [];
  return {
    redemptions,
    findByInviter: async (id: string) => byInviter.get(id),
    findByCode: async (code: string) => {
      const inviter = byCode.get(code);
      return inviter ? { inviterUserId: inviter, code } : undefined;
    },
    create: async (id: string, code: string) => {
      const row = { inviterUserId: id, code };
      byInviter.set(id, row);
      byCode.set(code, id);
      return row;
    },
    findRedemptionByInvited: async (invited: string) => redemptions.find((r) => r.invitedUserId === invited),
    createRedemption: async (inviter: string, invited: string, code: string) => {
      const r: Redemption = {
        id: `r${redemptions.length + 1}`,
        inviterUserId: inviter,
        invitedUserId: invited,
        code,
        status: "PENDING",
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
    countJoinedByInviter: async (inviter: string) => redemptions.filter((r) => r.inviterUserId === inviter).length,
    countConvertedByInviter: async (inviter: string) =>
      redemptions.filter(
        (r) =>
          r.inviterUserId === inviter &&
          r.status === "CONVERTED" &&
          !["REFUNDED", "REVERSED"].includes(r.rewardOutcome ?? ""),
      ).length,
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
const THIRTY_PERCENT: PromotionSummaryFake = { discountType: "PERCENT", discountValue: 30 };

describe("InviteViewService", () => {
  let repo: ReturnType<typeof makeRepoFake>;
  let paid: boolean;
  let windowDays: number;
  let economyEnabled: boolean;
  let phoneVerified: boolean;
  let inviteOffer: { promotion: PromotionSummaryFake | null } | null;
  let previewSummary: PromotionSummaryFake | null;
  let blockingSubscription: boolean;
  /** Set to make that lookup throw (a payments or identity read failing). */
  let previewError: Error | null;
  let offerError: Error | null;
  let phoneError: Error | null;
  let offerLookups: string[];
  let identityLookups: string[][];
  /** Per-user overrides; any other id is a fresh, active student created a day ago. `null` = no such row. */
  let userRows: Map<string, UserFake | null>;

  const defaultUser = (id: string): UserFake => ({
    id,
    displayName: `${id}-name`,
    status: "ACTIVE",
    erasureStartedAt: null,
    roles: [UserRole.STUDENT],
    createdAt: new Date(Date.now() - DAY_MS),
  });
  const setUser = (id: string, patch: Partial<UserFake>) => {
    userRows.set(id, { ...defaultUser(id), ...patch });
  };

  /** The real InviteService (so the shared rules are the production ones) behind the view service. */
  const build = () => {
    paid = false;
    windowDays = 7;
    economyEnabled = true;
    phoneVerified = true;
    inviteOffer = null;
    previewSummary = null;
    blockingSubscription = false;
    previewError = null;
    offerError = null;
    phoneError = null;
    offerLookups = [];
    identityLookups = [];
    userRows = new Map();

    const users = {
      findByIdService: async (id: string) => (userRows.has(id) ? (userRows.get(id) ?? undefined) : defaultUser(id)),
    };
    // Identity's public seam, as UsersService maps it (see users.service.spec): the anonymized row is
    // still there, with its placeholder name, and `active` is false.
    const identities = {
      isPhoneVerified: async () => {
        if (phoneError) throw phoneError;
        return phoneVerified;
      },
      listDisplayIdentities: async (ids: string[]) => {
        identityLookups.push(ids);
        return new Map(
          ids
            .filter((id) => userRows.get(id) !== null)
            .map((id) => {
              const row = userRows.get(id) ?? defaultUser(id);
              return [id, {
                userId: id,
                displayName: row.displayName,
                username: "handle",
                avatarUrl: "https://cdn/a.png",
                active: row.status === "ACTIVE" && !row.erasureStartedAt,
              }] as const;
            }),
        );
      },
    };
    const subscriptions = {
      findInviteOffer: async (userId: string) => {
        offerLookups.push(userId);
        if (offerError) throw offerError;
        return inviteOffer;
      },
      previewInviteOffer: async () => {
        if (previewError) throw previewError;
        return previewSummary;
      },
      hasCheckoutBlockingSubscription: async () => blockingSubscription,
    };
    const config = {
      get: async (key: string) =>
        key === "economy.invite.redeem_window_days" ? windowDays : key === "economy.enabled" ? economyEnabled : 20,
    };
    const paymentEvidence = { hasPaid: async () => paid };
    const invites = new InviteService(
      repo as never,
      {} as never, // economy
      { evaluateAndGrant: async () => undefined } as never, // quests
      config as never,
      paymentEvidence as never,
      users as never,
      { requestFromInvite: async () => true } as never, // buddy
      { followEachOtherSilently: async () => undefined } as never, // follows
      { emit: () => true } as never, // events
      new InviteSignalRegistry(),
    );
    const views = new InviteViewService(
      invites,
      repo as never,
      config as never,
      paymentEvidence as never,
      users as never,
      identities as never,
      subscriptions as never,
    );
    return { invites, views };
  };

  beforeEach(() => {
    repo = makeRepoFake();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getView (the user's own card)", () => {
    const joinFriends = async (invites: InviteService, inviter: string, friends: string[]) => {
      const code = await invites.getOrCreateCode(inviter);
      for (const friend of friends) await invites.redeem(friend, code);
    };

    it("lists joined friends newest first by display name and counts only payers whose payment stands", async () => {
      const { invites, views } = build();
      await joinFriends(invites, "ayse", ["burak", "cem", "dilek"]);
      // burak paid and the reward stands, cem paid and was refunded, dilek has not paid.
      Object.assign(repo.redemptions[0]!, { status: "CONVERTED", rewardOutcome: "GRANTED" });
      Object.assign(repo.redemptions[1]!, { status: "CONVERTED", rewardOutcome: "REFUNDED" });

      const view = await views.getView("ayse");

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
      const { invites, views } = build();
      await joinFriends(invites, "ayse", ["burak", "cem"]);
      Object.assign(repo.redemptions[0]!, { status: "CONVERTED", rewardOutcome: "REVERSED" });
      Object.assign(repo.redemptions[1]!, { status: "CONVERTED", rewardOutcome: "GRANTED" });

      expect((await views.getView("ayse")).convertedCount).toBe(1);
    });

    it("shows at most 20 joined friends and asks for exactly that many, but counts all of them", async () => {
      const { invites, views } = build();
      await joinFriends(invites, "ayse", Array.from({ length: 25 }, (_, i) => `friend${i}`));

      const view = await views.getView("ayse");

      expect(view.joined).toHaveLength(20);
      expect(view.joined[0]).toEqual({ displayName: "friend24-name" });
      expect(identityLookups.at(-1)).toHaveLength(20);
      // The list is a window; the number is the truth the card prints.
      expect(view.joinedCount).toBe(25);
    });

    it("counts a friend who is not a live account in joinedCount while leaving them out of the list", async () => {
      const { invites, views } = build();
      await joinFriends(invites, "ayse", ["burak", "cem", "dilek"]);
      setUser("burak", { status: "DELETED", displayName: "Silinmiş Kullanıcı" });
      userRows.set("cem", null);

      const view = await views.getView("ayse");

      // Only a number: it names nobody, so erased friends cannot leak through it.
      expect(view.joined).toEqual([{ displayName: "dilek-name" }]);
      expect(view.joinedCount).toBe(3);
    });

    it("does not count another inviter's friends", async () => {
      const { invites, views } = build();
      await joinFriends(invites, "ayse", ["burak"]);
      await joinFriends(invites, "cem", ["dilek", "elif"]);

      expect((await views.getView("ayse")).joinedCount).toBe(1);
      expect((await views.getView("cem")).joinedCount).toBe(2);
    });

    it("exposes a display name per friend and nothing else about them", async () => {
      const { invites, views } = build();
      await joinFriends(invites, "ayse", ["burak"]);

      const view = await views.getView("ayse");

      expect(view.joined).toEqual([{ displayName: "burak-name" }]);
      expect(JSON.stringify(view)).not.toMatch(/handle|cdn/);
    });

    it("skips a friend whose identity row is missing", async () => {
      const { invites, views } = build();
      await joinFriends(invites, "ayse", ["burak", "cem"]);
      userRows.set("burak", null);

      expect((await views.getView("ayse")).joined).toEqual([{ displayName: "cem-name" }]);
    });

    it("skips an erased friend: the row is still there, anonymized, with a non-active status", async () => {
      const { invites, views } = build();
      await joinFriends(invites, "ayse", ["burak", "cem", "dilek", "elif", "fatma"]);
      // What KVKK erasure leaves behind (users.repository anonymizeAccount): same row, placeholder name.
      setUser("burak", { status: "DELETED", displayName: "Silinmiş Kullanıcı" }); // self-service erasure
      setUser("cem", { status: "BANNED", displayName: "Silinmiş Kullanıcı" }); // admin anonymize
      setUser("dilek", { erasureStartedAt: new Date() }); // erasure under way
      setUser("elif", { status: "SUSPENDED" });

      const view = await views.getView("ayse");

      expect(view.joined).toEqual([{ displayName: "fatma-name" }]);
      expect(JSON.stringify(view)).not.toContain("Silinmiş");
    });

    it("has an empty card for a user who invited nobody", async () => {
      const { views } = build();
      const view = await views.getView("ayse");
      expect(view).toMatchObject({
        joined: [],
        joinedCount: 0,
        convertedCount: 0,
        redeemed: null,
        canRedeem: true,
        friendDiscount: null,
      });
    });

    describe("friendDiscount (what this user's friends would get, for the card's subtitle)", () => {
      it("carries the live INVITED summary without the phone flag", async () => {
        const { views } = build();
        previewSummary = THIRTY_PERCENT;

        expect((await views.getView("ayse")).friendDiscount).toEqual({ discountType: "PERCENT", discountValue: 30 });
      });

      it("is null when no INVITED promotion is live or the web cannot sell a plan", async () => {
        const { views } = build();
        previewSummary = null;

        expect((await views.getView("ayse")).friendDiscount).toBeNull();
      });

      it("is what friends get, whatever this user's own redemption: a redeemed user still sees it", async () => {
        const { invites, views } = build();
        await invites.redeem("burak", await invites.getOrCreateCode("ayse"));
        previewSummary = { discountType: "FIXED", discountValue: 5000 };
        inviteOffer = null; // burak himself would not get one (say his phone already took it)

        const view = await views.getView("burak");

        expect(view.friendDiscount).toEqual({ discountType: "FIXED", discountValue: 5000 });
        expect(view.redeemed!.discount).toBeNull();
      });
    });

    describe("a failed discount lookup never takes the card down", () => {
      let warn: ReturnType<typeof vi.spyOn>;
      beforeEach(() => {
        warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
      });
      afterEach(() => {
        warn.mockRestore();
      });

      it("drops friendDiscount to null and warns when the preview lookup throws", async () => {
        const { invites, views } = build();
        await invites.redeem("burak", await invites.getOrCreateCode("ayse"));
        previewError = new Error("payments down");

        const view = await views.getView("ayse");

        expect(view.friendDiscount).toBeNull();
        expect(view.joined).toEqual([{ displayName: "burak-name" }]);
        expect(view.code).toMatch(/^PUHU-/);
        expect(warn).toHaveBeenCalled();
      });

      it("drops the redeemed discount to null and warns when the per-user offer lookup throws", async () => {
        const { invites, views } = build();
        await invites.redeem("burak", await invites.getOrCreateCode("ayse"));
        offerError = new Error("payments down");

        const view = await views.getView("burak");

        expect(view.redeemed).toEqual({ inviterDisplayName: "ayse-name", discount: null });
        expect(view.canRedeem).toBe(false);
        expect(warn).toHaveBeenCalled();
      });

      it("drops the redeemed discount to null when the phone lookup behind it throws", async () => {
        const { invites, views } = build();
        await invites.redeem("burak", await invites.getOrCreateCode("ayse"));
        phoneError = new Error("identity down");

        expect((await views.getView("burak")).redeemed).toEqual({ inviterDisplayName: "ayse-name", discount: null });
        expect(warn).toHaveBeenCalled();
      });

      it("never promises the phone-step discount when the preview behind it failed", async () => {
        const { invites, views } = build();
        await invites.redeem("burak", await invites.getOrCreateCode("ayse"));
        phoneVerified = false;
        previewError = new Error("payments down");

        expect((await views.getView("burak")).redeemed!.discount).toBeNull();
      });
    });

    it("names the inviter to an invited user, who can no longer redeem", async () => {
      const { invites, views } = build();
      await invites.redeem("burak", await invites.getOrCreateCode("ayse"));

      const view = await views.getView("burak");

      expect(view.redeemed).toEqual({ inviterDisplayName: "ayse-name", discount: null });
      expect(view.canRedeem).toBe(false);
    });

    describe("canRedeem", () => {
      beforeEach(() => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(NOW);
      });

      it("is true for a new, unpaid user who has not redeemed", async () => {
        const { views } = build();
        setUser("burak", { createdAt: new Date(NOW.getTime() - DAY_MS) });
        expect((await views.getView("burak")).canRedeem).toBe(true);
      });

      it("is false once the user paid", async () => {
        const { views } = build();
        paid = true;
        expect((await views.getView("burak")).canRedeem).toBe(false);
      });

      it("is false once the signup window closed, and follows the configured length", async () => {
        const { views } = build();
        setUser("burak", { createdAt: new Date(NOW.getTime() - 8 * DAY_MS) });
        expect((await views.getView("burak")).canRedeem).toBe(false);
        windowDays = 10;
        expect((await views.getView("burak")).canRedeem).toBe(true);
      });

      // No "economy switched off" case: the only caller (GET /economy/invite) 404s ECONOMY_DISABLED
      // before the view is built, so the view does not read the flag again.

      it("agrees with redeem: whoever can redeem gets in and whoever cannot is turned away", async () => {
        const { invites, views } = build();
        const code = await invites.getOrCreateCode("ayse");
        setUser("late", { createdAt: new Date(NOW.getTime() - 30 * DAY_MS) });
        expect((await views.getView("late")).canRedeem).toBe(false);
        await expect(invites.redeem("late", code)).rejects.toMatchObject({ code: ErrorCode.INVITE_WINDOW_CLOSED });
        expect((await views.getView("burak")).canRedeem).toBe(true);
        await expect(invites.redeem("burak", code)).resolves.toEqual({ status: "PENDING" });
      });
    });

    describe("the invited user's discount", () => {
      const redeemAs = async (invites: InviteService, friend = "burak") => {
        await invites.redeem(friend, await invites.getOrCreateCode("ayse"));
      };

      it("with a verified phone, tells the discount checkout will honour (no phone step)", async () => {
        const { invites, views } = build();
        await redeemAs(invites);
        inviteOffer = { promotion: THIRTY_PERCENT };

        const view = await views.getView("burak");

        expect(view.redeemed!.discount).toEqual({ discountType: "PERCENT", discountValue: 30, phoneRequired: false });
        expect(offerLookups).toEqual(["burak"]);
      });

      it("with a verified phone, has no discount when checkout would not give one", async () => {
        const { invites, views } = build();
        await redeemAs(invites);
        inviteOffer = null; // no live INVITED promotion, already paid, trialing, phone used elsewhere...

        expect((await views.getView("burak")).redeemed!.discount).toBeNull();
      });

      it("without a verified phone, says the discount waits for one when an INVITED promotion is live", async () => {
        const { invites, views } = build();
        await redeemAs(invites);
        phoneVerified = false;
        previewSummary = THIRTY_PERCENT;

        const view = await views.getView("burak");

        expect(view.redeemed!.discount).toEqual({ discountType: "PERCENT", discountValue: 30, phoneRequired: true });
        expect(offerLookups).toEqual([]); // the per-user lookup is for verified phones only
      });

      it("without a verified phone and no live INVITED promotion (or no web sales), has no discount", async () => {
        const { invites, views } = build();
        await redeemAs(invites);
        phoneVerified = false;
        previewSummary = null;

        expect((await views.getView("burak")).redeemed!.discount).toBeNull();
      });

      it("without a verified phone, promises nothing to someone who already paid", async () => {
        const { invites, views } = build();
        await redeemAs(invites);
        phoneVerified = false;
        previewSummary = THIRTY_PERCENT;
        paid = true;

        expect((await views.getView("burak")).redeemed!.discount).toBeNull();
      });

      it("without a verified phone, promises nothing to someone checkout would refuse (open subscription)", async () => {
        const { invites, views } = build();
        await redeemAs(invites);
        phoneVerified = false;
        previewSummary = THIRTY_PERCENT;
        blockingSubscription = true;

        expect((await views.getView("burak")).redeemed!.discount).toBeNull();
      });

      it("carries a FIXED discount as the kuruş amount checkout applies", async () => {
        const { invites, views } = build();
        await redeemAs(invites);
        inviteOffer = { promotion: { discountType: "FIXED", discountValue: 5000 } };

        expect((await views.getView("burak")).redeemed!.discount).toEqual({
          discountType: "FIXED",
          discountValue: 5000,
          phoneRequired: false,
        });
      });

      it("shows no discount to a user who never redeemed, even with a live promotion", async () => {
        const { views } = build();
        inviteOffer = { promotion: THIRTY_PERCENT };
        previewSummary = THIRTY_PERCENT;

        const view = await views.getView("burak");

        expect(view.redeemed).toBeNull();
        expect(offerLookups).toEqual([]);
      });
    });
  });

  describe("getPreview (the public landing)", () => {
    it("answers with the inviter's display name and nothing else about them", async () => {
      const { invites, views } = build();
      const code = await invites.getOrCreateCode("ayse");
      setUser("ayse", { displayName: "Ayşe Y." });

      const preview = await views.getPreview(code);

      expect(preview).toEqual({ inviterDisplayName: "Ayşe Y.", discount: null });
      expect(Object.keys(preview).sort()).toEqual(["discount", "inviterDisplayName"]);
    });

    it("carries the live INVITED discount without the phoneRequired flag", async () => {
      const { invites, views } = build();
      const code = await invites.getOrCreateCode("ayse");
      previewSummary = THIRTY_PERCENT;

      expect((await views.getPreview(code)).discount).toEqual({ discountType: "PERCENT", discountValue: 30 });
    });

    it("has no discount when no INVITED promotion is live or the web cannot sell a plan", async () => {
      const { invites, views } = build();
      const code = await invites.getOrCreateCode("ayse");
      previewSummary = null;

      expect((await views.getPreview(code)).discount).toBeNull();
    });

    it("answers INVITE_CODE_INVALID (404) for an unknown code", async () => {
      const { views } = build();
      await expect(views.getPreview("PUHU-NOPE2345")).rejects.toMatchObject({
        constructor: DomainError,
        code: ErrorCode.INVITE_CODE_INVALID,
        httpStatus: 404,
      });
    });

    it("answers INVITE_CODE_INVALID for a coach-owned code", async () => {
      const { invites, views } = build();
      const code = await invites.getOrCreateCode("ayse");
      setUser("ayse", { roles: [UserRole.STUDENT, UserRole.COACH] });
      await expect(views.getPreview(code)).rejects.toMatchObject({ code: ErrorCode.INVITE_CODE_INVALID, httpStatus: 404 });
    });

    it("answers INVITE_CODE_INVALID when the owner is anonymized, erasing, suspended or gone", async () => {
      const { invites, views } = build();
      const code = await invites.getOrCreateCode("ayse");
      for (const patch of [
        { status: "DELETED", displayName: "Silinmiş Kullanıcı" }, // KVKK anonymization keeps the row
        { erasureStartedAt: new Date() },
        { status: "SUSPENDED" },
      ]) {
        setUser("ayse", patch);
        await expect(views.getPreview(code)).rejects.toMatchObject({ code: ErrorCode.INVITE_CODE_INVALID, httpStatus: 404 });
      }
      userRows.set("ayse", null);
      await expect(views.getPreview(code)).rejects.toMatchObject({ code: ErrorCode.INVITE_CODE_INVALID });
    });

    it("answers INVITE_CODE_INVALID while the economy is switched off, so the landing shows one invalid state", async () => {
      const { invites, views } = build();
      const code = await invites.getOrCreateCode("ayse");
      economyEnabled = false;
      await expect(views.getPreview(code)).rejects.toMatchObject({ code: ErrorCode.INVITE_CODE_INVALID, httpStatus: 404 });
    });
  });
});
