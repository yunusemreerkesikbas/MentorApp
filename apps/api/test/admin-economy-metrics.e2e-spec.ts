import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UserRole, type AdminEconomyStatsDto, type EconomyReasonFlowDto } from "@mentor/types";

const RUN = Date.now();
/**
 * Test-unique reasons. The whole e2e suite shares one Postgres and runs in parallel, so any
 * assertion on a REAL reason ("quest.…") would race other specs' ledger rows. Our own reasons are
 * unforgeable by other specs, which lets us assert exact amounts instead of loose bounds.
 */
const FAUCET_REASON = `e2e-metrics-faucet-${RUN}`;
const SINK_REASON = `e2e-metrics-sink-${RUN}`;
const XP_REASON = `e2e-metrics-xp-${RUN}`;
const CORRECTION_REASON = `e2e-metrics-correction-${RUN}`;
/** The real reason the faucet-reach metric is hardcoded to — seeded to prove reach counts it. */
const WEEKLY_ALLOWANCE_REASON = "quest.weekly.effort-allowance";

/**
 * W6 admin economy metrics (e2e): proves the ledger aggregates behind
 * GET /v1/admin/metrics/economy against a real Postgres — the faucet/sink breakdown, the
 * organic-vs-correction split, the outstanding float and the recurring-faucet reach.
 */
describe("admin economy metrics (e2e)", () => {
  let app: INestApplication;
  let pool: Pool;
  let adminToken = "";
  let adminId = "";
  let holderToken = "";
  let holderId = "";

  const signup = async (label: string) => {
    const email = `aem-${label}-${RUN}@test.local`;
    const res = await request(app.getHttpServer())
      .post("/v1/auth/signup")
      .send({ email, password: "Sifre1234", displayName: `AEM ${label}`, kvkkAccepted: true });
    return { email, ...(res.body as { accessToken: string; user: { id: string } }) };
  };

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

  const seedLedger = (
    rows: { unit: string; amount: number; reason: string; createdBy?: string }[],
  ) =>
    svc(async (c) => {
      for (const r of rows) {
        await c.query(
          `insert into ledger_entries (user_id, unit, amount, reason, status, created_by)
           values ($1,$2,$3,$4,'CONFIRMED',$5)`,
          [holderId, r.unit, r.amount, r.reason, r.createdBy ?? null],
        );
      }
    });

  const fetchStats = async (token: string) =>
    request(app.getHttpServer())
      .get("/v1/admin/metrics/economy")
      .set({ Authorization: `Bearer ${token}` });

  const find = (rows: EconomyReasonFlowDto[], reason: string) =>
    rows.find((r) => r.reason === reason);

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
    const holder = await signup("holder");
    adminId = admin.user.id;
    holderToken = holder.accessToken;
    holderId = holder.user.id;

    await svc(async (c) => {
      await c.query("update users set roles = array_append(roles,$1) where id=$2", [
        UserRole.ADMIN,
        adminId,
      ]);
    });
    const login = await request(app.getHttpServer())
      .post("/v1/auth/login")
      .send({ email: admin.email, password: "Sifre1234" });
    adminToken = login.body.accessToken;

    await seedLedger([
      { unit: "COIN", amount: 15, reason: FAUCET_REASON },
      { unit: "COIN", amount: 10, reason: FAUCET_REASON },
      { unit: "COIN", amount: -5, reason: SINK_REASON },
      { unit: "XP", amount: 5, reason: XP_REASON },
      { unit: "COIN", amount: 15, reason: WEEKLY_ALLOWANCE_REASON },
      // Admin correction — must stay OUT of the organic breakdown.
      { unit: "COIN", amount: 100, reason: CORRECTION_REASON, createdBy: adminId },
    ]);
  }, 90_000);

  afterAll(async () => {
    await app?.close();
    await pool?.end();
  });

  it("breaks the COIN faucet and sink down per reason", async () => {
    const res = await fetchStats(adminToken);
    expect(res.status).toBe(200);
    const stats = res.body as AdminEconomyStatsDto;

    expect(find(stats.coinByReason, FAUCET_REASON)).toEqual({
      reason: FAUCET_REASON,
      credited: 25, // 15 + 10 summed into one reason row
      debited: 0,
      users: 1,
    });
    expect(find(stats.coinByReason, SINK_REASON)).toEqual({
      reason: SINK_REASON,
      credited: 0,
      debited: 5, // returned as a positive magnitude, not -5
      users: 1,
    });
  });

  it("keeps XP in its own breakdown, never mixed into the coin faucet", async () => {
    const stats = (await fetchStats(adminToken)).body as AdminEconomyStatsDto;

    expect(find(stats.xpByReason, XP_REASON)?.credited).toBe(5);
    expect(find(stats.coinByReason, XP_REASON)).toBeUndefined();
  });

  it("reports admin corrections separately from organic earning", async () => {
    const stats = (await fetchStats(adminToken)).body as AdminEconomyStatsDto;

    // The whole point: a support adjustment must not inflate the organic rates being calibrated.
    expect(find(stats.coinByReason, CORRECTION_REASON)).toBeUndefined();
    expect(stats.corrections.credited).toBeGreaterThanOrEqual(100);
    expect(stats.corrections.rows).toBeGreaterThanOrEqual(1);
  });

  it("counts unspent coin as float and the weekly quest as faucet reach", async () => {
    const stats = (await fetchStats(adminToken)).body as AdminEconomyStatsDto;

    // Our holder alone carries 15+10-5+15+100 = 135; other specs may add more, never less.
    expect(stats.float.coinConfirmed).toBeGreaterThanOrEqual(135);
    expect(stats.float.holders).toBeGreaterThanOrEqual(1);
    expect(stats.faucetReach.earners7d).toBeGreaterThanOrEqual(1);
    expect(stats.windows.d30.coinCredited).toBeGreaterThanOrEqual(140);
    expect(stats.windows.d30.xpCredited).toBeGreaterThanOrEqual(5);
  });

  it("is admin-only", async () => {
    expect((await fetchStats(holderToken)).status).toBe(403);
  });
});
