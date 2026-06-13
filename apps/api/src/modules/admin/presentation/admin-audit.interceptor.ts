import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Observable } from "rxjs";
import { concatMap } from "rxjs/operators";
import type { RequestUser } from "../../../common/auth/current-user";
import { AdminAuditService } from "../application/admin-audit.service";
import { AUDIT_ACTION_KEY } from "./audit.decorator";
import type { AuditableRequest } from "./audit-context";

/**
 * Writes an `admin_audit_log` row after every `@Audit()`-marked handler succeeds (§9):
 * actor + action + ip + timestamp always; target/before/after when the handler enriches the
 * request via `setAuditContext`. Records post-commit (best-effort-but-loud — see AdminAuditService).
 */
@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AdminAuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector.get<string | undefined>(AUDIT_ACTION_KEY, context.getHandler());
    if (!action) return next.handle();

    const req = context.switchToHttp().getRequest<AuditableRequest & { user?: RequestUser }>();

    return next.handle().pipe(
      concatMap(async (data) => {
        const ctx = req.auditContext ?? {};
        await this.audit.record({
          // Guaranteed present: this interceptor only runs on @Roles(ADMIN) routes behind
          // JwtAuthGuard. Assert rather than fabricate a "" that would hit the FK and confuse.
          actorUserId: req.user!.id,
          action,
          targetType: ctx.targetType ?? null,
          targetId: ctx.targetId ?? null,
          before: ctx.before ?? null,
          after: ctx.after ?? null,
          ip: req.ip ?? null,
        });
        return data;
      }),
    );
  }
}
