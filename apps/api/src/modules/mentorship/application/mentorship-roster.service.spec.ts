import { describe, expect, it, vi } from "vitest";
import { MentorshipRosterService } from "./mentorship-roster.service";

describe("MentorshipRosterService", () => {
  it("projects the public avatar URL from the resolved display identity", async () => {
    const studentId = "00000000-0000-4000-8000-000000000002";
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

    const result = await service.listRoster(
      "00000000-0000-4000-8000-000000000001",
      "ACTIVE",
      1,
      100,
      new Date("2026-09-09T12:00:00.000Z"),
    );

    expect(result.items[0]).toMatchObject({
      studentId,
      avatarUrl: "https://cdn.example/avatars/ayse.png",
    });
    expect(JSON.stringify(result)).not.toContain("avatarStorageKey");
  });
});
