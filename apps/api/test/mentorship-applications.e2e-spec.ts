import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UserRole } from "@mentor/types";
import { ConfigRegistryService } from "../src/common/config/config-registry.service";

/**
 * W8 coach registry e2e (APP-089) — self-service registration against real Postgres.
 *
 * The claims under test are the ones no unit spec can make, and they are all about the gate that
 * replaced pre-approval:
 *   - registering really grants COACH, on the caller's existing token;
 *   - an unverified email really keeps the invite code shut;
 *   - suspending a coach really closes the panel AND kills codes already in students' hands.
 *
 * That last one is the subtle half. Codes outlive their issuing, so checking only at issue time
 * would leave every handed-out code live for its full TTL after a suspension.
 */
describe("mentorship coach registry (e2e)", () => {
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

  const REGISTRATION = {
    headline: "KPSS Türkçe koçu",
    bio: "On yıldır KPSS adaylarıyla çalışıyorum, paragraf ve dil bilgisi ağırlıklı.",
    institution: "Ankara Üniversitesi",
    branch: "Türkçe",
    years: 10,
  };

  let stamp = 0;
  const emailOf = (label: string) => `w8reg-${label}-${stamp}@test.local`;

  const signup = async (label: string, intent?: "COACH"): Promise<void> => {
    const res = await http()
      .post("/v1/auth/signup")
      .send({
        email: emailOf(label),
        password: "Sifre1234",
        displayName: `Kisi ${label}`,
        kvkkAccepted: true,
        ...(intent ? { intent } : {}),
      });
    expect(res.status).toBe(201);
    token[label] = res.body.accessToken;
    userId[label] = res.body.user.id;
  };

  const relogin = async (label: string): Promise<void> => {
    const login = await http()
      .post("/v1/auth/login")
      .send({ email: emailOf(label), password: "Sifre1234" });
    expect(login.status).toBe(200);
    token[label] = login.body.accessToken;
  };

  /**
   * Verify an email without going through the mailbox.
   *
   * The real flow posts a token that only ever exists in an email, so a suite that wanted to drive
   * it end to end would be testing Postmark. What matters here is what the FLAG unlocks.
   */
  const verifyEmail = (label: string) =>
    svc(async (c) => {
      await c.query("update users set email_verified_at = now() where id = $1", [userId[label]]);
    });

  const setOpen = (open: boolean) =>
    app.get(ConfigRegistryService).set(userId.admin!, "mentorship.applications.open", open);

  const setStatus = (label: string, status: string, reviewNote: string | null = null) =>
    http()
      .post(`/v1/admin/coaches/${userId[label]}/status`)
      .set(auth("admin"))
      .send({ status, reviewNote });

  const rolesOf = async (label: string): Promise<string[]> => {
    let roles: string[] = [];
    await svc(async (c) => {
      const res = await c.query("select roles from users where id = $1", [userId[label]]);
      roles = res.rows[0].roles;
    });
    return roles;
  };

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
    for (const label of ["admin", "student", "student2", "outsider"]) await signup(label);
    // The one signup that carries the intent — the APP-089 entry point.
    await signup("coach", "COACH");

    await svc(async (c) => {
      await c.query("update users set roles = array_append(roles,$1) where id=$2", [
        UserRole.SUPER_ADMIN,
        userId.admin,
      ]);
    });
    await relogin("admin");
    await setOpen(true);
    // The coach surface itself, so the panel assertions mean something. The two flags stay
    // independent by design — this suite is the one place both are on at once.
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

  it("gives a coach-intent signup the COACH role and nothing else", async () => {
    // The role is the whole point: it is what makes the onboarding and the nav coach-shaped. It is
    // also, on its own, powerless — the next test is what proves that.
    expect(await rolesOf("coach")).toEqual([UserRole.STUDENT, UserRole.COACH]);
    expect(await rolesOf("student")).toEqual([UserRole.STUDENT]);
  });

  it("opens no door with the role alone: no registry row, no invite code", async () => {
    const code = await http().post("/v1/mentorship/invite-code").set(auth("coach"));
    expect(code.status).toBe(403);
    // Email first: it is the condition the coach can fix themselves, so it is the one to report.
    expect(code.body.code).toBe("MENTORSHIP_EMAIL_NOT_VERIFIED");
  });

  it("requires auth, and keeps the registry behind SUPER_ADMIN", async () => {
    expect(
      (await http().post("/v1/mentorship/coach-registration").send(REGISTRATION)).status,
    ).toBe(401);
    expect((await http().get("/v1/admin/coaches").set(auth("coach"))).status).toBe(403);
  });

  it("answers the three questions a registration screen has, before it is filled in", async () => {
    const res = await http().get("/v1/mentorship/coach-registration/mine").set(auth("coach"));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      registrationOpen: true,
      registration: null,
      emailVerified: false,
    });
  });

  it("refuses the form while the intake is shut, without touching mentorship.enabled", async () => {
    await setOpen(false);
    const res = await http()
      .post("/v1/mentorship/coach-registration")
      .set(auth("coach"))
      .send(REGISTRATION);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("MENTORSHIP_APPLICATIONS_CLOSED");
    // And the screen can now learn this without submitting anything.
    const state = await http().get("/v1/mentorship/coach-registration/mine").set(auth("coach"));
    expect(state.body.registrationOpen).toBe(false);
    await setOpen(true);
  });

  it("refuses a body that tries to badge itself", async () => {
    // `status` and `verifiedClaims` are the admin's columns; `.strict()` makes the attempt loud
    // rather than silently dropping the field and letting the registrant believe it landed.
    const res = await http()
      .post("/v1/mentorship/coach-registration")
      .set(auth("coach"))
      .send({ ...REGISTRATION, status: "ACTIVE", verifiedClaims: ["INSTITUTION"] });
    expect(res.status).toBe(400);
  });

  it("registers a coach as ACTIVE, unverified and unbadged", async () => {
    const created = await http()
      .post("/v1/mentorship/coach-registration")
      .set(auth("coach"))
      .send(REGISTRATION);
    expect(created.status).toBe(201);
    expect(created.body.status).toBe("ACTIVE");
    // Nobody approved anything, so nothing is verified. This is the normal case now, not the edge.
    expect(created.body.verifiedClaims).toEqual([]);

    const registry = await http().get("/v1/admin/coaches").set(auth("admin"));
    expect(registry.status).toBe(200);
    const row = registry.body.find((r: { userId: string }) => r.userId === userId.coach);
    expect(row).toMatchObject({ status: "ACTIVE", hasCoachRole: true });
    // The registry joins the person back on: W8 never reads `users`, admin does.
    expect(row.email).toContain("w8reg-coach");
  });

  it("still refuses the invite code until the email is verified", async () => {
    // The registry row exists now, so this isolates the email condition on its own.
    const code = await http().post("/v1/mentorship/invite-code").set(auth("coach"));
    expect(code.status).toBe(403);
    expect(code.body.code).toBe("MENTORSHIP_EMAIL_NOT_VERIFIED");
  });

  it("withholds the code from the panel rather than failing the whole screen", async () => {
    // A 403 on load would tell a coach that coaching is broken, when the truth is one click away.
    const overview = await http().get("/v1/mentorship/overview").set(auth("coach"));
    expect(overview.status).toBe(200);
    expect(overview.body.inviteCode).toBeNull();
  });

  it("opens the code once the email is verified, on the same token", async () => {
    await verifyEmail("coach");
    const code = await http().post("/v1/mentorship/invite-code").set(auth("coach"));
    expect(code.status).toBe(200);
    expect(code.body.code).toMatch(/^MENTOR-KOC-/);
  });

  it("tells a registered coach there is nothing left to register", async () => {
    const res = await http()
      .post("/v1/mentorship/coach-registration")
      .set(auth("coach"))
      .send(REGISTRATION);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("MENTORSHIP_ALREADY_COACH");
  });

  describe("the student's consent screen", () => {
    let code = "";

    it("carries every claim, marked verified or not", async () => {
      code = (await http().post("/v1/mentorship/invite-code").set(auth("coach"))).body.code;

      const preview = await http()
        .post("/v1/mentorship/invitations/preview")
        .set(auth("student"))
        .send({ code });
      expect(preview.status).toBe(200);
      expect(preview.body.coachProfile).toMatchObject({
        headline: REGISTRATION.headline,
        bio: REGISTRATION.bio,
      });
      // The APP-089 inversion. Nobody has checked this coach, and the screen has to SAY so: silence
      // would look identical to a verified coach at the exact moment a student decides to share
      // private data.
      expect(preview.body.coachProfile.claims).toEqual([
        { claim: "INSTITUTION", value: REGISTRATION.institution, verified: false },
        { claim: "BRANCH", value: REGISTRATION.branch, verified: false },
        { claim: "YEARS", value: "10", verified: false },
      ]);
    });

    it("flips the flags an admin actually checked, and nothing else", async () => {
      const marked = await http()
        .post(`/v1/admin/coaches/${userId.coach}/verified-claims`)
        .set(auth("admin"))
        .send({ verifiedClaims: ["INSTITUTION", "BRANCH"] });
      expect(marked.status).toBe(200);
      expect(marked.body.verifiedClaims.sort()).toEqual(["BRANCH", "INSTITUTION"]);
      // Marking a badge is not a standing change.
      expect(marked.body.status).toBe("ACTIVE");

      const preview = await http()
        .post("/v1/mentorship/invitations/preview")
        .set(auth("student"))
        .send({ code });
      expect(preview.body.coachProfile.claims).toEqual([
        { claim: "INSTITUTION", value: REGISTRATION.institution, verified: true },
        { claim: "BRANCH", value: REGISTRATION.branch, verified: true },
        { claim: "YEARS", value: "10", verified: false },
      ]);
    });

    it("links the student when they accept", async () => {
      const accepted = await http()
        .post("/v1/mentorship/invitations/accept")
        .set(auth("student"))
        .send({ code });
      expect(accepted.status).toBe(200);
      expect(accepted.body.coachStatus).toBe("ACTIVE");
    });
  });

  describe("an admin taking it back", () => {
    let liveCode = "";

    it("revokes COACH and closes the panel", async () => {
      liveCode = (await http().post("/v1/mentorship/invite-code").set(auth("coach"))).body.code;

      const res = await setStatus("coach", "SUSPENDED", "Şikayet üzerine durduruldu.");
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: "SUSPENDED", hasCoachRole: false });
      expect(await rolesOf("coach")).toEqual([UserRole.STUDENT]);

      // No re-login anywhere: the guard re-reads the principal from the DB on every request.
      expect((await http().get("/v1/mentorship/overview").set(auth("coach"))).status).toBe(403);
      expect((await http().get("/v1/mentorship/students").set(auth("coach"))).status).toBe(403);
    });

    it("kills a code students are already holding", async () => {
      // The half that is easy to miss: gating only at issue time would leave this code live for its
      // whole TTL. `outsider` has never seen this coach and must not be able to link to them now.
      const preview = await http()
        .post("/v1/mentorship/invitations/preview")
        .set(auth("outsider"))
        .send({ code: liveCode });
      expect(preview.status).toBe(404);
      // INVALID, not "suspended": whoever holds this string is a stranger, and the suspension is an
      // administrative fact about somebody else.
      expect(preview.body.code).toBe("MENTORSHIP_INVITE_INVALID");

      const accept = await http()
        .post("/v1/mentorship/invitations/accept")
        .set(auth("outsider"))
        .send({ code: liveCode });
      expect(accept.status).toBe(404);
    });

    it("keeps the existing link, and tells the student why their coach went quiet", async () => {
      const mine = await http().get("/v1/mentorship/my-coach").set(auth("student"));
      expect(mine.status).toBe(200);
      // The link is untouched — nothing was ended, and no Premium seat was clawed back.
      expect(mine.body.status).toBe("ACTIVE");
      expect(mine.body.coachStatus).toBe("SUSPENDED");
      // A suspended coach stops advertising: the profile is what a student agreed to, and it must
      // not keep selling somebody an admin stopped.
      expect(mine.body.coachProfile).toBeNull();
    });

    it("refuses a suspended coach who tries to register their way back in", async () => {
      const res = await http()
        .post("/v1/mentorship/coach-registration")
        .set(auth("coach"))
        .send({ ...REGISTRATION, headline: "Yeniden başlıyorum" });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("MENTORSHIP_COACH_SUSPENDED");
      expect(await rolesOf("coach")).toEqual([UserRole.STUDENT]);
    });

    it("refuses them the profile editor too", async () => {
      const res = await http()
        .put("/v1/mentorship/coach-registration/mine")
        .set(auth("coach"))
        .send({ headline: "KPSS koçu", bio: "Yeni metin." });
      expect(res.status).toBe(404);
    });

    it("leaves an audit line behind", async () => {
      const audit = await http().get("/v1/admin/audit-log").set(auth("admin"));
      expect(audit.status).toBe(200);
      expect(
        (audit.body as { action: string; targetId: string }[]).some(
          (entry) => entry.action === "coach.status-change" && entry.targetId === userId.coach,
        ),
      ).toBe(true);
    });

    it("puts everything back on reinstatement, badges included", async () => {
      const res = await setStatus("coach", "ACTIVE", null);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: "ACTIVE", hasCoachRole: true });
      expect(await rolesOf("coach")).toEqual([UserRole.STUDENT, UserRole.COACH]);
      // Standing and badges are separate acts, so reinstating neither re-asserts nor clears what an
      // admin checked earlier.
      expect(res.body.verifiedClaims.sort()).toEqual(["BRANCH", "INSTITUTION"]);
      expect((await http().get("/v1/mentorship/overview").set(auth("coach"))).status).toBe(200);
    });

    it("has no standing to move for somebody who never registered", async () => {
      const res = await setStatus("student2", "SUSPENDED");
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("MENTORSHIP_APPLICATION_NOT_FOUND");
    });
  });

  it("lets the coach rewrite their own two lines, and refuses contact details in them", async () => {
    const ok = await http()
      .put("/v1/mentorship/coach-registration/mine")
      .set(auth("coach"))
      .send({ headline: "KPSS Türkçe koçu", bio: "Paragraf ağırlıklı çalışıyorum." });
    expect(ok.status).toBe(200);
    expect(ok.body.bio).toBe("Paragraf ağırlıklı çalışıyorum.");
    // Editing the profile is not a re-badging: the claims an admin checked are untouched.
    expect(ok.body.verifiedClaims.sort()).toEqual(["BRANCH", "INSTITUTION"]);

    const leak = await http()
      .put("/v1/mentorship/coach-registration/mine")
      .set(auth("coach"))
      .send({ headline: "KPSS koçu", bio: "Bana 0532 123 45 67 numarasından ulaş" });
    expect(leak.status).toBe(400);
    expect(leak.body.code).toBe("MENTORSHIP_CONTACT_NOT_ALLOWED");

    const reachesForBadges = await http()
      .put("/v1/mentorship/coach-registration/mine")
      .set(auth("coach"))
      .send({ headline: "KPSS koçu", bio: "Metin", verifiedClaims: ["YEARS"] });
    expect(reachesForBadges.status).toBe(400);
  });

  it("erases a registry row with the account (the FK cascade never fires)", async () => {
    // Erasure ANONYMIZES the `users` row rather than deleting it, so `ON DELETE CASCADE` is not
    // the safety net it looks like — the same trap `mentorship_program_templates` documents.
    expect((await http().delete("/v1/account").set(auth("coach"))).status).toBe(204);
    await svc(async (c) => {
      const res = await c.query("select 1 from mentorship_coach_applications where user_id = $1", [
        userId.coach,
      ]);
      expect(res.rowCount).toBe(0);
    });
  });
});
