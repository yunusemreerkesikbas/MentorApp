import { describe, expect, it } from "vitest";

import { questionStatus } from "./question-status";

describe("questionStatus", () => {
  it("is waiting while nobody has answered", () => {
    expect(questionStatus({ commentCount: 0, acceptedPostId: null })).toEqual({ kind: "waiting" });
  });

  it("counts answers until the asker accepts one", () => {
    expect(questionStatus({ commentCount: 3, acceptedPostId: null })).toEqual({
      kind: "answered",
      answers: 3,
    });
  });

  it("is solved once an answer is accepted, whatever the count says", () => {
    expect(questionStatus({ commentCount: 12, acceptedPostId: "post-1" })).toEqual({
      kind: "solved",
      answers: 12,
    });
    expect(questionStatus({ commentCount: 0, acceptedPostId: "post-1" })).toEqual({
      kind: "solved",
      answers: 0,
    });
  });
});
