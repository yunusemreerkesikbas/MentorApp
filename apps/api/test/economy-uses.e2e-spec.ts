import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Currency, UserRole } from "@mentor/types";
import type { EconomyUsesView } from "@mentor/types";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ConfigRegistryService } from "../src/common/config/config-registry.service";
import { EconomyService } from "../src/modules/economy/application/economy.service";
import { EconomyLedger } from "../src/modules/economy/domain/economy.constants";
import { UsersService } from "../src/modules/identity/application/users.service";
import { AiUsageRepository } from "../src/modules/ai/infrastructure/ai-usage.repository";
import { LLM_PORT, type LlmPort } from "../src/modules/ai/domain/llm.port";
import { createTestApp } from "./app-harness";
import request from "./browser-request";

describe("Coin use catalog (real HTTP/Postgres)", () => {
  let app: INestApplication;
  let pool: Pool;
  let config: ConfigRegistryService;
  let economy: EconomyService;
  let users: UsersService;
  let usage: AiUsageRepository;
  let llm: ReturnType<typeof vi.spyOn>;
  let id = "";
  let token = "";
  const email = `coin-catalog-${randomUUID()}@example.test`;
  const password = "CatalogQa!2026";
  const headers = () => ({ Authorization: `Bearer ${token}` });
  const view = async () => {
    const res = await request(app.getHttpServer())
      .get("/v1/economy/uses")
      .set(headers());
    expect(res.status).toBe(200);
    return res.body as EconomyUsesView;
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
    users = moduleRef.get(UsersService);
    usage = moduleRef.get(AiUsageRepository);
    llm = vi.spyOn(moduleRef.get<LlmPort>(LLM_PORT), "complete");
    const signup = await request(app.getHttpServer())
      .post("/v1/auth/signup")
      .send({
        email,
        password,
        displayName: "Catalog QA",
        kvkkAccepted: true,
        termsAccepted: true,
        ageEligibilityConfirmed: true,
      });
    expect(signup.status).toBe(201);
    id = signup.body.user.id;
    token = signup.body.accessToken;
    await config.set(id, "economy.enabled", false);
    await config.set(id, "ai.budget.monthly_cap_usd_cents", 0);
  }, 90_000);
  afterAll(async () => {
    await app?.close();
    await pool?.end();
  });

  it("is authenticated and closed with economy-off", async () => {
    expect(
      (await request(app.getHttpServer()).get("/v1/economy/uses")).status,
    ).toBe(401);
    expect(
      (
        await request(app.getHttpServer())
          .get("/v1/economy/uses")
          .set(headers())
      ).body.code,
    ).toBe("ECONOMY_DISABLED");
  });
  it("keeps notebook options available with AI-off and never changes the ledger", async () => {
    await config.set(id, "economy.enabled", true);
    await config.set(id, "ai.enabled", false);
    await config.set(id, "economy.coin.notebook_slot_cost", 37);
    await economy.grant(id, Currency.COIN, 40, {
      reason: "seed.catalog",
      enforceLimits: false,
    });
    const before = await economy.getAdminBalance(id);
    const result = await view();
    expect(result).toMatchObject({
      coinConfirmed: 40,
      items: [
        {
          id: "NOTEBOOK_SLOT",
          cost: 37,
          status: "AVAILABLE",
          slotsOwned: 0,
          slotLimit: 2,
        },
        { id: "COACH_CHAT", status: "UNAVAILABLE", canOpen: false },
        { id: "DEEP_ANALYSIS", status: "UNAVAILABLE", canOpen: false },
      ],
    });
    await view();
    expect(await economy.getAdminBalance(id)).toEqual(before);
    expect(llm).not.toHaveBeenCalled();
  });
  it("uses real chat counters, dynamic prices and the selected exam's report readiness", async () => {
    await config.set(id, "ai.enabled", true);
    await config.set(id, "economy.coin.ai_chat_cost", 7);
    await config.set(id, "ai.chat.free_coin_daily_limit", 2);
    expect((await view()).items).toMatchObject([
      { cost: 37 },
      { cost: 7, dailyRemaining: 2, status: "AVAILABLE" },
      { status: "NEEDS_EXAM" },
    ]);
    await users.updateMe(id, { examType: "KPSS", examVariant: "LISANS" });
    expect((await view()).items[2]).toMatchObject({
      status: "REVIEW_NOT_READY",
      canOpen: false,
    });
    for (let i = 0; i < 2; i++)
      await economy.spend(id, 7, {
        reason: EconomyLedger.AI_CHAT_SPEND_REASON,
        refType: EconomyLedger.AI_CHAT_REF_TYPE,
        refId: randomUUID(),
      });
    const result = await view();
    expect(result.items[1]).toMatchObject({
      status: "DAILY_LIMIT_REACHED",
      dailyRemaining: 0,
      canOpen: false,
    });
    expect(llm).not.toHaveBeenCalled();
  });
  it("shows Premium inclusion without selling included rights, and respects a closed AI budget", async () => {
    await users.addRole(id, UserRole.STAFF);
    const login = await request(app.getHttpServer())
      .post("/v1/auth/login")
      .send({ email, password });
    expect(login.status).toBe(200);
    token = login.body.accessToken;
    const before = await economy.getAdminBalance(id);
    expect((await view()).items).toMatchObject([
      { premiumIncluded: true, status: "PREMIUM_INCLUDED", cost: null },
      { premiumIncluded: true, status: "PREMIUM_INCLUDED", cost: null },
      { premiumIncluded: true, status: "REVIEW_NOT_READY", cost: null },
    ]);
    await usage.append({
      userId: id,
      feature: "chat",
      model: "fake",
      promptTokens: 0,
      completionTokens: 0,
      costMicros: 10000,
    });
    await config.set(id, "ai.budget.monthly_cap_usd_cents", 1);
    expect((await view()).items[1]).toMatchObject({
      premiumIncluded: true,
      status: "UNAVAILABLE",
      canOpen: false,
      cost: null,
    });
    expect(await economy.getAdminBalance(id)).toEqual(before);
    expect(llm).not.toHaveBeenCalled();
    const rows = await pool.query<{ n: number }>(
      "select count(*)::int n from ai_usage where user_id=$1",
      [id],
    );
    expect(rows.rows[0].n).toBe(1); // only the explicit budget fixture, never catalog-generated usage
  });
});
