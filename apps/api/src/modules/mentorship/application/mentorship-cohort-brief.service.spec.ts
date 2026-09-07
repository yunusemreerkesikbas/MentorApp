import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MentorshipRosterRowDto } from "@mentor/types";
import { MentorshipCohortBriefService } from "./mentorship-cohort-brief.service";

function row(over: Partial<MentorshipRosterRowDto> = {}): MentorshipRosterRowDto {
  return {
    linkId: "link",
    studentId: "student-a",
    studentDisplayName: "Ayşe",
    studentUsername: "ayse",
    status: "ACTIVE",
    acceptedAt: "2026-08-01T00:00:00.000Z",
    endedAt: null,
    metrics: {
      lastActiveDate: "2026-09-03",
      currentStreak: 0,
      focusMinutes7d: 40,
      sessions7d: 1,
      activeDays7d: 1,
      planCompletionRate7d: 0.2,
      latestMockNet: 42,
      latestMockAt: "2026-09-01T00:00:00.000Z",
      moodLevel7dAvg: 2,
    },
    riskFlags: ["INACTIVE"],
    attendedAt: null,
    needsAttention: true,
    ...over,
  } as MentorshipRosterRowDto;
}

const COACH = { id: "coach-1", roles: ["COACH"] };

describe("MentorshipCohortBriefService", () => {
  let generate: ReturnType<typeof vi.fn>;
  let upsert: ReturnType<typeof vi.fn>;
  let find: ReturnType<typeof vi.fn>;
  let listRoster: ReturnType<typeof vi.fn>;
  let listByCoach: ReturnType<typeof vi.fn>;
  let assertEnabled: ReturnType<typeof vi.fn>;
  let service: MentorshipCohortBriefService;

  function build(rows: MentorshipRosterRowDto[] = [row()]) {
    generate = vi.fn(async () => ({
      overall: "Bir öğrenci dikkat istiyor.",
      items: [{ ref: "S1", why: "Dört gündür girmedi.", action: "Bir mesaj at." }],
      model: "fake",
    }));
    upsert = vi.fn(async () => undefined);
    find = vi.fn(async () => null);
    listRoster = vi.fn(async () => ({ items: rows, total: rows.length, page: 1, pageSize: 20 }));
    listByCoach = vi.fn(async () => ({
      rows: rows.map((r) => ({ studentId: r.studentId })),
      total: rows.length,
    }));
    assertEnabled = vi.fn(async () => undefined);
    service = new MentorshipCohortBriefService(
      { assertEnabled } as never,
      { listByCoach } as never,
      { listRoster } as never,
      { find, upsert } as never,
      {
        listDisplayIdentities: vi.fn(async (ids: string[]) =>
          new Map(ids.map((id) => [id, { displayName: `name-${id}`, username: id }])),
        ),
      } as never,
      { get: vi.fn(async () => 20) } as never,
      { generate } as never,
    );
  }

  beforeEach(() => build());

  it("refuses before doing anything when the surface is off", async () => {
    build();
    assertEnabled.mockRejectedValueOnce(new Error("MENTORSHIP_DISABLED"));
    await expect(service.generate(COACH)).rejects.toThrow("MENTORSHIP_DISABLED");
    expect(listRoster).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });

  it("returns null and calls no model when nothing was ever written", async () => {
    await expect(service.read(COACH.id)).resolves.toBeNull();
    expect(generate).not.toHaveBeenCalled();
  });

  it("maps a ref back to the student it described", async () => {
    const result = await service.generate(COACH);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.studentId).toBe("student-a");
    expect(result.items[0]!.studentDisplayName).toBe("name-student-a");
    // The evidence chips come from the rules, not from the model's sentence.
    expect(result.items[0]!.riskFlags).toEqual(["INACTIVE"]);
  });

  it("spends nothing when the cohort has not moved since the stored brief", async () => {
    const first = await service.generate(COACH);
    const stored = upsert.mock.calls[0]!;
    find.mockResolvedValue({
      brief: stored[1],
      fingerprint: stored[2],
      pairs: stored[3],
      generatedAt: stored[4],
    });
    generate.mockClear();

    const second = await service.generate(COACH);
    expect(generate).not.toHaveBeenCalled();
    expect(second.model).toBe("cache");
    expect(second.overall).toBe(first.overall);
  });

  it("marks a student new only while the previous brief did not carry their flag", async () => {
    const fresh = await service.generate(COACH);
    expect(fresh.items[0]!.isNew).toBe(true);

    // Same student, same flag, but the cohort moved enough to miss the fingerprint.
    find.mockResolvedValue({
      brief: { overall: "eski", items: [] },
      fingerprint: "stale",
      pairs: ["student-a:INACTIVE"],
      generatedAt: new Date(),
    });
    const repeat = await service.generate(COACH);
    expect(repeat.items[0]!.isNew).toBe(false);
  });

  it("records only the lines the coach can actually read", async () => {
    // The model answers about S1 only; S2 was selected but never written about, so tomorrow it
    // must still be able to arrive as news.
    build([row({ studentId: "student-a" }), row({ studentId: "student-b" })]);
    await service.generate(COACH);
    expect(upsert.mock.calls[0]![3]).toEqual(["student-a:INACTIVE"]);
  });

  it("writes no brief and calls no model when nobody needs attention", async () => {
    build([row({ needsAttention: false })]);
    const result = await service.generate(COACH);
    expect(generate).not.toHaveBeenCalled();
    expect(result.items).toEqual([]);
    expect(result.model).toBe("empty");
    // Still stored, so an unchanged calm cohort is recognised on the next call.
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("drops a line about a student the coach no longer follows", async () => {
    await service.generate(COACH);
    const stored = upsert.mock.calls[0]!;
    find.mockResolvedValue({
      brief: stored[1],
      fingerprint: stored[2],
      pairs: stored[3],
      generatedAt: stored[4],
    });
    // The link ended after the brief was written: consent is gone, so the line goes with it.
    listByCoach.mockResolvedValue({ rows: [], total: 0 });

    const result = await service.read(COACH.id);
    expect(result!.items).toEqual([]);
  });
});
