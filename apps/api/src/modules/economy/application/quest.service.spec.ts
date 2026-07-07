import { describe, expect, it, vi } from "vitest";
import { QuestService } from "./quest.service";

function service() {
  const config = {
    get: vi.fn(async (key: string) => {
      if (key === "economy.enabled") return true;
      if (key === "economy.quest.onboarding_reward_coin") return 10;
      return 0;
    }),
  };

  return new QuestService(
    { getMe: vi.fn(async () => ({ examType: null, emailVerified: false })) } as never,
    { getView: vi.fn(async () => ({ subscription: null })) } as never,
    { findRedemptionByInvited: vi.fn(async () => null) } as never,
    { grant: vi.fn() } as never,
    { listForUser: vi.fn(async () => []), markCompleted: vi.fn() } as never,
    config as never,
  );
}

describe("QuestService", () => {
  it("returns configured coin reward with each quest", async () => {
    const quests = await service().getUserProgress("user-1");

    expect(quests).toHaveLength(4);
    expect(quests[0]).toMatchObject({
      id: "onboarding.profile-setup",
      completed: false,
      rewardCoin: 10,
    });
  });
});
