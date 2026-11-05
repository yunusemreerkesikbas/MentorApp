import { HttpStatus } from "@nestjs/common";
import { FeatureFlag } from "../../../common/config/config.catalog";
import type { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import type { InvitationRole } from "../../../database/schema-signup-invitations";
import type { SignupInvitationRepository } from "../infrastructure/signup-invitation.repository";

export type SignupAdmission = { mode: "open" } | { mode: "invited"; role: InvitationRole };

/** Shared boundary for NEW accounts only; existing login/linking never consumes an invitation. */
export async function assertSignupAdmission(
  registry: Pick<ConfigRegistryService, "get">,
  invitations: Pick<SignupInvitationRepository, "findInvited">,
  email: string,
): Promise<SignupAdmission> {
  if (await registry.get(FeatureFlag.SIGNUP_ENABLED) !== true) {
    throw new DomainError(ErrorCode.AUTH_SIGNUP_CLOSED, HttpStatus.FORBIDDEN);
  }
  const pilot = await registry.get(FeatureFlag.SIGNUP_PILOT_ENABLED);
  if (pilot === false) return { mode: "open" };
  if (pilot !== true) throw new DomainError(ErrorCode.AUTH_SIGNUP_CLOSED, HttpStatus.FORBIDDEN);

  // Capacity (signup.pilot.max_invited_emails) only limits issuing new invites, never admission.
  const invited = await invitations.findInvited(email);
  if (!invited) throw new DomainError(ErrorCode.AUTH_PILOT_INVITATION_REQUIRED, HttpStatus.FORBIDDEN);
  return { mode: "invited", role: invited.role };
}
