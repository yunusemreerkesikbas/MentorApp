import { describe, expect, it } from "vitest";
import * as validation from "@mentor/validation";
import type { ZodType } from "zod";

describe("phone verification input boundary", () => {
  it("accepts only Turkish mobile numbers and normalizes them", () => {
    const schema = (validation as unknown as Record<string, ZodType>).phoneVerificationRequestSchema;
    expect(schema, "a shared phone input schema must exist").toBeDefined();
    for (const phoneNumber of ["0532 123 45 67", "+90 (532) 123-4567", "5321234567"]) {
      expect(schema.parse({ phoneNumber }).phoneNumber).toBe("+905321234567");
    }
    for (const phoneNumber of ["+15551234567", "02121234567", "53212345678", "abc5321234567"]) {
      expect(schema.safeParse({ phoneNumber }).success).toBe(false);
    }
  });
});
