import { Controller, Get } from "@nestjs/common";
import { HealthCheck, HealthCheckService } from "@nestjs/terminus";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../common/auth/public.decorator";
import { DbHealthIndicator } from "./db.health";

@ApiTags("health")
@Public()
@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: DbHealthIndicator,
  ) {}

  /** Liveness — process is up. No external dependencies (always 200 if the process runs). */
  @Get()
  liveness(): { status: string; service: string; ts: string } {
    return { status: "ok", service: "mentor-api", ts: new Date().toISOString() };
  }

  /** Readiness — can serve traffic? Includes a DB ping → 503 if the DB is unreachable. */
  @Get("ready")
  @HealthCheck()
  readiness() {
    return this.health.check([() => this.db.ping("database")]);
  }
}
