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

function setup(link: {
  brief?: string | null;
  briefAt?: Date | null;
  briefFingerprint?: string | null;
  /** The link stopped being ACTIVE while the model was still writing. */
  linkEnded?: boolean;
}) {
  const current = report();
  const links = {
    assertEnabled: vi.fn(async () => undefined),
    requireActiveLink: vi.fn(async () => ({
      id: "link-1",
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
  const writer = { generate: vi.fn(async () => ({ text: "Yeni brief", model: "fake-model" })) };
  return {
    service: new MentorshipBriefService(
      roster as never,
      links as never,
      repo as never,
      writer as never,
    ),
    roster,
    repo,
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
    expect(writer.generate).toHaveBeenCalledWith(expect.anything(), COACH, "tr");
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
});
