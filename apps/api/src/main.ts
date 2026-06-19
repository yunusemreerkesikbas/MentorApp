// Sentry instrumentation must load before anything else.
import "./instrument";
import "reflect-metadata";

import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import type { Env } from "./config/env.validation";
import { setupSwagger } from "./observability/swagger";
import { PHOTO_MAX_BYTES } from "./modules/ai/domain/photo-classify.constants";

function corsOrigins(config: ConfigService<Env, true>): string[] {
  const raw = config.get("CORS_ORIGINS", { infer: true });
  if (raw) {
    return raw
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
  }
  const appUrl = config.get("APP_URL", { infer: true });
  // Dev defaults: web :3000, admin :3002.
  return Array.from(new Set([appUrl, "http://localhost:3000", "http://localhost:3002"]));
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true, // buffer until pino logger is attached
  });
  app.useLogger(app.get(Logger));

  const config: ConfigService<Env, true> = app.get(ConfigService);

  // Single API, versioned (§8): mobile can't be force-updated → /v1 backward-compatible.
  app.setGlobalPrefix("v1");

  // Security headers + CORS (unknown origins blocked) + body size limit (→ 413 on excess).
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: corsOrigins(config), credentials: true });
  app.use(
    "/v1/storage/fake-upload",
    express.raw({ type: ["image/jpeg", "image/png"], limit: PHOTO_MAX_BYTES }),
  );
  app.useBodyParser("json", {
    limit: "1mb",
    // Capture the raw body for webhook signature verification (payments).
    verify: (req: { rawBody?: Buffer }, _res: unknown, buf: Buffer) => {
      req.rawBody = buf;
    },
  });

  // OpenAPI at /v1/docs — non-production only (don't expose the API surface in prod).
  if (config.get("NODE_ENV", { infer: true }) !== "production") {
    setupSwagger(app);
  }

  // Graceful shutdown (SIGTERM): drains the DB pool via DatabaseModule.onApplicationShutdown.
  app.enableShutdownHooks();

  const port = config.get("PORT", { infer: true });
  await app.listen(port);
  app.get(Logger).log(`Mentor API → http://localhost:${port}/v1`);
}

void bootstrap();
