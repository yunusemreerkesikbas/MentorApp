import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ThrottlerStorage } from "@nestjs/throttler";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UserRole, ZoneJoinPolicy, ZoneType } from "@mentor/types";
import { createTestApp } from "./app-harness";
import request from "./browser-request";

const RUN = Date.now();
const ROLE = "forum_names_runtime";

/**
 * Production connects with a role that RLS actually filters (database-role-safety.ts), and the
 * `users` policy lets a session read only its own row. Every other suite connects as the
 * superuser, which skips RLS, so a user-context `users` join looked fine everywhere but
 * production, where other authors came back blank and the UI said "Kullanıcı". This suite
 * boots the API on a NOSUPERUSER NOBYPASSRLS role and reads each view as somebody else.
 */
describe("forum author names under the production RLS role (e2e)", () => {
  let app: INestApplication;
  let admin: Pool;
  const people: Record<"asker" | "helper", { id: string; token: string; name: string; username: string }> = {} as never;
  let chatZone = { id: "", slug: "" };
  let threadId = "";
  let commentId = "";
  let questionId = "";

  const server = () => app.getHttpServer();
  const as = (who: keyof typeof people) => ({ Authorization: `Bearer ${people[who].token}` });

  beforeAll(async () => {
    const base = new URL(process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test");
    admin = new Pool({ connectionString: base.toString() });
    await admin.query(`do $$ begin create role ${ROLE} login password '${ROLE}' nosuperuser nobypassrls;
      exception when duplicate_object then null; end $$`);
    await admin.query(`grant usage on schema public to ${ROLE}`);
    await admin.query(`grant select, insert, update, delete on all tables in schema public to ${ROLE}`);
    await admin.query(`grant usage, select on all sequences in schema public to ${ROLE}`);
    await admin.query(`grant execute on all functions in schema public to ${ROLE}`);
    const runtime = new URL(base.toString());
    runtime.username = ROLE;
    runtime.password = ROLE;
    process.env.DATABASE_URL = runtime.toString();

    const { AppModule } = await import("../src/app.module");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ThrottlerStorage)
      .useValue({ increment: async () => ({ totalHits: 1, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 }) })
      .compile();
    app = createTestApp(moduleRef, { authRateLimits: false });
    await app.init();

    const signup = async (label: string) => {
      const username = `n${label.slice(0, 5)}_${String(RUN).slice(-10)}`;
      const name = `Names ${label} ${RUN}`;
      const res = await request(server()).post("/v1/auth/signup").send({
        email: `names-${label}-${RUN}@test.local`, password: "Sifre1234", displayName: name, username,
        kvkkAccepted: true, termsAccepted: true, ageEligibilityConfirmed: true,
      });
      expect(res.status).toBe(201);
      return { id: res.body.user.id as string, token: res.body.accessToken as string, name, username };
    };
    const staff = await signup("staff");
    people.asker = await signup("asker");
    people.helper = await signup("helper");
    await admin.query("update users set roles = array_append(roles, $1) where id = $2", [UserRole.ADMIN, staff.id]);
    const login = await request(server()).post("/v1/auth/login").send({ email: `names-staff-${RUN}@test.local`, password: "Sifre1234" });
    const staffAuth = { Authorization: `Bearer ${login.body.accessToken}` };
    expect((await request(server()).patch("/v1/admin/config/forum.enabled").set(staffAuth).send({ value: true })).status).toBe(200);

    const zone = async (type: ZoneType, title: string) => {
      const res = await request(server()).post("/v1/forum/zones").set(staffAuth)
        .send({ type, title, joinPolicy: ZoneJoinPolicy.OPEN });
      expect(res.status).toBe(201);
      for (const who of ["asker", "helper"] as const) {
        expect((await request(server()).post(`/v1/forum/zones/${res.body.id}/join`).set(as(who))).status).toBe(201);
      }
      return { id: res.body.id as string, slug: res.body.slug as string };
    };
    chatZone = await zone(ZoneType.CHAT, `Names chat ${RUN}`);
    const qaZone = await zone(ZoneType.QA, `Names qa ${RUN}`);

    const thread = await request(server()).post(`/v1/forum/zones/${chatZone.id}/threads`).set(as("asker"))
      .send({ body: `names thread ${RUN}` });
    threadId = thread.body.id;
    const comment = await request(server()).post(`/v1/forum/threads/${threadId}/comments`).set(as("helper"))
      .send({ body: `names comment ${RUN}` });
    commentId = comment.body.id;
    expect((await request(server()).post(`/v1/forum/posts/${commentId}/replies`).set(as("asker"))
      .send({ body: `names reply ${RUN}` })).status).toBe(201);
    const question = await request(server()).post(`/v1/forum/zones/${qaZone.id}/threads`).set(as("asker"))
      .send({ title: `names question ${RUN} benzerlik`, body: `names question body ${RUN}` });
    questionId = question.body.id;
    expect((await request(server()).post(`/v1/forum/threads/${questionId}/answers`).set(as("helper"))
      .send({ body: `names answer ${RUN}` })).status).toBe(201);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await admin?.end();
  });

  it("really runs on a role RLS filters", async () => {
    const res = await request(server()).get("/v1/forum/zones?pageSize=100").set(as("helper"));
    expect(res.status).toBe(200);
    const role = await admin.query("select rolsuper, rolbypassrls from pg_roles where rolname = $1", [ROLE]);
    expect(role.rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });
  });

  it("thread detail names the other author and the commenter", async () => {
    const asHelper = await request(server()).get(`/v1/forum/threads/${threadId}/detail`).set(as("helper"));
    expect(asHelper.body.thread.authorName).toBe(people.asker.name);
    expect(asHelper.body.thread.authorUsername).toBe(people.asker.username);
    const asAsker = await request(server()).get(`/v1/forum/threads/${threadId}/detail`).set(as("asker"));
    const comments = asAsker.body.comments.items ?? asAsker.body.comments;
    expect(comments[0].authorName).toBe(people.helper.name);
  });

  it("comment detail names its replies' authors", async () => {
    const res = await request(server()).get(`/v1/forum/posts/${commentId}`).set(as("helper"));
    expect(res.status).toBe(200);
    expect(res.body.post?.authorName ?? res.body.comment?.authorName).toBe(people.helper.name);
    const replies = res.body.replies?.items ?? res.body.replies;
    expect(replies[0].authorName).toBe(people.asker.name);
  });

  it("question detail names the asker and every answerer", async () => {
    const asHelper = await request(server()).get(`/v1/forum/threads/${questionId}`).set(as("helper"));
    expect(asHelper.body.question.authorName).toBe(people.asker.name);
    const asAsker = await request(server()).get(`/v1/forum/threads/${questionId}`).set(as("asker"));
    expect(asAsker.body.answers[0].authorName).toBe(people.helper.name);
    expect(asAsker.body.answers[0].authorUsername).toBe(people.helper.username);
  });

  it("room feed, room list, profile activity and search name the authors", async () => {
    const room = await request(server()).get(`/v1/forum/zones/${chatZone.slug}/feed`).set(as("helper"));
    expect(room.body.feed.items[0].authorName).toBe(people.asker.name);
    const list = await request(server()).get(`/v1/forum/zones/${chatZone.id}/threads?limit=5`).set(as("helper"));
    expect(list.body.items[0].authorName).toBe(people.asker.name);
    const activity = await request(server()).get(`/v1/forum/users/${people.asker.username}/activity`).set(as("helper"));
    const first = activity.body.items[0];
    expect((first.thread ?? first.comment).authorName).toBe(people.asker.name);
    const search = await request(server()).get(`/v1/forum/search?q=${RUN}`).set(as("helper"));
    const hits = (search.body.items ?? []).filter((item: { authorName?: string }) => item.authorName !== undefined);
    expect(hits.length).toBeGreaterThan(0);
    for (const hit of hits) expect(hit.authorName).not.toBe("");
  });

  it("adds only public author fields, never contact data", async () => {
    const res = await request(server()).get(`/v1/forum/threads/${questionId}`).set(as("helper"));
    expect(JSON.stringify(res.body)).not.toContain(`names-asker-${RUN}@test.local`);
  });
});
