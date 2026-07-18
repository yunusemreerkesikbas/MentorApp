// The repository reuses apps/api's Vitest runner; apps/web intentionally has no test dependency.
// @ts-expect-error -- resolved by the explicit @mentor/api Vitest command used for this spec.
import { afterEach, describe, expect, it, vi } from "vitest";
import { ANALYTICS_CONSENT_KEY, trackArticleEvent } from "./analytics";

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
