import { afterEach, describe, expect, it, vi } from "vitest";
import { ANALYTICS_CONSENT_KEY } from "./analytics";
import {
  claimWaitlistSignupConversion,
  readSeoLpSource,
  recordSeoLpSource,
  SEO_LP_SOURCE_KEY,
  trackSeoLpSignupClick,
  WAITLIST_CONVERSION_GUARD_KEY,
} from "./lp-attribution";

describe("lp-attribution", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("persists and reads valid SEO LP sources from sessionStorage", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
      },
    });

    expect(readSeoLpSource()).toBeUndefined();
    recordSeoLpSource("pomodoro");
    expect(store.get(SEO_LP_SOURCE_KEY)).toBe("pomodoro");
    expect(readSeoLpSource()).toBe("pomodoro");
  });

  it("records source and emits a single waitlist_cta_click event per CTA click after consent", () => {
    const store = new Map<string, string>();
    const dataLayer: unknown[] = [];
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => (k === ANALYTICS_CONSENT_KEY ? "accepted" : null),
      },
      sessionStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
      },
      dataLayer,
    });

    trackSeoLpSignupClick("pomodoro", "timer_done");
    expect(readSeoLpSource()).toBe("pomodoro");

    trackSeoLpSignupClick("yks", "demo");
    expect(readSeoLpSource()).toBe("yks");

    trackSeoLpSignupClick("notebook", "how");
    expect(readSeoLpSource()).toBe("notebook");

    trackSeoLpSignupClick("study_app", "features");
    expect(readSeoLpSource()).toBe("study_app");

    expect(dataLayer.map((entry) => Array.from(entry as IArguments))).toEqual([
      [
        "event",
        "waitlist_cta_click",
        { intent: "student", lp_source: "pomodoro", location: "timer_done" },
      ],
      [
        "event",
        "waitlist_cta_click",
        { intent: "student", lp_source: "yks", location: "demo" },
      ],
      [
        "event",
        "waitlist_cta_click",
        { intent: "student", lp_source: "notebook", location: "how" },
      ],
      [
        "event",
        "waitlist_cta_click",
        { intent: "student", lp_source: "study_app", location: "features" },
      ],
    ]);
  });

  it("deduplicates repeated waitlist conversions for the same email without storing PII", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
      },
    });

    expect(
      claimWaitlistSignupConversion("Ogrenci@Example.com ", "student"),
    ).toBe(true);
    // Duplicate submission with different casing/whitespace in the same session:
    expect(
      claimWaitlistSignupConversion(" ogrenci@example.com", "student"),
    ).toBe(false);
    // Different role or different email is allowed once:
    expect(
      claimWaitlistSignupConversion("ogrenci@example.com", "coach"),
    ).toBe(true);
    expect(
      claimWaitlistSignupConversion("baska@example.com", "student"),
    ).toBe(true);

    const rawStored = store.get(WAITLIST_CONVERSION_GUARD_KEY) ?? "";
    expect(rawStored).not.toContain("ogrenci");
    expect(rawStored).not.toContain("example.com");
    expect(rawStored).not.toContain("@");
  });
});
