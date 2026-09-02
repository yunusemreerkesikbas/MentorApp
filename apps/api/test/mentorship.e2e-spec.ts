import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UserRole } from "@mentor/types";
import { ConfigRegistryService } from "../src/common/config/config-registry.service";

/**
 * W8 mentorship e2e — the coach↔student link against real Postgres (RLS active).
 *
 * The point of this suite is the authorization boundary, not the happy path: a coach reaches
 * exactly the students who accepted them, an ADMIN reaches none of them by virtue of being admin,
 * and the kill switch closes every door.
 */
describe("mentorship (e2e)", () => {
  let app: INestApplication;
  let pool: Pool;

  const token: Record<string, string> = {};
  const userId: Record<string, string> = {};
  let inviteCode = "";

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

  const signup = async (label: string, stamp: number): Promise<void> => {
    const email = `w8-${label}-${stamp}@test.local`;
    const res = await http()
      .post("/v1/auth/signup")
      .send({ email, password: "Sifre1234", displayName: `W8 ${label}`, kvkkAccepted: true });
    expect(res.status).toBe(201);
    token[label] = res.body.accessToken;
    userId[label] = res.body.user.id;
  };

  /** Grant a role in the DB, then re-login so the JWT actually carries it. */
  const grantRoleAndRelogin = async (label: string, role: string, stamp: number): Promise<void> => {
    await svc(async (c) => {
      await c.query("update users set roles = array_append(roles,$1) where id=$2", [
        role,
        userId[label],
      ]);
    });
    const login = await http()
      .post("/v1/auth/login")
      .send({ email: `w8-${label}-${stamp}@test.local`, password: "Sifre1234" });
    expect(login.status).toBe(200);
    token[label] = login.body.accessToken;
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

    const stamp = Date.now();
    for (const label of ["coach", "coach2", "student", "outsider", "admin"]) {
      await signup(label, stamp);
    }
    await grantRoleAndRelogin("coach", UserRole.COACH, stamp);
    await grantRoleAndRelogin("coach2", UserRole.COACH, stamp);
    await grantRoleAndRelogin("admin", UserRole.SUPER_ADMIN, stamp);

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

  it("requires auth everywhere", async () => {
    expect((await http().get("/v1/mentorship/invite-code")).status).toBe(401);
    expect((await http().get("/v1/mentorship/my-coach")).status).toBe(401);
  });

  it("keeps the coach surface behind the COACH role", async () => {
    expect((await http().get("/v1/mentorship/invite-code").set(auth("student"))).status).toBe(403);
    expect((await http().get("/v1/mentorship/students").set(auth("student"))).status).toBe(403);
  });

  it("a coach with no code yet gets null, not a 404", async () => {
    const res = await http().get("/v1/mentorship/invite-code").set(auth("coach"));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({});
  });

  it("issues an invite code the student can preview before consenting", async () => {
    const rotate = await http().post("/v1/mentorship/invite-code").set(auth("coach"));
    expect(rotate.status).toBe(200);
    expect(rotate.body.code).toMatch(/^MENTOR-KOC-[0-9A-F]{12}$/);
    inviteCode = rotate.body.code;

    const preview = await http()
      .post("/v1/mentorship/invitations/preview")
      .set(auth("student"))
      .send({ code: inviteCode });
    expect(preview.status).toBe(200);
    expect(preview.body.coachDisplayName).toBe("W8 coach");
    // The scope list is the consent contract — it must be complete and free of anything textual.
    expect(preview.body.dataScope).toEqual([
      "ACTIVITY",
      "MOCK_EXAMS",
      "PLAN_TASK_TITLES",
      "MOOD_LEVEL",
    ]);
  });

  it("rejects a bogus code without revealing whether any coach exists", async () => {
    const res = await http()
      .post("/v1/mentorship/invitations/preview")
      .set(auth("student"))
      .send({ code: "MENTOR-KOC-000000000000" });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("MENTORSHIP_INVITE_INVALID");
  });

  it("rejects a malformed code at the edge (Zod), before any lookup", async () => {
    const res = await http()
      .post("/v1/mentorship/invitations/preview")
      .set(auth("student"))
      .send({ code: "nope" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("an unlinked coach sees nothing about a student", async () => {
    const res = await http()
      .delete(`/v1/mentorship/students/${userId.student}`)
      .set(auth("coach"));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("MENTORSHIP_LINK_NOT_FOUND");
  });

  it("the student accepts, and only then does the roster fill", async () => {
    const accept = await http()
      .post("/v1/mentorship/invitations/accept")
      .set(auth("student"))
      .send({ code: inviteCode });
    expect(accept.status).toBe(200);
    expect(accept.body.status).toBe("ACTIVE");
    expect(accept.body.coachDisplayName).toBe("W8 coach");

    const roster = await http().get("/v1/mentorship/students").set(auth("coach"));
    expect(roster.status).toBe(200);
    expect(roster.body.total).toBe(1);
    expect(roster.body.items[0].studentId).toBe(userId.student);

    const other = await http().get("/v1/mentorship/students").set(auth("coach2"));
    expect(other.body.total).toBe(0);
  });

  it("never leaks a student's PII or free text through the coach surface", async () => {
    const roster = await http().get("/v1/mentorship/students").set(auth("coach"));
    const body = JSON.stringify(roster.body);
    // Sentinel: an accidental `...row` spread or a widened select would surface one of these.
    for (const forbidden of [
      "email",
      "passwordHash",
      "struggleNote",
      "aiReflection",
      "bio",
      "kvkkAcceptedAt",
      "@test.local",
    ]) {
      expect(body).not.toContain(forbidden);
    }
  });

  it("refuses a second coach while one is active", async () => {
    const rotate = await http().post("/v1/mentorship/invite-code").set(auth("coach2"));
    const res = await http()
      .post("/v1/mentorship/invitations/accept")
      .set(auth("student"))
      .send({ code: rotate.body.code });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("MENTORSHIP_ALREADY_LINKED");
  });

  it("refuses a coach redeeming their own code", async () => {
    const res = await http()
      .post("/v1/mentorship/invitations/accept")
      .set(auth("coach"))
      .send({ code: inviteCode });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("MENTORSHIP_SELF_LINK");
  });

  it("rotating the code invalidates the previous one", async () => {
    const rotate = await http().post("/v1/mentorship/invite-code").set(auth("coach"));
    expect(rotate.body.code).not.toBe(inviteCode);
    const stale = await http()
      .post("/v1/mentorship/invitations/preview")
      .set(auth("outsider"))
      .send({ code: inviteCode });
    expect(stale.status).toBe(404);
    inviteCode = rotate.body.code;
  });

  it("SUPER_ADMIN passes @Roles(COACH) but the link gate still refuses", async () => {
    // RolesGuard grants admins any @Roles(); the gate is what actually protects student data.
    const roster = await http().get("/v1/mentorship/students").set(auth("admin"));
    expect(roster.status).toBe(200);
    expect(roster.body.total).toBe(0);

    const reach = await http()
      .delete(`/v1/mentorship/students/${userId.student}`)
      .set(auth("admin"));
    expect(reach.status).toBe(404);
  });

  it("shows the student who their coach is and what that coach sees", async () => {
    const mine = await http().get("/v1/mentorship/my-coach").set(auth("student"));
    expect(mine.status).toBe(200);
    expect(mine.body.coachDisplayName).toBe("W8 coach");
    expect(mine.body.dataScope).toHaveLength(4);

    const none = await http().get("/v1/mentorship/my-coach").set(auth("outsider"));
    expect(none.status).toBe(200);
    expect(none.body).toEqual({});
  });

  it("lets the student revoke consent, which closes the coach's access immediately", async () => {
    expect((await http().delete("/v1/mentorship/my-coach").set(auth("student"))).status).toBe(204);

    const roster = await http().get("/v1/mentorship/students").set(auth("coach"));
    expect(roster.body.total).toBe(0);

    const history = await http()
      .get("/v1/mentorship/students?status=ENDED")
      .set(auth("coach"));
    expect(history.body.total).toBe(1);

    // Ending is idempotent from the student's side: there is nothing left to end.
    expect((await http().delete("/v1/mentorship/my-coach").set(auth("student"))).status).toBe(404);
  });

  it("lets a re-invited student return (the ENDED row is revived, not duplicated)", async () => {
    const accept = await http()
      .post("/v1/mentorship/invitations/accept")
      .set(auth("student"))
      .send({ code: inviteCode });
    expect(accept.status).toBe(200);

    const roster = await http().get("/v1/mentorship/students").set(auth("coach"));
    expect(roster.body.total).toBe(1);
    const history = await http().get("/v1/mentorship/students?status=ENDED").set(auth("coach"));
    expect(history.body.total).toBe(0);
  });

  it("closes every door when the flag is off", async () => {
    await app.get(ConfigRegistryService).set(userId.admin!, "mentorship.enabled", false);
    try {
      const roster = await http().get("/v1/mentorship/students").set(auth("coach"));
      expect(roster.status).toBe(403);
      expect(roster.body.code).toBe("MENTORSHIP_DISABLED");
      expect((await http().get("/v1/mentorship/my-coach").set(auth("student"))).status).toBe(403);
      expect((await http().post("/v1/mentorship/invite-code").set(auth("coach"))).status).toBe(403);
    } finally {
      await app.get(ConfigRegistryService).set(userId.admin!, "mentorship.enabled", true);
    }
  });
});
