import { describe, expect, it } from "vitest";
import { isPublicConsentBannerPath } from "./consent-banner-path";

describe("isPublicConsentBannerPath", () => {
  it("shows the banner on public content surfaces", () => {
    expect(isPublicConsentBannerPath("/")).toBe(true);
    expect(isPublicConsentBannerPath("/for-coaches")).toBe(true);
    expect(isPublicConsentBannerPath("/pomodoro-timer")).toBe(true);
    expect(isPublicConsentBannerPath("/yks-study-program")).toBe(true);
    expect(isPublicConsentBannerPath("/tyt-study-program")).toBe(true);
    expect(isPublicConsentBannerPath("/lgs-study-program")).toBe(true);
    expect(isPublicConsentBannerPath("/mistake-notebook")).toBe(true);
    expect(isPublicConsentBannerPath("/study-app")).toBe(true);
    expect(isPublicConsentBannerPath("/discover-community")).toBe(true);
    expect(isPublicConsentBannerPath("/knowledge")).toBe(true);
    expect(isPublicConsentBannerPath("/knowledge/kpss-takvim")).toBe(true);
    expect(isPublicConsentBannerPath("/legal/kvkk-aydinlatma")).toBe(true);
    expect(isPublicConsentBannerPath("/forum/question/abc")).toBe(true);
  });

  it("hides the banner on welcome, auth, onboarding, and the app", () => {
    expect(isPublicConsentBannerPath("/welcome")).toBe(false);
    expect(isPublicConsentBannerPath("/login")).toBe(false);
    expect(isPublicConsentBannerPath("/signup")).toBe(false);
    expect(isPublicConsentBannerPath("/onboarding")).toBe(false);
    expect(isPublicConsentBannerPath("/dashboard")).toBe(false);
    expect(isPublicConsentBannerPath("/community")).toBe(false);
    expect(isPublicConsentBannerPath("/cookie-preferences")).toBe(false);
  });
});
