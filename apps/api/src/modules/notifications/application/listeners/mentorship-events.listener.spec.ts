import { beforeEach, describe, expect, it, vi } from "vitest";
import { MentorshipEventsListener } from "./mentorship-events.listener";
import {
  MentorshipAssignmentDropped,
  MentorshipAssignmentProgressed,
  MentorshipAssignmentsCreated,
  MentorshipLinkAccepted,
  MentorshipLinkEnded,
} from "../../../mentorship/domain/mentorship.constants";

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
      new MentorshipAssignmentDropped(LINK, COACH, STUDENT, "Ayşe", "Paragraf 20 soru", "2026-09-10"),
    );
    expect(sent[0]).toMatchObject({ userId: COACH, linkUrl: `/students/${STUDENT}` });
    expect(sent[0]!.options?.args).toMatchObject({ title: "Paragraf 20 soru" });
    // Undeduped on purpose: three removals are three facts, not one.
    expect(sent[0]!.options?.dedupeKey).toBeUndefined();
  });

  it("collapses completions to one per student per day", async () => {
    const { listener, sent } = setup();
    await listener.onAssignmentProgressed(
      new MentorshipAssignmentProgressed(LINK, COACH, STUDENT, "Ayşe", "2026-09-10"),
    );
    expect(sent[0]!.options?.dedupeKey).toBe(`mentorship-progress:${STUDENT}:2026-09-10`);
    // No count and no title: after the dedupe drops the rest, anything specific would be a lie.
    expect(sent[0]!.options?.args).toEqual({ name: "Ayşe" });
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
        new MentorshipAssignmentDropped(LINK, COACH, STUDENT, "Ayşe", "X", "2026-09-10"),
      ),
    ).resolves.toBeUndefined();
  });
});
