import type { ZodSchema, infer as ZodInfer } from "zod";

/**
 * Minimal `createZodDto` — a DTO class that carries its Zod schema as a static.
 * The global ZodValidationPipe reads `metatype.schema` to validate. Keeps Zod as the
 * single validation source (§8) without a fragile third-party dependency.
 *
 * Usage:
 *   const CreateThingSchema = z.object({ name: z.string().min(1) });
 *   class CreateThingDto extends createZodDto(CreateThingSchema) {}
 */
export interface ZodDtoStatic<TSchema extends ZodSchema = ZodSchema> {
  new (): ZodInfer<TSchema>;
  schema: TSchema;
}

export function createZodDto<TSchema extends ZodSchema>(schema: TSchema): ZodDtoStatic<TSchema> {
  class AugmentedZodDto {
    static schema = schema;
  }
  return AugmentedZodDto as unknown as ZodDtoStatic<TSchema>;
}

export function hasZodSchema(metatype: unknown): metatype is ZodDtoStatic {
  return (
    typeof metatype === "function" &&
    "schema" in metatype &&
    (metatype as { schema?: unknown }).schema !== undefined
  );
}
