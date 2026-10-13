import { HttpStatus } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { FeatureFlag } from "../../../common/config/config.catalog";
import type { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import type { Env } from "../../../config/env.validation";

/** Shared boundary for NEW accounts only; existing login/linking never consumes an invitation. */
export async function assertSignupAdmission(
  registry: Pick<ConfigRegistryService, "get">,
  env: Pick<ConfigService<Env, true>, "getOrThrow">,
  email: string,
): Promise<void> {
  if (await registry.get(FeatureFlag.SIGNUP_ENABLED) !== true) {
    throw new DomainError(ErrorCode.AUTH_SIGNUP_CLOSED, HttpStatus.FORBIDDEN);
  }
  const pilot = await registry.get(FeatureFlag.SIGNUP_PILOT_ENABLED);
  if (pilot === false) return;
  if (pilot !== true) throw new DomainError(ErrorCode.AUTH_SIGNUP_CLOSED, HttpStatus.FORBIDDEN);

  const invitations = env.getOrThrow("PILOT_INVITED_EMAILS", { infer: true });
  const capacity = await registry.get("signup.pilot.max_invited_emails");
  // Lowering capacity must never silently keep the first N people or widen admission.
  if (invitations.length > capacity) {
    throw new DomainError(ErrorCode.AUTH_SIGNUP_CLOSED, HttpStatus.FORBIDDEN);
  }
  if (!invitations.includes(email)) {
    throw new DomainError(ErrorCode.AUTH_PILOT_INVITATION_REQUIRED, HttpStatus.FORBIDDEN);
  }
}
