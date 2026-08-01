import { describe, expect, it, vi } from "vitest";
import { CommunityCoachPlanTaskService } from "./community-coach-plan-task.service";

const USER = "11111111-1111-4111-8111-111111111111";
const CONVERSATION = "22222222-2222-4222-8222-222222222222";
const THREAD = "33333333-3333-4333-8333-333333333333";

function build(options?: { owned?: boolean; communityOrigin?: boolean; bridge?: boolean }) {
  const conversations = {
    isOwned: vi.fn().mockResolvedValue(options?.owned ?? true),
    getOrigin: vi.fn().mockResolvedValue(
      options?.communityOrigin === false
        ? null
        : {
            type: "COMMUNITY_THREAD",
            refId: THREAD,
            meta: { intent: "PLAN", tagSlug: "planlama" },
          },
    ),
  };
  const forum = {
    getBridge: options?.bridge === false
      ? vi.fn().mockRejectedValue(new Error("not found"))
      : vi.fn().mockResolvedValue({
          threadId: THREAD,
          intent: "PLAN",
          tag: { slug: "planlama", name: "Planlama" },
          zone: { slug: "genel", title: "Genel", type: "QA" },
          threadTitle: "Planımı nasıl sürdürebilirim?",
        }),
  };
  const plans = {
    createFromCommunityCoach: vi.fn().mockResolvedValue({
      id: "44444444-4444-4444-8444-444444444444",
      title: "Bugün 20 soru",
      origin: {
        type: "COMMUNITY_COACH",
        conversationId: CONVERSATION,
        threadId: THREAD,
        intent: "PLAN",
        zoneType: "QA",
      },
    }),
  };
  return {
    service: new CommunityCoachPlanTaskService(
      conversations as never,
      forum as never,
      plans as never,
    ),
    conversations,
    forum,
    plans,
  };
}

describe("CommunityCoachPlanTaskService", () => {
  it("revalidates the owned community source and persists only server-resolved origin", async () => {
    const { service, forum, plans } = build();

    const result = await service.create(USER, CONVERSATION, {
      title: "Bugün 20 soru",
      subject: "Türkçe",
    });

    expect(forum.getBridge).toHaveBeenCalledWith(USER, THREAD);
    expect(plans.createFromCommunityCoach).toHaveBeenCalledWith(
      USER,
      { title: "Bugün 20 soru", subject: "Türkçe" },
      {
        conversationId: CONVERSATION,
        threadId: THREAD,
        intent: "PLAN",
        zoneType: "QA",
      },
    );
    expect(result.origin).toMatchObject({ type: "COMMUNITY_COACH", threadId: THREAD });
  });

  it("hides conversations that are not owned by the caller", async () => {
    const { service, conversations, forum, plans } = build({ owned: false });

    await expect(
      service.create(USER, CONVERSATION, { title: "Bugün 20 soru" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", httpStatus: 404 });
    expect(conversations.getOrigin).not.toHaveBeenCalled();
    expect(forum.getBridge).not.toHaveBeenCalled();
    expect(plans.createFromCommunityCoach).not.toHaveBeenCalled();
  });

  it("rejects legacy or non-community coach conversations", async () => {
    const { service, forum, plans } = build({ communityOrigin: false });

    await expect(
      service.create(USER, CONVERSATION, { title: "Bugün 20 soru" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", httpStatus: 404 });
    expect(forum.getBridge).not.toHaveBeenCalled();
    expect(plans.createFromCommunityCoach).not.toHaveBeenCalled();
  });

  it("does not create a task when the forum source is no longer eligible", async () => {
    const { service, plans } = build({ bridge: false });

    await expect(
      service.create(USER, CONVERSATION, { title: "Bugün 20 soru" }),
    ).rejects.toBeTruthy();
    expect(plans.createFromCommunityCoach).not.toHaveBeenCalled();
  });
});
