import { describe, expect, it, vi } from "vitest";
import { MentorshipQueryAdapter } from "./mentorship-query.adapter";

const COACH_A = "11111111-1111-4111-8111-111111111111";
const COACH_B = "aaaaaaaa-1111-4111-8111-111111111111";
const CALM = "22222222-2222-4222-8222-222222222222";
const IDLE = "33333333-3333-4333-8333-333333333333";
const NOW = new Date("2026-09-10T07:00:00.000Z");

/** Active today; nothing a rule would flag. */
function calmSnapshot(studentId: string) {
  return {
    studentId,
    lastActiveDate: "2026-09-10",
    currentStreak: 4,
    focusMinutes7d: 300,
    sessions7d: 6,
    activeDays7d: 5,
    planCompletionRate7d: 0.9,
    latestMockNet: 60,
    latestMockAt: "2026-09-08",
    previousMockNetAvg: 55,
    moodLevel7dAvg: 4,
  };
}

/** Silent for well over the idle window → INACTIVE. */
function idleSnapshot(studentId: string) {
  return { ...calmSnapshot(studentId), lastActiveDate: "2026-08-01", planCompletionRate7d: null };
}

function setup(pairs: { coachId: string; studentId: string }[], snapshots: unknown[]) {
  const listCohortSnapshots = vi.fn(
    async () => new Map(snapshots.map((s) => [(s as { studentId: string }).studentId, s])),
  );
  const links = { listAllActiveLinks: vi.fn(async () => pairs) };
  const evidence = { listCohortSnapshots };
  const users = {
    listDisplayIdentities: vi.fn(
      async (ids: string[]) => new Map(ids.map((id) => [id, { displayName: `Ad ${id.slice(0, 4)}` }])),
    ),
    getNotificationContact: vi.fn(async (id: string) => ({
      email: `${id.slice(0, 4)}@test.local`,
      displayName: `Koç ${id.slice(0, 4)}`,
    })),
  };
  const config = {
    get: vi.fn(async (key: string) =>
      key === "mentorship.risk.inactive_days" ? 3 : key.endsWith("floor") ? 0.5 : 2,
    ),
  };
  const adapter = new MentorshipQueryAdapter(
    links as never,
    evidence as never,
    users as never,
    config as never,
  );
  return { adapter, listCohortSnapshots, users };
}

describe("MentorshipQueryAdapter.listRiskDigestCandidates", () => {
  it("returns nothing — and asks nothing — when no link is active", async () => {
    const { adapter, listCohortSnapshots } = setup([], []);
    await expect(adapter.listRiskDigestCandidates(NOW)).resolves.toEqual([]);
    expect(listCohortSnapshots).not.toHaveBeenCalled();
  });

  it("leaves out a coach whose students are all doing fine", async () => {
    const { adapter } = setup([{ coachId: COACH_A, studentId: CALM }], [calmSnapshot(CALM)]);
    await expect(adapter.listRiskDigestCandidates(NOW)).resolves.toEqual([]);
  });

  it("reports only the flagged students, with their names", async () => {
    const { adapter } = setup(
      [
        { coachId: COACH_A, studentId: CALM },
        { coachId: COACH_A, studentId: IDLE },
      ],
      [calmSnapshot(CALM), idleSnapshot(IDLE)],
    );
    const [candidate] = await adapter.listRiskDigestCandidates(NOW);
    expect(candidate!.students).toHaveLength(1);
    expect(candidate!.students[0]).toMatchObject({ studentId: IDLE, flags: ["INACTIVE"] });
    expect(candidate!.students[0]!.displayName).not.toBe("");
  });

  it("snapshots the whole cohort in ONE call, however many coaches share it", async () => {
    // The cost bound that makes an unpaged digest defensible: fixed round trips, not per coach.
    const { adapter, listCohortSnapshots } = setup(
      [
        { coachId: COACH_A, studentId: IDLE },
        { coachId: COACH_B, studentId: CALM },
      ],
      [idleSnapshot(IDLE), calmSnapshot(CALM)],
    );
    await adapter.listRiskDigestCandidates(NOW);
    expect(listCohortSnapshots).toHaveBeenCalledTimes(1);
    expect(listCohortSnapshots.mock.calls[0]![0]).toEqual([IDLE, CALM]);
  });

  it("skips a coach with no contact row rather than half-sending", async () => {
    const { adapter, users } = setup([{ coachId: COACH_A, studentId: IDLE }], [idleSnapshot(IDLE)]);
    users.getNotificationContact.mockResolvedValueOnce(null as never);
    await expect(adapter.listRiskDigestCandidates(NOW)).resolves.toEqual([]);
  });
});
