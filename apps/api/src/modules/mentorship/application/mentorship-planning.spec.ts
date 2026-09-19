import { describe, expect, it, vi } from "vitest";
import { listMentorshipPlanningTasksSchema } from "@mentor/validation";
import { MentorshipRosterService } from "./mentorship-roster.service";

describe("weekly planning access", () => {
  const query = { from: "2026-09-14", to: "2026-09-20", page: 2, pageSize: 10 };
  it("bounds reads to seven valid calendar dates", () => {
    expect(listMentorshipPlanningTasksSchema.safeParse(query).success).toBe(
      true,
    );
    for (const to of ["2026-09-21", "2026-09-13", "invalid"]) {
      expect(
        listMentorshipPlanningTasksSchema.safeParse({ ...query, to }).success,
      ).toBe(false);
    }
  });
  it("checks the flag and active link before reading the student's tasks", async () => {
    const gate = {
      assertEnabled: vi.fn(),
      requireActiveLink: vi.fn().mockResolvedValue({ id: "link" }),
    };
    const evidence = {
      listPlanningTasks: vi
        .fn()
        .mockResolvedValue({ items: [], total: 0, page: 2, pageSize: 10 }),
    };
    const service = new MentorshipRosterService(
      {} as never,
      {} as never,
      gate as never,
      evidence as never,
      {} as never,
      {} as never,
    );
    await service.listPlanningTasks("coach", "student", query);
    expect(gate.requireActiveLink).toHaveBeenCalledWith("coach", "student");
    expect(evidence.listPlanningTasks).toHaveBeenCalledWith(
      "student",
      "link",
      query.from,
      query.to,
      2,
      10,
    );
    evidence.listPlanningTasks.mockClear();
    gate.requireActiveLink.mockRejectedValue(new Error("not found"));
    await expect(
      service.listPlanningTasks("other-coach", "student", query),
    ).rejects.toThrow("not found");
    expect(evidence.listPlanningTasks).not.toHaveBeenCalled();
    gate.assertEnabled.mockRejectedValue(new Error("disabled"));
    await expect(
      service.listPlanningTasks("coach", "student", query),
    ).rejects.toThrow("disabled");
  });
});
