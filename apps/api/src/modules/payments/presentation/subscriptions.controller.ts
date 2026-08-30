import { Body, Controller, Get, Headers, HttpCode, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type {
  CheckoutSession,
  PlanDto,
  PromotionOffersView,
  SubscriptionView,
} from "@mentor/types";
import { checkoutSchema, promotionOffersSchema } from "@mentor/validation";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { Public } from "../../../common/auth/public.decorator";
import { createZodDto } from "../../../common/validation/zod-dto";
import { UsersService } from "../../identity/application/users.service";
import {
  SubscriptionsService,
  type CheckoutUser,
} from "../application/subscriptions.service";

class CheckoutDto extends createZodDto(checkoutSchema) {}
class PromotionOffersDto extends createZodDto(promotionOffersSchema) {}

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

  /**
   * Per-plan price after promotions. Omit `code` for the automatically applied offer; send one to
   * try a coupon. POST, not GET: a coupon attempt does not belong in a URL or a proxy cache.
   *
   * ponytail: route throttle only. Add a per-user failed-attempt lockout if the logs ever show
   * someone walking the code space — public campaign codes are meant to be shared, and the real
   * abuse ceiling is `max_redemptions`, not secrecy.
   */
  @ApiBearerAuth()
  @Post("subscription/offers")
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async offers(
    @CurrentUser() user: RequestUser,
    @Body() dto: PromotionOffersDto,
    @Headers("accept-language") acceptLanguage?: string,
  ): Promise<PromotionOffersView> {
    return this.subscriptions.resolveOffers(
      await this.checkoutUser(user),
      dto.code,
      acceptLanguage?.toLowerCase().startsWith("en") ? "en" : "tr",
    );
  }

  @ApiBearerAuth()
  @Post("subscription/checkout")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async checkout(
    @CurrentUser() user: RequestUser,
    @Body() dto: CheckoutDto,
  ): Promise<CheckoutSession> {
    return this.subscriptions.checkout(await this.checkoutUser(user), dto.planId, dto.code);
  }

  /** Email + signup date come from identity's public service (cross-module rule §AGENTS-2). */
  private async checkoutUser(user: RequestUser): Promise<CheckoutUser> {
    const me = await this.users.getMe(user.id);
    return {
      id: user.id,
      email: me.email,
      createdAt: new Date(me.createdAt),
      orgId: user.orgId,
    };
  }

  @ApiBearerAuth()
  @Post("subscription/cancel")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  cancel(@CurrentUser() user: RequestUser): Promise<SubscriptionView> {
    return this.subscriptions.cancel(user.id, user.roles);
  }
}
