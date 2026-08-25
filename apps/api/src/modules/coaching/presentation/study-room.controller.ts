import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { StudyRoomDetailDto, StudyRoomDto } from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { StudyRoomService } from "../application/study-room.service";
import { CreateStudyRoomDto, JoinStudyRoomDto, UpdateStudyRoomDto } from "./coaching.dto";

/**
 * Study rooms ("masa") — persistent, themed, invite-code tables for co-working.
 * Authenticated; every route is gated by `coaching.study_rooms.enabled` inside the service.
 */
@ApiTags("coaching")
@ApiBearerAuth()
@Controller("study-rooms")
export class StudyRoomController {
  constructor(private readonly rooms: StudyRoomService) {}

  /** "Masalarım" — rooms the user belongs to, with seat and live-presence counts. */
  @Get()
  list(@CurrentUser() user: RequestUser): Promise<StudyRoomDto[]> {
    return this.rooms.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateStudyRoomDto,
  ): Promise<StudyRoomDetailDto> {
    return this.rooms.create(user.id, dto);
  }

  /** Join by invite code. Members only ever hold one seat per room. */
  @Post("join")
  join(
    @CurrentUser() user: RequestUser,
    @Body() dto: JoinStudyRoomDto,
  ): Promise<StudyRoomDetailDto> {
    return this.rooms.join(user.id, dto);
  }

  /** Room view: seats + who is focusing right now. Members only. */
  @Get(":id")
  detail(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<StudyRoomDetailDto> {
    return this.rooms.getDetail(user.id, id);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudyRoomDto,
  ): Promise<StudyRoomDetailDto> {
    return this.rooms.update(user.id, id, dto);
  }

  /** Rotate a leaked invite code (owner). Existing memberships are unaffected. */
  @Post(":id/code")
  rotateCode(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<StudyRoomDetailDto> {
    return this.rooms.rotateInviteCode(user.id, id);
  }

  /** Leave. Owner leaving hands the room over; the last member out closes it. */
  @Delete(":id/members/me")
  @HttpCode(HttpStatus.NO_CONTENT)
  leave(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.rooms.leave(user.id, id);
  }

  /** Owner removes a member. No ban list in v1 — rotate the code to make it stick. */
  @Delete(":id/members/:userId")
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("userId", ParseUUIDPipe) targetUserId: string,
  ): Promise<void> {
    return this.rooms.removeMember(user.id, id, targetUserId);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  close(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.rooms.close(user.id, id);
  }
}
