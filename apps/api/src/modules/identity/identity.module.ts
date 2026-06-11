import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import type { Env } from "../../config/env.validation";
import { EMAIL_PORT } from "../../shared/ports/email.port";
import { LoggerEmailAdapter } from "../../shared/adapters/email/logger-email.adapter";
import { AuthService } from "./application/auth.service";
import { TokenService } from "./application/token.service";
import { TurnstileService } from "./application/turnstile.service";
import { UsersService } from "./application/users.service";
import { EmailTokenRepository } from "./infrastructure/email-token.repository";
import { RefreshTokenRepository } from "./infrastructure/refresh-token.repository";
import { UsersRepository } from "./infrastructure/users.repository";
import { AuthController } from "./presentation/auth.controller";
import { UsersController } from "./presentation/users.controller";

/**
 * W0 — identity bounded context: auth (own JWT + refresh rotation), users/orgs, RLS-backed access.
 * JwtModule is registered here and exported so the global JwtAuthGuard can verify tokens.
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
  controllers: [AuthController, UsersController],
  providers: [
    AuthService,
    TokenService,
    TurnstileService,
    UsersService,
    UsersRepository,
    RefreshTokenRepository,
    EmailTokenRepository,
    // Dev email adapter; W5 swaps in Postmark behind the same port.
    { provide: EMAIL_PORT, useClass: LoggerEmailAdapter },
  ],
  // UsersService is exported as the cross-module accessor for the current user's profile
  // (e.g. coaching reads displayName + examType via getMe — never by querying `users` directly).
  exports: [UsersRepository, UsersService],
})
export class IdentityModule {}
