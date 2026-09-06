import { describe, expect, it, vi } from "vitest";
import { ErrorCode } from "../../../common/errors/error-code";
import { DomainError } from "../../../common/errors/domain-error";
import { MentorshipApplicationService } from "./mentorship-application.service";
import type { MentorshipApplicationRow } from "../infrastructure/mentorship-application.repository";

const USER = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-09-10T09:00:00.000Z");

const INPUT = {
  headline: "KPSS Türkçe koçu",
  bio: "On yıldır KPSS adaylarıyla çalışıyorum.",
  institution: "Ankara Üniversitesi",
  branch: "Türkçe",
  years: 10,
  note: null,
};

function row(over: Partial<MentorshipApplicationRow> = {}): MentorshipApplicationRow {
  return {
    id: "app-1",
    userId: USER,
    status: "PENDING",
    headline: INPUT.headline,
    bio: INPUT.bio,
    claimInstitution: INPUT.institution,
    claimBranch: INPUT.branch,
    claimYears: INPUT.years,
    claimNote: null,
    verifiedClaims: [],
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: null,
    submittedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

function setup(options: { open?: boolean; existing?: MentorshipApplicationRow | null } = {}) {
  const applications = {
    findByUser: vi.fn(async () => options.existing ?? undefined),
    findById: vi.fn(async () => options.existing ?? undefined),
    submit: vi.fn(async (userId: string) => row({ userId })),
    review: vi.fn(async (_id: string, verdict: { status: string }) =>
      row({ status: verdict.status, reviewedAt: NOW }),
    ),
    listByStatus: vi.fn(async () => []),
    updateProfile: vi.fn(async (_id: string, fields: { headline: string; bio: string }) =>
      row({ status: "APPROVED", ...fields }),
    ),
    purgeForUser: vi.fn(),
  };
  const config = {
    get: vi.fn(async (key: string) =>
      key === "mentorship.applications.open" ? (options.open ?? true) : 30,
    ),
  };
  const service = new MentorshipApplicationService(applications as never, config as never);
  return { service, applications };
}

const codeOf = async (fn: () => Promise<unknown>): Promise<string> => {
  try {
    await fn();
    return "NO_ERROR";
  } catch (err) {
    return err instanceof DomainError ? err.code : "NOT_DOMAIN_ERROR";
  }
};

describe("MentorshipApplicationService.submit", () => {
  it("writes a PENDING application for a first-time applicant", async () => {
    const { service, applications } = setup();
    const dto = await service.submit(USER, false, INPUT, NOW);
    expect(dto.status).toBe("PENDING");
    expect(applications.submit).toHaveBeenCalledWith(
      USER,
      expect.objectContaining({ headline: INPUT.headline, institution: INPUT.institution }),
      NOW,
    );
  });

  // The flag is the tap. It is deliberately NOT `mentorship.enabled`: applications have to be
  // collectable before the coach surface opens.
  it("refuses everyone while the form is closed", async () => {
    const { service } = setup({ open: false });
    expect(await codeOf(() => service.submit(USER, false, INPUT, NOW))).toBe(
      ErrorCode.MENTORSHIP_APPLICATIONS_CLOSED,
    );
  });

  it("tells an existing coach there is nothing to apply for", async () => {
    // Every coach today was granted the role by hand; a PENDING row from one is queue noise.
    const { service, applications } = setup();
    expect(await codeOf(() => service.submit(USER, true, INPUT, NOW))).toBe(
      ErrorCode.MENTORSHIP_ALREADY_COACH,
    );
    expect(applications.submit).not.toHaveBeenCalled();
  });

  it("refuses a second application while one is outstanding", async () => {
    const { service } = setup({ existing: row({ status: "PENDING" }) });
    expect(await codeOf(() => service.submit(USER, false, INPUT, NOW))).toBe(
      ErrorCode.MENTORSHIP_APPLICATION_PENDING,
    );
  });

  it("carries the remaining days when a rejection is still fresh", async () => {
    const { service } = setup({
      existing: row({
        status: "REJECTED",
        reviewedAt: new Date(NOW.getTime() - 8 * 86_400_000),
      }),
    });
    try {
      await service.submit(USER, false, INPUT, NOW);
      expect.unreachable("should have refused");
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      // The screen renders this number; recomputing a date client-side gets it wrong in another
      // timezone, so the answer travels with the refusal.
      expect((err as DomainError).details).toEqual({ days: 22 });
    }
  });

  it("lets a rejected applicant back in once the wait is over", async () => {
    const { service } = setup({
      existing: row({
        status: "REJECTED",
        reviewedAt: new Date(NOW.getTime() - 40 * 86_400_000),
      }),
    });
    await expect(service.submit(USER, false, INPUT, NOW)).resolves.toMatchObject({
      status: "PENDING",
    });
  });

  it("turns a lost upsert race into the same answer the loser would have got", async () => {
    // Two submissions at once: the repository's `setWhere` refuses the second, and the honest
    // reading of that is "your application is already pending", not a 500.
    const { service, applications } = setup();
    applications.submit.mockResolvedValueOnce(undefined as never);
    expect(await codeOf(() => service.submit(USER, false, INPUT, NOW))).toBe(
      ErrorCode.MENTORSHIP_APPLICATION_PENDING,
    );
  });
});

describe("MentorshipApplicationService.review", () => {
  it("records an approval with the claims the admin checked", async () => {
    const { service, applications } = setup({ existing: row() });
    const reviewed = await service.review(
      "app-1",
      "admin-1",
      { decision: "APPROVE", verifiedClaims: ["INSTITUTION"], reviewNote: null },
      NOW,
    );
    expect(reviewed?.status).toBe("APPROVED");
    expect(applications.review).toHaveBeenCalledWith(
      "app-1",
      expect.objectContaining({
        status: "APPROVED",
        verifiedClaims: ["INSTITUTION"],
        reviewedBy: "admin-1",
      }),
      NOW,
    );
  });

  // Idempotence is what makes the two-transaction approval safe to retry: the role grant can be
  // repeated freely, and the verdict refuses to be overwritten by the second attempt.
  it("returns null instead of overwriting a verdict somebody already recorded", async () => {
    const { service, applications } = setup({ existing: row() });
    applications.review.mockResolvedValueOnce(undefined as never);
    await expect(
      service.review("app-1", "admin-2", {
        decision: "REJECT",
        verifiedClaims: [],
        reviewNote: null,
      }),
    ).resolves.toBeNull();
  });

  it("404s on an application that does not exist", async () => {
    const { service } = setup({ existing: null });
    expect(await codeOf(() => service.findById("app-missing"))).toBe(
      ErrorCode.MENTORSHIP_APPLICATION_NOT_FOUND,
    );
  });
});

describe("MentorshipApplicationService.updateProfile", () => {
  const EDIT = { headline: "KPSS Türkçe koçu", bio: "Paragraf ağırlıklı çalışıyorum." };

  it("rewrites the two student-facing lines", async () => {
    const { service, applications } = setup({ existing: row({ status: "APPROVED" }) });
    await expect(service.updateProfile(USER, EDIT, NOW)).resolves.toMatchObject(EDIT);
    expect(applications.updateProfile).toHaveBeenCalledWith(USER, EDIT, NOW);
  });

  it("404s when there is no approved row to edit", async () => {
    // The repository scopes the update to APPROVED, so a pending or rejected application simply
    // has no profile to rewrite — and neither does somebody who never applied.
    const { service, applications } = setup({ existing: row({ status: "PENDING" }) });
    applications.updateProfile.mockResolvedValueOnce(undefined as never);
    expect(await codeOf(() => service.updateProfile(USER, EDIT, NOW))).toBe(
      ErrorCode.MENTORSHIP_APPLICATION_NOT_FOUND,
    );
  });

  describe("contact details", () => {
    it("refuses a phone number in the bio", async () => {
      const { service, applications } = setup({ existing: row({ status: "APPROVED" }) });
      expect(
        await codeOf(() =>
          service.updateProfile(USER, { ...EDIT, bio: "Bana 0532 123 45 67 yaz" }, NOW),
        ),
      ).toBe(ErrorCode.MENTORSHIP_CONTACT_NOT_ALLOWED);
      // Refused before the write, not cleaned up after it.
      expect(applications.updateProfile).not.toHaveBeenCalled();
    });

    it("refuses one in the headline too", async () => {
      const { service } = setup({ existing: row({ status: "APPROVED" }) });
      expect(
        await codeOf(() => service.updateProfile(USER, { ...EDIT, headline: "@kocumemre" }, NOW)),
      ).toBe(ErrorCode.MENTORSHIP_CONTACT_NOT_ALLOWED);
    });

    it("applies the same check on the way in, not only on edits", async () => {
      // Otherwise an applicant writes their number, the admin has to catch it by eye, and the
      // profile ships with it the moment they are approved.
      const { service } = setup();
      expect(
        await codeOf(() =>
          service.submit(USER, false, { ...INPUT, bio: "wp 0532 ile ulaş" }, NOW),
        ),
      ).toBe(ErrorCode.MENTORSHIP_CONTACT_NOT_ALLOWED);
    });

    it("leaves the admin-facing note alone", async () => {
      // `note` is written FOR the reviewer — a number there is the point of the field.
      const { service } = setup();
      await expect(
        service.submit(USER, false, { ...INPUT, note: "0532 123 45 67 arayabilirsiniz" }, NOW),
      ).resolves.toMatchObject({ status: "PENDING" });
    });
  });
});

describe("MentorshipApplicationService.findPublicProfile", () => {
  it("is null for someone with no application at all", async () => {
    const { service } = setup({ existing: null });
    await expect(service.findPublicProfile(USER)).resolves.toBeNull();
  });

  it("is null while the application is still pending", async () => {
    // A profile is what passed vetting. Showing an unreviewed one to a student would put our
    // consent screen behind claims nobody has read.
    const { service } = setup({ existing: row({ status: "PENDING" }) });
    await expect(service.findPublicProfile(USER)).resolves.toBeNull();
  });

  it("carries only verified claims, with the value that was checked", async () => {
    const { service } = setup({
      existing: row({ status: "APPROVED", verifiedClaims: ["INSTITUTION"] }),
    });
    const profile = await service.findPublicProfile(USER);
    expect(profile).toMatchObject({ headline: INPUT.headline, bio: INPUT.bio });
    // BRANCH and YEARS are on the row and were NOT verified, so they do not travel: rendered
    // beside a checked claim they would read as endorsed by us.
    expect(profile?.verifiedClaims).toEqual([
      { claim: "INSTITUTION", value: INPUT.institution },
    ]);
  });

  it("drops a verified claim whose value is gone", async () => {
    const { service } = setup({
      existing: row({ status: "APPROVED", verifiedClaims: ["BRANCH"], claimBranch: null }),
    });
    expect((await service.findPublicProfile(USER))?.verifiedClaims).toEqual([]);
  });
});
