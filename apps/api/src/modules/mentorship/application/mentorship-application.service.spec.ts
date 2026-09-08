import { describe, expect, it, vi } from "vitest";
import { ErrorCode } from "../../../common/errors/error-code";
import { DomainError } from "../../../common/errors/domain-error";
import { MentorshipApplicationService } from "./mentorship-application.service";
import type { MentorshipApplicationRow } from "../infrastructure/mentorship-application.repository";

const USER = "11111111-1111-4111-8111-111111111111";
const ADMIN = "22222222-2222-4222-8222-222222222222";
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
    status: "ACTIVE",
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

function setup(
  options: {
    open?: boolean;
    existing?: MentorshipApplicationRow | null;
    emailVerified?: boolean;
  } = {},
) {
  const applications = {
    findByUser: vi.fn(async () => options.existing ?? undefined),
    register: vi.fn(async (userId: string) => row({ userId })),
    setStatus: vi.fn(async (_id: string, verdict: { status: string }) =>
      row({ status: verdict.status, reviewedAt: NOW }),
    ),
    setVerifiedClaims: vi.fn(async (_id: string, verifiedClaims: string[]) =>
      row({ verifiedClaims, reviewedAt: NOW }),
    ),
    listByStatus: vi.fn(async () => []),
    updateProfile: vi.fn(async (_id: string, fields: { headline: string; bio: string }) =>
      row({ ...fields }),
    ),
    purgeForUser: vi.fn(),
  };
  const config = {
    get: vi.fn(async (key: string) =>
      key === "mentorship.applications.open" ? (options.open ?? true) : 30,
    ),
  };
  const users = {
    addRole: vi.fn(async () => undefined),
    removeRole: vi.fn(async () => undefined),
    isEmailVerified: vi.fn(async () => options.emailVerified ?? true),
  };
  const service = new MentorshipApplicationService(
    applications as never,
    config as never,
    users as never,
  );
  return { service, applications, users };
}

const codeOf = async (fn: () => Promise<unknown>): Promise<string> => {
  try {
    await fn();
    return "NO_ERROR";
  } catch (err) {
    return err instanceof DomainError ? err.code : "NOT_DOMAIN_ERROR";
  }
};

describe("MentorshipApplicationService.register", () => {
  it("writes an ACTIVE row and grants COACH", async () => {
    const { service, applications, users } = setup();
    await expect(service.register(USER, INPUT, NOW)).resolves.toMatchObject({ status: "ACTIVE" });
    expect(applications.register).toHaveBeenCalledWith(
      USER,
      {
        headline: INPUT.headline,
        bio: INPUT.bio,
        institution: INPUT.institution,
        branch: INPUT.branch,
        years: INPUT.years,
        note: null,
      },
      NOW,
    );
    expect(users.addRole).toHaveBeenCalledWith(USER, "COACH");
  });

  it("writes the row BEFORE granting the role", async () => {
    // Ordering rule: whichever order leaves the coach with fewer powers after a crash wins. A row
    // with no role is powerless and repairable from the admin registry; a role with no row is a
    // coach nobody has a record of.
    const order: string[] = [];
    const { service, applications, users } = setup();
    applications.register.mockImplementationOnce(async (userId: string) => {
      order.push("row");
      return row({ userId });
    });
    users.addRole.mockImplementationOnce(async () => {
      order.push("role");
    });
    await service.register(USER, INPUT, NOW);
    expect(order).toEqual(["row", "role"]);
  });

  it("refuses while registration is closed, before touching anything", async () => {
    const { service, applications, users } = setup({ open: false });
    expect(await codeOf(() => service.register(USER, INPUT, NOW))).toBe(
      ErrorCode.MENTORSHIP_APPLICATIONS_CLOSED,
    );
    expect(applications.register).not.toHaveBeenCalled();
    expect(users.addRole).not.toHaveBeenCalled();
  });

  /*
   * The three refusals below are the load-bearing ones. Registration writes ACTIVE, so anything it
   * lets through overwrites an admin's decision — a suspended coach clearing their own suspension
   * by filling in the form again is the failure this guards.
   */
  it("refuses an active coach", async () => {
    const { service } = setup({ existing: row({ status: "ACTIVE" }) });
    expect(await codeOf(() => service.register(USER, INPUT, NOW))).toBe(
      ErrorCode.MENTORSHIP_ALREADY_COACH,
    );
  });

  it("refuses someone an admin is mid-review on", async () => {
    const { service } = setup({ existing: row({ status: "PENDING" }) });
    expect(await codeOf(() => service.register(USER, INPUT, NOW))).toBe(
      ErrorCode.MENTORSHIP_APPLICATION_PENDING,
    );
  });

  it("refuses a suspended coach, and grants no role on the way out", async () => {
    const { service, users } = setup({ existing: row({ status: "SUSPENDED" }) });
    expect(await codeOf(() => service.register(USER, INPUT, NOW))).toBe(
      ErrorCode.MENTORSHIP_COACH_SUSPENDED,
    );
    expect(users.addRole).not.toHaveBeenCalled();
  });

  it("reports a lost race as ALREADY_COACH rather than granting the role", async () => {
    // `DO NOTHING` returned nothing: a concurrent registration won. The answer is the one the loser
    // would have got a millisecond earlier, and the role must not be granted off a row we did not
    // write.
    const { service, applications, users } = setup();
    applications.register.mockResolvedValueOnce(undefined as never);
    expect(await codeOf(() => service.register(USER, INPUT, NOW))).toBe(
      ErrorCode.MENTORSHIP_ALREADY_COACH,
    );
    expect(users.addRole).not.toHaveBeenCalled();
  });
});

describe("MentorshipApplicationService.assertCanInvite", () => {
  it("passes for a verified, active coach", async () => {
    const { service } = setup({ existing: row({ status: "ACTIVE" }), emailVerified: true });
    expect(await codeOf(() => service.assertCanInvite(USER))).toBe("NO_ERROR");
  });

  it("refuses an unverified email", async () => {
    // Self-registration made a reachable inbox the only cost of becoming a coach.
    const { service } = setup({ existing: row({ status: "ACTIVE" }), emailVerified: false });
    expect(await codeOf(() => service.assertCanInvite(USER))).toBe(
      ErrorCode.MENTORSHIP_EMAIL_NOT_VERIFIED,
    );
  });

  it("refuses a coach with the role but no registry row", async () => {
    // An admin-designated coach before they wrote their own profile: the student's consent screen
    // would be blank at the exact moment they decide to hand over private data.
    const { service } = setup({ existing: null, emailVerified: true });
    expect(await codeOf(() => service.assertCanInvite(USER))).toBe(
      ErrorCode.MENTORSHIP_COACH_NOT_ACTIVE,
    );
  });

  it("refuses PENDING and SUSPENDED alike", async () => {
    for (const status of ["PENDING", "SUSPENDED"]) {
      const { service } = setup({ existing: row({ status }), emailVerified: true });
      expect(await codeOf(() => service.assertCanInvite(USER))).toBe(
        ErrorCode.MENTORSHIP_COACH_NOT_ACTIVE,
      );
    }
  });

  it("canInvite answers the same question without throwing", async () => {
    const active = setup({ existing: row({ status: "ACTIVE" }), emailVerified: true });
    const suspended = setup({ existing: row({ status: "SUSPENDED" }), emailVerified: true });
    await expect(active.service.canInvite(USER)).resolves.toBe(true);
    await expect(suspended.service.canInvite(USER)).resolves.toBe(false);
  });
});

describe("MentorshipApplicationService.setStatus", () => {
  it("revokes COACH before writing a non-active standing", async () => {
    // Same ordering rule, mirrored: a crash after the revoke leaves a stale ACTIVE row and no role,
    // which is powerless. The reverse would leave a suspended row and a working invite code.
    const order: string[] = [];
    const { service, applications, users } = setup({ existing: row() });
    users.removeRole.mockImplementationOnce(async () => {
      order.push("role");
    });
    applications.setStatus.mockImplementationOnce(async () => {
      order.push("row");
      return row({ status: "SUSPENDED" });
    });
    await service.setStatus(USER, { status: "SUSPENDED", reviewNote: "spam" }, ADMIN, NOW);
    expect(order).toEqual(["role", "row"]);
    expect(users.addRole).not.toHaveBeenCalled();
  });

  it("writes ACTIVE before granting COACH back", async () => {
    const order: string[] = [];
    const { service, applications, users } = setup({ existing: row({ status: "SUSPENDED" }) });
    applications.setStatus.mockImplementationOnce(async () => {
      order.push("row");
      return row({ status: "ACTIVE" });
    });
    users.addRole.mockImplementationOnce(async () => {
      order.push("role");
    });
    await service.setStatus(USER, { status: "ACTIVE", reviewNote: null }, ADMIN, NOW);
    expect(order).toEqual(["row", "role"]);
    expect(users.removeRole).not.toHaveBeenCalled();
  });

  it("does not grant the role when the registry row vanished", async () => {
    const { service, applications, users } = setup({ existing: row({ status: "SUSPENDED" }) });
    applications.setStatus.mockResolvedValueOnce(undefined as never);
    await expect(
      service.setStatus(USER, { status: "ACTIVE", reviewNote: null }, ADMIN, NOW),
    ).resolves.toBeNull();
    expect(users.addRole).not.toHaveBeenCalled();
  });

  it("leaves verified claims alone", async () => {
    // Reinstating must not silently re-assert badges nobody re-read.
    const { service, applications } = setup({ existing: row({ verifiedClaims: ["INSTITUTION"] }) });
    await service.setStatus(USER, { status: "ACTIVE", reviewNote: null }, ADMIN, NOW);
    expect(applications.setStatus).toHaveBeenCalledWith(
      USER,
      { status: "ACTIVE", reviewNote: null, reviewedBy: ADMIN },
      NOW,
    );
  });
});

describe("MentorshipApplicationService.updateProfile", () => {
  const EDIT = { headline: "KPSS Türkçe koçu", bio: "Paragraf ağırlıklı çalışıyorum." };

  it("rewrites the two student-facing lines", async () => {
    const { service, applications } = setup({ existing: row() });
    await expect(service.updateProfile(USER, EDIT, NOW)).resolves.toMatchObject(EDIT);
    expect(applications.updateProfile).toHaveBeenCalledWith(USER, EDIT, NOW);
  });

  it("404s when there is no ACTIVE row to edit", async () => {
    // The repository scopes the update to ACTIVE, so a suspended coach cannot keep polishing the
    // profile a student would read — and neither can somebody who never registered.
    const { service, applications } = setup({ existing: row({ status: "SUSPENDED" }) });
    applications.updateProfile.mockResolvedValueOnce(undefined as never);
    expect(await codeOf(() => service.updateProfile(USER, EDIT, NOW))).toBe(
      ErrorCode.MENTORSHIP_APPLICATION_NOT_FOUND,
    );
  });

  describe("contact details", () => {
    it("refuses a phone number in the bio", async () => {
      const { service, applications } = setup({ existing: row() });
      expect(
        await codeOf(() =>
          service.updateProfile(USER, { ...EDIT, bio: "Bana 0532 123 45 67 yaz" }, NOW),
        ),
      ).toBe(ErrorCode.MENTORSHIP_CONTACT_NOT_ALLOWED);
      // Refused before the write, not cleaned up after it.
      expect(applications.updateProfile).not.toHaveBeenCalled();
    });

    it("refuses one in the headline too", async () => {
      const { service } = setup({ existing: row() });
      expect(
        await codeOf(() => service.updateProfile(USER, { ...EDIT, headline: "@kocumemre" }, NOW)),
      ).toBe(ErrorCode.MENTORSHIP_CONTACT_NOT_ALLOWED);
    });

    it("applies the same check at registration, and grants no role when it trips", async () => {
      // Registration publishes the profile immediately now: there is no reviewer between this text
      // and a student's consent screen, so the check on the way in is the only one there is.
      const { service, users } = setup();
      expect(
        await codeOf(() => service.register(USER, { ...INPUT, bio: "wp 0532 ile ulaş" }, NOW)),
      ).toBe(ErrorCode.MENTORSHIP_CONTACT_NOT_ALLOWED);
      expect(users.addRole).not.toHaveBeenCalled();
    });

    it("leaves the admin-facing note alone", async () => {
      // `note` is written FOR the admin — a number there is the point of the field.
      const { service } = setup();
      await expect(
        service.register(USER, { ...INPUT, note: "0532 123 45 67 arayabilirsiniz" }, NOW),
      ).resolves.toMatchObject({ status: "ACTIVE" });
    });
  });
});

describe("MentorshipApplicationService.findPublicProfile", () => {
  it("is null for someone with no registry row at all", async () => {
    const { service } = setup({ existing: null });
    await expect(service.findPublicProfile(USER)).resolves.toBeNull();
  });

  it("is null for a suspended coach", async () => {
    // A coach an admin stopped must not keep advertising to the student they are linked to.
    const { service } = setup({ existing: row({ status: "SUSPENDED" }) });
    await expect(service.findPublicProfile(USER)).resolves.toBeNull();
  });

  it("carries EVERY claim, each flagged with whether anybody checked it", async () => {
    // The APP-089 inversion. Sending only verified claims made a checked coach and an unchecked one
    // render identically, and the student deciding whether to hand over private data could not tell
    // them apart.
    const { service } = setup({ existing: row({ verifiedClaims: ["INSTITUTION"] }) });
    const profile = await service.findPublicProfile(USER);
    expect(profile).toMatchObject({ headline: INPUT.headline, bio: INPUT.bio });
    expect(profile?.claims).toEqual([
      { claim: "INSTITUTION", value: INPUT.institution, verified: true },
      { claim: "BRANCH", value: INPUT.branch, verified: false },
      { claim: "YEARS", value: "10", verified: false },
    ]);
  });

  it("drops a claim the coach never made, verified or not", async () => {
    const { service } = setup({
      existing: row({
        verifiedClaims: ["BRANCH"],
        claimBranch: null,
        claimInstitution: null,
        claimYears: null,
      }),
    });
    expect((await service.findPublicProfile(USER))?.claims).toEqual([]);
  });
});

describe("MentorshipApplicationService.findStatus", () => {
  it("reports the coach's standing for the student's screen", async () => {
    const { service } = setup({ existing: row({ status: "PENDING" }) });
    await expect(service.findStatus(USER)).resolves.toBe("PENDING");
  });

  it("is null for a coach with no registry row", async () => {
    const { service } = setup({ existing: null });
    await expect(service.findStatus(USER)).resolves.toBeNull();
  });
});
