import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { UserRole } from "@mentor/types";

const RUN = Date.now();
const PASSWORD = "Sifre1234";

/**
 * Study rooms ("masa") e2e against a real Postgres. Covers the parts that only exist inside
 * transactions and therefore cannot be unit-tested: capacity, the room-quota filter, ownership
 * succession, code rotation, and — the design's central distinction — membership vs presence
 * (a member of several rooms is seated in at most one, decided by `study_sessions.room_id`).
 */
describe("study rooms (e2e)", () => {
  let app: INestApplication;
  let pool: Pool;
  let adminToken = "";

  const users: Record<string, { id: string; token: string }> = {};

  const signup = async (label: string) => {
    const email = `rooms-${label}-${RUN}@test.local`;
    const res = await request(app.getHttpServer()).post("/v1/auth/signup").send({
      email,
      password: PASSWORD,
      displayName: `Room ${label}`,
      kvkkAccepted: true,
    });
    const body = res.body as { accessToken: string; user: { id: string } };
    return { email, id: body.user.id, token: body.accessToken };
  };

  /**
   * Rooms are persistent and CREATING one counts against the 3-room quota just like joining,
   * so state must not leak between tests. Signup is throttled (5/min), which rules out a fresh
   * user per test — instead a fixed cast is reused and every room is wiped between tests.
   * Open sessions go too, otherwise one test's presence shows up as another's seated member.
   */
  const resetRooms = () =>
    svc(async (c) => {
      await c.query("delete from study_sessions where status = 'IN_PROGRESS'");
      // Memberships cascade; study_sessions.room_id is ON DELETE SET NULL.
      await c.query("delete from study_rooms");
    });

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

  const setRoomsEnabled = (enabled: boolean) =>
    request(app.getHttpServer())
      .patch("/v1/admin/config/coaching.study_rooms.enabled")
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({ value: enabled });

  const as = (who: string) => ({ Authorization: `Bearer ${users[who]!.token}` });

  const createRoom = (who: string, over: Record<string, unknown> = {}) =>
    request(app.getHttpServer())
      .post("/v1/study-rooms")
      .set(as(who))
      .send({ name: "Sabah Kuşları", theme: "LIBRARY", capacity: 2, ...over });

  const joinRoom = (who: string, code: string) =>
    request(app.getHttpServer()).post("/v1/study-rooms/join").set(as(who)).send({ code });

  const getRoom = (who: string, id: string) =>
    request(app.getHttpServer()).get(`/v1/study-rooms/${id}`).set(as(who));

  const startSession = (who: string, body: Record<string, unknown>) =>
    request(app.getHttpServer()).post("/v1/study-sessions").set(as(who)).send(body);

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test";
    pool = new Pool({ connectionString: process.env.DATABASE_URL });

    const { AppModule } = await import("../src/app.module");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix("v1");
    app.use(cookieParser());
    await app.init();

    const admin = await signup("admin");
    for (const label of ["owner", "member", "outsider"]) {
      users[label] = await signup(label);
    }

    await svc(async (c) => {
      await c.query("update users set roles = array_append(roles,$1) where id=$2", [
        UserRole.ADMIN,
        admin.id,
      ]);
    });
    const login = await request(app.getHttpServer())
      .post("/v1/auth/login")
      .send({ email: admin.email, password: PASSWORD });
    adminToken = login.body.accessToken;
    await setRoomsEnabled(true);
  }, 90_000);

  beforeEach(resetRooms);

  afterAll(async () => {
    await setRoomsEnabled(false).catch(() => undefined);
    await app?.close();
    await pool?.end();
  });

  it("refuses every route while the feature flag is off", async () => {
    await setRoomsEnabled(false);
    const res = await request(app.getHttpServer()).get("/v1/study-rooms").set(as("owner"));
    expect(res.status).toBe(403);
    await setRoomsEnabled(true);
  });

  it("creates a room, seats the owner, and hands them the invite code", async () => {
    const res = await createRoom("owner", { capacity: 3 });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe("OWNER");
    expect(res.body.memberCount).toBe(1);
    expect(res.body.activeCount).toBe(0);
    expect(res.body.inviteCode).toMatch(/^MASA-[0-9A-F]{6}$/);
    expect(res.body.seats).toHaveLength(1);
    expect(res.body.seats[0].isSeated).toBe(false);
  });

  it("lets a second user join by code and hides the code from non-owners", async () => {
    const room = (await createRoom("owner", { capacity: 3 })).body;

    const joined = await joinRoom("member", room.inviteCode);
    expect(joined.status).toBe(201);
    expect(joined.body.memberCount).toBe(2);
    expect(joined.body.role).toBe("MEMBER");
    expect(joined.body.inviteCode).toBeNull();

    // Re-joining is a conflict, not a second seat.
    expect((await joinRoom("member", room.inviteCode)).status).toBe(409);
  });

  it("rejects a join once every seat is taken", async () => {
    const room = (await createRoom("owner", { capacity: 2 })).body;
    expect((await joinRoom("member", room.inviteCode)).status).toBe(201);

    const full = await joinRoom("outsider", room.inviteCode);
    expect(full.status).toBe(409);
    expect(full.body.code).toBe("COACHING_ROOM_FULL");
  });

  it("rejects an unknown code and refuses room detail to non-members", async () => {
    expect((await joinRoom("outsider", "MASA-FFFFFF")).status).toBe(404);

    const room = (await createRoom("owner")).body;
    expect((await getRoom("outsider", room.id)).status).toBe(403);
  });

  it("seats a member in the room their session names, and nowhere else", async () => {
    const here = (await createRoom("owner", { name: "Burada", capacity: 3 })).body;
    const elsewhere = (await createRoom("owner", { name: "Başka", capacity: 3 })).body;
    expect((await joinRoom("member", here.inviteCode)).status).toBe(201);
    expect((await joinRoom("member", elsewhere.inviteCode)).status).toBe(201);

    const started = await startSession("member", {
      preset: "25_5",
      subject: "Matematik",
      roomId: here.id,
    });
    expect(started.status).toBe(201);
    expect(started.body.roomId).toBe(here.id);

    const seatedView = (await getRoom("owner", here.id)).body;
    const seat = seatedView.seats.find(
      (s: { userId: string }) => s.userId === users.member!.id,
    );
    expect(seat.isSeated).toBe(true);
    expect(seat.subject).toBe("Matematik");
    expect(seat.seatedMinutes).toBeGreaterThanOrEqual(0);
    expect(seatedView.activeCount).toBe(1);

    // Same member, same open session — but the other table stays empty. This is the whole
    // point of study_sessions.room_id: membership is not presence.
    const otherView = (await getRoom("owner", elsewhere.id)).body;
    const otherSeat = otherView.seats.find(
      (s: { userId: string }) => s.userId === users.member!.id,
    );
    expect(otherSeat.isSeated).toBe(false);
    expect(otherSeat.subject).toBeNull();
    expect(otherSeat.seatedMinutes).toBeNull();
    expect(otherView.activeCount).toBe(0);
  });

  it("refuses to seat a session at a room the user does not belong to", async () => {
    const room = (await createRoom("owner")).body;
    const res = await startSession("outsider", { preset: "25_5", roomId: room.id });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("COACHING_ROOM_NOT_MEMBER");
  });

  it("caps a user at three active rooms, and a dormant one frees the slot", async () => {
    // Creating counts against the quota just like joining — three rooms is three rooms.
    for (let i = 0; i < 3; i++) {
      expect((await createRoom("owner", { capacity: 4 })).status).toBe(201);
    }
    const overCreate = await createRoom("owner", { capacity: 4 });
    expect(overCreate.status).toBe(409);
    expect(overCreate.body.code).toBe("COACHING_ROOM_QUOTA_EXCEEDED");

    const fourth = (await createRoom("member", { capacity: 4 })).body;
    const denied = await joinRoom("owner", fourth.inviteCode);
    expect(denied.status).toBe(409);
    expect(denied.body.code).toBe("COACHING_ROOM_QUOTA_EXCEEDED");

    // A dormant room frees the slot without anything being deleted or swept.
    await svc(async (c) => {
      await c.query(
        `update study_rooms set last_active_at = now() - interval '61 days'
         where id in (select room_id from study_room_members where user_id = $1 limit 1)`,
        [users.owner!.id],
      );
    });
    expect((await joinRoom("owner", fourth.inviteCode)).status).toBe(201);
  });

  it("serializes concurrent creates so the active-room quota cannot be exceeded", async () => {
    expect((await createRoom("owner", { name: "Birinci", capacity: 4 })).status).toBe(201);
    expect((await createRoom("owner", { name: "İkinci", capacity: 4 })).status).toBe(201);

    const results = await Promise.all([
      createRoom("owner", { name: "Paralel A", capacity: 4 }),
      createRoom("owner", { name: "Paralel B", capacity: 4 }),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    const conflict = results.find((result) => result.status === 409)!;
    expect(conflict.body.code).toBe("COACHING_ROOM_QUOTA_EXCEEDED");

    const list = await request(app.getHttpServer()).get("/v1/study-rooms").set(as("owner"));
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(3);
  });

  it("rotates the invite code without disturbing members", async () => {
    const room = (await createRoom("owner", { capacity: 3 })).body;
    expect((await joinRoom("member", room.inviteCode)).status).toBe(201);

    const rotated = await request(app.getHttpServer())
      .post(`/v1/study-rooms/${room.id}/code`)
      .set(as("owner"));
    expect(rotated.status).toBe(201);
    expect(rotated.body.inviteCode).not.toBe(room.inviteCode);
    expect(rotated.body.memberCount).toBe(2);

    expect((await joinRoom("outsider", room.inviteCode)).status).toBe(404);
  });

  it("refuses owner-only actions from a member and blocks shrinking below the member count", async () => {
    const room = (await createRoom("owner", { capacity: 3 })).body;
    expect((await joinRoom("member", room.inviteCode)).status).toBe(201);

    const byMember = await request(app.getHttpServer())
      .patch(`/v1/study-rooms/${room.id}`)
      .set(as("member"))
      .send({ name: "değiştim" });
    expect(byMember.status).toBe(403);

    // capacity < 2 fails schema validation before the service is reached.
    const tooSmall = await request(app.getHttpServer())
      .patch(`/v1/study-rooms/${room.id}`)
      .set(as("owner"))
      .send({ capacity: 1 });
    expect(tooSmall.status).toBe(400);

    // Exactly the member count is fine.
    expect(
      (
        await request(app.getHttpServer())
          .patch(`/v1/study-rooms/${room.id}`)
          .set(as("owner"))
          .send({ capacity: 2 })
      ).status,
    ).toBe(200);

    // Below it is a conflict.
    expect(
      (
        await request(app.getHttpServer())
          .patch(`/v1/study-rooms/${room.id}`)
          .set(as("owner"))
          .send({ capacity: 3 })
      ).status,
    ).toBe(200);
    expect((await joinRoom("outsider", room.inviteCode)).status).toBe(201);
    const belowMembers = await request(app.getHttpServer())
      .patch(`/v1/study-rooms/${room.id}`)
      .set(as("owner"))
      .send({ capacity: 2 });
    expect(belowMembers.status).toBe(409);
    expect(belowMembers.body.code).toBe("COACHING_ROOM_CAPACITY_BELOW_MEMBERS");
  });

  it("passes ownership to the earliest member when the owner leaves", async () => {
    const room = (await createRoom("owner", { capacity: 3 })).body;
    expect((await joinRoom("member", room.inviteCode)).status).toBe(201);

    const left = await request(app.getHttpServer())
      .delete(`/v1/study-rooms/${room.id}/members/me`)
      .set(as("owner"));
    expect(left.status).toBe(204);

    const view = (await getRoom("member", room.id)).body;
    expect(view.role).toBe("OWNER");
    expect(view.inviteCode).not.toBeNull();
    expect(view.memberCount).toBe(1);
  });

  it("closes the room when its last member leaves", async () => {
    const room = (await createRoom("owner")).body;

    expect(
      (
        await request(app.getHttpServer())
          .delete(`/v1/study-rooms/${room.id}/members/me`)
          .set(as("owner"))
      ).status,
    ).toBe(204);

    const rows = await pool.query("select 1 from study_rooms where id = $1", [room.id]);
    expect(rows.rowCount).toBe(0);
  });

  it("keeps past sessions after the room is closed, minus the room label", async () => {
    const room = (await createRoom("owner", { capacity: 3 })).body;
    const started = await startSession("owner", { preset: "25_5", roomId: room.id });
    expect(started.status).toBe(201);
    const sessionId = started.body.id;

    expect(
      (await request(app.getHttpServer()).delete(`/v1/study-rooms/${room.id}`).set(as("owner")))
        .status,
    ).toBe(204);

    const rows = await pool.query("select room_id from study_sessions where id = $1", [
      sessionId,
    ]);
    expect(rows.rowCount).toBe(1);
    expect(rows.rows[0].room_id).toBeNull();
  });
});
