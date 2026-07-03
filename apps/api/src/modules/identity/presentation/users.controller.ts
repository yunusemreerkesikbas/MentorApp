import { Body, Controller, Get, HttpCode, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthUser, AvatarUploadUrlDto as AvatarUploadUrlResponseDto } from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { AuthService } from "../application/auth.service";
import { UsersService } from "../application/users.service";
import { AvatarUploadUrlDto, UpdateMeDto } from "./auth.dto";

/** Authenticated self endpoints (global JwtAuthGuard applies — no @Public here). */
@ApiTags("users")
@ApiBearerAuth()
@Controller("users")
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly auth: AuthService,
  ) {}

  @Get("me")
  me(@CurrentUser() user: RequestUser): Promise<AuthUser> {
    return this.users.getMe(user.id);
  }

  @Patch("me")
  updateMe(@CurrentUser() user: RequestUser, @Body() dto: UpdateMeDto): Promise<AuthUser> {
    return this.users.updateMe(user.id, dto);
  }

  @Post("me/avatar-upload-url")
  createAvatarUploadUrl(
    @CurrentUser() user: RequestUser,
    @Body() dto: AvatarUploadUrlDto,
  ): Promise<AvatarUploadUrlResponseDto> {
    return this.users.createAvatarUploadUrl(user.id, dto);
  }

  @Post("me/verification-email")
  @HttpCode(200)
  async resendVerificationEmail(@CurrentUser() user: RequestUser): Promise<{ ok: true }> {
    await this.auth.resendVerificationEmail(user.id);
    return { ok: true };
  }
}
