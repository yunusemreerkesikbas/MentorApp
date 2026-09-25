import { describe, expect, it, vi } from "vitest";
import { MentorshipRosterService } from "./mentorship-roster.service";

const studentId = "00000000-0000-4000-8000-000000000002";
const STRIP = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 25, 0, 25];

async function listRoster() {
  const service = new MentorshipRosterService(
    {
      listByCoach: vi.fn(async () => ({
        rows: [{
          id: "00000000-0000-4000-8000-000000000012",
          studentId,
          status: "ACTIVE",
          acceptedAt: new Date("2026-09-01T00:00:00.000Z"),
          endedAt: null,
          attendedAt: null,
          attendedFlags: [],
        }],
        total: 1,
      })),
    } as never,
    {} as never,
    { assertEnabled: vi.fn() } as never,
    {
      listCohortSnapshots: vi.fn(async () => new Map([
        [studentId, {
          studentId,
          lastActiveDate: "2026-09-09",
          currentStreak: 2,
          focusMinutes7d: 50,
          dailyFocusMinutes14d: STRIP,
          sessions7d: 2,
          activeDays7d: 2,
          planCompletionRate7d: 0.5,
          latestMockNet: null,
          latestMockAt: null,
          moodLevel7dAvg: null,
          previousMockNets: [],
        }],
      ])),
    } as never,
    {
      listDisplayIdentities: vi.fn(async () => new Map([
        [studentId, {
          userId: studentId,
          displayName: "Ayşe",
          username: "ayse",
          avatarUrl: "https://cdn.example/avatars/ayse.png",
        }],
      ])),
    } as never,
    {
      get: vi.fn(async (key: string) => ({
        "mentorship.risk.inactive_days": 3,
        "mentorship.risk.plan_completion_floor": 0.5,
        "mentorship.risk.low_mood_ceiling": 2,
        "mentorship.attention.ttl_days": 3,
      })[key]),
    } as never,
  );

  return service.listRoster(
    "00000000-0000-4000-8000-000000000001",
    "ACTIVE",
    1,
    100,
    new Date("2026-09-09T12:00:00.000Z"),
  );
}

describe("MentorshipRosterService", () => {
  it("projects the public avatar URL from the resolved display identity", async () => {
    const result = await listRoster();
    expect(result.items[0]).toMatchObject({
      studentId,
      avatarUrl: "https://cdn.example/avatars/ayse.png",
    });
    expect(JSON.stringify(result)).not.toContain("avatarStorageKey");
  });

  it("carries the 14-day activity strip the row draws", async () => {
    const result = await listRoster();
    expect(result.items[0]?.metrics?.dailyFocusMinutes14d).toEqual(STRIP);
  });

  describe("reads that only need the flags", () => {
    const LINK = "00000000-0000-4000-8000-000000000012";
    const NOW = new Date("2026-09-09T12:00:00.000Z");

    /** Only the triage read exists here: a call for the roster's strip and streak would throw. */
    function triageOnly() {
      const links = { setAttention: vi.fn(async () => undefined) };
      const evidence = {
        listTriageSnapshots: vi.fn(async () => new Map([
          [studentId, {
            studentId,
            lastActiveDate: "2026-09-01",
            focusMinutes7d: 0,
            sessions7d: 0,
            activeDays7d: 0,
            planCompletionRate7d: null,
            latestMockNet: null,
            latestMockAt: null,
            previousMockNetAvg: null,
            moodLevel7dAvg: null,
          }],
        ])),
        getStudentReport: vi.fn(async () => ({})),
      };
      const service = new MentorshipRosterService(
        links as never,
        { listByLink: vi.fn(async () => []) } as never,
        {
          assertEnabled: vi.fn(),
          requireActiveLink: vi.fn(async () => ({
            id: LINK,
            acceptedAt: null,
            attendedAt: null,
            attendedFlags: [],
          })),
        } as never,
        evidence as never,
        {
          listDisplayIdentities: vi.fn(async () => new Map()),
          getDiscoveryProfile: vi.fn(async () => ({ examType: null })),
        } as never,
        {
          get: vi.fn(async (key: string) => ({
            "mentorship.risk.inactive_days": 3,
            "mentorship.risk.plan_completion_floor": 0.5,
            "mentorship.risk.low_mood_ceiling": 2,
            "mentorship.attention.ttl_days": 3,
          })[key]),
        } as never,
      );
      return { service, links, evidence };
    }

    it("marks a student from the triage read", async () => {
      const { service, links, evidence } = triageOnly();
      await service.setAttention("coach", studentId, true, NOW);
      expect(evidence.listTriageSnapshots).toHaveBeenCalledWith([studentId], NOW);
      expect(links.setAttention).toHaveBeenCalledWith(LINK, ["INACTIVE"]);
    });

    it("flags the report from the triage read", async () => {
      const { service, evidence } = triageOnly();
      const report = await service.getStudentReport("coach", studentId, NOW);
      expect(evidence.listTriageSnapshots).toHaveBeenCalledWith([studentId], NOW);
      expect(report.riskFlags).toEqual(["INACTIVE"]);
    });
  });
});
