import { beforeEach, describe, expect, it, vi } from "vitest";
import { MentorshipEventsListener } from "./mentorship-events.listener";
import {
  MentorshipAssignmentDropped,
  MentorshipAssignmentProgressed,
  MentorshipAssignmentsCreated,
  MentorshipLinkAccepted,
  MentorshipLinkEnded,
  MentorshipNoteUpdated,
} from "../../../mentorship/domain/mentorship.constants";
import { todayIso } from "../../../coaching/domain/date.util";

const LINK = "11111111-1111-4111-8111-111111111111";
const COACH = "22222222-2222-4222-8222-222222222222";
const STUDENT = "33333333-3333-4333-8333-333333333333";

interface Sent {
  userId: string;
  templateKey: string;
  linkUrl?: string;
  options?: { args?: Record<string, unknown>; dedupeKey?: string };
}

function setup() {
  const sent: Sent[] = [];
  const notifications = {
    createFromTemplate: vi.fn(
      async (userId: string, _c: string, templateKey: string, linkUrl?: string, options?: never) => {
        sent.push({ userId, templateKey, linkUrl, options });
        return true;
      },
    ),
  };
  return { listener: new MentorshipEventsListener(notifications as never), sent, notifications };
}

describe("MentorshipEventsListener", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends the coach's standing note to the student, deduped to one a day", async () => {
    const { listener, sent } = setup();
    await listener.onNoteUpdated(new MentorshipNoteUpdated(LINK, COACH, STUDENT, "Koç Mert"));
    expect(sent[0]).toMatchObject({ userId: STUDENT, linkUrl: "/my-coach" });
    expect(sent[0]!.options?.args).toMatchObject({ name: "Koç Mert" });
    // A coach rewording one sentence five times is still one piece of news.
    expect(sent[0]!.options?.dedupeKey).toBe(`mentorship-note:${STUDENT}:${todayIso()}`);
  });

  it("tells the coach their invite was accepted", async () => {
    const { listener, sent } = setup();
    await listener.onLinkAccepted(
      new MentorshipLinkAccepted(LINK, COACH, STUDENT, "Ayşe", "Koç Mert"),
    );
    expect(sent[0]).toMatchObject({ userId: COACH, linkUrl: "/students" });
    expect(sent[0]!.options?.args).toMatchObject({ name: "Ayşe" });
  });

  it("deep-links the student to the day the assigned work starts", async () => {
    const { listener, sent } = setup();
    await listener.onAssignmentsCreated(
      new MentorshipAssignmentsCreated(LINK, COACH, STUDENT, "Koç Mert", 3, "2026-09-11"),
    );
    expect(sent[0]).toMatchObject({ userId: STUDENT, linkUrl: "/plan?date=2026-09-11" });
    expect(sent[0]!.templateKey).toBe("mentorshipAssignedPlural");
  });

  it("carries the coach's own wording back when their assignment is dropped", async () => {
    const { listener, sent } = setup();
    await listener.onAssignmentDropped(
      new MentorshipAssignmentDropped(LINK, COACH, STUDENT, "Ayşe", "Paragraf 20 soru"),
    );
    expect(sent[0]).toMatchObject({ userId: COACH, linkUrl: `/students/${STUDENT}` });
    expect(sent[0]!.options?.args).toEqual({ name: "Ayşe", title: "Paragraf 20 soru" });
    // Undeduped on purpose: three removals are three facts, not one.
    expect(sent[0]!.options?.dedupeKey).toBeUndefined();
  });

  it("collapses completions to one per student per day", async () => {
    const { listener, sent } = setup();
    await listener.onAssignmentProgressed(
      new MentorshipAssignmentProgressed(LINK, COACH, STUDENT, "Ayşe"),
    );
    // Keyed on the day the coach is told, NOT on the task's own date.
    expect(sent[0]!.options?.dedupeKey).toBe(`mentorship-progress:${STUDENT}:${todayIso()}`);
    // No count and no title: after the dedupe drops the rest, anything specific would be a lie.
    expect(sent[0]!.options?.args).toEqual({ name: "Ayşe" });
  });

  it("gives a whole week's backlog ONE key, however many days it spans", async () => {
    // The regression this replaces: the key used to carry the task's scheduled date, so a student
    // clearing a coach-composed week (7 distinct dates) produced 7 keys and 7 notifications in one
    // evening. The event no longer carries a date at all, so the collapse is structural.
    const { listener, sent } = setup();
    for (let i = 0; i < 7; i++) {
      await listener.onAssignmentProgressed(
        new MentorshipAssignmentProgressed(LINK, COACH, STUDENT, "Ayşe"),
      );
    }
    const keys = new Set(sent.map((s) => s.options?.dedupeKey));
    expect(keys.size).toBe(1);
  });

  it("tells only the other party when a link ends", async () => {
    const { listener, sent } = setup();
    await listener.onLinkEnded(new MentorshipLinkEnded(LINK, COACH, STUDENT, COACH, "Koç Mert"));
    expect(sent[0]).toMatchObject({ userId: STUDENT, linkUrl: "/my-coach" });

    sent.length = 0;
    await listener.onLinkEnded(new MentorshipLinkEnded(LINK, COACH, STUDENT, STUDENT, "Ayşe"));
    expect(sent[0]).toMatchObject({ userId: COACH, linkUrl: "/students" });
  });

  it("never lets a failed notification surface as an error", async () => {
    const { listener, notifications } = setup();
    notifications.createFromTemplate.mockRejectedValueOnce(new Error("inbox down") as never);
    await expect(
      listener.onAssignmentDropped(
        new MentorshipAssignmentDropped(LINK, COACH, STUDENT, "Ayşe", "X"),
      ),
    ).resolves.toBeUndefined();
  });
});
