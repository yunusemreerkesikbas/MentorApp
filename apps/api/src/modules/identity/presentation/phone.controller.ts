import { Body, Controller, Get, HttpCode, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { PhoneVerificationService } from "../application/phone-verification.service";
import { PhoneStatusResponseDto, PhoneVerificationConfirmDto, PhoneVerificationParamsDto,
  PhoneVerificationRequestDto, PhoneVerificationResponseDto } from "./phone.dto";

/** Global JWT guard applies. Never place phone endpoints on the public auth controller. */
@ApiTags("phone")
@ApiBearerAuth()
@Controller("users/me/phone")
export class PhoneController {
  constructor(private readonly phone: PhoneVerificationService) {}

  @Get()
  @ApiOkResponse({ type: PhoneStatusResponseDto })
  getStatus(@CurrentUser() user: RequestUser) { return this.phone.getStatus(user); }

  @Post("verifications")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiCreatedResponse({ type: PhoneVerificationResponseDto })
  requestVerification(@CurrentUser() user: RequestUser, @Body() input: PhoneVerificationRequestDto) {
    return this.phone.requestVerification(user, input);
  }

  @Post("verifications/:challengeId/confirm")
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOkResponse({ type: PhoneStatusResponseDto })
  confirmVerification(@CurrentUser() user: RequestUser, @Param() params: PhoneVerificationParamsDto,
    @Body() input: PhoneVerificationConfirmDto) {
    return this.phone.confirmVerification(user, params.challengeId, input.code);
  }
}
