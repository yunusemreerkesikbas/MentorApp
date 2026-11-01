import { randomUUID } from "node:crypto";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  STORAGE_PORT,
  type StoragePort,
} from "../src/shared/ports/storage.port";
import request from "./browser-request";
import { economyAuditHarness } from "./fixtures/economy-audit";
import { weeklyAccount } from "./fixtures/weekly-analysis";

describe("Shared photo quota (HTTP/Postgres)", () => {
  let h: Awaited<ReturnType<typeof economyAuditHarness>>;
  let user: { id: string; token: string };
  let examId: string;
  const headers = () => ({ Authorization: `Bearer ${user.token}` });
  const post = (path: string, body: unknown) =>
    request(h.app.getHttpServer())
      .post(`/v1/${path}`)
      .set(headers())
      .send(body);
  const prelabel = () =>
    post("coaching/notebook/entries/prelabel", {
      examId,
      storageKey: `notebook/${user.id}/${randomUUID()}.jpg`,
    });
  beforeAll(async () => {
    h = await economyAuditHarness();
    const calendar = await request(h.app.getHttpServer()).get(
      "/v1/content/exams/kpss-lisans-2026/calendar",
    );
    expect(calendar.status).toBe(200);
    examId = calendar.body.exam.id;
  }, 90_000);
  beforeEach(async () => {
    vi.restoreAllMocks();
    await h.set("ai.enabled", true);
    await h.set("ai.budget.monthly_cap_usd_cents", 0);
    await h.set("ai.features.photo.categorize.free_enabled", true);
    await h.set("ai.features.photo.categorize.free_limit", 1);
    await h.set("ai.photo.monthly_limit", 1);
    user = await h.signup();
    vi.spyOn(
      h.app.get<StoragePort>(STORAGE_PORT),
      "readObject",
    ).mockResolvedValue(Buffer.from([1, 2, 3]));
  });
  afterAll(async () => {
    vi.restoreAllMocks();
    await h?.app.close();
    await h?.pool.end();
  });

  it("one Free notebook prelabel exhausts the shared allowance, including mock-exam uploads", async () => {
    expect((await prelabel()).status).toBe(200);
    const access = await request(h.app.getHttpServer())
      .get("/v1/coach/photo-access")
      .set(headers());
    expect(access.body).toMatchObject({
      canCategorize: false,
      reason: "PAYMENT_PREMIUM_REQUIRED",
    });
    expect((await prelabel()).status).toBe(403);
    expect(
      (await post("mock-exams/photo-upload-url", { contentType: "image/jpeg" }))
        .status,
    ).toBe(403);
  });

  it("the Premium monthly limit includes notebook requests", async () => {
    user = await weeklyAccount(h.app, h.pool, true);
    expect((await prelabel()).status).toBe(200);
    const denied = await prelabel();
    expect(denied.status).toBe(429);
    expect(denied.body.code).toBe("AI_PHOTO_RATE_LIMITED");
  });

  it("failed storage reads do not consume a photo request", async () => {
    vi.mocked(
      h.app.get<StoragePort>(STORAGE_PORT).readObject,
    ).mockResolvedValueOnce(Buffer.alloc(0));
    expect((await prelabel()).status).toBe(400);
    expect((await prelabel()).status).toBe(200);
  });
});
