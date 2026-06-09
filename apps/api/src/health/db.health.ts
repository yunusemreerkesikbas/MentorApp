import { Inject, Injectable } from "@nestjs/common";
import { HealthCheckError, type HealthIndicatorResult } from "@nestjs/terminus";
import type { Pool } from "pg";
import { PG_POOL } from "../database/database.constants";

/** Readiness probe for Postgres — a cheap `SELECT 1`. */
@Injectable()
export class DbHealthIndicator {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async ping(key = "database"): Promise<HealthIndicatorResult> {
    try {
      await this.pool.query("SELECT 1");
      return { [key]: { status: "up" } };
    } catch {
      // Detail logged by the caller/terminus; client only sees down (no leak).
      throw new HealthCheckError("Database ping failed", {
        [key]: { status: "down" },
      });
    }
  }
}
