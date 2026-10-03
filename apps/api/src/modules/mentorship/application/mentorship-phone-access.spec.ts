import { describe, expect, it, vi } from "vitest";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { MentorshipQueryAdapter } from "../infrastructure/mentorship-query.adapter";
import { MentorshipCohortBriefService } from "./mentorship-cohort-brief.service";
import { MentorshipFollowupService } from "./mentorship-followup.service";
import { MentorshipRosterService } from "./mentorship-roster.service";

const COACH = "coach";
const STUDENT = "student";
const required = new DomainError(ErrorCode.AUTH_PHONE_REQUIRED, 403);
const contactGate = () => ({
  assertEnabled: vi.fn(),
  assertCoachVerifiedContacts: vi.fn().mockRejectedValue(required),
});

describe("coach collection reads require current contact verification", () => {
  it("refuses roster before looking up students or evidence", async () => {
    const repo = { listByCoach: vi.fn() };
    const evidence = { listCohortSnapshots: vi.fn() };
    const service = new MentorshipRosterService(
      repo as never,
      {} as never,
      contactGate() as never,
      evidence as never,
      {} as never,
      {} as never,
    );
    await expect(service.listRoster(COACH, "ACTIVE", 1, 20)).rejects.toBe(
      required,
    );
    expect(repo.listByCoach).not.toHaveBeenCalled();
    expect(evidence.listCohortSnapshots).not.toHaveBeenCalled();
  });

  it("refuses cached cohort briefs before loading private student summaries", async () => {
    const repo = { find: vi.fn() };
    const service = new MentorshipCohortBriefService(
      contactGate() as never,
      {} as never,
      {} as never,
      repo as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(service.read(COACH)).rejects.toBe(required);
    expect(repo.find).not.toHaveBeenCalled();
  });

  it("refuses unfiltered coach followups before reading relationship records", async () => {
    const repo = { listCoach: vi.fn() };
    const service = new MentorshipFollowupService(
      repo as never,
      contactGate() as never,
      {} as never,
      { get: vi.fn(async () => true) } as never,
      {} as never,
      {} as never,
    );
    await expect(
      service.listCoach(COACH, { page: 1, pageSize: 20 } as never),
    ).rejects.toBe(required);
    expect(repo.listCoach).not.toHaveBeenCalled();
  });

  it("does not read behavioral evidence for a digest going to an unverified coach", async () => {
    const evidence = { listTriageSnapshots: vi.fn() };
    const users = { isEmailVerified: vi.fn(async () => true), isPhoneVerified: vi.fn(async () => false) };
    const service = new MentorshipQueryAdapter(
      {
        listAllActiveLinks: vi.fn(async () => [
          { coachId: COACH, studentId: STUDENT },
        ]),
      } as never,
      evidence as never,
      users as never,
      {} as never,
    );
    await expect(service.listRiskDigestCandidates(new Date())).resolves.toEqual(
      [],
    );
    expect(evidence.listTriageSnapshots).not.toHaveBeenCalled();
    expect(users.isPhoneVerified).toHaveBeenCalledWith(COACH);
  });

  it.each(["email", "phone"])("suppresses due reminders and response notifications until coach %s is reverified", async (contact) => {
    const repo = {
      listDueCoachIds: vi.fn(async () => [COACH]),
      getDueCount: vi.fn(),
      notificationTarget: vi.fn(async () => ({
        coachId: COACH,
        studentId: STUDENT,
      })),
    };
    const users = { isEmailVerified: vi.fn(async () => contact !== "email"), isPhoneVerified: vi.fn(async () => contact !== "phone") };
    const service = new MentorshipFollowupService(
      repo as never,
      contactGate() as never,
      {} as never,
      { get: vi.fn(async () => true) } as never,
      users as never,
      {} as never,
    );
    await expect(service.listDueCoachIds(new Date())).resolves.toEqual([]);
    await expect(service.getDueCount(COACH, new Date())).resolves.toBe(0);
    await expect(
      service.getNotificationTarget("followup", "responded", 1),
    ).resolves.toBeNull();
    // Student delivery stays independent of the coach's verification.
    await expect(
      service.getNotificationTarget("followup", "shared", 1),
    ).resolves.toMatchObject({ recipientId: STUDENT });
    expect(repo.getDueCount).not.toHaveBeenCalled();
    users.isEmailVerified.mockResolvedValue(true);
    users.isPhoneVerified.mockResolvedValue(true);
    await expect(service.listDueCoachIds(new Date())).resolves.toEqual([COACH]);
    await expect(service.getNotificationTarget("followup", "responded", 1)).resolves.toMatchObject({ recipientId: COACH });
  });
});
