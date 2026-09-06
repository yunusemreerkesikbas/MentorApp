import { describe, expect, it } from "vitest";
import { MentorshipApplicationStatus } from "@mentor/types";
import { canApply } from "./coach-application";

const NOW = new Date("2026-09-10T09:00:00.000Z");
const REAPPLY_AFTER = 30;

const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

const gate = (
  status: keyof typeof MentorshipApplicationStatus,
  reviewedAt: Date | null,
) => canApply({ status: MentorshipApplicationStatus[status], reviewedAt }, REAPPLY_AFTER, NOW);

describe("canApply", () => {
  it("lets a first-time applicant through", () => {
    expect(canApply(null, REAPPLY_AFTER, NOW)).toEqual({ allowed: true });
  });

  it("refuses while a decision is still outstanding", () => {
    expect(gate("PENDING", null)).toEqual({ reason: "PENDING" });
  });

  // The approved row IS the profile; a second application would overwrite a vetted record with
  // unvetted claims. Editing the profile is a different door and never touches the verdict.
  it("refuses an approved coach outright, however old the decision", () => {
    expect(gate("APPROVED", daysAgo(400))).toEqual({ reason: "ALREADY_COACH" });
  });

  describe("after a rejection", () => {
    it("still refuses one day short of the wait", () => {
      expect(gate("REJECTED", daysAgo(29))).toEqual({ reason: "TOO_SOON", days: 1 });
    });

    it("opens exactly at the wait", () => {
      expect(gate("REJECTED", daysAgo(30))).toEqual({ allowed: true });
    });

    it("stays open afterwards", () => {
      expect(gate("REJECTED", daysAgo(31))).toEqual({ allowed: true });
    });

    it("reports the days LEFT, not the days elapsed", () => {
      // The screen renders this number directly; elapsed would read as an encouragement.
      expect(gate("REJECTED", daysAgo(2))).toEqual({ reason: "TOO_SOON", days: 28 });
    });

    it("lets someone through rather than trapping them on an undated rejection", () => {
      expect(gate("REJECTED", null)).toEqual({ allowed: true });
    });
  });
});
