import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseInterceptors,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  UserRole,
  type AdminCoachApplicationDto,
  type MentorshipApplicationDto,
} from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { Roles } from "../../../common/auth/roles.decorator";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { MentorshipApplicationService } from "../../mentorship/application/mentorship-application.service";
import { toAdminDto } from "../../mentorship/application/coach-registry.mappers";
import type { MentorshipApplicationRow } from "../../mentorship/infrastructure/mentorship-application.repository";
import { AdminUsersService } from "../application/admin-users.service";
import { AuditAction, AuditTargetType } from "../domain/admin.constants";
import { AdminAuditInterceptor } from "./admin-audit.interceptor";
import {
  CoachUserParamDto,
  ListCoachesQueryDto,
  SetCoachStatusDto,
  VerifyCoachClaimsDto,
} from "./admin.dto";
import { Audit } from "./audit.decorator";
import { setAuditContext, type AuditableRequest } from "./audit-context";

/** Identity fields W8 cannot see, put back onto a registry row by the layer allowed to hold both. */
interface CoachIdentity {
  displayName: string;
  email: string;
  hasCoachRole: boolean;
}

/**
 * The coach registry — the admin half (APP-089).
 *
 * THE DIRECTION OF THIS SCREEN INVERTED. It used to be a vetting queue: nobody could coach until a
 * SUPER_ADMIN approved their application, and this controller's one job was to say yes. Registration
 * is self-service now, so nothing here stands between a coach and their account. What lives here is
 * the power to take it back, and the badge that says we checked something.
 *
 * It stays in W6 rather than moving to W8 for the two reasons that always pointed the same way:
 * every admin mutation has to pass `AdminAuditInterceptor`, and the registry read needs identity
 * (name, email, real role) that W8 deliberately cannot see. Admin is the layer allowed to hold both.
 *
 * SUPER_ADMIN, matching `POST /users/:id/roles/:role`: suspending a coach revokes that role, so it
 * cannot be a softer permission than revoking it directly.
 */
@ApiTags("admin")
@ApiBearerAuth()
@Roles(UserRole.SUPER_ADMIN)
@UseInterceptors(AdminAuditInterceptor)
@Controller("admin/coaches")
export class AdminCoachApplicationsController {
  constructor(
    private readonly applications: MentorshipApplicationService,
    private readonly users: AdminUsersService,
  ) {}

  /** The registry, one standing at a time. W8 supplies the rows, admin puts the people back on them. */
  @Get()
  async list(@Query() query: ListCoachesQueryDto): Promise<AdminCoachApplicationDto[]> {
    const rows = await this.applications.listForReview(query.status);
    const people = await this.users.listByIds(rows.map((row) => row.userId));
    return rows.map((row) =>
      toAdminDto(row, {
        displayName: people.get(row.userId)?.displayName ?? "",
        email: people.get(row.userId)?.email ?? "",
        // Reported, not inferred from `status`: the standing and the role are two writes without a
        // shared transaction, so a crash between them is only recoverable if it is visible here.
        hasCoachRole: people.get(row.userId)?.roles.includes(UserRole.COACH) ?? false,
      }),
    );
  }

  /**
   * Move a coach's standing. ACTIVE grants COACH back; anything else revokes it.
   *
   * The two writes and their ordering live in `MentorshipApplicationService.setStatus` — W8 owns the
   * registry row and reaches identity's role writer through `UsersService`, so the pair is one
   * service's job. This endpoint's own work is the audit line and the identity join.
   *
   * Addressed by USER id, not by a row id: there is no application to point at any more, and an
   * admin acting on a person should not have to look up which record represents them.
   */
  @Post(":userId/status")
  @HttpCode(HttpStatus.OK)
  @Audit(AuditAction.COACH_STATUS_CHANGE)
  async setStatus(
    @CurrentUser() actor: RequestUser,
    @Param() params: CoachUserParamDto,
    @Body() dto: SetCoachStatusDto,
    @Req() req: AuditableRequest,
  ): Promise<AdminCoachApplicationDto> {
    const before = await this.requireRegistration(params.userId);
    const row = await this.applications.setStatus(
      params.userId,
      { status: dto.status, reviewNote: dto.reviewNote ?? null },
      actor.id,
    );

    setAuditContext(req, {
      targetType: AuditTargetType.COACH_APPLICATION,
      targetId: params.userId,
      before: { status: before.status },
      // `row` is null only if the registry row disappeared between the read and the write. The
      // audit line records what this call actually changed, which in that case is nothing.
      after: { status: row?.status ?? before.status, applied: row !== null },
    });

    return this.withIdentity(params.userId, row, before);
  }

  /**
   * Mark which of a coach's claims we actually checked.
   *
   * Its own endpoint rather than a field on the status change, because the two are different
   * statements: standing is "may this person coach", a badge is "did we verify what they say about
   * themselves". Reinstating somebody must not silently re-assert badges nobody re-read.
   */
  @Post(":userId/verified-claims")
  @HttpCode(HttpStatus.OK)
  @Audit(AuditAction.COACH_CLAIMS_VERIFY)
  async verifyClaims(
    @CurrentUser() actor: RequestUser,
    @Param() params: CoachUserParamDto,
    @Body() dto: VerifyCoachClaimsDto,
    @Req() req: AuditableRequest,
  ): Promise<AdminCoachApplicationDto> {
    const before = await this.requireRegistration(params.userId);
    const row = await this.applications.setVerifiedClaims(
      params.userId,
      dto.verifiedClaims,
      actor.id,
    );

    setAuditContext(req, {
      targetType: AuditTargetType.COACH_APPLICATION,
      targetId: params.userId,
      before: { verifiedClaims: before.verifiedClaims },
      after: { verifiedClaims: row?.verifiedClaims ?? before.verifiedClaims },
    });

    return this.withIdentity(params.userId, row, before);
  }

  private async requireRegistration(userId: string): Promise<MentorshipApplicationDto> {
    const row = await this.applications.findMine(userId);
    if (!row) {
      // Somebody who holds COACH without a registry row has no standing to move: the row is written
      // by the coach, because `headline` and `bio` are their words. `assertCanInvite` keeps their
      // invite code shut until they write it.
      throw new DomainError(ErrorCode.MENTORSHIP_APPLICATION_NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    return row;
  }

  /** Puts the identity back on a registry row — the join W8 cannot do for itself. */
  private async withIdentity(
    userId: string,
    row: MentorshipApplicationRow | null,
    fallback: MentorshipApplicationDto,
  ): Promise<AdminCoachApplicationDto> {
    const person = (await this.users.listByIds([userId])).get(userId);
    const identity: CoachIdentity = {
      displayName: person?.displayName ?? "",
      email: person?.email ?? "",
      hasCoachRole: person?.roles.includes(UserRole.COACH) ?? false,
    };
    return row ? toAdminDto(row, identity) : { ...fallback, userId, ...identity };
  }
}
