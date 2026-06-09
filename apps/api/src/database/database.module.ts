import { Global, Inject, Logger, Module, type OnApplicationShutdown } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Pool } from "pg";
import type { Env } from "../config/env.validation";
import { DRIZZLE, PG_POOL } from "./database.constants";
import { createDatabase, createPool } from "./drizzle";

/**
 * Global database module. Provides the `pg` Pool and the drizzle instance.
 *
 * Robustness:
 *  - Idle-client errors are logged, NOT crashed (pool emits 'error' for dropped backends,
 *    e.g. Neon autosuspend) → the pool transparently reconnects on the next query.
 *  - `onApplicationShutdown` drains the pool for a graceful SIGTERM.
 */
@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const url = config.get("DATABASE_URL", { infer: true });
        if (!url) {
          // Fail fast: the app cannot function without a database.
          throw new Error("DATABASE_URL is required but was not provided.");
        }
        const pool = createPool(url);
        const logger = new Logger("PgPool");
        pool.on("error", (err) => logger.error(`Idle client error: ${err.message}`));
        return pool;
      },
    },
    {
      provide: DRIZZLE,
      inject: [PG_POOL],
      useFactory: (pool: Pool) => createDatabase(pool),
    },
  ],
  exports: [DRIZZLE, PG_POOL],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
