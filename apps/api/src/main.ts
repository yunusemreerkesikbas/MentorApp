// Sentry instrumentation must load before anything else.
import "./instrument";
import "reflect-metadata";

import { appendFileSync } from "node:fs";

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
import { FORUM_FILE_MAX_BYTES, FORUM_FILE_MIMES } from "@mentor/types";

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

function dbg(message: string, data: Record<string, unknown> = {}, hypothesisId = "F"): void {
  try {
    appendFileSync(
      "c:/Users/emreerkesikbas/Documents/MentorApp/debug-24f38f.log",
      `${JSON.stringify({
        sessionId: "24f38f",
        runId: "api-boot",
        hypothesisId,
        location: "apps/api/src/main.ts",
        message,
        data,
        timestamp: Date.now(),
      })}\n`,
    );
  } catch {
    /* debug ingest must not block boot */
  }
}

dbg("main loaded", { pid: process.pid });

async function bootstrap(): Promise<void> {
  dbg("NestFactory.create start");
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true, // buffer until pino logger is attached
  });
  dbg("NestFactory.create done");
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
    express.raw({
      type: ["image/jpeg", "image/png", "image/webp", ...FORUM_FILE_MIMES],
      limit: Math.max(PHOTO_MAX_BYTES, FORUM_FILE_MAX_BYTES),
    }),
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
  dbg("listen done", { port }, "I");
  app.get(Logger).log(`Mentor API → http://localhost:${port}/v1`);
}

void bootstrap().catch((err: unknown) => {
  const e = err instanceof Error ? err : new Error(String(err));
  dbg("bootstrap threw", { name: e.name, errMessage: e.message }, "G");
  throw err;
});
