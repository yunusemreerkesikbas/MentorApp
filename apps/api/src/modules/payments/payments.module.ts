import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../config/env.validation";
import { INVOICE_PORT } from "../../shared/ports/invoice.port";
import { PAYMENTS_PORT } from "../../shared/ports/payments.port";
import { CoachingModule } from "../coaching/coaching.module";
import { IdentityModule } from "../identity/identity.module";
import { PromotionsModule } from "../promotions/promotions.module";
import { EntitlementService } from "./application/entitlement.service";
import { FeaturePolicyService } from "./application/feature-policy.service";
import { SubscriptionsService } from "./application/subscriptions.service";
import { WebhookService } from "./application/webhook.service";
import { DisabledPaymentsAdapter } from "./infrastructure/adapters/disabled-payments.adapter";
import { FakePaymentsAdapter } from "./infrastructure/adapters/fake-payments.adapter";
import { IyzicoPaymentsAdapter } from "./infrastructure/adapters/iyzico-payments.adapter";
import { LoggerInvoiceAdapter } from "./infrastructure/adapters/logger-invoice.adapter";
import {
  PaymentEventsRepository,
  PlansRepository,
  SubscriptionsRepository,
} from "./infrastructure/payments.repositories";
import { PaymentsWebhookController } from "./presentation/payments-webhook.controller";
import { PremiumGuard } from "./presentation/premium.guard";
import { SubscriptionsController } from "./presentation/subscriptions.controller";

/**
 * W4 — payments bounded context (§7): subscription billing behind PaymentsPort.
 * Provider selected by env (fake = dev/test; iyzico = production, Phase-0 pending).
 * Exports the premium gate consumed by W3/W6 (EntitlementService + PremiumGuard).
 */
@Module({
  imports: [IdentityModule, PromotionsModule, CoachingModule],
  controllers: [SubscriptionsController, PaymentsWebhookController],
  providers: [
    PlansRepository,
    SubscriptionsRepository,
    PaymentEventsRepository,
    SubscriptionsService,
    FeaturePolicyService,
    EntitlementService,
    WebhookService,
    PremiumGuard,
    DisabledPaymentsAdapter,
    FakePaymentsAdapter,
    IyzicoPaymentsAdapter,
    {
      provide: PAYMENTS_PORT,
      inject: [ConfigService, DisabledPaymentsAdapter, FakePaymentsAdapter, IyzicoPaymentsAdapter],
      useFactory: (
        config: ConfigService<Env, true>,
        disabled: DisabledPaymentsAdapter,
        fake: FakePaymentsAdapter,
        iyzico: IyzicoPaymentsAdapter,
      ) => {
        const provider = config.get("PAYMENTS_PROVIDER", { infer: true });
        if (provider === "disabled") return disabled;
        return provider === "iyzico" ? iyzico : fake;
      },
    },
    { provide: INVOICE_PORT, useClass: LoggerInvoiceAdapter },
  ],
  exports: [EntitlementService, PremiumGuard, SubscriptionsService],
})
export class PaymentsModule {}
