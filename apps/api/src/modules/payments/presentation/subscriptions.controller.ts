import { Body, Controller, Get, HttpCode, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { CheckoutSession, PlanDto, SubscriptionView } from "@mentor/types";
import { checkoutSchema } from "@mentor/validation";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { Public } from "../../../common/auth/public.decorator";
import { createZodDto } from "../../../common/validation/zod-dto";
import { UsersService } from "../../identity/application/users.service";
import { SubscriptionsService } from "../application/subscriptions.service";

class CheckoutDto extends createZodDto(checkoutSchema) {}

@ApiTags("payments")
@Controller()
export class SubscriptionsController {
  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly users: UsersService,
  ) {}

  /** Public plan catalog (VAT-inclusive prices; PLACEHOLDER until Phase-0 research). */
  @Public()
  @Get("plans")
  listPlans(): Promise<PlanDto[]> {
    return this.subscriptions.listPlans();
  }

  @ApiBearerAuth()
  @Get("subscription")
  getMine(@CurrentUser() user: RequestUser): Promise<SubscriptionView> {
    return this.subscriptions.getView(user.id, user.roles);
  }

  @ApiBearerAuth()
  @Post("subscription/checkout")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async checkout(
    @CurrentUser() user: RequestUser,
    @Body() dto: CheckoutDto,
  ): Promise<CheckoutSession> {
    // Email comes from identity's public service (cross-module rule §AGENTS-2).
    const me = await this.users.getMe(user.id);
    return this.subscriptions.checkout({ id: user.id, email: me.email }, dto.planId);
  }

  @ApiBearerAuth()
  @Post("subscription/cancel")
  @HttpCode(200)
  cancel(@CurrentUser() user: RequestUser): Promise<SubscriptionView> {
    return this.subscriptions.cancel(user.id, user.roles);
  }
}
