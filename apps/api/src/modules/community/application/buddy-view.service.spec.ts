import { describe, expect, it, vi } from "vitest";
import { BUDDY_NUDGE_COOLDOWN_MS } from "../../identity/application/buddy.service";
import { BuddyViewService } from "./buddy-view.service";

const pairRow = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "pair1",
  requesterId: "me",
  addresseeId: "uB",
  status: "ACTIVE",
  acceptedAt: new Date(),
  requesterLastNudgeAt: null,
  addresseeLastNudgeAt: null,
  createdAt: new Date("2026-07-17T08:00:00Z"),
  otherUserId: "uB",
  otherDisplayName: "Bob",
  otherUsername: "bob",
  otherAvatarStorageKey: "avatars/bob.png",
  ...over,
});

const make = (opts: {
  active?: unknown;
  outgoing?: unknown;
  incoming?: unknown[];
  focusMinutes?: number;
  streak?: number;
  coWorkers?: unknown[];
  eligible?: string[];
  profiles?: unknown[];
  studyingNow?: boolean;
} = {}) => {
  const buddy = {
    getActivePair: vi.fn(async () => opts.active),
    getOutgoingPending: vi.fn(async () => opts.outgoing),
    listIncomingPending: vi.fn(async () => opts.incoming ?? []),
    filterEligibleCandidates: vi.fn(
      async (_viewer: string, ids: string[]) => opts.eligible ?? ids,
    ),
  };
  const sessions = {
    getTodayFocusMinutes: vi.fn(async () => opts.focusMinutes ?? 0),
    isStudyingNow: vi.fn(async () => opts.studyingNow ?? false),
    listRecentCoWorkers: vi.fn(async () => opts.coWorkers ?? []),
  };
  const streak = { getCurrentStreak: vi.fn(async () => opts.streak ?? 0) };
  const storage = { getPublicUrl: (k: string) => `https://cdn/${k}` };
  const users = { listPublicByIds: vi.fn(async () => opts.profiles ?? []) };
  const svc = new BuddyViewService(
    buddy as never,
    sessions as never,
    streak as never,
    users as never,
    storage as never,
  );
  return { svc, buddy, sessions, streak, users };
};

describe("BuddyViewService.getView", () => {
  it("composes the partner's effort fields only (minutes + streak, avatar URL resolved)", async () => {
    const { svc, sessions, streak } = make({
      active: pairRow(),
      focusMinutes: 45,
      streak: 7,
      studyingNow: true,
    });

    const view = await svc.getView("me");

    expect(sessions.getTodayFocusMinutes).toHaveBeenCalledWith("uB");
    expect(sessions.isStudyingNow).toHaveBeenCalledWith("uB");
    expect(streak.getCurrentStreak).toHaveBeenCalledWith("uB");
    expect(view.active).toEqual({
      pairId: "pair1",
      partner: {
        userId: "uB",
        displayName: "Bob",
        username: "bob",
        avatarUrl: "https://cdn/avatars/bob.png",
      },
      focusMinutesToday: 45,
      currentStreak: 7,
      partnerStudyingNow: true,
      canNudge: true,
      nudgeCooldownEndsAt: null,
    });
    expect(view.outgoing).toBeNull();
    expect(view.incoming).toEqual([]);
  });

  it("reports the caller-side nudge cooldown", async () => {
    const nudgedAt = new Date(Date.now() - BUDDY_NUDGE_COOLDOWN_MS / 2);
    const { svc } = make({ active: pairRow({ requesterLastNudgeAt: nudgedAt }) });

    const view = await svc.getView("me");

    expect(view.active?.canNudge).toBe(false);
    expect(view.active?.nudgeCooldownEndsAt).toBe(
      new Date(nudgedAt.getTime() + BUDDY_NUDGE_COOLDOWN_MS).toISOString(),
    );
  });

  it("maps outgoing and incoming requests when there is no active pairing", async () => {
    const { svc, sessions } = make({
      outgoing: pairRow({ status: "PENDING" }),
      incoming: [pairRow({ id: "p2", status: "PENDING", otherUserId: "uC" })],
    });

    const view = await svc.getView("me");

    expect(view.active).toBeNull();
    expect(view.outgoing?.id).toBe("pair1");
    expect(view.incoming[0]?.id).toBe("p2");
    expect(view.incoming[0]?.partner.userId).toBe("uC");
    expect(sessions.getTodayFocusMinutes).not.toHaveBeenCalled(); // no partner → no coaching reads
  });
});

describe("BuddyViewService.getSuggestions", () => {
  const coWorker = (userId: string, sessionsTogether: number, day: string) => ({
    userId,
    sessionsTogether,
    lastTogetherAt: new Date(day),
  });
  const profile = (userId: string, displayName: string, avatarStorageKey: string | null) => ({
    userId,
    displayName,
    username: displayName.toLowerCase(),
    avatarStorageKey,
  });

  it("suggests people the viewer has co-worked with, most-shared first", async () => {
    const { svc, sessions } = make({
      coWorkers: [
        coWorker("uB", 4, "2026-08-20T10:00:00Z"),
        coWorker("uC", 1, "2026-08-19T10:00:00Z"),
      ],
      profiles: [profile("uC", "Cem", null), profile("uB", "Bob", "avatars/bob.png")],
    });

    const result = await svc.getSuggestions("me", 3);

    // Ranking comes from coaching; the profile lookup must not reorder it.
    expect(result).toEqual([
      {
        userId: "uB",
        displayName: "Bob",
        username: "bob",
        avatarUrl: "https://cdn/avatars/bob.png",
        sessionsTogether: 4,
        lastTogetherAt: "2026-08-20T10:00:00.000Z",
      },
      {
        userId: "uC",
        displayName: "Cem",
        username: "cem",
        avatarUrl: null,
        sessionsTogether: 1,
        lastTogetherAt: "2026-08-19T10:00:00.000Z",
      },
    ]);
    // Over-fetched so eligibility exclusions cannot empty the list.
    expect(sessions.listRecentCoWorkers).toHaveBeenCalledWith("me", 60, 12);
  });

  it("drops candidates identity rules out, then caps at the limit", async () => {
    const { svc } = make({
      coWorkers: [
        coWorker("uB", 3, "2026-08-20T10:00:00Z"),
        coWorker("uC", 2, "2026-08-20T10:00:00Z"),
        coWorker("uD", 1, "2026-08-20T10:00:00Z"),
      ],
      eligible: ["uC", "uD"],
      profiles: [profile("uC", "Cem", null), profile("uD", "Deniz", null)],
    });

    expect((await svc.getSuggestions("me", 1)).map((r) => r.userId)).toEqual(["uC"]);
  });

  it("returns nothing when the viewer has never shared a table", async () => {
    const { svc, buddy } = make({ coWorkers: [] });
    expect(await svc.getSuggestions("me", 3)).toEqual([]);
    // No point asking identity about an empty list.
    expect(buddy.filterEligibleCandidates).not.toHaveBeenCalled();
  });

  it("skips a candidate whose profile disappeared (banned meanwhile)", async () => {
    const { svc } = make({
      coWorkers: [coWorker("uB", 2, "2026-08-20T10:00:00Z"), coWorker("uC", 1, "2026-08-20T10:00:00Z")],
      profiles: [profile("uC", "Cem", null)],
    });
    expect((await svc.getSuggestions("me", 3)).map((r) => r.userId)).toEqual(["uC"]);
  });
});
