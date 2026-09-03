import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { MentorshipEventTopic } from "../domain/mentorship.constants";
import type { MentorshipLinkRow } from "../infrastructure/mentorship-link.repository";
import { MentorshipLinkService } from "./mentorship-link.service";

const COACH = "11111111-1111-4111-8111-111111111111";
const STUDENT = "22222222-2222-4222-8222-222222222222";
const OTHER_COACH = "33333333-3333-4333-8333-333333333333";
const CODE = "MENTOR-KOC-ABCDEF012345";

const config: Record<string, number | boolean> = {
  "mentorship.enabled": true,
  "mentorship.coach.max_active_students": 2,
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
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function setup(options: { rows?: MentorshipLinkRow[]; codeOwner?: string } = {}) {
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
    // Mirrors the repository contract: quota + upsert inside one transaction.
    acceptInvite: vi.fn(async (coachId: string, studentId: string, maxActive: number) => {
      const active = rows.filter((r) => r.coachId === coachId && r.status === "ACTIVE").length;
      if (active >= maxActive) return "QUOTA_FULL";
      const existing = rows.find((r) => r.coachId === coachId && r.studentId === studentId);
      if (existing && existing.status !== "ENDED") return "ALREADY_ACTIVE";
      if (existing) {
        existing.status = "ACTIVE";
        existing.endedAt = null;
        existing.endedBy = null;
        return existing;
      }
      const row = link({ id: `link-${rows.length}`, coachId, studentId });
      rows.push(row);
      return row;
    }),
    end: vi.fn(async (linkId: string, endedBy: string) => {
      const row = rows.find((r) => r.id === linkId);
      if (!row || row.status !== "ACTIVE") return undefined;
      row.status = "ENDED";
      row.endedAt = new Date();
      row.endedBy = endedBy;
      return row;
    }),
    purgeForUser: vi.fn(),
  };

  const invites = {
    resolveCoachId: vi.fn(async (code: string) => {
      if (code !== CODE) {
        throw new DomainError(ErrorCode.MENTORSHIP_INVITE_INVALID, 404);
      }
      return options.codeOwner ?? COACH;
    }),
  };

  const users = {
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

  const service = new MentorshipLinkService(
    links as never,
    invites as never,
    users as never,
    configRegistry as never,
    events as never,
  );
  return { service, links, invites, users, configRegistry, events, emitted, rows };
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
  });

  describe("the authorization gate", () => {
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

    it("counts only ACTIVE links against the quota", async () => {
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
      const { service, rows } = setup({ rows: [link()] });
      await service.endByCoach(COACH, STUDENT);
      expect(rows[0]!.endedBy).toBe(COACH);
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

  describe("the kill switch", () => {
    it("closes every entry point when the flag is off", async () => {
      config["mentorship.enabled"] = false;
      const { service } = setup({ rows: [link()] });
      for (const call of [
        () => service.acceptInvitation(STUDENT, CODE),
        () => service.previewInvitation(CODE),
        () => service.getMyCoach(STUDENT),
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
      ]);
    });

    it("returns null when there is no coach", async () => {
      const { service } = setup();
      await expect(service.getMyCoach(STUDENT)).resolves.toBeNull();
    });
  });
});
