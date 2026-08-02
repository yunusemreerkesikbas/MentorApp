// The repository reuses apps/api's Vitest runner; apps/web intentionally has no test dependency.
// @ts-expect-error -- resolved by the explicit @mentor/api Vitest command used for this spec.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ANALYTICS_CONSENT_KEY,
  trackArticleEvent,
  trackCoachEvent,
  trackCommunityEvent,
  trackWeeklyRecapEvent,
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

describe("community analytics", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("queues only structural forum metadata after consent", () => {
    const dataLayer: unknown[] = [];
    vi.stubGlobal("window", {
      localStorage: {
        getItem: vi.fn((key: string) =>
          key === ANALYTICS_CONSENT_KEY ? "accepted" : null,
        ),
      },
      dataLayer,
    });

    trackCommunityEvent("forum_thread_created", {
      mode: "question",
      zone_type: "QA",
      tag_count: 2,
    });
    trackCommunityEvent("forum_feed_tab_selected", {
      sort: "trending",
      scope: "relevant",
    });
    trackCommunityEvent("forum_coach_bridge_click", {
      zone_type: "QA",
      intent: "STUDY_METHOD",
    });
    trackCommunityEvent("forum_coach_bridge_impression", {
      zone_type: "CHAT",
      intent: "NEXT_STEP",
    });

    expect(dataLayer).toEqual([
      [
        "event",
        "forum_thread_created",
        { mode: "question", zone_type: "QA", tag_count: 2 },
      ],
      [
        "event",
        "forum_feed_tab_selected",
        { sort: "trending", scope: "relevant" },
      ],
      [
        "event",
        "forum_coach_bridge_click",
        { zone_type: "QA", intent: "STUDY_METHOD" },
      ],
      [
        "event",
        "forum_coach_bridge_impression",
        { zone_type: "CHAT", intent: "NEXT_STEP" },
      ],
    ]);
    expect(JSON.stringify(dataLayer)).not.toMatch(
      /user|threadId|title|body|content/i,
    );
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
    trackCoachEvent("coach_plan_adaptation_request", { source: "MOOD" });

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
    trackCoachEvent("coach_plan_adaptation_request", { source: "PLAN" });
    trackCoachEvent("coach_plan_adaptation_apply", {
      source: "SESSION",
      move_count: 2,
      add_count: 1,
    });
    trackCoachEvent("coach_next_action_click", {
      surface: "coach",
      next_action_kind: "ADD_TASK",
    });
    trackCoachEvent("coach_next_action_impression", {
      surface: "dashboard",
      next_action_kind: "DAY_COMPLETE",
    });
    trackCoachEvent("coach_session_start", { source: "dashboard" });
    trackCoachEvent("coach_community_message_sent", {
      zone_type: "CHAT",
      intent: "PLAN",
      access_mode: "COIN",
    });
    trackCoachEvent("coach_community_task_added", {
      zone_type: "QA",
      intent: "STUDY_METHOD",
    });
    trackCoachEvent("coach_community_return_click", {
      zone_type: "CHAT",
      intent: "STRATEGY",
    });
    trackCoachEvent("coach_community_task_completed", {
      zone_type: "QA",
      intent: "PLAN",
    });
    trackCoachEvent("coach_community_completion_return_click", {
      zone_type: "CHAT",
      intent: "NEXT_STEP",
    });
    trackCoachEvent("coach_community_return_reply_created", {
      zone_type: "QA",
      intent: "STUDY_METHOD",
    });
    trackCoachEvent("coach_v2_reply", {
      intent: "FOCUS",
      tone: "DIRECT",
      evidence_types: ["TODAY_FOCUS", "RECENT_RHYTHM"],
    });
    trackCoachEvent("coach_v2_feedback", {
      intent: "FOCUS",
      tone: "DIRECT",
      feedback: "UP",
    });
    trackCoachEvent("coach_v2_action", {
      action_type: "START_PLAN_SESSION",
      status: "ACCEPTED",
    });
    trackCoachEvent("coach_v2_memory_management", {
      operation: "FORGET",
    });

    expect(dataLayer).toEqual([
      [
        "event",
        "coach_hub_view",
        { access_mode: "COIN", next_action_kind: "ADD_TASK" },
      ],
      ["event", "coach_plan_adaptation_request", { source: "PLAN" }],
      [
        "event",
        "coach_plan_adaptation_apply",
        { source: "SESSION", move_count: 2, add_count: 1 },
      ],
      [
        "event",
        "coach_next_action_click",
        { surface: "coach", next_action_kind: "ADD_TASK" },
      ],
      [
        "event",
        "coach_next_action_impression",
        { surface: "dashboard", next_action_kind: "DAY_COMPLETE" },
      ],
      ["event", "coach_session_start", { source: "dashboard" }],
      [
        "event",
        "coach_community_message_sent",
        { zone_type: "CHAT", intent: "PLAN", access_mode: "COIN" },
      ],
      [
        "event",
        "coach_community_task_added",
        { zone_type: "QA", intent: "STUDY_METHOD" },
      ],
      [
        "event",
        "coach_community_return_click",
        { zone_type: "CHAT", intent: "STRATEGY" },
      ],
      [
        "event",
        "coach_community_task_completed",
        { zone_type: "QA", intent: "PLAN" },
      ],
      [
        "event",
        "coach_community_completion_return_click",
        { zone_type: "CHAT", intent: "NEXT_STEP" },
      ],
      [
        "event",
        "coach_community_return_reply_created",
        { zone_type: "QA", intent: "STUDY_METHOD" },
      ],
      [
        "event",
        "coach_v2_reply",
        {
          intent: "FOCUS",
          tone: "DIRECT",
          evidence_types: ["TODAY_FOCUS", "RECENT_RHYTHM"],
        },
      ],
      [
        "event",
        "coach_v2_feedback",
        { intent: "FOCUS", tone: "DIRECT", feedback: "UP" },
      ],
      [
        "event",
        "coach_v2_action",
        { action_type: "START_PLAN_SESSION", status: "ACCEPTED" },
      ],
      ["event", "coach_v2_memory_management", { operation: "FORGET" }],
    ]);
    expect(JSON.stringify(dataLayer)).not.toMatch(
      /taskId|threadId|conversationId|messageId|title|subject|body|content|memoryValue|sourceQuote|user/i,
    );
  });
});

describe("weekly recap analytics", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("queues only safe enum fields after consent", () => {
    const dataLayer: unknown[] = [];
    vi.stubGlobal("window", {
      localStorage: {
        getItem: vi.fn((key: string) =>
          key === ANALYTICS_CONSENT_KEY ? "accepted" : null,
        ),
      },
      dataLayer,
    });

    trackWeeklyRecapEvent("weekly_recap_slide_view", {
      surface: "recap",
      recap_status: "READY",
      slide_kind: "weekly_best",
    });

    expect(dataLayer).toEqual([
      [
        "event",
        "weekly_recap_slide_view",
        {
          surface: "recap",
          recap_status: "READY",
          slide_kind: "weekly_best",
        },
      ],
    ]);
    expect(JSON.stringify(dataLayer)).not.toMatch(
      /user|examId|subject|title|mood|net/i,
    );
  });
});
