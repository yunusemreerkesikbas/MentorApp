import { describe, expect, it } from "vitest";
import { isPublicConsentBannerPath } from "./consent-banner-path";

describe("isPublicConsentBannerPath", () => {
  it("shows the banner on public content surfaces", () => {
    expect(isPublicConsentBannerPath("/knowledge/kpss-takvim")).toBe(true);
    expect(isPublicConsentBannerPath("/legal/kvkk-aydinlatma")).toBe(true);
    expect(isPublicConsentBannerPath("/forum/question/abc")).toBe(true);
  });

  it("hides the banner on welcome, auth, onboarding, and the app", () => {
    expect(isPublicConsentBannerPath("/")).toBe(false);
    expect(isPublicConsentBannerPath("/login")).toBe(false);
    expect(isPublicConsentBannerPath("/signup")).toBe(false);
    expect(isPublicConsentBannerPath("/onboarding")).toBe(false);
    expect(isPublicConsentBannerPath("/dashboard")).toBe(false);
    expect(isPublicConsentBannerPath("/knowledge")).toBe(false);
    expect(isPublicConsentBannerPath("/cookie-preferences")).toBe(false);
  });
});
