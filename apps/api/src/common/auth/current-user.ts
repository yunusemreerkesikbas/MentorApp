import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

/** Authenticated principal attached to the request by JwtAuthGuard. */
export interface RequestUser {
  id: string;
  roles: string[];
  orgId: string | null;
}

/** Injects the authenticated user into a handler parameter. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<{ user?: RequestUser }>();
  return req.user;
});
