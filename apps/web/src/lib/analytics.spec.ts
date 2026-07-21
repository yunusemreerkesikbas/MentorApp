// The repository reuses apps/api's Vitest runner; apps/web intentionally has no test dependency.
// @ts-expect-error -- resolved by the explicit @mentor/api Vitest command used for this spec.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ANALYTICS_CONSENT_KEY,
  trackArticleEvent,
  trackCoachEvent,
} from "./analytics";

const params = {
  slug: "kpss-basvuru-sureci",
  exam_family: "KPSS",
  category: "APPLICATION",
  locale: "tr",
};

describe("article analytics", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not queue events before explicit consent", () => {
    const dataLayer: unknown[] = [];
    vi.stubGlobal("window", {
      localStorage: { getItem: vi.fn(() => null) },
      dataLayer,
    });

    trackArticleEvent("article_view", params);

    expect(dataLayer).toEqual([]);
  });

  it("queues only the allowlisted article payload after consent", () => {
    const dataLayer: unknown[] = [];
    vi.stubGlobal("window", {
      localStorage: {
        getItem: vi.fn((key: string) =>
          key === ANALYTICS_CONSENT_KEY ? "accepted" : null,
        ),
      },
      dataLayer,
    });

    trackArticleEvent("article_source_click", params);

    expect(dataLayer).toEqual([["event", "article_source_click", params]]);
  });
});

describe("coach analytics", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not write a coach event or dataLayer before explicit consent", () => {
    const dataLayer: unknown[] = [];
    vi.stubGlobal("window", {
      localStorage: { getItem: vi.fn(() => "rejected") },
      dataLayer,
    });

    trackCoachEvent("coach_hub_view", {
      access_mode: "PREMIUM",
      next_action_kind: "START_TASK",
    });

    expect(dataLayer).toEqual([]);
  });

  it("writes only allowlisted coach fields after consent", () => {
    const dataLayer: unknown[] = [];
    vi.stubGlobal("window", {
      localStorage: {
        getItem: vi.fn((key: string) =>
          key === ANALYTICS_CONSENT_KEY ? "accepted" : null,
        ),
      },
      dataLayer,
    });

    trackCoachEvent("coach_hub_view", {
      access_mode: "COIN",
      next_action_kind: "ADD_TASK",
    });
    trackCoachEvent("coach_next_action_click", {
      next_action_kind: "ADD_TASK",
    });

    expect(dataLayer).toEqual([
      [
        "event",
        "coach_hub_view",
        { access_mode: "COIN", next_action_kind: "ADD_TASK" },
      ],
      ["event", "coach_next_action_click", { next_action_kind: "ADD_TASK" }],
    ]);
    expect(JSON.stringify(dataLayer)).not.toMatch(/taskId|title|subject|user/i);
  });
});
