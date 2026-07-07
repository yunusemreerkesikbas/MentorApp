import { Body, Controller, Get, HttpCode, Post, Query, Req, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import type { AuthSession } from "@mentor/types";
import { Public } from "../../../common/auth/public.decorator";
import type { Env } from "../../../config/env.validation";
import {
  GOOGLE_OAUTH_COOKIE_PATH,
  GOOGLE_OAUTH_STATE_COOKIE,
  GOOGLE_OAUTH_STATE_TTL_MS,
  REFRESH_COOKIE,
  REFRESH_COOKIE_PATH,
} from "../domain/identity.constants";
import { AuthService, type AuthResult } from "../application/auth.service";
import { GoogleAuthService, type GoogleOAuthStatus } from "../application/google-auth.service";
import {
  ForgotPasswordDto,
  GoogleOAuthCallbackQueryDto,
  GoogleOAuthStartQueryDto,
  LoginDto,
  ResetPasswordDto,
  SignupDto,
  VerifyEmailDto,
} from "./auth.dto";

/**
 * Auth endpoints — all @Public (they ARE the auth boundary).
 * Refresh token travels ONLY in an httpOnly cookie scoped to /v1/auth;
 * responses carry the short-lived access token + user snapshot (AuthSession).
 * Throttled (brute-force brake; the real edge rate-limit is Cloudflare in prod).
 */
@ApiTags("auth")
@Public()
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly googleAuth: GoogleAuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Post("signup")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async signup(
    @Body() dto: SignupDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSession> {
    return this.finish(await this.auth.signup(dto), res);
  }

  @Post("login")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSession> {
    return this.finish(await this.auth.login(dto), res);
  }

  @Get("google/start")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async googleStart(
    @Query() query: GoogleOAuthStartQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const start = await this.googleAuth.createStartFor({
      mode: query.mode,
      locale: query.locale,
      returnTo: query.returnTo,
      kvkkAccepted: query.kvkkAccepted === "true",
    });
    const isProd = this.config.get("NODE_ENV", { infer: true }) === "production";
    res.cookie(GOOGLE_OAUTH_STATE_COOKIE, start.cookieValue, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: GOOGLE_OAUTH_COOKIE_PATH,
      maxAge: GOOGLE_OAUTH_STATE_TTL_MS,
    });
    res.redirect(start.url);
  }

  @Get("google/status")
  googleStatus(): Promise<GoogleOAuthStatus> {
    return this.googleAuth.status();
  }

  @Get("google/callback")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async googleCallback(
    @Query() query: GoogleOAuthCallbackQueryDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const raw = (req.cookies as Record<string, string> | undefined)?.[GOOGLE_OAUTH_STATE_COOKIE];
    const state = this.googleAuth.verifyState(raw, query.state);
    res.clearCookie(GOOGLE_OAUTH_STATE_COOKIE, { path: GOOGLE_OAUTH_COOKIE_PATH });
    const result = await this.googleAuth.callback(query.code, state);
    this.finish(result, res);
    res.redirect(this.googleAuth.redirectUrl(state, result.user));
  }

  @Post("refresh")
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSession> {
    const raw = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    // Missing cookie → same 401 path as an invalid token (service throws).
    return this.finish(await this.auth.refresh(raw ?? ""), res);
  }

  @Post("logout")
  @HttpCode(204)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const raw = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    await this.auth.logout(raw);
    res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
  }

  @Post("verify-email")
  @HttpCode(200)
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<{ ok: true }> {
    await this.auth.verifyEmail(dto);
    return { ok: true };
  }

  @Post("forgot-password")
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ ok: true }> {
    await this.auth.forgotPassword(dto);
    return { ok: true }; // always 200 — no user enumeration
  }

  @Post("reset-password")
  @HttpCode(200)
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ ok: true }> {
    await this.auth.resetPassword(dto);
    return { ok: true };
  }

  /** Sets the refresh cookie and shapes the public AuthSession payload. */
  private finish(result: AuthResult, res: Response): AuthSession {
    const isProd = this.config.get("NODE_ENV", { infer: true }) === "production";
    res.cookie(REFRESH_COOKIE, result.tokens.refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: REFRESH_COOKIE_PATH,
      expires: result.tokens.refreshExpiresAt,
    });
    return {
      accessToken: result.tokens.accessToken,
      expiresIn: result.tokens.expiresIn,
      user: result.user,
    };
  }
}
