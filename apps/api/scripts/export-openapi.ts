/**
 * Exports the OpenAPI spec to packages/api-client/openapi.json (orval codegen input).
 * Boots the Nest app WITHOUT listening; the pg Pool connects lazily, so no DB is needed.
 * Usage: pnpm --filter @mentor/api openapi:export
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule, type OpenAPIObject, type ParameterObject } from "@nestjs/swagger";
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
  addMissingPathParameters(document);

  const out = resolve(__dirname, "../../../packages/api-client/openapi.json");
  writeFileSync(out, JSON.stringify(document, null, 2));
  await app.close();
  // eslint-disable-next-line no-console
  console.log(`OpenAPI spec → ${out}`);
}

/**
 * Nest cannot infer path parameters when a controller binds the complete
 * params DTO with `@Param()`. Keep the exported contract valid for clients
 * without forcing every such controller to duplicate its Zod DTO metadata.
 */
function addMissingPathParameters(document: OpenAPIObject): void {
  const methods = ["get", "post", "put", "patch", "delete", "options", "head"] as const;
  for (const [path, item] of Object.entries(document.paths)) {
    if (!item) continue;
    const names = [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
    for (const method of methods) {
      const operation = item[method];
      if (!operation) continue;
      const parameters = operation.parameters ?? [];
      for (const name of names) {
        const declared = parameters.some(
          (parameter) => "name" in parameter && parameter.name === name && parameter.in === "path",
        );
        if (!declared) {
          parameters.push({ name, in: "path", required: true, schema: { type: "string" } } satisfies ParameterObject);
        }
      }
      operation.parameters = parameters;
    }
  }
}

void main();
