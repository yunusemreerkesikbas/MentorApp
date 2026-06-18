import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../config/env.validation";
import { FakeStorageAdapter } from "../adapters/storage/fake-storage.adapter";
import { R2StorageAdapter } from "../adapters/storage/r2-storage.adapter";
import { STORAGE_PORT } from "../ports/storage.port";
import { FakeStorageController } from "./fake-storage.controller";

/**
 * Object storage (§8) — fake in dev/test, R2 in production when configured.
 */
@Global()
@Module({
  controllers: [FakeStorageController],
  providers: [
    FakeStorageAdapter,
    R2StorageAdapter,
    {
      provide: STORAGE_PORT,
      inject: [ConfigService, FakeStorageAdapter, R2StorageAdapter],
      useFactory: (
        config: ConfigService<Env, true>,
        fake: FakeStorageAdapter,
        r2: R2StorageAdapter,
      ) => (config.get("STORAGE_PROVIDER", { infer: true }) === "r2" ? r2 : fake),
    },
  ],
  exports: [STORAGE_PORT, FakeStorageAdapter],
})
export class StorageModule {}
