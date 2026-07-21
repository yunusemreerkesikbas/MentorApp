import { HttpStatus } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { ErrorCode } from "../../../common/errors/error-code";
import { AiUsageFeature } from "../domain/ai.constants";
import { PlanAdaptationService } from "./plan-adaptation.service";

const USER = { id: "u1", roles: ["STUDENT"] } as never;
const TODAY = new Date().toISOString().slice(0, 10);
const TOMORROW = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

describe("PlanAdaptationService", () => {
  let complete: ReturnType<typeof vi.fn>;
  let append: ReturnType<typeof vi.fn>;
  let countFeaturesSince: ReturnType<typeof vi.fn>;
  let getSnapshot: ReturnType<typeof vi.fn>;
  let getMood: ReturnType<typeof vi.fn>;
  let getSession: ReturnType<typeof vi.fn>;
  let getEntitlement: ReturnType<typeof vi.fn>;
  let service: PlanAdaptationService;

  beforeEach(() => {
    complete = vi.fn(async () => ({
      text: JSON.stringify({
        changes: [{ kind: "MOVE", taskRef: "T1", toDate: TOMORROW }],
      }),
      promptTokens: 10,
      completionTokens: 5,
      model: "fake",
    }));
    append = vi.fn(async () => undefined);
    countFeaturesSince = vi.fn(async () => 0);
    getSnapshot = vi.fn(async () => ({
      window: {
        from: TODAY,
        to: new Date(Date.now() + 6 * 86_400_000).toISOString().slice(0, 10),
      },
      planRevision: "revision",
      tasks: [
        {
          id: "task-1",
          taskDate: TODAY,
          title: "Matematik çöz",
          subject: "Matematik",
          status: "PENDING",
          sortOrder: 0,
        },
        {
          id: "done-1",
          taskDate: TODAY,
          title: "Tamamlanan görev",
          subject: null,
          status: "DONE",
          sortOrder: 1,
        },
      ],
    }));
    getMood = vi.fn(async () => ({ mood: 1 }));
    getSession = vi.fn(async () => ({
      id: "session-1",
      status: "COMPLETED",
      sessionMood: 1,
    }));
    getEntitlement = vi.fn(async () => ({ isPremium: true }));

    service = new PlanAdaptationService(
      { complete } as never,
      { getAdaptationSnapshot: getSnapshot } as never,
      { getToday: getMood } as never,
      { getById: getSession } as never,
      {
        build: vi.fn(async () => ({
          examType: "KPSS",
          moodLevel: 1,
          struggleNote: "private mood note",
          recentSessions: {
            count7d: 2,
            focusMinutes7d: 50,
            subjects: ["Matematik"],
            lastStruggleNote: "private session note",
          },
          todayPlan: null,
        })),
      } as never,
      { append, countFeaturesSince } as never,
      {
        get: vi.fn(async (key: string) => {
          if (key === FeatureFlag.AI_ENABLED) return true;
          if (key === "ai.plan_draft.daily_limit") return 5;
          return null;
        }),
      } as never,
      { getEntitlement } as never,
      { assertWithinBudget: vi.fn(async () => undefined) } as never,
      { translate: vi.fn((key: string) => key) } as never,
    );
  });

  it("requires Premium before calling the provider", async () => {
    getEntitlement.mockResolvedValue({ isPremium: false });
    await expect(
      service.preview(USER, { source: "PLAN" }),
    ).rejects.toMatchObject({
      code: ErrorCode.PAYMENT_PREMIUM_REQUIRED,
      httpStatus: HttpStatus.FORBIDDEN,
    });
    expect(complete).not.toHaveBeenCalled();
  });

  it("shares the plan-draft daily quota", async () => {
    countFeaturesSince.mockResolvedValue(5);
    await expect(
      service.preview(USER, { source: "PLAN" }),
    ).rejects.toMatchObject({
      code: ErrorCode.AI_RATE_LIMITED,
      httpStatus: HttpStatus.TOO_MANY_REQUESTS,
    });
    expect(countFeaturesSince).toHaveBeenCalledWith(
      "u1",
      [AiUsageFeature.PLAN_DRAFT, AiUsageFeature.PLAN_ADAPTATION],
      expect.any(Date),
    );
  });

  it("rejects MOOD unless today's backend mood is 1-2", async () => {
    getMood.mockResolvedValue({ mood: 3 });
    await expect(
      service.preview(USER, { source: "MOOD" }),
    ).rejects.toMatchObject({
      code: ErrorCode.AI_PLAN_ADAPTATION_NOT_APPLICABLE,
      httpStatus: HttpStatus.CONFLICT,
    });
    expect(complete).not.toHaveBeenCalled();
  });

  it("returns deterministic NO_CHANGE for MOOD without today's pending tasks", async () => {
    getSnapshot.mockResolvedValue({
      window: { from: TODAY, to: TODAY },
      planRevision: "revision",
      tasks: [],
    });
    const result = await service.preview(USER, { source: "MOOD" });
    expect(result).toMatchObject({
      status: "NO_CHANGE",
      changes: [],
      model: "rules",
    });
    expect(complete).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();
  });

  it("validates owned completed SESSION with sessionMood=1", async () => {
    getSession.mockResolvedValue({
      id: "session-1",
      status: "COMPLETED",
      sessionMood: 2,
    });
    await expect(
      service.preview(USER, {
        source: "SESSION",
        sessionId: "dd9974b8-b010-4df8-a4fa-3d6bbd17e75d",
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.AI_PLAN_ADAPTATION_NOT_APPLICABLE,
    });
    expect(complete).not.toHaveBeenCalled();
  });

  it("sends only opaque pending task refs and sanitized aggregates, then meters adaptation usage", async () => {
    const result = await service.preview(USER, {
      source: "PLAN",
      note: "Cuma günü hafif olsun",
    });

    expect(result).toMatchObject({
      status: "READY",
      planRevision: "revision",
      changes: [
        { kind: "MOVE", taskId: "task-1", fromDate: TODAY, toDate: TOMORROW },
      ],
      model: "fake",
    });
    const prompt = complete.mock.calls[0][0];
    expect(prompt.user).toContain('"ref":"T1"');
    expect(prompt.user).not.toContain("task-1");
    expect(prompt.user).not.toContain("done-1");
    expect(prompt.user).not.toContain("private mood note");
    expect(prompt.user).not.toContain("private session note");
    expect(prompt.user).toContain("Cuma günü hafif olsun");
    expect(append.mock.calls[0][0].feature).toBe(
      AiUsageFeature.PLAN_ADAPTATION,
    );
  });

  it("rejects a SESSION that is not owned or no longer exists", async () => {
    getSession.mockResolvedValue(null);
    await expect(
      service.preview(USER, {
        source: "SESSION",
        sessionId: "dd9974b8-b010-4df8-a4fa-3d6bbd17e75d",
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.COACHING_SESSION_NOT_FOUND,
      httpStatus: HttpStatus.NOT_FOUND,
    });
    expect(complete).not.toHaveBeenCalled();
  });

  it("returns only ADD suggestions when the PLAN snapshot has no pending tasks", async () => {
    getSnapshot.mockResolvedValue({
      window: {
        from: TODAY,
        to: new Date(Date.now() + 6 * 86_400_000).toISOString().slice(0, 10),
      },
      planRevision: "empty-revision",
      tasks: [
        {
          id: "done-1",
          taskDate: TODAY,
          title: "Tamamlanan görev",
          subject: null,
          status: "DONE",
          sortOrder: 0,
        },
      ],
    });
    complete.mockResolvedValue({
      text: JSON.stringify({
        changes: [{ kind: "ADD", title: "Kısa başlangıç", taskDate: TOMORROW }],
      }),
      promptTokens: 4,
      completionTokens: 3,
      model: "fake",
    });

    const result = await service.preview(USER, { source: "PLAN" });

    expect(result).toMatchObject({
      status: "READY",
      planRevision: "empty-revision",
      changes: [
        {
          kind: "ADD",
          title: "Kısa başlangıç",
          subject: null,
          taskDate: TOMORROW,
        },
      ],
    });
    expect(complete.mock.calls[0][0].user).not.toContain("done-1");
    expect(complete.mock.calls[0][0].user).not.toContain("Tamamlanan görev");
  });

  it("caps model-visible tasks while retaining the full plan snapshot", async () => {
    getSnapshot.mockResolvedValue({
      window: {
        from: TODAY,
        to: new Date(Date.now() + 6 * 86_400_000).toISOString().slice(0, 10),
      },
      planRevision: "large-revision",
      tasks: Array.from({ length: 25 }, (_, index) => ({
        id: `task-${index + 1}`,
        taskDate: TODAY,
        title: `Görev ${index + 1}`,
        subject: null,
        status: "PENDING",
        sortOrder: index,
      })),
    });
    complete.mockResolvedValue({
      text: '{"changes":[]}',
      promptTokens: 10,
      completionTokens: 2,
      model: "fake",
    });

    await service.preview(USER, { source: "PLAN" });

    const prompt = complete.mock.calls[0][0].user as string;
    expect(prompt).toContain('"ref":"T21"');
    expect(prompt).toContain('"title":"Görev 21"');
    expect(prompt).not.toContain('"title":"Görev 22"');
    expect(prompt).not.toContain('"ref":"T22"');
  });

  it("meters malformed provider output but never mutates the plan", async () => {
    complete.mockResolvedValue({
      text: "bad-json",
      promptTokens: 1,
      completionTokens: 1,
      model: "fake",
    });
    await expect(
      service.preview(USER, { source: "PLAN" }),
    ).rejects.toMatchObject({
      code: ErrorCode.AI_PROVIDER_ERROR,
      httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
    });
    expect(append).toHaveBeenCalledOnce();
  });
});
