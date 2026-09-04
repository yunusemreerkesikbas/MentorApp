import { Body, Controller, Get, Post } from "@nestjs/common";
import { APP_FILTER, APP_PIPE } from "@nestjs/core";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import enErrors from "../src/i18n/locales/en/errors.json";
import trErrors from "../src/i18n/locales/tr/errors.json";
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter";
import { NotFoundError } from "../src/common/errors/domain-error";
import { createZodDto } from "../src/common/validation/zod-dto";
import { ZodValidationPipe } from "../src/common/validation/zod-validation.pipe";
import { AppI18nModule } from "../src/i18n/i18n.module";

class CreateThingDto extends createZodDto(z.object({ name: z.string().min(1) })) {}

// Test-only controller exercising the error pipeline (not part of the app).
@Controller("diag")
class DiagController {
  @Get("not-found")
  notFound(): never {
    throw new NotFoundError();
  }

  @Post("validate")
  validate(@Body() body: CreateThingDto): CreateThingDto {
    return body;
  }

  @Get("boom")
  boom(): never {
    throw new Error("secret internal sql detail");
  }
}

/**
 * Assert on the catalogue entry, not on a phrase inside it. What these tests actually check is
 * that Accept-Language picks the right file; the wording belongs to `docs/copy/voice.md` and is
 * rewritten whenever the voice work says so. An earlier version matched /not found/i and broke the
 * day the English copy became "That record wasn't found." — a copy edit failing an infrastructure
 * test is a false alarm, and a false alarm that fires often gets ignored.
 */
const TR_NOT_FOUND = trErrors.NOT_FOUND;
const EN_NOT_FOUND = enErrors.NOT_FOUND;
// If the two catalogues ever converge, equality below would pass with localization broken.
expect(TR_NOT_FOUND).not.toBe(EN_NOT_FOUND);

describe("error pipeline (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppI18nModule],
      controllers: [DiagController],
      providers: [
        { provide: APP_PIPE, useClass: ZodValidationPipe },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix("v1");
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("DomainError → mapped ApiError with localized message + requestId", async () => {
    const res = await request(app.getHttpServer()).get("/v1/diag/not-found");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
    expect(res.body.message).toBe(TR_NOT_FOUND); // TR default
  });

  it("localizes by Accept-Language (en)", async () => {
    const res = await request(app.getHttpServer())
      .get("/v1/diag/not-found")
      .set("Accept-Language", "en");
    expect(res.body.message).toBe(EN_NOT_FOUND);
  });

  it("validation error → 400 VALIDATION_ERROR with localized field detail", async () => {
    const res = await request(app.getHttpServer()).post("/v1/diag/validate").send({ name: "" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.details[0].path).toBe("name");
    expect(typeof res.body.details[0].message).toBe("string");
  });

  it("unknown error → 500 INTERNAL_ERROR, never leaks internals", async () => {
    const res = await request(app.getHttpServer()).get("/v1/diag/boom");
    expect(res.status).toBe(500);
    expect(res.body.code).toBe("INTERNAL_ERROR");
    expect(res.body.details).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain("secret internal sql detail");
  });
});
