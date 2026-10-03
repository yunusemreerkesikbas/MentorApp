import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "../src/database/drizzle";
import { withServiceContext } from "../src/database/rls";
import { PhoneTrialService } from "../src/modules/payments/application/phone-trial.service";
import { PhoneTrialsRepository } from "../src/modules/payments/infrastructure/phone-trials.repository";
import { SubscriptionsRepository } from "../src/modules/payments/infrastructure/payments.repositories";

/** Real Postgres constraints/transactions; no SMS or external payment calls. */
describe("phone trial claims (Postgres)", () => {
  let pool: Pool;
  let claims: PhoneTrialsRepository;
  let subscriptions: SubscriptionsRepository;
  let db: ReturnType<typeof createDatabase>;
  const users: string[] = [];
  const fingerprints: string[] = [];

  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test";
    if (!new URL(url).pathname.endsWith("_test")) throw new Error("A dedicated _test database is required");
    pool = new Pool({ connectionString: url });
    db = createDatabase(pool);
    claims = new PhoneTrialsRepository(db);
    subscriptions = new SubscriptionsRepository(db);
  });

  const serviceFor = (fingerprint: string) => {
    fingerprints.push(fingerprint);
    return new PhoneTrialService(db, { getVerifiedPhoneFingerprint: async () => fingerprint } as never, claims, subscriptions);
  };

  const user = async () => {
    const id = randomUUID();
    users.push(id);
    await withServiceContext(db, async (tx) => {
      await tx.execute(sql`insert into users(id,email,password_hash,display_name,kvkk_accepted_at,terms_accepted_at,age_eligibility_confirmed_at)
        values (${id}, ${id + "@trial.test"}, 'test', 'Trial test', now(), now(), now())`);
    });
    return id;
  };

  afterAll(async () => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("select set_config('app.role','SERVICE',true)");
      await client.query("delete from phone_trial_claims where phone_fingerprint = any($1::text[])", [fingerprints]);
      await client.query("delete from users where id = any($1::uuid[])", [users]);
      await client.query("commit");
    } finally { client.release(); await pool.end(); }
  });

  it("atomically excludes two accounts claiming the same phone", async () => {
    const service = serviceFor(randomUUID());
    const ids = await Promise.all([user(), user()]);
    const results = await Promise.allSettled(ids.map((id) => service.reserve(id, "premium-monthly")));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ code: "PAYMENT_TRIAL_UNAVAILABLE" });
  });

  it("permits only one pending attempt per account even with different fingerprints", async () => {
    const id = await user();
    const results = await Promise.allSettled([serviceFor(randomUUID()).reserve(id, "premium-monthly"), serviceFor(randomUUID()).reserve(id, "premium-monthly")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({ code: "PAYMENT_TRIAL_PENDING" });
  });

  it("consumption and granting access roll back together", async () => {
    const service = serviceFor(randomUUID());
    const id = await user();
    const claim = await service.reserve(id, "premium-monthly");
    const sub = await subscriptions.create({ userId: id, planId: "premium-monthly", status: "INCOMPLETE", provider: "FAKE" });
    await withServiceContext(db, (tx) => service.bind(claim.id, sub.id, id, tx));
    await expect(withServiceContext(db, async (tx) => {
      await service.consume(sub.id, tx);
      await subscriptions.update(sub.id, { status: "TRIALING" }, tx);
      throw new Error("rollback");
    })).rejects.toThrow("rollback");
    expect((await claims.findPendingForUser(id))?.status).toBe("PENDING");
    expect((await subscriptions.findOpenForUser(id))?.status).toBe("INCOMPLETE");
  });

  it("detaches consumed fingerprints on erasure and purges only expired consumption", async () => {
    const fingerprint = randomUUID();
    const service = serviceFor(fingerprint);
    const id = await user();
    const claim = await service.reserve(id, "premium-monthly");
    const sub = await subscriptions.create({ userId: id, planId: "premium-monthly", status: "INCOMPLETE", provider: "FAKE" });
    await withServiceContext(db, async (tx) => {
      await service.bind(claim.id, sub.id, id, tx);
      await service.saveCheckout(claim.id, { providerRef: "retention-ref", checkoutUrl: "https://pay/test" }, id, tx);
      await service.consume(sub.id, tx);
    });
    await service.detachUser(id);
    const detached = await claims.findByFingerprint(fingerprint);
    expect(detached).toMatchObject({ userId: null, subscriptionId: null, status: "CONSUMED", checkoutUrl: null, providerRef: null });
    expect(detached?.expiresAt).toBeInstanceOf(Date);
    await service.purgeExpired(new Date(detached!.expiresAt!.getTime() - 1));
    expect(await claims.findByFingerprint(fingerprint)).toBeDefined();
    await service.purgeExpired(detached!.expiresAt!);
    expect(await claims.findByFingerprint(fingerprint)).toBeUndefined();
  });

  it("does not automatically expire or release an unknown outcome after erasure", async () => {
    const fingerprint = randomUUID();
    const service = serviceFor(fingerprint);
    const id = await user();
    await service.reserve(id, "premium-monthly");
    await service.detachUser(id);
    await service.purgeExpired(new Date("2099-01-01T00:00:00Z"));
    expect(await claims.findByFingerprint(fingerprint)).toMatchObject({ userId: null, status: "PENDING", expiresAt: null });
  });

  it("cannot reattach or save a provider URL after erasure detaches a pending reservation", async () => {
    const fingerprint = randomUUID();
    const service = serviceFor(fingerprint);
    const id = await user();
    const claim = await service.reserve(id, "premium-monthly");
    const sub = await subscriptions.create({ userId: id, planId: "premium-monthly", status: "INCOMPLETE", provider: "FAKE" });
    await service.detachUser(id);
    await expect(withServiceContext(db, (tx) => service.bind(claim.id, sub.id, id, tx)))
      .rejects.toMatchObject({ code: "PAYMENT_TRIAL_UNAVAILABLE" });
    await expect(withServiceContext(db, (tx) => service.saveCheckout(claim.id,
      { providerRef: "late-provider", checkoutUrl: "https://provider/late" }, id, tx)))
      .rejects.toMatchObject({ code: "PAYMENT_TRIAL_UNAVAILABLE" });
    expect(await claims.findByFingerprint(fingerprint)).toMatchObject({ userId: null, subscriptionId: null, checkoutUrl: null });
  });

  it("cannot consume an attached reservation after erasure detaches it", async () => {
    const fingerprint = randomUUID();
    const service = serviceFor(fingerprint);
    const id = await user();
    const claim = await service.reserve(id, "premium-monthly");
    const sub = await subscriptions.create({ userId: id, planId: "premium-monthly", status: "INCOMPLETE", provider: "FAKE" });
    await withServiceContext(db, (tx) => service.bind(claim.id, sub.id, id, tx));
    await service.detachUser(id);
    await expect(withServiceContext(db, (tx) => service.consume(sub.id, tx)))
      .rejects.toMatchObject({ code: "PAYMENT_TRIAL_UNAVAILABLE" });
    expect(await claims.findByFingerprint(fingerprint)).toMatchObject({ status: "PENDING", userId: null });
  });
});
