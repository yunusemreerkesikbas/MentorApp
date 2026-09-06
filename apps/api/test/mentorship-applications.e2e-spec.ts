import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UserRole } from "@mentor/types";
import { ConfigRegistryService } from "../src/common/config/config-registry.service";

/**
 * W8 coach applications e2e — the curation pipeline against real Postgres.
 *
 * The claim under test is the one the unit specs cannot make: an approval really does two writes
 * in two modules, and the person walks away actually carrying COACH with an audit line behind it.
 */
describe("mentorship coach applications (e2e)", () => {
  let app: INestApplication;
  let pool: Pool;

  const token: Record<string, string> = {};
  const userId: Record<string, string> = {};

  const auth = (who: string) => ({ Authorization: `Bearer ${token[who]}` });
  const http = () => request(app.getHttpServer());

  const svc = async (fn: (c: import("pg").PoolClient) => Promise<void>) => {
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query("select set_config('app.role','SERVICE',true)");
      await fn(c);
      await c.query("commit");
    } finally {
      c.release();
    }
  };

  const APPLICATION = {
    headline: "KPSS Türkçe koçu",
    bio: "On yıldır KPSS adaylarıyla çalışıyorum, paragraf ve dil bilgisi ağırlıklı.",
    institution: "Ankara Üniversitesi",
    branch: "Türkçe",
    years: 10,
  };

  let stamp = 0;

  const signup = async (label: string): Promise<void> => {
    const res = await http()
      .post("/v1/auth/signup")
      .send({
        email: `w8app-${label}-${stamp}@test.local`,
        password: "Sifre1234",
        displayName: `Aday ${label}`,
        kvkkAccepted: true,
      });
    expect(res.status).toBe(201);
    token[label] = res.body.accessToken;
    userId[label] = res.body.user.id;
  };

  const relogin = async (label: string): Promise<void> => {
    const login = await http()
      .post("/v1/auth/login")
      .send({ email: `w8app-${label}-${stamp}@test.local`, password: "Sifre1234" });
    expect(login.status).toBe(200);
    token[label] = login.body.accessToken;
  };

  const setOpen = (open: boolean) =>
    app.get(ConfigRegistryService).set(userId.admin!, "mentorship.applications.open", open);

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test";
    process.env.JWT_ACCESS_SECRET ??= "test-secret-test-secret-test-secret!!";

    const { AppModule } = await import("../src/app.module");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix("v1");
    app.use(cookieParser());
    await app.init();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });

    stamp = Date.now();
    for (const label of ["applicant", "rejected", "admin", "student"]) await signup(label);
    await svc(async (c) => {
      await c.query("update users set roles = array_append(roles,$1) where id=$2", [
        UserRole.SUPER_ADMIN,
        userId.admin,
      ]);
    });
    await relogin("admin");
    await setOpen(true);
    // The coach surface itself, so the approval test can prove the applicant reaches it. The two
    // flags are independent by design — this suite is the one place both are on at once.
    await app.get(ConfigRegistryService).set(userId.admin!, "mentorship.enabled", true);
  }, 120_000);

  afterAll(async () => {
    if (pool) {
      await svc(async (c) => {
        await c.query("delete from config_overrides where key like 'mentorship.%'");
      });
    }
    await app?.close();
    await pool?.end();
  });

  it("requires auth, and keeps the queue behind SUPER_ADMIN", async () => {
    expect((await http().post("/v1/mentorship/applications").send(APPLICATION)).status).toBe(401);
    expect((await http().get("/v1/admin/coach-applications").set(auth("applicant"))).status).toBe(
      403,
    );
  });

  it("says nothing has been applied for before anyone applies", async () => {
    const res = await http().get("/v1/mentorship/applications/mine").set(auth("applicant"));
    expect(res.status).toBe(200);
    // Empty body, not a 404: "you have not applied" is the most common state there is.
    expect(res.body).toEqual({});
  });

  it("refuses the form while the flag is off, without touching mentorship.enabled", async () => {
    await setOpen(false);
    const res = await http()
      .post("/v1/mentorship/applications")
      .set(auth("applicant"))
      .send(APPLICATION);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("MENTORSHIP_APPLICATIONS_CLOSED");
    await setOpen(true);
  });

  it("refuses a body that tries to approve itself", async () => {
    // `status` and `verifiedClaims` are the admin's columns; `.strict()` makes the attempt loud
    // rather than silently dropping the field and letting the applicant believe it landed.
    const res = await http()
      .post("/v1/mentorship/applications")
      .set(auth("applicant"))
      .send({ ...APPLICATION, status: "APPROVED", verifiedClaims: ["INSTITUTION"] });
    expect(res.status).toBe(400);
  });

  it("takes an application and shows it to the applicant and the queue", async () => {
    const created = await http()
      .post("/v1/mentorship/applications")
      .set(auth("applicant"))
      .send(APPLICATION);
    expect(created.status).toBe(201);
    expect(created.body.status).toBe("PENDING");
    expect(created.body.verifiedClaims).toEqual([]);

    const mine = await http().get("/v1/mentorship/applications/mine").set(auth("applicant"));
    expect(mine.body).toMatchObject({ status: "PENDING", headline: APPLICATION.headline });

    const queue = await http().get("/v1/admin/coach-applications").set(auth("admin"));
    expect(queue.status).toBe(200);
    const row = queue.body.find((r: { userId: string }) => r.userId === userId.applicant);
    expect(row).toMatchObject({ status: "PENDING", hasCoachRole: false });
    // The queue joins the person back on: W8 never reads `users`, admin does.
    expect(row.displayName).not.toBe("");
    expect(row.email).toContain("w8app-applicant");
  });

  it("refuses a second application while one is outstanding", async () => {
    const res = await http()
      .post("/v1/mentorship/applications")
      .set(auth("applicant"))
      .send(APPLICATION);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("MENTORSHIP_APPLICATION_PENDING");
  });

  it("grants COACH on approval and leaves an audit line behind", async () => {
    const queue = await http().get("/v1/admin/coach-applications").set(auth("admin"));
    const target = queue.body.find((r: { userId: string }) => r.userId === userId.applicant);

    const reviewed = await http()
      .post(`/v1/admin/coach-applications/${target.id}/review`)
      .set(auth("admin"))
      .send({ decision: "APPROVE", verifiedClaims: ["INSTITUTION", "BRANCH"], reviewNote: null });
    expect(reviewed.status).toBe(200);
    expect(reviewed.body).toMatchObject({ status: "APPROVED", hasCoachRole: true });
    expect(reviewed.body.verifiedClaims.sort()).toEqual(["BRANCH", "INSTITUTION"]);

    // The claim this suite exists for: the role is really on the row, not just in a DTO.
    await svc(async (c) => {
      const res = await c.query("select roles from users where id = $1", [userId.applicant]);
      expect(res.rows[0].roles).toContain(UserRole.COACH);
    });

    // The audit endpoint returns a plain page of entries with no action filter, so the assertion
    // does the filtering. Adding a query param for one test would be widening an admin API to
    // make a test shorter.
    const audit = await http().get("/v1/admin/audit-log").set(auth("admin"));
    expect(audit.status).toBe(200);
    expect(
      (audit.body as { action: string; targetId: string }[]).some(
        (entry) => entry.action === "coach-application.review" && entry.targetId === target.id,
      ),
    ).toBe(true);

    // The coach panel opens on the applicant's EXISTING token, with no re-login.
    //
    // This is a change, and it is worth pinning: `JwtAuthGuard` resolves the principal through
    // `TokenService.validateSession`, which joins `users` on every request, so a role granted a
    // moment ago is live immediately. The older note in mentorship.md ("the coach must re-login:
    // roles are read from the DB on refresh, not patched into a live JWT") described the previous
    // session model and is no longer true — the doc is corrected in this slice.
    expect((await http().get("/v1/mentorship/overview").set(auth("applicant"))).status).toBe(200);
  });

  describe("the approved profile", () => {
    it("reaches the student's consent screen, which used to show a name and nothing else", async () => {
      const code = await http().post("/v1/mentorship/invite-code").set(auth("applicant"));
      expect(code.status).toBe(200);

      const preview = await http()
        .post("/v1/mentorship/invitations/preview")
        .set(auth("student"))
        .send({ code: code.body.code });
      expect(preview.status).toBe(200);
      expect(preview.body.coachProfile).toMatchObject({
        headline: APPLICATION.headline,
        bio: APPLICATION.bio,
      });
      // Only what an admin checked travels, with the value they checked. BRANCH and YEARS are on
      // the row and were not verified: beside a checked claim they would read as endorsed by us.
      expect(preview.body.coachProfile.verifiedClaims).toEqual([
        { claim: "INSTITUTION", value: APPLICATION.institution },
        { claim: "BRANCH", value: APPLICATION.branch },
      ]);
    });

    it("lets the coach rewrite their own two lines", async () => {
      const res = await http()
        .put("/v1/mentorship/applications/mine")
        .set(auth("applicant"))
        .send({ headline: "KPSS Türkçe koçu", bio: "Paragraf ağırlıklı çalışıyorum." });
      expect(res.status).toBe(200);
      expect(res.body.bio).toBe("Paragraf ağırlıklı çalışıyorum.");
      // The verdict is untouched: editing the profile is not a second review.
      expect(res.body.status).toBe("APPROVED");
      expect(res.body.verifiedClaims.sort()).toEqual(["BRANCH", "INSTITUTION"]);
    });

    it("refuses contact details in the text a student will read", async () => {
      const res = await http()
        .put("/v1/mentorship/applications/mine")
        .set(auth("applicant"))
        .send({ headline: "KPSS koçu", bio: "Bana 0532 123 45 67 numarasından ulaş" });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("MENTORSHIP_CONTACT_NOT_ALLOWED");
    });

    it("refuses a body that reaches for the verdict columns", async () => {
      const res = await http()
        .put("/v1/mentorship/applications/mine")
        .set(auth("applicant"))
        .send({ headline: "KPSS koçu", bio: "Metin", verifiedClaims: ["YEARS"] });
      expect(res.status).toBe(400);
    });

    it("has nothing to rewrite for somebody who was never approved", async () => {
      const res = await http()
        .put("/v1/mentorship/applications/mine")
        .set(auth("rejected"))
        .send({ headline: "Deneme", bio: "Deneme metni" });
      expect(res.status).toBe(404);
    });
  });

  it("tells an approved coach there is nothing left to apply for", async () => {
    const res = await http()
      .post("/v1/mentorship/applications")
      .set(auth("applicant"))
      .send(APPLICATION);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("MENTORSHIP_ALREADY_COACH");
  });

  it("is safe to review twice — the second call changes nothing", async () => {
    const queue = await http()
      .get("/v1/admin/coach-applications?status=APPROVED")
      .set(auth("admin"));
    const target = queue.body.find((r: { userId: string }) => r.userId === userId.applicant);

    // A retry after a crash between the two writes, or two admins on the same morning. It must not
    // overwrite the first reviewer's claims with an empty set.
    const again = await http()
      .post(`/v1/admin/coach-applications/${target.id}/review`)
      .set(auth("admin"))
      .send({ decision: "REJECT", verifiedClaims: [], reviewNote: "fikrimi değiştirdim" });
    expect(again.status).toBe(200);
    expect(again.body.status).toBe("APPROVED");
    expect(again.body.verifiedClaims.sort()).toEqual(["BRANCH", "INSTITUTION"]);
  });

  describe("a rejection", () => {
    let rejectedId = "";

    it("carries the admin's reason back to the applicant and verifies nothing", async () => {
      const created = await http()
        .post("/v1/mentorship/applications")
        .set(auth("rejected"))
        .send({ ...APPLICATION, headline: "Deneyimsiz aday" });
      rejectedId = created.body.id;

      const reviewed = await http()
        .post(`/v1/admin/coach-applications/${rejectedId}/review`)
        .set(auth("admin"))
        // Claims sent with a rejection are dropped by the schema: a refusal verifies nothing, and
        // a badge nobody stands behind is worse than no badge.
        .send({
          decision: "REJECT",
          verifiedClaims: ["INSTITUTION"],
          reviewNote: "Deneyim yeterli değil.",
        });
      expect(reviewed.status).toBe(200);
      expect(reviewed.body.status).toBe("REJECTED");
      expect(reviewed.body.verifiedClaims).toEqual([]);
      expect(reviewed.body.hasCoachRole).toBe(false);

      const mine = await http().get("/v1/mentorship/applications/mine").set(auth("rejected"));
      expect(mine.body).toMatchObject({
        status: "REJECTED",
        reviewNote: "Deneyim yeterli değil.",
      });
    });

    it("holds the applicant off until the wait is over, and says how long", async () => {
      const res = await http()
        .post("/v1/mentorship/applications")
        .set(auth("rejected"))
        .send(APPLICATION);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe("MENTORSHIP_APPLICATION_TOO_SOON");
      expect(res.body.details.days).toBe(30);
    });

    it("lets them back in once it is, reviving the row rather than adding a second", async () => {
      await svc(async (c) => {
        await c.query(
          "update mentorship_coach_applications set reviewed_at = now() - interval '31 days' where id = $1",
          [rejectedId],
        );
      });

      const again = await http()
        .post("/v1/mentorship/applications")
        .set(auth("rejected"))
        .send({ ...APPLICATION, headline: "Bu sefer daha hazırım" });
      expect(again.status).toBe(201);
      expect(again.body.id).toBe(rejectedId);
      expect(again.body.status).toBe("PENDING");
      // The revived row drops last time's verdict: showing the applicant an old refusal next to a
      // fresh submission would be describing a decision nobody has made yet.
      expect(again.body.reviewNote).toBeNull();
      expect(again.body.reviewedAt).toBeNull();
    });
  });

  it("erases an application with the account (the FK cascade never fires)", async () => {
    // Erasure ANONYMIZES the `users` row rather than deleting it, so `ON DELETE CASCADE` is not
    // the safety net it looks like — the same trap `mentorship_program_templates` documents.
    expect((await http().delete("/v1/account").set(auth("rejected"))).status).toBe(204);
    await svc(async (c) => {
      const res = await c.query(
        "select 1 from mentorship_coach_applications where user_id = $1",
        [userId.rejected],
      );
      expect(res.rowCount).toBe(0);
    });
  });
});
