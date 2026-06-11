import { HttpStatus, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import type { RequestUser } from "../../../common/auth/current-user";
import { DomainError, UnauthorizedError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { EntitlementService } from "../application/entitlement.service";

/**
 * Premium gate (§7/§10) — used by W3 (ai) routes: `@UseGuards(PremiumGuard)`.
 * Runs after the global JwtAuthGuard (req.user present). FREE → 403 PAYMENT_PREMIUM_REQUIRED
 * with a localized message the client can show verbatim.
 */
@Injectable()
export class PremiumGuard implements CanActivate {
  constructor(private readonly entitlement: EntitlementService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { user } = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    if (!user) throw new UnauthorizedError();

    // Roles from the verified JWT — STAFF short-circuits without a DB lookup.
    const ent = await this.entitlement.getEntitlement(user.id, user.roles);
    if (!ent.isPremium) {
      throw new DomainError(ErrorCode.PAYMENT_PREMIUM_REQUIRED, HttpStatus.FORBIDDEN);
    }
    return true;
  }
}
