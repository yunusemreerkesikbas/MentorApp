import { describe, expect, it, vi, beforeEach } from "vitest";
import { mentorshipCoachControllerListPlanningTasks } from "@mentor/api-client";
import { fetchPlanningTasks } from "./mentorship-plan";

vi.mock("@mentor/api-client", () => ({
  http: vi.fn(),
  mentorshipCoachControllerListPlanningTasks: vi.fn(),
}));
const read = vi.mocked(mentorshipCoachControllerListPlanningTasks);
const row = (id: string) => ({
  id,
  taskDate: "2026-09-21",
  title: "Task",
  subject: null,
  topic: null,
  status: "PENDING",
  assignedByCoach: true,
  coachNote: null,
});
beforeEach(() => read.mockReset());

describe("complete planning week reads", () => {
  it("collects every page before returning rows", async () => {
    read.mockResolvedValueOnce({
      items: [row("a")],
      total: 2,
      page: 1,
      pageSize: 1,
    });
    read.mockResolvedValueOnce({
      items: [row("b")],
      total: 2,
      page: 2,
      pageSize: 1,
    });
    expect(
      (await fetchPlanningTasks("student", "2026-09-21", "2026-09-27")).map(
        (r) => r.id,
      ),
    ).toEqual(["a", "b"]);
    expect(read.mock.calls[1]?.[1].page).toBe(2);
  });
  it("does not return a partial week after a later page fails", async () => {
    read.mockResolvedValueOnce({
      items: [row("a")],
      total: 2,
      page: 1,
      pageSize: 1,
    });
    read.mockRejectedValueOnce(new Error("offline"));
    await expect(
      fetchPlanningTasks("student", "2026-09-21", "2026-09-27"),
    ).rejects.toThrow("offline");
  });
  it("rejects a truncated response and honors cancellation", async () => {
    read.mockResolvedValueOnce({ items: [], total: 2, page: 1, pageSize: 100 });
    await expect(
      fetchPlanningTasks("student", "2026-09-21", "2026-09-27"),
    ).rejects.toThrow("before total");
    const controller = new AbortController();
    controller.abort();
    read.mockClear();
    await expect(
      fetchPlanningTasks(
        "student",
        "2026-09-21",
        "2026-09-27",
        controller.signal,
      ),
    ).rejects.toThrow();
    expect(read).not.toHaveBeenCalled();
  });
});
