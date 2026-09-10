import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  deletePendingMentorshipGroup,
  updatePendingMentorshipGroup,
} from "./plan-task-mentorship.repository";

const STUDENT = "00000000-0000-4000-8000-000000000002";
const LINK = "00000000-0000-4000-8000-000000000012";
const GROUP = "00000000-0000-4000-8000-000000000020";
const expectedSignature = {
  taskDate: "2026-09-10",
  title: "Paragraf",
  subject: "Türkçe",
  topic: null,
  startTime: "09:00",
  endTime: null,
  coachNote: "20 soru",
};

describe("plan-task mentorship group predicates", () => {
  it("constrains updates by every visible signature field", async () => {
    const capture = mutationCapture("update");

    await updatePendingMentorshipGroup(
      capture.tx,
      [{ studentId: STUDENT, mentorshipLinkId: LINK }],
      GROUP,
      expectedSignature,
      { title: "Yeni başlık" },
    );

    expect(render(capture.where())).toMatchObject({
      params: expect.arrayContaining([
        GROUP,
        "PENDING",
        "MENTORSHIP",
        STUDENT,
        LINK,
        expectedSignature.taskDate,
        expectedSignature.title,
        expectedSignature.subject,
        expectedSignature.startTime,
        expectedSignature.coachNote,
      ]),
    });
    expect(render(capture.where()).sql).toContain('"plan_tasks"."topic" is null');
    expect(render(capture.where()).sql).toContain('"plan_tasks"."end_time" is null');
  });

  it("constrains deletes by the same visible signature", async () => {
    const capture = mutationCapture("delete");

    await deletePendingMentorshipGroup(
      capture.tx,
      [{ studentId: STUDENT, mentorshipLinkId: LINK }],
      GROUP,
      expectedSignature,
    );

    const query = render(capture.where());
    expect(query.params).toEqual(expect.arrayContaining([
      GROUP,
      STUDENT,
      LINK,
      expectedSignature.taskDate,
      expectedSignature.title,
    ]));
    expect(query.sql).toContain('"plan_tasks"."coach_note" =');
  });
});

function mutationCapture(kind: "update" | "delete") {
  let predicate: unknown;
  const returning = vi.fn(async () => []);
  const where = vi.fn((value: unknown) => {
    predicate = value;
    return { returning };
  });
  const tx = {
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where })),
    })),
    delete: vi.fn(() => ({ where })),
  };
  return {
    tx: tx as never,
    where: () => {
      expect(predicate).toBeDefined();
      return predicate!;
    },
    kind,
  };
}

function render(value: unknown): { sql: string; params: unknown[] } {
  return new PgDialect().sqlToQuery(value as never);
}
