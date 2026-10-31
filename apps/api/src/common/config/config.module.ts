import { Global, Module } from "@nestjs/common";
import { ConfigRegistryService } from "./config-registry.service";
import { ConfigRepository } from "./config.repository";
import { SocialAccessPolicy } from "./social-access.policy";
import { AppAvailabilityService } from "./app-availability.service";
import { AppAvailabilityController } from "./app-availability.controller";

/**
 * Global config registry (§9). Any module can inject `ConfigRegistryService` to READ tunables /
 * feature flags without importing this module; the admin module owns the editing endpoints.
 * Distinct from `@nestjs/config` (env vars) — this is runtime, admin-editable business config.
 */
@Global()
@Module({
  controllers: [AppAvailabilityController],
  providers: [ConfigRegistryService, ConfigRepository, SocialAccessPolicy, AppAvailabilityService],
  exports: [ConfigRegistryService, SocialAccessPolicy],
})
export class ConfigRegistryModule {}
