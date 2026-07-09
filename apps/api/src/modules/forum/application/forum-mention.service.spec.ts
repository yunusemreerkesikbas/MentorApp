import { describe, expect, it, vi } from "vitest";
import { extractMentions } from "../domain/mention";
import { ForumMentionService } from "./forum-mention.service";

describe("extractMentions", () => {
  it("returns unique lowercase handles and ignores embedded/short ones", () => {
    expect(extractMentions("hi @Alice and @alice again")).toEqual(["alice"]);
    expect(extractMentions("mail me@nope but @yes_user works")).toEqual(["yes_user"]);
    expect(extractMentions("@ab is too short, @abc ok")).toEqual(["abc"]);
    expect(extractMentions("nothing here")).toEqual([]);
  });

  it("caps at 10 mentions", () => {
    const body = Array.from({ length: 15 }, (_, i) => `@user_${i}`).join(" ");
    expect(extractMentions(body)).toHaveLength(10);
  });
});

describe("ForumMentionService", () => {
  const makeUsers = () => ({ findIdsByUsernames: vi.fn() });
  const makeEvents = () => ({ emit: vi.fn() });

  it("emits one mention event per resolved user, excluding the actor + excluded ids", async () => {
    const users = makeUsers();
    const events = makeEvents();
    users.findIdsByUsernames.mockResolvedValue(
      new Map([
        ["alice", "uA"],
        ["bob", "uB"],
        ["self", "uActor"],
        ["mod", "uMod"],
      ]),
    );
    const svc = new ForumMentionService(users as never, events as never);
    await svc.dispatch("hey @alice @bob @self @mod", "uActor", "/topluluk/mesaj/t1", ["uMod"]);

    const recipients = events.emit.mock.calls.map((c) => (c[1] as { recipientId: string }).recipientId);
    expect(recipients.sort()).toEqual(["uA", "uB"]); // actor (self) + excluded (mod) skipped
    expect(events.emit).toHaveBeenCalledWith("forum.user.mentioned", {
      recipientId: "uA",
      actorId: "uActor",
      link: "/topluluk/mesaj/t1",
    });
  });

  it("is a no-op when the body has no mentions", async () => {
    const users = makeUsers();
    const events = makeEvents();
    const svc = new ForumMentionService(users as never, events as never);
    await svc.dispatch("plain body without tags", "uActor", "/link");
    expect(users.findIdsByUsernames).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });

  it("swallows resolution errors (never throws — must not break the post)", async () => {
    const users = makeUsers();
    const events = makeEvents();
    users.findIdsByUsernames.mockRejectedValue(new Error("db down"));
    const svc = new ForumMentionService(users as never, events as never);
    await expect(svc.dispatch("@alice", "uActor", "/link")).resolves.toBeUndefined();
    expect(events.emit).not.toHaveBeenCalled();
  });
});
