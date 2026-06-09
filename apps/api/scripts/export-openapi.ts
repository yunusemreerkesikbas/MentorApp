/**
 * Exports the OpenAPI spec to packages/api-client/openapi.json (orval codegen input).
 * Boots the Nest app WITHOUT listening; the pg Pool connects lazily, so no DB is needed.
 * Usage: pnpm --filter @mentor/api openapi:export
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "../src/app.module";

async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix("v1");

  const config = new DocumentBuilder()
    .setTitle("Mentor API")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);

  const out = resolve(__dirname, "../../../packages/api-client/openapi.json");
  writeFileSync(out, JSON.stringify(document, null, 2));
  await app.close();
  // eslint-disable-next-line no-console
  console.log(`OpenAPI spec → ${out}`);
}

void main();
