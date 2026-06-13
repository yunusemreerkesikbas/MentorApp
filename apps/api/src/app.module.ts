import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_PIPE } from "@nestjs/core";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";
import { JwtAuthGuard } from "./common/auth/jwt-auth.guard";
import { RolesGuard } from "./common/auth/roles.guard";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { ConfigRegistryModule } from "./common/config/config.module";
import { ZodValidationPipe } from "./common/validation/zod-validation.pipe";
import { validateEnv } from "./config/env.validation";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./health/health.module";
import { AppI18nModule } from "./i18n/i18n.module";
import { AdminModule } from "./modules/admin/admin.module";
import { CoachingModule } from "./modules/coaching/coaching.module";
import { ContentModule } from "./modules/content/content.module";
import { EconomyModule } from "./modules/economy/economy.module";
import { IdentityModule } from "./modules/identity/identity.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { buildLoggerConfig } from "./observability/logger.config";

/**
 * Root module — modular monolith (§8).
 *
 * Base layer: config (validated env), structured logging (pino), i18n, database (pg Pool), health.
 * Global cross-cutting: Zod validation pipe, ApiError exception filter, JWT auth (skipped on
 * @Public routes), roles guard, throttling (per-route @Throttle on auth endpoints).
 *
 * Bounded-context feature modules are imported here as they are implemented (one line per track —
 * docs/workstreams.md).
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    LoggerModule.forRoot(buildLoggerConfig(process.env.NODE_ENV ?? "development")),
    // A named "default" throttler MUST exist or route-level @Throttle is silently a no-op
    // (verified empirically). Global limit is generous (normal traffic unaffected; the real
    // edge rate-limit is Cloudflare in prod); auth endpoints tighten it via @Throttle.
    ThrottlerModule.forRoot({ throttlers: [{ name: "default", ttl: 60_000, limit: 300 }] }),
    // Domain-event backbone (§8): modules talk via events, not each other's tables.
    EventEmitterModule.forRoot(),
    AppI18nModule,
    ConfigRegistryModule,
    DatabaseModule,
    HealthModule,
    AdminModule,
    CoachingModule,
    ContentModule,
    EconomyModule,
    IdentityModule,
    NotificationsModule,
    PaymentsModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
