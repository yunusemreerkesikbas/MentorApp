import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import type { Env } from "../src/config/env.validation";
import { ConfigRepository } from "../src/common/config/config.repository";
import { ConfigRegistryService } from "../src/common/config/config-registry.service";
import { createDatabase, createPool } from "../src/database/drizzle";
import { assertRuntimeDatabaseRole } from "../src/database/database-role-safety";
import { r2ClientOptions } from "../src/shared/adapters/storage/r2-client-options";
import { StorageBudgetRepository } from "../src/shared/storage/storage-budget.repository";
import { StorageBudgetService } from "../src/shared/storage/storage-budget.service";
import { initializeTrialStorage } from "../src/shared/storage/storage-budget-initializer";
import { parseStorageInitializationArgs, parseStorageInitializationInput } from "../src/shared/storage/storage-initialization-input";

/** Trusted attended operator only: two precharged, finite empty-bucket probes; no AppModule. */
async function main(): Promise<void> {
  const args = parseStorageInitializationArgs(process.argv.slice(2));
  const input = parseStorageInitializationInput(parse(readFileSync(args.envFile,"utf8")),args);
  const pool = createPool(input.connectionString);
  const client = new S3Client(r2ClientOptions({...input.scope,accessKeyId:input.accessKeyId,secretAccessKey:input.secretAccessKey,mode:"bounded"}));
  try {
    await assertRuntimeDatabaseRole(pool,"production");
    const db = createDatabase(pool);
    const repository = new StorageBudgetRepository(db);
    const env = new ConfigService<Env,true>({NODE_ENV:"production",APP_ENV:"production",AI_PROVIDER:"disabled"});
    const registry = new ConfigRegistryService(new ConfigRepository(db),new EventEmitter2(),env);
    const budget = new StorageBudgetService(repository,registry);
    if (args.abandon) {
      await budget.blockInitialization(args.abandon);
      process.stdout.write(JSON.stringify({initializationId:args.abandon,status:"BLOCKED",usageRefunded:false})+"\n");
      return;
    }
    const id = await initializeTrialStorage(budget,input.scope,async bucket => {
      const result = await client.send(new ListObjectsV2Command({Bucket:bucket,MaxKeys:1}),{abortSignal:AbortSignal.timeout(15000)});
      return {statusCode:result.$metadata.httpStatusCode,keyCount:result.KeyCount,objectCount:result.Contents?.length ?? 0,
        truncated:result.IsTruncated === true || Boolean(result.NextContinuationToken)};
    },initializationId => process.stdout.write(JSON.stringify({initializationId,status:"VERIFYING",reservedClassA:2})+"\n"));
    process.stdout.write(JSON.stringify({initializationId:id,status:"READY",automaticRefill:false})+"\n");
  } finally { client.destroy(); await pool.end(); }
}

if (require.main === module) void main().catch(() => {
  process.stderr.write("Storage initialization failed. Inspect the recorded attempt before retrying.\n");
  process.exitCode = 1;
});
