import { Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { HttpStatus } from "@nestjs/common";
import type { AccessTokenPayload } from "../../modules/identity/domain/identity.constants";
import { DomainError, UnauthorizedError } from "../errors/domain-error";
import { ErrorCode } from "../errors/error-code";
import { IS_PUBLIC_KEY } from "./public.decorator";
import type { RequestUser } from "./current-user";

/**
 * Global JWT guard (APP_GUARD). Routes/controllers marked @Public() are skipped
 * (health, auth endpoints, docs). On success attaches `req.user` (RequestUser).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) throw new UnauthorizedError();

    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
      req.user = { id: payload.sub, roles: payload.roles, orgId: payload.orgId };
      return true;
    } catch {
      // Expired/invalid access token → 401 with a stable code (client triggers refresh).
      throw new DomainError(ErrorCode.AUTH_TOKEN_EXPIRED, HttpStatus.UNAUTHORIZED);
    }
  }
}
