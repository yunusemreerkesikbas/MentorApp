import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validateEnv } from "./config/env.validation";
import { HealthModule } from "./health/health.module";

/**
 * Root module — modular monolith (§8).
 *
 * The bounded-context modules (identity, coaching, ai, content, forum,
 * community, economy, payments, notifications, admin) live as skeletons under
 * src/modules/; each is imported here once implemented.
 * Modules never touch each other's tables → public interface / domain event.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    HealthModule,
  ],
})
export class AppModule {}
