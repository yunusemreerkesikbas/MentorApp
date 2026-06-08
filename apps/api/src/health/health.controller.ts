import { Controller, Get } from "@nestjs/common";

/** Liveness/boot check → GET /v1/health */
@Controller("health")
export class HealthController {
  @Get()
  check(): { status: string; service: string; ts: string } {
    return {
      status: "ok",
      service: "mentor-api",
      ts: new Date().toISOString(),
    };
  }
}
