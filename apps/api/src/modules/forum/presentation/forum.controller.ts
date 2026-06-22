import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { type Paginated, UserRole, type ZoneMemberStatus, type ZoneView } from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { Roles } from "../../../common/auth/roles.decorator";
import type { ZoneRole } from "@mentor/types";
import { ForumService } from "../application/forum.service";
import {
  ApproveMemberDto,
  AssignOwnerDto,
  CreateZoneDto,
  ZoneListQueryDto,
} from "./forum.dto";

/**
 * Forum/community (design 2026-06-22). All routes under /v1/forum. Reads are open to any authed
 * user (RLS-gated); zone creation + OWNER assignment are curated (platform staff, @Roles); member
 * approval is policy-checked in the service (owner/mod or staff). Feature-flag gated in the service.
 */
@ApiTags("forum")
@ApiBearerAuth()
@Controller("forum")
export class ForumController {
  constructor(private readonly forum: ForumService) {}

  @Get("zones")
  list(
    @CurrentUser() user: RequestUser,
    @Query() q: ZoneListQueryDto,
  ): Promise<Paginated<ZoneView>> {
    return this.forum.listZones(user.id, q);
  }

  @Get("zones/:slug")
  get(@CurrentUser() user: RequestUser, @Param("slug") slug: string): Promise<ZoneView> {
    return this.forum.getZone(user.id, slug);
  }

  @Post("zones")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR, UserRole.EDITOR)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateZoneDto): Promise<ZoneView> {
    return this.forum.createZone(user.roles, user.id, dto);
  }

  @Post("zones/:id/owner")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  async assignOwner(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: AssignOwnerDto,
  ): Promise<{ status: string }> {
    await this.forum.assignOwner(user.roles, id, dto.userId);
    return { status: "ok" };
  }

  @Post("zones/:id/join")
  async join(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
  ): Promise<{ status: ZoneMemberStatus }> {
    const zone = await this.forum.getZoneById(id, user.id);
    return this.forum.join(id, user.id, zone.joinPolicy);
  }

  @Post("zones/:id/members/:userId/approve")
  async approve(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Param("userId") targetUserId: string,
    @Body() dto: ApproveMemberDto,
  ): Promise<{ status: string }> {
    const membership = await this.forum.getActorMembership(id, user.id);
    await this.forum.approveMember(
      {
        userId: user.id,
        platformRoles: user.roles,
        zoneRole: (membership?.role as ZoneRole | undefined) ?? null,
      },
      id,
      targetUserId,
      dto.approve,
    );
    return { status: "ok" };
  }
}
