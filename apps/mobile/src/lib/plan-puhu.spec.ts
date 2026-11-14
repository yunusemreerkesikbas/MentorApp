import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planWindowDays, type PlanAdaptationRow } from "@mentor/core";
import type { CoachPlanAdaptationBriefDto, PlanPreviewAccessDto } from "@mentor/types";
import {
  createDismissQueue,
  groupRowsByDate,
  keepsCoinQuote,
  newCoinQuote,
  wizardCoinQuote,
  nextAvailableParts,
  planNoticeText,
  planBriefAnswers,
  planBriefInput,
  planOpenStep,
  type BriefOverrides,
  type PlanInput,
} from "./plan-puhu.ts";

const offer = (patch: Partial<PlanPreviewAccessDto> = {}): PlanPreviewAccessDto => ({
  mode: "COIN", canGenerate: true, cost: 200, dailyLimit: 1, dailyRemaining: 1, coinConfirmed: 320,
  latestRequestId: null, nextAvailableAt: null, ...patch,
});

describe("planOpenStep", () => {
  it("goes straight to the wizard when the plan is included", () => {
    assert.equal(planOpenStep(offer({ mode: "INCLUDED", cost: null })), "wizard");
  });

  it("reopens the saved draft when nothing new can be made but one is waiting", () => {
    assert.equal(
      planOpenStep(offer({ mode: "NONE", canGenerate: false, reason: "PAYMENT_PREMIUM_REQUIRED", latestRequestId: "r1" })),
      "saved",
    );
  });

  it("opens the sheet for the Coin path and for a closed phone with no draft", () => {
    assert.equal(planOpenStep(offer()), "sheet");
    assert.equal(
      planOpenStep(offer({ mode: "NONE", canGenerate: false, cost: null, reason: "PAYMENT_PREMIUM_REQUIRED" })),
      "sheet",
    );
  });
});

describe("planNoticeText", () => {
  it("never shows the server's Premium line on the phone", () => {
    const closed = offer({ mode: "NONE", canGenerate: false, reason: "PAYMENT_PREMIUM_REQUIRED", message: "Bu özellik Premium'a açık." });
    assert.equal(planNoticeText(closed, "phone line"), "phone line");
  });

  it("shows the server's own message for anything else", () => {
    const limited = offer({ canGenerate: false, reason: "AI_RATE_LIMITED", message: "Biraz yavaşlayalım." });
    assert.equal(planNoticeText(limited, "phone line"), "Biraz yavaşlayalım.");
  });
});

describe("newCoinQuote", () => {
  const input = { source: "PLAN", days: 3 } as unknown as PlanInput;
  const pending = { input, progress: { done: 1, total: 3 } };

  it("quotes the cost for the pending wizard answers, not as a resume", () => {
    assert.deepEqual(newCoinQuote(pending, 200, "id-1"), {
      requestId: "id-1", cost: 200, input, progress: { done: 1, total: 3 }, resume: false,
    });
  });
});

describe("wizardCoinQuote", () => {
  const input = { source: "PLAN", minutesPerDay: 60 } as unknown as PlanInput;
  const last = newCoinQuote({ input, progress: { done: 3, total: 4 } }, 200, "id-1");
  const fresh = () => "id-2";

  it("sends the last request again when the answers and the price are unchanged", () => {
    const quote = wizardCoinQuote(last, { input: { ...input }, progress: { done: 4, total: 4 } }, 200, fresh);
    assert.equal(quote.requestId, "id-1");
    assert.deepEqual(quote.progress, { done: 4, total: 4 });
  });

  it("starts a fresh request when an answer changed", () => {
    const changed = { ...input, minutesPerDay: 90 } as PlanInput;
    assert.equal(wizardCoinQuote(last, { input: changed, progress: null }, 200, fresh).requestId, "id-2");
  });

  it("starts a fresh request when the price changed", () => {
    assert.equal(wizardCoinQuote(last, { input, progress: null }, 250, fresh).requestId, "id-2");
  });

  it("starts a fresh request when there is no last one", () => {
    assert.equal(wizardCoinQuote(null, { input, progress: null }, 200, fresh).requestId, "id-2");
  });
});

describe("keepsCoinQuote", () => {
  const apiError = (code: string) => Object.assign(new Error(code), { name: "ApiClientError", body: { code } });

  it("keeps the request after a lost answer", () => {
    assert.equal(keepsCoinQuote(new TypeError("Network request failed")), true);
  });

  it("keeps the request while the server is still preparing it", () => {
    assert.equal(keepsCoinQuote(apiError("AI_PLAN_REQUEST_PROCESSING")), true);
  });

  it("drops the request after any other answer from the server", () => {
    assert.equal(keepsCoinQuote(apiError("AI_PLAN_PRICE_CHANGED")), false);
    assert.equal(keepsCoinQuote(apiError("AI_PROVIDER_ERROR")), false);
  });
});

describe("createDismissQueue", () => {
  it("runs at once off iOS", () => {
    let runs = 0;
    createDismissQueue("android").queue(() => runs++);
    assert.equal(runs, 1);
  });

  it("waits for the closing modal on iOS, then runs once only", () => {
    let runs = 0;
    const dismiss = createDismissQueue("ios");
    dismiss.queue(() => runs++);
    assert.equal(runs, 0);
    dismiss.flush();
    dismiss.flush();
    assert.equal(runs, 1);
  });
});

describe("nextAvailableParts", () => {
  const next = "2026-11-14T21:05:00.000Z"; // 00:05 on 15 November in Istanbul

  it("says tomorrow when the draft comes after Istanbul midnight", () => {
    assert.deepEqual(nextAvailableParts(next, new Date("2026-11-14T20:50:00.000Z")), { day: "tomorrow", time: "00:05" });
  });

  it("says today once Istanbul has passed midnight too", () => {
    assert.deepEqual(nextAvailableParts(next, new Date("2026-11-14T21:10:00.000Z")), { day: "today", time: "00:05" });
  });
});

describe("planBriefAnswers", () => {
  const brief = (suggestion: Partial<CoachPlanAdaptationBriefDto["suggestion"]>): CoachPlanAdaptationBriefDto => ({
    groundingLine: null,
    evidence: [],
    suggestion: { days: null, weekdays: null, minutesPerDay: null, focusSubjects: [], ...suggestion },
  });
  const untouched: BriefOverrides = { weekdays: null, minutes: undefined, subjects: null };
  const answers = (patch: Partial<Parameters<typeof planBriefAnswers>[0]>) =>
    planBriefAnswers({ brief: null, goalMinutes: null, taxonomyNames: [], knownSubjects: [], overrides: untouched, ...patch });

  it("lets the student's goal beat Puhu's suggested minutes", () => {
    const result = answers({ brief: brief({ minutesPerDay: 60 }), goalMinutes: 120 });
    assert.equal(result.minutes, 120);
    assert.equal(result.rhythmMinutes, null);
  });

  it("falls back to the rhythm when the goal is no real minute count", () => {
    const result = answers({ brief: brief({ minutesPerDay: 60 }), goalMinutes: 5 });
    assert.deepEqual([result.minutes, result.rhythmMinutes, result.goalMinutes], [60, 60, null]);
  });

  it("keeps the student's own picks when the brief arrives late", () => {
    const result = answers({ brief: brief({ weekdays: [1, 3] }), overrides: { ...untouched, weekdays: [2] } });
    assert.deepEqual(result.weekdays, [2]);
    assert.deepEqual(result.rhythmWeekdays, [1, 3]);
    assert.equal(answers({ goalMinutes: 120, overrides: { ...untouched, minutes: null } }).minutes, null);
  });

  it("seeds subjects from Puhu's focus, else from the week, and none before the taxonomy loads", () => {
    const taxonomyNames = ["Türkçe", "Matematik"];
    assert.deepEqual(answers({ brief: brief({ focusSubjects: ["matematik"] }), taxonomyNames, knownSubjects: ["Türkçe"] }).subjects, ["Matematik"]);
    assert.deepEqual(answers({ taxonomyNames, knownSubjects: ["Türkçe"] }).subjects, ["Türkçe"]);
    assert.deepEqual(answers({ taxonomyNames: null, knownSubjects: ["Türkçe"] }).subjects, []);
  });
});

describe("planBriefInput", () => {
  const window = planWindowDays(new Date(2026, 10, 14)); // starts on a Saturday
  const empty = { note: "", weekdays: [], minutes: null, subjects: [], window };

  it("sends the study days in the window's order", () => {
    assert.deepEqual(planBriefInput({ ...empty, weekdays: [1, 6] })?.studyWeekdays, [6, 1]);
  });

  it("sends only the source when every step was skipped", () => {
    assert.deepEqual(planBriefInput(empty), { source: "PLAN" });
  });

  it("refuses a note over 500 characters", () => {
    assert.equal(planBriefInput({ ...empty, note: "a".repeat(501) }), null);
  });
});

describe("groupRowsByDate", () => {
  const row = (key: string, date: string) => ({ key, date, change: {} }) as unknown as PlanAdaptationRow;

  it("orders the days and keeps each day's changes in their order", () => {
    const [a, b, c] = [row("a", "2026-11-17"), row("b", "2026-11-16"), row("c", "2026-11-17")];
    assert.deepEqual(groupRowsByDate([a, b, c]), [
      ["2026-11-16", [b]],
      ["2026-11-17", [a, c]],
    ]);
  });
});
