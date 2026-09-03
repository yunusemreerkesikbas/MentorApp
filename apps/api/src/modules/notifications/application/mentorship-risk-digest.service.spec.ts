import { beforeEach, describe, expect, it, vi } from "vitest";
import { MentorshipRiskDigestService } from "./mentorship-risk-digest.service";
import type { CoachRiskDigestCandidate } from "../../mentorship/domain/mentorship-query.port";

const COACH = "11111111-1111-4111-8111-111111111111";
const AYSE = "22222222-2222-4222-8222-222222222222";
const MERT = "33333333-3333-4333-8333-333333333333";
const NOW = new Date("2026-09-10T07:00:00.000Z");

function candidate(
  students: { id: string; name: string; flags: string[] }[],
): CoachRiskDigestCandidate {
  return {
    coachId: COACH,
    email: "koc@test.local",
    displayName: "Koç Ayşe",
    students: students.map((s) => ({
      studentId: s.id,
      displayName: s.name,
      flags: s.flags as CoachRiskDigestCandidate["students"][number]["flags"],
    })),
  };
}

interface SetupOptions {
  candidates?: CoachRiskDigestCandidate[];
  /** The previous digest row this coach received, if any. */
  previous?: { pairs: unknown; createdAt: Date } | null;
  emailEnabled?: boolean;
  /** `createFromTemplate` returns false when the dedupe key already existed. */
  created?: boolean;
  enabled?: boolean;
  repeatAfterDays?: number;
}

function setup(options: SetupOptions = {}) {
  const enqueued: { template: string; variables: Record<string, unknown> }[] = [];
  const inApp: { dedupeKey?: string; data?: Record<string, unknown>; args?: unknown }[] = [];

  const config = {
    get: vi.fn(async (key: string) =>
      key === "mentorship.risk_digest.enabled"
        ? (options.enabled ?? true)
        : (options.repeatAfterDays ?? 7),
    ),
  };
  const mentorship = {
    listRiskDigestCandidates: vi.fn(async () => options.candidates ?? []),
  };
  const userNotifs = {
    findLatestByTemplateKey: vi.fn(async () =>
      options.previous
        ? { data: { pairs: options.previous.pairs }, createdAt: options.previous.createdAt }
        : undefined,
    ),
  };
  const preferences = {
    findByUserIdService: vi.fn(async () => ({ emailEnabled: options.emailEnabled ?? true })),
  };
  const notifications = {
    createFromTemplate: vi.fn(async (_u, _c, _k, _l, opts) => {
      inApp.push(opts);
      return options.created ?? true;
    }),
  };
  const queue = {
    enqueue: vi.fn(async (_name: string, payload: never) => {
      enqueued.push(payload);
    }),
  };
  // `withServiceContext` only needs a db handle it can hand to the callback.
  const db = {} as never;

  const service = new MentorshipRiskDigestService(
    db,
    queue as never,
    mentorship as never,
    preferences as never,
    userNotifs as never,
    notifications as never,
    config as never,
  );
  return { service, enqueued, inApp, mentorship, notifications, queue, config };
}

vi.mock("../../../database/rls", () => ({
  withServiceContext: async (_db: unknown, fn: (tx: unknown) => unknown) => fn({}),
}));

describe("MentorshipRiskDigestService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stays entirely quiet when the flag is off — the port is never even asked", async () => {
    const { service, mentorship } = setup({ enabled: false });
    await expect(service.dispatchDaily(NOW)).resolves.toEqual({ sent: 0, skipped: 0 });
    expect(mentorship.listRiskDigestCandidates).not.toHaveBeenCalled();
  });

  it("sends when a coach has news for the first time", async () => {
    const { service, inApp, enqueued } = setup({
      candidates: [candidate([{ id: AYSE, name: "Ayşe", flags: ["INACTIVE"] }])],
    });
    await expect(service.dispatchDaily(NOW)).resolves.toEqual({ sent: 1, skipped: 0 });
    expect(inApp[0]!.data).toEqual({ pairs: [`${AYSE}:INACTIVE`] });
    expect(enqueued).toHaveLength(1);
  });

  it("says nothing when today's flags are exactly what it already reported", async () => {
    // The alarm-fatigue rule: a student quiet for ten days must not ping every morning.
    const { service, enqueued } = setup({
      candidates: [candidate([{ id: AYSE, name: "Ayşe", flags: ["INACTIVE"] }])],
      previous: { pairs: [`${AYSE}:INACTIVE`], createdAt: new Date("2026-09-09T07:00:00.000Z") },
    });
    await expect(service.dispatchDaily(NOW)).resolves.toEqual({ sent: 0, skipped: 1 });
    expect(enqueued).toHaveLength(0);
  });

  it("sends when a NEW flag appears on an already-reported student", async () => {
    const { service } = setup({
      candidates: [candidate([{ id: AYSE, name: "Ayşe", flags: ["INACTIVE", "NET_DROP"] }])],
      previous: { pairs: [`${AYSE}:INACTIVE`], createdAt: new Date("2026-09-09T07:00:00.000Z") },
    });
    await expect(service.dispatchDaily(NOW)).resolves.toEqual({ sent: 1, skipped: 0 });
  });

  it("stays quiet when a student recovers — no news is good news", async () => {
    const { service } = setup({
      candidates: [candidate([{ id: AYSE, name: "Ayşe", flags: ["INACTIVE"] }])],
      previous: {
        pairs: [`${AYSE}:INACTIVE`, `${MERT}:LOW_MOOD`],
        createdAt: new Date("2026-09-09T07:00:00.000Z"),
      },
    });
    await expect(service.dispatchDaily(NOW)).resolves.toEqual({ sent: 0, skipped: 1 });
  });

  it("repeats a chronic situation once the baseline goes stale", async () => {
    const { service } = setup({
      candidates: [candidate([{ id: AYSE, name: "Ayşe", flags: ["INACTIVE"] }])],
      previous: { pairs: [`${AYSE}:INACTIVE`], createdAt: new Date("2026-09-01T07:00:00.000Z") },
      repeatAfterDays: 7,
    });
    await expect(service.dispatchDaily(NOW)).resolves.toEqual({ sent: 1, skipped: 0 });
  });

  it("does not email when the in-app row already existed (cron ran twice)", async () => {
    const { service, enqueued } = setup({
      candidates: [candidate([{ id: AYSE, name: "Ayşe", flags: ["INACTIVE"] }])],
      created: false,
    });
    await expect(service.dispatchDaily(NOW)).resolves.toEqual({ sent: 0, skipped: 1 });
    expect(enqueued).toHaveLength(0);
  });

  it("honours the email preference but still fills the in-app inbox", async () => {
    const { service, inApp, enqueued } = setup({
      candidates: [candidate([{ id: AYSE, name: "Ayşe", flags: ["INACTIVE"] }])],
      emailEnabled: false,
    });
    await expect(service.dispatchDaily(NOW)).resolves.toEqual({ sent: 1, skipped: 0 });
    expect(inApp).toHaveLength(1);
    expect(enqueued).toHaveLength(0);
  });

  it("names students and never puts a flag id in the copy", async () => {
    const { service, inApp } = setup({
      candidates: [
        candidate([
          { id: AYSE, name: "Ayşe", flags: ["INACTIVE"] },
          { id: MERT, name: "Mert", flags: ["LOW_MOOD"] },
          { id: "44444444-4444-4444-8444-444444444444", name: "Zeynep", flags: ["NET_DROP"] },
        ]),
      ],
    });
    await service.dispatchDaily(NOW);
    const args = inApp[0]!.args as Record<string, unknown>;
    // The headline count and the named list must agree. They used to not: the copy capped the
    // list at two and passed a `rest` arg that no locale string rendered, so a digest about three
    // students said "3" and named two, with nothing to explain the third.
    expect(args).toEqual({ count: 3, names: "Ayşe, Mert, Zeynep" });
    expect(String(args.names).split(", ")).toHaveLength(args.count as number);
    expect(JSON.stringify(args)).not.toMatch(/INACTIVE|LOW_MOOD|NET_DROP/);
  });

  it("stays silent when every name resolves empty rather than saying '0 students'", async () => {
    const { service, inApp, enqueued } = setup({
      candidates: [candidate([{ id: AYSE, name: "", flags: ["INACTIVE"] }])],
    });
    await expect(service.dispatchDaily(NOW)).resolves.toEqual({ sent: 0, skipped: 1 });
    expect(inApp).toHaveLength(0);
    expect(enqueued).toHaveLength(0);
  });

  it("treats a malformed stored baseline as no baseline instead of throwing", async () => {
    const { service } = setup({
      candidates: [candidate([{ id: AYSE, name: "Ayşe", flags: ["INACTIVE"] }])],
      previous: { pairs: "not-an-array", createdAt: new Date("2026-09-09T07:00:00.000Z") },
    });
    await expect(service.dispatchDaily(NOW)).resolves.toEqual({ sent: 1, skipped: 0 });
  });
});
