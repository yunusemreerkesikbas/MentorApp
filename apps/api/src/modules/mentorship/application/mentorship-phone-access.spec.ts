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
const phoneGate = () => ({
  assertEnabled: vi.fn(),
  assertCoachPhoneVerified: vi.fn().mockRejectedValue(required),
});

describe("coach collection reads require current phone verification", () => {
  it("refuses roster before looking up students or evidence", async () => {
    const repo = { listByCoach: vi.fn() };
    const evidence = { listCohortSnapshots: vi.fn() };
    const service = new MentorshipRosterService(
      repo as never,
      {} as never,
      phoneGate() as never,
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
      phoneGate() as never,
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
      phoneGate() as never,
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
    const users = { isPhoneVerified: vi.fn(async () => false) };
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

  it("suppresses due reminders and response notifications for an unverified coach", async () => {
    const repo = {
      listDueCoachIds: vi.fn(async () => [COACH]),
      getDueCount: vi.fn(),
      notificationTarget: vi.fn(async () => ({
        coachId: COACH,
        studentId: STUDENT,
      })),
    };
    const service = new MentorshipFollowupService(
      repo as never,
      phoneGate() as never,
      {} as never,
      { get: vi.fn(async () => true) } as never,
      { isPhoneVerified: vi.fn(async () => false) } as never,
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
  });
});
