import { describe, expect, it, vi } from "vitest";
import type { MentorshipStudentReportDto } from "@mentor/types";
import { mentorshipBriefFingerprint } from "../../ai/domain/mentorship-brief-prompt";
import { MentorshipBriefService } from "./mentorship-brief.service";

const COACH = { id: "11111111-1111-4111-8111-111111111111", roles: ["COACH"] };
const STUDENT = "22222222-2222-4222-8222-222222222222";

const report = (over: Partial<MentorshipStudentReportDto> = {}): MentorshipStudentReportDto => ({
  studentId: STUDENT,
  studentDisplayName: "Ada",
  studentUsername: null,
  acceptedAt: "2026-09-01T00:00:00.000Z",
  studentExamType: "KPSS",
  coachNote: null,
  riskFlags: ["INACTIVE"],
  activity: {
    lastActiveDate: "2026-09-01",
    currentStreak: 0,
    longestStreak: 4,
    sessions7d: 0,
    focusMinutes7d: 0,
    activeDays7d: 0,
    sessions28d: 5,
    focusMinutes28d: 200,
    activeDays28d: 4,
  },
  planCompletionRate7d: 0.2,
  mockTrend: [],
  latestMockSubjects: [],
  planTasks: [],
  droppedAssignments: [],
  moodTrend: [],
  ...over,
});

const PERIOD = "33333333-3333-4333-8333-333333333333";
const HISTORY_LIMIT = 20;

/** A stored history row, the thing a new brief measures itself against. */
function historyRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "brief-1",
    linkId: "link-1",
    periodId: PERIOD,
    brief: "Onceki brief",
    model: "fake-model",
    fingerprint: "other-fingerprint",
    snapshot: {
      riskFlags: [],
      planCompletionRate7d: 0.1,
      sessions7d: 0,
      focusMinutes7d: 0,
      activeDays7d: 0,
      latestMockAt: null,
      latestNet: null,
      moodMean: null,
      attendedAt: null,
    },
    delta: null,
    generatedAt: new Date("2026-09-03T09:00:00Z"),
    ...over,
  };
}

function setup(link: {
  brief?: string | null;
  briefAt?: Date | null;
  briefFingerprint?: string | null;
  /** The link stopped being ACTIVE while the model was still writing. */
  linkEnded?: boolean;
  /** The previous brief of this period, if any. */
  previous?: ReturnType<typeof historyRow> | null;
}) {
  const current = report();
  const links = {
    assertEnabled: vi.fn(async () => undefined),
    requireActiveLink: vi.fn(async () => ({
      id: "link-1",
      periodId: PERIOD,
      brief: link.brief ?? null,
      briefAt: link.briefAt ?? null,
      briefFingerprint: link.briefFingerprint ?? null,
    })),
  };
  const roster = { getStudentReport: vi.fn(async () => current) };
  const repo = {
    setBrief: vi.fn(async () =>
      link.linkEnded ? undefined : new Date("2026-09-05T12:00:00Z"),
    ),
  };
  const history = {
    findLatest: vi.fn(async () => link.previous ?? undefined),
    append: vi.fn(async () => historyRow()),
    list: vi.fn(async () => ({ rows: [], total: 0 })),
  };
  const followups = {
    countInWindow: vi.fn(async () => ({ opened: 0, closed: 0 })),
  };
  const config = { get: vi.fn(async () => HISTORY_LIMIT) };
  const writer = { generate: vi.fn(async () => ({ text: "Yeni brief", model: "fake-model" })) };
  return {
    service: new MentorshipBriefService(
      roster as never,
      links as never,
      repo as never,
      history as never,
      followups as never,
      config as never,
      writer as never,
    ),
    roster,
    repo,
    history,
    followups,
    writer,
    current,
  };
}

describe("MentorshipBriefService", () => {
  it("writes a brief and stores it against the report it was written from", async () => {
    const { service, repo, writer, current } = setup({});
    const result = await service.generate(COACH, STUDENT);

    expect(result).toMatchObject({ brief: "Yeni brief", model: "fake-model" });
    expect(writer.generate).toHaveBeenCalledOnce();
    // The stored fingerprint has to be the one a later call recomputes, or the cache never hits.
    expect(repo.setBrief).toHaveBeenCalledWith(
      "link-1",
      "Yeni brief",
      mentorshipBriefFingerprint(current, "tr"),
    );
  });

  /**
   * The load-bearing one. A coach clicking twice on a student who has not moved would otherwise
   * spend a second quota unit and a second LLM call on a byte-identical answer.
   */
  it("returns the stored brief without paying again when the report has not moved", async () => {
    const unchanged = mentorshipBriefFingerprint(report(), "tr");
    const { service, repo, writer } = setup({
      brief: "Eski brief",
      briefAt: new Date("2026-09-04T09:00:00Z"),
      briefFingerprint: unchanged,
    });

    const result = await service.generate(COACH, STUDENT);
    expect(result).toEqual({
      brief: "Eski brief",
      model: "cache",
      generatedAt: "2026-09-04T09:00:00.000Z",
      delta: null,
    });
    expect(writer.generate).not.toHaveBeenCalled();
    expect(repo.setBrief).not.toHaveBeenCalled();
  });

  it("regenerates once the student actually did something", async () => {
    // A fingerprint from a different report: same student, different numbers.
    const stale = mentorshipBriefFingerprint(report({ planCompletionRate7d: 0.9 }), "tr");
    const { service, writer } = setup({
      brief: "Eski brief",
      briefAt: new Date("2026-09-04T09:00:00Z"),
      briefFingerprint: stale,
    });

    const result = await service.generate(COACH, STUDENT);
    expect(result.model).toBe("fake-model");
    expect(writer.generate).toHaveBeenCalledOnce();
  });

  it("charges the coach, never the student", async () => {
    const { service, writer } = setup({});
    await service.generate(COACH, STUDENT);
    // The actor is not the subject: the coach's id and roles decide the quota and the meter row.
    expect(writer.generate).toHaveBeenCalledWith(expect.anything(), null, COACH, "tr");
  });
});

/**
 * Writing a brief takes a whole LLM call, and either side can end the link at any point during it.
 * Returning the text anyway would hand a fresh summary of a student to a coach who had already
 * been cut off from them — the one thing the gate exists to prevent.
 */
describe("MentorshipBriefService — the link ends mid-generation", () => {
  it("drops the brief instead of handing it to a coach who lost access", async () => {
    const { service } = setup({ linkEnded: true });
    await expect(service.generate(COACH, STUDENT)).rejects.toMatchObject({
      code: "MENTORSHIP_LINK_NOT_FOUND",
    });
  });

  it("records nothing in the history either", async () => {
    // A history row for a brief the coach was never shown would become the baseline the NEXT brief
    // measures against, so the memory would start from something that never happened.
    const { service, history } = setup({ linkEnded: true });
    await expect(service.generate(COACH, STUDENT)).rejects.toThrow();
    expect(history.append).not.toHaveBeenCalled();
  });
});

/** APP-093: the link row stays the cache, and this table becomes the memory. */
describe("MentorshipBriefService — brief memory", () => {
  it("records the brief it just wrote, with the snapshot the next one will measure against", async () => {
    const { service, history, current } = setup({});
    await service.generate(COACH, STUDENT);

    expect(history.append).toHaveBeenCalledOnce();
    const [row, limit] = history.append.mock.calls[0]!;
    expect(row).toMatchObject({ linkId: "link-1", periodId: PERIOD, brief: "Yeni brief" });
    expect(row.snapshot.planCompletionRate7d).toBe(current.planCompletionRate7d);
    expect(limit).toBe(HISTORY_LIMIT);
  });

  it("records no delta on the first brief of a relationship", async () => {
    // Not an empty delta: "nothing changed" and "there was nothing to compare" are different
    // statements, and the band only renders the first one.
    const { service, history, writer } = setup({ previous: null });
    await service.generate(COACH, STUDENT);
    expect(history.append.mock.calls[0]![0].delta).toBeNull();
    expect(writer.generate.mock.calls[0]![1]).toBeNull();
  });

  it("measures the second brief against the first and hands the model the movement", async () => {
    const { service, writer } = setup({ previous: historyRow() });
    const result = await service.generate(COACH, STUDENT);

    // The stored snapshot had 0.1 completion and no flags; the report has 0.2 and INACTIVE.
    expect(result.delta).toMatchObject({
      previousGeneratedAt: "2026-09-03T09:00:00.000Z",
      flagsAdded: ["INACTIVE"],
      planCompletion: { previous: 0.1, current: 0.2, change: 0.1 },
      quiet: false,
    });
    // Same object the model was given: the delta is an input to the prompt, never its output.
    expect(writer.generate.mock.calls[0]![1]).toEqual(result.delta);
  });

  it("counts the coach's follow-up activity from the previous brief onwards", async () => {
    const { service, followups } = setup({ previous: historyRow() });
    followups.countInWindow.mockResolvedValueOnce({ opened: 2, closed: 1 });

    const result = await service.generate(COACH, STUDENT);
    expect(followups.countInWindow).toHaveBeenCalledWith(
      "link-1",
      PERIOD,
      new Date("2026-09-03T09:00:00Z"),
    );
    expect(result.delta?.coachActions).toMatchObject({
      followupsOpened: 2,
      followupsClosed: 1,
    });
  });

  it("adds nothing to the history when the cache answers", async () => {
    // No model ran, so there is no new brief to remember — and re-recording the cached one would
    // reset the baseline every time the coach opened the page.
    const unchanged = mentorshipBriefFingerprint(report(), "tr");
    const { service, history } = setup({
      brief: "Eski brief",
      briefAt: new Date("2026-09-04T09:00:00Z"),
      briefFingerprint: unchanged,
      previous: historyRow({ fingerprint: unchanged }),
    });

    await service.generate(COACH, STUDENT);
    expect(history.append).not.toHaveBeenCalled();
  });

  it("hands back the cached brief's own delta, not a newer row's", async () => {
    const unchanged = mentorshipBriefFingerprint(report(), "tr");
    const stored = { previousGeneratedAt: "2026-09-01T09:00:00.000Z", quiet: true };
    const { service } = setup({
      brief: "Eski brief",
      briefAt: new Date("2026-09-04T09:00:00Z"),
      briefFingerprint: unchanged,
      previous: historyRow({ fingerprint: unchanged, delta: stored }),
    });

    const result = await service.generate(COACH, STUDENT);
    expect(result.delta).toEqual(stored);
  });

  it("shows no delta beside a cached brief the stored row does not describe", async () => {
    // A history row written under a different fingerprint belongs to a different brief. Pairing it
    // with this text would date the band's "since" to a moment that has nothing to do with it.
    const unchanged = mentorshipBriefFingerprint(report(), "tr");
    const { service } = setup({
      brief: "Eski brief",
      briefAt: new Date("2026-09-04T09:00:00Z"),
      briefFingerprint: unchanged,
      previous: historyRow({ fingerprint: "something-else", delta: { quiet: true } }),
    });

    const result = await service.generate(COACH, STUDENT);
    expect(result.delta).toBeNull();
  });
});

describe("MentorshipBriefService — reading the history", () => {
  it("goes through the gate before reading anything", async () => {
    const { service, history } = setup({});
    await service.listHistory(COACH.id, STUDENT, 1, 10);
    expect(history.list).toHaveBeenCalledWith("link-1", PERIOD, 1, 10);
  });
});
