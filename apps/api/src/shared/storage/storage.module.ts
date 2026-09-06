import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../config/env.validation";
import { FakeStorageAdapter } from "../adapters/storage/fake-storage.adapter";
import { R2StorageAdapter } from "../adapters/storage/r2-storage.adapter";
import { RAW_STORAGE_PORT, STORAGE_PORT } from "../ports/storage.port";
import { FakeStorageController } from "./fake-storage.controller";
import { SecureStorageService } from "./secure-storage.service";
import { StorageCleanupService } from "./storage-cleanup.service";
import { UploadTicketController } from "./upload-ticket.controller";
import { UploadTicketRepository } from "./upload-ticket.repository";
import { UploadTicketService } from "./upload-ticket.service";

/**
 * Object storage (§8) — fake in dev/test, R2 in production when configured.
 */
@Global()
@Module({
  controllers: [FakeStorageController, UploadTicketController],
  providers: [
    FakeStorageAdapter,
    R2StorageAdapter,
    {
      provide: RAW_STORAGE_PORT,
      inject: [ConfigService, FakeStorageAdapter, R2StorageAdapter],
      useFactory: (
        config: ConfigService<Env, true>,
        fake: FakeStorageAdapter,
        r2: R2StorageAdapter,
      ) => (config.get("STORAGE_PROVIDER", { infer: true }) === "r2" ? r2 : fake),
    },
    UploadTicketRepository,
    UploadTicketService,
    StorageCleanupService,
    SecureStorageService,
    { provide: STORAGE_PORT, useExisting: SecureStorageService },
  ],
  exports: [STORAGE_PORT, RAW_STORAGE_PORT, FakeStorageAdapter],
})
export class StorageModule {}
