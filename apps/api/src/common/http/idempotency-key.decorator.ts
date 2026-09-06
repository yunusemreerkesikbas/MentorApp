import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import { z } from "zod";
import { ValidationFailedError } from "../errors/domain-error";
import { formatZodIssues } from "../validation/zod-validation.pipe";

const schema = z.string().uuid();

/**
 * `Idempotency-Key` request header, validated — absent is fine, malformed is a 400.
 *
 * IT VALIDATES HERE BECAUSE THERE IS NOWHERE ELSE. Nest gives headers neither of the two hooks the
 * rest of this codebase validates with:
 *
 *   - A Zod DTO does nothing. `@Headers()` reports `ArgumentMetadata.type === "custom"` and hands
 *     the pipe `Object` instead of the declared class, so `ZodValidationPipe` finds no schema and
 *     returns the raw headers untouched. `@Headers() dto: SomeZodDto` READS as validation and
 *     performs none.
 *   - A pipe cannot be attached. `Headers` is declared `(property?: string) => ParameterDecorator`;
 *     unlike `@Body`/`@Query`/`@Param` it takes no pipes, and one passed anyway is ignored.
 *
 * That combination is how a non-UUID header reached `ad_reward_sessions.idempotency_key` (a `uuid`
 * column) and came back as a 500 instead of a 400. A `createParamDecorator` body is ordinary code
 * on the request path, so this check actually runs.
 *
 * Any future validated header belongs in a decorator like this one, not in a header DTO.
 */
export const IdempotencyKey = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const raw = ctx.switchToHttp().getRequest<{ headers: Record<string, unknown> }>().headers[
      "idempotency-key"
    ];
    // Absent is the common case and means "no idempotency requested" — not an error.
    if (raw === undefined || raw === "") return undefined;
    // Express collapses a repeated header into an array; one key or none, never a list.
    const value = Array.isArray(raw) ? raw[0] : raw;
    const result = schema.safeParse(value);
    if (!result.success) {
      throw new ValidationFailedError(formatZodIssues(result.error));
    }
    return result.data;
  },
);
