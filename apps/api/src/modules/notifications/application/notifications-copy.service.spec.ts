import { describe, expect, it, vi } from "vitest";
import { NotificationCopyKey, streakMilestoneCopyKey } from "../domain/notification-copy";
import { NotificationsCopyService } from "./notifications-copy.service";

function makeService(translations: Record<string, string> = {}) {
  const translate = vi.fn((key: string, opts?: { args?: Record<string, unknown> }) => {
    let value = translations[key] ?? key;
    for (const [name, raw] of Object.entries(opts?.args ?? {})) {
      value = value.replaceAll(`{${name}}`, String(raw));
    }
    return value;
  });
  return {
    translate,
    service: new NotificationsCopyService({ translate } as never),
  };
}

describe("NotificationsCopyService", () => {
  it("resolves in-app title and body with interpolation", () => {
    const { service, translate } = makeService({
      "notifications.inApp.streakBroken.title": "Yarın yine seninle",
      "notifications.inApp.streakBroken.body": "{days} günlük seri durdu, yol durmadı. Bugün küçük bir adım yeter.",
    });
    const copy = service.resolve(NotificationCopyKey.STREAK_BROKEN, { days: 12 }, "tr");
    expect(copy.title).toBe("Yarın yine seninle");
    expect(copy.body).toContain("12");
    expect(translate).toHaveBeenCalledWith(
      "notifications.inApp.streakBroken.title",
      expect.objectContaining({ lang: "tr" }),
    );
  });

  it("keeps stored fallback when the template key is missing from i18n", () => {
    const { service } = makeService();
    const copy = service.resolveStored(
      { title: "old title", body: "old body", data: { templateKey: "streakBroken", args: {} } },
      "tr",
    );
    expect(copy).toEqual({ title: "old title", body: "old body" });
  });

  it("re-resolves stored templateKey + args", () => {
    const { service } = makeService({
      "notifications.inApp.newFollower.title": "Biri seni buldu",
      "notifications.inApp.newFollower.body": "{name} seni takip etti.",
    });
    const copy = service.resolveStored({
      title: "Yeni takipçi",
      body: "legacy",
      data: { templateKey: "newFollower", args: { name: "Ada" } },
    });
    expect(copy.body).toContain("Ada");
  });

  it("picks streak milestone keys by threshold", () => {
    expect(streakMilestoneCopyKey(7)).toBe(NotificationCopyKey.STREAK_MILESTONE_7);
    expect(streakMilestoneCopyKey(14)).toBe(NotificationCopyKey.STREAK_MILESTONE_14);
    expect(streakMilestoneCopyKey(30)).toBe(NotificationCopyKey.STREAK_MILESTONE_30);
    expect(streakMilestoneCopyKey(100)).toBe(NotificationCopyKey.STREAK_MILESTONE_100);
    expect(streakMilestoneCopyKey(120)).toBe(NotificationCopyKey.STREAK_MILESTONE_100);
  });

  it("maps email template ids and omits missing greeting/cta", () => {
    const { service } = makeService({
      "notifications.email.paymentsDunning.subject": "Mentor — Ödeme tamamlanamadı",
      "notifications.email.paymentsDunning.body": "Ödeme tamamlanamadı.",
    });
    const email = service.resolveEmail("payments.dunning", { name: "Ada" }, "tr");
    expect(email.subject).toContain("Ödeme");
    expect(email.greeting).toBe("");
    expect(email.cta).toBe("");
  });
});
