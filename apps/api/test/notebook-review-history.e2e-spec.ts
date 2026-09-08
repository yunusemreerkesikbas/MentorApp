import { NotebookReviewRepository } from "../src/modules/coaching/infrastructure/notebook-review.repository";

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Pool } from "pg";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
describe("notebook review history", () => {
  let app: INestApplication;
  let pool: Pool;
  let token: string;
  let other: string;
  let userId: string;
  let entryId: string;
  let examId: string;
  const auth = () => ({ Authorization: "Bearer " + token });
  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.TEST_DATABASE_URL ??
      "postgres://mentor:mentor@localhost:5433/mentor_test";
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const { AppModule } = await import("../src/app.module");
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.setGlobalPrefix("v1");
    await app.init();
    const signup = () =>
      request(app.getHttpServer())
        .post("/v1/auth/signup")
        .send({
          email: randomUUID() + "@test.local",
          password: "Sifre1234",
          displayName: "Review test",
          kvkkAccepted: true,
        });
    const a = await signup();
    expect(a.status).toBe(201);
    token = a.body.accessToken;
    userId = a.body.user.id;
    const b = await signup();
    expect(b.status).toBe(201);
    other = b.body.accessToken;
    examId = (await pool.query("select id from exams limit 1")).rows[0].id;
    const created = await request(app.getHttpServer())
      .post("/v1/coaching/notebook/entries")
      .set(auth())
      .send({ examId, source: "OWN", errorType: "CARELESS" });
    expect(created.status).toBe(201);
    entryId = created.body.id;
  }, 90000);
  afterAll(async () => {
    await app?.close();
    await pool?.end();
  });
  it("serializes concurrent retries and preserves a single outcome", async () => {
    const reviewId = randomUUID();
    const answer = () =>
      request(app.getHttpServer())
        .post("/v1/coaching/notebook/entries/" + entryId + "/review")
        .set(auth())
        .send({ solved: true, reviewId });
    const results = await Promise.all([answer(), answer()]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    const result = await pool.query(
      "select * from notebook_reviews where entry_id = $1",
      [entryId],
    );
    expect(result.rowCount).toBe(1);
    expect(result.rows[0].early).toBe(true);
    const summary = await request(app.getHttpServer())
      .get("/v1/coaching/notebook/review-summary")
      .query({ examId, days: 7 })
      .set(auth());
    expect(summary.status).toBe(200);
    expect(summary.body.workedCount).toBe(1);
    expect(summary.body.completedCount).toBe(0);
  });
  it("records a miss without double counting the question and isolates owners", async () => {
    const result = await request(app.getHttpServer())
      .post("/v1/coaching/notebook/entries/" + entryId + "/review")
      .set(auth())
      .send({ solved: false, reviewId: randomUUID() });
    expect(result.status).toBe(200);
    const summary = await request(app.getHttpServer())
      .get("/v1/coaching/notebook/review-summary")
      .query({ examId })
      .set(auth());
    expect(summary.body.workedCount).toBe(1);
    expect(summary.body.revisitCount).toBe(1);
    const history = await request(app.getHttpServer())
      .get("/v1/coaching/notebook/review-history")
      .query({ examId, pageSize: 1 })
      .set(auth());
    expect(history.body.total).toBe(2);
    expect(history.body.items).toHaveLength(1);
    expect(history.body.items[0].solved).toBe(false);
    const forbidden = await request(app.getHttpServer())
      .get("/v1/coaching/notebook/entries/" + entryId)
      .set({ Authorization: "Bearer " + other });
    expect(forbidden.status).toBe(404);
    await pool.query(
      "do $$ begin create role notebook_rls_probe nosuperuser nobypassrls; exception when duplicate_object then null; end $$",
    );
    await pool.query("grant usage on schema public to notebook_rls_probe");
    await pool.query("grant select on notebook_reviews to notebook_rls_probe");
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("set local role notebook_rls_probe");
      await client.query("select set_config('app.user_id', $1, true)", [
        randomUUID(),
      ]);
      expect(
        (
          await client.query(
            "select * from notebook_reviews where user_id = $1",
            [userId],
          )
        ).rowCount,
      ).toBe(0);
      await client.query("rollback");
    } finally {
      await client.query("rollback");
      client.release();
    }
  });
  it("filters missed entries before pagination and rejects reused IDs with a different answer", async () => {
    const list = await request(app.getHttpServer())
      .get("/v1/coaching/notebook/entries")
      .set(auth())
      .query({ examId, revisit: "true", days: 7, pageSize: 1 });
    expect(list.status).toBe(200);
    expect(list.body.items[0].id).toBe(entryId);
    const reviewId = randomUUID();
    const path = "/v1/coaching/notebook/entries/" + entryId + "/review";
    expect(
      (
        await request(app.getHttpServer())
          .post(path)
          .set(auth())
          .send({ solved: true, reviewId })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app.getHttpServer())
          .post(path)
          .set(auth())
          .send({ solved: false, reviewId })
      ).status,
    ).toBe(400);
  });
  it("rolls back the entry update when history insertion fails", async () => {
    const before = (
      await pool.query("select * from mistake_notebook_entries where id = $1", [
        entryId,
      ])
    ).rows[0];
    const spy = vi
      .spyOn(app.get(NotebookReviewRepository), "insert")
      .mockRejectedValueOnce(new Error("test insertion failure"));
    try {
      const response = await request(app.getHttpServer())
        .post("/v1/coaching/notebook/entries/" + entryId + "/review")
        .set(auth())
        .send({ solved: false, reviewId: randomUUID() });
      expect(response.status).toBe(500);
      const after = (
        await pool.query(
          "select * from mistake_notebook_entries where id = $1",
          [entryId],
        )
      ).rows[0];
      expect(after).toEqual(before);
    } finally {
      spy.mockRestore();
    }
  });
  it("records completion once and honours period boundaries", async () => {
    await pool.query(
      "update mistake_notebook_entries set review_count=2, next_review_at=now()-interval '1 day' where id=$1",
      [entryId],
    );
    const response = await request(app.getHttpServer())
      .post("/v1/coaching/notebook/entries/" + entryId + "/review")
      .set(auth())
      .send({ solved: true });
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("HEALED");
    const summary = await request(app.getHttpServer())
      .get("/v1/coaching/notebook/review-summary")
      .query({ examId })
      .set(auth());
    expect(summary.body.completedCount).toBe(1);
    expect(summary.body.workedCount).toBe(1);
    await pool.query(
      "update notebook_reviews set reviewed_at=now()-interval '10 days' where entry_id=$1",
      [entryId],
    );
    const week = await request(app.getHttpServer())
      .get("/v1/coaching/notebook/review-summary")
      .query({ examId, days: 7 })
      .set(auth());
    const month = await request(app.getHttpServer())
      .get("/v1/coaching/notebook/review-summary")
      .query({ examId, days: 30 })
      .set(auth());
    expect(week.body.workedCount).toBe(0);
    expect(month.body.workedCount).toBe(1);
  });
  it("deletes history along with its source", async () => {
    const deleted = await request(app.getHttpServer())
      .delete("/v1/coaching/notebook/entries/" + entryId)
      .set(auth());
    expect(deleted.status).toBe(204);
    expect(
      (
        await pool.query("select * from notebook_reviews where entry_id = $1", [
          entryId,
        ])
      ).rowCount,
    ).toBe(0);
  });
});
