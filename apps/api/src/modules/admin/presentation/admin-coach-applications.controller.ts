import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseInterceptors,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole, type AdminCoachApplicationDto } from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { Roles } from "../../../common/auth/roles.decorator";
import {
  MentorshipApplicationService,
  toAdminDto,
} from "../../mentorship/application/mentorship-application.service";
import { AdminUsersService } from "../application/admin-users.service";
import { AuditAction, AuditTargetType } from "../domain/admin.constants";
import { AdminAuditInterceptor } from "./admin-audit.interceptor";
import { ListCoachApplicationsQueryDto, ReviewCoachApplicationDto } from "./admin.dto";
import { Audit } from "./audit.decorator";
import { setAuditContext, type AuditableRequest } from "./audit-context";

/**
 * Coach vetting (roadmap §5 curation) — the admin half.
 *
 * It lives here rather than in W8 for two reasons that point the same way: every admin mutation
 * has to pass `AdminAuditInterceptor`, and the approval needs BOTH the verdict (W8's table) and
 * the COACH role (W6's `AdminUsersService`). Admin is the layer allowed to hold both — the same
 * arrangement `AdminForumController` and the sponsorship metrics endpoint already use.
 *
 * SUPER_ADMIN, matching `POST /users/:id/roles/:role`: approving an application IS granting that
 * role, so it cannot be a softer permission than granting it directly.
 */
@ApiTags("admin")
@ApiBearerAuth()
@Roles(UserRole.SUPER_ADMIN)
@UseInterceptors(AdminAuditInterceptor)
@Controller("admin/coach-applications")
export class AdminCoachApplicationsController {
  constructor(
    private readonly applications: MentorshipApplicationService,
    private readonly users: AdminUsersService,
  ) {}

  /** The queue. W8 supplies the applications, admin puts the people back on them. */
  @Get()
  async list(@Query() query: ListCoachApplicationsQueryDto): Promise<AdminCoachApplicationDto[]> {
    const rows = await this.applications.listForReview(query.status);
    const people = await this.users.listByIds(rows.map((row) => row.userId));
    return rows.map((row) => {
      const person = people.get(row.userId);
      return toAdminDto(row, {
        displayName: person?.displayName ?? "",
        email: person?.email ?? "",
        // Reported, not inferred from `status` — see the two-write note on `review` below.
        hasCoachRole: person?.roles.includes(UserRole.COACH) ?? false,
      });
    });
  }

  /**
   * The verdict. Approving grants COACH; rejecting does not revoke it.
   *
   * TWO WRITES, TWO TRANSACTIONS, AND THE ORDER IS THE DESIGN. The role lives in W6 and the
   * verdict in W8; admin already imports mentorship for the queue, so mentorship importing admin
   * back would be a cycle. One transaction is therefore not available, and pretending otherwise
   * would be worse than choosing a failure mode on purpose:
   *
   *   role first  → a crash leaves COACH granted with the application still PENDING. The row stays
   *                 in the queue, the admin decides again, `grantRole` is idempotent, and the
   *                 second attempt completes it. Visible, and self-healing.
   *   verdict first → a crash leaves APPROVED with no role. The row LEAVES the queue, nobody is
   *                 told, and the coach cannot open their panel without knowing why. Invisible.
   *
   * The list above still reports `hasCoachRole` so even the visible failure is not left to memory.
   *
   * Rejection deliberately does not revoke an existing COACH role: taking a role away is its own
   * act with its own severity, the same line `mentorship.coach.free_seats` draws about seats.
   */
  @Post(":applicationId/review")
  @HttpCode(HttpStatus.OK)
  @Audit(AuditAction.COACH_APPLICATION_REVIEW)
  async review(
    @CurrentUser() actor: RequestUser,
    @Param("applicationId", ParseUUIDPipe) applicationId: string,
    @Body() dto: ReviewCoachApplicationDto,
    @Req() req: AuditableRequest,
  ): Promise<AdminCoachApplicationDto> {
    const target = await this.applications.findById(applicationId);

    if (dto.decision === "APPROVE") {
      await this.users.grantRole(target.userId, UserRole.COACH);
    }
    const reviewed = await this.applications.review(applicationId, actor.id, {
      decision: dto.decision,
      verifiedClaims: dto.verifiedClaims,
      reviewNote: dto.reviewNote ?? null,
    });

    setAuditContext(req, {
      targetType: AuditTargetType.COACH_APPLICATION,
      targetId: applicationId,
      before: { status: target.status },
      // `reviewed` is null when the row had already been decided — a retry, or two reviewers on the
      // same morning. The audit line records what this call actually changed, which is nothing.
      after: {
        status: reviewed?.status ?? target.status,
        verifiedClaims: reviewed?.verifiedClaims ?? [],
        applied: reviewed !== null,
      },
    });

    const person = (await this.users.listByIds([target.userId])).get(target.userId);
    return toAdminDto(reviewed ?? target, {
      displayName: person?.displayName ?? "",
      email: person?.email ?? "",
      hasCoachRole: person?.roles.includes(UserRole.COACH) ?? false,
    });
  }
}
