import { describe, expect, it } from "vitest";
import { APP_AVAILABILITY_KEYS, type AppAvailabilityDto } from "@mentor/types";
import { availableAppDestination, blockedAppFeature } from "./app-feature-routes";

const closed = Object.fromEntries(APP_AVAILABILITY_KEYS.map(key => [key, false])) as AppAvailabilityDto;
const viewer = { username: "self", roles: ["STUDENT"] };

describe("closed app feature presentation", () => {
  it.each([
    ["/coach", "aiCoach"], ["/koc", "aiCoach"], ["/en/coach", "aiCoach"],
    ["/community", "forum"], ["/topluluk/akis", "forum"], ["/en/community/feed", "forum"],
    ["/community/member/other", "social"], ["/topluluk/uye/other", "social"],
    ["/study-session/rooms/known", "studyRooms"], ["/seans/masalar/known", "studyRooms"],
    ["/my-coach", "humanCoaching"], ["/kocum", "humanCoaching"],
    ["/coach-invitation", "humanCoaching"], ["/students", "humanCoaching"],
    ["/en/coaching/students/known", "humanCoaching"], ["/kocluk/known", "humanCoaching"],
    ["/coach-application", "coachRegistration"], ["/koc-ol", "coachRegistration"],
    ["/invite/code", "invites"], ["/davet/code", "invites"],
  ])("blocks %s under its actual capability", (path, feature) => {
    expect(blockedAppFeature(path!, viewer, closed)).toBe(feature);
  });

  it.each(["/panel", "/plan", "/seans", "/analiz", "/defterlerim", "/ayarlar", "/abonelik",
    "/community/member/self", "/en/community/member/self/achievements", "/topluluk/uye/self"]) (
    "preserves personal work and account access at %s even when availability cannot load", (path) => {
      expect(blockedAppFeature(path, viewer, closed)).toBeNull();
      expect(blockedAppFeature(path, viewer, null)).toBeNull();
    },
  );

  it("does not turn a username prefix or missing session into owner access", () => {
    expect(blockedAppFeature("/community/member/self-other", viewer, closed)).toBe("social");
    expect(blockedAppFeature("/community/member/self", null, closed)).toBe("social");
  });

  it("does not return a stale closed invitation destination", () => {
    expect(availableAppDestination("/coach-invitation?code=old", viewer, closed)).toBeNull();
    expect(availableAppDestination("/davet/old", viewer, closed)).toBeNull();
  });

  it("removes closed room and AI intents while retaining manual work and benign query state", () => {
    expect(availableAppDestination("/study-session?katil=old&minutes=41", viewer, closed)).toBe("/study-session?minutes=41");
    expect(availableAppDestination("/plan?coach=adapt&date=2026-10-30", viewer, closed)).toBe("/plan?date=2026-10-30");
  });

  it("never shows a coach's student ritual while their coaching area is closed", () => {
    expect(blockedAppFeature("/panel", { username: "coach", roles: ["COACH"] }, closed)).toBe("humanCoaching");
    expect(blockedAppFeature("/settings", { username: "coach", roles: ["COACH"] }, closed)).toBeNull();
  });

  it("closes the role-aware coach calendar with the rest of human coaching", () => {
    expect(blockedAppFeature("/plan", { username: "coach", roles: ["COACH"] }, closed)).toBe("humanCoaching");
  });

  it("retains enabled feature destinations", () => {
    const enabled = Object.fromEntries(APP_AVAILABILITY_KEYS.map(key => [key, true])) as AppAvailabilityDto;
    expect(availableAppDestination("/study-session?katil=known", viewer, enabled)).toBe("/study-session?katil=known");
    expect(blockedAppFeature("/community/member/other", viewer, enabled)).toBeNull();
  });

  it("retains existing-account coach registration when only new-account signup is closed", () => {
    const mixed = { ...closed, coachRegistration: true };
    expect(blockedAppFeature("/coach-application", viewer, mixed)).toBeNull();
  });
});
