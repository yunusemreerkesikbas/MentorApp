import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForumEventsListener } from "./forum-events.listener";

const makeNotifications = () => ({ createFromTemplate: vi.fn().mockResolvedValue(undefined) });

describe("ForumEventsListener", () => {
  let notifications: ReturnType<typeof makeNotifications>;
  let listener: ForumEventsListener;

  beforeEach(() => {
    notifications = makeNotifications();
    listener = new ForumEventsListener(notifications as never);
  });

  it("notifies the asker when their question is answered", async () => {
    await listener.onQuestionAnswered({ threadId: "t1", recipientId: "asker", actorId: "answerer" });
    expect(notifications.createFromTemplate).toHaveBeenCalledWith(
      "asker",
      "FORUM",
      expect.any(String),
      "/community/question/t1",
    );
  });

  it("notifies the thread author on a new comment", async () => {
    await listener.onThreadCommented({ threadId: "t1", recipientId: "author", actorId: "commenter" });
    expect(notifications.createFromTemplate).toHaveBeenCalledWith(
      "author",
      "FORUM",
      expect.any(String),
      "/community/message/t1",
    );
  });

  it("notifies the parent comment author on a reply", async () => {
    await listener.onCommentReplied({ parentPostId: "p1", recipientId: "author", actorId: "replier" });
    expect(notifications.createFromTemplate).toHaveBeenCalledWith(
      "author",
      "FORUM",
      expect.any(String),
      "/community/comment/p1",
    );
  });

  it("notifies the answerer when their answer is accepted", async () => {
    await listener.onAnswerAccepted({
      threadId: "t1",
      postId: "p1",
      answerAuthorId: "answerer",
      askerId: "asker",
    });
    expect(notifications.createFromTemplate).toHaveBeenCalledWith(
      "answerer",
      "FORUM",
      expect.any(String),
      "/community/question/t1",
    );
  });

  it("notifies a mentioned user with the carried link", async () => {
    await listener.onUserMentioned({ recipientId: "u2", actorId: "u1", link: "/community/message/t1" });
    expect(notifications.createFromTemplate).toHaveBeenCalledWith(
      "u2",
      "FORUM",
      expect.any(String),
      "/community/message/t1",
    );
  });

  it("skips self-notifications (acting on your own content)", async () => {
    await listener.onThreadCommented({ threadId: "t1", recipientId: "u1", actorId: "u1" });
    await listener.onQuestionAnswered({ threadId: "t1", recipientId: "u1", actorId: "u1" });
    expect(notifications.createFromTemplate).not.toHaveBeenCalled();
  });

  it("fans a join request out to all moderators, skipping the requester", async () => {
    await listener.onMemberRequested({
      zoneId: "z1",
      slug: "kpss",
      requesterId: "mod2", // a mod requesting is not notified about their own request
      moderatorIds: ["mod1", "mod2", "mod3"],
    });
    const recipients = notifications.createFromTemplate.mock.calls.map((c) => c[0]);
    expect(recipients).toEqual(["mod1", "mod3"]);
    expect(notifications.createFromTemplate).toHaveBeenCalledWith(
      "mod1",
      "FORUM",
      expect.any(String),
      "/community/kpss/management",
    );
  });
});
