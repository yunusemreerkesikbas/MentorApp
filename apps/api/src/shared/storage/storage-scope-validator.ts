import { Injectable, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../config/env.validation";
import { StorageBudgetRepository } from "./storage-budget.repository";
import { storageScopeFingerprint } from "./storage-scope";

@Injectable()
export class StorageScopeValidator implements OnModuleInit {
  constructor(private readonly config: ConfigService<Env, true>, private readonly budget: StorageBudgetRepository) {}

  async onModuleInit(): Promise<void> {
    const mode = this.config.get("STORAGE_ACCESS_MODE", { infer: true });
    if (mode === "direct") {
      if (this.config.get("STORAGE_PROVIDER", { infer: true }) === "r2") await this.budget.assertScope(mode);
      return;
    }
    // Cross-field startup validation makes this exact EU scope mandatory in bounded mode.
    const fingerprint = storageScopeFingerprint({
      accountId: this.config.get("R2_ACCOUNT_ID", { infer: true })!,
      publicBucket: this.config.get("R2_PUBLIC_BUCKET", { infer: true })!,
      privateBucket: this.config.get("R2_PRIVATE_BUCKET", { infer: true })!, jurisdiction: "eu",
    });
    await this.budget.assertScope(mode, fingerprint);
  }
}
