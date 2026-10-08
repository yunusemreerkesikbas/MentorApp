import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDatabase, type Database } from "../src/database/drizzle";
import { withServiceContext } from "../src/database/rls";
import { users } from "../src/database/schema";
import { authSessions } from "../src/database/schema-sessions";
import { authRateLimits } from "../src/database/schema-auth-rate-limits";
import { AuthRateLimitRepository } from "../src/modules/identity/infrastructure/auth-rate-limit.repository";
import { AuthSessionRepository } from "../src/modules/identity/infrastructure/auth-session.repository";
import { EmailTokenRepository } from "../src/modules/identity/infrastructure/email-token.repository";
import { UsersRepository } from "../src/modules/identity/infrastructure/users.repository";
import { hashToken } from "../src/modules/identity/application/token.service";

describe("durable auth limits and serialized account security (Postgres)", () => {
  let pool: Pool;
  let secondPool: Pool;
  let db: Database;
  let rates: AuthRateLimitRepository;
  let sessions: AuthSessionRepository;
  let emails: EmailTokenRepository;
  let accounts: UsersRepository;
  const userIds: string[] = [];
  const rateKeys: string[] = [];

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test", max: 5 });
    secondPool = new Pool({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test", max: 2 });
    await pool.query("do $$ begin create role auth_security_probe nosuperuser nobypassrls; exception when duplicate_object then null; end $$");
    await pool.query("grant usage on schema public to auth_security_probe");
    await pool.query("grant select, insert, update, delete on auth_rate_limits to auth_security_probe");
    db = createDatabase(pool);
    rates = new AuthRateLimitRepository(db);
    sessions = new AuthSessionRepository(db);
    emails = new EmailTokenRepository(db);
    accounts = new UsersRepository(db);
  });

  afterAll(async () => {
    await withServiceContext(db, async (tx) => {
      for (const id of userIds) await tx.delete(users).where(eq(users.id, id));
      for (const key of rateKeys) await tx.delete(authRateLimits).where(eq(authRateLimits.key, key));
    });
    await pool.end();
    await secondPool.end();
  });

  function rateKey() { const key = hashToken(randomUUID()); rateKeys.push(key); return key; }
  async function account() {
    const id = randomUUID(); userIds.push(id);
    const email = `security-${id}@test.local`;
    await withServiceContext(db, (tx) => tx.insert(users).values({ id, email, passwordHash: "old-hash", displayName: "Security fixture", kvkkAcceptedAt: new Date() }));
    const sid = randomUUID();
    const refresh = { tokenHash: hashToken(randomUUID()), expiresAt: new Date(Date.now() + 86400_000) };
    await sessions.create(id, sid, refresh);
    return { id, email, sid, refresh };
  }

  it("admits exactly the quota under concurrency, shares it across instances and never extends rejection", async () => {
    const key = rateKey();
    const decisions = await Promise.all(Array.from({ length: 15 }, () => rates.consume(key, 10, 900)));
    expect(decisions.filter((value) => value.allowed)).toHaveLength(10);
    const before = await withServiceContext(db, (tx) => tx.select().from(authRateLimits).where(eq(authRateLimits.key, key)));
    expect((await new AuthRateLimitRepository(createDatabase(secondPool)).consume(key, 10, 900)).allowed).toBe(false);
    const after = await withServiceContext(db, (tx) => tx.select().from(authRateLimits).where(eq(authRateLimits.key, key)));
    expect(after[0]).toEqual(before[0]);
    await withServiceContext(db, (tx) => tx.update(authRateLimits).set({ expiresAt: new Date(0), nextAllowedAt: new Date(0) }).where(eq(authRateLimits.key, key)));
    expect((await rates.consume(key, 10, 900)).allowed).toBe(true);
  });

  it("applies the reset send gap without moving it on denied requests", async () => {
    const key = rateKey();
    expect((await rates.consume(key, 3, 900, 60)).allowed).toBe(true);
    expect((await rates.consume(key, 3, 900, 60)).allowed).toBe(false);
    const [row] = await withServiceContext(db, (tx) => tx.select().from(authRateLimits).where(eq(authRateLimits.key, key)));
    expect(row!.hits).toBe(1);
  });

  it("shares the fixed-window quota between independent API storage processes", async () => {
    const key = rateKey();
    const script = `
      const { Pool } = require('pg');
      const { createDatabase } = require('./src/database/drizzle');
      const { AuthRateLimitRepository } = require('./src/modules/identity/infrastructure/auth-rate-limit.repository');
      const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 2 });
      (async () => {
        try {
          const repository = new AuthRateLimitRepository(createDatabase(pool));
          const attempts = await Promise.all(Array.from({ length: 8 }, () => repository.consume(process.argv[1], 10, 900)));
          console.log(attempts.filter(attempt => attempt.allowed).length);
        } finally { await pool.end(); }
      })().catch(error => { console.error(error); process.exitCode = 1; });`;
    const run = () => promisify(execFile)(process.execPath,
      ["-r", "ts-node/register/transpile-only", "-e", script, key], {
        cwd: process.cwd(), timeout: 20_000, maxBuffer: 16_384,
        env: { NODE_ENV: "test", HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
          TEST_DATABASE_URL: pool.options.connectionString },
      });
    const results = await Promise.all([run(), run()]);
    expect(results.reduce((total, result) => total + Number(result.stdout.trim()), 0)).toBe(10);
    expect((await rates.consume(key, 10, 900)).allowed).toBe(false);
  });

  it("keeps HMAC counters invisible to ordinary user context and purges expired windows", async () => {
    const policy = await pool.query<{ relforcerowsecurity: boolean }>("select relforcerowsecurity from pg_class where oid = 'auth_rate_limits'::regclass");
    expect(policy.rows[0]!.relforcerowsecurity).toBe(true);
    const key = rateKey(); await rates.consume(key, 3, 900);
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("set local role auth_security_probe");
      await client.query("select set_config('app.user_id', $1, true), set_config('app.role', '', true)", [randomUUID()]);
      expect((await client.query("select key from auth_rate_limits where key = $1", [key])).rows).toEqual([]);
      await client.query("select set_config('app.role', 'SERVICE', true)");
      expect((await client.query("select key from auth_rate_limits where key = $1", [key])).rows).toHaveLength(1);
    } finally {
      await client.query("rollback"); client.release();
    }
    await withServiceContext(db, (tx) => tx.update(authRateLimits).set({ expiresAt: new Date(0) }).where(eq(authRateLimits.key, key)));
    await rates.purgeExpired();
    expect(await withServiceContext(db, (tx) => tx.select().from(authRateLimits).where(eq(authRateLimits.key, key)))).toEqual([]);
  });

  it("rejects an old session for email changes and self-erasure even after refresh", async () => {
    const user = await account();
    await withServiceContext(db, (tx) => tx.update(authSessions).set({ createdAt: new Date(Date.now() - 601_000) }).where(eq(authSessions.id, user.sid)));
    await sessions.rotate(user.refresh.tokenHash, { tokenHash: hashToken(randomUUID()), expiresAt: new Date(Date.now() + 86400_000) });
    await expect(accounts.updateSelf(user.id, { email: `new-${user.email}` }, { sessionId: user.sid, seconds: 600 }))
      .rejects.toMatchObject({ code: "AUTH_REAUTHENTICATION_REQUIRED", httpStatus: 403 });
    await expect(accounts.beginAccountErasure(user.id, { sessionId: user.sid, seconds: 600 }))
      .rejects.toMatchObject({ code: "AUTH_REAUTHENTICATION_REQUIRED" });
    expect((await accounts.findByIdService(user.id))!.email).toBe(user.email);
  });

  it("atomically changes email, clears verification, invalidates both links and revokes every session", async () => {
    const user = await account();
    const second = randomUUID();
    await sessions.create(user.id, second, { tokenHash: hashToken(randomUUID()), expiresAt: new Date(Date.now() + 86400_000) });
    const verify = hashToken(randomUUID()); const reset = hashToken(randomUUID());
    for (const [type, tokenHash] of [["VERIFY_EMAIL", verify], ["RESET_PASSWORD", reset]] as const) {
      await emails.create({ userId: user.id, type, tokenHash, expiresAt: new Date(Date.now() + 600_000) }, user.email, async () => undefined);
    }
    await accounts.updateSelf(user.id, { email: `new-${user.email}` }, { sessionId: user.sid, seconds: 600 });
    expect(await emails.verify(verify)).toEqual({ status: "invalid" });
    expect(await sessions.resetPassword(reset, "new-hash")).toBe("invalid");
    expect(await sessions.findActive(user.sid)).toBeNull();
    expect(await sessions.findActive(second)).toBeNull();
    expect((await accounts.findByIdService(user.id))!.emailVerifiedAt).toBeNull();
    await expect(accounts.beginAccountErasure(user.id, { sessionId: user.sid, seconds: 600 }))
      .rejects.toMatchObject({ code: "AUTH_REAUTHENTICATION_REQUIRED" });
  });

  it("does not issue a stale-recipient link or session after a concurrent address change", async () => {
    const user = await account();
    await accounts.updateSelf(user.id, { email: `new-${user.email}` }, { sessionId: user.sid, seconds: 600 });
    const enqueue = vi.fn(async () => undefined);
    expect(await emails.create({ userId: user.id, type: "RESET_PASSWORD", tokenHash: hashToken(randomUUID()),
      expiresAt: new Date(Date.now() + 600_000) }, user.email, enqueue)).toBeUndefined();
    expect(enqueue).not.toHaveBeenCalled();
    expect(await sessions.create(user.id, randomUUID(), { tokenHash: hashToken(randomUUID()),
      expiresAt: new Date(Date.now() + 600_000) }, "old-hash", user.email)).toBeNull();
  });

  it("serializes verification against an address change and rolls token creation back when enqueue fails", async () => {
    const user = await account(); const tokenHash = hashToken(randomUUID());
    await emails.create({ userId: user.id, type: "VERIFY_EMAIL", tokenHash, expiresAt: new Date(Date.now() + 600_000) }, user.email, async () => undefined);
    await Promise.all([emails.verify(tokenHash), accounts.updateSelf(user.id, { email: `new-${user.email}` }, { sessionId: user.sid, seconds: 600 })]);
    expect((await accounts.findByIdService(user.id))!.emailVerifiedAt).toBeNull();
    const failedHash = hashToken(randomUUID());
    await expect(emails.create({ userId: user.id, type: "RESET_PASSWORD", tokenHash: failedHash,
      expiresAt: new Date(Date.now() + 600_000) }, `new-${user.email}`, async () => { throw new Error("queue failed"); })).rejects.toThrow("queue failed");
    expect(await emails.inspectReset(failedHash)).toBe("invalid");
    expect(await emails.canDeliver(tokenHash, user.email)).toBe(false);
  });

  it.each([true, false])("serializes password reset against address change (reset first: %s)", async (resetFirst) => {
    const user = await account(); const tokenHash = hashToken(randomUUID());
    await emails.create({ userId: user.id, type: "RESET_PASSWORD", tokenHash,
      expiresAt: new Date(Date.now() + 600_000) }, user.email, async () => undefined);
    const reset = () => sessions.resetPassword(tokenHash, "new-password-hash");
    const change = () => accounts.updateSelf(user.id, { email: `new-${user.email}` }, { sessionId: user.sid, seconds: 600 });
    const operations = resetFirst ? [reset(), change()] : [change(), reset()];
    await Promise.allSettled(operations);
    const current = (await accounts.findByIdService(user.id))!;
    if (current.email === `new-${user.email}`) {
      expect(current.passwordHash).toBe("old-hash");
      expect(await sessions.resetPassword(tokenHash, "late-password")).toBe("invalid");
    } else {
      expect(current.email).toBe(user.email);
      expect(current.passwordHash).toBe("new-password-hash");
      expect(await sessions.findActive(user.sid)).toBeNull();
    }
  });
});
