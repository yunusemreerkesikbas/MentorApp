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
  suggestions?: unknown[];
} = {}) => {
  const buddy = {
    getActivePair: vi.fn(async () => opts.active),
    getOutgoingPending: vi.fn(async () => opts.outgoing),
    listIncomingPending: vi.fn(async () => opts.incoming ?? []),
    getSuggestionCandidates: vi.fn(async () => opts.suggestions ?? []),
  };
  const sessions = { getTodayFocusMinutes: vi.fn(async () => opts.focusMinutes ?? 0) };
  const streak = { getCurrentStreak: vi.fn(async () => opts.streak ?? 0) };
  const storage = { getPublicUrl: (k: string) => `https://cdn/${k}` };
  const svc = new BuddyViewService(
    buddy as never,
    sessions as never,
    streak as never,
    storage as never,
  );
  return { svc, buddy, sessions, streak };
};

describe("BuddyViewService.getView", () => {
  it("composes the partner's effort fields only (minutes + streak, avatar URL resolved)", async () => {
    const { svc, sessions, streak } = make({
      active: pairRow(),
      focusMinutes: 45,
      streak: 7,
    });

    const view = await svc.getView("me");

    expect(sessions.getTodayFocusMinutes).toHaveBeenCalledWith("uB");
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
  it("maps cohort candidates to public-safe refs with resolved avatar URLs", async () => {
    const { svc } = make({
      suggestions: [
        { userId: "uB", displayName: "Bob", username: "bob", avatarStorageKey: "avatars/bob.png" },
        { userId: "uC", displayName: "Cem", username: "cem", avatarStorageKey: null },
      ],
    });

    const result = await svc.getSuggestions("me", 5);

    expect(result).toEqual([
      { userId: "uB", displayName: "Bob", username: "bob", avatarUrl: "https://cdn/avatars/bob.png" },
      { userId: "uC", displayName: "Cem", username: "cem", avatarUrl: null },
    ]);
  });
});
