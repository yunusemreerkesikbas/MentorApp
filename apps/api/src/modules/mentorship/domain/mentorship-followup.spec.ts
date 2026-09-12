import { describe, expect, it } from "vitest";
import { followupNotificationIsCurrent } from "./mentorship-followup";

const openShared = {
  status: "OPEN" as const,
  sharedDecision: "Paragrafa devam",
  response: "PENDING" as const,
  responseVersion: null,
};

describe("followupNotificationIsCurrent", () => {
  it("keeps a shared event live after an unrelated version bump", () => {
    expect(followupNotificationIsCurrent("shared", 1, openShared)).toBe(true);
    expect(
      followupNotificationIsCurrent("shared", 1, {
        ...openShared,
        responseVersion: null,
      }),
    ).toBe(true);
  });

  it("drops a shared event once the student has answered or the record closed", () => {
    expect(
      followupNotificationIsCurrent("shared", 1, { ...openShared, response: "ACCEPTED" }),
    ).toBe(false);
    expect(
      followupNotificationIsCurrent("shared", 1, { ...openShared, status: "COMPLETED" }),
    ).toBe(false);
    expect(
      followupNotificationIsCurrent("shared", 1, { ...openShared, sharedDecision: null }),
    ).toBe(false);
  });

  it("matches a response event to responseVersion, not the mutable row version", () => {
    const responded = {
      status: "OPEN" as const,
      sharedDecision: "Paragrafa devam",
      response: "CHANGE_REQUESTED" as const,
      responseVersion: 4,
    };
    expect(followupNotificationIsCurrent("responded", 4, responded)).toBe(true);
    expect(followupNotificationIsCurrent("responded", 3, responded)).toBe(false);
    expect(
      followupNotificationIsCurrent("responded", 4, { ...responded, status: "CANCELLED" }),
    ).toBe(false);
  });
});
