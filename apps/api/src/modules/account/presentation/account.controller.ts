import { Controller, Delete, HttpCode, HttpStatus, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import {
  REFRESH_COOKIE,
  REFRESH_COOKIE_PATH,
  UserStatus,
} from "../../identity/domain/identity.constants";
import { AccountErasureService } from "../application/account-erasure.service";

/**
 * Self-service KVKK erasure ("hesabımı sil"). Irreversible: cancels the subscription, erases every
 * module's behavioral data, anonymizes the identity row (status DELETED → the `status !== ACTIVE`
 * login gate blocks any future sign-in) and revokes all sessions. Payment/invoice records are kept
 * (legal retention). The client is expected to confirm before calling this.
 */
@ApiTags("account")
@ApiBearerAuth()
@Controller("account")
export class AccountController {
  constructor(private readonly erasure: AccountErasureService) {}

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMyAccount(
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.erasure.eraseAccount(user.id, UserStatus.DELETED);
    // Sessions are already revoked server-side; drop the refresh cookie too (logout pattern).
    res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
  }
}
