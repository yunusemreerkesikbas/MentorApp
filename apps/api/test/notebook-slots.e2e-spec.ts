import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Currency, UserRole } from "@mentor/types";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConfigRegistryService } from "../src/common/config/config-registry.service";
import { EconomyService } from "../src/modules/economy/application/economy.service";
import { UsersService } from "../src/modules/identity/application/users.service";
import { createTestApp } from "./app-harness";
import request from "./browser-request";

describe("permanent notebook capacity purchased with Coin (HTTP + Postgres)", () => {
  let app: INestApplication;
  let pool: Pool;
  let config: ConfigRegistryService;
  let economy: EconomyService;
  let buyer = { id: "", token: "" };
  let other = { id: "", token: "" };
  let admin = { id: "", token: "" };
  const endpoint = "/v1/economy/notebook-slots";
  const auth = (token = buyer.token) => ({ Authorization: `Bearer ${token}` });
  const buy = (key: string, count: number, cost = 20, token = buyer.token) =>
    request(app.getHttpServer())
      .post(endpoint)
      .set(auth(token))
      .set("Idempotency-Key", key)
      .send({ expectedCost: cost, expectedPurchasedSlots: count });
  const createNotebook = (title: string) =>
    request(app.getHttpServer())
      .post("/v1/coaching/notebooks")
      .set(auth())
      .send({
        title,
        examId: null,
        subjectRef: null,
        cover: { color: "navy", material: "cloth" },
      });
  const limits = async () => {
    const res = await request(app.getHttpServer())
      .get("/v1/coaching/notebooks")
      .set(auth());
    expect(res.status).toBe(200);
    return res.body.items[0].limits;
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const { AppModule } = await import("../src/app.module");
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = createTestApp(moduleRef, { authRateLimits: false });
    await app.init();
    config = moduleRef.get(ConfigRegistryService);
    economy = moduleRef.get(EconomyService);
    const signup = async () => {
      const email = `notebook-slot-${randomUUID()}@test.local`;
      const res = await request(app.getHttpServer())
        .post("/v1/auth/signup")
        .send({
          email,
          password: "Sifre1234",
          displayName: "Notebook tester",
          kvkkAccepted: true,
          termsAccepted: true,
          ageEligibilityConfirmed: true,
        });
      expect(res.status).toBe(201);
      return {
        id: res.body.user.id as string,
        token: res.body.accessToken as string,
        email,
      };
    };
    buyer = await signup();
    other = await signup();
    const actor = await signup();
    const users = moduleRef.get(UsersService);
    await users.addRole(actor.id, UserRole.SUPER_ADMIN);
    await users.addRole(actor.id, UserRole.STAFF);
    const login = await request(app.getHttpServer())
      .post("/v1/auth/login")
      .send({ email: actor.email, password: "Sifre1234" });
    expect(login.status).toBe(200);
    admin = { id: actor.id, token: login.body.accessToken };
    await config.set(admin.id, "economy.enabled", true);
    await config.set(admin.id, "economy.coin.notebook_slot_cost", 20);
    await config.set(admin.id, "economy.notebook_slots.max_per_user", 2);
    await economy.grant(buyer.id, Currency.COIN, 100, {
      reason: "seed.notebook-slots",
      enforceLimits: false,
    });
  }, 90_000);

  afterAll(async () => {
    await app?.close();
    await pool?.end();
  });

  it("requires a valid key, protects accounts and refuses an insufficient confirmed balance", async () => {
    expect((await request(app.getHttpServer()).get(endpoint)).status).toBe(401);
    expect(
      (
        await request(app.getHttpServer())
          .post(endpoint)
          .set(auth())
          .send({ expectedCost: 20, expectedPurchasedSlots: 0 })
      ).status,
    ).toBe(400);
    expect((await buy("invalid", 0)).status).toBe(400);
    expect((await buy(randomUUID(), 0, 20, other.token)).status).toBe(422);
    expect(
      (
        await request(app.getHttpServer())
          .patch("/v1/admin/config/economy.coin.notebook_slot_cost")
          .set(auth())
          .send({ value: 1 })
      ).status,
    ).toBe(403);
  });

  it("commits only one debit for concurrent retries and stale simultaneous offers", async () => {
    const key = randomUUID();
    const retries = await Promise.all([buy(key, 0), buy(key, 0)]);
    expect(retries.map((res) => res.status)).toEqual([201, 201]);
    expect((await buy(randomUUID(), 0)).status).toBe(409);
    expect((await economy.getAdminBalance(buyer.id)).coinConfirmed).toBe(80);
    expect(await limits()).toMatchObject({
      maxCustomNotebooks: 2,
      maxPages: 20,
      maxEntries: 50,
      maxPhotos: 5,
    });
    // The same UUID is safe for a different user: references are scoped to the buyer.
    await economy.grant(other.id, Currency.COIN, 20, {
      reason: "seed.notebook-slots",
    });
    expect((await buy(key, 0, 20, other.token)).status).toBe(201);
    expect((await economy.getAdminBalance(other.id)).coinConfirmed).toBe(0);
  });

  it("allows creation, reusable capacity after deletion and ownership while economy is off", async () => {
    const first = await createNotebook("First custom");
    const second = await createNotebook("Coin custom");
    expect([first.status, second.status]).toEqual([201, 201]);
    expect((await createNotebook("Over quota")).status).toBe(403);
    await config.set(admin.id, "economy.enabled", false);
    expect(
      (await request(app.getHttpServer()).get(endpoint).set(auth())).status,
    ).toBe(404);
    expect((await buy(randomUUID(), 1)).status).toBe(404);
    expect(
      (
        await request(app.getHttpServer())
          .delete(`/v1/coaching/notebooks/${second.body.id}`)
          .set(auth())
      ).status,
    ).toBe(204);
    expect((await createNotebook("Reused slot")).status).toBe(201);
    expect((await economy.getAdminBalance(buyer.id)).coinConfirmed).toBe(80);
    await config.set(admin.id, "economy.enabled", true);
  });

  it("applies an admin price change, rejects stale quotes and enforces the purchase cap", async () => {
    const update = await request(app.getHttpServer())
      .patch("/v1/admin/config/economy.coin.notebook_slot_cost")
      .set(auth(admin.token))
      .send({ value: 30 });
    expect(update.status).toBe(200);
    const audit = await pool.query<{ before: unknown; after: unknown }>(
      'select "before", "after" from admin_audit_log where actor_user_id = $1 and target_id = $2 order by created_at desc limit 1',
      [admin.id, "economy.coin.notebook_slot_cost"],
    );
    expect(audit.rows[0]).toMatchObject({
      before: { value: 20 },
      after: { value: 30 },
    });
    expect(
      (await request(app.getHttpServer()).get(endpoint).set(auth())).body.cost,
    ).toBe(30);
    expect((await buy(randomUUID(), 1, 20)).status).toBe(409);
    const purchases = await Promise.all([
      buy(randomUUID(), 1, 30),
      buy(randomUUID(), 1, 30),
    ]);
    expect(purchases.filter((res) => res.status === 201)).toHaveLength(1);
    expect((await economy.getAdminBalance(buyer.id)).coinConfirmed).toBe(50);
    expect((await buy(randomUUID(), 2, 30)).status).toBe(422);
    await config.set(admin.id, "economy.notebook_slots.max_per_user", 0);
    expect(await limits()).toMatchObject({ maxCustomNotebooks: 3 });
    const ledger = await pool.query<{ count: number }>(
      "select count(*)::int as count from ledger_entries where user_id = $1 and reason = 'notebook.slot.purchase'",
      [buyer.id],
    );
    expect(ledger.rows[0].count).toBe(2);
    const history = await request(app.getHttpServer())
      .get("/v1/economy/ledger")
      .set(auth());
    expect(
      history.body.find(
        (row: { reason: string }) => row.reason === "notebook.slot.purchase",
      ).title,
    ).toBe("Ek defter kapasitesi açıldı");
    // Premium already includes this capacity and cannot be charged.
    expect((await buy(randomUUID(), 0, 30, admin.token)).status).toBe(409);
    expect(
      (
        await request(app.getHttpServer())
          .patch("/v1/admin/config/economy.coin.notebook_slot_cost")
          .set(auth(admin.token))
          .send({ value: 0 })
      ).status,
    ).toBe(400);
  });
});
