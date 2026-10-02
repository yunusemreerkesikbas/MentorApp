import type { INestApplication } from "@nestjs/common";
import {
  SESSION_FOCUS_MINUTES_MIN,
  SESSION_FOCUS_MINUTES_MAX,
} from "@mentor/types";
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from "@nestjs/swagger";

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
  addStudyDurationProperties(document);
  SwaggerModule.setup("v1/docs", app, document, {
    jsonDocumentUrl: "v1/docs-json",
  });
}

/** Zod DTOs have no Swagger property metadata. Document this additive contract without
 * narrowing the existing open task bodies; validation remains owned by the shared Zod schemas. */
export function addStudyDurationProperties(document: OpenAPIObject): void {
  const schemas = document.components?.schemas ?? {};
  const duration = {
    type: "integer" as const,
    minimum: SESSION_FOCUS_MINUTES_MIN,
    maximum: SESSION_FOCUS_MINUTES_MAX,
    nullable: true,
  };
  for (const name of [
    "CreatePlanTaskDto",
    "UpdatePlanTaskDto",
    "CreateAnalysisPlanTaskDto",
    "CommunityCoachPlanTaskDto",
    "UpdateMentorshipAssignmentDto",
    "UpdateMentorshipAssignmentGroupDto",
  ]) {
    const schema = schemas[name];
    if (!schema || "$ref" in schema) continue;
    schema.additionalProperties = true;
    schema.properties = { ...schema.properties, durationMinutes: duration };
  }
  const session = schemas.StartStudySessionDto;
  if (session && !("$ref" in session)) {
    session.additionalProperties = true;
    session.properties = {
      ...session.properties,
      focusMinutes: { ...duration, nullable: false },
      preset: { type: "string", enum: ["25_5", "50_10", "custom", "stopwatch"] },
    };
  }
  for (const [name, property] of [
    ["BulkCreatePlanTasksDto", "tasks"],
    ["ApplyPlanAdaptationDto", "changes"],
    ["CreateMentorshipAssignmentDto", "tasks"],
  ] as const) {
    const schema = schemas[name];
    if (!schema || "$ref" in schema) continue;
    schema.additionalProperties = true;
    schema.properties = {
      ...schema.properties,
      [property]: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: true,
          properties: { durationMinutes: duration },
        },
      },
    };
  }
  const batch = schemas.CreateMentorshipBatchAssignmentDto;
  if (batch && !("$ref" in batch)) {
    batch.additionalProperties = true;
    batch.properties = {
      ...batch.properties,
      task: {
        type: "object",
        additionalProperties: true,
        properties: { durationMinutes: duration },
      },
    };
  }
}
