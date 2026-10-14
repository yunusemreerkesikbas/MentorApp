import { Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import type { Env } from "../../config/env.validation";
import { UsersService } from "../../modules/identity/application/users.service";
import { UnauthorizedError } from "../errors/domain-error";
import type { RequestUser } from "./current-user";
import { CloudflareAccessVerifier } from "./cloudflare-access-verifier";

type AdminRequest = Request & { user?: RequestUser; cloudflareAccessEmail?: string };

/** Adds the Cloudflare Access identity as a second, cryptographic admin boundary in production. */
@Injectable()
export class CloudflareAccessGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly verifier: CloudflareAccessVerifier,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const path = request.originalUrl?.split("?", 1)[0] ?? request.path;
    const isAdminAuth = /^\/(?:v1\/)?auth\/admin(?:\/|$)/i.test(path);
    const isAdminApi = isAdminAuth || /^\/(?:v1\/)?admin(?:\/|$)/i.test(path);
    if (!isAdminApi || this.config.get("NODE_ENV", { infer: true }) !== "production") {
      return true;
    }

    const assertion = request.headers["cf-access-jwt-assertion"];
    if (typeof assertion !== "string" || (!isAdminAuth && !request.user)) throw new UnauthorizedError();

    try {
      const accessIdentity = await this.verifier.verify(assertion);
      if (isAdminAuth) {
        request.cloudflareAccessEmail = accessIdentity.email;
        return true; // Login/refresh bind this verified email to the account inside identity.
      }
      const appIdentity = await this.users.getAdminAccessIdentity(request.user!.id);
      if (!appIdentity || accessIdentity.email !== appIdentity.email.toLowerCase()) {
        throw new UnauthorizedError();
      }
      return true;
    } catch {
      throw new UnauthorizedError();
    }
  }
}
