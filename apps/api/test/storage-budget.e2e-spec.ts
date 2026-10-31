import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "../src/database/drizzle";
import { StorageBudgetRepository } from "../src/shared/storage/storage-budget.repository";
import type { StorageUsageLimits } from "../src/shared/storage/storage-budget.types";
import { assertLocalTestDatabase } from "./database-target";
import { storageScopeFingerprint } from "../src/shared/storage/storage-scope";
import type { StorageScope } from "../src/shared/storage/storage-budget.types";

const limits: StorageUsageLimits = { storedBytes: 524288000, classA: 10000, classB: 100000, transferBytes: 1073741824 };
const unavailable = { code: "STORAGE_TEMPORARILY_UNAVAILABLE", httpStatus: 503 };
const key = () => `notebook/${randomUUID()}/${randomUUID()}.png`;
const put = (bytes = 1) => ({ kind: "put" as const, key: key(), bytes, contentType: "image/png" });
const scope: StorageScope = { accountId: "fixture-account", publicBucket: "fixture-public", privateBucket: "fixture-private", jurisdiction: "eu" };
const tables = ["storage_budget_state", "storage_reservations", "storage_object_manifest"] as const;

describe("durable trial storage allowance", () => {
  let admin: Pool;
  let probe: Pool;
  let repository: StorageBudgetRepository;
  const snapshots = new Map<string, Record<string, unknown>[]>();
  let target = "";

  beforeAll(async () => {
    target = process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_storage_budget_test";
    assertLocalTestDatabase(target);
    admin = new Pool({ connectionString: target, max: 4 });
    repository = new StorageBudgetRepository(createDatabase(admin));
    for (const table of tables) snapshots.set(table, (await admin.query(`select * from ${table}`)).rows);
    await admin.query(`do $$ begin create role storage_budget_probe login password 'storage_budget_probe'
      nosuperuser nobypassrls; exception when duplicate_object then null; end $$`);
    await admin.query("grant usage on schema public to storage_budget_probe");
    await admin.query(`grant select, insert, update, delete on ${tables.join(",")} to storage_budget_probe`);
    const url = new URL(target);
    url.username = "storage_budget_probe";
    url.password = "storage_budget_probe";
    probe = new Pool({ connectionString: url.toString() });
  });

  beforeEach(async () => {
    await admin.query(`truncate ${tables.join(",")}`);
    await admin.query("insert into storage_budget_state (id,status,scope_fingerprint,transfer_bytes) values (1,'READY',$1,0)", ["0".repeat(64)]);
  });

  afterAll(async () => {
    if (admin && snapshots.size === tables.length) {
      await admin.query(`truncate ${tables.join(",")}`);
      for (const table of tables) for (const row of snapshots.get(table) ?? []) {
        const columns = Object.keys(row);
        await admin.query(`insert into ${table} (${columns.join(",")}) values (${columns.map((_, n) => `$${n + 1}`).join(",")})`, Object.values(row));
      }
    }
    await probe?.end();
    await admin?.end();
  });

  const usage = async () => (await admin.query<{ stored_bytes: string; class_a: number; class_b: number; transfer_bytes: string|null }>(
    "select stored_bytes,class_a,class_b,transfer_bytes from storage_budget_state where id=1",
  )).rows[0]!;

  it("reserves the final Class A slot for only one concurrent operation", async () => {
    await admin.query("update storage_budget_state set class_a=9999 where id=1");
    const results = await Promise.allSettled([repository.reserve(put(), limits), repository.reserve(put(), limits)]);
    expect(results.filter(x => x.status === "fulfilled")).toHaveLength(1);
    expect(results.find(x => x.status === "rejected")).toMatchObject({ reason: unavailable });
    expect((await usage()).class_a).toBe(10000);
  });

  it("allows the exact byte ceiling and refuses the next byte", async () => {
    await admin.query("update storage_budget_state set stored_bytes=524287999 where id=1");
    await repository.reserve(put(), limits);
    await expect(repository.reserve(put(), limits)).rejects.toMatchObject(unavailable);
    expect(Number((await usage()).stored_bytes)).toBe(524288000);
  });

  it("charges both bounded HEAD and GET before they can run", async () => {
    const object = put();
    await repository.settle((await repository.reserve(object, limits)).id, "succeeded");
    await admin.query("update storage_budget_state set class_b=99999 where id=1");
    await expect(repository.reserve({ kind: "read", key: object.key, maxBytes: 10 }, limits)).rejects.toMatchObject(unavailable);
    await repository.reserve({ kind: "read", key: object.key }, limits);
    await expect(repository.reserve({ kind: "read", key: object.key }, limits)).rejects.toMatchObject(unavailable);
    expect((await usage()).class_b).toBe(100000);
  });

  it("retains reservations across a new repository and connection pool", async () => {
    await repository.reserve(put(10), limits);
    const restarted = new Pool({ connectionString: target });
    try {
      const second = new StorageBudgetRepository(createDatabase(restarted));
      await expect(second.reserve(put(), { ...limits, storedBytes: 10 })).rejects.toMatchObject(unavailable);
      expect(Number((await usage()).stored_bytes)).toBe(10);
    } finally { await restarted.end(); }
  });

  it("never refunds used operations and settles confirmed deletion once", async () => {
    const object = put(10);
    const write = await repository.reserve(object, limits);
    await repository.settle(write.id, "succeeded");
    const deletion = await repository.reserve({ kind: "delete", key: object.key }, { ...limits, classA: 1 });
    await repository.settle(deletion.id, "succeeded");
    await repository.settle(deletion.id, "succeeded");
    expect(Number((await usage()).stored_bytes)).toBe(0);
    expect((await usage()).class_a).toBe(1);
  });

  it("retains uncertain PUT bytes after a cleanup DELETE acknowledgement", async () => {
    const object = put(10);
    await repository.settle((await repository.reserve(object, limits)).id, "uncertain");
    const deletion = await repository.reserve({ kind: "delete", key: object.key }, limits);
    await repository.settle(deletion.id, "succeeded");
    await expect(repository.reserve(put(), { ...limits, storedBytes: 10 })).rejects.toMatchObject(unavailable);
    expect(Number((await usage()).stored_bytes)).toBe(10);
  });

  it("keeps bytes charged when a pending PUT finishes after DELETE", async () => {
    const object = put(10);
    const write = await repository.reserve(object, limits);
    const deletion = await repository.reserve({ kind: "delete", key: object.key }, limits);
    await repository.settle(deletion.id, "succeeded");
    await repository.settle(write.id, "succeeded");
    expect(Number((await usage()).stored_bytes)).toBe(10);
    expect((await repository.manifest(object.key))?.state).toBe("uncertain");
  });

  it("copies only a confirmed known object's bytes and never overwrites a key", async () => {
    const source = put(10);
    await repository.settle((await repository.reserve(source, limits)).id, "succeeded");
    const destination = key();
    const copy = await repository.reserve({ kind: "copy", sourceKey: source.key, key: destination }, limits);
    expect(copy.reservedBytes).toBe(10);
    await repository.settle(copy.id, "succeeded");
    await expect(repository.reserve({ ...source, key: destination }, limits)).rejects.toMatchObject(unavailable);
    await expect(repository.reserve({ kind: "copy", sourceKey: key(), key: key() }, limits)).rejects.toMatchObject(unavailable);
    expect(Number((await usage()).stored_bytes)).toBe(20);
  });

  it("fails closed without a ready singleton or known read object", async () => {
    await expect(repository.reserve({ kind: "read", key: key() }, limits)).rejects.toMatchObject(unavailable);
    await admin.query("update storage_budget_state set status='UNINITIALIZED' where id=1");
    await expect(repository.reserve(put(), limits)).rejects.toMatchObject(unavailable);
    await admin.query("delete from storage_budget_state");
    await expect(repository.reserve(put(), limits)).rejects.toMatchObject(unavailable);
  });

  it("hides the budget, manifests and reservations from ordinary users", async () => {
    await repository.reserve(put(), limits);
    const client = await probe.connect();
    try {
      await client.query("begin");
      await client.query("select set_config('app.user_id',$1,true)", [randomUUID()]);
      for (const table of tables) expect((await client.query(`select * from ${table}`)).rows).toEqual([]);
      await expect(client.query("insert into storage_reservations (id,kind) values ($1,'read')", [randomUUID()])).rejects.toMatchObject({ code: "42501" });
    } finally { await client.query("rollback"); client.release(); }
  });

  it("seals a ready scope against direct rollback and bucket changes", async () => {
    await expect(repository.assertScope("bounded", "0".repeat(64))).resolves.toBeUndefined();
    await expect(repository.assertScope("direct")).rejects.toMatchObject(unavailable);
    await expect(repository.assertScope("bounded", "1".repeat(64))).rejects.toMatchObject(unavailable);
  });

  it("charges exact media payload for writes and each read, without refilling on deletion",async () => {
    const allowance={...limits,transferBytes:8};const object=put(3);
    const write=await repository.reserve(object,allowance);
    expect(write).toMatchObject({reservedTransferBytes:3});await repository.settle(write.id,"succeeded");
    const read=await repository.reserve({kind:"read",key:object.key,maxBytes:3},allowance);
    expect(read).toMatchObject({reservedTransferBytes:3});await repository.settle(read.id,"succeeded");
    const deletion=await repository.reserve({kind:"delete",key:object.key},allowance);await repository.settle(deletion.id,"succeeded");
    await expect(repository.reserve(put(3),allowance)).rejects.toMatchObject(unavailable);
    expect(Number((await usage()).stored_bytes)).toBe(0);
  });
  it("serializes the last transfer bytes across two readers and persists after restart",async () => {
    const allowance={...limits,transferBytes:6};const object=put(3);
    await repository.settle((await repository.reserve(object,allowance)).id,"succeeded");
    const restarted=new Pool({connectionString:target});
    try {
      const second=new StorageBudgetRepository(createDatabase(restarted));
      const requests=await Promise.allSettled([
        repository.reserve({kind:"read",key:object.key},allowance),second.reserve({kind:"read",key:object.key},allowance),
      ]);
      expect(requests.filter(request=>request.status==="fulfilled")).toHaveLength(1);
      await expect(second.reserve(put(),allowance)).rejects.toMatchObject(unavailable);
    } finally {await restarted.end();}
  });
  it("keeps uncertain transfer charged after an acknowledged cleanup",async () => {
    const allowance={...limits,transferBytes:6};const object=put(3);
    await repository.settle((await repository.reserve(object,allowance)).id,"uncertain");
    const deletion=await repository.reserve({kind:"delete",key:object.key},allowance);await repository.settle(deletion.id,"succeeded");
    await expect(repository.reserve(put(4),allowance)).rejects.toMatchObject(unavailable);
  });
  it("does not charge object payload for server-side copy, list or delete",async () => {
    const object=put(3);const write=await repository.reserve(object,{...limits,transferBytes:3});await repository.settle(write.id,"succeeded");
    const copy=await repository.reserve({kind:"copy",sourceKey:object.key,key:key()},{...limits,transferBytes:3});
    const listing=await repository.reserve({kind:"list",prefix:"notebook/",limit:1},{...limits,transferBytes:3});
    const deletion=await repository.reserve({kind:"delete",key:object.key},{...limits,transferBytes:3});
    for(const reservation of [copy,listing,deletion])expect(reservation).toMatchObject({reservedTransferBytes:0});
  });
  it("refuses a previously used scope with unknown historical transfer usage",async () => {
    await admin.query("update storage_budget_state set transfer_bytes=null where id=1");
    await expect(repository.assertScope("bounded","0".repeat(64))).rejects.toMatchObject(unavailable);
    await expect(repository.reserve(put(),limits)).rejects.toMatchObject(unavailable);
    await admin.query("update storage_budget_state set status='BLOCKED',scope_fingerprint=$1 where id=1",[storageScopeFingerprint(scope)]);
    await expect(repository.beginInitialization(scope,limits)).rejects.toMatchObject(unavailable);
  });
  it("initializes zero transfer only for a provably untouched unbound state",async () => {
    await admin.query("update storage_budget_state set status='UNINITIALIZED',scope_fingerprint=null,transfer_bytes=null where id=1");
    await repository.beginInitialization(scope,limits);
    expect(Number((await usage()).transfer_bytes)).toBe(0);
  });

  it("permits existing direct deployments only before a scope is bound", async () => {
    await admin.query("update storage_budget_state set status='UNINITIALIZED',scope_fingerprint=null where id=1");
    await expect(repository.assertScope("direct")).resolves.toBeUndefined();
    await expect(repository.assertScope("bounded", storageScopeFingerprint(scope))).rejects.toMatchObject(unavailable);
  });

  it("preserves legacy direct databases without budget tables but refuses bounded mode", async () => {
    await admin.query("alter table storage_budget_state rename to storage_budget_state_probe");
    try {
      await expect(repository.assertScope("direct")).resolves.toBeUndefined();
      await expect(repository.assertScope("bounded", "0".repeat(64))).rejects.toMatchObject(unavailable);
    } finally { await admin.query("alter table storage_budget_state_probe rename to storage_budget_state"); }
  });

  it("reserves two initialization probes before allowing a ready transition", async () => {
    await admin.query("update storage_budget_state set status='UNINITIALIZED',scope_fingerprint=null where id=1");
    const init = await repository.beginInitialization(scope, limits);
    expect((await usage()).class_a).toBe(2);
    await expect(repository.markReady(init.id)).rejects.toMatchObject(unavailable);
    await repository.settle(init.probeReservations[0].id, "succeeded");
    await repository.settle(init.probeReservations[1].id, "succeeded");
    await repository.markReady(init.id);
    await expect(repository.assertScope("bounded", storageScopeFingerprint(scope))).resolves.toBeUndefined();
    await expect(repository.beginInitialization(scope, limits)).rejects.toMatchObject(unavailable);
    expect((await usage()).class_a).toBe(2);
  });

  it("cannot finish an abandoned initialization after a newer attempt", async () => {
    await admin.query("update storage_budget_state set status='UNINITIALIZED',scope_fingerprint=null where id=1");
    const first = await repository.beginInitialization(scope, limits);
    await repository.blockInitialization(first.id);
    await expect(repository.assertScope("direct")).rejects.toMatchObject(unavailable);
    await expect(repository.beginInitialization({ ...scope, privateBucket: "different" }, limits)).rejects.toMatchObject(unavailable);
    const second = await repository.beginInitialization(scope, limits);
    for (const reservation of first.probeReservations) await repository.settle(reservation.id, "succeeded");
    await expect(repository.markReady(first.id)).rejects.toMatchObject(unavailable);
    for (const reservation of second.probeReservations) await repository.settle(reservation.id, "succeeded");
    await repository.markReady(second.id);
    expect((await usage()).class_a).toBe(4);
  });

  it("permits only one concurrent operator initialization", async () => {
    await admin.query("update storage_budget_state set status='UNINITIALIZED',scope_fingerprint=null where id=1");
    const attempts = await Promise.allSettled([repository.beginInitialization(scope, limits), repository.beginInitialization(scope, limits)]);
    expect(attempts.filter(x => x.status === "fulfilled")).toHaveLength(1);
    expect((await usage()).class_a).toBe(2);
  });
});
