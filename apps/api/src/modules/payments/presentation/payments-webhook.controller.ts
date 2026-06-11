import { Controller, HttpCode, Post, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { HttpStatus } from "@nestjs/common";
import { Public } from "../../../common/auth/public.decorator";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { WebhookService } from "../application/webhook.service";

/**
 * Provider webhook receiver — public (the provider can't log in) but SIGNED:
 * the adapter verifies the HMAC over the RAW body (captured in main.ts) before
 * anything is processed. Idempotent: replays return 200 without re-applying.
 */
@ApiTags("payments")
@Public()
@Controller("webhooks")
export class PaymentsWebhookController {
  constructor(private readonly webhooks: WebhookService) {}

  @Post("payments")
  @HttpCode(200)
  handle(@Req() req: Request & { rawBody?: Buffer }): Promise<{ received: true; duplicate: boolean }> {
    if (!req.rawBody) {
      // Raw body missing means the verify hook didn't run — treat as unverifiable.
      throw new DomainError(ErrorCode.PAYMENT_WEBHOOK_INVALID, HttpStatus.BAD_REQUEST);
    }
    return this.webhooks.handle(req.rawBody, req.headers);
  }
}
