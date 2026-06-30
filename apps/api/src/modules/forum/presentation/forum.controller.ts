import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  type Paginated,
  type ZoneMemberStatus,
  type ZoneMemberView,
  type ZoneRole,
  type ZoneView,
} from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { ForumService } from "../application/forum.service";
import {
  ApproveMemberDto,
  AssignOwnerDto,
  CreateZoneDto,
  ZoneListQueryDto,
  ZoneMembersQueryDto,
} from "./forum.dto";

/**
 * Forum/community (design 2026-06-22). All routes under /v1/forum. Reads are open to any authed
 * user (RLS-gated). Authorization for mutations is decided in one place — `forum.policy` via the
 * service (curated zone creation = platform staff; member approval = zone owner/mod or staff) —
 * so there is no second, divergent `@Roles` list here. Feature-flag gated in the service.
 */
@ApiTags("forum")
@ApiBearerAuth()
@Controller("forum")
export class ForumController {
  constructor(private readonly forum: ForumService) {}

  private actor(user: RequestUser, zoneRole: ZoneRole | null): {
    userId: string;
    platformRoles: string[];
    zoneRole: ZoneRole | null;
  } {
    return { userId: user.id, platformRoles: user.roles, zoneRole };
  }

  @Get("zones")
  list(
    @CurrentUser() user: RequestUser,
    @Query() q: ZoneListQueryDto,
  ): Promise<Paginated<ZoneView>> {
    return this.forum.listZones(user.id, user.roles, q);
  }

  @Get("zones/:slug")
  get(@CurrentUser() user: RequestUser, @Param("slug") slug: string): Promise<ZoneView> {
    return this.forum.getZone(user.id, user.roles, slug);
  }

  @Post("zones")
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateZoneDto): Promise<ZoneView> {
    return this.forum.createZone(user.roles, user.id, dto);
  }

  @Post("zones/:id/owner")
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
    const joinPolicy = await this.forum.getJoinPolicy(id, user.id);
    return this.forum.join(id, user.id, joinPolicy);
  }

  @Get("zones/:id/members")
  async members(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Query() q: ZoneMembersQueryDto,
  ): Promise<ZoneMemberView[]> {
    const membership = await this.forum.getActorMembership(id, user.id);
    return this.forum.listMembers(
      this.actor(user, (membership?.role as ZoneRole | undefined) ?? null),
      id,
      q.status,
    );
  }

  @Delete("zones/:id/members/:userId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Param("userId") userId: string,
  ): Promise<void> {
    const membership = await this.forum.getActorMembership(id, user.id);
    await this.forum.removeMember(
      this.actor(user, (membership?.role as ZoneRole | undefined) ?? null),
      id,
      userId,
    );
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
      this.actor(user, (membership?.role as ZoneRole | undefined) ?? null),
      id,
      targetUserId,
      dto.approve,
    );
    return { status: "ok" };
  }
}
