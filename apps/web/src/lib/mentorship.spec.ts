import { beforeEach, describe, expect, it, vi } from "vitest";
import { http } from "@mentor/api-client";
import {
  assignTasksBatch,
  cancelCoachPlanEvent,
  createCoachPlanEvent,
  fetchActiveRoster,
  fetchCoachPlan,
  removeAssignment,
  removeAssignmentGroup,
  updateAssignment,
  updateAssignmentGroup,
  updateCoachPlanEvent,
} from "./mentorship";

vi.mock("@mentor/api-client", () => ({ http: vi.fn() }));

const mockedHttp = vi.mocked(http);

describe("fetchCoachPlan", () => {
  beforeEach(() => {
    mockedHttp.mockReset();
  });

  it("collects every bounded page without changing backend order", async () => {
    mockedHttp
      .mockResolvedValueOnce({
        items: [{ kind: "TASK", task: { id: "first" } }],
        total: 2,
        page: 1,
        pageSize: 100,
      })
      .mockResolvedValueOnce({
        items: [{ kind: "EVENT", event: { id: "second" } }],
        total: 2,
        page: 2,
        pageSize: 100,
      });

    const result = await fetchCoachPlan({
      from: "2026-09-07",
      to: "2026-09-13",
      studentId: "00000000-0000-4000-8000-000000000002",
    });

    expect(result.map((item) => item.kind)).toEqual(["TASK", "EVENT"]);
    expect(mockedHttp).toHaveBeenNthCalledWith(
      1,
      "/v1/mentorship/plan?from=2026-09-07&to=2026-09-13&studentId=00000000-0000-4000-8000-000000000002&page=1&pageSize=100",
    );
    expect(mockedHttp).toHaveBeenNthCalledWith(
      2,
      "/v1/mentorship/plan?from=2026-09-07&to=2026-09-13&studentId=00000000-0000-4000-8000-000000000002&page=2&pageSize=100",
    );
  });
});

describe("fetchActiveRoster", () => {
  beforeEach(() => {
    mockedHttp.mockReset();
  });

  it("collects every active roster page for the filter", async () => {
    mockedHttp
      .mockResolvedValueOnce({
        items: [{ studentId: "first" }],
        total: 2,
        page: 1,
        pageSize: 100,
      })
      .mockResolvedValueOnce({
        items: [{ studentId: "second" }],
        total: 2,
        page: 2,
        pageSize: 100,
      });

    const result = await fetchActiveRoster();

    expect(result.map((row) => row.studentId)).toEqual(["first", "second"]);
    expect(mockedHttp).toHaveBeenNthCalledWith(
      2,
      "/v1/mentorship/students?status=ACTIVE&page=2&pageSize=100",
    );
  });
});

describe("coach plan mutations", () => {
  beforeEach(() => {
    mockedHttp.mockReset();
    mockedHttp.mockResolvedValue(undefined);
  });

  it("posts a batch assignment", async () => {
    const input = {
      studentIds: ["00000000-0000-4000-8000-000000000002"],
      task: { title: "Paragraf" },
    };
    await assignTasksBatch(input);
    expect(mockedHttp).toHaveBeenCalledWith("/v1/mentorship/assignments", {
      method: "POST",
      body: JSON.stringify(input),
    });
  });

  it("updates and removes one student assignment", async () => {
    const input = { title: "Yeni başlık" };
    await updateAssignment("student id", "task id", input);
    await removeAssignment("student id", "task id");
    expect(mockedHttp).toHaveBeenNthCalledWith(
      1,
      "/v1/mentorship/students/student%20id/assignments/task%20id",
      { method: "PATCH", body: JSON.stringify(input) },
    );
    expect(mockedHttp).toHaveBeenNthCalledWith(
      2,
      "/v1/mentorship/students/student%20id/assignments/task%20id",
      { method: "DELETE" },
    );
  });

  it("updates and removes selected members of an assignment group", async () => {
    const update = {
      studentIds: ["00000000-0000-4000-8000-000000000002"],
      title: "Yeni başlık",
    };
    const remove = { studentIds: update.studentIds };
    await updateAssignmentGroup("group id", update);
    await removeAssignmentGroup("group id", remove);
    expect(mockedHttp).toHaveBeenNthCalledWith(
      1,
      "/v1/mentorship/assignment-groups/group%20id",
      { method: "PATCH", body: JSON.stringify(update) },
    );
    expect(mockedHttp).toHaveBeenNthCalledWith(
      2,
      "/v1/mentorship/assignment-groups/group%20id",
      { method: "DELETE", body: JSON.stringify(remove) },
    );
  });

  it("creates, updates and cancels coach events", async () => {
    const create = {
      title: "Görüşme",
      eventDate: "2026-09-10",
      attendeeIds: [],
    };
    const update = { scope: "OCCURRENCE" as const, title: "Yeni görüşme" };
    const cancel = { scope: "SERIES" as const };
    await createCoachPlanEvent(create);
    await updateCoachPlanEvent("event id", update);
    await cancelCoachPlanEvent("event id", cancel);
    expect(mockedHttp).toHaveBeenNthCalledWith(1, "/v1/mentorship/events", {
      method: "POST",
      body: JSON.stringify(create),
    });
    expect(mockedHttp).toHaveBeenNthCalledWith(
      2,
      "/v1/mentorship/events/event%20id",
      { method: "PATCH", body: JSON.stringify(update) },
    );
    expect(mockedHttp).toHaveBeenNthCalledWith(
      3,
      "/v1/mentorship/events/event%20id/cancel",
      { method: "POST", body: JSON.stringify(cancel) },
    );
  });
});
