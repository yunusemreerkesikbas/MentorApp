import { Global, Module } from "@nestjs/common";
import { ConfigRegistryService } from "./config-registry.service";
import { ConfigRepository } from "./config.repository";

/**
 * Global config registry (§9). Any module can inject `ConfigRegistryService` to READ tunables /
 * feature flags without importing this module; the admin module owns the editing endpoints.
 * Distinct from `@nestjs/config` (env vars) — this is runtime, admin-editable business config.
 */
@Global()
@Module({
  providers: [ConfigRegistryService, ConfigRepository],
  exports: [ConfigRegistryService],
})
export class ConfigRegistryModule {}
