import { AuthRateLimitService } from "./application/auth-rate-limit.service";
import { AuthRateLimitRepository } from "./infrastructure/auth-rate-limit.repository";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import type { Env } from "../../config/env.validation";
import { AuthService } from "./application/auth.service";
import { GoogleAuthService } from "./application/google-auth.service";
import { GoogleLinkingService } from "./application/google-linking.service";
import { GoogleLinkingRepository } from "./infrastructure/google-linking.repository";
import { GoogleLinkingController } from "./presentation/google-linking.controller";
import { TokenService } from "./application/token.service";
import { TurnstileService } from "./application/turnstile.service";
import { UsersService } from "./application/users.service";
import { FollowService } from "./application/follow.service";
import { BuddyService } from "./application/buddy.service";
import { SocialErasureService } from "./application/social-erasure.service";
import { EmailTokenRepository } from "./infrastructure/email-token.repository";
import { AuthAccountRepository } from "./infrastructure/auth-account.repository";
import { RefreshTokenRepository } from "./infrastructure/refresh-token.repository";
import { AuthSessionRepository } from "./infrastructure/auth-session.repository";
import { UsersRepository } from "./infrastructure/users.repository";
import { FollowRepository } from "./infrastructure/follow.repository";
import { BuddyRepository } from "./infrastructure/buddy.repository";
import { AuthController } from "./presentation/auth.controller";
import { UsersController } from "./presentation/users.controller";
import { FollowController } from "./presentation/follow.controller";
import { PhoneController } from "./presentation/phone.controller";
import { PhoneVerificationService } from "./application/phone-verification.service";
import { PhoneVerificationRepository } from "./infrastructure/phone-verification.repository";
import { NetgsmSmsAdapter } from "./infrastructure/netgsm-sms.adapter";

/**
 * W0 — identity bounded context: auth (own JWT + refresh rotation), users/orgs, RLS-backed access.
 * JwtModule is registered here and exported so the global JwtAuthGuard can verify tokens.
 * EMAIL_PORT + JOB_QUEUE_PORT come from global NotificationsModule (W5).
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get("JWT_ACCESS_SECRET", { infer: true }),
      }),
    }),
  ],
  controllers: [AuthController, UsersController, FollowController, GoogleLinkingController, PhoneController],
  providers: [
    AuthService,
    AuthRateLimitService,
    AuthRateLimitRepository,
    GoogleAuthService,
    GoogleLinkingService,
    GoogleLinkingRepository,
    TokenService,
    TurnstileService,
    UsersService,
    FollowService,
    BuddyService,
    SocialErasureService,
    UsersRepository,
    FollowRepository,
    BuddyRepository,
    AuthAccountRepository,
    RefreshTokenRepository,
    AuthSessionRepository,
    EmailTokenRepository,
    PhoneVerificationService,
    PhoneVerificationRepository,
    NetgsmSmsAdapter,
  ],
  exports: [AuthService, AuthRateLimitService, UsersRepository, UsersService, FollowService, BuddyService, TokenService, SocialErasureService, PhoneVerificationService],
})
export class IdentityModule {}
