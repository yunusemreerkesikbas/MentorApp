import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UserRole } from "@mentor/types";
import { ConfigRegistryService } from "../src/common/config/config-registry.service";
import { PlanService } from "../src/modules/coaching/application/plan.service";

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
  /** Today + n days as yyyy-mm-dd — the week grid never assigns into the past. */
  const isoDaysFromNow = (n: number) =>
    new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

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
      "EXAM_TRACK",
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

  it("carries the roster metrics a coach acts on", async () => {
    const roster = await http().get("/v1/mentorship/students").set(auth("coach"));
    const row = roster.body.items[0];
    expect(row.studentId).toBe(userId.student);
    expect(row.status).toBe("ACTIVE");
    // A brand-new student has done nothing yet — the row must still say so in numbers.
    expect(row.metrics).toMatchObject({
      currentStreak: 0,
      sessions7d: 0,
      focusMinutes7d: 0,
      activeDays7d: 0,
      planCompletionRate7d: null,
      latestMockNet: null,
      moodLevel7dAvg: null,
    });
    // …and be flagged, because "never started" is exactly what a coach needs surfaced.
    expect(row.riskFlags).toContain("INACTIVE");
  });

  it("serves the single-student report behind the same gate", async () => {
    const report = await http()
      .get(`/v1/mentorship/students/${userId.student}`)
      .set(auth("coach"));
    expect(report.status).toBe(200);
    expect(report.body).toMatchObject({
      studentId: userId.student,
      studentDisplayName: "W8 student",
      planCompletionRate7d: null,
    });
    expect(report.body.activity).toMatchObject({ currentStreak: 0, longestStreak: 0 });
    expect(report.body.mockTrend).toEqual([]);
    expect(report.body.planTasks).toEqual([]);
    expect(report.body.moodTrend).toEqual([]);

    // A coach with no link to this student reaches nothing, report included.
    const foreign = await http()
      .get(`/v1/mentorship/students/${userId.student}`)
      .set(auth("coach2"));
    expect(foreign.status).toBe(404);

    // Nor does an admin, who passes @Roles(COACH) but holds no link.
    const admin = await http()
      .get(`/v1/mentorship/students/${userId.student}`)
      .set(auth("admin"));
    expect(admin.status).toBe(404);
  });

  it("never leaks a student's PII or free text through the coach surface", async () => {
    const roster = await http().get("/v1/mentorship/students").set(auth("coach"));
    const report = await http()
      .get(`/v1/mentorship/students/${userId.student}`)
      .set(auth("coach"));
    // Sentinel: an accidental `...row` spread or a widened select would surface one of these.
    for (const body of [JSON.stringify(roster.body), JSON.stringify(report.body)]) {
      for (const forbidden of [
        "email",
        "passwordHash",
        "struggleNote",
        "aiReflection",
        "sessionMood",
        "aiGhostNarration",
        "description",
        "bio",
        "kvkkAcceptedAt",
        "@test.local",
      ]) {
        expect(body).not.toContain(forbidden);
      }
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
    expect(mine.body.dataScope).toHaveLength(5);

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

    // The point of the test, and what an earlier version of it missed: the history row proves the
    // relationship existed and says NOTHING about how the student is doing now. Revoked consent
    // has to stop the data, not just the badge.
    const ended = history.body.items[0];
    expect(ended.status).toBe("ENDED");
    expect(ended.endedAt).not.toBeNull();
    expect(ended.metrics).toBeNull();
    expect(ended.riskFlags).toEqual([]);
    for (const leaked of [
      "lastActiveDate",
      "currentStreak",
      "focusMinutes7d",
      "latestMockNet",
      "moodLevel7dAvg",
    ]) {
      expect(JSON.stringify(ended)).not.toContain(leaked);
    }

    // The report stays shut too.
    expect(
      (await http().get(`/v1/mentorship/students/${userId.student}`).set(auth("coach"))).status,
    ).toBe(404);

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

  describe("coach-assigned homework", () => {
    let taskId = "";

    it("lands in the student's own plan, badged with its origin", async () => {
      const assign = await http()
        .post(`/v1/mentorship/students/${userId.student}/assignments`)
        .set(auth("coach"))
        .send({ tasks: [{ title: "Paragraf 20 soru", subject: "Türkçe" }] });
      expect(assign.status).toBe(201);
      expect(assign.body).toHaveLength(1);
      taskId = assign.body[0].id;
      expect(assign.body[0].origin).toMatchObject({ type: "MENTORSHIP" });

      // The student sees it in the plan screen they already open — no second to-do list.
      const plan = await http().get("/v1/plan-tasks").set(auth("student"));
      const mine = plan.body.items.find((t: { id: string }) => t.id === taskId);
      expect(mine).toMatchObject({ title: "Paragraf 20 soru", status: "PENDING" });
      expect(mine.origin.type).toBe("MENTORSHIP");
    });

    it("refuses a coach who holds no link to the student", async () => {
      const res = await http()
        .post(`/v1/mentorship/students/${userId.student}/assignments`)
        .set(auth("coach2"))
        .send({ tasks: [{ title: "Sızıntı" }] });
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("MENTORSHIP_LINK_NOT_FOUND");
    });

    it("lets the student complete it", async () => {
      const done = await http()
        .patch(`/v1/plan-tasks/${taskId}`)
        .set(auth("student"))
        .send({ status: "DONE" });
      expect(done.status).toBe(200);
      expect(done.body.status).toBe("DONE");
    });

    it("stops the student rewriting it — the coach's report must stay true", async () => {
      const edit = await http()
        .patch(`/v1/plan-tasks/${taskId}`)
        .set(auth("student"))
        .send({ title: "Bunu ben yazdım" });
      expect(edit.status).toBe(403);
      expect(edit.body.code).toBe("COACHING_TASK_COACH_ASSIGNED");
    });

    it("shows up as a task title in the coach's report, and counts toward completion", async () => {
      const report = await http()
        .get(`/v1/mentorship/students/${userId.student}`)
        .set(auth("coach"));
      expect(report.body.planTasks).toContainEqual({
        taskDate: expect.any(String),
        title: "Paragraf 20 soru",
        subject: "Türkçe",
        topic: null,
        status: "DONE",
        assignedByCoach: true,
        coachNote: null,
      });
      expect(report.body.planCompletionRate7d).toBe(1);
    });

    it("still lets the student delete it — the plan stays theirs", async () => {
      expect(
        (await http().delete(`/v1/plan-tasks/${taskId}`).set(auth("student"))).status,
      ).toBe(204);
    });

    it("but tells the coach, so their report does not quietly lie", async () => {
      // The report shows the living plan, not its history. Without this the assignment would
      // simply never be mentioned again and the coach would read its absence as "never assigned".
      const inbox = await http().get("/v1/notifications").set(auth("coach"));
      expect(inbox.status).toBe(200);
      const dropped = inbox.body.items.find((n: { body: string }) =>
        n.body.includes("Paragraf 20 soru"),
      );
      expect(dropped).toBeDefined();
      expect(dropped.linkUrl).toBe(`/students/${userId.student}`);
    });

    it("tells the coach about a completion, at most once a day per student", async () => {
      const assign = await http()
        .post(`/v1/mentorship/students/${userId.student}/assignments`)
        .set(auth("coach"))
        .send({
          tasks: [{ title: "Bugün birinci" }, { title: "Bugün ikinci" }],
        });
      expect(assign.status).toBe(201);

      const before = (await http().get("/v1/notifications").set(auth("coach"))).body.items.length;
      for (const created of assign.body) {
        const done = await http()
          .patch(`/v1/plan-tasks/${created.id}`)
          .set(auth("student"))
          .send({ status: "DONE" });
        expect(done.status).toBe(200);
      }

      // Two completions on the same day, one notification: a coach with twenty students would
      // otherwise get a completion storm every evening.
      const after = (await http().get("/v1/notifications").set(auth("coach"))).body.items;
      expect(after.length).toBe(before + 1);
      expect(after[0].linkUrl).toBe(`/students/${userId.student}`);
    });

    it("refuses an assignment beyond the horizon", async () => {
      const farOff = new Date(Date.now() + 200 * 86_400_000).toISOString().slice(0, 10);
      const res = await http()
        .post(`/v1/mentorship/students/${userId.student}/assignments`)
        .set(auth("coach"))
        .send({ tasks: [{ title: "Çok uzak", taskDate: farOff }] });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("MENTORSHIP_ASSIGNMENT_TOO_FAR");
    });

    it("refuses a description — that box is the student's own note", async () => {
      const res = await http()
        .post(`/v1/mentorship/students/${userId.student}/assignments`)
        .set(auth("coach"))
        .send({ tasks: [{ title: "Not denemesi", description: "koçtan not" }] });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("rejects a task the student could not have written themselves", async () => {
      const res = await http()
        .post(`/v1/mentorship/students/${userId.student}/assignments`)
        .set(auth("coach"))
        .send({ tasks: [{ title: "" }] });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("writes a whole week in one request, up to the 21-task ceiling", async () => {
      const tasks = Array.from({ length: 21 }, (_, i) => ({
        title: `Hafta görevi ${i + 1}`,
        subject: "Matematik",
        taskDate: isoDaysFromNow(i % 7),
      }));
      const res = await http()
        .post(`/v1/mentorship/students/${userId.student}/assignments`)
        .set(auth("coach"))
        .send({ tasks });
      expect(res.status).toBe(201);
      expect(res.body).toHaveLength(21);
    });

    it("refuses a 22nd task rather than silently truncating the week", async () => {
      const tasks = Array.from({ length: 22 }, (_, i) => ({ title: `Fazla ${i}` }));
      const res = await http()
        .post(`/v1/mentorship/students/${userId.student}/assignments`)
        .set(auth("coach"))
        .send({ tasks });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("refuses a topic with no subject — a leaf needs its branch", async () => {
      const res = await http()
        .post(`/v1/mentorship/students/${userId.student}/assignments`)
        .set(auth("coach"))
        .send({ tasks: [{ title: "Dalsız", topic: "Paragrafta anlam" }] });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    describe("the coach's own note", () => {
      let notedTaskId = "";

      it("reaches the student without touching their own description box", async () => {
        const assign = await http()
          .post(`/v1/mentorship/students/${userId.student}/assignments`)
          .set(auth("coach"))
          .send({
            tasks: [
              {
                title: "Problemler tekrar",
                subject: "Matematik",
                topic: "Problemler",
                coachNote: "Netin düştü, bu hafta problemlere ağırlık ver.",
              },
            ],
          });
        expect(assign.status).toBe(201);
        notedTaskId = assign.body[0].id;

        const plan = await http().get("/v1/plan-tasks").set(auth("student"));
        const mine = plan.body.items.find((t: { id: string }) => t.id === notedTaskId);
        expect(mine).toMatchObject({
          topic: "Problemler",
          coachNote: "Netin düştü, bu hafta problemlere ağırlık ver.",
          // The student's own box stays empty: two people's words, two columns.
          description: null,
        });
      });

      it("stops the student rewriting the note, like the title", async () => {
        // `coachNote` is not in the update contract at all, so a patch carrying only it has no
        // writable field left and is refused as empty — not accepted-then-ignored.
        const only = await http()
          .patch(`/v1/plan-tasks/${notedTaskId}`)
          .set(auth("student"))
          .send({ coachNote: "Koç böyle demedi" });
        expect(only.status).toBe(400);
        expect(only.body.code).toBe("VALIDATION_ERROR");

        // Smuggling it alongside a change the student IS allowed to make must not work either.
        const alongside = await http()
          .patch(`/v1/plan-tasks/${notedTaskId}`)
          .set(auth("student"))
          .send({ status: "DONE", coachNote: "Koç böyle demedi" });
        expect(alongside.status).toBe(200);
        expect(alongside.body.status).toBe("DONE");
        expect(alongside.body.coachNote).toBe("Netin düştü, bu hafta problemlere ağırlık ver.");
      });

      it("is read back to the coach who wrote it", async () => {
        const report = await http()
          .get(`/v1/mentorship/students/${userId.student}`)
          .set(auth("coach"));
        expect(report.body.planTasks).toContainEqual(
          expect.objectContaining({
            title: "Problemler tekrar",
            topic: "Problemler",
            assignedByCoach: true,
            coachNote: "Netin düştü, bu hafta problemlere ağırlık ver.",
          }),
        );
      });

      it("is invisible to the NEXT coach, even though the task outlives the link", async () => {
        // End the link, hand the student to coach2, and look again. The task survives (it is the
        // student's work); the previous coach's instruction is not the successor's to read.
        expect(
          (await http().delete(`/v1/mentorship/students/${userId.student}`).set(auth("coach")))
            .status,
        ).toBe(204);
        const code2 = (await http().post("/v1/mentorship/invite-code").set(auth("coach2"))).body
          .code;
        expect(
          (
            await http()
              .post("/v1/mentorship/invitations/accept")
              .set(auth("student"))
              .send({ code: code2 })
          ).status,
        ).toBe(200);

        const report = await http()
          .get(`/v1/mentorship/students/${userId.student}`)
          .set(auth("coach2"));
        expect(report.status).toBe(200);
        const row = report.body.planTasks.find(
          (t: { title: string }) => t.title === "Problemler tekrar",
        );
        expect(row).toBeDefined();
        expect(row.assignedByCoach).toBe(false);
        expect(row.coachNote).toBeNull();
        expect(JSON.stringify(report.body)).not.toContain("Netin düştü");
      });
    });
  });

  it("erasing a coach clears the note along with the provenance", async () => {
    // Regression guard for a trap the CHECK constraint turns into a loud failure:
    // `plan_tasks_coach_note_origin_chk` forbids a note on an origin-less row, so a
    // `clearMentorshipOrigin` that forgot `coach_note` would make every coach erasure throw.
    // The unit spec mocks this call, so only a real transaction proves it.
    const assign = await http()
      .post(`/v1/mentorship/students/${userId.student}/assignments`)
      .set(auth("coach2"))
      .send({ tasks: [{ title: "Silinecek koç ödevi", coachNote: "Bu not de gitmeli" }] });
    expect(assign.status).toBe(201);
    const orphanId: string = assign.body[0].id;

    let linkId = "";
    await svc(async (c) => {
      const res = await c.query(
        "select id from coach_students where student_id = $1 and status = 'ACTIVE'",
        [userId.student],
      );
      linkId = res.rows[0].id;
    });

    await expect(
      app.get(PlanService).clearMentorshipOrigin([linkId]),
    ).resolves.toBeGreaterThan(0);

    await svc(async (c) => {
      const res = await c.query(
        "select origin_type, origin_ref_id, coach_note, title from plan_tasks where id = $1",
        [orphanId],
      );
      expect(res.rows[0].origin_type).toBeNull();
      expect(res.rows[0].origin_ref_id).toBeNull();
      expect(res.rows[0].coach_note).toBeNull();
      // The task itself survives — it is the student's work, not the coach's.
      expect(res.rows[0].title).toBe("Silinecek koç ödevi");
    });
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
