import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { MentorshipEventTopic } from "../domain/mentorship.constants";
import type { MentorshipLinkRow } from "../infrastructure/mentorship-link.repository";
import { MentorshipLinkService } from "./mentorship-link.service";

const COACH = "11111111-1111-4111-8111-111111111111";
const STUDENT = "22222222-2222-4222-8222-222222222222";
const OTHER_COACH = "33333333-3333-4333-8333-333333333333";
const OTHER_STUDENT = "44444444-4444-4444-8444-444444444444";
const CODE = "MENTOR-KOC-ABCDEF012345";
const TX = { execute: vi.fn() };

const config: Record<string, number | boolean> = {
  "mentorship.enabled": true,
  "mentorship.coach.max_active_students": 2,
  "mentorship.coach.free_seats": 1,
  "mentorship.seats.sponsorship_enabled": true,
  "mentorship.invite_code.ttl_days": 14,
};

function link(overrides: Partial<MentorshipLinkRow> = {}): MentorshipLinkRow {
  const now = new Date("2026-09-01T10:00:00Z");
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    coachId: COACH,
    studentId: STUDENT,
    status: "ACTIVE",
    source: "INVITE",
    acceptedAt: now,
    endedAt: null,
    endedBy: null,
    coachNote: null,
    coachNoteAt: null,
    attendedAt: null,
    attendedFlags: null,
    seat: "FREE",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as MentorshipLinkRow;
}

function setup(
  options: {
    rows?: MentorshipLinkRow[];
    codeOwner?: string;
    paidSeats?: number;
    plans?: { seatCount: number }[];
    /** Students who pay for their own Premium (payments' answer). */
    selfPaying?: string[];
    unverifiedPhones?: string[];
    unverifiedEmails?: string[];
    premium?: boolean;
  } = {},
) {
  const rows = options.rows ?? [];
  const emitted: { topic: string; payload: unknown }[] = [];

  const links = {
    findActive: vi.fn(async (coachId: string, studentId: string) =>
      rows.find(
        (r) => r.coachId === coachId && r.studentId === studentId && r.status === "ACTIVE",
      ),
    ),
    findActiveByStudent: vi.fn(async (studentId: string) =>
      rows.find((r) => r.studentId === studentId && r.status === "ACTIVE"),
    ),
    listByCoach: vi.fn(async (coachId: string, status: string) => {
      const matched = rows.filter((r) => r.coachId === coachId && r.status === status);
      return { rows: matched, total: matched.length };
    }),
    listActiveByCoach: vi.fn(async (coachId: string) =>
      rows.filter((r) => r.coachId === coachId && r.status === "ACTIVE"),
    ),
    // The transaction primitives the service composes under the coach's lock.
    lockCoachInTransaction: vi.fn(async () => undefined),
    listActiveByCoachInTransaction: vi.fn(async (_tx: unknown, coachId: string) =>
      rows.filter((r) => r.coachId === coachId && r.status === "ACTIVE"),
    ),
    insertOrReviveInTransaction: vi.fn(
      async (_tx: unknown, coachId: string, studentId: string, seat: string, now: Date) => {
        const existing = rows.find((r) => r.coachId === coachId && r.studentId === studentId);
        if (existing && existing.status !== "ENDED") return undefined;
        if (existing) {
          Object.assign(existing, { status: "ACTIVE", endedAt: null, endedBy: null, seat, acceptedAt: now });
          return existing;
        }
        const row = link({ id: `link-${rows.length}`, coachId, studentId, seat, acceptedAt: now });
        rows.push(row);
        return row;
      },
    ),
    setSeatsInTransaction: vi.fn(
      async (_tx: unknown, changes: { id: string; seat: string }[]) => {
        for (const change of changes) {
          const row = rows.find((r) => r.id === change.id);
          if (row) row.seat = change.seat;
        }
      },
    ),
    listCoachIdsTouching: vi.fn(async (userId: string) => [
      ...new Set(
        rows
          .filter((r) => r.status === "ACTIVE" && (r.coachId === userId || r.studentId === userId))
          .map((r) => r.coachId),
      ),
    ]),
    end: vi.fn(async (linkId: string, endedBy: string) => {
      const row = rows.find((r) => r.id === linkId);
      if (!row || row.status !== "ACTIVE") return undefined;
      row.status = "ENDED";
      row.endedAt = new Date();
      row.endedBy = endedBy;
      // Mirrors the repository: the note goes with the link, because re-linking revives this row.
      row.coachNote = null;
      row.coachNoteAt = null;
      // And so does the coach's "I dealt with this" mark, for the same reason.
      row.attendedAt = null;
      row.attendedFlags = null;
      return row;
    }),
    lockActiveInTransaction: vi.fn(
      async (_tx: unknown, coachId: string, studentIds: string[]) =>
        rows
          .filter(
            (row) =>
              row.coachId === coachId &&
              row.status === "ACTIVE" &&
              studentIds.includes(row.studentId),
          )
          .sort((left, right) => left.studentId.localeCompare(right.studentId)),
    ),
    endInTransaction: vi.fn(
      async (_tx: unknown, linkId: string, endedBy: string) => {
        const row = rows.find((candidate) => candidate.id === linkId);
        if (!row || row.status !== "ACTIVE") return undefined;
        row.status = "ENDED";
        row.endedAt = new Date();
        row.endedBy = endedBy;
        row.coachNote = null;
        row.coachNoteAt = null;
        row.studentNote = null;
        row.studentNoteAt = null;
        row.brief = null;
        row.briefAt = null;
        row.briefFingerprint = null;
        row.attendedAt = null;
        row.attendedFlags = null;
        return row;
      },
    ),
    setCoachNote: vi.fn(async (linkId: string, body: string | null) => {
      const row = rows.find((r) => r.id === linkId);
      if (!row || row.status !== "ACTIVE") return undefined;
      row.coachNote = body;
      row.coachNoteAt = body === null ? null : new Date("2026-09-04T09:00:00Z");
      return row;
    }),
    setStudentNote: vi.fn(async (linkId: string, body: string | null) => {
      const row = rows.find((r) => r.id === linkId);
      if (!row || row.status !== "ACTIVE") return undefined;
      row.studentNote = body;
      row.studentNoteAt = body === null ? null : new Date("2026-09-05T18:00:00Z");
      return row;
    }),
    purgeForUser: vi.fn(),
  };

  const invites = {
    getCurrent: vi.fn(async () => null),
    resolveCoachId: vi.fn(async (code: string) => {
      if (code !== CODE) {
        throw new DomainError(ErrorCode.MENTORSHIP_INVITE_INVALID, 404);
      }
      return options.codeOwner ?? COACH;
    }),
  };

  const users = {
    isEmailVerified: vi.fn(async (id: string) => !(options.unverifiedEmails ?? []).includes(id)),
    isPhoneVerified: vi.fn(async (id: string) => !(options.unverifiedPhones ?? []).includes(id)),
    listDisplayIdentities: vi.fn(async (ids: string[]) => {
      const names: Record<string, string> = {
        [COACH]: "Koç Ayşe",
        [OTHER_COACH]: "Koç Mehmet",
        [STUDENT]: "Elif",
      };
      return new Map(
        ids
          .filter((id) => names[id])
          .map((id) => [id, { userId: id, displayName: names[id]!, username: null }]),
      );
    }),
  };

  const configRegistry = { get: vi.fn(async (key: string) => config[key]) };
  const events = {
    emit: vi.fn((topic: string, payload: unknown) => {
      emitted.push({ topic, payload });
      return true;
    }),
  };
  const planEvents = {
    removeFutureAttendee: vi.fn(async () => 2),
    removeFutureAttendeeInTransaction: vi.fn(async () => 2),
  };
  const planTasks = { releaseMentorshipTasksInTransaction: vi.fn(async () => 2) };
  const db = {
    transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(TX),
    ),
  };

  // Paid seats come from the coach's own plan; 0 unless a test says otherwise, which is what
  // every coach looks like until seat billing is switched on.
  const subscriptions = {
    paidSeatsFor: vi.fn(async () => options.paidSeats ?? 0),
    // The catalog as `/subscription` shows it: only plans some channel can sell right now.
    listPlans: vi.fn(async () => options.plans ?? [{ seatCount: 0 }]),
    listSelfPayingUserIds: vi.fn(
      async (ids: string[]) => new Set(ids.filter((id) => (options.selfPaying ?? []).includes(id))),
    ),
  };
  const seats = { grant: vi.fn(async () => true), revoke: vi.fn(async () => true) };

  // The profile the consent screen and /kocum now carry. Null is the common case: every coach
  // granted COACH by hand has no vetted application behind them.
  // `canInvite` is the APP-089 gate on both ends of a code: issuing one, and redeeming one. Default
  // true here so these tests keep testing the link lifecycle; the gate has its own spec.
  const applications = {
    findPublicProfile: vi.fn(async () => null),
    findStatus: vi.fn(async () => "ACTIVE"),
    canInvite: vi.fn(async () => true),
  };
  const service = new MentorshipLinkService(
    links as never,
    invites as never,
    applications as never,
    users as never,
    configRegistry as never,
    subscriptions as never,
    seats as never,
    events as never,
    planEvents as never,
    planTasks as never,
    db as never,
    { getEntitlement: vi.fn(async () => ({ isPremium: options.premium ?? false })) } as never,
  );
  return {
    service,
    links,
    invites,
    applications,
    users,
    configRegistry,
    subscriptions,
    seats,
    events,
    planEvents,
    planTasks,
    db,
    emitted,
    rows,
  };
}

const codeOf = async (fn: () => Promise<unknown>): Promise<string> => {
  try {
    await fn();
  } catch (err) {
    return err instanceof DomainError ? err.code : `unexpected:${String(err)}`;
  }
  return "no-error";
};

describe("MentorshipLinkService", () => {
  beforeEach(() => {
    config["mentorship.enabled"] = true;
    config["mentorship.coach.max_active_students"] = 2;
    config["mentorship.coach.free_seats"] = 1;
    config["mentorship.seats.sponsorship_enabled"] = true;
  });

  describe("the authorization gate", () => {
    it("closes coach authority after an email change and restores it only after re-verification", async () => {
      const { service, users } = setup({ rows: [link()] });
      users.isEmailVerified.mockResolvedValue(false);
      for (const call of [
        () => service.requireActiveLink(COACH, STUDENT),
        () => service.requireActiveLinkInTransaction(TX as never, COACH, STUDENT),
        () => service.requireActiveLinksInTransaction(TX as never, COACH, [STUDENT]),
        () => service.listActiveScopes(COACH),
      ]) await expect(call()).rejects.toMatchObject({ code: ErrorCode.MENTORSHIP_EMAIL_NOT_VERIFIED });
      await expect(service.requireStudentLink(STUDENT)).resolves.toMatchObject({ id: link().id });
      await expect(service.requireActiveLinkInTransaction(TX as never, COACH, STUDENT, { allowWaiting: true })).resolves.toMatchObject({ id: link().id });
      users.isEmailVerified.mockResolvedValue(true);
      await expect(service.requireActiveLink(COACH, STUDENT)).resolves.toMatchObject({ id: link().id });
    });

    it("never requires the student's email for coach authority", async () => {
      const { service } = setup({ rows: [link()], unverifiedEmails: [STUDENT] });
      await expect(service.requireActiveLink(COACH, STUDENT)).resolves.toMatchObject({ id: link().id });
    });

    it("requires coach phone verification on all protected relationship paths", async () => {
      const { service } = setup({ rows: [link()], unverifiedPhones: [COACH] });
      for (const call of [
        () => service.requireActiveLink(COACH, STUDENT),
        () => service.requireActiveLinkInTransaction(TX as never, COACH, STUDENT),
        () => service.requireActiveLinksInTransaction(TX as never, COACH, [STUDENT]),
        () => service.listActiveScopes(COACH),
      ]) await expect(call()).rejects.toMatchObject({ code: "AUTH_PHONE_REQUIRED" });
    });

    it("keeps student access, responses and revocation when either phone is unverified", async () => {
      const { service, rows } = setup({ rows: [link()], unverifiedPhones: [COACH, STUDENT] });
      await expect(service.requireStudentLink(STUDENT)).resolves.toMatchObject({ id: link().id });
      await expect(service.requireActiveLinkInTransaction(TX as never, COACH, STUDENT, { allowWaiting: true })).resolves.toMatchObject({ id: link().id });
      await service.endByStudent(STUDENT);
      expect(rows[0]!.status).toBe("ENDED");
    });

    it("returns the link when it is active", async () => {
      const { service } = setup({ rows: [link()] });
      await expect(service.requireActiveLink(COACH, STUDENT)).resolves.toMatchObject({
        coachId: COACH,
        studentId: STUDENT,
      });
    });

    it("404s (never 403) when no link exists, so student ids stay unconfirmable", async () => {
      const { service } = setup();
      await expect(service.requireActiveLink(COACH, STUDENT)).rejects.toMatchObject({
        code: ErrorCode.MENTORSHIP_LINK_NOT_FOUND,
        httpStatus: 404,
      });
    });

    it("refuses an ENDED link — access dies with the relationship", async () => {
      const { service } = setup({ rows: [link({ status: "ENDED", endedAt: new Date() })] });
      expect(await codeOf(() => service.requireActiveLink(COACH, STUDENT))).toBe(
        ErrorCode.MENTORSHIP_LINK_NOT_FOUND,
      );
    });

    it("grants a coach nothing over a student who is not theirs", async () => {
      const { service } = setup({ rows: [link()] });
      expect(await codeOf(() => service.requireActiveLink(OTHER_COACH, STUDENT))).toBe(
        ErrorCode.MENTORSHIP_LINK_NOT_FOUND,
      );
    });

    it("opens one SERVICE transaction and rechecks links under stable row locks", async () => {
      const second = link({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        studentId: OTHER_STUDENT,
      });
      const { service, links } = setup({ rows: [link(), second] });
      const callback = vi.fn(async () => "written");
      await expect(service.withServiceTransaction(callback)).resolves.toBe(
        "written",
      );
      expect(callback).toHaveBeenCalledWith(TX);

      await expect(
        service.requireActiveLinksInTransaction(
          TX as never,
          COACH,
          [OTHER_STUDENT, STUDENT],
        ),
      ).resolves.toEqual([
        { studentId: STUDENT, mentorshipLinkId: link().id },
        { studentId: OTHER_STUDENT, mentorshipLinkId: second.id },
      ]);
      expect(links.lockActiveInTransaction).toHaveBeenCalledWith(
        TX,
        COACH,
        [STUDENT, OTHER_STUDENT].sort(),
      );
    });

    it("refuses when a locked link is no longer active", async () => {
      const { service } = setup({ rows: [link()] });
      await expect(
        service.requireActiveLinksInTransaction(
          TX as never,
          COACH,
          [STUDENT, OTHER_STUDENT],
        ),
      ).rejects.toMatchObject({ code: ErrorCode.MENTORSHIP_LINK_NOT_FOUND });
    });

    /** Frozen: the link stands, but the coach cannot open the student until a seat returns. */
    it("freezes a link that waits for a seat", async () => {
      const { service } = setup({ rows: [link({ seat: "NONE" })] });
      await expect(service.requireActiveLink(COACH, STUDENT)).rejects.toMatchObject({
        code: ErrorCode.MENTORSHIP_SEAT_WAITING,
        httpStatus: 409,
      });
      await expect(
        service.requireActiveLinksInTransaction(TX as never, COACH, [STUDENT]),
      ).rejects.toMatchObject({ code: ErrorCode.MENTORSHIP_SEAT_WAITING });
      // The student's side of the link still answers: a frozen seat stops the coach, not them.
      await expect(
        service.requireActiveLinkInTransaction(TX as never, COACH, STUDENT, { allowWaiting: true }),
      ).resolves.toMatchObject({ seat: "NONE" });
    });

    it("lets the coach end a frozen link", async () => {
      const { service, rows } = setup({ rows: [link({ seat: "NONE" })] });
      await service.endByCoach(COACH, STUDENT);
      expect(rows[0]!.status).toBe("ENDED");
    });

    it("leaves frozen students out of the coach's plan scopes", async () => {
      const { service } = setup({
        rows: [link(), link({ id: "l2", studentId: OTHER_STUDENT, seat: "NONE" })],
      });
      const scopes = await service.listActiveScopes(COACH);
      expect(scopes.map((scope) => scope.studentId)).toEqual([STUDENT]);
    });
  });

  describe("reseating a coach's links", () => {
    it.each([COACH, STUDENT])("backfills unchanged seated links immediately after %s verifies", async (userId) => {
      const { service, seats, links } = setup({ rows: [link()] });
      await service.reseatForUser(userId);
      expect(links.setSeatsInTransaction).toHaveBeenCalledWith(TX, []);
      expect(seats.grant).toHaveBeenCalledWith(STUDENT, link().id, COACH);
    });

    it("does not require the linked student's phone for coach data access", async () => {
      const { service } = setup({ rows: [link()], unverifiedPhones: [STUDENT] });
      await expect(service.requireActiveLink(COACH, STUDENT)).resolves.toMatchObject({ id: link().id });
    });

    it("keeps sponsorship backfill behind the kill switch", async () => {
      config["mentorship.seats.sponsorship_enabled"] = false;
      const { service, seats } = setup({ rows: [link()] });
      await service.reseatForUser(STUDENT);
      expect(seats.grant).not.toHaveBeenCalled();
    });

    const day = (n: number) => new Date(Date.UTC(2026, 8, n));

    it("freezes the newest paid student when the coach's plan ends, and ends their Premium", async () => {
      const { service, rows, seats } = setup({
        rows: [
          link({ id: "l1", studentId: "s1", acceptedAt: day(1) }),
          link({ id: "l2", studentId: "s2", seat: "PAID", acceptedAt: day(2) }),
        ],
        paidSeats: 0,
      });
      await service.reseatCoach(COACH);
      expect(rows.map((row) => row.seat)).toEqual(["FREE", "NONE"]);
      expect(seats.revoke).toHaveBeenCalledWith("l2");
      expect(seats.grant).toHaveBeenCalledWith("s1", "l1", COACH);
      expect(seats.grant).not.toHaveBeenCalledWith("s2", "l2", COACH);
    });

    it("brings a waiting student back with their Premium when a seat returns", async () => {
      const { service, rows, seats } = setup({
        rows: [
          link({ id: "l1", studentId: "s1", acceptedAt: day(1) }),
          link({ id: "l2", studentId: "s2", seat: "NONE", acceptedAt: day(2) }),
        ],
        paidSeats: 1,
      });
      await service.reseatCoach(COACH);
      expect(rows[1]!.seat).toBe("PAID");
      expect(seats.grant).toHaveBeenCalledWith("s2", "l2", COACH);
    });

    it("moves a student who pays for themselves off the seat, freeing it", async () => {
      const { service, rows, seats } = setup({
        rows: [link({ id: "l1", studentId: "s1", acceptedAt: day(1) })],
        selfPaying: ["s1"],
      });
      await service.reseatCoach(COACH);
      expect(rows[0]!.seat).toBe("SELF");
      expect(seats.grant).not.toHaveBeenCalled();
      expect(seats.revoke).not.toHaveBeenCalled();
    });

    it("reseats the coach behind a student whose own subscription changed", async () => {
      const { service, rows, seats } = setup({
        rows: [link({ id: "l1", studentId: "s1", seat: "SELF", acceptedAt: day(1) })],
      });
      // s1's own subscription ended (payments no longer names them): back on the free seat.
      await service.reseatForUser("s1");
      expect(rows[0]!.seat).toBe("FREE");
      expect(seats.grant).toHaveBeenCalledWith("s1", "l1", COACH);
    });
  });

  describe("accepting an invitation", () => {
    it("links the pair and announces it", async () => {
      const { service, emitted } = setup();
      const result = await service.acceptInvitation(STUDENT, CODE);
      expect(result.coachDisplayName).toBe("Koç Ayşe");
      expect(result.status).toBe("ACTIVE");
      expect(result.dataScope).toEqual([
        "ACTIVITY",
        "MOCK_EXAMS",
        "PLAN_TASK_TITLES",
        "MOOD_LEVEL",
        "EXAM_TRACK",
        "AI_BRIEF",
      ]);
      expect(emitted).toHaveLength(1);
      expect(emitted[0]!.topic).toBe(MentorshipEventTopic.LINK_ACCEPTED);
    });

    it("rejects a coach redeeming their own code", async () => {
      const { service } = setup();
      expect(await codeOf(() => service.acceptInvitation(COACH, CODE))).toBe(
        ErrorCode.MENTORSHIP_SELF_LINK,
      );
    });

    it("rejects a second coach while one is already active", async () => {
      const { service } = setup({ rows: [link({ coachId: OTHER_COACH })] });
      expect(await codeOf(() => service.acceptInvitation(STUDENT, CODE))).toBe(
        ErrorCode.MENTORSHIP_ALREADY_LINKED,
      );
    });

    it("revives an ENDED link with the same coach instead of failing on the pair unique", async () => {
      const { service, rows } = setup({
        rows: [link({ status: "ENDED", endedAt: new Date(), endedBy: STUDENT })],
      });
      await expect(service.acceptInvitation(STUDENT, CODE)).resolves.toMatchObject({
        status: "ACTIVE",
      });
      expect(rows).toHaveLength(1);
      expect(rows[0]!.endedBy).toBeNull();
    });

    it("refuses once the coach's free quota is full", async () => {
      const { service } = setup({
        rows: [
          link({ id: "l1", studentId: "s1" }),
          link({ id: "l2", studentId: "s2" }),
        ],
      });
      expect(await codeOf(() => service.acceptInvitation(STUDENT, CODE))).toBe(
        ErrorCode.MENTORSHIP_STUDENT_QUOTA_EXCEEDED,
      );
    });

    /**
     * The seat is what decides whether the student is handed sponsored Premium, so it is the one
     * number in this flow that costs real money to get wrong. It is read from the count taken
     * under the accept lock, which is why the boundary is worth pinning here.
     */
    it("seats the first student free and refuses the next one", async () => {
      const { service, emitted } = setup();
      await service.acceptInvitation(STUDENT, CODE);
      expect(emitted.at(-1)).toMatchObject({
        topic: MentorshipEventTopic.LINK_ACCEPTED,
        payload: { seatKind: "FREE" },
      });

      // free_seats is 1 and paid seats are 0: the second student does not get a link at all.
      expect(await codeOf(() => service.acceptInvitation(OTHER_STUDENT, CODE))).toBe(
        ErrorCode.MENTORSHIP_SEATS_FULL,
      );
      expect(emitted).toHaveLength(1);
    });

    /**
     * The paid half. `free_seats` is 1 here, so the second student is sponsored only because the
     * coach's own plan pays for them.
     */
    it("sponsors past the free quota when the coach's plan pays for it", async () => {
      const { service, emitted } = setup({ paidSeats: 1 });
      await service.acceptInvitation(STUDENT, CODE);
      expect(emitted.at(-1)).toMatchObject({ payload: { seatKind: "FREE" } });

      await service.acceptInvitation(OTHER_STUDENT, CODE);
      expect(emitted.at(-1)).toMatchObject({ payload: { seatKind: "PAID" } });
    });

    /**
     * A seat is the coach's room to follow a student; sponsorship only decides whether it also
     * opens Premium. With the flag off the free quota still links, and the grant stays with the
     * listener, which the flag already gates.
     */
    it("links within the free seats while sponsorship is switched off", async () => {
      config["mentorship.seats.sponsorship_enabled"] = false;
      const { service, emitted } = setup();
      await expect(service.acceptInvitation(STUDENT, CODE)).resolves.toMatchObject({
        status: "ACTIVE",
      });
      expect(emitted.at(-1)).toMatchObject({ payload: { seatKind: "FREE" } });

      // free_seats is 1: the quota still bounds the roster.
      expect(await codeOf(() => service.acceptInvitation(OTHER_STUDENT, CODE))).toBe(
        ErrorCode.MENTORSHIP_SEATS_FULL,
      );
    });

    it("counts only ACTIVE links against the quota", async () => {
      config["mentorship.coach.free_seats"] = 5;
      const { service } = setup({
        rows: [
          link({ id: "l1", studentId: "s1" }),
          link({ id: "l2", studentId: "s2", status: "ENDED" }),
        ],
      });
      await expect(service.acceptInvitation(STUDENT, CODE)).resolves.toMatchObject({
        status: "ACTIVE",
      });
    });

    /** One payer per student: the student already pays, so the coach's seats are not touched. */
    it("links a student who pays for their own Premium without taking a seat", async () => {
      const { service, rows, emitted } = setup({
        rows: [link({ id: "l1", studentId: "s1" })],
        selfPaying: [STUDENT],
      });
      await service.acceptInvitation(STUDENT, CODE);
      expect(emitted.at(-1)).toMatchObject({ payload: { seatKind: "SELF" } });
      expect(rows.find((row) => row.studentId === STUDENT)?.seat).toBe("SELF");
    });

    it("never lets a new student overtake one already waiting for a seat", async () => {
      config["mentorship.coach.max_active_students"] = 5;
      config["mentorship.coach.free_seats"] = 2;
      const { service } = setup({
        rows: [
          link({ id: "l1", studentId: "s1", acceptedAt: new Date("2026-09-01T00:00:00Z") }),
          link({ id: "l2", studentId: "s2", seat: "NONE", acceptedAt: new Date("2026-09-02T00:00:00Z") }),
        ],
      });
      // One free seat is open, and it belongs to s2.
      expect(await codeOf(() => service.acceptInvitation(STUDENT, CODE))).toBe(
        ErrorCode.MENTORSHIP_SEATS_FULL,
      );
    });
  });

  describe("the student's view of a frozen link", () => {
    it("says the coach's seats are full while the link waits", async () => {
      const { service } = setup({ rows: [link({ seat: "NONE" })] });
      await expect(service.getMyCoach(STUDENT)).resolves.toMatchObject({ seatWaiting: true });
    });

    it("says nothing of seats while the link holds one", async () => {
      const { service } = setup({ rows: [link()] });
      await expect(service.getMyCoach(STUDENT)).resolves.toMatchObject({ seatWaiting: false });
    });
  });

  describe("sponsored Premium pending state", () => {
    it("accepts an unverified student while reporting held sponsorship", async () => {
      const { service, emitted } = setup({ unverifiedPhones: [STUDENT] });
      await expect(service.acceptInvitation(STUDENT, CODE)).resolves.toMatchObject({
        status: "ACTIVE",
        seatWaiting: false,
        sponsoredPremiumPending: true,
      });
      expect(emitted.at(-1)).toMatchObject({ payload: { seatKind: "FREE" } });
    });

    it.each([
      { phones: [STUDENT], seat: "FREE", premium: false, expected: true },
      { phones: [COACH], seat: "PAID", premium: false, expected: true },
      { phones: [], seat: "FREE", premium: false, expected: false },
      { phones: [STUDENT], seat: "FREE", premium: true, expected: false },
      { phones: [STUDENT], seat: "SELF", premium: false, expected: false },
      { phones: [STUDENT], seat: "NONE", premium: false, expected: false },
    ])("derives pending sponsorship on the server: %j", async ({ phones, seat, premium, expected }) => {
      const { service } = setup({ rows: [link({ seat })], unverifiedPhones: phones, premium });
      await expect(service.getMyCoach(STUDENT)).resolves.toMatchObject({ sponsoredPremiumPending: expected });
    });

    it("withholds the phone CTA while sponsorship is disabled", async () => {
      config["mentorship.seats.sponsorship_enabled"] = false;
      const { service } = setup({ rows: [link()], unverifiedPhones: [STUDENT] });
      await expect(service.getMyCoach(STUDENT)).resolves.toMatchObject({ sponsoredPremiumPending: false });
    });
  });

  describe("the coach overview", () => {
    it("writes the Premium a seated link never received, and none for a waiting one", async () => {
      const seated = link({
        id: "older",
        studentId: "s-old",
        acceptedAt: new Date("2026-09-01T00:00:00Z"),
      });
      const waiting = link({
        id: "newer",
        studentId: "s-new",
        seat: "NONE",
        acceptedAt: new Date("2026-09-10T00:00:00Z"),
      });
      const { service, seats } = setup({ rows: [waiting, seated] });
      const overview = await service.getCoachOverview(COACH);
      expect(overview.activeStudents).toBe(2);
      expect(seats.grant).toHaveBeenCalledTimes(1);
      expect(seats.grant).toHaveBeenCalledWith("s-old", "older", COACH);
    });

    /** The card's "used" is seats held: a student who pays for themselves and one waiting hold none. */
    it("counts the seats held, and the students waiting for one, apart from the students linked", async () => {
      config["mentorship.coach.max_active_students"] = 5;
      const { service } = setup({
        rows: [
          link({ id: "l1", studentId: "s1", acceptedAt: new Date("2026-09-01T00:00:00Z") }),
          link({ id: "l2", studentId: "s2", seat: "SELF", acceptedAt: new Date("2026-09-02T00:00:00Z") }),
          link({ id: "l3", studentId: "s3", seat: "NONE", acceptedAt: new Date("2026-09-03T00:00:00Z") }),
        ],
        selfPaying: ["s2"],
      });
      const overview = await service.getCoachOverview(COACH);
      expect(overview).toMatchObject({ activeStudents: 3, usedSeats: 1, waitingStudents: 1 });
    });

    /**
     * The card decides "full" from this number alone, so it has to be the number the accept lock
     * refuses at: free + paid, never past the follow cap.
     */
    it("reports the seat allowance the accept lock enforces", async () => {
      const { service } = setup();
      // free_seats 1, paid 0, cap 2.
      expect((await service.getCoachOverview(COACH)).seatAllowance).toBe(1);
    });

    it("caps the seat allowance at the number of students a coach may follow", async () => {
      const { service } = setup({ paidSeats: 5 });
      expect((await service.getCoachOverview(COACH)).seatAllowance).toBe(2);
    });

    it("keeps the free seats while sponsorship is switched off", async () => {
      config["mentorship.seats.sponsorship_enabled"] = false;
      const { service, seats } = setup({ rows: [link()] });
      const overview = await service.getCoachOverview(COACH);
      expect(overview.seatAllowance).toBe(1);
      expect(overview.sponsorshipEnabled).toBe(false);
      // No Premium to hand out: the overview's backfill stays behind the flag.
      expect(seats.grant).not.toHaveBeenCalled();
    });

    it("says whether a coach seat plan can be bought right now", async () => {
      const closed = setup({ plans: [{ seatCount: 0 }] });
      expect((await closed.service.getCoachOverview(COACH)).seatPlansOnSale).toBe(false);

      const open = setup({ plans: [{ seatCount: 0 }, { seatCount: 10 }] });
      expect((await open.service.getCoachOverview(COACH)).seatPlansOnSale).toBe(true);
    });
  });

  describe("ending a link", () => {
    it("lets the student revoke consent unilaterally", async () => {
      const { service, rows, emitted } = setup({ rows: [link()] });
      await service.endByStudent(STUDENT);
      expect(rows[0]!.status).toBe("ENDED");
      expect(rows[0]!.endedBy).toBe(STUDENT);
      expect(emitted[0]!.topic).toBe(MentorshipEventTopic.LINK_ENDED);
    });

    it("lets the coach end it too", async () => {
      const { service, rows, links, planEvents } = setup({ rows: [link()] });
      await service.endByCoach(COACH, STUDENT);
      expect(rows[0]!.endedBy).toBe(COACH);
      expect(planEvents.removeFutureAttendeeInTransaction).toHaveBeenCalledWith(
        TX,
        COACH,
        STUDENT,
      );
      expect(links.endInTransaction).toHaveBeenCalledWith(TX, link().id, COACH);
      expect(planEvents.removeFutureAttendeeInTransaction.mock.invocationCallOrder[0]).toBeLessThan(
        links.endInTransaction.mock.invocationCallOrder[0]!,
      );
    });

    it("hands the student the coach's pending tasks before the link ends, in the same transaction", async () => {
      const { service, links, planTasks } = setup({ rows: [link()] });
      await service.endByStudent(STUDENT);
      expect(planTasks.releaseMentorshipTasksInTransaction).toHaveBeenCalledWith(TX, {
        studentId: STUDENT,
        mentorshipLinkId: link().id,
      });
      expect(planTasks.releaseMentorshipTasksInTransaction.mock.invocationCallOrder[0]).toBeLessThan(
        links.endInTransaction.mock.invocationCallOrder[0]!,
      );
    });

    it("is idempotent — a second end emits nothing", async () => {
      const { service, emitted } = setup({ rows: [link()] });
      await service.endByStudent(STUDENT);
      await expect(service.endByStudent(STUDENT)).rejects.toMatchObject({
        code: ErrorCode.MENTORSHIP_LINK_NOT_FOUND,
      });
      expect(emitted).toHaveLength(1);
    });

    it("stops a coach ending a link that is not theirs", async () => {
      const { service, rows } = setup({ rows: [link()] });
      expect(await codeOf(() => service.endByCoach(OTHER_COACH, STUDENT))).toBe(
        ErrorCode.MENTORSHIP_LINK_NOT_FOUND,
      );
      expect(rows[0]!.status).toBe("ACTIVE");
    });
  });

  describe("the coach's standing note", () => {
    it("writes the note and tells the student", async () => {
      const { service, emitted, links } = setup({ rows: [link()] });
      await service.setCoachNote(COACH, STUDENT, "Bu hafta paragrafa ağırlık ver.");
      expect(links.setCoachNote).toHaveBeenCalledWith(
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "Bu hafta paragrafa ağırlık ver.",
      );
      expect(emitted.map((e) => e.topic)).toContain(MentorshipEventTopic.NOTE_UPDATED);
    });

    it("reads the note back on the student's own transparency view", async () => {
      const { service } = setup({ rows: [link()] });
      await service.setCoachNote(COACH, STUDENT, "Bu hafta paragrafa ağırlık ver.");
      const view = await service.getMyCoach(STUDENT);
      expect(view?.coachNote).toEqual({
        body: "Bu hafta paragrafa ağırlık ver.",
        updatedAt: "2026-09-04T09:00:00.000Z",
      });
    });

    it("clears the note without announcing it — an empty inbox item teaches nothing", async () => {
      const { service, emitted } = setup({ rows: [link()] });
      await service.setCoachNote(COACH, STUDENT, "Bir şey");
      emitted.length = 0;
      await service.setCoachNote(COACH, STUDENT, null);
      expect(emitted).toEqual([]);
      expect((await service.getMyCoach(STUDENT))?.coachNote).toBeNull();
    });

    it("refuses a coach with no active link, with 404 rather than 403", async () => {
      const { service } = setup({ rows: [] });
      expect(await codeOf(() => service.setCoachNote(COACH, STUDENT, "Merhaba"))).toBe(
        ErrorCode.MENTORSHIP_LINK_NOT_FOUND,
      );
    });

    it("does not survive the link: a revived row starts on a blank page", async () => {
      // Re-linking reuses the ENDED row (`onConflictDoUpdate` with `setWhere: status = 'ENDED'`),
      // so a note left behind would resurface months later on a relationship both sides left.
      const { service } = setup({ rows: [link()] });
      await service.setCoachNote(COACH, STUDENT, "Eski not");
      await service.endByStudent(STUDENT);
      await service.acceptInvitation(STUDENT, CODE);
      expect((await service.getMyCoach(STUDENT))?.coachNote).toBeNull();
    });
  });

  /** QA F4 (2026-09-27): the mirror of the coach's note, written by the student for this coach. */
  describe("the student's standing note", () => {
    it("writes the note on the student's own link and tells the coach", async () => {
      const { service, emitted, links } = setup({ rows: [link()] });
      await service.setStudentNote(STUDENT, "Cuma akşamları çalışamıyorum.");
      expect(links.setStudentNote).toHaveBeenCalledWith(
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "Cuma akşamları çalışamıyorum.",
      );
      expect(emitted).toEqual([
        {
          topic: MentorshipEventTopic.STUDENT_NOTE_UPDATED,
          payload: expect.objectContaining({
            coachId: COACH,
            studentId: STUDENT,
            studentDisplayName: "Elif",
          }),
        },
      ]);
    });

    it("reads the note back to the student on their transparency view", async () => {
      const { service } = setup({ rows: [link()] });
      await service.setStudentNote(STUDENT, "Cuma akşamları çalışamıyorum.");
      expect((await service.getMyCoach(STUDENT))?.studentNote).toEqual({
        body: "Cuma akşamları çalışamıyorum.",
        updatedAt: "2026-09-05T18:00:00.000Z",
      });
    });

    it("clears the note without telling the coach", async () => {
      const { service, emitted } = setup({ rows: [link()] });
      await service.setStudentNote(STUDENT, "Bir şey");
      emitted.length = 0;
      await service.setStudentNote(STUDENT, null);
      expect(emitted).toEqual([]);
      expect((await service.getMyCoach(STUDENT))?.studentNote).toBeNull();
    });

    it("keeps the note of a link waiting for a seat, and tells the frozen coach nothing", async () => {
      const { service, emitted, links } = setup({ rows: [link({ seat: "NONE" })] });
      await service.setStudentNote(STUDENT, "Merhaba");
      expect(links.setStudentNote).toHaveBeenCalledOnce();
      expect(emitted).toEqual([]);
    });

    it("refuses a student with no coach, with 404", async () => {
      const { service } = setup({ rows: [] });
      expect(await codeOf(() => service.setStudentNote(STUDENT, "Merhaba"))).toBe(
        ErrorCode.MENTORSHIP_LINK_NOT_FOUND,
      );
    });

    it("does not survive the link", async () => {
      const { service } = setup({ rows: [link()] });
      await service.setStudentNote(STUDENT, "Eski not");
      await service.endByStudent(STUDENT);
      await service.acceptInvitation(STUDENT, CODE);
      expect((await service.getMyCoach(STUDENT))?.studentNote).toBeNull();
    });
  });

  describe("the kill switch", () => {
    it("closes every entry point when the flag is off", async () => {
      config["mentorship.enabled"] = false;
      const { service } = setup({ rows: [link()] });
      for (const call of [
        () => service.acceptInvitation(STUDENT, CODE),
        () => service.previewInvitation(CODE),
        () => service.getMyCoach(STUDENT),
        () => service.setCoachNote(COACH, STUDENT, "Merhaba"),
        () => service.setStudentNote(STUDENT, "Merhaba"),
        () => service.endByStudent(STUDENT),
        () => service.endByCoach(COACH, STUDENT),
      ]) {
        expect(await codeOf(call)).toBe(ErrorCode.MENTORSHIP_DISABLED);
      }
    });
  });

  describe("the student's transparency view", () => {
    it("names the coach and the exact data scope", async () => {
      const { service } = setup({ rows: [link()] });
      const view = await service.getMyCoach(STUDENT);
      expect(view).toMatchObject({ coachDisplayName: "Koç Ayşe", status: "ACTIVE" });
      expect(view!.dataScope).toEqual([
        "ACTIVITY",
        "MOCK_EXAMS",
        "PLAN_TASK_TITLES",
        "MOOD_LEVEL",
        "EXAM_TRACK",
        "AI_BRIEF",
      ]);
    });

    it("returns null when there is no coach", async () => {
      const { service } = setup();
      await expect(service.getMyCoach(STUDENT)).resolves.toBeNull();
    });
  });
});
