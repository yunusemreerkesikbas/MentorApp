import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConfigRegistryService } from "../src/common/config/config-registry.service";
import { AdsService } from "../src/modules/ads/application/ads.service";

const RUN = Date.now();
const ARTICLE_SLUG = `lgs-reklam-guvenligi-${RUN}`;
const IDEMPOTENCY_KEY = "11111111-1111-4111-8111-111111111111";
const CRON_SECRET = `ads-cron-secret-for-e2e-${RUN}-only`;
const AD_CONFIG_OVERRIDES = {
  "ads.enabled": true,
  "ads.display.enabled": true,
  "ads.rewarded.enabled": true,
  "ads.placement.knowledge_article_end.enabled": true,
  "ads.placement.dashboard_rewarded_coin.enabled": true,
  "ads.rewarded.web.rollout_percent": 100,
  "ads.rewarded.web.cooldown_seconds": 0,
} as const;

interface StoredConfigOverride {
  key: string;
  value: unknown;
  updated_by: string | null;
  updated_at: Date;
}

describe("ads stabilization (e2e)", () => {
  let app: INestApplication;
  let pool: Pool;
  let firstToken = "";
  let secondToken = "";
  let firstUserId = "";
  let secondUserId = "";
  let previousAdConfigRows: StoredConfigOverride[] = [];

  const signup = async (label: string) => {
    const response = await request(app.getHttpServer())
      .post("/v1/auth/signup")
      .send({
        email: `ads-${label}-${RUN}@test.local`,
        password: "Sifre1234",
        displayName: `Ads ${label}`,
        kvkkAccepted: true,
      });
    expect(response.status).toBe(201);
    return response.body as { accessToken: string; user: { id: string } };
  };

  const serviceQuery = async (sql: string, params: unknown[] = []) => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("select set_config('app.role','SERVICE',true)");
      const result = await client.query(sql, params);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  };

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test";
    process.env.CRON_SECRET = CRON_SECRET;
    process.env.GAM_KNOWLEDGE_ARTICLE_END_AD_UNIT = "/6355419/Travel/Europe/France/Paris";
    process.env.GAM_DASHBOARD_REWARDED_COIN_AD_UNIT = "/22639388115/rewarded_web_example";
    pool = new Pool({ connectionString: process.env.DATABASE_URL });

    const { AppModule } = await import("../src/app.module");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix("v1");
    app.use(cookieParser());
    await app.init();

    const first = await signup("first");
    const second = await signup("second");
    firstToken = first.accessToken;
    secondToken = second.accessToken;
    firstUserId = first.user.id;
    secondUserId = second.user.id;

    const previousConfig = await serviceQuery(
      "select key,value,updated_by,updated_at from config_overrides where key = any($1::text[])",
      [Object.keys(AD_CONFIG_OVERRIDES)],
    );
    previousAdConfigRows = previousConfig.rows as StoredConfigOverride[];

    const registry = app.get(ConfigRegistryService);
    for (const [key, value] of Object.entries(AD_CONFIG_OVERRIDES)) {
      await registry.set(firstUserId, key, value);
    }

    await serviceQuery(
      `insert into info_articles
       (slug,title,body,family,category,source,source_url,verified_at,verified_by,published_at)
       values ($1,'LGS reklam güvenliği','Doğrulanmış içerik','LGS','APPLICATION','MEB',
               'https://www.meb.gov.tr',now(),'e2e-editor',now())`,
      [ARTICLE_SLUG],
    );
  }, 90_000);

  afterAll(async () => {
    if (pool) {
      await serviceQuery(
        "delete from config_overrides where key = any($1::text[])",
        [Object.keys(AD_CONFIG_OVERRIDES)],
      );
      for (const row of previousAdConfigRows) {
        await serviceQuery(
          `insert into config_overrides (key,value,updated_by,updated_at)
           values ($1,$2::jsonb,$3,$4)`,
          [row.key, JSON.stringify(row.value), row.updated_by, row.updated_at],
        );
      }
    }
    await app?.close();
    await pool?.end();
  });

  it("trusts published content instead of the deprecated examType query", async () => {
    const verified = await request(app.getHttpServer())
      .get(`/v1/ads/public/placements/knowledge.article.end?contentSlug=${ARTICLE_SLUG}&examType=KPSS`)
      .set("cf-ipcountry", "TR");
    expect(verified.status).toBe(200);
    expect(verified.body).toMatchObject({ enabled: true, audienceTreatment: "CHILD" });

    const unverified = await request(app.getHttpServer())
      .get("/v1/ads/public/placements/knowledge.article.end?contentSlug=unpublished-context&examType=KPSS")
      .set("cf-ipcountry", "TR");
    expect(unverified.status).toBe(200);
    expect(unverified.body).toMatchObject({
      enabled: false,
      reason: "CONTEXT_UNVERIFIED",
      adUnitPath: null,
    });
  });

  it("rejects EEA traffic and invalid idempotency headers", async () => {
    const eea = await request(app.getHttpServer())
      .get("/v1/ads/reward-offers/dashboard.rewarded.coin")
      .set({ Authorization: `Bearer ${firstToken}`, "cf-ipcountry": "DE" });
    expect(eea.status).toBe(200);
    expect(eea.body).toMatchObject({ eligible: false, reason: "REGION_REQUIRES_CONSENT" });

    const invalid = await request(app.getHttpServer())
      .post("/v1/ads/reward-sessions")
      .set({ Authorization: `Bearer ${firstToken}`, "Idempotency-Key": "not-a-uuid" })
      .send({ placementId: "dashboard.rewarded.coin" });
    expect(invalid.status).toBe(400);
  });

  it("creates and completes one grant under concurrent retries", async () => {
    const create = () => request(app.getHttpServer())
      .post("/v1/ads/reward-sessions")
      .set({ Authorization: `Bearer ${firstToken}`, "Idempotency-Key": IDEMPOTENCY_KEY })
      .send({ placementId: "dashboard.rewarded.coin" });
    const [first, replay] = await Promise.all([create(), create()]);
    expect(first.status).toBe(201);
    expect(replay.status).toBe(201);
    expect(replay.body.id).toBe(first.body.id);

    const crossUser = await request(app.getHttpServer())
      .post(`/v1/ads/reward-sessions/${first.body.id}/complete`)
      .set({ Authorization: `Bearer ${secondToken}` });
    expect(crossUser.status).toBe(404);

    const complete = () => request(app.getHttpServer())
      .post(`/v1/ads/reward-sessions/${first.body.id}/complete`)
      .set({ Authorization: `Bearer ${firstToken}` });
    const completions = await Promise.all([complete(), complete()]);
    expect(completions.map((response) => response.status)).toEqual([201, 201]);

    const rows = await serviceQuery(
      `select count(*)::int as count from ledger_entries
       where user_id=$1 and reason='ad.reward.completed' and ref_id=$2`,
      [firstUserId, first.body.id],
    );
    expect(rows.rows[0].count).toBe(1);
  });

  it("lets only one cleanup worker expire and release a stale reservation", async () => {
    const created = await request(app.getHttpServer())
      .post("/v1/ads/reward-sessions")
      .set({
        Authorization: `Bearer ${secondToken}`,
        "Idempotency-Key": "22222222-2222-4222-8222-222222222222",
      })
      .send({ placementId: "dashboard.rewarded.coin" });
    expect(created.status).toBe(201);
    await serviceQuery(
      "update ad_reward_sessions set expires_at=now() - interval '1 minute' where id=$1",
      [created.body.id],
    );

    const results = await Promise.all([
      app.get(AdsService).expireDueSessions(),
      app.get(AdsService).expireDueSessions(),
    ]);
    expect(results.reduce((sum, result) => sum + result.expired, 0)).toBe(1);

    const unauthorized = await request(app.getHttpServer())
      .post("/v1/internal/cron/expire-ad-reward-sessions");
    expect(unauthorized.status).toBe(401);
    const sweep = await request(app.getHttpServer())
      .post("/v1/internal/cron/expire-ad-reward-sessions")
      .set("x-cron-secret", CRON_SECRET);
    expect(sweep.status).toBe(201);
    expect(sweep.body).toEqual({ expired: 0 });

    const state = await serviceQuery(
      `select s.status, r.status as reservation_status
       from ad_reward_sessions s
       join coin_grant_reservations r on r.ref_id=s.id::text and r.source='ad_reward'
       where s.id=$1 and s.user_id=$2`,
      [created.body.id, secondUserId],
    );
    expect(state.rows[0]).toEqual({ status: "EXPIRED", reservation_status: "RELEASED" });
  });
});
