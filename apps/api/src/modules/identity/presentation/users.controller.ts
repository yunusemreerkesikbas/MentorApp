import { Body, Controller, Get, HttpCode, Patch, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import { ADMIN_REFRESH_COOKIE, ADMIN_REFRESH_COOKIE_PATH, LEGACY_REFRESH_COOKIE, REFRESH_COOKIE, REFRESH_COOKIE_PATH } from "../domain/identity.constants";
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
  async updateMe(@CurrentUser() user: RequestUser, @Body() dto: UpdateMeDto,
    @Res({ passthrough: true }) res: Response): Promise<AuthUser> {
    const result = await this.users.updateMe(user.id, dto, user.sessionId);
    if (dto.email !== undefined) {
      res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
      res.clearCookie(LEGACY_REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
      res.clearCookie(ADMIN_REFRESH_COOKIE, { path: ADMIN_REFRESH_COOKIE_PATH });
    }
    return result;
  }

  @Post("me/avatar-upload-url")
  createAvatarUploadUrl(
    @CurrentUser() user: RequestUser,
    @Body() dto: AvatarUploadUrlDto,
  ): Promise<AvatarUploadUrlResponseDto> {
    return this.users.createAvatarUploadUrl(user.id, user.sessionId, dto);
  }

  @Post("me/verification-email")
  @HttpCode(200)
  async resendVerificationEmail(@CurrentUser() user: RequestUser): Promise<{ ok: true }> {
    await this.auth.resendVerificationEmail(user.id);
    return { ok: true };
  }
}
