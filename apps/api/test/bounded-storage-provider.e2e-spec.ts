import { createHash, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { createDatabase } from "../src/database/drizzle";
import { RAW_STORAGE_PORT, STORAGE_PORT, type ObjectStoragePort, type StoragePort } from "../src/shared/ports/storage.port";
import { MediaReadGrantService } from "../src/shared/storage/media-read-grant.service";
import { FakeStorageAdapter } from "../src/shared/adapters/storage/fake-storage.adapter";
import { StorageBudgetRepository } from "../src/shared/storage/storage-budget.repository";
import { JobRunnerService } from "../src/modules/notifications/application/job-runner.service";
import { SubjectSeedService } from "../src/modules/content/infrastructure/subject-seed.service";
import { assertLocalTestDatabase } from "./database-target";

describe("actual bounded storage provider selection", () => {
  let app: INestApplication;
  let admin: Pool;
  const key = `notebook/${randomUUID()}/${randomUUID()}.png`;
  const envKeys = ["DATABASE_URL", "STORAGE_ACCESS_MODE", "MEDIA_READ_SECRET", "R2_PUBLIC_BASE_URL", "R2_ACCOUNT_ID", "R2_PUBLIC_BUCKET", "R2_PRIVATE_BUCKET", "R2_JURISDICTION", "ADMIN_ACCESS_MODE"];
  const previous = new Map<string, string | undefined>();
  const tables = ["storage_budget_state", "storage_reservations", "storage_object_manifest"] as const;
  const snapshots = new Map<string, Record<string, unknown>[]>();

  beforeAll(async () => {
    const target = process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_storage_budget_test";
    assertLocalTestDatabase(target);
    for (const name of envKeys) previous.set(name, process.env[name]);
    Object.assign(process.env, { DATABASE_URL: target, STORAGE_ACCESS_MODE: "bounded",
      MEDIA_READ_SECRET: "test-media-secret-00000000000000000000",
      R2_PUBLIC_BASE_URL: "https://api.example.invalid/v1/storage/media/public",
      R2_ACCOUNT_ID: "fixture-account", R2_PUBLIC_BUCKET: "fixture-public", R2_PRIVATE_BUCKET: "fixture-private",
      R2_JURISDICTION: "eu", ADMIN_ACCESS_MODE: "disabled" });
    admin = new Pool({ connectionString: target });
    for (const table of tables) snapshots.set(table, (await admin.query<Record<string, unknown>>(`select * from ${table}`)).rows);
    await admin.query(`truncate ${tables.join(",")}`);
    const fingerprint = createHash("sha256").update(JSON.stringify([
      "storage-budget-v1", "fixture-account", "fixture-public", "fixture-private", "eu",
    ])).digest("hex");
    await admin.query("insert into storage_budget_state (id,status,scope_fingerprint,transfer_bytes) values (1,'READY',$1,0)", [fingerprint]);
    const repository = new StorageBudgetRepository(createDatabase(admin));
    await repository.settle((await repository.reserve({ kind: "put", key, bytes: 1, contentType: "image/png" },
      { storedBytes: 524288000, classA: 10000, classB: 100000, transferBytes: 1073741824 })).id, "succeeded");
    await admin.query("update storage_budget_state set class_b=100000 where id=1");
    const { AppModule } = await import("../src/app.module");
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(JobRunnerService)
      .useValue({ registerHandler: vi.fn(), processBatch: vi.fn() })
      .overrideProvider(SubjectSeedService).useValue({ onModuleInit: vi.fn() }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    if (admin && snapshots.size === tables.length) {
      await admin.query(`truncate ${tables.join(",")}`);
      for (const table of tables) for (const row of snapshots.get(table) ?? []) {
        const columns = Object.keys(row);
        await admin.query(`insert into ${table} (${columns.join(",")}) values (${columns.map((_, n) => `$${n + 1}`).join(",")})`, Object.values(row));
      }
    }
    await admin?.end();
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
    vi.restoreAllMocks();
  });

  it("selects the guard before an actual raw backend method", async () => {
    const backend = app.get(FakeStorageAdapter);
    const read = vi.spyOn(backend, "readObject");
    await expect(app.get<ObjectStoragePort>(RAW_STORAGE_PORT).readObject(key, 5242880))
      .rejects.toMatchObject({ code: "STORAGE_TEMPORARILY_UNAVAILABLE", httpStatus: 503 });
    expect(read).not.toHaveBeenCalled();
  });
  it("mints gateway URLs at exhausted capacity without consulting its raw provider",async () => {
    const actor={userId:key.split("/")[1]!,sessionId:randomUUID()};
    const storage=app.get<StoragePort>(STORAGE_PORT); const backend=app.get(FakeStorageAdapter);
    const direct=vi.spyOn(backend,"createReadUrl"); const publicDirect=vi.spyOn(backend,"getPublicUrl");
    const url=await storage.getPrivateUrl(key,actor);
    expect(new URL(url).pathname).toBe("/v1/storage/media/private");
    expect(app.get(MediaReadGrantService).verify(new URL(url).searchParams.get("grant")!)).toMatchObject({...actor,key});
    expect(storage.getPublicUrl(`avatars/${actor.userId}/photo.png`)).toContain("/v1/storage/media/public/avatars/");
    expect(direct).not.toHaveBeenCalled(); expect(publicDirect).not.toHaveBeenCalled();
  });
});
