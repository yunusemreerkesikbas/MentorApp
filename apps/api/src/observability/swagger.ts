import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

/**
 * OpenAPI at /v1/docs (UI) and /v1/docs-json (spec) — the basis for `@mentor/api-client` codegen (§8).
 */
export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle("Mentor API")
    .setDescription("Mentor backend — single API, versioned /v1.")
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("v1/docs", app, document, {
    jsonDocumentUrl: "v1/docs-json",
  });
}
