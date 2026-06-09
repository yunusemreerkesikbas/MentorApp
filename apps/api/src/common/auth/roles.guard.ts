import { Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { UserRole } from "@mentor/types";
import { ForbiddenError } from "../errors/domain-error";
import { ROLES_KEY } from "./roles.decorator";
import type { RequestUser } from "./current-user";

/** Global roles guard: passes when no @Roles() is set; otherwise requires an intersection. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    if (!user) return false; // JwtAuthGuard runs first; defensive default-deny
    if (!required.some((r) => user.roles.includes(r))) {
      throw new ForbiddenError();
    }
    return true;
  }
}
