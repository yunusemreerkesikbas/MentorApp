import { Injectable, type ArgumentMetadata, type PipeTransform } from "@nestjs/common";
import type { ZodError } from "zod";
import { ValidationFailedError } from "../errors/domain-error";
import { hasZodSchema } from "./zod-dto";

/**
 * Global pipe: if the target DTO carries a Zod schema (via `createZodDto`), validate against it.
 * Otherwise pass through (e.g. primitive params, no-DTO routes). On failure → ValidationFailedError
 * with SAFE field-level details (path/code/message) → mapped to 400 VALIDATION_ERROR by the filter.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const metatype = metadata.metatype;
    if (!hasZodSchema(metatype)) return value;

    const result = metatype.schema.safeParse(value);
    if (!result.success) {
      throw new ValidationFailedError(formatZodIssues(result.error));
    }
    return result.data;
  }
}

export function formatZodIssues(error: ZodError): Array<{ path: string; code: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    code: issue.code,
    message: issue.message,
  }));
}
