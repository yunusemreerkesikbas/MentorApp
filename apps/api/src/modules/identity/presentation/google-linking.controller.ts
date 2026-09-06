import { Body, Controller, Get, HttpCode, Post, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import type { GoogleLinkStartResponse, GoogleLinkStatus } from "@mentor/types";
import { googleLinkStartSchema } from "@mentor/validation";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { createZodDto } from "../../../common/validation/zod-dto";
import type { Env } from "../../../config/env.validation";
import { GoogleAuthService } from "../application/google-auth.service";
import { GoogleLinkingService, GOOGLE_LINK_TTL_MS } from "../application/google-linking.service";
import { GOOGLE_OAUTH_COOKIE_PATH, GOOGLE_OAUTH_STATE_COOKIE } from "../domain/identity.constants";

export class GoogleLinkStartDto extends createZodDto(googleLinkStartSchema) {}

@ApiTags("users")
@ApiBearerAuth()
@Controller("users/me/auth-accounts/google")
export class GoogleLinkingController {
  constructor(
    private readonly linking: GoogleLinkingService,
    private readonly google: GoogleAuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Get()
  async status(@CurrentUser() user: RequestUser): Promise<GoogleLinkStatus> {
    const [link, provider] = await Promise.all([this.linking.status(user.id), this.google.status()]);
    return { ...link, enabled: provider.enabled, canLink: provider.enabled && link.canLink };
  }

  @Post("start")
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async start(
    @CurrentUser() user: RequestUser,
    @Body() input: GoogleLinkStartDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<GoogleLinkStartResponse> {
    const state = await this.linking.start(user, input);
    const start = await this.google.createLinkStartFor(state);
    res.cookie(GOOGLE_OAUTH_STATE_COOKIE, start.cookieValue, {
      httpOnly: true,
      secure: this.config.get("NODE_ENV", { infer: true }) === "production",
      sameSite: "lax",
      path: GOOGLE_OAUTH_COOKIE_PATH,
      maxAge: GOOGLE_LINK_TTL_MS,
    });
    return { url: start.url };
  }
}
