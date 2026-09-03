import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlanTaskFeedbackListener } from "./plan-task-feedback.listener";
import { PlanTaskCompleted, PlanTaskDeleted } from "../../coaching/domain/coaching.events";
import { MentorshipEventTopic } from "../domain/mentorship.constants";

const LINK = "11111111-1111-4111-8111-111111111111";
const COACH = "22222222-2222-4222-8222-222222222222";
const STUDENT = "33333333-3333-4333-8333-333333333333";

function setup(link?: { id: string; coachId: string; status: string } | undefined) {
  const emitted: { topic: string; payload: unknown }[] = [];
  const links = { findById: vi.fn(async () => link) };
  const users = {
    listDisplayIdentities: vi.fn(async () => new Map([[STUDENT, { displayName: "Ayşe" }]])),
  };
  const events = {
    emit: vi.fn((topic: string, payload: unknown) => {
      emitted.push({ topic, payload });
      return true;
    }),
  };
  const listener = new PlanTaskFeedbackListener(links as never, users as never, events as never);
  return { listener, emitted, links, users };
}

const activeLink = { id: LINK, coachId: COACH, status: "ACTIVE" };

const deleted = (originType: string | null, originRefId: string | null) =>
  new PlanTaskDeleted(STUDENT, "task-1", "2026-09-10", "Paragraf 20 soru", originType, originRefId);

const completed = (originType: string | null, originRefId: string | null) =>
  new PlanTaskCompleted(STUDENT, "task-1", "2026-09-10", originType, originRefId);

describe("PlanTaskFeedbackListener", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ignores a task the student wrote themselves — without even looking up a link", async () => {
    const { listener, emitted, links } = setup(activeLink);
    await listener.onPlanTaskDeleted(deleted(null, null));
    expect(emitted).toEqual([]);
    expect(links.findById).not.toHaveBeenCalled();
  });

  it("ignores an AI-coach task: only a human coach is waiting to hear", async () => {
    const { listener, emitted } = setup(activeLink);
    await listener.onPlanTaskCompleted(completed("AI_COACH", "msg-1"));
    expect(emitted).toEqual([]);
  });

  it("tells the coach when their assignment is removed, with the title they wrote", async () => {
    const { listener, emitted } = setup(activeLink);
    await listener.onPlanTaskDeleted(deleted("MENTORSHIP", LINK));
    expect(emitted).toHaveLength(1);
    expect(emitted[0]!.topic).toBe(MentorshipEventTopic.ASSIGNMENT_DROPPED);
    expect(emitted[0]!.payload).toMatchObject({
      coachId: COACH,
      studentId: STUDENT,
      studentDisplayName: "Ayşe",
      taskTitle: "Paragraf 20 soru",
    });
  });

  it("tells the coach when their assignment is completed", async () => {
    const { listener, emitted } = setup(activeLink);
    await listener.onPlanTaskCompleted(completed("MENTORSHIP", LINK));
    expect(emitted).toHaveLength(1);
    expect(emitted[0]!.topic).toBe(MentorshipEventTopic.ASSIGNMENT_PROGRESSED);
  });

  it("says nothing to a coach whose link has ENDED", async () => {
    // The event-side counterpart of the roster's `metrics: null` rule: revoked consent stops the
    // data, and a notification about the student IS data about the student.
    const { listener, emitted } = setup({ ...activeLink, status: "ENDED" });
    await listener.onPlanTaskDeleted(deleted("MENTORSHIP", LINK));
    await listener.onPlanTaskCompleted(completed("MENTORSHIP", LINK));
    expect(emitted).toEqual([]);
  });

  it("says nothing when the link is gone — the soft ref outlived its row (erasure)", async () => {
    const { listener, emitted } = setup(undefined);
    await listener.onPlanTaskDeleted(deleted("MENTORSHIP", LINK));
    expect(emitted).toEqual([]);
  });

  it("never throws back into the plan change that already committed", async () => {
    const { listener, emitted, links } = setup(activeLink);
    links.findById.mockRejectedValueOnce(new Error("db down") as never);
    await expect(listener.onPlanTaskCompleted(completed("MENTORSHIP", LINK))).resolves.toBeUndefined();
    expect(emitted).toEqual([]);
  });
});
