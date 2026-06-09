import type { ArgumentMetadata } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ValidationFailedError } from "../errors/domain-error";
import { createZodDto } from "./zod-dto";
import { ZodValidationPipe } from "./zod-validation.pipe";

const Schema = z.object({ name: z.string().min(1) });
class CreateThingDto extends createZodDto(Schema) {}

const meta = (metatype: unknown): ArgumentMetadata =>
  ({ type: "body", metatype, data: "" }) as ArgumentMetadata;

describe("ZodValidationPipe", () => {
  const pipe = new ZodValidationPipe();

  it("passes through when the metatype carries no schema", () => {
    expect(pipe.transform("x", meta(String))).toBe("x");
  });

  it("validates and returns parsed data for a Zod DTO", () => {
    expect(pipe.transform({ name: "Ada" }, meta(CreateThingDto))).toEqual({ name: "Ada" });
  });

  it("throws ValidationFailedError with safe field details on invalid input", () => {
    try {
      pipe.transform({ name: "" }, meta(CreateThingDto));
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationFailedError);
      const details = (err as ValidationFailedError).details as Array<{ path: string }>;
      expect(details[0]?.path).toBe("name");
    }
  });
});
