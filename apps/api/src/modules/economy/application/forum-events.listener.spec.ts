import { beforeEach, describe, expect, it, vi } from "vitest";
import { Currency } from "@mentor/types";
import { ForumEventsListener } from "./forum-events.listener";

const economy = { grant: vi.fn().mockResolvedValue({}) };
const config = { get: vi.fn() };
const event = { threadId: "q1", postId: "a1", answerAuthorId: "answerer", askerId: "asker" };

const listener = () => new ForumEventsListener(economy as never, config as never);

describe("ForumEventsListener", () => {
  beforeEach(() => {
    economy.grant.mockClear();
    config.get.mockReset();
  });

  it("grants XP to the answerer (idempotent on postId) when economy is enabled", async () => {
    config.get.mockImplementation((k: string) =>
      Promise.resolve(k === "economy.enabled" ? true : 25),
    );
    await listener().onAnswerAccepted(event);
    expect(economy.grant).toHaveBeenCalledWith(
      "answerer",
      Currency.XP,
      25,
      expect.objectContaining({ refType: "forum.answer.accepted", refId: "a1" }),
    );
  });

  it("no-ops when economy is disabled", async () => {
    config.get.mockResolvedValue(false);
    await listener().onAnswerAccepted(event);
    expect(economy.grant).not.toHaveBeenCalled();
  });

  it("no-ops when the configured amount is zero", async () => {
    config.get.mockImplementation((k: string) =>
      Promise.resolve(k === "economy.enabled" ? true : 0),
    );
    await listener().onAnswerAccepted(event);
    expect(economy.grant).not.toHaveBeenCalled();
  });
});
