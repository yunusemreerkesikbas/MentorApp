import { afterEach, describe, expect, it, vi } from "vitest";
import { ANALYTICS_CONSENT_KEY } from "./analytics";
import {
  readSeoLpSource,
  recordSeoLpSource,
  SEO_LP_SOURCE_KEY,
  trackSeoLpSignupClick,
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

  it("records source and emits LP-specific signup click events after consent", () => {
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
      ["event", "signup_from_pomodoro_lp", { location: "timer_done" }],
      ["event", "plan_cta_click", { lp: "yks", location: "demo" }],
      ["event", "signup_from_yks_lp", { location: "demo" }],
      [
        "event",
        "notebook_cta_click",
        { placement: "how", page_type: "mistake_notebook" },
      ],
      [
        "event",
        "category_cta_click",
        { placement: "features", page_type: "study_app" },
      ],
    ]);
  });
});
