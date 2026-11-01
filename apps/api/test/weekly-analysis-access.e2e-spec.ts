import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Currency } from "@mentor/types";
import { Pool } from "pg";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { ConfigRegistryService } from "../src/common/config/config-registry.service";
import { DomainError } from "../src/common/errors/domain-error";
import { ErrorCode } from "../src/common/errors/error-code";
import { AiBudgetGuard } from "../src/modules/ai/application/ai-budget.guard";
import { AiUsageRepository } from "../src/modules/ai/infrastructure/ai-usage.repository";
import { RAW_LLM_PORT, type LlmPort } from "../src/modules/ai/domain/llm.port";
import { EconomyService } from "../src/modules/economy/application/economy.service";
import { FeaturePolicyService } from "../src/modules/payments/application/feature-policy.service";
import { createTestApp } from "./app-harness";
import request from "./browser-request";
import { weeklyAccount } from "./fixtures/weekly-analysis";

describe("Weekly analysis policy (HTTP + Postgres)", () => {
  let app: INestApplication;
  let pool: Pool;
  let config: ConfigRegistryService;
  let economy: EconomyService;
  let budget: AiBudgetGuard;
  let usage: AiUsageRepository;
  let raw: LlmPort;
  let examId: string;
  let user: Awaited<ReturnType<typeof weeklyAccount>>;
  const auth = () => ({ Authorization: `Bearer ${user.token}` });
  const offer = () =>
    request(app.getHttpServer())
      .get("/v1/economy/deep-analysis")
      .query({ examId })
      .set(auth());
  const buy = () =>
    request(app.getHttpServer())
      .post("/v1/economy/deep-analysis")
      .set(auth())
      .send({ examId });
  const narrate = () =>
    request(app.getHttpServer())
      .post("/v1/coach/weekly-review")
      .set(auth())
      .send({ examId });
  const balance = () => economy.getAdminBalance(user.id);

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const { AppModule } = await import("../src/app.module");
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = createTestApp(module, { authRateLimits: false });
    await app.init();
    config = module.get(ConfigRegistryService);
    economy = module.get(EconomyService);
    budget = module.get(AiBudgetGuard);
    usage = module.get(AiUsageRepository);
    raw = module.get<LlmPort>(RAW_LLM_PORT);
    const calendar = await request(app.getHttpServer()).get(
      "/v1/content/exams/kpss-lisans-2026/calendar",
    );
    expect(calendar.status).toBe(200);
    examId = calendar.body.exam.id;
  }, 90_000);

  beforeEach(async () => {
    vi.restoreAllMocks();
    user = await weeklyAccount(app, pool);
    await config.set(user.id, "economy.enabled", true);
    // This suite verifies the explicitly selectable legacy weekly-taste policy.
    await config.set(user.id, "coaching.weekly_recap.access_enabled", false);
    await config.set(user.id, "ai.enabled", true);
    await config.set(user.id, "ai.budget.monthly_cap_usd_cents", 0);
    await config.set(user.id, "ai.budget.reservation_usd_cents", 5);
    await config.set(
      user.id,
      "ai.features.weekly.narration.free_enabled",
      false,
    );
    await config.set(user.id, "ai.features.weekly.narration.free_limit", 1);
    await config.set(user.id, "ai.features.deep.analysis.free_enabled", false);
    await economy.grant(user.id, Currency.COIN, 50, {
      reason: "seed.weekly",
      enforceLimits: false,
    });
  });
  afterAll(async () => {
    vi.restoreAllMocks();
    await app?.close();
    await pool?.end();
  });

  it("uses the weekly capped policy for offers, both feature IDs, purchase and generation", async () => {
    await config.set(user.id, "ai.features.deep.analysis.free_enabled", true);
    expect((await offer()).body).toMatchObject({
      unlocked: false,
      generationAvailable: true,
    });
    expect((await narrate()).body.code).toBe("PAYMENT_PREMIUM_REQUIRED");
    await config.set(user.id, "ai.features.deep.analysis.free_enabled", false);
    await config.set(
      user.id,
      "ai.features.weekly.narration.free_enabled",
      true,
    );
    const policies = await app.get(FeaturePolicyService).listPolicies();
    expect(policies["deep.analysis"]).toMatchObject({
      freeEnabled: true,
      limit: 1,
      window: "week",
    });
    expect(policies["weekly.narration"]).toMatchObject({
      freeEnabled: true,
      limit: 1,
      window: "week",
    });
    const before = await balance();
    expect((await offer()).body.unlocked).toBe(true);
    expect((await buy()).body).toMatchObject({
      unlocked: true,
      purchased: false,
    });
    expect(await balance()).toEqual(before);
    expect((await narrate()).status).toBe(200);
    // Quota exhaustion is reflected in the offer and authorization, even with a cached narration.
    expect((await offer()).body.unlocked).toBe(false);
    expect((await narrate()).body.code).toBe("PAYMENT_PREMIUM_REQUIRED");
    expect((await buy()).body).toMatchObject({
      purchased: true,
      coinConfirmed: 25,
    });
    expect((await narrate()).body.model).toBe("cache");
  });

  it("refuses a debit when active reservations fill budget and GET creates no hold", async () => {
    const now = new Date();
    const spent = await usage.windowSince(
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    );
    await config.set(
      user.id,
      "ai.budget.monthly_cap_usd_cents",
      Math.ceil(spent.costMicros / 10_000) + 5,
    );
    const hold = await budget.acquire();
    expect(hold).not.toBeNull();
    const before = await balance();
    const holds = await pool.query(
      "select count(*)::int n from ai_budget_reservations",
    );
    expect((await offer()).body.generationAvailable).toBe(false);
    expect((await buy()).body.code).toBe("AI_BUDGET_EXCEEDED");
    expect(await balance()).toEqual(before);
    expect(
      (await pool.query("select count(*)::int n from ai_budget_reservations"))
        .rows,
    ).toEqual(holds.rows);
    await budget.release(hold);
  });

  it("rechecks budget capacity after an available offer and never debits", async () => {
    expect((await offer()).body.generationAvailable).toBe(true);
    const acquire = vi
      .spyOn(budget, "acquire")
      .mockRejectedValue(new DomainError(ErrorCode.AI_BUDGET_EXCEEDED, 503));
    expect((await buy()).body.code).toBe("AI_BUDGET_EXCEEDED");
    expect((await balance()).coinConfirmed).toBe(50);
    expect(acquire).toHaveBeenCalledOnce();
  });

  it("keeps a paid right after provider failure, retries free and serves cache over budget", async () => {
    const results = await Promise.all([buy(), buy()]);
    expect(
      results.every((res) => res.status === 201 && res.body.purchased),
    ).toBe(true);
    expect((await balance()).coinConfirmed).toBe(25);
    const complete = vi
      .spyOn(raw, "complete")
      .mockRejectedValueOnce(new Error("QA provider failure"));
    expect((await narrate()).status).toBe(500);
    expect((await buy()).body).toMatchObject({
      purchased: true,
      coinConfirmed: 25,
    });
    expect((await narrate()).status).toBe(200);
    const calls = complete.mock.calls.length;
    await config.set(user.id, "ai.budget.monthly_cap_usd_cents", 1);
    await usage.append({
      userId: user.id,
      model: "fake",
      feature: "qa.budget",
      promptTokens: 0,
      completionTokens: 0,
      costMicros: 10_000,
    });
    expect((await offer()).body).toMatchObject({
      purchased: true,
      generationAvailable: false,
    });
    expect((await buy()).body.coinConfirmed).toBe(25);
    expect((await narrate()).body.model).toBe("cache");
    expect(complete).toHaveBeenCalledTimes(calls);
    expect((await balance()).coinConfirmed).toBe(25);
  });

  it("never debits Premium users and blocks all new Coin access when flags close", async () => {
    user = await weeklyAccount(app, pool, true);
    expect((await buy()).body).toMatchObject({
      premium: true,
      unlocked: true,
      coinConfirmed: 0,
    });
    expect((await narrate()).status).toBe(200);
    await config.set(user.id, "ai.enabled", false);
    expect((await offer()).body.code).toBe("AI_DISABLED");
    expect((await buy()).body.code).toBe("AI_DISABLED");
    expect((await narrate()).body.code).toBe("AI_DISABLED");
    await config.set(user.id, "ai.enabled", true);
    await config.set(user.id, "economy.enabled", false);
    expect((await buy()).body.code).toBe("ECONOMY_DISABLED");
    expect((await balance()).coinConfirmed).toBe(0);
  });
});
